/* Helpers for driving an LTI 1.1 launch from a test: signing, a launch body, and a cookie jar.
   Adapted from the same helper in nodejs-lti-canvas-groups. */
'use strict';

const crypto = require('node:crypto');

/* The percent encoding that the OAuth 1.0a signature base string uses. */
const specialEncode = (value) => encodeURIComponent(String(value))
    .replace(/[!'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/\*/g, '%2A');

/**
 * The HMAC-SHA1 signature of a launch, the way ims-lti builds it: the method, the launch url
 * and the sorted parameters, joined with & and each part percent encoded.
 */
const signLaunch = (launchUrl, body, secret) => {
    const params = Object.entries(body)
        .filter(([key]) => key !== 'oauth_signature')
        .map(([key, value]) => `${key}=${specialEncode(value)}`)
        .sort()
        .join('&');

    const base = ['POST', specialEncode(launchUrl), specialEncode(params)].join('&');

    return crypto.createHmac('sha1', secret + '&').update(base).digest('base64');
};

/**
 * A launch body for a valid launch. Every value here is invented; nothing in this file may
 * carry a real personnummer, name or email, because this repository is public.
 *
 * Each call gets a fresh nonce and timestamp, so two launches from one test are not a replay.
 */
const launchBody = (overrides = {}) => ({
    lti_message_type: 'basic-lti-launch-request',
    lti_version: 'LTI-1p0',
    resource_link_id: 'rl-1',
    resource_link_title: 'Booking',
    context_id: 'ctx-1',
    context_title: 'Testkurs 2026',
    user_id: 'lti-user-1',
    roles: 'Instructor',
    tool_consumer_instance_guid: 'test-consumer-guid',
    tool_consumer_info_product_family_code: 'canvas',
    custom_canvas_user_id: '777',
    custom_canvas_course_id: '123',
    custom_canvas_enrollment_state: 'active',
    custom_canvas_api_domain: '127.0.0.1',
    launch_presentation_locale: 'sv',
    oauth_consumer_key: 'testconsumer',
    oauth_nonce: crypto.randomBytes(12).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: '1.0',
    ...overrides
});

/**
 * A signed launch body, ready to post as application/x-www-form-urlencoded.
 */
const signedLaunch = (launchUrl, secret, overrides = {}) => {
    const body = launchBody(overrides);
    body.oauth_signature = signLaunch(launchUrl, body, secret);

    return body;
};

module.exports = { specialEncode, signLaunch, launchBody, signedLaunch };
