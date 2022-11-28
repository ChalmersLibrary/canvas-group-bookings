'use strict';

const express = require('express');
const router = express.Router();
const log = require('../../logging/');
const db = require('../../db');
const canvasApi = require('../../api/canvas');
const utils = require('../../utilities');

/* ============================ */
/* API Endpoints, administrator */
/* ============================ */

/**
 * General match for checking administrator status, otherwise we return a JSON error message
 */
router.use('/*', async (req, res, next) => {
    if (!req.session.user.isAdministrator) {
        return res.send({
            success: false,
            message: "You don't have access to this endpoint."
        });
    }
    else {
        next();
    }
});

/**
 * Create or update information about connections to Canvas, group category filtering etc
 */
router.put('/canvas/:id', async (req, res, next) => {
    try {
        const { group_category_mapping } = req.body;

        await db.updateCanvasConnection(req.params.id, group_category_mapping);

        return res.send({
            success: true,
            message: 'Canvas information was updated.'
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
 * Get information about a specific course, used for editing
 */
router.get('/course/:id', async (req, res, next) => {
    try {
        const course = await db.getCourse(req.params.id);
        const segments = await db.getSegments(course.canvas_course_id);

        return res.send({
            success: true,
            segments: segments,
            templates: {
                done: course.is_group ? utils.getTemplate('reservation_group_done') : utils.getTemplate('reservation_individual_done'),
                cancel: course.is_group ? utils.getTemplate('reservation_group_canceled') : utils.getTemplate('reservation_individual_canceled'),
                full: utils.getTemplate('reservation_group_full')
            },
            template_vars: [
                { name: "reservation_course_name", description: "Namn på tillfället" },
                { name: "reservation_message", description: "Ev meddelande från den som bokar" },
                { name: "reservation_slot_time", description: "Datum och tid för bokade tillfället" },
                { name: "slot_group_names", description: "Namn på andra grupper som redan bokat" },
                { name: "reservation_group_name", description: "Namn på grupp som bokar" },
                { name: "canvas_user_name", description: "Namn på individ som bokar" },
                { name: "location_name", description: "Platsens namn med ev länk" },
                { name: "cancellation_policy_hours", description: "Avbokningspolicy i antal timmar" },
                { name: "instructor_name", description: "Handledarens namn" },
                { name: "instructor_email", description: "Handledarens e-postadress" },
                { name: "CONVERSATION_ROBOT_NAME", description: "Namn på roboten, för signatur" }
            ],
            course: course
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
 * Get helper data such as segments, templates and template vars, for use in new course
 */
router.get('/course', async (req, res, next) => {
    try {
        const segments = await db.getSegments(res.locals.courseId);

        return res.send({
            success: true,
            segments: segments,
            templates: {
                group: {
                    done: utils.getTemplate('reservation_group_done'),
                    cancel: utils.getTemplate('reservation_group_canceled'),
                    full: utils.getTemplate('reservation_group_full')
                },
                individual: {
                    done: utils.getTemplate('reservation_individual_done'),
                    cancel: utils.getTemplate('reservation_individual_canceled'),
                    full: utils.getTemplate('reservation_individual_full')
                }
            },
            template_vars: [
                { name: "reservation_course_name", description: "Namn på tillfället" },
                { name: "reservation_message", description: "Ev meddelande från den som bokar" },
                { name: "reservation_slot_time", description: "Datum och tid för bokade tillfället" },
                { name: "slot_group_names", description: "Namn på andra grupper som redan bokat" },
                { name: "reservation_group_name", description: "Namn på grupp som bokar" },
                { name: "canvas_user_name", description: "Namn på individ som bokar" },
                { name: "location_name", description: "Platsens namn med ev länk" },
                { name: "cancellation_policy_hours", description: "Avbokningspolicy i antal timmar" },
                { name: "instructor_name", description: "Handledarens namn" },
                { name: "instructor_email", description: "Handledarens e-postadress" },
                { name: "CONVERSATION_ROBOT_NAME", description: "Namn på roboten, för signatur" }
            ]
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
 * Create a new course
 */
router.post('/course', async (req, res, next) => {
    try {
        console.log(req.body)
        const created_id = await db.createCourse(res.locals.courseId, req.body);

        return res.send({
            success: true,
            message: 'New course has been created.',
            created_id: created_id
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
 * Update information about a course.
 */
router.put('/course/:id', async (req, res, next) => {
    try {
        console.log(req.body)
        await db.updateCourse(req.params.id, req.body);

        return res.send({
            success: true,
            message: 'Course has been updated.'
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
 * Get information about a Segment, for the edit dialog
 */
router.get('/segment/:id', async (req, res, next) => {
    try {
        const segment = await db.getSegment(req.params.id);

        return res.send({
            success: true,
            segment: segment
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
 * Get information about Canvas candidates for adding instructors, etc
 */
router.get('/instructor', async (req, res, next) => {
    try {
        const course_instructors = await db.getInstructorsWithStatistics(res.locals.courseId);
        const all_instructors = await db.getAllInstructors();
        let canvas_instructors = await canvasApi.getCourseTeacherEnrollments(res.locals.courseId, res.locals.token);

        for (const i of canvas_instructors) {
            if (course_instructors.map(instructor => instructor.canvas_user_id).includes(i.id)) {
                i.mapped_to_canvas_course = true
            }
            else {
                i.mapped_to_canvas_course = false
            }
        }

        return res.send({
            success: true,
            course_instructors: course_instructors,
            all_instructors: all_instructors,
            canvas_instructors: canvas_instructors
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
 * Get information about an Instructor, for the edit and delete dialog
 */
router.get('/instructor/:id', async (req, res, next) => {
    try {
        const instructor = await db.getInstructorWithStatistics(res.locals.courseId, req.params.id);
        const course_instructors = await db.getInstructorsWithStatistics(res.locals.courseId);

        return res.send({
            success: true,
            course_instructors: course_instructors,
            instructor: instructor
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
 * Update information about an Instructor
 */
router.put('/instructor/:id', async (req, res, next) => {
    try {
        console.log(req.body)
        await db.updateInstructor(req.params.id, req.body);

        return res.send({
            success: true,
            message: 'Instructor has been updated.'
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
 * Delete (possibly replace) connected instructor
 */
router.delete('/instructor/:id', async (req, res, next) => {
    try {
        const { replace_with_instructor_id } = req.body;

        if (replace_with_instructor_id) {
            await db.replaceConnectedInstructor(res.locals.courseId, req.params.id, replace_with_instructor_id);
        }

        await db.disconnectInstructor(res.locals.courseId, req.params.id);

        return res.send({
            success: true,
            message: 'Instructor has been disconnected from this Canvas course.'
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
 * Create (and/or connect) an instructor
 */
router.post('/instructor', async (req, res, next) => {
    try {
        console.log(req.body)
        const { existing_user_id, canvas_user_id, name, email } = req.body;

        if (existing_user_id) {
            const existing_instructor = await db.getInstructor(existing_user_id);
        
            if (existing_instructor) {
                await db.connectInstructor(res.locals.courseId, existing_instructor.id);
            }
        }
        else {
            const created_instructor = await db.createInstructor(canvas_user_id, name, email);

            if (created_instructor) {
                await db.connectInstructor(res.locals.courseId, created_instructor.id);
            }
        }

        return res.send({
            success: true,
            message: 'New instructor has been created and/or connected.'
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

router.get('/location', async (req, res, next) => {
    try {
        const course_locations = await db.getLocationsWithStatistics(res.locals.courseId);
        const locations = await db.getAllLocations();

        for (const l of locations) {
            if (course_locations.map(location => location.id).includes(l.id)) {
                l.mapped_to_canvas_course = true
            }
            else {
                l.mapped_to_canvas_course = false
            }
        }

        return res.send({
            success: true,
            locations: locations
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

router.get('/location/:id', async (req, res, next) => {
    try {
        const location = await db.getLocationWithStatistics(res.locals.courseId, req.params.id);
        const course_locations = await db.getLocationsWithStatistics(res.locals.courseId);

        return res.send({
            success: true,
            location: location,
            course_locations: course_locations
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
 * Update location information.
 */
router.put('/location/:id', async (req, res, next) => {
    try {
        const { name, description, external_url, campus_maps_id } = req.body;
        const existing_location = await db.getLocation(req.params.id);
        
        if (existing_location) {
            await db.updateLocation(existing_location.id, name, description, external_url, campus_maps_id);
        }

        return res.send({
            success: true,
            message: 'Location has been updated.'
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
 * Create (and/or connect) a location
 */
 router.post('/location', async (req, res, next) => {
    try {
        console.log(req.body)
        const { existing_location_id, name, description, external_url, campus_maps_id } = req.body;

        if (existing_location_id) {
            const existing_location = await db.getLocation(existing_location_id);
        
            if (existing_location) {
                await db.connectLocation(res.locals.courseId, existing_location.id);
            }
        }
        else {
            const created_location = await db.createLocation(name, description, external_url, campus_maps_id);

            if (created_location) {
                await db.connectLocation(res.locals.courseId, created_location.id);
            }
        }

        return res.send({
            success: true,
            message: 'New location has been created and/or connected.'
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

router.delete('/location/:id', async (req, res, next) => {
    try {
        const { replace_with_location_id } = req.body;

        if (replace_with_location_id) {
            await db.replaceConnectedLocation(res.locals.courseId, req.params.id, replace_with_location_id);
        }

        await db.disconnectLocation(res.locals.courseId, req.params.id);

        return res.send({
            success: true,
            message: 'Location has been disconnected from this Canvas course.'
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

module.exports = router;
