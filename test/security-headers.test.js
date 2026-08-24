/*
 * The headers that decide whether Canvas can embed the tool at all.
 *
 * The tool is only ever reached inside an iframe in Canvas, so anything that tells a browser not
 * to be framed takes every user out at once, with no other way in. Two headers can do it:
 * X-Frame-Options, which helmet sets unless told not to, and a frame-ancestors directive in the
 * Content-Security-Policy, which helmet's default policy includes. Both are therefore suppressed
 * on purpose, and both are the kind of thing a major version of a header library changes.
 *
 * The policy itself comes from the application rather than being restated here, so this covers
 * the string that is actually served. The helmet options are mirrored from app.js, as elsewhere
 * in this suite, because requiring app.js listens and reaches a database.
 */
'use strict';

const sandbox = require('./helpers/sandbox');

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const express = require('express');
const helmet = require('helmet');
const configuration = require('../src/configuration');

const get = (port) => new Promise((resolve, reject) => {
    const call = http.request({ host: '127.0.0.1', port, path: '/', method: 'GET', agent: false },
        (response) => {
            response.resume();
            response.on('end', () => resolve(response.headers));
        });

    call.on('error', reject);
    call.end();
});

/* Mirrors app.js: helmet with framing left to the policy below, then the policy. */
const appWithHeaders = () => {
    const app = express();

    app.use(helmet({ frameguard: false }));
    app.use((req, res, next) => {
        res.setHeader('Content-Security-Policy', configuration.contentSecurityPolicy());

        next();
    });
    app.get('/', (req, res) => res.send('ok'));

    return app;
};

test('the headers an embedded tool depends on', async (t) => {
    delete process.env.CSP_FRAME_SRC_ALLOW;
    delete process.env.CSP_FRAME_ANCESTORS;

    const server = appWithHeaders().listen(0);

    await new Promise((r) => server.on('listening', r));

    t.after(() => {
        server.close();
        sandbox.cleanup();
    });

    const headers = await get(server.address().port);

    await t.test('nothing tells the browser the page may not be framed', () => {
        assert.equal(headers['x-frame-options'], undefined);
        assert.doesNotMatch(headers['content-security-policy'], /frame-ancestors/);
    });

    await t.test('the policy served is the application\'s own, not the library default', () => {
        assert.equal(headers['content-security-policy'], configuration.contentSecurityPolicy());
        assert.match(headers['content-security-policy'], /frame-src 'self'/);
    });

    await t.test('helmet still sets the protections that do not concern framing', () => {
        assert.equal(headers['x-content-type-options'], 'nosniff');
    });
});

test('who is allowed to embed the tool', async (t) => {
    t.after(() => delete process.env.CSP_FRAME_ANCESTORS);

    await t.test('unconfigured, the directive is absent and any site may frame the tool', () => {
        /* The permissive default is deliberate. A frame-ancestors that omits one Canvas host in
           use denies every launch from it, and the tool has no other way in, so this has to be
           something a deployment turns on rather than something a deploy imposes. */
        delete process.env.CSP_FRAME_ANCESTORS;

        assert.doesNotMatch(configuration.contentSecurityPolicy(), /frame-ancestors/);
    });

    await t.test('configured, it names the hosts and nothing else', () => {
        process.env.CSP_FRAME_ANCESTORS = 'https://canvas.example.se https://*.example.com';

        assert.match(configuration.contentSecurityPolicy(),
            /; frame-ancestors https:\/\/canvas\.example\.se https:\/\/\*\.example\.com$/);
    });

    await t.test('it is reported at startup, since a wrong value denies every launch', () => {
        process.env.CSP_FRAME_ANCESTORS = 'https://canvas.example.se';

        assert.equal(configuration.summary().frame_ancestors, 'https://canvas.example.se');

        delete process.env.CSP_FRAME_ANCESTORS;

        assert.match(configuration.summary().frame_ancestors, /any site may embed/);
    });
});

test('what the tool is allowed to embed', async (t) => {
    t.after(() => delete process.env.CSP_FRAME_SRC_ALLOW);

    await t.test('with nothing configured it may embed only itself', () => {
        delete process.env.CSP_FRAME_SRC_ALLOW;

        assert.match(configuration.contentSecurityPolicy(), /frame-src 'self'$/);
    });

    await t.test('a configured host is added to the frame-src list', () => {
        process.env.CSP_FRAME_SRC_ALLOW = '*.example.com';

        assert.match(configuration.contentSecurityPolicy(), /frame-src 'self' \*\.example\.com$/);
    });

    await t.test('several hosts are separated by spaces, which is what a source list is', () => {
        /* The list is space separated. Commas do not separate sources, so a comma-separated value
           would be read as one malformed source and the hosts after it would not be permitted. */
        process.env.CSP_FRAME_SRC_ALLOW = '*.example.com canvas.example.se';

        const policy = configuration.contentSecurityPolicy();

        assert.match(policy, /frame-src 'self' \*\.example\.com canvas\.example\.se$/);
        assert.equal(policy.split('frame-src')[1].includes(','), false);
    });
});
