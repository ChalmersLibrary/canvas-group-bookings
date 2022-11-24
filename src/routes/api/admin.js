'use strict';

const express = require('express');
const router = express.Router();
const log = require('../../logging/');
const db = require('../../db');
const utils = require('../../utilities');

/* ============================ */
/* API Endpoints, administrator */
/* ============================ */

/**
 * Create or update information about connections to Canvas, group category filtering etc
 */
router.put('/canvas/:id', async (req, res, next) => {
    if (req.session.user.isAdministrator) {
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
    }
    else {
        next(new Error("You must have administrator privileges to access this page."));
    }
});

/**
 * Get information about a specific course, used for editing
 */
router.get('/course/:id', async (req, res, next) => {
    if (req.session.user.isAdministrator) {
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
    }
    else {
        next(new Error("You must have administrator privileges to access this page."));
    }   
});

/**
 * Get helper data such as segments, templates and template vars, for use in new course
 */
router.get('/course', async (req, res, next) => {
    if (req.session.user.isAdministrator) {
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
    }
    else {
        next(new Error("You must have administrator privileges to access this page."));
    }   
});

/**
 * Create a new course
 */
router.post('/course', async (req, res, next) => {
    if (req.session.user.isAdministrator) {
        try {
            const { 
                segment_id, name, description, is_group, is_individual, max_groups, max_individuals, max_per_type, default_slot_duration_minutes, 
                cancellation_policy_hours, message_is_mandatory, message_all_when_full, message_cc_instructor, message_confirmation_body, message_full_body, message_cancelled_body
            } = req.body;

            console.xlog(req.body)

            // await db.createCourse({ req.body }});

            return res.send({
                success: true,
                message: 'New course has been created.'
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

router.get('/segment/:id', async (req, res, next) => {
    if (req.session.user.isAdministrator) {
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
    }
    else {
        next(new Error("You must have administrator privileges to access this page."));
    }   
});

module.exports = router;
