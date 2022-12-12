'use strict'

require('dotenv').config();
const fs = require('fs');

function getDatePart(date) {
    const dateOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
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
    const total_pages = Math.ceil(total_records / per_page);
    const pages = new Array(total_pages);

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

function linkify(this_filter_name, this_filter_items, segment, course, instructor, location, availability, start_date, end_date) {
    let link_url = "";
    let this_list = [];

    this_filter_name != 'segment' && segment !== undefined && !isNaN(segment) ? link_url = link_url + "&segment=" + segment : null;
    this_filter_name != 'course' && course !== undefined && !isNaN(course) ? link_url = link_url + "&course=" + course : null;
    this_filter_name != 'instructor' && instructor !== undefined && !isNaN(instructor) ? link_url = link_url + "&instructor=" + instructor : null;
    this_filter_name != 'location' && location !== undefined && !isNaN(location) ? link_url = link_url + "&location=" + location : null;
    this_filter_name != 'availability' && availability !== undefined && !isNaN(availability) ? link_url = link_url + "&availability=" + availability : null;
    this_filter_name != 'date' && start_date !== undefined ? link_url = link_url + "&start_date=" + start_date : null;
    this_filter_name != 'date' && end_date !== undefined ? link_url = link_url + "&end_date=" + end_date : null;

    if (this_filter_name == 'segment') {
        this_list.push({
            id: null,
            name: 'Visa alla',
            link: '?segment=' + link_url,
            active: isNaN(segment)
        });
        this_filter_items.forEach(s => {
            this_list.push({
                id: s.id,
                name: s.name,
                link: '?segment=' + s.id + link_url,
                active: !isNaN(segment) && parseInt(segment) == s.id
            });
        })
    }

    if (this_filter_name == 'course') {
        this_list.push({
            id: null,
            name: 'Visa alla',
            link: '?course=' + link_url,
            active: isNaN(course)
        });
        this_filter_items.forEach(s => {
            this_list.push({
                id: s.id,
                name: s.name,
                link: '?course=' + s.id + link_url,
                active: !isNaN(course) && parseInt(course) == s.id
            });
        })
    }

    if (this_filter_name == 'instructor') {
        this_list.push({
            id: null,
            name: 'Visa alla',
            link: '?instructor=' + link_url,
            active: isNaN(instructor)
        });
        this_filter_items.forEach(s => {
            this_list.push({
                id: s.id,
                name: s.name,
                link: '?instructor=' + s.id + link_url,
                active: !isNaN(instructor) && parseInt(instructor) == s.id
            });
        })
    }

    if (this_filter_name == 'location') {
        this_list.push({
            id: null,
            name: 'Visa alla',
            link: '?location=' + link_url,
            active: isNaN(location)
        });
        this_filter_items.forEach(s => {
            this_list.push({
                id: s.id,
                name: s.name,
                link: '?location=' + s.id + link_url,
                active: !isNaN(location) && parseInt(location) == s.id
            });
        })
    }

    if (this_filter_name == 'availability') {
        this_list.push({
            id: null,
            name: 'Endast bokningsbara',
            link: '?availability=' + link_url,
            active: isNaN(availability)
        });
        this_filter_items.forEach(s => {
            this_list.push({
                id: s.id,
                name: s.name,
                link: '?availability=' + s.id + link_url,
                active: !isNaN(availability) && parseInt(availability) == s.id
            });
        })
    }

    if (this_filter_name == 'date') {
        this_list = {};
        this_list.params = [];
        link_url.split("&").forEach(p => {
            if (p != ''){
                this_list.params.push({
                    name: p.split("=")[0],
                    value: p.split("=")[1]
                });    
            }
        })
        this_list.start_date = start_date;
        this_list.end_date = end_date;
    }

    return this_list;
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
    paginate,
    linkify
}