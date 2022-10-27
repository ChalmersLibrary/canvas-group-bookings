'use strict';

const pkg = require('./package.json');
const bodyParser = require('body-parser');
const express = require('express');
const session = require('express-session');
const log = require('./src/logging/');
const pg = require('pg');
const fileStore = require('session-file-store')(session);
const pgSessionStore = require('connect-pg-simple')(session);
const helmet = require('helmet');
const cors = require('cors');
const auth = require('./src/auth/oauth2');
const lti = require('./src/lti/canvas');
const canvasApi = require('./src/api/canvas');
const user = require('./src/user');
const db = require('./src/db');
const utils = require('./src/utilities');
const email = require('./src/mail');

const port = process.env.PORT || 3000;
const cookieMaxAge = 3600000 * 24 * 30 * 4; // 4 months
const fileStoreOptions = { ttl: 3600 * 12, retries: 3 };

// PostgreSQL Session store
const sessionOptions = { 
    store: new pgSessionStore({
        pool: db,
        tableName: "user_session",
        createTableIfMissing: true
    }),
    name: process.env.SESSION_NAME ? process.env.SESSION_NAME : "LTI_TEST_SID",
    secret: process.env.SESSION_SECRET ? process.env.SESSION_SECRET : "keyboard cat dog mouse",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: cookieMaxAge  }
};

const app = express();

app.disable('X-Powered-By');

app.set('json spaces', 2);

app.use("/assets",
    express.static(__dirname + '/public/assets')
);
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(helmet({
    frameguard: false
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Content Security Policy
app.use(function (req, res, next) {
    res.setHeader(
      'Content-Security-Policy', 
      "default-src 'self'; script-src 'self' cdn.jsdelivr.net; style-src 'self' cdn.jsdelivr.net fonts.googleapis.com; font-src 'self' cdn.jsdelivr.net fonts.gstatic.com; img-src 'self' data:; frame-src 'self'" + (process.env.CSP_FRAME_SRC_ALLOW ? " " + process.env.CSP_FRAME_SRC_ALLOW : "")
    );
    
    next();
});

if (process.env.NODE_ENV === "production") {
    app.set('trust proxy', 1);
    sessionOptions.cookie.secure = 'true';
    sessionOptions.cookie.sameSite = 'none'; 
}

// Session options
app.use(session(sessionOptions));

// set the view engine to ejs
app.set('view engine', 'ejs');

// Check database version
db.checkDatabaseVersion();


// This should go into router.js?

// Handle LTI Launch
app.post('/lti', lti.handleLaunch('/'));

// Setup OAuth2 endpoints and communication
auth.setupAuthEndpoints(app, process.env.AUTH_REDIRECT_CALLBACK);

// General middleware that runs first, checking access token and LTI session
app.use(['/', '/test', '/reservations', '/admin', '/api/*'], async function (req, res, next) {
    await auth.checkAccessToken(req).then(async (result) => {
        if (result !== undefined && result.success === true) {
            await user.mockLtiSession(req);
            await user.addUserFlagsForRoles(req);

            if (req.session.lti) {
                res.locals.courseId = req.session.lti.custom_canvas_course_id ? req.session.lti.custom_canvas_course_id : "lti_context_id:" + req.session.lti.context_id;

                // Add the groups from Canvas for this user
                req.session.user.groups = await canvasApi.getCourseGroups(res.locals.courseId, req.session.user.id);
                req.session.user.groups_ids = new Array();
                req.session.user.groups_human_readable = new Array();
            
                for (const group of req.session.user.groups) {
                    req.session.user.groups_human_readable.push(group.name);
                    req.session.user.groups_ids.push(group.id);
                }

                // Move on to the actual route handler
                next()
            }
            else {
                next(new Error("No LTI information found in session."));
            }
        }
        else {
            log.error("Access token is not valid or not found, redirecting to auth flow...");
            return res.redirect("/auth");
        }
    })
    .catch(error => {
        log.error(error);

        if (error.message.includes("invalid_grant")) {
            return res.redirect("/auth");
        }
        else {
            next(new Error(error));
        }
    });
});

// Test
app.get('/test', async (req, res) => {
    await log.info("Testing endpoint requested.");

    // Two groups (works for user in same course, in one group but not in second group)
    // let conversation_result = await canvasApi.createConversation(new Array("group_128953", "group_128954"), "Test conversation from nodejs", "This is a test conversation for two groups, created programmatically from Canvas API.", req.session.user.id);

    // One group
    // let conversation_result = await canvasApi.createConversation(new Array("group_128953"), "Test conversation from nodejs", "This is a test conversation for two groups, created programmatically from Canvas API.", req.session.user.id);
    
    // One user
    let conversation_result = await canvasApi.createConversation(new Array("1508"), "Test conversation from nodejs", "This is a test conversation for two groups, created programmatically from Canvas API.", req.session.user.id);

    // let conversation_result = {};

    let result = await db.query("SELECT version()")
    .then((result) => {
            return res.send({
                status: 'up',
                session: req.session,
                result: result.rows,
                conversation: conversation_result
            });
        })
        .catch((error) => {
            log.error(error);
            
            return res.send({
                status: 'up',
                session: req.session,
                result: error
            });
    });

    await log.info("Db query done.");
});

// Main page with available slots for user to reserve */
app.get('/', async (req, res, next) => {
    const availableSlots = await db.getAllSlots(res.locals.courseId, new Date().toLocaleDateString('sv-SE'));

    /* Calculate if this slot is bookable, based on existing reservations */
    for (const slot of availableSlots) {
        slot.reservable_for_this_user = true;

        if (slot.res_now == slot.res_max) {
            slot.reservable_for_this_user = false;
            slot.reservable_notice = "Tiden är fullbokad.";
        }

        if (slot.type == "group") {
            if (slot.res_group_ids) {
                for (const id of slot.res_group_ids) {
                    for (const group of req.session.user.groups) {
                        if (group.id === id) {
                            slot.reservable_for_this_user = false;
                            slot.reservable_notice = "Din grupp är bokad på denna tid.";
                        }
                    }
                }
            }
            else if (slot.res_course_group_ids) {
                for (const id of slot.res_course_group_ids) {
                    for (const group of req.session.user.groups) {
                        if (group.id === id) {
                            slot.reservable_for_this_user = false;
                            slot.reservable_notice = "Din grupp är bokad på en annan tid för " + slot.course_name + ".";
                        }
                    }
                }
            }
        }
        else {
            if (slot.res_user_ids) {
                for (const id of slot.res_user_ids) {
                    if (req.session.user.id === id) {
                        slot.reservable_for_this_user = false;
                        slot.reservable_notice = "Du är bokad på denna tid.";
                    }
                }
            }
            else if (slot.res_course_user_ids) {
                for (const id of slot.res_course_user_ids) {
                    if (req.session.user.id === id) {
                        slot.reservable_for_this_user = false;
                        slot.reservable_notice = "Du är bokad på en annan tid för " + slot.course_name + ".";
                    }
                }
            }
        }
    }

    /* return res.send({
        status: 'up',
        version: pkg.version,
        session: req.session,
        groups: req.session.user.groups,
        slots: availableSlots,
        courses: await db.getValidCourses(new Date().toLocaleDateString('sv-SE')),
        instructors: await db.getValidInstructors(),
        locations: await db.getValidLocations()
    }); */

    return res.render('pages/index', {
        status: 'up',
        version: pkg.version,
        session: req.session,
        groups: req.session.user.groups,
        slots: availableSlots,
        courses: await db.getValidCourses(res.locals.courseId),
        instructors: await db.getValidInstructors(res.locals.courseId),
        locations: await db.getValidLocations(res.locals.courseId)
    });
});

app.get('/reservations', async (req, res, next) => {
    const reservations = await db.getReservationsForUser(res.locals.courseId, req.session.user.id, req.session.user.groups_ids);

    // Populate with information from Canvas API about reserving user and group.
    // NOTE: The only user and group information available is the ones that the calling user belongs to!
    // The API does not allow for fetching info about other groups, even if the user is in the same course.
    // TODO: This information should therefore be in the db, both canvas_user_name and canvas_group_name (done). 
    for (const reservation of reservations) {
        // Get other reservations if this is a group and there are other groups reserved.
        // For now, we store the information in database when a user for a group makes the reservation.
        if (reservation.is_group == true && reservation.max_groups > 1) {
            let other_reservations = await db.getSimpleSlotReservations(reservation.slot_id);
            reservation.other_reservations = [];

            for (const r of other_reservations) {
                if (r.canvas_group_id != reservation.canvas_group_id) {
                    reservation.other_reservations.push(r);
                }
            }
        }

        if (reservation.id == req.query.reservationId && req.query.reservationDone == "true") {
            reservation.just_created = true;
        }
    }

    /* return res.send({
        status: 'up',
        version: pkg.version,
        session: req.session,
        reservations: reservations
    }); */

    return res.render('pages/reservations/reservations', {
        status: 'up',
        version: pkg.version,
        session: req.session,
        reservations: reservations,
        reservationDeleted: req.query.reservationDeleted && req.query.reservationDeleted == "true",
        reservationDone: req.query.reservationDone && req.query.reservationDone == "true",
        reservationTitle: req.query.reservationTitle ? req.query.reservationTitle : null
    });
});

// Admin web pages
app.get('/admin', async (req, res, next) => {
    if (req.session.user.isAdministrator) {
        return res.render('pages/admin/admin', {
            status: 'up',
            version: pkg.version,
            session: req.session
        });
    }
    else {
        next(new Error("You must have administrator privileges to access this page."));
    }
});

/* ===================== */
/* API Endpoints, public */
/* ===================== */

/* Get one slot */
app.get('/api/slot/:id', async (req, res, next) => {
    try {
        const slot = await db.getSlot(req.params.id)
        slot.reservations = await db.getSimpleSlotReservations(req.params.id);

        slot.shortcut = {
            start_date: utils.getDatePart(slot.time_start),
            end_date: utils.getDatePart(slot.time_end),
            start_time: utils.getTimePart(slot.time_start),
            end_time: utils.getTimePart(slot.time_end)
        }

        return res.send(slot);                        
    }
    catch (error) {
        log.error(error);

        return res.send({
            success: false,
            error: error
        });
    }
});

/* Reserve one slot */
app.post('/api/reservation', async (req, res, next) => {
    const { slot_id, group_id, user_id, message } = req.body;
    
    try {
        const slot = await db.getSlot(slot_id);

        if (slot.res_now == slot.res_max) {
            throw new Error("Max antal bokningar totalt på tillfället har uppnåtts, kan inte boka tiden.");
        }
        else {
            if (slot.type == "group") {
                if (slot.res_group_ids) {
                    for (const id of slot.res_group_ids) {
                        for (const group of req.session.user.groups) {
                            if (group.id === id) {
                                throw new Error("Din grupp är redan bokad på tillfället.");
                            }
                        }
                    }
                }
                else if (slot.res_course_group_ids) {
                    for (const id of slot.res_course_group_ids) {
                        for (const group of req.session.user.groups) {
                            if (group.id === id) {
                                throw new Error("Max antal bokningar på samma typ av tillfälle har uppnåtts, kan inte boka fler tider.");
                            }
                        }
                    }
                }
            }
            else {
                if (slot.res_user_ids) {
                    for (const id of slot.res_user_ids) {
                        if (req.session.user.id === id) {
                            throw new Error("Du är redan bokad på tillfället.");
                        }
                    }
                }
                else if (slot.res_course_user_ids) {
                    for (const id of slot.res_course_user_ids) {
                        if (req.session.user.id === id) {
                            throw new Error("Max antal bokningar på samma typ av tillfälle har uppnåtts, kan inte boka fler tider.");
                        }
                    }
                }
            }
        }

        let group_name;

        // In the form we get the group id, get the name from user's groups
        if (slot.type == "group") {
            for (const group of req.session.user.groups) {
                if (group.id == group_id) {
                    group_name = group.name;
                }
            }
        }

        const reservation = await db.createSlotReservation(slot_id, req.session.user.id, req.session.user.name, group_id, group_name, message);

        if (process.env.EMAIL_SEND_EMAILS && process.env.EMAIL_SEND_EMAILS !== false) {
            try {
                const course = await db.getCourse(slot.course_id);
                const instructor = await db.getInstructor(slot.instructor_id);
                const subject = "Bekräftad bokning: " + group_name + ", " + course.name;
                const body = course.mail_one_reservation_body;

                /* await email.sendConfirmationMail(req.session.user.name, req.session.user.email, course.mail_cc_instructor ? instructor.email : "", course.mail_cc_instructor ? instructor.name : "", subject, body);
                await db.updateReservationMailSentUser(); */

                if (slot.type == "group") {
                    // if this group is the closer of max groups for this slot, send to both (all) groups,
                    // else send to the group reserving
                    // let conversation_result = await canvasApi.createConversation(new Array("group_128953"), "Test conversation from nodejs", "This is a test conversation for two groups, created programmatically from Canvas API.", req.session.user.id);
                    // await db.updateReservationMessageSentGroup();    
                    log.info("Sending confirmation message to group is not implemented yet (Canvas Conversations API).");
                }
                else {
                    // let conversation_result = await canvasApi.createConversation(new Array("<userid>"), "Test conversation from nodejs", "This is a test conversation for two groups, created programmatically from Canvas API.", req.session.user.id);
                    // await db.updateReservationMailSentUser();
                    log.info("Sending confirmation message to the user is not implemented yet (Canvas Conversations API).");
                }
            }
            catch (error) {
                log.error("When sending confirmation message: " + error);
            }
        }

        return res.send({
            success: true,
            message: "Tiden har bokats.",
            reservation_id: reservation.id
        });
    }
    catch (error) {
        log.error(error);

        return res.send({
            success: false,
            message: error.message
        });
    }
});

/* Get one reservation */
app.get('/api/reservation/:id', async (req, res, next) => {
    try {
        const reservation = await db.getReservation(req.session.user.id, req.session.user.groups_ids, req.params.id);
        return res.send(reservation);
    }
    catch (error) {
        log.error(error);

        return res.send({
            success: false,
            error: error
        });
    }
});

/* Delete a reservation */
app.delete('/api/reservation/:id', async (req, res) => { 
    try {
        // Load reservation first to get attributes like is_cancelable
        const reservation = await db.getReservation(req.session.user.id, req.session.user.groups_ids, req.params.id);

        if (reservation.is_cancelable == false) {
            throw new Error("Tiden för avbokning har passerats, kan ej avboka.");
        }

        await db.deleteReservation(req.session.user.id, req.session.user.groups_ids, req.params.id);

        return res.send({
            success: true,
            message: 'Reservation was deleted.',
            reservation_id: req.params.id
        });
    }
    catch (error) {
        log.error(error);

        return res.send({
            success: false,
            message: error.message
        });
    }
});


/* ==================== */
/* API Endpoints, admin */
/* ==================== */

/* Get one slot */
app.get('/api/admin/slot/:id', async (req, res) => {
    if (req.session.user.isAdministrator) {
        try {
            const slot = await db.getSlot(req.params.id)
            const reservations = await db.getSlotReservations(req.params.id);
            slot.reservations = reservations;
            slot.shortcut = {
                start_date: utils.getDatePart(slot.time_start),
                end_date: utils.getDatePart(slot.time_end),
                start_time: utils.getTimePart(slot.time_start),
                end_time: utils.getTimePart(slot.time_end)
            }

            return res.send(slot);                        
        }
        catch (error) {
            log.error(error);

            return res.send({
                success: false,
                error: error
            });
        }
    }
    else {
        next(new Error("You must have administrator privileges to access this page."));
    }
});

/* Update a given timeslot */
app.put('/api/admin/slot/:id', async (req, res) => {
    if (req.session.user.isAdministrator) {
        const { course_id, instructor_id, location_id, time_start, time_end } = req.body;

        try {
            await db.updateSlot(req.params.id, course_id, instructor_id, location_id, time_start, time_end);

            return res.send({
                success: true,
                message: 'Slot was updated.'
            });
        }
        catch (error) {
            log.error(error);

            return res.send({
                success: false,
                message: error.message
            });
        }
    }
    else {
        next(new Error("You must have administrator privileges to access this page."));
    }
});

/* Delete a given timeslot */
app.delete('/api/admin/slot/:id', async (req, res) => { 
    if (req.session.user.isAdministrator) {
        try {
            await db.deleteSlot(req.params.id);

            return res.send({
                success: true,
                message: 'Slot was deleted.'
            });
        }
        catch (error) {
            log.error(error);

            return res.send({
                success: false,
                message: error.message
            });
        }
    }
    else {
        next(new Error("You must have administrator privileges to access this page."));
    }
});

/* Create a new (series of) timeslot(s) */
app.post('/api/admin/slot', async (req, res) => {
    if (req.session.user.isAdministrator) {
        const { course_id, instructor_id, location_id } = req.body;

        let slots = [];

        let data = {
            course_id: course_id,
            instructor_id: instructor_id,
            location_id: location_id,
            slots: slots
        };

        try {
            for (const key in req.body) {
                if (key.startsWith("slot_date")) {
                    const this_slot_no = key.charAt(key.length - 1);

                    if (!isNaN(this_slot_no)) {
                        slots.push({
                            start: req.body[key] + "T" + req.body['slot_time_start_' + this_slot_no],
                            end: req.body[key] + "T" + req.body['slot_time_end_' + this_slot_no]
                        });
                    }
                }
            }

            await db.createSlots(data);

            return res.redirect("/");                        
        }
        catch (error) {
            log.error(error);

            return res.send({
                success: false,
                message: error.message
            });
        }
    }
    else {
        next(new Error("You must have administrator privileges to access this page."));
    }
});

/* Set server to listen and start working! */
app.listen(port, () => log.info(`Application listening on port ${port}.`));

/* Catch uncaught exceptions */
process.on('uncaughtException', (err) => {
    console.error("There was an uncaught error", err);
    process.exit(1); //mandatory (as per the Node docs)
});
