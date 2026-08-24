/*
 * What the OAuth client does with a stored token: when it refreshes, what it sends, and what it
 * writes back.
 *
 * This exists to stand under a major version change of the OAuth library. Everything asserted
 * here is behaviour the application depends on but does not implement itself — expiry is judged
 * inside the library against the stored token, and the refresh request is built by it — so a
 * change in any of it would be silent, and the symptom would be users losing their grants.
 *
 * The most important assertion is that the refresh token survives a refresh. Canvas does not
 * return one, the stored one has to be re-attached by hand afterwards, and if that is ever lost
 * every user is sent back through an authorization they have already given.
 *
 * A stand-in http server plays Canvas, so the library's own request path is exercised rather than
 * stubbed. The database and the session-user modules are replaced, because requiring the module
 * under test otherwise reaches a real Postgres.
 */
'use strict';

/* Must come first: moves the process into a temp directory before the logging module resolves its
   relative './logs' path, and before dotenv can find the developer's .env. */
const sandbox = require('./helpers/sandbox');

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

const REFRESH = 'THE-STORED-REFRESH-TOKEN';

/*
 * Canvas returns the user alongside the token, on the authorization exchange and on a refresh
 * alike, and the application reads it without checking: it is how the row is keyed. A response
 * shaped without it raises a TypeError inside a promise chain rather than failing cleanly, so the
 * fixture carries it and the last test in this file states the requirement outright. If a library
 * change ever stops mapping it through, that test is what says so.
 */
const CANVAS_USER = { id: 4711, global_id: '12523000000004711', name: 'Someone' };

/* Replace a module by its resolved filename, before anything requires it for real. */
const stubModule = (relative, exports) => {
    const resolved = require.resolve(path.join(__dirname, '..', relative));

    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};

/* A token as the application stores it: whole, with the expiry the library will judge. */
const storedToken = (expiresAt) => ({
    access_token: 'ACCESS-BEFORE',
    refresh_token: REFRESH,
    token_type: 'Bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    user: CANVAS_USER
});

const hour = 3600 * 1000;

test('the stored OAuth token', async (t) => {
    const requests = [];
    let answer = { status: 200, body: { access_token: 'ACCESS-AFTER', token_type: 'Bearer', expires_in: 3600, user: CANVAS_USER } };

    const canvas = http.createServer((req, res) => {
        let body = '';

        req.setEncoding('utf8');
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            requests.push({ url: req.url, body });
            res.writeHead(answer.status, { 'content-type': 'application/json' });
            res.end(JSON.stringify(answer.body));
        });
    });

    canvas.listen(0);
    await new Promise((r) => canvas.on('listening', r));

    /* Set before requiring: the client is built from these when the module loads. */
    process.env.NODE_ENV = 'production';
    process.env.AUTH_HOST = `http://127.0.0.1:${canvas.address().port}`;
    process.env.AUTH_CLIENT_ID = 'client-id';
    process.env.AUTH_CLIENT_SECRET = 'client-secret';
    delete process.env.USERID_PREFIX_FORCE_GLOBAL_ID;

    let stored;
    const queries = [];

    stubModule('src/db', {
        query: async (text, params) => {
            queries.push({ text, params });

            if (text.startsWith('SELECT data FROM user_token')) {
                return { rows: stored ? [{ data: stored }] : [] };
            }

            if (text.startsWith('INSERT INTO user_token')) {
                stored = params[3];

                return { rowCount: 1 };
            }

            return { rows: [] };
        }
    });

    stubModule('src/user', {
        createSessionUserdataFromToken: async () => ({}),
        mockLtiSession: async () => {},
        addUserFlagsForRoles: async () => {}
    });

    const auth = require('../src/auth/oauth2');

    t.after(() => canvas.close());

    const request = () => ({ session: { lti: { custom_canvas_user_id: 4711 }, save: (cb) => cb(null) } });

    await t.test('a token that has not expired is used without asking Canvas', async () => {
        stored = storedToken(new Date(Date.now() + hour).toISOString());
        requests.length = 0;

        const result = await auth.checkAccessToken(request());

        assert.equal(result.success, true);
        assert.equal(result.access_token, 'ACCESS-BEFORE');
        assert.equal(requests.length, 0, 'no request should reach Canvas for a live token');
    });

    await t.test('expiry is judged from the stored timestamp, not from when the row was read', async () => {
        /* The whole re-keying of tokens across a hostname change rested on this: a token stored
           long ago must present as expired rather than as freshly issued. */
        stored = storedToken(new Date(Date.now() - hour).toISOString());
        requests.length = 0;

        await auth.checkAccessToken(request());

        assert.equal(requests.length, 1, 'an expired token should be refreshed');
        assert.match(requests[0].url, /\/login\/oauth2\/token/);
    });

    await t.test('the refresh asks for a refresh and offers the stored token', async () => {
        stored = storedToken(new Date(Date.now() - hour).toISOString());
        requests.length = 0;

        await auth.checkAccessToken(request());

        const sent = requests[0].body;

        assert.match(sent, /grant_type=refresh_token/);
        assert.match(sent, new RegExp(REFRESH));
    });

    await t.test('the refresh token survives a refresh that does not return one', async () => {
        /* Canvas reuses the refresh token and answers without it. Losing it here would cost every
           user the grant they have already given. */
        stored = storedToken(new Date(Date.now() - hour).toISOString());
        answer = { status: 200, body: { access_token: 'ACCESS-AFTER', token_type: 'Bearer', expires_in: 3600, user: CANVAS_USER } };

        const result = await auth.checkAccessToken(request());

        assert.equal(result.success, true);
        assert.equal(result.access_token, 'ACCESS-AFTER');
        assert.equal(stored.refresh_token, REFRESH, 'the stored refresh token must be the one it started with');
        assert.equal(stored.access_token, 'ACCESS-AFTER', 'the new access token must be persisted');
    });

    await t.test('a refused grant is reported as invalid_grant, which is what sends a user to reauthorize', async () => {
        /* The route middleware tests the message for this string and redirects into the OAuth
           flow. Any other error reaches a generic handler that answers a browser with json. */
        stored = storedToken(new Date(Date.now() - hour).toISOString());
        answer = { status: 400, body: { error: 'invalid_grant', error_description: 'refresh_token not found' } };

        await assert.rejects(
            () => auth.checkAccessToken(request()),
            (error) => error.message.includes('invalid_grant')
        );

        answer = { status: 200, body: { access_token: 'ACCESS-AFTER', token_type: 'Bearer', expires_in: 3600, user: CANVAS_USER } };
    });

    await t.test('a user with no stored token is reported as such rather than as an error', async () => {
        /* The middleware turns this into a redirect into the OAuth flow, so it must not throw. */
        stored = undefined;

        const result = await auth.checkAccessToken(request());

        assert.equal(result.success, false);
        assert.match(result.message, /No token found/);
    });

    await t.test('the token is looked up under the configured Canvas host and client', async () => {
        /* Both are part of the primary key, so a change to either makes every stored token
           unreachable. That has happened once and is worth a test. */
        stored = storedToken(new Date(Date.now() + hour).toISOString());
        queries.length = 0;

        await auth.checkAccessToken(request());

        const lookup = queries.find((q) => q.text.startsWith('SELECT data FROM user_token'));

        assert.deepEqual(lookup.params, [4711, '127.0.0.1', 'client-id']);
    });

    await t.test('the refreshed token still carries the Canvas user, which is what the row is keyed on', async () => {
        /* Read without a guard, so losing it is a TypeError in a promise chain rather than a
           handled failure. Asserted here because a library that stopped mapping the response body
           through would break it silently, and this is the shape the stored row depends on. */
        stored = storedToken(new Date(Date.now() - hour).toISOString());

        await auth.checkAccessToken(request());

        assert.equal(stored.user.id, CANVAS_USER.id);
        assert.equal(stored.user.global_id, CANVAS_USER.global_id);
    });
});
