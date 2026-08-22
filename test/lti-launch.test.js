/*
 * The LTI 1.1 launch. src/lti/canvas.js is mounted on a minimal express app rather than the
 * real one, because app.js calls app.listen() at module level and src/db/index.js opens a
 * Postgres pool when it is required, so requiring the application would connect to whatever
 * database PGHOST names. The launch handler itself needs no database.
 *
 * node:http rather than fetch, because undici refuses to set the Host header and that is the
 * header the signature is computed over.
 */
'use strict';

/* Must come first: it moves the process into a temp directory before the logging module
   resolves its relative './logs' path. */
const sandbox = require('./helpers/sandbox');

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const SECRET = 's3cret';
const CONSUMER = 'testconsumer';

process.env.LTI_KEYS = `${CONSUMER}:${SECRET}`;
process.env.NODE_ENV = 'production';

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const { signedLaunch } = require('./helpers/lti');
const lti = require('../src/lti/canvas');

const request = (port, path, method, headers, payload, cookie) => new Promise((resolve, reject) => {
    const call = http.request({
        host: '127.0.0.1',
        port,
        path,
        method,
        /* No keep-alive. A refused launch double-sends and the server destroys the socket;
           with the shared agent that dead socket gets handed to the next request, which then
           fails for a reason that has nothing to do with what it was testing. */
        agent: false,
        headers: {
            ...(payload ? {
                'content-type': 'application/x-www-form-urlencoded',
                'content-length': Buffer.byteLength(payload)
            } : {}),
            ...(cookie ? { cookie } : {}),
            ...headers
        }
    }, (response) => {
        let body = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => resolve({
            status: response.statusCode,
            location: response.headers.location,
            setCookie: (response.headers['set-cookie'] ?? [])[0],
            body
        }));
    });

    call.on('error', reject);
    call.end(payload);
});

test('the LTI launch', async (t) => {
    const app = express();

    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.post('/lti', lti.handleLaunch('/'));

    /* Reports what the launch actually put in the session. */
    app.get('/probe', (req, res) => res.json({ lti: req.session.lti ?? null }));

    /* The real application mounts an error handler (src/routes/index.js), so this one does too,
       and records what reached it. */
    const errors = [];

    app.use((err, req, res, next) => {
        errors.push(err);

        /* Deliberately not re-dispatched. Passing it on would let express's final handler
           destroy a socket whose response has already been written, which resets the
           connection and makes an unrelated assertion fail for the wrong reason. */
        if (res.headersSent) {
            return;
        }

        return res.status(400).json({ success: false });
    });

    const server = app.listen(0);
    await new Promise((r) => server.on('listening', r));

    const port = server.address().port;
    const launchUrl = `http://127.0.0.1:${port}/lti`;

    t.after(() => {
        server.close();
        sandbox.cleanup();
    });

    const payloadFor = (overrides, secret = SECRET) =>
        new URLSearchParams(signedLaunch(launchUrl, secret, overrides)).toString();

    const launch = (payload) => request(port, '/lti', 'POST', { host: `127.0.0.1:${port}` }, payload);

    await t.test('a correctly signed launch is accepted and redirected', async () => {
        const { status, location } = await launch(payloadFor({}));

        assert.equal(status, 302, 'a valid launch should redirect');
        assert.equal(location, '/');
    });

    await t.test('a valid launch puts the Canvas ids in the session', async () => {
        const { setCookie } = await launch(payloadFor({}));

        assert.ok(setCookie, 'a valid launch should establish a session');

        /* The handler saves the session from inside an async callback but sends the redirect
           before that callback runs, so give the save a moment to land. */
        await new Promise((r) => setTimeout(r, 250));

        const cookie = setCookie.split(';')[0];
        const { body } = await request(port, '/probe', 'GET', {}, null, cookie);
        const { lti: launched } = JSON.parse(body);

        assert.ok(launched, 'the session should carry the lti object after a valid launch');
        assert.equal(launched.custom_canvas_user_id, '777');
        assert.equal(launched.custom_canvas_course_id, '123');
        assert.equal(launched.context_id, 'ctx-1');
    });

    await t.test('a two-letter Canvas locale is expanded to a full one', async () => {
        const { setCookie } = await launch(payloadFor({ launch_presentation_locale: 'sv' }));

        await new Promise((r) => setTimeout(r, 250));

        const { body } = await request(port, '/probe', 'GET', {}, null, setCookie.split(';')[0]);

        assert.equal(JSON.parse(body).lti.locale_full, 'sv-SE');
    });

    await t.test('an unknown locale still produces a full locale rather than throwing', async () => {
        const { setCookie } = await launch(payloadFor({ launch_presentation_locale: 'xx' }));

        await new Promise((r) => setTimeout(r, 250));

        const { body } = await request(port, '/probe', 'GET', {}, null, setCookie.split(';')[0]);

        assert.equal(JSON.parse(body).lti.locale_full, 'xx-XX');
    });

    await t.test('a launch with no consumer key is refused', async () => {
        const payload = new URLSearchParams({ lti_message_type: 'basic-lti-launch-request' }).toString();
        const { status } = await launch(payload);

        assert.equal(status, 422, 'no oauth_consumer_key must not be accepted');
    });

    /* The signature is the only thing separating a real launch from a forged one. */
    await t.test('a launch signed with the wrong secret is refused', async () => {
        const { status } = await launch(payloadFor({}, 'wrong-secret')).catch((error) => ({
            status: `the connection failed instead of answering: ${error.code}`
        }));

        assert.equal(status, 500, 'an invalid signature must not be accepted');
    });

    /*
     * Refused, but by accident rather than by design. getSecret calls back with an error that
     * carries status 403; handleLaunch logs it and carries on without returning, so it builds
     * an ims-lti Provider with an undefined secret, which throws. The launch is therefore
     * refused by whatever error handler is mounted — 400 here and in src/routes/index.js — and
     * the 403 the code went to the trouble of setting is discarded. Asserted as "refused"
     * rather than as a specific code, because the code comes from the error handler and not
     * from the launch path.
     */
    await t.test('a launch for an unknown consumer key is refused', async () => {
        const { status } = await launch(payloadFor({ oauth_consumer_key: 'not-a-consumer' }))
            .catch((error) => ({ status: `the connection failed: ${error.code}` }));

        assert.ok(status >= 400 && status < 600,
            `an unknown consumer must not be accepted, got ${status}`);
    });

    /*
     * handleLaunch ends with `return res.redirect("/")` outside the valid_request callback, so
     * the redirect is written whatever validation decided. When validation fails it calls back
     * synchronously and answers 500 first, and the redirect then throws ERR_HTTP_HEADERS_SENT
     * from inside the route, which resets the connection. The client sees the 500 but the
     * socket dies with it, and the exception is logged on every forged or misconfigured launch.
     */
    await t.test('a refused launch answers cleanly instead of double-sending', async () => {
        const outcome = await launch(payloadFor({}, 'wrong-secret'))
            .then(() => 'answered')
            .catch((error) => error.code);

        assert.equal(outcome, 'answered',
            'the refusal also tried to redirect, so the response was sent twice and the ' +
            'connection was reset');
    });

    /*
     * The same root cause on the success path. valid_request calls back asynchronously for a
     * launch that passes, so the redirect to "/" is already on the wire before req.session.lti
     * exists. A client that follows the redirect immediately can arrive with no lti object in
     * the session, which is what routes/index.js reads to decide whether it has a user, so the
     * launch would be sent into the OAuth flow for no reason.
     */
    /*
     * Marked todo rather than failing, so the suite stays usable as a baseline for the module
     * upgrade. Turn it into a plain test the moment handleLaunch stops redirecting outside the
     * validation callback; the fix is to move `return res.redirect(page)` into the success
     * branch of valid_request.
     */
    await t.test('a refused launch does not throw after answering',
        { todo: 'handleLaunch redirects outside the valid_request callback (src/lti/canvas.js:138)' },
        async () => {
            errors.length = 0;

            await launch(payloadFor({}, 'wrong-secret'));
            await new Promise((r) => setTimeout(r, 100));

            assert.deepEqual(errors.map((error) => error.code), [],
                'answering 500 and then redirecting throws ERR_HTTP_HEADERS_SENT on every ' +
                'forged or misconfigured launch');
        });

    await t.test('the session carries the launch before the redirect is answered', async () => {
        const { setCookie } = await launch(payloadFor({}));

        assert.ok(setCookie, 'a valid launch should establish a session');

        /* Deliberately no delay: this is the client following the redirect at once. */
        const { body } = await request(port, '/probe', 'GET', {}, null, setCookie.split(';')[0]);

        assert.notEqual(JSON.parse(body).lti, null,
            'the redirect was sent before the launch was written to the session');
    });
});
