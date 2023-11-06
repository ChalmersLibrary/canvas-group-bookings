'use strict';

const express = require('express');
const router = express.Router();
const log = require('../../logging/');
const db = require('../../db');
const utils = require('../../utilities');
const ical = require('../../ical');
const canvasApi = require('../../api/canvas');
const crypto = require('crypto');

/* ========================= */
/* API Endpoints, instructor */
/* ========================= */

/**
 * Get iCalendar entry for one specific slot
 */
router.get('/slot/:id/entry.ics', async (req, res, next) => {
    if (req.session.user.isInstructor) {
        try {
            const slot = await db.getSlot(res, req.params.id);
            const ics = await ical.iCalendarEventFromSlot(slot);
    
            return res.contentType('text/calendar').send(ics);
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
        next(new Error("You must have instructor privileges to access this endpoint."));
    }
});

/* Get one slot */
router.get('/slot/:id', async (req, res) => {
    if (req.session.user.isInstructor) {
        try {
            const slot = await db.getSlot(res, req.params.id)
            const reservations = await db.getSlotReservations(req.params.id);
            slot.reservations = reservations;
            slot.shortcut = {
                start_date: utils.getDatePart(slot.time_start),
                end_date: utils.getDatePart(slot.time_end),
                start_time: utils.getTimePart(slot.time_start),
                end_time: utils.getTimePart(slot.time_end)
            }
            slot.ics_file_name =  crypto.createHash('md5').update(slot.id.toString()).digest("hex") + ".ics";

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
        next(new Error("You must have instructor privileges to access this page."));
    }
});

/* Update a given timeslot */
router.put('/slot/:id', async (req, res) => {
    if (req.session.user.isInstructor) {
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
        next(new Error("You must have instructor privileges to access this page."));
    }
});

/* Delete a given timeslot */
router.delete('/slot/:id', async (req, res) => { 
    if (req.session.user.isInstructor) {
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
        next(new Error("You must have instructor privileges to access this page."));
    }
});

/* Send message to reserved on specific timeslot */
router.post('/slot/:id/message', async (req, res) => {
    if (req.session.user.isInstructor) {
        const { message_text } = req.body;
        const RECIPIENTS_MAX_LIMIT = 50;

        try {
            const slot = await db.getSlot(res, req.params.id);
            const reservations = await db.getSlotReservations(req.params.id);
            const recipients = new Array();
            let result = {};

            // Create the list of recipients
            if (reservations && reservations.length) {
                for (const r of reservations) {
                    r.type == "group" ? recipients.push("group_" + r.canvas_group_id) : recipients.push(r.canvas_user_id);
                    log.debug("Pushed recipient: " + recipients[recipients.length]);
                }
            }

            // Send message if we have recipients and conversation robot is activated
            if (recipients.length && recipients.length < RECIPIENTS_MAX_LIMIT) {
                log.debug("CONVERSATION_ROBOT_SEND_MESSAGES=" + process.env.CONVERSATION_ROBOT_SEND_MESSAGES);

                if (process.env.CONVERSATION_ROBOT_API_TOKEN && process.env.CONVERSATION_ROBOT_SEND_MESSAGES == "true") {
                    try {    
                        const subject = res.__('ConversationRobotManualMessageSubjectPrefix') + slot.course_name;
                        const subject_cc = res.__('ConversationRobotManualMessageCcSubjectPrefix') + slot.course_name;
                        const template_type = "manual_message";

                        const course = await db.getCourse(slot.course_id);
                        let body = course.message_manual_body? course.message_manual_body : undefined;

                        if (body === 'undefined' || body == '') {
                            body = utils.getTemplate(template_type);
                        }

                        if (body !== 'undefined' && body != '') {
                            body = body.replaceAll("{{message_text}}", message_text);
                            body = utils.replaceMessageMagics(body, course.name, "", course.cancellation_policy_hours, "", slot.time_human_readable, slot.location_name, "", "", slot.instructor_name, slot.instructor_email, "", "", req.session.lti.context_title);
            
                            let conversation_result = await canvasApi.createConversation(recipients, subject, body, { token_type: "Bearer", access_token: process.env.CONVERSATION_ROBOT_API_TOKEN });

                            /*for (const r of reservations) {
                                let log_id = await db.addCanvasConversationLog(reservation.slot_id, reservation.id, reservation.canvas_course_id, recipient, subject, body);
                                log.info("Sent confirmation message to the group, id " + log_id.id);    
                            } */

                            /*
                            if (course.message_cc_instructor) {
                                let conversation_result_cc = await canvasApi.createConversation(instructor.canvas_user_id, subject_cc, body, { token_type: "Bearer", access_token: process.env.CONVERSATION_ROBOT_API_TOKEN });
                                let log_id_cc = await db.addCanvasConversationLog(reservation.slot_id, reservation.id, reservation.canvas_course_id, instructor.canvas_user_id, subject_cc, body);

                                log.info("Sent a copy of confirmation message to the instructor, id " + log_id_cc.id);
                            } */

                            result = {
                                success: true,
                                message: "Message sent."
                            };
                        }
                        else {
                            log.error("Could not find message body neither in general template file '" + template_type + "' or in db for courseId " + slot.course_id);
                        }                        
                    }
                    catch (error) {
                        log.error("When sending confirmation message: " + error);
                    }
                }
                else {
                    result = {
                        success: false,
                        message: "Conversation robot is not configured to send messages."
                    };
                }
            }
            else {
                if (recipients.length >= RECIPIENTS_MAX_LIMIT) {
                    result = {
                        success: false,
                        message: `Number of recipients (${recipients.length}) exceed limit, which is ${RECIPIENTS_MAX_LIMIT}.` 
                    };

                    log.error(result);
                }
                else {
                    result = {
                        success: false,
                        message: "No recipients for this message."
                    };

                    log.error(result);
                }
            }

            return res.send(result);
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
        next(new Error("You must have instructor privileges to access this page."));
    }
});

/* Create a new (series of) timeslot(s) */
router.post('/slot', async (req, res) => {
    if (req.session.user.isInstructor) {
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
        next(new Error("You must have instructor privileges to access this page."));
    }
});

/**
 * Get information about a specific location, used for getting data on select change in new slot dialog
 */
router.get('/location/:id', async (req, res, next) => {
    try {
        const location = await db.getLocation(req.params.id);

        return res.send({
            success: true,
            location: location
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
 * Get information about a specific course, used for getting data on select change in new slots dialog
 */
router.get('/course/:id', async (req, res, next) => {
    try {
        const course = await db.getCourse(req.params.id);

        return res.send({
            success: true,
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

module.exports = router;
