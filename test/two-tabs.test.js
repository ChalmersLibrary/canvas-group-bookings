/*
 * Two placements, two tabs, one session -- the bug this whole change exists for.
 *
 * Open the tool for course A, then for course B, go back to the first tab and click something: it
 * used to show and change course B, because one session held one launch and the last one won. This
 * file drives exactly that, over HTTP, in one process: two properly signed launches on one session
 * cookie, and then a request naming each key.
 *
 * It is here because of a reasonable assumption that turned out to be wrong -- that two contexts
 * could only be tested in Canvas, since a developer machine has one mock launch and therefore one
 * context. A mocked launch is not the only way in: the launch endpoint takes a signed launch from
 * anything that can sign one, which is what test/helpers/lti.js does. So the defect is testable
 * here, deterministically, with no Canvas and no database, and it did not need a deploy to answer.
 *
 * What this cannot cover is the part that genuinely needs Canvas: whether the cookie survives in a
 * real cross-site iframe, which is a browser policy question rather than an application one.
 */
'use strict';

/* Must come first: chdir into a temp directory before the logging module resolves './logs'. */
const sandbox = require('./helpers/sandbox');

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

const CONSUMER = 'testconsumer';
const SECRET = 's3cret';

process.env.LTI_KEYS = `${CONSUMER}:${SECRET}`;
/* Not development, so the mock launch plays no part in what is measured here. */
process.env.NODE_ENV = 'test';

const ROOT = path.join(__dirname, '..');

const stubModule = (relative, exports) => {
    const resolved = require.resolve(path.join(ROOT, relative));

    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};

/* Records the arguments every database call was made with, so the course each request acted on is
   visible without a Postgres. */
const calls = [];

stubModule('src/db/index.js', new Proxy({}, {
    get: (target, name) => {
        if (name === 'then') {
            return undefined;
        }

        return (...args) => {
            calls.push({ name: String(name), args });

            if (String(name) === 'getSlot') {
                return Promise.resolve({ id: 9, type: 'group', canvas_course_id: args[1] });
            }

            return Promise.resolve(String(name).startsWith('get') ? {} : undefined);
        };
    }
}));

/*
 * The real checkAccessToken puts the user on the session on both of its paths -- after a refresh
 * and when the token has not expired -- so the stub does too. Without it the role guards read
 * `req.session.user.isInstructor` off undefined, which is a property of the stub rather than of the
 * application.
 */
stubModule('src/auth/oauth2.js', {
    setupAuthEndpoints: () => {},
    checkAccessToken: async (req) => {
        req.session.user = { id: 'user-1', db_id: null, name: 'Test Person', locale: 'en-GB' };

        return { success: true, access_token: 'T', token_type: 'Bearer' };
    }
});

stubModule('src/api/canvas.js', { getCourseGroupsSelfReference: async () => [] });

const express = require('express');
const session = require('express-session');
const i18n = require('../src/lang/i18n.config');
const { signedLaunch } = require('./helpers/lti');

/* Required after the stubs. */
const routes = require('../src/routes');

const request = (port, method, url, { cookie, body, headers = {} } = {}) => new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : body;
    const call = http.request({
        port, host: '127.0.0.1', path: url, method,
        headers: Object.assign({},
            cookie ? { cookie } : {},
            payload !== undefined
                ? { 'content-type': 'application/x-www-form-urlencoded',
                    'content-length': Buffer.byteLength(payload) }
                : {},
            /* ims-lti signs the launch url from the Host header, so it has to match what was
               signed. */
            headers)
    }, (response) => {
        let text = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => { text += chunk; });
        response.on('end', () => resolve({
            status: response.statusCode,
            location: response.headers.location,
            setCookie: (response.headers['set-cookie'] ?? [])[0],
            body: text
        }));
    });

    call.on('error', reject);
    call.end(payload);
});

test('two placements in one session', async (t) => {
    const app = express();

    app.set('view engine', 'ejs');
    app.set('views', path.join(ROOT, 'views'));

    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use(i18n.init);
    app.use((req, res, next) => {
        res.locals.ctxUrl = (url) => url;
        /* The guard reads the roles off the session user, which the real middleware fills from the
           token. Both launches below carry the instructor role. */
        next();
    });

    app.use('/', routes);

    const server = app.listen(0);
    await new Promise((r) => server.on('listening', r));

    const port = server.address().port;
    const launchUrl = `http://127.0.0.1:${port}/lti`;
    const host = `127.0.0.1:${port}`;

    t.after(() => {
        server.close();
        sandbox.cleanup();
    });

    /* A launch for one course, reusing a cookie so both land in the same session. */
    const launch = async (overrides, cookie) => {
        const body = new URLSearchParams(signedLaunch(launchUrl, SECRET, overrides)).toString();
        const answer = await request(port, 'POST', '/lti', { cookie, body, headers: { host } });

        assert.equal(answer.status, 302, 'the launch should be accepted');

        const key = (answer.location.match(/ctx=([0-9a-f]+)/) || [])[1];

        assert.ok(key, 'the redirect should carry the context key: ' + answer.location);

        return { key, cookie: cookie || answer.setCookie.split(';')[0] };
    };

    const courseA = { resource_link_id: 'rl-course-a', context_id: 'ctx-a',
        custom_canvas_course_id: '111', roles: 'Instructor',
        custom_canvas_roles: 'TeacherEnrollment' };
    const courseB = { resource_link_id: 'rl-course-b', context_id: 'ctx-b',
        custom_canvas_course_id: '222', roles: 'Instructor',
        custom_canvas_roles: 'TeacherEnrollment' };

    /* Tab one, then tab two, on one cookie -- which is what two tabs in a browser are. */
    const first = await launch(courseA);
    const second = await launch(courseB, first.cookie);
    const cookie = first.cookie;

    await t.test('the two launches get different keys', () => {
        assert.notEqual(first.key, second.key,
            'two placements must not collapse onto one key, or the session holds one launch again');
    });

    /* The course a request acted on, read from what reached the database. */
    const courseFor = async (key) => {
        calls.length = 0;

        const answer = await request(port, 'GET', '/api/instructor/slot/9', {
            cookie, headers: { 'x-lti-context': key }
        });

        assert.equal(answer.status, 200, 'the request should be served: ' + answer.body);

        const made = calls.find((c) => c.name === 'getSlot');

        assert.ok(made, 'getSlot should have been reached');

        return String(made.args[1]);
    };

    /* The defect, stated: the second launch must not have moved the first tab. */
    await t.test('the first tab still acts in its own course after the second launch', async () => {
        assert.equal(await courseFor(first.key), '111',
            'the tab opened for course 111 must still act on 111, not on the course launched after it');
    });

    await t.test('the second tab acts in its own course', async () => {
        assert.equal(await courseFor(second.key), '222');
    });

    /* And the order does not matter: relaunching the first placement must not disturb the second. */
    await t.test('relaunching the first placement leaves the second alone', async () => {
        const again = await launch(courseA, cookie);

        assert.equal(again.key, first.key, 'a placement keeps its key across a relaunch');
        assert.equal(await courseFor(second.key), '222',
            'the other tab must be untouched by a relaunch elsewhere');
        assert.equal(await courseFor(first.key), '111');
    });

    await t.test('a request naming neither launch is refused', async () => {
        const answer = await request(port, 'GET', '/api/instructor/slot/9', { cookie });

        assert.equal(answer.status, 400,
            'with two launches in the session there is no basis for guessing, and it must not guess');
    });
});
