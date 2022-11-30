'use strict';

require('dotenv').config();
const fs = require('fs');
const log = require('../logging');
const db = require('../db');

let developmentLtiData;

if (process.env.NODE_ENV === 'development') {
    try {
        const data = fs.readFileSync('mock-lti.json', 'utf8');
        developmentLtiData = data;
    }
    catch (err) {
        log.error(err);
    }
}

// Mock session with LTI object in development
async function mockLtiSession(req) {
    if (process.env.NODE_ENV === 'development' && developmentLtiData) {
        req.session.lti = JSON.parse(developmentLtiData);
    }
}

// Copy user data from a token into session
async function createSessionUserdataFromToken(req, token) {
    if (req.session) {
        if (token !== undefined) {
            const local_user = await db.getInstructorWithCanvasUserId(token.user.id);

            req.session.user = { 
                id: token.user.id, 
                db_id: local_user ? local_user.id : null,
                name: token.user.name, 
                locale: token.user.effective_locale.substr(0,2) 
            };
        }
    }
    else {
        throw new Error("No session exists in request object!");
    }

    return req.session.user;
}

// Add flags in the session user object, requires custom field "custom_canvas_roles"
// with variable substitution "$Canvas.membership.roles".
async function addUserFlagsForRoles(req) {
    if(req.session.user && req.session.lti) {
        if (req.session.lti.custom_canvas_roles) {
            req.session.user.isAdministrator = false;
            req.session.user.isInstructor = false;

            req.session.lti.custom_canvas_roles.split(",").forEach((role) => {
                if (role === "Examiner" || role === "Account Admin") {
                    req.session.user.isAdministrator = true;
                    req.session.user.isInstructor = true;
                }
                if (role === "TeacherEnrollment") {
                    req.session.user.isInstructor = true;
                }
            });
        }

        req.session.user.isTouchedByTheHandOfGod = true;
    }
}

// Get primary email from LTI object
function getPrimaryEmail(req) {
    if (req.session.user && req.session.lti) {
        if (req.session.lti.lis_person_contact_email_primary) {
            return req.session.lti.lis_person_contact_email_primary;
        }
    }
}

module.exports = {
    mockLtiSession,
    createSessionUserdataFromToken,
    addUserFlagsForRoles,
    getPrimaryEmail
}