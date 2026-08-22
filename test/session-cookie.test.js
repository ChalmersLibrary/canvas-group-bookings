/*
 * The session cookie for an iframed LTI tool is always a third-party cookie, so it needs
 * SameSite=None, which browsers only accept with Secure, which express-session will only put on a
 * connection it considers https. Browsers additionally restrict third-party cookies unless they
 * are Partitioned, and a cookie that is not stored means no session at all.
 *
 * `partitioned` arrived in express-session 1.18.0 and package.json permits older, so the range
 * allows a version that silently drops it. This asserts the attribute actually reaches the
 * header, which is the part that matters and the part a dependency bump could take away.
 *
 * The options are built the same way app.js builds them, rather than by requiring app.js, which
 * listens at module level and opens a Postgres pool.
 */
'use strict';

const sandbox = require('./helpers/sandbox');

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.NODE_ENV = 'production';

const express = require('express');
const session = require('express-session');

const COOKIE_NAME = 'LTI_TEST_SID';

const get = (port, headers) => new Promise((resolve, reject) => {
    const call = http.request({
        host: '127.0.0.1',
        port,
        path: '/',
        method: 'GET',
        agent: false,
        headers
    }, (response) => {
        response.resume();
        response.on('end', () => resolve({
            status: response.statusCode,
            setCookie: (response.headers['set-cookie'] ?? [])[0]
        }));
    });

    call.on('error', reject);
    call.end();
});

/* Mirrors the production branch of app.js. */
const appWith = (production) => {
    const app = express();
    const options = {
        name: COOKIE_NAME,
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 3600000 }
    };

    if (production) {
        app.set('trust proxy', 1);
        options.cookie.secure = true;
        options.cookie.sameSite = 'none';
        options.cookie.partitioned = true;
    }

    app.use(session(options));
    app.get('/', (req, res) => {
        req.session.touched = true;

        return res.send('ok');
    });

    return app;
};

const listen = async (app) => {
    const server = app.listen(0);

    await new Promise((r) => server.on('listening', r));

    return server;
};

test('the session cookie an iframed launch needs', async (t) => {
    t.after(() => sandbox.cleanup());

    await t.test('over https it is Secure, SameSite=None and Partitioned', async () => {
        const server = await listen(appWith(true));

        t.after(() => server.close());

        const { setCookie } = await get(server.address().port, {
            host: 'booking.example.com',
            'x-forwarded-proto': 'https'
        });

        assert.ok(setCookie, 'a session cookie should have been set');
        assert.match(setCookie, /;\s*Secure/i, setCookie);
        assert.match(setCookie, /;\s*SameSite=None/i, setCookie);
        assert.match(setCookie, /;\s*Partitioned/i,
            'Partitioned is missing: the installed express-session may predate 1.18.0, and the ' +
            'cookie will not be stored by a browser restricting third-party cookies. Got: ' +
            setCookie);
    });

    /* The consequence of Secure, and the reason developing against a real Canvas needs a tunnel:
       no cookie setting works around it. */
    await t.test('over plain http no cookie is sent at all', async () => {
        const server = await listen(appWith(true));

        t.after(() => server.close());

        const { setCookie } = await get(server.address().port, { host: 'booking.example.com' });

        assert.equal(setCookie, undefined,
            `express-session must not put a Secure cookie on a plain http connection, got: ${setCookie}`);
    });

    await t.test('outside production the cookie is unrestricted, so local http works', async () => {
        const server = await listen(appWith(false));

        t.after(() => server.close());

        const { setCookie } = await get(server.address().port, { host: '127.0.0.1' });

        assert.ok(setCookie, 'a development cookie should be set over http');
        assert.doesNotMatch(setCookie, /;\s*Secure/i, setCookie);
    });
});
