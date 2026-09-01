/*
 * The OAuth callback, and what it does when the session store answers late or badly.
 *
 * The callback is the one route every user walks that this suite never covered, and it is where
 * the application is at its most fragile: it writes the session and then redirects, so the order
 * of those two decides whether a store failure is reported or fatal. session.save() returns the
 * session rather than a promise, so awaiting it does not wait, and a 500 written after the
 * redirect throws ERR_HTTP_HEADERS_SENT from a store callback -- on a later tick, outside any
 * request, where the only thing left is the uncaughtException handler in app.js, which exits the
 * process. A session store blip would therefore restart the application rather than fail one
 * request.
 *
 * The store here answers asynchronously on purpose. A store that calls back synchronously hides
 * exactly the bug being tested, because the throw then still unwinds into the caller's try.
 */
'use strict';

/* Must come first: moves the process into a temp directory before the logging module resolves its
   relative './logs' path, and before dotenv can find the developer's .env. */
const sandbox = require('./helpers/sandbox');

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

const CANVAS_USER = { id: 4711, global_id: '12523000000004711', name: 'Someone' };

/* Replace a module by its resolved filename, before anything requires it for real. */
const stubModule = (relative, exports) => {
    const resolved = require.resolve(path.join(__dirname, '..', relative));

    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};

const get = (port, path, cookie) => new Promise((resolve, reject) => {
    const req = http.request({ port, host: '127.0.0.1', path, method: 'GET',
        headers: cookie ? { cookie } : {} }, (res) => {
        let body = '';

        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({
            status: res.statusCode,
            location: res.headers.location,
            setCookie: res.headers['set-cookie'],
            body
        }));
    });

    req.on('error', reject);
    req.end();
});

test('the OAuth callback', async (t) => {
    /* Stands in for Canvas answering the token exchange, and can be told to refuse one. */
    let canvasAnswer = {
        status: 200,
        body: {
            access_token: 'ACCESS-TOKEN', token_type: 'Bearer', expires_in: 3600,
            user: CANVAS_USER
        }
    };

    const canvas = http.createServer((req, res) => {
        let body = '';

        req.setEncoding('utf8');
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            res.writeHead(canvasAnswer.status, { 'content-type': 'application/json' });
            res.end(JSON.stringify(canvasAnswer.body));
        });
    });

    canvas.listen(0);
    await new Promise((r) => canvas.on('listening', r));

    /* Set before requiring: the OAuth client is built from these when the module loads. */
    process.env.NODE_ENV = 'production';
    process.env.AUTH_HOST = `http://127.0.0.1:${canvas.address().port}`;
    process.env.AUTH_CLIENT_ID = 'client-id';
    process.env.AUTH_CLIENT_SECRET = 'client-secret';
    delete process.env.USERID_PREFIX_FORCE_GLOBAL_ID;

    stubModule('src/db', { query: async () => ({ rowCount: 1, rows: [] }) });

    stubModule('src/user', {
        createSessionUserdataFromToken: async (req) => {
            req.session.user = { id: CANVAS_USER.id, name: CANVAS_USER.name };

            return req.session.user;
        },
        mockLtiSession: async () => {},
        addUserFlagsForRoles: async () => {}
    });

    const express = require('express');
    const session = require('express-session');
    const auth = require('../src/auth/oauth2');

    /*
     * A store that answers on a later tick, as a real one does, and can be told to fail. Anything
     * that calls back synchronously is useless here: the throw this file exists to catch would
     * unwind into the calling try instead of reaching the process.
     */
    class LateStore extends session.Store {
        constructor() {
            super();
            this.sessions = new Map();
            this.failSet = false;
        }

        get(sid, callback) {
            setImmediate(() => callback(null, this.sessions.get(sid) ?? null));
        }

        set(sid, value, callback) {
            setImmediate(() => {
                if (this.failSet) {
                    return callback(new Error('session store is down'));
                }

                this.sessions.set(sid, value);

                return callback(null);
            });
        }

        destroy(sid, callback) {
            setImmediate(() => {
                this.sessions.delete(sid);

                return callback(null);
            });
        }
    }

    const store = new LateStore();
    const app = express();

    app.use(session({ store, secret: 'test-secret', resave: false, saveUninitialized: false }));

    const server = app.listen(0);
    await new Promise((r) => server.on('listening', r));

    const port = server.address().port;

    auth.setupAuthEndpoints(app, `http://127.0.0.1:${port}/callback`);

    /* Anything uncaught is the failure this file is about, so it is recorded rather than left to
       take the test runner with it. */
    const uncaught = [];
    const onUncaught = (err) => uncaught.push(err);

    process.on('uncaughtException', onUncaught);

    t.after(() => {
        process.removeListener('uncaughtException', onUncaught);
        server.close();
        canvas.close();
        sandbox.cleanup();
    });

    /* Long enough for a store callback on a later tick to have run, and for anything it throws to
       have reached the process. */
    const settle = () => new Promise((r) => setTimeout(r, 50));

    await t.test('a completed authorization redirects back into the application', async () => {
        store.failSet = false;
        uncaught.length = 0;

        const { status, location, setCookie } = await get(port, '/callback?code=the-code');

        assert.equal(status, 302, 'the callback should redirect');
        assert.equal(location, '/?from=callback');
        assert.ok(setCookie, 'the session the callback wrote must reach the browser');

        await settle();

        assert.deepEqual(uncaught, [], 'nothing should be thrown outside a request');
    });

    await t.test('the redirect waits for the session to be written', async () => {
        store.failSet = false;

        const writes = [];
        const set = store.set.bind(store);

        store.set = (sid, value, callback) => set(sid, value, () => {
            writes.push(sid);
            callback(null);
        });

        try {
            await get(port, '/callback?code=the-code');

            assert.equal(writes.length > 0, true,
                'the session must be persisted before the browser is sent to the next request');
        }
        finally {
            store.set = set;
        }
    });

    /*
     * The point of the file. A failing store must produce one answer and no exception: before the
     * fix the redirect had already gone, so this callback's 500 raised ERR_HTTP_HEADERS_SENT on a
     * later tick and app.js turned that into process.exit(1).
     */
    await t.test('a session store failure is reported, not fatal', async () => {
        store.failSet = true;
        uncaught.length = 0;

        try {
            const { status, location } = await get(port, '/callback?code=the-code');

            assert.equal(status, 500, 'a session that cannot be stored must not redirect');
            assert.equal(location, undefined, 'the redirect must not also be sent');

            await settle();

            assert.deepEqual(uncaught.map((e) => e.code ?? e.message), [],
                'a store failure must not throw outside a request, which would exit the process');
        }
        finally {
            store.failSet = false;
        }
    });

    /*
     * A refused exchange is the other way this route ends. It used to answer 500 and then redirect
     * anyway, because the redirect sat outside the try, so this asserts the single answer as much
     * as the status.
     */
    await t.test('a refused token exchange answers once and does not redirect', async () => {
        uncaught.length = 0;
        canvasAnswer = { status: 400, body: { error: 'invalid_grant' } };

        try {
            const { status, location } = await get(port, '/callback?code=stale-code');

            assert.equal(status, 500, 'a refused exchange must not be reported as success');
            assert.equal(location, undefined, 'the redirect must not be sent as well');

            await settle();

            assert.deepEqual(uncaught, [], 'nothing should be thrown outside a request');
        }
        finally {
            canvasAnswer = {
                status: 200,
                body: {
                    access_token: 'ACCESS-TOKEN', token_type: 'Bearer', expires_in: 3600,
                    user: CANVAS_USER
                }
            };
        }
    });

    /* The error the browser gets must not carry the provider's response back to it. */
    await t.test('a refused exchange does not return the provider payload', async () => {
        canvasAnswer = { status: 400, body: { error: 'invalid_grant', error_description: 'secret detail' } };

        try {
            const { body } = await get(port, '/callback?code=stale-code');

            assert.equal(body.includes('secret detail'), false,
                'the provider payload must not reach the browser');
        }
        finally {
            canvasAnswer = {
                status: 200,
                body: {
                    access_token: 'ACCESS-TOKEN', token_type: 'Bearer', expires_in: 3600,
                    user: CANVAS_USER
                }
            };
        }
    });
});
