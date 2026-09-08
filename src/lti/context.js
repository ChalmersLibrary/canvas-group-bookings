'use strict';

/*
 * Which course a request acts on.
 *
 * A session is identified by a cookie, and cookies are per origin rather than per tab, so two
 * placements opened in two tabs share one session. A single launch object in that session is
 * therefore overwritten by whichever launch happened last, and every later request in either tab
 * derives its course from it: the tool follows the most recent launch, and an administration write
 * lands in a course the operator is not looking at.
 *
 * The launch is kept in a map instead, keyed by a value the page carries in every request it makes.
 * The key is derived from resource_link_id, which is per placement per course, so two placements in
 * one course stay distinct as well.
 *
 * Requests carry the key in the query string when they are navigations and in a header when they
 * are api calls. Nothing falls back to "the most recent launch": a request that carries no key is
 * refused, because a fallback is what makes a wrong course silent, and silence is the property that
 * made the original defect expensive rather than the wrong course itself.
 */

const crypto = require('crypto');
const log = require('../logging/');

/* The key goes in urls and in a header, so it is hex rather than the raw resource_link_id, which
   is opaque but not documented to be url-safe. Truncated because it identifies one of a handful of
   launches inside one session, not a secret: guessing another key reaches a launch that is only in
   that session if the session already holds it. */
const KEY_BYTES = 6;

/* A teacher moving between courses accumulates launches in one session. Old ones are dropped
   oldest first so a long-lived session cannot grow without bound, and the limit is well past the
   number of tabs anybody has open. Re-launching a placement refreshes its entry rather than adding
   one, since the key is derived from the placement. */
const MAX_LAUNCHES = 20;

const HEADER = 'x-lti-context';
const PARAMETER = 'ctx';

/**
 * The key for a launch. Stable for a placement, so relaunching it in the same tab keeps the url
 * that tab is already using valid.
 */
const keyForLaunch = (lti) => {
    if (!lti || !lti.resource_link_id) {
        return undefined;
    }

    return crypto.createHash('sha256')
        .update(String(lti.resource_link_id))
        .digest('hex')
        .slice(0, KEY_BYTES * 2);
};

/**
 * Put a launch in the session's map and answer its key. The caller still has to save the session.
 */
const store = (req, lti) => {
    const key = keyForLaunch(lti);

    if (!key) {
        return undefined;
    }

    if (!req.session.launches) {
        req.session.launches = {};
    }

    /* Delete before assigning so a relaunch moves to the end of the insertion order and the
       pruning below treats it as the newest rather than as whatever it was. */
    delete req.session.launches[key];

    req.session.launches[key] = lti;

    const keys = Object.keys(req.session.launches);

    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_LAUNCHES))) {
        delete req.session.launches[old];
    }

    return key;
};

/**
 * The key this request carries, from the header an api call sets or the query string a navigation
 * carries. Undefined when it carries neither.
 */
const keyFromRequest = (req) => {
    const header = req.get ? req.get(HEADER) : undefined;

    if (header) {
        return String(header);
    }

    if (req.query && req.query[PARAMETER]) {
        return String(req.query[PARAMETER]);
    }

    return undefined;
};

/**
 * The launch this request acts in, or undefined when the request carries no key or a key this
 * session has never held. The two cases are not distinguished to the caller because the answer is
 * the same either way: the request cannot be served and the user has to launch the tool again.
 */
const resolve = (req) => {
    const key = keyFromRequest(req);

    if (!key) {
        return undefined;
    }

    const lti = req.session && req.session.launches ? req.session.launches[key] : undefined;

    if (!lti) {
        /* Debug rather than error: an expired session and a stale bookmarked url both land here in
           normal use, and a session that has been replaced produces one of these per asset the
           page asks for. */
        log.debug("No launch in this session for context key " + key + ".");

        return undefined;
    }

    return { key: key, lti: lti };
};

/**
 * The course a launch acts on, in the form the database stores.
 *
 * Every canvas_course_id column is an integer, so the context_id fallback below cannot match one:
 * it is not a wrong answer but an invalid integer, and a launch without custom_canvas_course_id
 * already fails on the first course-scoped query. It is kept because removing it is a separate
 * decision about what such a launch should do, and this function is not where that is decided.
 */
const courseId = (lti) => lti.custom_canvas_course_id
    ? lti.custom_canvas_course_id
    : "lti_context_id:" + lti.context_id;

/**
 * Add the key to a url the application generates. Used where the server builds a link or a
 * redirect; the views and the client script have their own copies of this rule.
 */
const withKey = (url, key) => {
    if (!key) {
        return url;
    }

    return url + (url.includes('?') ? '&' : '?') + PARAMETER + '=' + encodeURIComponent(key);
};

module.exports = {
    keyForLaunch,
    store,
    keyFromRequest,
    resolve,
    courseId,
    withKey,
    HEADER,
    PARAMETER,
    MAX_LAUNCHES
};
