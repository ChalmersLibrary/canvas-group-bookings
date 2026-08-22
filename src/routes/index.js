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
                    try {
                        let canvasGroupCategoryFilter = await db.getCourseGroupCategoryFilter(res.locals.courseId);
                        req.session.user.groups = await canvasApi.getCourseGroupsSelfReference(res.locals.courseId, canvasGroupCategoryFilter, token);
                    }
                    catch (error) {
                        log.error(`Error fetching groups for user id ${req.session.user.id}: ${error.message}.`);
                        req.session.user.groups = [];
                    }
                    
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
                log.debug("Language set to: " + res.getLocale() + ", res.locals.lang: " + res.locals.lang + ", req.session.user.locale: " + req.session.user.locale + ", req.session.lti.launch_presentation_locale: " + req.session.lti.launch_presentation_locale + ", res.locals.locale: " + res.locals.locale);

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
                    /* The code cannot see why the session is unusable, so record what separates
                       the two candidates instead of asserting one: a browser that never sent the
                       cookie, which is a cookie policy and what cookie.partitioned addresses,
                       against a cookie that arrived on an empty session, which is the store. The
                       user agent says whether the browser is one partitioning helps. */
                    const cookieName = process.env.SESSION_NAME ? process.env.SESSION_NAME : "LTI_TEST_SID";
                    const cookieArrived = (req.headers.cookie || "").includes(cookieName + "=");
                    /* express-session always puts `cookie` on the session, so anything beyond
                       that one key means data came back with it. */
                    const sessionHasData = req.session && Object.keys(req.session).length > 1;

                    log.error("Callback with no usable session." +
                        " Session cookie " + (cookieArrived ? "arrived" : "did NOT arrive") +
                        ", session " + (sessionHasData ? "has data" : "is empty") +
                        ", sid " + log.fingerprint(req.sessionID) +
                        ", secure " + req.secure + ", protocol " + req.protocol +
                        ", user agent " + JSON.stringify(req.headers['user-agent'] || "-"));

                    /* The path has to be built before the ternary: `+` binds tighter than `?:`,
                       so `lang ? lang : "en" + "/pages/..."` renders a template called "sv" when
                       a language is set. It never fired because res.locals.lang is only set on
                       the branch that has a session, but it made views/sv/.../session
                       unreachable and would have broken the page the moment that changed. */
                    const errorPage = (res.locals.lang ? res.locals.lang : "en") +
                        "/pages/error/session/index";

                    return res.render(errorPage, {
                        version: pkg.version,
                        internal: {
                            version: pkg.version,
                            node_version: process.version,
                            db: process.env.PGDATABASE
                        }
                    });
                }
                catch (error) {
                    log.error(error);
                }
            }
            else {
                log.debug("Access token is not valid or not found, redirecting to auth flow...");

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

router.use((err, req, res, next) => {
    res.status(400).send({
        success: false,
        message: err.message
    });
});

module.exports = router;
