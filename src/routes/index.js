'use strict';

const express = require('express');
const router = express.Router();
const log = require('../logging/');
const lti = require('../lti/canvas');
const context = require('../lti/context');
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

/*
 * The paths that require a token and an LTI session. A page reachable without passing through
 * here has no user, so anything added to the application belongs in this list.
 *
 * A wildcard segment is named, and matches one or more segments after the prefix but not the
 * prefix alone, which is why the admin root is listed separately from what is under it.
 */
const guardedPaths = ['/', '/reservations', '/privacy', '/debug', '/admin', '/admin/*splat', '/api/*splat'];

/**
 * General middleware that runs first, checking access token and LTI session.
 * Also populates session object with user information like id, name, groups.
 */
/*
 * Which launch a request acts in, resolved before anything else so the token check, the role flags
 * and the course all come from the same one.
 *
 * There is deliberately no fallback to the most recent launch. A request that names no context is
 * refused, which is what makes a page link or a client call site that was missed fail on the first
 * click rather than write to whichever course was launched last. Development is the one exception,
 * where a mocked launch registers itself because it never passed through the launch handler.
 */
router.all(guardedPaths, async function (req, res, next) {
    const mockKey = await user.mockLtiSession(req);
    const resolved = context.resolve(req)
        || (mockKey ? { key: mockKey, lti: req.session.launches[mockKey] } : undefined);

    if (!resolved) {
        log.debug("Request carries no usable context key: " + req.method + " " + req.path + ".");

        if (req.path.startsWith('/api/')) {
            return res.status(400).send({
                success: false,
                message: "This page has lost track of its course. Open the tool from Canvas again."
            });
        }

        return res.render("pages/error", {
            version: pkg.version,
            internal: {
                version: pkg.version,
                node_version: process.version,
                db: process.env.PGDATABASE
            },
            error: res.__('SystemBackendErrorLtiContext'),
            message: res.__('SystemBackendErrorLtiContextMessage')
        });
    }

    await auth.checkAccessToken(req, resolved.lti).then(async (token) => {
        if (token !== undefined && token.success === true) {
            await user.addUserFlagsForRoles(req, resolved.lti);

            res.locals.token = token;
            /* Every url the page builds carries this, and every api call sends it as a
               header. */
            res.locals.contextKey = resolved.key;
            res.locals.ctxUrl = (url) => context.withKey(url, resolved.key);
            res.locals.lti = resolved.lti;
            req.lti = resolved.lti;
            res.locals.courseId = context.courseId(resolved.lti);

            // Add the groups from Canvas for this user, only if active enrollment
            if (resolved.lti.custom_canvas_enrollment_state && resolved.lti.custom_canvas_enrollment_state == "active") {
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
            /* The launch handler computes locale_original and locale_full for every real launch.
               A launch that did not come through it -- the development mock, read from a file
               somebody wrote by hand -- may carry neither, and reading toString() off an absent
               one throws, where the line below already has a fallback for having nothing. */
            res.locals.locale = resolved.lti.locale_original
                ? (resolved.lti.locale_original.toString().length < 3 ? resolved.lti.locale_full : resolved.lti.locale_original)
                : undefined;
            res.setLocale(res.locals.locale ? res.locals.locale : req.session.user.locale);
            res.locals.lang = res.getLocale().toString().slice(0, 2);
            log.debug("Language set to: " + res.getLocale() + ", res.locals.lang: " + res.locals.lang + ", req.session.user.locale: " + req.session.user.locale + ", launch_presentation_locale: " + resolved.lti.launch_presentation_locale + ", res.locals.locale: " + res.locals.locale);

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

                /* The key goes with it: the flow leaves the application entirely and comes back
                   on a redirect from Canvas, so nothing else would carry it. */
                return res.redirect(context.withKey("/auth", resolved.key));
            }
        }
    })
    .catch(error => {
        log.error(error);

        if (error.message.includes("invalid_grant")) {
            return res.redirect(context.withKey("/auth", resolved.key));
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

/* Exposed so the paths themselves can be tested, rather than a copy of them. */
module.exports.guardedPaths = guardedPaths;
