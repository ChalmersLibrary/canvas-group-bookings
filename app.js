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

// Test
app.get('/test', async (req, res) => {
    await log.info("Testing endpoint requested.");

    await auth.checkAccessToken(req).then(async (result) => {
        if (result !== undefined && result.success === true) {
            await user.mockLtiSession(req);
            await user.addUserFlagsForRoles(req);

            // Check that we have an LTI object in the session    
            if (req.session.lti) {
                // Numerical course_id if running Public, if Anonymous we use context_id
                let courseId = req.session.lti.custom_canvas_course_id ? req.session.lti.custom_canvas_course_id : "lti_context_id:" + req.session.lti.context_id;

                req.session.test = true;
                req.session.user.groups = await canvasApi.getCourseGroups(courseId, req.session.user.id);
                req.session.user.groups_human_readable = new Array();
                
                for (const group of req.session.user.groups) {
                    req.session.user.groups_human_readable.push(group.name);
                }

                let result = await db.query("SELECT version()")
                .then((result) => {
                        return res.send({
                            status: 'up',
                            session: req.session,
                            result: result.rows
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
            }
        }
    });

    

    await log.info("Db query done.");
});

app.get('/', async (req, res) => {
    await auth.checkAccessToken(req).then(async (result) => {
        if (result !== undefined && result.success === true) {
            await user.mockLtiSession(req);
            await user.addUserFlagsForRoles(req);

            // Check that we have an LTI object in the session    
            if (req.session.lti) {
                // Numerical course_id if running Public, if Anonymous we use context_id
                let courseId = req.session.lti.custom_canvas_course_id ? req.session.lti.custom_canvas_course_id : "lti_context_id:" + req.session.lti.context_id;
    
                try {
                    // Add the groups from Canvas for this user
                    // req.session.user.groups = [];
                    req.session.user.groups = await canvasApi.getCourseGroups(courseId, req.session.user.id);
                    req.session.user.groups_human_readable = new Array();
                
                    for (const group of req.session.user.groups) {
                        req.session.user.groups_human_readable.push(group.name);
                    }

                    const availableSlots = await db.getAllSlots(courseId, new Date().toLocaleDateString('sv-SE'));

                    /* Calculate if this slot is bookable, based on existing reservations */
                    for (const slot of availableSlots) {
                        slot.reservable_for_this_user = true;

                        if (slot.res_now == slot.res_max) {
                            slot.reservable_for_this_user = false;
                            slot.reservable_notice = "Tiden är fullbokad.";
                        }
                        else {
                            if (slot.type == "group") {
                                if (slot.res_group_ids) {
                                    for (const id of slot.res_group_ids) {
                                        for (const group of req.session.user.groups) {
                                            if (group.id === id) {
                                                slot.reservable_for_this_user = false;
                                                slot.reservable_notice = "Du/din grupp är bokad.";
                                            }
                                        }
                                    }
                                }
                                if (slot.res_course_group_ids) {
                                    for (const id of slot.res_course_group_ids) {
                                        for (const group of req.session.user.groups) {
                                            if (group.id === id) {
                                                slot.reservable_for_this_user = false;
                                                slot.reservable_notice = "Du/din grupp är redan bokad på momentet.";
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
                                            slot.reservable_notice = "Du är bokad på detta tillfälle.";
                                        }
                                    }
                                }
                                if (slot.res_course_user_ids) {
                                    for (const id of slot.res_course_user_ids) {
                                        if (req.session.user.id === id) {
                                            slot.reservable_for_this_user = false;
                                            slot.reservable_notice = "Du är redan bokad på momentet.";
                                        }
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
                        courses: await db.getValidCourses(courseId, new Date().toLocaleDateString('sv-SE')),
                        instructors: await db.getValidInstructors(courseId),
                        locations: await db.getValidLocations(courseId)
                    });
                }
                catch(error) {
                    log.error(error);

                    return res.render('pages/error', {
                        status: 'up',
                        version: pkg.version,
                        error: "CANVAS_API",
                        message: error
                    });
                }    
            }
            else {
                return res.render('pages/error', {
                    status: 'up',
                    version: pkg.version,
                    error: "NO_LTI_LAUNCH",
                    message: "This app must be launched at endpoint /lti to get the LTI context from Canvas. Contact an administrator to set it up correctly."
                });
            }
        }
        else {
            log.info("No access token returned, redirecting to auth flow...");
            return res.redirect("/auth");
        }    
    }).catch((error) => {
        log.error(error);
        return res.error(error);
    });
});

app.get('/reservations', async (req, res) => {
    await auth.checkAccessToken(req).then(async (result) => {
        if (result !== undefined && result.success === true) {
            await user.mockLtiSession(req);
            await user.addUserFlagsForRoles(req);

            if (req.session.lti) {
                // Numerical course_id if running Public, if Anonymous we use context_id
                let courseId = req.session.lti.custom_canvas_course_id ? req.session.lti.custom_canvas_course_id : "lti_context_id:" + req.session.lti.context_id;
    
                try {
                    // Add the groups from Canvas for this user
                    req.session.user.groups = await canvasApi.getCourseGroups(courseId, req.session.user.id);
                    req.session.user.groups_ids = new Array();
                    req.session.user.groups_human_readable = new Array();
                
                    for (const group of req.session.user.groups) {
                        req.session.user.groups_human_readable.push(group.name);
                        req.session.user.groups_ids.push(group.id);
                    }

                    const reservations = await db.getReservationsForUser(courseId, req.session.user.id, req.session.user.groups_ids);

                    for (const reservation of reservations) {
                        if (reservation.canvas_group_id !== null) {
                            let group_details = await canvasApi.getGroupDetails(courseId, req.session.user.id, reservation.canvas_group_id);
                            reservation.canvas_group_name = group_details.name;
                        }
                        if (reservation.canvas_user_id === req.session.user.id) {
                            reservation.canvas_user_name = req.session.user.name;
                        }
                        else {
                            let user_details = await canvasApi.getUserDetails(courseId, req.session.user.id, reservation.canvas_user_id);
                            reservation.canvas_user_name = user_details.name;
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
                        reservations: reservations
                    });
                }
                catch(error) {
                    log.error(error);

                    return res.render('pages/error', {
                        status: 'up',
                        version: pkg.version,
                        session: req.session,
                        user: req.session.user,
                        error: "CANVAS_API",
                        message: error
                    });
                }
            }
            else {
                return res.render('pages/error', {
                    status: 'up',
                    version: pkg.version,
                    error: "NO_LTI_LAUNCH",
                    message: "This app must be launched at endpoint /lti to get the LTI context from Canvas. Contact an administrator to set it up correctly."
                });
            }
        }
        else {
            log.error("No access token returned, redirecting to auth flow...");
            return res.redirect("/auth");
        }
    });
});

app.get('/admin', async (req, res) => {
    await auth.checkAccessToken(req).then(async (result) => {
        if (result !== undefined && result.success === true) {
            await user.mockLtiSession(req);
            await user.addUserFlagsForRoles(req);
            
            // Add the groups from Canvas for this user
            let courseId = req.session.lti.custom_canvas_course_id ? req.session.lti.custom_canvas_course_id : "lti_context_id:" + req.session.lti.context_id;
            req.session.user.groups = await canvasApi.getCourseGroups(courseId, req.session.user.id);
            req.session.user.groups_human_readable = new Array();

            for (const group of req.session.user.groups) {
                req.session.user.groups_human_readable.push(group.name);
            }

            if (req.session.user && req.session.user.isAdministrator) {
                return res.render('pages/admin/admin', {
                    status: 'up',
                    version: pkg.version,
                    session: req.session,
                    user: req.session.user,
                    groups: null
                });    
            }
            else {
                return res.render('pages/error', {
                    status: 'up',
                    version: pkg.version,
                    session: req.session,
                    error: "NO_PRIVILEGES",
                    message: "You must have administrator privileges to access this page."
                }); 
            }
        }
        else {
            log.error("No access token returned, redirecting to auth flow...");
            return res.redirect("/auth");
        }
    });
});

/* ===================== */
/* API Endpoints, public */
/* ===================== */

/* Get one slot */
app.get('/api/slot/:id', async (req, res) => {
    await auth.checkAccessToken(req).then(async (result) => {
        if (result !== undefined && result.success === true) {
            await user.mockLtiSession(req);
            await user.addUserFlagsForRoles(req);

            if (req.session.user) {
                console.log(req.params.id);

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
                    console.error(error);
                    return res.send({
                        success: false,
                        error: error
                    });
                }
            }
            else {
                return res.render('pages/error', {
                    status: 'up',
                    version: pkg.version,
                    session: req.session,
                    user: req.session.user,
                    error: "NO_API_KEY",
                    message: "You must confirm that this application can access the Canvas API as you."
                });
            }
        }
        else {
            log.error("No access token returned, redirecting to auth flow...");
            return res.redirect("/auth");
        }
    });
});

/* Reserve one slot */
app.post('/api/reservation', async (req, res) => {
    await auth.checkAccessToken(req).then(async (result) => {
        if (result !== undefined && result.success === true) {
            await user.mockLtiSession(req);
            await user.addUserFlagsForRoles(req);

            if (req.session.user) {
                const { slot_id, group_id, user_id, message } = req.body;
                console.log(req.body)

                if (req.session.lti) {
                    // Numerical course_id if running Public, if Anonymous we use context_id
                    let courseId = req.session.lti.custom_canvas_course_id ? req.session.lti.custom_canvas_course_id : "lti_context_id:" + req.session.lti.context_id;                        

                    /* Note: user_id is always taken from req.session.user object! */
                    try {
                        // Add the groups from Canvas for this user
                        // req.session.user.groups = [];
                        req.session.user.groups = await canvasApi.getCourseGroups(courseId, req.session.user.id);
                        req.session.user.groups_human_readable = new Array();
                    
                        for (const group of req.session.user.groups) {
                            req.session.user.groups_human_readable.push(group.name);
                        }

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
                                if (slot.res_course_group_ids) {
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
                                if (slot.res_course_user_ids) {
                                    for (const id of slot.res_course_user_ids) {
                                        if (req.session.user.id === id) {
                                            throw new Error("Max antal bokningar på samma typ av tillfälle har uppnåtts, kan inte boka fler tider.");
                                        }
                                    }
                                }
                            }
                        }

                        const reservation = await db.createSlotReservation(slot_id, req.session.user.id, group_id, message);

                        return res.send({
                            success: true,
                            message: "Tiden har bokats.",
                            reservation_id: reservation.id
                        });
                    }
                    catch (error) {
                        console.error(error);
                        return res.send({
                            success: false,
                            message: error.message
                        });
                    }
                }
            }
            else {
                return res.render('pages/error', {
                    status: 'up',
                    version: pkg.version,
                    session: req.session,
                    user: req.session.user,
                    error: "NO_API_KEY",
                    message: "You must confirm that this application can access the Canvas API as you."
                });
            }
        }
        else {
            log.error("No access token returned, redirecting to auth flow...");
            return res.redirect("/auth");
        }
    });
});

/* ==================== */
/* API Endpoints, admin */
/* ==================== */

/* Get one slot */
app.get('/api/admin/slot/:id', async (req, res) => {
    await auth.checkAccessToken(req).then(async (result) => {
        if (result !== undefined && result.success === true) {
            await user.mockLtiSession(req);
            await user.addUserFlagsForRoles(req);

            if (req.session.user && req.session.user.isAdministrator) {
                console.log(req.params.id);

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
                    console.error(error);
                    return res.send({
                        success: false,
                        error: error
                    });
                }
            }
            else {
                return res.render('pages/error', {
                    status: 'up',
                    version: pkg.version,
                    session: req.session,
                    user: req.session.user,
                    error: "NO_PRIVILEGES",
                    message: "You must have administrator privileges to access this page."
                });
            }
        }
        else {
            log.error("No access token returned, redirecting to auth flow...");
            return res.redirect("/auth");
        }
    });
});

/* Update a given timeslot */
app.put('/api/admin/slot/:id', async (req, res) => {
    await auth.checkAccessToken(req).then(async (result) => {
        if (result !== undefined && result.success === true) {
            await user.mockLtiSession(req);
            await user.addUserFlagsForRoles(req);

            if (req.session.user && req.session.user.isAdministrator) {
                console.log(req.params.id);
                console.log(req.body);

                const { course_id, instructor_id, location_id, time_start, time_end } = req.body;

                try {
                    await db.updateSlot(req.params.id, course_id, instructor_id, location_id, time_start, time_end);

                    return res.send({
                        success: true,
                        message: 'Slot was updated.'
                    });
                }
                catch (error) {
                    return res.send({
                        success: false,
                        message: error.message
                    });
                }
            }
            else {
                return res.render('pages/error', {
                    status: 'up',
                    version: pkg.version,
                    session: req.session,
                    user: req.session.user,
                    error: "NO_PRIVILEGES",
                    message: "You must have administrator privileges to access this page."
                });
            }
        }
        else {
            log.error("No access token returned, redirecting to auth flow...");
            return res.redirect("/auth");
        }
    });
});

/* Delete a given timeslot */
app.delete('/api/admin/slot/:id', async (req, res) => { 
    await auth.checkAccessToken(req).then(async (result) => {
        if (result !== undefined && result.success === true) {
            await user.mockLtiSession(req);
            await user.addUserFlagsForRoles(req);

            if (req.session.user && req.session.user.isAdministrator) {
                console.log(req.params.id);
                console.log(req.body);

                try {
                    await db.deleteSlot(req.params.id);

                    return res.send({
                        success: true,
                        message: 'Slot was deleted.'
                    });
                }
                catch (error) {
                    return res.send({
                        success: false,
                        message: error.message
                    });
                }
            }
            else {
                return res.render('pages/error', {
                    status: 'up',
                    version: pkg.version,
                    session: req.session,
                    user: req.session.user,
                    error: "NO_PRIVILEGES",
                    message: "You must have administrator privileges to access this page."
                });
            }
        }
        else {
            log.error("No access token returned, redirecting to auth flow...");
            return res.redirect("/auth");
        }
    });
});

/* Create a new (series of) timeslot(s) */
app.post('/api/admin/slot', async (req, res) => {
    await auth.checkAccessToken(req).then(async (result) => {
        if (result !== undefined && result.success === true) {
            await user.mockLtiSession(req);
            await user.addUserFlagsForRoles(req);

            if (req.session.user && req.session.user.isAdministrator) {
                console.log(req.body);
                const { course_id, instructor_id, location_id } = req.body;

                let slots = [];

                let data = {
                    course_id: course_id,
                    instructor_id: instructor_id,
                    location_id: location_id,
                    slots: slots
                };

                for (const key in req.body) {
                    console.log(`${key}: ${req.body[key]}`);

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

                try {
                    await db.createSlots(data);
                    return res.redirect("/");                        
                }
                catch (error) {
                    return res.render('pages/error', {
                        status: 'up',
                        version: pkg.version,
                        session: req.session,
                        error: "ERROR",
                        message: error
                    }); 
                }
            }
            else {
                return res.render('pages/error', {
                    status: 'up',
                    version: pkg.version,
                    session: req.session,
                    error: "NO_PRIVILEGES",
                    message: "You must have administrator privileges to access this page."
                }); 
            }
        }
        else {
            log.error("No access token returned, redirecting to auth flow...");
            return res.redirect("/auth");
        }
    });
});

app.listen(port, () => log.info(`Application listening on port ${port}.`));

process.on('uncaughtException', (err) => {
    console.error("There was an uncaught error", err);
    process.exit(1); //mandatory (as per the Node docs)
});
