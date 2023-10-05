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
const i18n = require('../lang/i18n.config');

// Handle LTI Launch
router.post('/lti', lti.handleLaunch('/'));

// Setup OAuth2 endpoints and communication
auth.setupAuthEndpoints(router, process.env.AUTH_REDIRECT_CALLBACK);

/**
 * General middleware that runs first, checking access token and LTI session.
 * Also populates session object with user information like id, name, groups.
 */
router.all(['/', '/reservations', '/privacy', '/debug', '/admin*', '/api/*'], async function (req, res, next) {
    await auth.checkAccessToken(req).then(async (token) => {
        if (token !== undefined && token.success === true) {
            await user.mockLtiSession(req);
            await user.addUserFlagsForRoles(req);

            if (req.session.lti) {
                res.locals.token = token;
                res.locals.courseId = req.session.lti.custom_canvas_course_id ? req.session.lti.custom_canvas_course_id : "lti_context_id:" + req.session.lti.context_id;

                // Add the groups from Canvas for this user, only if active enrollment
                if (req.session.lti.custom_canvas_enrollment_state && req.session.lti.custom_canvas_enrollment_state == "active") {
                    let canvasGroupCategoryFilter = await db.getCourseGroupCategoryFilter(res.locals.courseId);
                    req.session.user.groups = await canvasApi.getCourseGroupsSelfReference(res.locals.courseId, canvasGroupCategoryFilter, token);

                    // Create arrays in user object for easy access and correct type mapping against db
                    req.session.user.groups_ids = new Array();
                    req.session.user.groups_human_readable = new Array();

                    for (const group of req.session.user.groups) {
                        req.session.user.groups_human_readable.push(group.name);
                        req.session.user.groups_ids.push(group.id.toString());
                    }
                }
                else {
                    req.session.user.groups = [];
                }

                // Set the language based on lti launch presentation locale (fixed due to Canvas bug with only two chars in some locales) or lastly the locale in the user object.
                // Note: i18n will fallback to default locale if something non-existing is specified.
                res.locals.locale = req.session.lti.locale_original.toString().length < 3 ? req.session.lti.locale_full : req.session.lti.locale_original;
                res.setLocale(res.locals.locale ? res.locals.locale : req.session.user.locale);
                res.locals.lang = res.getLocale().toString().slice(0, 2);
                log.info("Language set to: " + res.getLocale() + ", res.locals.lang: " + res.locals.lang + ", req.session.user.locale: " + req.session.user.locale + ", req.session.lti.launch_presentation_locale: " + req.session.lti.launch_presentation_locale + ", res.locals.locale: " + res.locals.locale);

                // Read configuration keys and values for the course
                res.locals.configuration = await db.getCanvasCourseConfiguration(res.locals.courseId);

                // Add some debug information
                req.session.internal = {
                    version: pkg.version,
                    node_version: process.version,
                    db: process.env.PGDATABASE
                };

                // Move on to the actual route handler
                next();
            }
            else {
                log.error("No LTI information found in session. This application must be started with LTI request.");

                return res.render("pages/error", {
                    version: pkg.version,
                    internal: {
                        version: pkg.version,
                        node_version: process.version,
                        db: process.env.PGDATABASE
                    },
                    error: res.__('SystemBackendErrorLtiLaunch'),
                    message: res.__('SystemBackendErrorLtiLaunchMessage')
                });
            }
        }
        else {
            if (req.query.from == "callback") {
                try {
                    log.error("Coming from callback, but with no session. Third party cookies problem. Rendering special error page.");
                
                    return res.render(res.locals.lang + "/pages/error/session", {
                        version: pkg.version,
                        internal: {
                            version: pkg.version,
                            node_version: process.version,
                            db: process.env.PGDATABASE
                        }
                    });
                } catch (error) {
                    console.error(error);
                }
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
