/*
 * What happens to a request that does not say which course it is for.
 *
 * This is the property the whole context key rests on. The launch used to live in one field of the
 * session, so every request had an answer available whether or not it named one -- the most recent
 * launch -- and a page link or a client call site that carried nothing still worked, silently, in
 * whatever course was launched last. There is no such fallback now: a guarded request with no key,
 * or with a key this session never held, is refused.
 *
 * That refusal is also what makes the change safe to make in one pass. A link or a call site that
 * was missed fails on the first click, visibly, rather than acting on another course.
 *
 * The database and the OAuth client are replaced: the refusal happens before either is consulted,
 * which is itself worth asserting, and requiring them for real reaches a live Postgres.
 */
'use strict';

/* Must come first: moves the process into a temp directory before the logging module resolves its
   relative './logs' path, and before dotenv can find the developer's .env. Also why no mock-lti
   file is found here, so the development fallback that registers a mocked launch stays out of the
   way of what this file is about. */
const sandbox = require('./helpers/sandbox');

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const stubModule = (relative, exports) => {
    const resolved = require.resolve(path.join(ROOT, relative));

    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};

/* Records whether anything reached the database, which for a refused request must be nothing. */
const queries = [];

stubModule('src/db/index.js', new Proxy({}, {
    get: (target, name) => {
        if (name === 'then') {
            return undefined;
        }

        return (...args) => {
            queries.push(String(name));

            return Promise.resolve(undefined);
        };
    }
}));

/* A token is always available, so nothing here is refused for want of one. */
const tokenChecks = [];

stubModule('src/auth/oauth2.js', {
    setupAuthEndpoints: () => {},
    checkAccessToken: async (req, lti) => {
        tokenChecks.push(lti);

        return { success: true, access_token: 'ACCESS-TOKEN', token_type: 'Bearer' };
    }
});

stubModule('src/api/canvas.js', { getCourseGroupsSelfReference: async () => [] });

const express = require('express');
const session = require('express-session');
const i18n = require('../src/lang/i18n.config');

/* Required after the stubs. */
const routes = require('../src/routes');
const context = require('../src/lti/context');

const get = (port, url, cookie) => new Promise((resolve, reject) => {
    const call = http.request({ port, host: '127.0.0.1', path: url, method: 'GET',
        headers: cookie ? { cookie } : {} }, (response) => {
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
    call.end();
});

test('a request that names no course', async (t) => {
    const app = express();

    app.set('view engine', 'ejs');
    app.set('views', path.join(ROOT, 'views'));

    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use(i18n.init);

    /* The error pages call ctxUrl, as every page does, and render without a launch. */
    app.use((req, res, next) => {
        res.locals.ctxUrl = (url) => url;

        next();
    });

    /* Plants a launch so a session exists with a key that can be named, or withheld. */
    app.get('/plant', (req, res) => {
        const key = context.store(req, {
            resource_link_id: 'resource-link-1',
            custom_canvas_course_id: '123',
            context_id: 'ctx-1',
            custom_canvas_roles: 'TeacherEnrollment',
            launch_presentation_locale: 'en'
        });

        /* createSessionUserdataFromToken always sets a locale from the token, and the locale
           chain below ends there. */
        req.session.user = { id: 'user-1', locale: 'en-GB' };

        return req.session.save(() => res.json({ key }));
    });

    app.use('/', routes);

    const server = app.listen(0);
    await new Promise((r) => server.on('listening', r));

    const port = server.address().port;

    t.after(() => {
        server.close();
        sandbox.cleanup();
    });

    const planted = async () => {
        const { setCookie, body } = await get(port, '/plant');

        return { cookie: setCookie.split(';')[0], key: JSON.parse(body).key };
    };

    await t.test('an api call with no key is refused, and does not reach the database', async () => {
        const { cookie } = await planted();

        queries.length = 0;

        const { status, body } = await get(port, '/api/instructor/slot/99', cookie);

        assert.equal(status, 400);
        assert.equal(JSON.parse(body).success, false,
            'an api call must be told, in the shape its caller already handles');
        assert.deepEqual(queries, [], 'the refusal must come before any query');
    });

    await t.test('an api call naming a launch this session never made is refused', async () => {
        const { cookie } = await planted();

        const { status, body } = await get(port, '/api/instructor/slot/99?ctx=not-a-real-key', cookie);

        assert.equal(status, 400);
        assert.equal(JSON.parse(body).success, false);
    });

    await t.test('a page with no key gets a page saying so, not a wrong course', async () => {
        const { cookie } = await planted();

        const { status, body } = await get(port, '/', cookie);

        assert.equal(status, 200, 'a person gets a page rather than a status code');
        assert.match(body, /which course/i,
            'the page has to say what is wrong, since the remedy is to launch the tool again');
    });

    await t.test('an api call carrying the key in a header is served', async () => {
        const { cookie, key } = await planted();

        const call = await new Promise((resolve, reject) => {
            const request = http.request({ port, host: '127.0.0.1', path: '/api/instructor/slot/99',
                method: 'GET', headers: { cookie, 'x-lti-context': key } }, (response) => {
                let body = '';

                response.setEncoding('utf8');
                response.on('data', (chunk) => { body += chunk; });
                response.on('end', () => resolve({ status: response.statusCode, body }));
            });

            request.on('error', reject);
            request.end();
        });

        assert.notEqual(call.status, 400,
            'a call that names its launch must not be refused for not naming one');
    });

    /* The token is looked up for the user in the launch the request names, so two tabs cannot end
       up acting as each other's user either. */
    await t.test('the token check is given the launch the request names', async () => {
        const { cookie, key } = await planted();

        tokenChecks.length = 0;

        await get(port, `/?ctx=${key}`, cookie);

        assert.equal(tokenChecks.length, 1);
        assert.equal(tokenChecks[0].custom_canvas_course_id, '123');
    });
});
