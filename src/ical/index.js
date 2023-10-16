'use strict';

require('dotenv').config();
const log = require('../logging')
const db = require('../db');
const ics = require('ics');

/**
 * Create a calendar event (VCALENDAR 2.0) from a single reservation.
 * 
 * @param {Object} r
 * @returns {String} VCALENDAR entry
 */
async function iCalendarEventFromReservation(r) {
    var ical_event;

    const start_time = new Date(r.time_start);
    const end_time = new Date(r.time_end);

    /*
    log.info("r.time_start: " + r.time_start + ", start_time: " + start_time);
    log.info("r.time_end: " + r.time_end + ", end_time: " + end_time);
    console.log(start_time.getFullYear(), start_time.getMonth()+1, start_time.getDate(), start_time.getHours(), start_time.getMinutes());
    console.log(end_time.getFullYear(), end_time.getMonth()+1, end_time.getDate(), end_time.getHours(), end_time.getMinutes());
    */
    
    let event = {
        productId: 'canvas-group-bookings/adamgibbons/ics',
        start: [
            start_time.getFullYear(), start_time.getMonth()+1, start_time.getDate(), start_time.getHours(), start_time.getMinutes()
        ],
        startInputType: 'local',
        startOutputType: 'local',
        end: [
            end_time.getFullYear(), end_time.getMonth()+1, end_time.getDate(), end_time.getHours(), end_time.getMinutes()
        ],
        endInputType: 'local',
        endOutputType: 'local',
        title: r.course_name,
        description: r.course_description + "\n\n" + r.location_name + (r.location_url ? "\n" + r.location_url : (r.location_description ? "\n" + r.location_description : "")),
        location: r.location_url ? r.location_url : r.location_name,
        organizer: {
            name: r.instructor_name, email: r.instructor_email
        },
    };

    if (r.location_url) {
        event.url = r.location_url;
    }

    if (r.type == "group") {
        const all_reservations = await db.getSimpleSlotReservations(r.slot_id);

        if (all_reservations && all_reservations.length) {
            event.description = event.description + "\n\nBokade:\n";
    
            for (const a of all_reservations) {
                event.description = event.description + a.canvas_group_name + "\n";
            }
        }
    }

    ics.createEvent(event, (error, value) => {
        if (error) {
            console.error(error);
        }

        ical_event = value;
    });

    return ical_event;
}

/**
 * Create a calendar event (VCALENDAR 2.0) from a single available slot (for instructors).
 * 
 * @param {Object} s
 * @returns VCALENDAR entry
 */
async function iCalendarEventFromSlot(s) {
    var ical_event;

    const start_time = new Date(s.time_start);
    const end_time = new Date(s.time_end);

    let event = {
        productId: 'canvas-group-bookings/adamgibbons/ics',
        start: [
            start_time.getFullYear(), start_time.getMonth()+1, start_time.getDate(), start_time.getHours(), start_time.getMinutes()
        ],
        startInputType: 'local',
        startOutputType: 'local',
        end: [
            end_time.getFullYear(), end_time.getMonth()+1, end_time.getDate(), end_time.getHours(), end_time.getMinutes()
        ],
        endInputType: 'local',
        endOutputType: 'local',
        title: s.course_name,
        description: s.course_description + "\n\n" + s.instructor_name + "\n" + s.location_name + (s.location_url ? "\n" + s.location_url : (s.location_description ? "\n" + s.location_description : "")),
        location: s.location_url ? s.location_url : s.location_name
    };

    if (s.location_url) {
        event.url = s.location_url;
    }

    const all_reservations = await db.getExtendedSlotReservations(s.id);

    if (all_reservations && all_reservations.length) {
        event.description = event.description + "\n\nBokade:\n";
    
        for (const a of all_reservations) {
            event.description = event.description + (s.type == "group" ? a.canvas_group_name : a.canvas_user_name) + "\n";
        }
    }
    
    ics.createEvent(event, (error, value) => {
        if (error) {
            console.error(error);
        }

        ical_event = value;
    });

    return ical_event;
}

module.exports = {
    iCalendarEventFromReservation,
    iCalendarEventFromSlot,
}
