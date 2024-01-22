'use strict';

require('dotenv').config();

const pkg = require('./package.json');
const i18n = require('./src/lang/i18n.config');
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
const morgan = require('morgan');
const rfs = require('rotating-file-stream');
const path = require('path');
const ical = require('./src/ical');
const crypto = require('crypto');

const port = process.env.PORT || 3000;
const cookieMaxAge = 3600000 * 24 * 30 * 4; // 4 months
const fileStoreOptions = { ttl: 3600 * 12, retries: 3 };

const DB_PER_PAGE = 50;

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

// Create a rotating write stream for request access logging
var accessLogStream = rfs.createStream('access.log', {
    interval: '1d', // rotate daily
    maxFiles: 180, // keep about six months
    path: path.join(__dirname, 'logs')
});

// Setup special Morgan tokens
morgan.token('course-id', function getCourseId (req, res) {
    return res.locals?.courseId ? res.locals.courseId : "-";
});
morgan.token('user-id', function getUserId (req) {
    return req.session?.user?.id ? req.session.user.id : "-";
});
morgan.token('user-groups', function getUserGroups (req) {
    return req.session?.user?.groups_human_readable ? req.session.user.groups_human_readable : "-";
});

// Setup https request logging
app.use(morgan(':remote-addr [:date[clf]] ":method :url" :status :res[content-length] - :course-id :user-id ":user-groups" ":response-time ms" ":referrer" ":user-agent"', { stream: accessLogStream }))

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
    sessionOptions.cookie.secure = true;
    sessionOptions.cookie.sameSite = 'none';
}

// Session options
app.use(session(sessionOptions));

// set the view engine to ejs
app.set('view engine', 'ejs');

// Language with i18n
// Default: using 'accept-language' header to guess language settings
app.use(i18n.init);

// Check database version
db.checkDatabaseVersion();

// Setup all routes
app.use('/', routes);

// Debug route that will dump session, should only be possible in development
app.get('/debug', async (req, res, next) => {
    if (process.env.NODE_ENV !== "production") {
        return res.send({
            session: req.session
        });
    }
    else {
        return res.sendStatus(404);
    }
});

// Main page with available slots for user to reserve */
app.get('/', async (req, res, next) => {
    let availableSlots;
    const per_page = DB_PER_PAGE ? DB_PER_PAGE : 25;
    const offset = req.query.page ? Math.max(parseInt(req.query.page) - 1, 0) * per_page : 0;

    /* Date and time handling */
    const dateOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };

    /* Available slots, with filters applied, paginated */
    availableSlots = await db.getAllSlotsPaginated(res, offset, per_page, res.locals.courseId, parseInt(req.query.segment), parseInt(req.query.course), parseInt(req.query.instructor), parseInt(req.query.location), parseInt(req.query.availability), req.query.start_date, req.query.end_date);

    /* Difference between valid courses to use in slots and courses used for filtering */
    const filter_segments = utils.linkify(res, 'segment', await db.getSegments(res.locals.courseId), parseInt(req.query.segment), parseInt(req.query.course), parseInt(req.query.instructor), parseInt(req.query.location), parseInt(req.query.availability), req.query.start_date, req.query.end_date);
    const filter_courses = utils.linkify(res, 'course', await db.getValidCourses(res.locals.courseId), parseInt(req.query.segment), parseInt(req.query.course), parseInt(req.query.instructor), parseInt(req.query.location), parseInt(req.query.availability), req.query.start_date, req.query.end_date);
    const filter_instructors = utils.linkify(res, 'instructor', await db.getValidInstructors(res.locals.courseId), parseInt(req.query.segment), parseInt(req.query.course), parseInt(req.query.instructor), parseInt(req.query.location), parseInt(req.query.availability), req.query.start_date, req.query.end_date);
    const filter_locations = utils.linkify(res, 'location', await db.getValidLocations(res.locals.courseId), parseInt(req.query.segment), parseInt(req.query.course), parseInt(req.query.instructor), parseInt(req.query.location), parseInt(req.query.availability), req.query.start_date, req.query.end_date);
    const filter_availability = utils.linkify(res, 'availability', [ { id: 1, name: res.__('SlotListingFilterAvailabilityAll') } ], parseInt(req.query.segment), parseInt(req.query.course), parseInt(req.query.instructor), parseInt(req.query.location), parseInt(req.query.availability), req.query.start_date, req.query.end_date);
    const filter_date = utils.linkify(res, 'date', '', parseInt(req.query.segment), parseInt(req.query.course), parseInt(req.query.instructor), parseInt(req.query.location), parseInt(req.query.availability), req.query.start_date, req.query.end_date);

    let this_navigation = utils.paginate(availableSlots.records_total, per_page, req.query.page ? Math.max(parseInt(req.query.page), 1) : 1, parseInt(req.query.segment), parseInt(req.query.course), parseInt(req.query.instructor), parseInt(req.query.location), parseInt(req.query.availability), req.query.start_date, req.query.end_date);
    this_navigation.filters = {
        segment: filter_segments,
        course: filter_courses,
        instructor: filter_instructors,
        location: filter_locations,
        availability: filter_availability,
        date: filter_date
    };

    if (req.session.user.db_id != null && !isNaN(parseInt(req.query.instructor)) && parseInt(req.query.instructor) == req.session.user.db_id) {
        this_navigation.current_page_is_instructor_slots = true;
    }
    else {
        this_navigation.current_page_is_instructor_slots = false;
    }

    let this_start_date_string = res.__('DatePhraseToday');
    let this_end_date_string = res.__('DatePhraseAndForward');

    if (Date.parse(req.query.start_date)) {
         if (new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'numeric', day: 'numeric' }) != new Date(req.query.start_date).toLocaleDateString('sv-SE', { year: 'numeric', month: 'numeric', day: 'numeric' })) {
            this_start_date_string = new Date(req.query.start_date).toLocaleDateString('sv-SE', { year: 'numeric', month: 'numeric', day: 'numeric' });
        }
    }
    if (Date.parse(req.query.end_date)) {
        if (new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'numeric', day: 'numeric' }) != new Date(req.query.end_date).toLocaleDateString('sv-SE', { year: 'numeric', month: 'numeric', day: 'numeric' })) {
           this_end_date_string = res.__('DatePhraseUntil') + " " + new Date(req.query.end_date).toLocaleDateString('sv-SE', { year: 'numeric', month: 'numeric', day: 'numeric' });
       }
    }

    if (this_navigation.current_page_is_instructor_slots) {
        this_navigation.title = res.__('SlotListingHeaderInstructor', { slots: this_navigation.records_total, from: this_start_date_string, to: this_end_date_string });
    }
    else {
        this_navigation.title = res.__('SlotListingHeaderNormal', { slots: this_navigation.records_total, from: this_start_date_string, to: this_end_date_string });
    }

    /* Add contextual availability notice for each slot */
    for (const slot of availableSlots.slots) {
        if (slot.res_max == 1) {
            if (slot.res_max == slot.res_now) {
                if (slot.type == "group") {
                    slot.availability_notice = res.__('SlotAvailabilityPhraseOneGroupFull');
                }
                else {
                    slot.availability_notice = res.__('SlotAvailabilityPhraseOneIndividualFull');
                }
            }
            else {
                if (slot.type == "group") {
                    slot.availability_notice = res.__('SlotAvailabilityPhraseOneGroupAvailable');
                }
                else {
                    slot.availability_notice = res.__('SlotAvailabilityPhraseOneIndividualAvailable');
                }
            }
        }
        else {
            if (slot.res_max == slot.res_now) {
                if (slot.type == "group") {
                    slot.availability_notice = res.__('SlotAvailabilityPhraseGroupFull');
                }
                else {
                    slot.availability_notice = res.__('SlotAvailabilityPhraseIndividualFull');
                }
            }
            else {
                if (slot.type == "group") {
                    slot.availability_notice = res.__n('SlotAvailabilityPhraseGroupAvailable', (slot.res_max - slot.res_now), { reservations: slot.res_now, available: (slot.res_max - slot.res_now), slots: slot.res_max });
                }
                else {
                    slot.availability_notice = res.__n('SlotAvailabilityPhraseIndividualAvailable', (slot.res_max - slot.res_now), { reservations: slot.res_now, available: slot.res_max - slot.res_now, slots: slot.res_max });
                }
            }
        }
    }

    /* Calculate if this slot is bookable, based on existing reservations */
    /* TODO: make it more general in utilities or something! */
    for (const slot of availableSlots.slots) {
        slot.res_percent = Math.round((slot.res_now / slot.res_max) * 100);

        if (req.session.user.isAdministrator) {
            slot.reservable_for_this_user = false;
            slot.reservable_notice = res.__('SlotReservationNoAdministrator');
        }
        else if (req.session.user.isInstructor) {
            slot.reservable_for_this_user = false;
            slot.reservable_notice = res.__('SlotReservationNoInstructor');
        }
        else {
            slot.reservable_for_this_user = true;

            if (slot.res_now >= slot.res_max) {
                slot.reservable_for_this_user = false;
                slot.reservable_notice = res.__('SlotReservationFull');
            }

            // DEBUG FOR AZURE AND UTC, should be removed
            const t_time = new Date();
            const t_time_now = t_time.getTime();
            const t_time_slot = new Date(slot.time_start).getTime();
            log.debug("t_time: " + t_time + " t_time_now: " + t_time_now + " slot.time_start: " + slot.time_start.toString() + " t_time_slot: " + t_time_slot + " reservable: " + !(t_time_slot <= t_time_now));

            if (t_time_slot <= t_time_now) {
                slot.reservable_for_this_user = false;
                slot.reservable_notice = res.__('SlotReservationTimeInPast');
            }
    
            if (slot.type == "group") {
                // Check if any of this user's groups are reserved on this slot
                if (slot.res_group_ids && slot.res_group_ids.filter(id => req.session.user.groups_ids?.includes(id)).length) {
                    slot.reservable_for_this_user = false;
                    slot.reservable_notice = res.__('SlotReservationGroupIsReserved');
                }

                // Check how many times this user's groups are reserved on slots with the same course context
                if (slot.res_course_group_ids && slot.reservable_for_this_user) {
                    if (slot.res_course_group_ids.filter(id => req.session.user.groups_ids?.includes(id)).length >= slot.course_max_per_type) {
                        slot.reservable_for_this_user = false;
                        slot.reservable_notice = res.__('SlotReservationGroupMaxReservations', { max: slot.course_max_per_type, name: slot.course_name });
                    }
                }
            }
            else {
                // Check if this user is reserved on this slot
                if (slot.res_user_ids && slot.res_user_ids.includes(req.session.user.id)) {
                    slot.reservable_for_this_user = false;
                    slot.reservable_notice = res.__('SlotReservationIndividualIsReserved');
                }

                // Check how many times this user is reserved on slots with the same course context
                if (slot.res_course_user_ids && slot.reservable_for_this_user) {
                    if (slot.res_course_user_ids.filter(id => req.session.user.id == id).length >= slot.course_max_per_type) {
                        slot.reservable_for_this_user = false;
                        slot.reservable_notice = res.__('SlotReservationIndividualMaxReservations', { max: slot.course_max_per_type, name: slot.course_name });
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
        configuration: res.locals.configuration,
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
    const reservations = await db.getReservationsForUser(res, res.locals.courseId, req.session.user.id, req.session.user.groups_ids);

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

        reservation.ics_file_name =  crypto.createHash('md5').update(reservation.id.toString()).digest("hex") + ".ics";
    }

    /* return res.send({
        status: 'up',
        version: pkg.version,
        session: req.session,
        reservations: reservations
    }); */

    return res.render(res.locals.lang + '/pages/reservations/reservations', {
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
 * Privay Policy, linked from footer
 */
app.get('/privacy', async (req, res, next) => {
    return res.render(res.locals.lang + '/pages/privacy/privacy', {
        internal: req.session.internal,
        session: req.session
    });
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
        next(new Error(res.__('GeneralErrorMessageMissingAdminAccess')));
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

            const course_config = await db.getCanvasCourseConfiguration(res.locals.courseId);
            const available_config_keys = [
                { key: 'FACETS_HIDE_SEGMENT' },
                { key: 'FACETS_HIDE_COURSE' },
                { key: 'FACETS_HIDE_INSTRUCTOR' },
                { key: 'FACETS_HIDE_LOCATION' },
                { key: 'FACETS_HIDE_AVAILABILITY' }
            ];

            for (const k of available_config_keys) {
                if (course_config.filter(c => c.key == k.key).map(c => c.value)[0] !== undefined) {
                    k.db_value = course_config.filter(c => c.key == k.key).map(c => c.value)[0];
                }
                else {
                    k.db_value = null;
                }
            }

            /* return res.send({
                status: 'up',
                internal: req.session.internal,
                version: pkg.version,
                session: req.session,
                data: {
                    canvas_course_id: res.locals.courseId,
                    canvas_course_name: req.session.lti.context_title,
                    canvas_group_categories: canvas_group_categories,
                    config_keys: available_config_keys,
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
                    canvas_group_categories: canvas_group_categories,
                    config_keys: available_config_keys,
                }
            });
        }
        catch (error) {
            throw new Error(error);
        }
    }
    else {
        next(new Error(res.__('GeneralErrorMessageMissingAdminAccess')));
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
        next(new Error(res.__('GeneralErrorMessageMissingAdminAccess')));
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
        next(new Error(res.__('GeneralErrorMessageMissingAdminAccess')));
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
        next(new Error(res.__('GeneralErrorMessageMissingAdminAccess')));
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
        next(new Error(res.__('GeneralErrorMessageMissingAdminAccess')));
    }
});



/* ===================== */
/* API Endpoints, public */
/* ===================== */

/* Get one slot */
app.get('/api/slot/:id', async (req, res, next) => {
    try {
        const slot = await db.getSlot(res, req.params.id)

        // add info about reserved groups, needed for UI
        // don't leak user information on individuals, not used
        if (slot.type != 'individual') {
            slot.reservations = await db.getSimpleSlotReservations(req.params.id);
        }
        else {
            delete slot.res_user_ids;
            delete slot.res_course_user_ids;
            delete slot.res_group_ids;
            delete slot.res_group_names;
            delete slot.res_course_group_ids;
        }

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
        const slot = await db.getSlot(res, slot_id);

        const t_time_now = new Date().getTime();
        const t_time_slot = new Date(slot.time_start).getTime();

        // TODO: Same code as in route for /, try to generalize

        if (slot.res_now >= slot.res_max) {
            throw new Error(res.__('SlotReservationFull'));
        }
        else if (t_time_slot <= t_time_now) {
            throw new Error(res.__('SlotReservationTimeInPast'));
        }
        else {
            if (slot.type == "group") {
                // Check if any of this user's groups are reserved on this slot
                if (slot.res_group_ids && slot.res_group_ids.filter(id => req.session.user.groups_ids?.includes(id)).length) {
                    throw new Error(res.__('SlotReservationGroupIsReserved'));
                }

                // Check how many times this user's groups are reserved on slots with the same course context
                if (slot.res_course_group_ids && slot.reservable_for_this_user) {
                    if (slot.res_course_group_ids.filter(id => req.session.user.groups_ids?.includes(id)).length >= slot.course_max_per_type) {
                        throw new Error(res.__('SlotReservationIndividualMaxReservations', { max: slot.course_max_per_type, name: slot.course_name }));
                    }
                }
            }
            else {
                // Check if this user is reserved on this slot
                if (slot.res_user_ids && slot.res_user_ids.includes(req.session.user.id)) {
                    throw new Error(res.__('SlotReservationIndividualIsReserved'));
                }

                // Check how many times this user is reserved on slots with the same course context
                if (slot.res_course_user_ids && slot.reservable_for_this_user) {
                    if (slot.res_course_user_ids.filter(id => req.session.user.id == id).length >= slot.course_max_per_type) {
                        throw new Error(res.__('SlotReservationIndividualMaxReservations', { max: slot.course_max_per_type, name: slot.course_name }));
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

        const reservation = await db.createSlotReservation(res, slot_id, req.session.user.id, req.session.user.name, group_id, group_name, message);

        // Send confirmation messages with Canvas Conversation Robot to Inbox
        log.debug("CONVERSATION_ROBOT_SEND_MESSAGES=" + process.env.CONVERSATION_ROBOT_SEND_MESSAGES);
        if (process.env.CONVERSATION_ROBOT_API_TOKEN && process.env.CONVERSATION_ROBOT_SEND_MESSAGES == "true") {
            try {
                const course = await db.getCourse(slot.course_id);
                const instructor = await db.getInstructor(slot.instructor_id);

                if (slot.type == "group") {
                    const subject = res.__('ConversationRobotReservationSubjectPrefix') + group_name + ", " + course.name;
                    const subject_cc = res.__('ConversationRobotReservationCcSubjectPrefix')  + group_name + ", " + course.name + " (" + req.session.user.name + ")";
                    const recipient = "group_" + group_id;
                    const template_type = "reservation_group_done";

                    let body = course.message_confirmation_body;

                    if (body === 'undefined' || body == '') {
                        body = utils.getTemplate(template_type);
                    }

                    if (body !== 'undefined' && body != '') {
                        body = utils.replaceMessageMagics(body, course.name, message, course.cancellation_policy_hours, req.session.user.name, slot.time_human_readable, slot.location_name, slot.location_url, slot.location_description, instructor.name, instructor.email, group_name, "", req.session.lti.context_title);

                        let conversation_result_group = await canvasApi.createConversation(recipient, subject, body, { token_type: "Bearer", access_token: process.env.CONVERSATION_ROBOT_API_TOKEN });
                        let log_id = await db.addCanvasConversationLog(slot_id, reservation.id, slot.canvas_course_id, recipient, subject, body);

                        log.info(`Sent confirmation message to [${recipient}] log id [${log_id.id}]`);

                        if (course.message_cc_instructor) {
                            let conversation_result_cc = await canvasApi.createConversation(instructor.canvas_user_id, subject_cc, body, { token_type: "Bearer", access_token: process.env.CONVERSATION_ROBOT_API_TOKEN });
                            let log_id_cc = await db.addCanvasConversationLog(slot_id, reservation.id, slot.canvas_course_id, instructor.canvas_user_id, subject_cc, body);

                            log.info(`Sent a copy of confirmation message to the instructor, log id [${log_id_cc.id}]`);
                        }

                        // Get the updated slot with all reservations
                        const slot_now = await db.getSlot(slot_id);

                        // Slot is full and there should be a message to all groups reserved
                        if (course.message_all_when_full && slot_now.res_now == slot_now.res_max) {
                            let recipients = new Array();
                            let body_all = course.message_full_body;

                            if (body_all === 'undefined' || body_all == '') {
                                body_all = utils.getTemplate("reservation_group_full");
                            }

                            if (body_all !== 'undefined' && body_all != '') {
                                body_all = utils.replaceMessageMagics(body_all, course.name, message, course.cancellation_policy_hours, req.session.user.name, slot_now.time_human_readable, slot_now.location_name, slot_now.location_url, slot_now.location_description, instructor.name, instructor.email, group_name, slot_now.res_group_names.join(", "), req.session.lti.context_title);

                                for (const id of slot_now.res_group_ids) {
                                    recipients.push("group_" + id);
                                }

                                const subject_all = res.__('ConversationRobotReservationFullSubjectPrefix') + course.name;
                                const subject_all_cc = res.__('ConversationRobotReservationFullCcSubjectPrefix') + course.name + " (" + slot_now.res_group_names.join(", ") + ")";

                                let conversation_result_all = await canvasApi.createConversation(recipients, subject_all, body_all, { token_type: "Bearer", access_token: process.env.CONVERSATION_ROBOT_API_TOKEN });
                                let log_id_all = await db.addCanvasConversationLog(slot_id, null, slot_now.canvas_course_id, recipients, subject_all, body_all);

                                log.info(`Sent connection message to [${recipients.join(", ")}] log id [${log_id_all.id}]`);

                                if (course.message_cc_instructor) {
                                    let conversation_result_all_cc = await canvasApi.createConversation(instructor.canvas_user_id, subject_all_cc, body_all, { token_type: "Bearer", access_token: process.env.CONVERSATION_ROBOT_API_TOKEN });
                                    let log_id_all_cc = await db.addCanvasConversationLog(slot_id, null, slot.canvas_course_id, instructor.canvas_user_id, subject_all_cc, body_all);
        
                                    log.info(`Sent a copy of connection message to the instructor, log id [${log_id_all_cc.id}]`);
                                }
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
                    const subject = res.__('ConversationRobotReservationSubjectPrefix') + course.name;
                    const subject_cc = res.__('ConversationRobotReservationCcSubjectPrefix') + course.name + ", " + req.session.user.name;
                    const template_type = "reservation_individual_done";

                    let body = course.message_confirmation_body;

                    if (body === 'undefined' || body == '') {
                        body = utils.getTemplate(template_type);
                    }

                    if (body !== 'undefined' && body != '') {
                        body = utils.replaceMessageMagics(body, course.name, message, course.cancellation_policy_hours, req.session.user.name, slot.time_human_readable, slot.location_name, slot.location_url, slot.location_description, instructor.name, instructor.email, "", "", req.session.lti.context_title);

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
        let reservation = await db.getReservation(res, req.session.user.id, req.session.user.groups_ids, req.params.id);
        reservation.ics_file_name =  crypto.createHash('md5').update(reservation.id.toString()).digest("hex") + ".ics";

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

/**
 * Get iCalendar entry for one specific slot reservation
 */
app.get('/api/reservation/:id/entry.ics', async (req, res, next) => {
    try {
        const reservation = await db.getReservation(res, req.session.user.id, req.session.user.groups_ids, req.params.id);
        const ics = await ical.iCalendarEventFromReservation(reservation);

        return res.contentType('text/calendar').send(ics);
    }
    catch (error) {
        log.error(error);

        return res.send({
            success: false,
            error: error.toString()
        });
    }
});

/* Delete a reservation */
app.delete('/api/reservation/:id', async (req, res) => { 
    try {
        // Load reservation first to get attributes like is_cancelable
        const reservation = await db.getReservation(res, req.session.user.id, req.session.user.groups_ids, req.params.id);

        if (reservation.is_cancelable == false) {
            throw new Error(res.__('CancelSlotReservationApiResponseNotCancellable'));
        }

        await db.deleteReservation(req.session.user.id, req.session.user.groups_ids, req.params.id);

        // Send confirmation messages with Canvas Conversation Robot to Inbox
        log.debug("CONVERSATION_ROBOT_SEND_MESSAGES=" + process.env.CONVERSATION_ROBOT_SEND_MESSAGES);
        if (process.env.CONVERSATION_ROBOT_API_TOKEN && process.env.CONVERSATION_ROBOT_SEND_MESSAGES == "true") {
            try {
                const course = await db.getCourse(reservation.course_id);
                const instructor = await db.getInstructor(reservation.instructor_id);

                if (reservation.type == "group") {
                    const subject = res.__('ConversationRobotCancelReservationSubjectPrefix') + reservation.canvas_group_name + ", " + course.name;
                    const subject_cc = res.__('ConversationRobotCancelReservationCcSubjectPrefix') + reservation.canvas_group_name + ", " + course.name + " (" + req.session.user.name + ")";
                    const recipient = "group_" + reservation.canvas_group_id;
                    const template_type = "reservation_group_canceled";

                    let body = course.message_cancelled_body;

                    if (body === 'undefined' || body == '') {
                        body = utils.getTemplate(template_type);
                    }

                    if (body !== 'undefined' && body != '') {
                        body = utils.replaceMessageMagics(body, course.name, "", course.cancellation_policy_hours, req.session.user.name, reservation.time_human_readable, reservation.location_name, "", "", instructor.name, instructor.email, reservation.canvas_group_name, "", req.session.lti.context_title);
        
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
                    const subject = res.__('ConversationRobotCancelReservationSubjectPrefix') + course.name;
                    const subject_cc = res.__('ConversationRobotCancelReservationCcSubjectPrefix') + course.name + ", " + req.session.user.name;
                    const template_type = "reservation_individual_canceled";

                    let body = course.message_confirmation_body;

                    if (body === 'undefined' || body == '') {
                        body = utils.getTemplate(template_type);
                    }

                    if (body !== 'undefined' && body != '') {
                        body = utils.replaceMessageMagics(body, course.name, "", course.cancellation_policy_hours, req.session.user.name, reservation.time_human_readable, reservation.location_name, "", "", instructor.name, instructor.email, "", "", req.session.lti.context_title);

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
        const reservations = await db.getReservationsForUser(res, res.locals.courseId, req.session.user.id, req.session.user.groups_ids);

        return res.send({
            counters: {
                reservations_upcoming: reservations.filter(x => !x.is_passed).length,
                reservations_total: reservations.length
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

// This will only be logged in non-production
log.debug("This is not a production environment.");

/* Set server to listen and start working! */
app.listen(port, () => log.info(`Application listening on port ${port}.`));

/* Catch uncaught exceptions */
process.on('uncaughtException', (err) => {
    console.error(err);
    process.exit(1); //mandatory (as per the Node docs)
});
