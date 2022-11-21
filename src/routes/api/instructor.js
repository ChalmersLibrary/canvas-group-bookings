'use strict';

const express = require('express');
const router = express.Router();
const log = require('../../logging/');
const db = require('../../db');
const utils = require('../../utilities');

/* ========================= */
/* API Endpoints, instructor */
/* ========================= */

/* Get one slot */
router.get('/slot/:id', async (req, res) => {
    if (req.session.user.isInstructor) {
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

module.exports = router;
