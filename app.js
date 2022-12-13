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

const DB_PER_PAGE = 25;

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
    sessionOptions.cookie.sameSite = 'None'; 
}

// Session options
app.use(session(sessionOptions));

// set the view engine to ejs
app.set('view engine', 'ejs');

// Check database version
db.checkDatabaseVersion();

// Setup all routes
app.use('/', routes);

app.get('/debug', async (req, res, next) => {
    return res.send({
        version: pkg.version,
        internal: {
            version: pkg.version,
            db: process.env.PGDATABASE
        },
        session: req.session
    });
});

// Test
app.get('/test', async (req, res, next) => {
    await log.info("Testing endpoint requested.");

    return res.render("pages/error", {
        version: pkg.version,
        internal: {
            version: pkg.version,
            db: process.env.PGDATABASE
        },
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
    const per_page = DB_PER_PAGE ? DB_PER_PAGE : 25;
    const offset = req.query.page ? Math.max(parseInt(req.query.page) - 1, 0) * per_page : 0;

    /* Available slots, with filters applied, paginated */
    availableSlots = await db.getAllSlotsPaginated(offset, per_page, res.locals.courseId, parseInt(req.query.segment), parseInt(req.query.course), parseInt(req.query.instructor), parseInt(req.query.location), parseInt(req.query.availability), req.query.start_date, req.query.end_date);

    /* Difference between valid courses to use in slots and courses used for filtering */
    const filter_segments = utils.linkify('segment', await db.getSegments(res.locals.courseId), parseInt(req.query.segment), parseInt(req.query.course), parseInt(req.query.instructor), parseInt(req.query.location), parseInt(req.query.availability), req.query.start_date, req.query.end_date);
    const filter_courses = utils.linkify('course', await db.getValidCourses(res.locals.courseId), parseInt(req.query.segment), parseInt(req.query.course), parseInt(req.query.instructor), parseInt(req.query.location), parseInt(req.query.availability), req.query.start_date, req.query.end_date);
    const filter_instructors = utils.linkify('instructor', await db.getValidInstructors(res.locals.courseId), parseInt(req.query.segment), parseInt(req.query.course), parseInt(req.query.instructor), parseInt(req.query.location), parseInt(req.query.availability), req.query.start_date, req.query.end_date);
    const filter_locations = utils.linkify('location', await db.getValidLocations(res.locals.courseId), parseInt(req.query.segment), parseInt(req.query.course), parseInt(req.query.instructor), parseInt(req.query.location), parseInt(req.query.availability), req.query.start_date, req.query.end_date);
    const filter_availability = utils.linkify('availability', [ { id: 1, name: 'Även fullbokade' } ], parseInt(req.query.segment), parseInt(req.query.course), parseInt(req.query.instructor), parseInt(req.query.location), parseInt(req.query.availability), req.query.start_date, req.query.end_date);
    const filter_date = utils.linkify('date', '', parseInt(req.query.segment), parseInt(req.query.course), parseInt(req.query.instructor), parseInt(req.query.location), parseInt(req.query.availability), req.query.start_date, req.query.end_date);

    let this_navigation = utils.paginate(availableSlots.records_total, per_page, req.query.page ? Math.max(parseInt(req.query.page), 1) : 1, parseInt(req.query.segment), parseInt(req.query.course), parseInt(req.query.instructor), parseInt(req.query.location), parseInt(req.query.availability), req.query.start_date, req.query.end_date);
    this_navigation.filters = {
        segment: filter_segments,
        course: filter_courses,
        instructor: filter_instructors,
        location: filter_locations,
        availability: filter_availability,
        date: filter_date
    };

    /* Add contextual availability notice for each slot */
    for (const slot of availableSlots.slots) {
        if (req.session.user.isAdministrator || req.session.user.isInstructor) {
            slot.availability_notice = (slot.res_max == slot.res_now ? "Fullbokad, " + slot.res_now + (slot.type == "group" ? (slot.res_max > 1 ? " grupper" : " grupp") : (" personer")) : slot.res_now + " av " + slot.res_max + (slot.type == "group" ? (slot.res_max > 1 ? " grupper" : " grupp") : (" personer")) + (slot.res_max > 1 ? " bokade" : " bokad"));
        }
        else {
            slot.availability_notice = (slot.res_max == slot.res_now ? "Fullbokad, " + slot.res_now + (slot.type == "group" ? (slot.res_max > 1 ? " grupper" : " grupp") : (" personer")) : "Tillgänglig, " + (slot.res_max - slot.res_now) + " av " + slot.res_max);
        }
    }

    /* Calculate if this slot is bookable, based on existing reservations */
    /* TODO: make it more general in utilities or something! */
    for (const slot of availableSlots.slots) {
        slot.res_percent = Math.round((slot.res_now / slot.res_max) * 100);

        if (req.session.user.isAdministrator) {
            slot.reservable_for_this_user = false;
            slot.reservable_notice = "Administratör kan inte boka tider.";
        }
        else if (req.session.user.isInstructor) {
            slot.reservable_for_this_user = false;
            slot.reservable_notice = "Handledare kan inte boka tider.";
        }
        else {
            slot.reservable_for_this_user = true;

            if (slot.res_now >= slot.res_max) {
                slot.reservable_for_this_user = false;
                slot.reservable_notice = "Tiden är fullbokad.";
            }
    
            if (slot.type == "group") {
                // Check if any of this user's groups are reserved on this slot
                if (slot.res_group_ids && slot.res_group_ids.filter(id => req.session.user.groups.map(g => g.id).includes(id)).length) {
                    slot.reservable_for_this_user = false;
                    slot.reservable_notice = "En grupp du tillhör är bokad på denna tid.";
                }

                // Check how many times this user's groups are reserved on slots with the same course context
                if (slot.res_course_group_ids && slot.reservable_for_this_user) {
                    if (slot.res_course_group_ids.filter(id => req.session.user.groups.map(g => g.id).includes(id)).length >= slot.course_max_per_type) {
                        slot.reservable_for_this_user = false;
                        slot.reservable_notice = `Max antal bokningar (${slot.course_max_per_type}) för ${slot.course_name}.`;
                    }
                }
            }
            else {
                // Check if this user is reserved on this slot
                if (slot.res_user_ids && slot.res_user_ids.includes(req.session.user.id)) {
                    slot.reservable_for_this_user = false;
                    slot.reservable_notice = "Du är bokad på denna tid.";
                }

                // Check how many times this user is reserved on slots with the same course context
                if (slot.res_course_user_ids && slot.reservable_for_this_user) {
                    if (slot.res_course_user_ids.filter(id => req.session.user.id == id).length >= slot.course_max_per_type) {
                        slot.reservable_for_this_user = false;
                        slot.reservable_notice = `Max antal bokningar (${slot.course_max_per_type}) för ${slot.course_name}.`;
                    }
                }
            }
        }
    }

    /* return res.send({
        internal: req.session.internal,
        session: req.session,
        groups: req.session.user.groups,
        navigation: this_navigation,
        slots: availableSlots.slots,
        segments: await db.getSegments(res.locals.courseId),
        courses: await db.getValidCourses(res.locals.courseId),
        instructors: await db.getValidInstructors(),
        locations: await db.getValidLocations()
    }); */

    return res.render('pages/index', {
        internal: req.session.internal,
        session: req.session,
        groups: req.session.user.groups,
        navigation: this_navigation,
        slots: availableSlots.slots,
        segments: await db.getSegments(res.locals.courseId),
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
                slots: slots,
                courses: await db.getValidCourses(res.locals.courseId),
                instructors: await db.getValidInstructors(res.locals.courseId),
                locations: await db.getValidLocations(res.locals.courseId)
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
            internal: req.session.internal,
            session: req.session,
            courses: await db.getAllCoursesWithStatistics(res.locals.courseId)
        });
    }
    else {
        next(new Error("You must have administrator privileges to access this page."));
    }
});

/**
 * Admin: Segments
 */
 app.get('/admin/segment', async (req, res, next) => {
    if (req.session.user.isAdministrator) {
        return res.render('pages/admin/admin_segment', {
            internal: req.session.internal,
            session: req.session,
            segments: await db.getSegmentsWithStatistics(res.locals.courseId)
        });
    }
    else {
        next(new Error("You must have administrator privileges to access this page."));
    }
});

/**
 * Admin: Instructors
 */
 app.get('/admin/instructor', async (req, res, next) => {
    if (req.session.user.isAdministrator) {
        let course_instructors = await db.getInstructorsWithStatistics(res.locals.courseId);

        return res.render('pages/admin/admin_instructor', {
            internal: req.session.internal,
            session: req.session,
            instructors: course_instructors
        });
    }
    else {
        next(new Error("You must have administrator privileges to access this page."));
    }
});

/**
 * Admin: Locations
 */
 app.get('/admin/location', async (req, res, next) => {
    if (req.session.user.isAdministrator) {
        return res.render('pages/admin/admin_location', {
            internal: req.session.internal,
            session: req.session,
            locations: await db.getLocationsWithStatistics(res.locals.courseId)
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

        // TODO: Same code as in route for /, try to generalize

        if (slot.res_now >= slot.res_max) {
            throw new Error("Tiden är fullbokad.");
        }
        else {
            if (slot.type == "group") {
                // Check if any of this user's groups are reserved on this slot
                if (slot.res_group_ids && slot.res_group_ids.filter(id => req.session.user.groups.map(g => g.id).includes(id)).length) {
                    throw new Error("En grupp du tillhör är redan bokad på tillfället.");
                }

                // Check how many times this user's groups are reserved on slots with the same course context
                if (slot.res_course_group_ids && slot.reservable_for_this_user) {
                    if (slot.res_course_group_ids.filter(id => req.session.user.groups.map(g => g.id).includes(id)).length >= slot.course_max_per_type) {
                        throw new Error(`Max antal bokningar (${slot.course_max_per_type}) uppnått för ${slot.course_name}.`);
                    }
                }
            }
            else {
                // Check if this user is reserved on this slot
                if (slot.res_user_ids && slot.res_user_ids.includes(req.session.user.id)) {
                    throw new Error("Du är redan bokad på tillfället.");
                }

                // Check how many times this user is reserved on slots with the same course context
                if (slot.res_course_user_ids && slot.reservable_for_this_user) {
                    if (slot.res_course_user_ids.filter(id => req.session.user.id == id).length >= slot.course_max_per_type) {
                        throw new Error(`Max antal bokningar (${slot.course_max_per_type}) uppnått för ${slot.course_name}.`);
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
                        body = utils.replaceMessageMagics(body, course.name, message, course.cancellation_policy_hours, req.session.user.name, slot.time_human_readable_sv, slot.location_name, slot.location_url, instructor.name, instructor.email, group_name, req.session.lti.context_title);
        
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
                                body_all = utils.replaceMessageMagics(body_all, course.name, message, course.cancellation_policy_hours, req.session.user.name, slot_now.time_human_readable_sv, slot_now.location_name, slot_now.location_url, instructor.name, instructor.email, group_name, slot_now.res_group_names.join(", "), req.session.lti.context_title);

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
                        body = utils.replaceMessageMagics(body, course.name, message, course.cancellation_policy_hours, req.session.user.name, slot.time_human_readable_sv, slot.location_name, slot.location_url, instructor.name, instructor.email, "", "", req.session.lti.context_title);

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
                        body = utils.replaceMessageMagics(body, course.name, "", course.cancellation_policy_hours, req.session.user.name, reservation.time_human_readable_sv, reservation.location_name, "", instructor.name, instructor.email, reservation.canvas_group_name, "", req.session.lti.context_title);
        
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
                        body = utils.replaceMessageMagics(body, course.name, "", course.cancellation_policy_hours, req.session.user.name, reservation.time_human_readable_sv, reservation.location_name, "", instructor.name, instructor.email, "", "", req.session.lti.context_title);

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
