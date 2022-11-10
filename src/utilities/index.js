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
    replaceMessageMagics
}