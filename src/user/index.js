'use strict';

require('dotenv').config();
const fs = require('fs');
const log = require('../logging');
const db = require('../db');
const context = require('../lti/context');

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

/*
 * Mock session with LTI object in development.
 *
 * A mocked launch never goes through the launch handler, so nothing has put it in the session's
 * launch map and no url carries its key. Register it here and answer the key, so a developer
 * machine reaches the application the same way a real launch does.
 *
 * Only when the request names no context at all. A request carrying a key that this session does
 * not hold is refused here exactly as it is in production: registering the mock for it would make
 * the mock the answer to any key, so a developer would never meet the refusal and would never see
 * the missed link or call site it exists to expose.
 */
async function mockLtiSession(req) {
    if (process.env.NODE_ENV === 'development' && developmentLtiData) {
        if (context.keyFromRequest(req)) {
            return undefined;
        }

        const launch = JSON.parse(developmentLtiData);

        /* The launch map is keyed by placement, and a mock file need not carry the
           resource_link_id a real launch always does. Stand one in from the course so a mock
           without it still resolves, rather than making the file's completeness decide whether a
           developer machine works at all. */
        if (!launch.resource_link_id) {
            launch.resource_link_id = 'mock-' + launch.context_id;
        }

        return context.store(req, launch);
    }

    return undefined;
}

// Copy user data from a token into session
async function createSessionUserdataFromToken(req, token) {
    if (req.session) {
        if (token !== undefined) {
            const local_user = await db.getInstructorWithCanvasUserId(token.user.id);
            const userId = token.user.global_id && process.env.USERID_PREFIX_FORCE_GLOBAL_ID && token.user.global_id.startsWith(process.env.USERID_PREFIX_FORCE_GLOBAL_ID) ? token.user.global_id : token.user.id;

            req.session.user = { 
                id: userId.toString(),
                db_id: local_user ? local_user.id : null,
                name: token.user.name, 
                locale: token.user.effective_locale.toString() 
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
async function addUserFlagsForRoles(req, lti) {
    if(req.session.user && lti) {
        if (lti.custom_canvas_roles) {
            req.session.user.isAdministrator = false;
            req.session.user.isInstructor = false;

            if (lti.custom_canvas_roles != "") {
                lti.custom_canvas_roles.split(",").forEach((role) => {
                    if (role === "Examiner" || role === "Administrator" || role === "Department Admin" || role === "Account Admin") {
                        if (lti.custom_canvas_roles.includes("StudentEnrollment")) { // fix for if this user is account admin but enrolled as student in current course
                            req.session.user.isAdministrator = false;
                            req.session.user.isInstructor = false;
                        }
                        else if (lti.custom_canvas_roles.includes("TeacherEnrollment")) { // fix for if this user is account admin but enrolled as teacher in current course
                            req.session.user.isAdministrator = false;
                            req.session.user.isInstructor = true;
                        }
                        else {
                            req.session.user.isAdministrator = true;
                            req.session.user.isInstructor = true;    
                        }
                    }
                    if (role === "TeacherEnrollment") {
                        req.session.user.isInstructor = true;
                    }
                });
            }
        }

        req.session.user.isTouchedByTheHandOfGod = true;
    }
}

module.exports = {
    mockLtiSession,
    createSessionUserdataFromToken,
    addUserFlagsForRoles
}