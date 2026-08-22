/*
 * A refresh token is a long-lived credential granting full Canvas API access as that user, so
 * it must never reach a log. src/auth/oauth2.js hands whole token objects to the log in four
 * places; three are log.debug and are filtered out in production, but the catch in
 * persistAccessToken is log.error and is not.
 *
 * This exercises the real logging module rather than a stand-in, so it asserts what would
 * actually have been written to combined-*.log. persistAccessToken itself cannot be called
 * here: it requires src/db, which opens a Postgres pool against PGHOST when required.
 */
'use strict';

/* Must come first: moves the process into a temp directory before the logging module resolves
   its relative './logs' path, and before dotenv can find the developer's .env. */
const sandbox = require('./helpers/sandbox');

const test = require('node:test');
const assert = require('node:assert/strict');

/* Set before requiring the logging module: it reads NODE_ENV once, when it builds the logger. */
process.env.NODE_ENV = 'production';

const log = require('../src/logging');

/* Shaped like a Canvas token response. The marker values are what must not appear. */
const REFRESH = 'REFRESH-TOKEN-MUST-NOT-BE-LOGGED';
const ACCESS = 'ACCESS-TOKEN-MUST-NOT-BE-LOGGED';

const token = {
    access_token: ACCESS,
    refresh_token: REFRESH,
    token_type: 'Bearer',
    expires_in: 3600,
    user: { id: 4711, global_id: '125230000000000123' }
};

/* Winston writes through a stream, so give it a moment to reach the file. */
const flushed = async () => {
    await new Promise((r) => setTimeout(r, 250));

    return sandbox.logLines().join('\n');
};

test('what the log does with a token', async (t) => {
    t.after(() => sandbox.cleanup());

    await t.test('debug is suppressed in production, so the debug-level dumps are inert', async () => {
        await log.debug('token at debug level: ' + JSON.stringify(token));

        const written = await flushed();

        assert.equal(written.includes(REFRESH), false,
            'log.debug must not reach a transport when NODE_ENV=production');
        assert.equal(written.includes('token at debug level'), false,
            'the debug message itself should not have been written either');
    });

    /*
     * error level is not filtered by NODE_ENV, so this is the one that could reach a production
     * log file. The redaction lives in src/logging rather than only at the call site, because the
     * same shape appears in refreshAccessToken and in src/api/canvas.js.
     */
    await t.test('error level does not write a token passed as meta', async () => {
        await log.error('Persisting access token', token, new Error('database unavailable'));

        const written = await flushed();

        assert.equal(written.includes(REFRESH), false,
            'the refresh token reached combined-*.log at error level');
        assert.equal(written.includes(ACCESS), false, 'the access token reached it too');
    });

    /*
     * The same call used to discard what it was meant to report: log.error(msg, ...meta) spreads
     * the arguments, so an Error became {} for lack of enumerable own properties, while the
     * credential beside it was kept in full.
     */
    await t.test('an Error passed as meta keeps its message', async () => {
        await log.error('Persisting access token', token, new Error('database unavailable'));

        const written = await flushed();

        assert.ok(written.includes('database unavailable'),
            'the reason for the failure was lost');
    });

    /* A token stringified into the message is not reachable by key, so the text is scrubbed. */
    await t.test('a token stringified into the message is redacted', async () => {
        await log.error('the whole token: ' + JSON.stringify(token));

        const written = await flushed();

        assert.equal(written.includes(REFRESH), false,
            'a token embedded in the message string was written verbatim');
        assert.ok(written.includes('[redacted]'), 'the redaction should be visible in its place');
    });

    /* A fingerprint is what a human needs to see whether a refresh token changed, and Canvas
       does not rotate them, so it should be stable for the same value and differ for another. */
    await t.test('the fingerprint identifies a token without disclosing it', async () => {
        const printed = log.fingerprint(REFRESH);

        assert.equal(printed.includes(REFRESH), false, 'the fingerprint contains the value');
        assert.match(printed, /^sha256:[0-9a-f]{12} len=\d+$/);
        assert.equal(printed, log.fingerprint(REFRESH), 'the same value should print the same');
        assert.notEqual(printed, log.fingerprint(ACCESS), 'a different value should differ');
    });

    /* An error code is not a credential, and fingerprinting it would throw away the diagnosis. */
    await t.test('an error code is left readable', async () => {
        const failure = new Error('connection reset');

        failure.code = 'ECONNRESET';

        await log.error('api call failed', failure);

        const written = await flushed();

        assert.ok(written.includes('ECONNRESET'), 'the error code was redacted or dropped');
    });
});
