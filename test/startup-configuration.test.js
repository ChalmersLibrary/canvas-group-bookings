/*
 * The startup line naming what this instance is configured to be.
 *
 * The settings it reports are supplied by the deployment platform rather than the repository, and
 * a wrong one does not announce itself: the application starts and serves normally against another
 * Canvas or another database. This line is the only record of what a running instance actually
 * got, so what it must never do is omit a value or claim one it does not have.
 *
 * The credential assertion is the other half. The summary sits next to secrets in the environment
 * and is written to a log that is retained, so a test holds the line on which variables it reads.
 */
'use strict';

/* Must come first: moves the process into a temp directory before the logging module resolves its
   relative './logs' path, and before dotenv can find the developer's .env. */
const sandbox = require('./helpers/sandbox');

const test = require('node:test');
const assert = require('node:assert/strict');

const SECRET = 'SECRET-MUST-NOT-BE-REPORTED';

test('the startup configuration line', async (t) => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_HOST = 'https://canvas.example.se';
    process.env.PGDATABASE = 'bookings_example';
    process.env.AUTH_REDIRECT_CALLBACK = 'https://tool.example.se/callback';
    process.env.AUTH_CLIENT_SECRET = SECRET;
    process.env.SESSION_SECRET = SECRET;
    process.env.PGPASSWORD = SECRET;
    process.env.LTI_KEYS = `consumer:${SECRET}`;

    delete process.env.API_HOST;
    delete process.env.LTI_ENFORCE_API_DOMAIN;
    delete process.env.LTI_ALLOWED_API_DOMAINS;
    delete process.env.LOGSTASH_BASEURL;
    delete process.env.LOGSTASH_USER;
    delete process.env.LOGSTASH_PWD;
    delete process.env.LOGSTASH_SOURCE;

    const configuration = require('../src/configuration');
    const log = require('../src/logging');

    /*
     * Deliberately not removing the sandbox. This file makes no assertion that needs the process
     * to log, so it finishes while the rotating file transport still has work queued, and that
     * transport keeps a relative path with a timer behind it: moving the process out of the
     * sandbox makes its next reopen resolve against the parent directory instead. Waiting a fixed
     * time before removing would trade a certain failure for an occasional one. The helper's own
     * removal is best-effort for the same reason, and a few kilobytes under the system temp
     * directory is the cheaper end of the trade.
     */

    await t.test('it names the Canvas host, the database and the environment', () => {
        const summary = configuration.summary();

        assert.deepEqual(summary.canvas_api_domains, ['canvas.example.se']);
        assert.equal(summary.database, 'bookings_example');
        assert.equal(summary.environment, 'production');
        assert.equal(summary.auth_redirect_callback, 'https://tool.example.se/callback');
    });

    await t.test('the Canvas host is the one the launch check compares against', () => {
        /* Stating a different set from the one that decides a launch would make the line
           misleading in exactly the case it exists for, so it comes from that function. */
        const lti = require('../src/lti/canvas');

        assert.deepEqual(configuration.summary().canvas_api_domains, lti.servedApiDomains());
    });

    await t.test('a logstash transport that was never built says so rather than naming a source', () => {
        assert.equal(configuration.summary().logstash_source, '(not shipping)');
        assert.equal(log.logstashTarget(), null);
    });

    await t.test('enforcement is reported as off when the variable is unset', () => {
        assert.equal(configuration.summary().enforce_api_domain, false);
    });

    await t.test('the sentence carries the values a reader looks for first', () => {
        const line = configuration.summaryLine();

        assert.match(line, /canvas\.example\.se/);
        assert.match(line, /bookings_example/);
        assert.match(line, /production/);
        assert.match(line, /not shipping/);
    });

    await t.test('no credential in the environment reaches the summary', () => {
        const written = JSON.stringify(configuration.summary()) + configuration.summaryLine();

        assert.equal(written.includes(SECRET), false);
    });

    await t.test('an unset value is reported as unset rather than as absent', () => {
        /* An omitted key reads as "not asked", which is the one answer that would be wrong: the
           point of the line is to say what the instance got, including nothing. */
        delete process.env.PGDATABASE;

        assert.equal(configuration.summary().database, '(unset)');
        assert.match(configuration.summaryLine(), /\(unset\)/);

        process.env.PGDATABASE = 'bookings_example';
    });
});
