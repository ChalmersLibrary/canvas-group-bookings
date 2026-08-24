/*
 * The line written when something is changed through the api.
 *
 * A write through these endpoints acts on a course resolved from the session, and a session is
 * shared across a browser's tabs, so a write can land on a course the operator was not looking at.
 * Nothing else records which course it was, which makes this line the only way to tell afterwards
 * what a change actually applied to.
 *
 * It is therefore worth asserting that it is written at a level that survives production, that it
 * names the course, and that it carries no request body — instructor records hold names and email
 * addresses.
 */
'use strict';

const sandbox = require('./helpers/sandbox');

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.NODE_ENV = 'production';

const express = require('express');
const { logWrites } = require('../src/routes/api/write-log');

const PERSONAL = 'Nobody Personal';

const call = (port, method, path, body) => new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, path, method, agent: false,
        headers: body ? { 'content-type': 'application/json' } : {} }, (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode));
    });

    request.on('error', reject);
    request.end(body ? JSON.stringify(body) : undefined);
});

const appWithWriteLog = (user) => {
    const app = express();

    app.use(express.json());
    app.use((req, res, next) => {
        req.session = { user };
        res.locals.courseId = '4711';

        next();
    });
    app.use('/api/admin', logWrites('admin'));
    app.all('/api/admin/course/:id', (req, res) => res.send({ success: true }));
    app.all('/api/admin/segment', (req, res) => res.status(500).send({ success: false }));

    return app;
};

/* Lines land in the sandbox's own log directory, so reading them back reads what was written. */
const written = () => sandbox.logLines().map((line) => JSON.parse(line));

/* The logging module puts the detail of a call under one key, the same value the wire carries. */
const detailOf = (entry) => entry.data;

test('the write log', async (t) => {
    const server = appWithWriteLog({ id: 8822, isAdministrator: true, isInstructor: false }).listen(0);

    await new Promise((r) => server.on('listening', r));

    const port = server.address().port;

    t.after(() => server.close());

    /* winston writes asynchronously, so give the transport a moment before reading the file. */
    const settle = () => new Promise((r) => setTimeout(r, 120));

    await t.test('a read writes nothing, since nothing changed', async () => {
        await call(port, 'GET', '/api/admin/course/1');
        await settle();

        assert.equal(written().length, 0);
    });

    await t.test('a write names the course, the user and the endpoint', async () => {
        await call(port, 'PUT', '/api/admin/course/1', { name: PERSONAL });
        await settle();

        const entry = written().at(-1);
        const detail = detailOf(entry);

        assert.equal(entry.level, 'info', 'must survive NODE_ENV=production');
        assert.match(entry.message, /course 4711/);
        assert.equal(detail.course_id, '4711');
        assert.equal(detail.canvas_user_id, 8822);
        assert.equal(detail.method, 'PUT');
        assert.equal(detail.path, '/api/admin/course/1');
        assert.equal(detail.administrator, true);
        assert.equal(detail.status, 200);
    });

    await t.test('the request body is not written, whatever it held', async () => {
        const all = JSON.stringify(written());

        assert.equal(all.includes(PERSONAL), false);
    });

    await t.test('a failed write is recorded with the status the client got', async () => {
        await call(port, 'POST', '/api/admin/segment', {});
        await settle();

        const detail = detailOf(written().at(-1));

        assert.equal(detail.status, 500);
        assert.equal(detail.method, 'POST');
    });
});

test('a write attempted without the role', async (t) => {
    const server = appWithWriteLog({ id: 9911, isAdministrator: false, isInstructor: false }).listen(0);

    await new Promise((r) => server.on('listening', r));

    t.after(() => server.close());

    await t.test('is recorded, and says the role was not held', async () => {
        /* The middleware sits in front of the role check so this is visible at all. A refusal is
           answered with a 200 carrying success:false, so the status cannot say it and the flag
           has to. */
        await call(server.address().port, 'DELETE', '/api/admin/course/9');
        await new Promise((r) => setTimeout(r, 120));

        const detail = detailOf(written().at(-1));

        assert.equal(detail.administrator, false);
        assert.equal(detail.canvas_user_id, 9911);
        assert.equal(detail.method, 'DELETE');
    });
});
