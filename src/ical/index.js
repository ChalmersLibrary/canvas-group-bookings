'use strict';

require('dotenv').config();
const log = require('../logging')
const db = require('../db');
const ics = require('ics');

async function iCalendarEventFromReservation(r) {
    var ical_event;

    const start_time = new Date(r.time_start);
    const end_time = new Date(r.time_end);

    log.info(start_time);
    log.info(end_time);

    /*
    console.log(start_time);
    console.log(end_time);
    console.log(start_time.getFullYear(), start_time.getMonth()+1, start_time.getDate(), start_time.getHours(), start_time.getMinutes());
    console.log(end_time.getFullYear(), end_time.getMonth()+1, end_time.getDate(), end_time.getHours(), end_time.getMinutes());
    */
    
    const event = {
        productId: 'canvas-group-bookings/adamgibbons/ics',
        start: [
            start_time.getFullYear(), start_time.getMonth()+1, start_time.getDate(), start_time.getHours(), start_time.getMinutes()
        ],
        startInputType: 'local',
        startOutputType: 'utc',
        end: [
            end_time.getFullYear(), end_time.getMonth()+1, end_time.getDate(), end_time.getHours(), end_time.getMinutes()
        ],
        endInputType: 'local',
        endOutputType: 'utc',
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

        event.attendees = [];
        
        for (const a of all_reservations) {
            event.attendees.push({
                name: a.canvas_group_name, rsvp: false, email: 'noreply@chalmers.se'
            });
        }
    }

    log.info("startInputType: " + event.startInputType);
    log.info("startOutputType: " + event.startOutputType);

    ics.createEvent(event, (error, value) => {
        if (error) {
            console.error(error);
        }

        ical_event = value;
    });

    return ical_event;
}

module.exports = {
    iCalendarEventFromReservation
}
