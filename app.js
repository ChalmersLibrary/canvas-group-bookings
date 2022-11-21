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
const canvasApi = require('./src/api/canvas');
const db = require('./src/db');
const utils = require('./src/utilities');
const cache = require('./src/cache');
const routes = require('./src/routes');

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
      "default-src 'self'; script-src 'self' cdn.jsdelivr.net unpkg.com; style-src 'self' 'unsafe-inline' cdn.jsdelivr.net fonts.googleapis.com; font-src 'self' cdn.jsdelivr.net fonts.gstatic.com; img-src 'self' data:; frame-src 'self'" + (process.env.CSP_FRAME_SRC_ALLOW ? " " + process.env.CSP_FRAME_SRC_ALLOW : "")
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

// Setup all routes
app.use('/', routes);

// Test
app.get('/test', async (req, res, next) => {
    await log.info("Testing endpoint requested.");

    return res.render("pages/error", {
        version: pkg.version,
        internal: req.session.internal,
        error: "Kan inte skapa en session",
        message: "Du måste tillåta cookies från tredje part i din webbläsare. Bokningsverktyget använder cookies för att kunna hantera din identitiet från Canvas."
    });

    // Two groups (works for user in same course, in one group but not in second group)
    // let conversation_result = await canvasApi.createConversation(new Array("group_128953", "group_128954"), "Test conversation from nodejs", "This is a test conversation for two groups, created programmatically from Canvas API.", req.session.user.id);

    // One group
    // let conversation_result = await canvasApi.createConversation(new Array("group_128953"), "Test conversation from nodejs", "This is a test conversation for two groups, created programmatically from Canvas API.", req.session.user.id);
    
    // One or two or three user
    /* let conversation_result = await canvasApi.createConversation(
        [ req.session.user.id, 973 ],
        "Another test conversation", 
        "This is a test conversation.\nIt's created programmatically in Canvas API using nodejs.\n\nAll the best,\nChalmers Canvas Conversation Robot", 
        { token_type: "Bearer", access_token: process.env.CONVERSATION_ROBOT_API_TOKEN }); */

    // let conversation_result = {};

    /* let result = await db.query("SELECT version()")
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

    await log.info("Db query done."); */
});

// Main page with available slots for user to reserve */
app.get('/', async (req, res, next) => {
    let availableSlots;

    const segments = await db.getSegments(res.locals.courseId);

    if (segments && segments.length) {
        if (req.query.segment) {
            for (const segment of segments) {
                if (segment.id == parseInt(req.query.segment)) {
                    segment.active = true;
                }
            }
    
            availableSlots = await db.getAllSlotsInSegment(res.locals.courseId, parseInt(req.query.segment), new Date().toLocaleDateString('sv-SE'));
        }
        else {
            segments[0].active = true;

            availableSlots = await db.getAllSlotsInSegment(res.locals.courseId, parseInt(segments[0].id), new Date().toLocaleDateString('sv-SE'));
        }    
    }
    else {
        availableSlots = await db.getAllSlots(res.locals.courseId, new Date().toLocaleDateString('sv-SE'));
    }

    /* Calculate if this slot is bookable, based on existing reservations */
    /* TODO: make it more general in utilities or something! */
    for (const slot of availableSlots) {
        if (req.session.user.isAdministrator) {
            slot.reservable_for_this_user = false;
            slot.reservable_notice = "Administratör kan inte boka tider.";
        }
        else {
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
                if (slot.res_course_group_ids && slot.reservable_for_this_user) {
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
                if (slot.res_course_user_ids && slot.reservable_for_this_user) {
                    for (const id of slot.res_course_user_ids) {
                        if (req.session.user.id === id) {
                            slot.reservable_for_this_user = false;
                            slot.reservable_notice = "Du är bokad på en annan tid för " + slot.course_name + ".";
                        }
                    }
                }
            }
        }
    }

    /* return res.send({
        status: 'up',
        internal: req.session.internal,
        version: pkg.version,
        session: req.session,
        groups: req.session.user.groups,
        segments: segments,
        slots: availableSlots,
        courses: await db.getValidCourses(new Date().toLocaleDateString('sv-SE')),
        instructors: await db.getValidInstructors(),
        locations: await db.getValidLocations()
    }); */

    return res.render('pages/index', {
        status: 'up',
        internal: req.session.internal,
        version: pkg.version,
        session: req.session,
        groups: req.session.user.groups,
        segments: segments,
        slots: availableSlots,
        courses: await db.getValidCourses(res.locals.courseId),
        instructors: await db.getValidInstructors(res.locals.courseId),
        locations: await db.getValidLocations(res.locals.courseId)
    });
});

/**
 * Show the user a list of reservations done, both for this user or a group the user is member of.
 */
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
        internal: req.session.internal,
        version: pkg.version,
        session: req.session,
        reservations: reservations,
        reservationDeleted: req.query.reservationDeleted && req.query.reservationDeleted == "true",
        reservationDone: req.query.reservationDone && req.query.reservationDone == "true",
        reservationGroup: req.query.reservationGroup && req.query.reservationGroup == "true",
        reservationTitle: req.query.reservationTitle ? req.query.reservationTitle : null
    });
});

/**
 * Show the instructor a list of upcoming events, with reservation details
 */
app.get('/instructor/upcoming', async (req, res, next) => {
    if (req.session.user.isInstructor) {
        try {
            const slots = await db.getAllSlotsForInstructor(res.locals.courseId, req.session.user.id, new Date().toLocaleDateString('sv-SE'));

            for (const slot of slots) {
                slot.reservations = await db.getExtendedSlotReservations(slot.id);
                slot.res_percent = Math.round((slot.res_now / slot.res_max) * 100);
            }
        
            /* return res.send({
                status: 'up',
                version: pkg.version,
                session: req.session,
                slots: slots
            }); */
        
            return res.render('pages/instructor/upcoming_slots', {
                status: 'up',
                internal: req.session.internal,
                version: pkg.version,
                session: req.session,
                slots: slots
            });                    
        }
        catch (error) {
            return res.send({
                status: 'error',
                message: error.message
            });  
        }
    }
    else {
        next(new Error("You must have instructor privileges to access this page."));    
    }
});

/**
 * Admin: start page
 */
app.get('/admin', async (req, res, next) => {
    if (req.session.user.isAdministrator) {
        return res.render('pages/admin/admin', {
            status: 'up',
            internal: req.session.internal,
            version: pkg.version,
            session: req.session
        });
    }
    else {
        next(new Error("You must have administrator privileges to access this page."));
    }
});

/**
 * Admin: Canvas connection
 */
 app.get('/admin/canvas', async (req, res, next) => {
    if (req.session.user.isAdministrator) {
        try {
            let canvas_group_categories = await canvasApi.getCourseGroupCategories(res.locals.courseId, res.locals.token);
            const db_group_categories_filter = await db.getCourseGroupCategoryFilter(res.locals.courseId);

            for (const c of canvas_group_categories) {
                if (db_group_categories_filter.includes(c.id)) {
                    c.filtered_in_db = true;
                }
                else {
                    c.filtered_in_db = false;
                }
            }

            /* return res.send({
                status: 'up',
                internal: req.session.internal,
                version: pkg.version,
                session: req.session,
                data: {
                    canvas_course_name: req.session.lti.context_title,
                    canvas_group_categories: canvas_group_categories
                }
            }); */

            return res.render('pages/admin/admin_canvas', {
                status: 'up',
                internal: req.session.internal,
                version: pkg.version,
                session: req.session,
                data: {
                    canvas_course_id: res.locals.courseId,
                    canvas_course_name: req.session.lti.context_title,
                    canvas_group_categories: canvas_group_categories
                }
            });
        }
        catch (error) {
            throw new Error(error);
        }
    }
    else {
        next(new Error("You must have administrator privileges to access this page."));
    }
});

/**
 * Admin: Courses (to create slots on)
 */
 app.get('/admin/course', async (req, res, next) => {
    if (req.session.user.isAdministrator) {
        return res.render('pages/admin/admin_course', {
            status: 'up',
            internal: req.session.internal,
            version: pkg.version,
            session: req.session,
            courses: await db.getAllCoursesWithStatistics(res.locals.courseId)
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
            message: error.message
        });
    }
});

/**
 * Reserve one slot.
 * Includes logic that checks some things like max reservations, max of same type (course), already reserved.
 * Sends messages to individuals, groups and cc to instructors with Conversations API and Conversations Robot.
 */
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

        // Send confirmation messages with Canvas Conversation Robot to Inbox
        log.info("CONVERSATION_ROBOT_SEND_MESSAGES=" + process.env.CONVERSATION_ROBOT_SEND_MESSAGES);
        if (process.env.CONVERSATION_ROBOT_API_TOKEN && process.env.CONVERSATION_ROBOT_SEND_MESSAGES == "true") {
            try {
                const course = await db.getCourse(slot.course_id);
                const instructor = await db.getInstructor(slot.instructor_id);

                if (slot.type == "group") {
                    const subject = "Bekräftad bokning: " + group_name + ", " + course.name;
                    const subject_cc = "(Kopia) Bekräftad bokning: " + group_name + ", " + course.name + " (" + req.session.user.name + ")";
                    const recipient = "group_" + group_id;
                    const template_type = "reservation_group_done";

                    let body = utils.getTemplate(template_type);

                    if (body === 'undefined') {
                        body = course.message_confirmation_body;
                    }

                    if (body !== 'undefined' && body != '') {
                        body = utils.replaceMessageMagics(body, course.name, message, course.cancellation_policy_hours, req.session.user.name, slot.time_human_readable_sv, slot.location_name, slot.location_url, instructor.name, instructor.email, group_name);
        
                        let conversation_result_group = await canvasApi.createConversation(recipient, subject, body, { token_type: "Bearer", access_token: process.env.CONVERSATION_ROBOT_API_TOKEN });
                        let log_id = await db.addCanvasConversationLog(slot_id, reservation.id, slot.canvas_course_id, recipient, subject, body);

                        log.info("Sent confirmation message to the group, id " + log_id.id);

                        if (course.message_cc_instructor) {
                            let conversation_result_cc = await canvasApi.createConversation(instructor.canvas_user_id, subject_cc, body, { token_type: "Bearer", access_token: process.env.CONVERSATION_ROBOT_API_TOKEN });
                            let log_id_cc = await db.addCanvasConversationLog(slot_id, reservation.id, slot.canvas_course_id, instructor.canvas_user_id, subject_cc, body);

                            log.info("Sent a copy of confirmation message to the instructor, id " + log_id_cc.id);
                        }

                        // Get the updated slot with all reservations
                        const slot_now = await db.getSlot(slot_id);

                        // Slot is full and there should be a message to all groups reserved
                        if (course.message_all_when_full && slot_now.res_now == slot_now.res_max) {
                            let recipients = new Array();
                            let body_all = utils.getTemplate("reservation_group_full");

                            if (body_all === 'undefined') {
                                body_all = course.message_full_body;
                            }

                            if (body_all !== 'undefined' && body_all != '') {
                                body_all = utils.replaceMessageMagics(body_all, course.name, message, course.cancellation_policy_hours, req.session.user.name, slot_now.time_human_readable_sv, slot_now.location_name, slot_now.location_url, instructor.name, instructor.email, group_name, slot_now.res_group_names.join(", "));

                                for (const id of slot_now.res_group_ids) {
                                    recipients.push("group_" + id);
                                }

                                const subject_all = "Fullbokat tillfälle: " + course.name;

                                let conversation_result_all = await canvasApi.createConversation(recipients, subject_all, body_all, { token_type: "Bearer", access_token: process.env.CONVERSATION_ROBOT_API_TOKEN });
                                let log_id_all = await db.addCanvasConversationLog(slot_id, null, slot_now.canvas_course_id, recipients, subject_all, body_all);

                                log.info("Sent connection message to: " + recipients.join(", ") + ", id " + log_id_all.id);        
                            }
                            else {
                                log.error("Flag 'message_all_when_full' is true, but could not find message body neither in template file 'reservation_group_full' or in db for courseId " + slot_now.course_id);
                            }
                        }
                    }
                    else {
                        log.error("Could not find message body neither in general template file '" + template_type + "' or in db for courseId " + slot.course_id);
                    }
                }
                else {
                    const subject = "Bekräftad bokning: " + course.name;
                    const subject_cc = "(Kopia) Bekräftad bokning: " + course.name + ", " + req.session.user.name;
                    const template_type = "reservation_individual_done";

                    let body = utils.getTemplate(template_type);

                    if (body === 'undefined') {
                        body = course.message_confirmation_body;
                    }

                    if (body !== 'undefined' && body != '') {
                        body = utils.replaceMessageMagics(body, course.name, message, course.cancellation_policy_hours, req.session.user.name, slot.time_human_readable_sv, slot.location_name, slot.location_url, instructor.name, instructor.email);

                        let conversation_result_user = await canvasApi.createConversation(req.session.user.id, subject, body, { token_type: "Bearer", access_token: process.env.CONVERSATION_ROBOT_API_TOKEN });
                        let log_id = await db.addCanvasConversationLog(slot_id, reservation.id, slot.canvas_course_id, req.session.user.id, subject, body);
                        
                        log.info("Sent confirmation message to the user, id " + log_id.id);

                        if (course.message_cc_instructor) {
                            let conversation_result_cc = await canvasApi.createConversation(instructor.canvas_user_id, subject_cc, body, { token_type: "Bearer", access_token: process.env.CONVERSATION_ROBOT_API_TOKEN });
                            let log_id_cc = await db.addCanvasConversationLog(slot_id, reservation.id, slot.canvas_course_id, instructor.canvas_user_id, subject_cc, body);
                            
                            log.info("Sent a copy of confirmation message to the instructor, id " + log_id_cc.id);
                        }
                    }
                    else {
                        log.error("Could not find message body neither in general template file '" + template_type + "' or in db for courseId " + slot.course_id);
                    }
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

        // Send confirmation messages with Canvas Conversation Robot to Inbox
        log.info("CONVERSATION_ROBOT_SEND_MESSAGES=" + process.env.CONVERSATION_ROBOT_SEND_MESSAGES);
        if (process.env.CONVERSATION_ROBOT_API_TOKEN && process.env.CONVERSATION_ROBOT_SEND_MESSAGES == "true") {
            try {
                const course = await db.getCourse(reservation.course_id);
                const instructor = await db.getInstructor(reservation.instructor_id);

                if (reservation.type == "group") {
                    const subject = "Bekräftad avbokning: " + reservation.canvas_group_name + ", " + course.name;
                    const subject_cc = "(Kopia) Bekräftad avbokning: " + reservation.canvas_group_name + ", " + course.name + " (" + req.session.user.name + ")";
                    const recipient = "group_" + reservation.canvas_group_id;
                    const template_type = "reservation_group_canceled";

                    let body = utils.getTemplate(template_type);

                    if (body === 'undefined') {
                        body = course.message_cancelled_body;
                    }

                    if (body !== 'undefined' && body != '') {
                        body = utils.replaceMessageMagics(body, course.name, "", course.cancellation_policy_hours, req.session.user.name, reservation.time_human_readable_sv, reservation.location_name, "", instructor.name, instructor.email, reservation.canvas_group_name);
        
                        let conversation_result_group = await canvasApi.createConversation(recipient, subject, body, { token_type: "Bearer", access_token: process.env.CONVERSATION_ROBOT_API_TOKEN });
                        let log_id = await db.addCanvasConversationLog(reservation.slot_id, reservation.id, reservation.canvas_course_id, recipient, subject, body);

                        log.info("Sent confirmation message to the group, id " + log_id.id);

                        if (course.message_cc_instructor) {
                            let conversation_result_cc = await canvasApi.createConversation(instructor.canvas_user_id, subject_cc, body, { token_type: "Bearer", access_token: process.env.CONVERSATION_ROBOT_API_TOKEN });
                            let log_id_cc = await db.addCanvasConversationLog(reservation.slot_id, reservation.id, reservation.canvas_course_id, instructor.canvas_user_id, subject_cc, body);

                            log.info("Sent a copy of confirmation message to the instructor, id " + log_id_cc.id);
                        }
                    }
                    else {
                        log.error("Could not find message body neither in general template file '" + template_type + "' or in db for courseId " + reservation.course_id);
                    }
                }
                else {
                    const subject = "Bekräftad avbokning: " + course.name;
                    const subject_cc = "(Kopia) Bekräftad avbokning: " + course.name + ", " + req.session.user.name;
                    const template_type = "reservation_individual_canceled";

                    let body = utils.getTemplate(template_type);

                    if (body === 'undefined') {
                        body = course.message_confirmation_body;
                    }

                    if (body !== 'undefined' && body != '') {
                        body = utils.replaceMessageMagics(body, course.name, "", course.cancellation_policy_hours, req.session.user.name, reservation.time_human_readable_sv, reservation.location_name, "", instructor.name, instructor.email);

                        let conversation_result_user = await canvasApi.createConversation(req.session.user.id, subject, body, { token_type: "Bearer", access_token: process.env.CONVERSATION_ROBOT_API_TOKEN });
                        let log_id = await db.addCanvasConversationLog(reservation.slot_id, reservation.id, reservation.canvas_course_id, req.session.user.id, subject, body);
                        
                        log.info("Sent confirmation message to the user, id " + log_id.id);

                        if (course.message_cc_instructor) {
                            let conversation_result_cc = await canvasApi.createConversation(instructor.canvas_user_id, subject_cc, body, { token_type: "Bearer", access_token: process.env.CONVERSATION_ROBOT_API_TOKEN });
                            let log_id_cc = await db.addCanvasConversationLog(reservation.slot_id, reservation.id, reservation.canvas_course_id, instructor.canvas_user_id, subject_cc, body);
                            
                            log.info("Sent a copy of confirmation message to the instructor, id " + log_id_cc.id);
                        }
                    }
                    else {
                        log.error("Could not find message body neither in general template file '" + template_type + "' or in db for courseId " + reservation.course_id);
                    }
                }
            }
            catch (error) {
                log.error("When sending confirmation message: " + error);
            }
        }

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

/**
 * Get some statistics used in web view
 */
app.get('/api/statistics', async (req, res, next) => {
    try {
        const counter_res = await db.getNumberOfReservations(req.session.user.id, res.locals.groups_ids);

        return res.send({
            counters: {
                reservations: counter_res
            }
        });
    }
    catch (error) {
        log.error(error);

        return res.send({
            success: false,
            error: error
        });
    }
});

/* app._router.stack.forEach(function(middleware){
    if(middleware.route){ // routes registered directly on the app
        console.log(middleware.route);
    } else if(middleware.name === 'router'){ // router middleware 
        middleware.handle.stack.forEach(function(handler){
            let route = handler.route;
            route && console.log(route);
        });
    }
}) */

/* Set server to listen and start working! */
app.listen(port, () => log.info(`Application listening on port ${port}.`));

/* Catch uncaught exceptions */
process.on('uncaughtException', (err) => {
    console.error("There was an uncaught error", err);
    process.exit(1); //mandatory (as per the Node docs)
});
