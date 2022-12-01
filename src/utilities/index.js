'use strict'

require('dotenv').config();
const fs = require('fs');

function getDatePart(date) {
    const dateOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
    console.log("Incoming: " + date);
    console.log("Outgoing: " + new Date(date).toLocaleDateString('sv-SE', dateOptions));
    return new Date(date).toLocaleDateString('sv-SE', dateOptions);
}
function getTimePart(date) {
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    return new Date(date).toLocaleTimeString('sv-SE', timeOptions);
}

function getTemplate(type) {
    let content;
    let file = "templates/" + type + ".txt";

    if (fs.existsSync(file)) {
        content = fs.readFileSync(file).toString();
    }

    return content;
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function paginate(total_records, per_page, current_page, segment, course, instructor, location, availability, start_date, end_date) {
    console.log("Total records: " + total_records);
    console.log("Per page: " + per_page);
    console.log("Current page: " + current_page);

    const total_pages = Math.ceil(total_records / per_page);
    const pages = new Array(total_pages);

    console.log("Number of pages: " + total_pages);

    let link_url = "";
    segment !== undefined && !isNaN(segment) ? link_url = link_url + "&segment=" + segment : null;
    course !== undefined && !isNaN(course) ? link_url = link_url + "&course=" + course : null;
    instructor !== undefined && !isNaN(instructor) ? link_url = link_url + "&instructor=" + instructor : null;
    location !== undefined && !isNaN(location) ? link_url = link_url + "&location=" + location : null;
    availability !== undefined && !isNaN(availability) ? link_url = link_url + "&availability=" + availability : null;
    start_date !== undefined ? link_url = link_url + "&start_date=" + start_date : null;
    end_date !== undefined ? link_url = link_url + "&end_date=" + end_date : null;

    let pagination = {
        records_total: total_records,
        records_per_page: per_page,
        pages_total: total_pages,
        current_page: current_page,
        link: {
            first_page: "page=1" + link_url,
            previous_page: "page=" + (parseInt(current_page) - 1 == 0 ? 1 : parseInt(current_page) - 1) + link_url,
            next_page: "page=" + (parseInt(current_page) + 1 > total_pages ? total_pages : parseInt(current_page) + 1) + link_url,
            last_page: "page=" + parseInt(total_pages) + link_url
        },
        pages: []
    };

    for (let i = 0; i < pages.length; i++) {
        pagination.pages.push({
            page: i + 1,
            current: current_page == i + 1 ? true : false,
            link: "page=" + (i + 1) + link_url
        });
    }

    return pagination;
}

function replaceMessageMagics(body, course_name, reservation_message, cancellation_policy_hours, user_name, time_start, location_name, location_url, instructor_name, instructor_email, group_name, group_names) {
    body = body.replaceAll("{{reservation_course_name}}", course_name);
    body = body.replaceAll("{{reservation_message}}", reservation_message);
    body = body.replaceAll("{{reservation_group_name}}", group_name);
    body = body.replaceAll("{{slot_group_names}}", group_names);
    body = body.replaceAll("{{cancellation_policy_hours}}", cancellation_policy_hours);
    body = body.replaceAll("{{canvas_user_name}}", user_name);
    body = body.replaceAll("{{reservation_slot_time}}", time_start);
    body = body.replaceAll("{{location_name}}", location_name + (location_url ? ", " + location_url : ""));
    body = body.replaceAll("{{instructor_name}}", instructor_name);
    body = body.replaceAll("{{instructor_email}}", instructor_email);
    body = body.replaceAll("{{CONVERSATION_ROBOT_NAME}}", process.env.CONVERSATION_ROBOT_NAME ? process.env.CONVERSATION_ROBOT_NAME : "Canvas Conversation Robot");

    return body;
}

module.exports = {
    getDatePart,
    getTimePart,
    getTemplate,
    capitalizeFirstLetter,
    replaceMessageMagics,
    paginate
}