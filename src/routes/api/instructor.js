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
router.get('/slot/:id', async (req, res, next) => {
    if (req.session.user.isInstructor) {
        try {
            const slot = await db.getSlot(res, req.params.id)
            const reservations = await db.getSlotReservations(req.params.id);
            const messages = await db.getSlotMessages(req.params.id);
            slot.reservations = reservations;
            slot.messages = messages;
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

/**
 * Returns a list of messages sent related to a specific timeslot
 */
router.get('/slot/:id/messages', async (req, res, next) => {
    if (req.session.user.isInstructor) {
        try {
            const slot = await db.getSlot(res, req.params.id);
            const messages = await db.getSlotMessages(req.params.id);

            return res.send({
                success: true,
                slot: {
                    id: slot.id,
                    name: slot.course_name,
                    messages: messages
                }
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

/**
 * Send message to reserved students/groups on a specific timeslot.
 */
router.post('/slot/:id/message', async (req, res, next) => {
    if (req.session.user.isInstructor) {
        const { message_text } = req.body;
        const RECIPIENTS_MAX_LIMIT = 10; // TODO: configure in another way

        try {
            const slot = await db.getSlot(res, req.params.id);
            const course = await db.getCourse(slot.course_id);
            const reservations = await db.getSlotReservations(req.params.id);
            const recipients = new Array();
            let result = {};

            // Create the list of recipients
            if (reservations && reservations.length) {
                for (const r of reservations) {
                    r.type == "group" ? recipients.push("group_" + r.canvas_group_id) : recipients.push(r.canvas_user_id);
                    log.debug("Pushed recipient: " + recipients[recipients.length - 1]);
                }
                if (slot.instructor_id == req.session.user.db_id) {
                    recipients.push(req.session.user.id);
                    log.debug("Pushed recipient (instructor): " + recipients[recipients.length - 1]);
                }
                else {
                    const instructor = await db.getInstructor(slot.instructor_id);
                    recipients.push(instructor.canvas_user_id);
                    log.debug("Pushed recipient (instructor): " + recipients[recipients.length - 1]);
                }
            }

            // Send message if we have recipients and conversation robot is activated
            if (recipients.length && recipients.length < RECIPIENTS_MAX_LIMIT) {
                log.debug("CONVERSATION_ROBOT_SEND_MESSAGES=" + process.env.CONVERSATION_ROBOT_SEND_MESSAGES);

                if (process.env.CONVERSATION_ROBOT_API_TOKEN && process.env.CONVERSATION_ROBOT_SEND_MESSAGES == "true") {
                    try {    
                        const subject = res.__('ConversationRobotManualMessageSubjectPrefix') + slot.course_name;
                        const template_type = "manual_message";

                        let body = course.message_manual_body? course.message_manual_body : null;

                        if (body === null || body == '') {
                            body = utils.getTemplate(template_type);
                        }

                        if (body !== undefined && body !== null && body != '') {
                            body = body.replaceAll("{{message_text}}", message_text);
                            body = utils.replaceMessageMagics(body, course.name, "", course.cancellation_policy_hours, "", slot.time_human_readable, slot.location_name, "", "", slot.instructor_name, slot.instructor_email, "", "", req.session.lti.context_title);
            
                            let conversation_result = await canvasApi.createConversation(recipients, subject, body, { token_type: "Bearer", access_token: process.env.CONVERSATION_ROBOT_API_TOKEN });

                            log.debug(conversation_result);

                            let log_id = await db.addCanvasConversationLog(slot.id, null, slot.canvas_course_id, recipients, subject, body);
                            log.info(`Sent message to [${recipients}] logged with id [${log_id.id}]`);    
                            
                            result = {
                                success: true,
                                message: res.__('ConversationRobotManualMessageSuccessResponse'),
                                subject: subject,
                                recipients: recipients,
                                body: body
                            };
                        }
                        else {
                            result = {
                                success: false,
                                message: "Could not find message body neither in general template file '" + template_type + "' or in db for courseId " + slot.course_id
                            };

                            log.error("Could not find message body neither in general template file '" + template_type + "' or in db for courseId " + slot.course_id);
                        }
                    }
                    catch (error) {
                        result = {
                            success: false,
                            message: error.message
                        };

                        log.error("When sending confirmation message: " + error);
                    }
                }
                else {
                    result = {
                        success: false,
                        message: res.__('ConversationRobotManualMessageErrorRobotSendDisabled')
                    };
                }
            }
            else {
                if (recipients.length >= RECIPIENTS_MAX_LIMIT) {
                    result = {
                        success: false,
                        message: res.__('ConversationRobotManualMessageErrorMaxLimitPhrase', { count: recipients.length, max: RECIPIENTS_MAX_LIMIT })
                    };

                    log.error(res.__('ConversationRobotManualMessageErrorMaxLimitPhrase', { count: recipients.length, max: RECIPIENTS_MAX_LIMIT }));
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
