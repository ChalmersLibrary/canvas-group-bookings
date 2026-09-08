/*
 * The development mock launch, and the one thing it must not do.
 *
 * A mocked launch never passes through the launch handler, so nothing has put it in the session's
 * launch map and no url carries its key. It registers itself instead, which is what lets a
 * developer machine reach the application at all.
 *
 * The hazard is that registering it too eagerly makes the mock the answer to *any* key. A request
 * naming a context the session does not hold would then be served rather than refused, so the
 * refusal -- the mechanism that makes a missed page link or call site fail visibly -- would never
 * fire on the machine where the missing link was written. That is the opposite of what it is for,
 * and it is what this file pins down.
 *
 * Found by driving the running application against a scratch database rather than by reading: the
 * first version of the mock used context.resolve() to decide, which answers undefined for an
 * unknown key exactly as it does for no key at all.
 */
'use strict';

/* Must come first: chdir into a temp directory, which is also where the mock file below is
   written. src/user reads 'mock-lti.json' relative to the working directory, at require time. */
const sandbox = require('./helpers/sandbox');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MOCK = {
    resource_link_id: 'mock-resource-link',
    custom_canvas_course_id: '24366',
    custom_canvas_user_id: '1618',
    context_id: 'mock-context',
    custom_canvas_roles: 'Administrator',
    launch_presentation_locale: 'en'
};

/* Written into the sandbox's own directory, never next to the developer's own mock file. */
fs.writeFileSync(path.join(process.cwd(), 'mock-lti.json'), JSON.stringify(MOCK));

process.env.NODE_ENV = 'development';

/* Required after both, since the module reads NODE_ENV and the file when it loads. */
const user = require('../src/user');
const context = require('../src/lti/context');

const requestFor = ({ query = {}, headers = {} } = {}) => ({
    session: {},
    query,
    get: (name) => headers[String(name).toLowerCase()]
});

test('the development mock launch', async (t) => {
    t.after(() => sandbox.cleanup());

    await t.test('registers itself when the request names no context', async () => {
        const req = requestFor();
        const key = await user.mockLtiSession(req);

        assert.ok(key, 'a developer machine has to be able to reach the application');
        assert.equal(context.resolve({ ...req, query: { ctx: key } }).lti.custom_canvas_course_id,
            '24366');
    });

    /* The point of the file. */
    await t.test('does not answer to a key the session does not hold', async () => {
        const req = requestFor({ query: { ctx: 'ffffffffffff' } });
        const key = await user.mockLtiSession(req);

        assert.equal(key, undefined,
            'a request naming an unknown context must be refused here as it is in production');
        assert.equal(req.session.launches, undefined, 'nothing should have been registered for it');
    });

    await t.test('does not answer to an unknown key sent as a header either', async () => {
        const req = requestFor({ headers: { 'x-lti-context': 'ffffffffffff' } });

        assert.equal(await user.mockLtiSession(req), undefined);
        assert.equal(req.session.launches, undefined);
    });

    await t.test('leaves a launch the session already holds alone', async () => {
        const req = requestFor();
        const key = await user.mockLtiSession(req);

        /* Second call, now naming the launch the first one registered. */
        const again = await user.mockLtiSession({ ...req, query: { ctx: key } });

        assert.equal(again, undefined, 'the key the request names decides, not the mock');
        assert.equal(Object.keys(req.session.launches).length, 1);
    });
});
