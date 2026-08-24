/*
 * Which paths are behind the token and LTI session check.
 *
 * A page that does not match one of these patterns is served with no user in the session, so a
 * pattern that silently stops matching does not fail — it exposes an endpoint. That makes this
 * the one routing detail worth asserting rather than reading.
 *
 * The patterns come from the application, not from a copy here, and are mounted on a real router
 * so the path matcher itself is what answers. Wildcard syntax is a property of the router
 * library and changes between its major versions, which is what this stands under.
 */
'use strict';

const sandbox = require('./helpers/sandbox');

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const express = require('express');

process.env.AUTH_HOST = 'https://canvas.example.se';
process.env.AUTH_REDIRECT_CALLBACK = 'https://tool.example.se/callback';

const { guardedPaths } = require('../src/routes');

const get = (port, path) => new Promise((resolve, reject) => {
    const call = http.request({ host: '127.0.0.1', port, path, method: 'GET', agent: false },
        (response) => {
            let body = '';

            response.setEncoding('utf8');
            response.on('data', (chunk) => { body += chunk; });
            response.on('end', () => resolve(body));
        });

    call.on('error', reject);
    call.end();
});

/* The real patterns, in front of a handler that only says whether they matched. */
const appWithGuard = () => {
    const app = express();

    app.all(guardedPaths, (req, res) => res.send('guarded'));
    app.use((req, res) => res.send('open'));

    return app;
};

test('the paths behind the session check', async (t) => {
    const server = appWithGuard().listen(0);

    await new Promise((r) => server.on('listening', r));

    t.after(() => {
        server.close();
        sandbox.cleanup();
    });

    const port = server.address().port;
    const guards = async (path) => assert.equal(await get(port, path), 'guarded', path + ' must be guarded');

    await t.test('the pages a user reaches directly', async () => {
        await guards('/');
        await guards('/reservations');
        await guards('/privacy');
        await guards('/debug');
    });

    await t.test('the administration root and everything under it', async () => {
        /* The root is listed separately because a named wildcard segment matches one or more
           segments, not zero, so a prefix pattern alone would leave the root unguarded. */
        await guards('/admin');
        await guards('/admin/canvas');
        await guards('/admin/course');
        await guards('/admin/exports');
        await guards('/admin/exports/csv/group-reservations/12');
    });

    await t.test('every api endpoint, at any depth', async () => {
        await guards('/api/courses');
        await guards('/api/admin/course');
        await guards('/api/instructor/slot/12/messages');
        await guards('/api/admin/exports/csv/group-reservations/12');
    });

    await t.test('a path outside the list is not guarded, so the list is doing the work', async () => {
        /* Without this the test would pass just as well if everything matched everything. */
        assert.equal(await get(port, '/assets/style.css'), 'open');
        assert.equal(await get(port, '/callback'), 'open');
    });
});
