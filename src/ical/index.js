'use strict';

require('dotenv').config();
const log = require('../logging')
const ics = require('ics');

async function iCalendarEventFromReservation(r) {
    console.log(r);
    
    var ical_event;
    const start_time = new Date(r.time_start);
    const end_time = new Date(r.time_end);

    console.log(start_time);
    console.log(end_time);
    
    console.log(start_time.getFullYear(), start_time.getMonth()+1, start_time.getDate(), start_time.getHours(), start_time.getMinutes());
    console.log(end_time.getFullYear(), end_time.getMonth()+1, end_time.getDate(), end_time.getHours(), end_time.getMinutes());
    
    const event = {
        productId: 'canvas-group-bookings/adamgibbons/ics',
        start: [
            start_time.getFullYear(), start_time.getMonth()+1, start_time.getDate(), start_time.getHours(), start_time.getMinutes()
        ],
        end: [
            end_time.getFullYear(), end_time.getMonth()+1, end_time.getDate(), end_time.getHours(), end_time.getMinutes()
        ],
        title: r.course_name,
        description: r.course_description + "\n\n" + r.location_name + (r.location_url ? "\n" + r.location_url : null),
        location: r.location_url ? r.location_url : r.location_name,
        url: r.location_url,
        organizer: {
            name: r.instructor_name, email: 'not_exposed_in_api@chalmers.se'
        },
    };

    ics.createEvent(event, (error, value) => {
        if (error) {
            console.error(error)
        }

        ical_event = value;
    });

    return ical_event;
}

module.exports = {
    iCalendarEventFromReservation
}
