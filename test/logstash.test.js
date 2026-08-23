/*
 * What actually reaches logstash. This matters because logstash is the only log destination that
 * can be role-correct: a file written by the application travels with the content when Azure swaps
 * a deployment slot, so file logs alternate between slots on every deploy and cannot describe
 * which role wrote them.
 *
 * A real http server stands in for logstash, so this exercises the transport rather than a stub,
 * and asserts what would be on the wire.
 */
'use strict';

/* Must come first: moves the process into a temp directory before the logging module resolves its
   relative './logs' path, and before dotenv can find the developer's .env. */
const sandbox = require('./helpers/sandbox');

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const REFRESH = 'REFRESH-TOKEN-MUST-NOT-BE-SHIPPED';

test('what reaches logstash', async (t) => {
    const received = [];

    const server = http.createServer((req, res) => {
        let body = '';

        req.setEncoding('utf8');
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            received.push({ auth: req.headers.authorization, body: JSON.parse(body) });
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end('{}');
        });
    });

    server.listen(0);
    await new Promise((r) => server.on('listening', r));

    /* Set before requiring: the logger builds its logstash client when the module loads. */
    process.env.NODE_ENV = 'production';
    process.env.LOGSTASH_BASEURL = `http://127.0.0.1:${server.address().port}/`;
    process.env.LOGSTASH_USER = 'user';
    process.env.LOGSTASH_PWD = 'pass';
    process.env.LOGSTASH_SOURCE = 'booking-test';

    const log = require('../src/logging');

    t.after(() => {
        server.close();
        sandbox.cleanup();
    });

    const settle = () => new Promise((r) => setTimeout(r, 150));

    await t.test('a message with no detail sends the flat shape and no Data key', async () => {
        received.length = 0;

        await log.info('Application listening on port 3000.');
        await settle();

        assert.equal(received.length, 1);

        const { body } = received[0];

        assert.equal(body.Type, 'Info');
        assert.equal(body.Source, 'booking-test');
        assert.equal(body.Message, 'Application listening on port 3000.');
        assert.equal('Data' in body, false,
            'a call with no detail must send exactly what it always sent');
        assert.ok(body.Time, 'a timestamp should be present');
    });

    await t.test('an Error beside a message arrives as structure, not as prose', async () => {
        received.length = 0;

        const failure = new Error('connect ECONNREFUSED');

        failure.code = 'ECONNREFUSED';

        await log.error('Persisting access token failed for user 4711', failure);
        await settle();

        assert.equal(received.length, 1);

        const { body } = received[0];

        assert.equal(body.Type, 'Error');
        assert.equal(body.Message, 'Persisting access token failed for user 4711');
        assert.equal(body.Data.message, 'connect ECONNREFUSED',
            'the reason for the failure should reach logstash, not only the file log');
        assert.equal(body.Data.code, 'ECONNREFUSED');
        assert.ok(body.Data.stack, 'the stack should come with it');
    });

    await t.test('several detail arguments arrive as a list', async () => {
        received.length = 0;

        await log.error('two things', { first: 1 }, { second: 2 });
        await settle();

        assert.ok(Array.isArray(received[0].body.Data), 'more than one should be a list');
        assert.equal(received[0].body.Data.length, 2);
    });

    /* The whole point of the redaction living in the log module rather than at each call site. */
    await t.test('a credential is redacted before it goes over the wire', async () => {
        received.length = 0;

        await log.error('token trouble', {
            access_token: 'ACCESS',
            refresh_token: REFRESH,
            user: { id: 4711 }
        });
        await settle();

        const raw = JSON.stringify(received[0].body);

        assert.equal(raw.includes(REFRESH), false, 'the refresh token was shipped to logstash');
        assert.match(received[0].body.Data.refresh_token, /^sha256:/,
            'it should be a fingerprint, so two entries can still be compared');
        assert.equal(received[0].body.Data.user.id, 4711, 'the rest should survive');
    });

    await t.test('the request is authenticated', async () => {
        received.length = 0;

        await log.info('anything');
        await settle();

        assert.match(received[0].auth, /^Basic /);
        assert.equal(Buffer.from(received[0].auth.slice(6), 'base64').toString(), 'user:pass');
    });

    /* debug is filtered by level in the file log; shipping it here would bypass that filter. */
    await t.test('debug is not shipped', async () => {
        received.length = 0;

        await log.debug('a debug line', { some: 'detail' });
        await settle();

        assert.equal(received.length, 0, 'debug must not reach logstash');
    });
});
