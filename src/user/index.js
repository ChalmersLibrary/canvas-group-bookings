'use strict';

require('dotenv').config();
const fs = require('fs');
const log = require('../logging')

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
            req.session.user = { id: token.user.id, name: token.user.name, locale: token.user.effective_locale.substr(0,2) };
        }
    }
    else {
        throw new Error("No session exists in request object!");
    }

    return req.session.user;
}

// Add flags in the session user object
async function addUserFlagsForRoles(req) {
    if(req.session.user && req.session.lti) {
        if (req.session.lti.ext_roles) {
            req.session.user.isAdministrator = false;
            req.session.user.isInstructor = false;

            req.session.lti.ext_roles.split(",").forEach((role) => {
                log.info(role);
                if (role === "urn:lti:instrole:ims/lis/Administrator" || role === "urn:lti:role:ims/lis/Administrator") {
                    req.session.user.isAdministrator = true;
                }
                if (role === "urn:lti:instrole:ims/lis/Instructor" || role === "urn:lti:role:ims/lis/Instructor") {
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