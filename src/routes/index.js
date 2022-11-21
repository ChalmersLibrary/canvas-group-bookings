'use strict';

const express = require('express');
const router = express.Router();
const log = require('../logging/');
const lti = require('../lti/canvas');
const auth = require('../auth/oauth2');
const user = require('../user');
const db = require('../db');
const canvasApi = require('../api/canvas');
const pkg = require('../../package.json');
const routesApi = require('./api');

// Handle LTI Launch
router.post('/lti', lti.handleLaunch('/'));

// Setup OAuth2 endpoints and communication
auth.setupAuthEndpoints(router, process.env.AUTH_REDIRECT_CALLBACK);

/**
 * General middleware that runs first, checking access token and LTI session.
 * Also populates session object with user information like id, name, groups.
 */
router.use(['/', '/test', '/reservations', '/admin*', '/api/*'], async function (req, res, next) {
    await auth.checkAccessToken(req).then(async (token) => {
        if (token !== undefined && token.success === true) {
            await user.mockLtiSession(req);
            await user.addUserFlagsForRoles(req);

            if (req.session.lti) {
                res.locals.token = token;
                res.locals.courseId = req.session.lti.custom_canvas_course_id ? req.session.lti.custom_canvas_course_id : "lti_context_id:" + req.session.lti.context_id;
                
                // Add the groups from Canvas for this user
                let canvasGroupCategoryFilter = await db.getCourseGroupCategoryFilter(res.locals.courseId);
                req.session.user.groups = await canvasApi.getCourseGroups(res.locals.courseId, canvasGroupCategoryFilter, token);
                req.session.user.groups_ids = new Array();
                req.session.user.groups_human_readable = new Array();
            
                for (const group of req.session.user.groups) {
                    req.session.user.groups_human_readable.push(group.name);
                    req.session.user.groups_ids.push(group.id);
                }

                // Add some debug information
                req.session.internal = {
                    version: pkg.version,
                    db: process.env.PGDATABASE
                };

                // Move on to the actual route handler
                next();
            }
            else {
                log.error("No LTI information found in session. This application must be started with LTI request.");

                return res.render("pages/error", {
                    version: pkg.version,
                    internal: req.session.internal,
                    error: "Kan inte läsa LTI-information",
                    message: "Bokningsverktyget måste startas som en LTI-applikation inifrån Canvas för att få information om kontexten."
                });
            }
        }
        else {
            if (req.query.from == "callback") {
                log.error("Coming from callback, but with no session. Third party cookies problem.");
                
                return res.render("pages/error", {
                    version: pkg.version,
                    internal: req.session.internal,
                    error: "Kan inte skapa en session",
                    message: "Du måste tillåta cookies från tredje part i din webbläsare. Bokningsverktyget använder cookies för att kunna hantera din identitiet från Canvas."
                });
            }
            else {
                log.error("Access token is not valid or not found, redirecting to auth flow...");

                return res.redirect("/auth");
            }
        }
    })
    .catch(error => {
        log.error(error);

        if (error.message.includes("invalid_grant")) {
            return res.redirect("/auth");
        }
        else {
            next(new Error(error));
        }
    });
});

router.use('/api', routesApi);

module.exports = router;