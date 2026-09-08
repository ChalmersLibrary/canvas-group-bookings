/*
 * Which launch a request acts in.
 *
 * The defect this covers is the oldest one in the application: a session cookie is per origin
 * rather than per tab, so two placements opened in two tabs shared one launch object and the tool
 * followed whichever launch was most recent. An administration write then landed in a course the
 * operator was not looking at, silently.
 *
 * The two properties worth holding are here. Two launches in one session stay separate and each
 * request names the one it means; and a request naming none is refused rather than served from the
 * most recent, because a fallback is what made the wrong course silent. The refusal is what makes
 * a page link or a client call site that was never given the key fail on the first click instead
 * of writing to another course.
 */
'use strict';

/* Must come first: moves the process into a temp directory before the logging module resolves its
   relative './logs' path, and before dotenv can find the developer's .env. */
const sandbox = require('./helpers/sandbox');

const test = require('node:test');
const assert = require('node:assert/strict');

const context = require('../src/lti/context');

/* A session as express-session presents one, with nothing in it. */
const emptySession = () => ({});

/* Enough of a request for the module: a session, a query, and express's own header reader. */
const requestFor = (session, { query = {}, headers = {} } = {}) => ({
    session,
    query,
    get: (name) => headers[String(name).toLowerCase()]
});

const launchFor = (resourceLinkId, canvasCourseId) => ({
    resource_link_id: resourceLinkId,
    custom_canvas_course_id: canvasCourseId,
    context_id: 'ctx-' + canvasCourseId
});

test('the launch context', async (t) => {
    t.after(() => sandbox.cleanup());

    await t.test('a launch is keyed by its placement, not by when it happened', () => {
        const first = context.keyForLaunch(launchFor('placement-a', '123'));
        const again = context.keyForLaunch(launchFor('placement-a', '123'));
        const other = context.keyForLaunch(launchFor('placement-b', '123'));

        assert.equal(first, again, 'relaunching a placement must keep the url a tab already has');
        assert.notEqual(first, other,
            'two placements in one course must stay distinct, which keying on the course would not do');
    });

    await t.test('a launch with no resource link id cannot be placed', () => {
        assert.equal(context.keyForLaunch({ custom_canvas_course_id: '123' }), undefined);
        assert.equal(context.store({ session: emptySession() }, { custom_canvas_course_id: '123' }), undefined);
    });

    /* The defect, stated as a test: both tabs' launches survive, and each key answers with its own
       course rather than with the one that arrived last. */
    await t.test('two launches in one session keep their own courses', () => {
        const session = emptySession();

        const courseA = context.store(requestFor(session), launchFor('placement-a', '123'));
        const courseB = context.store(requestFor(session), launchFor('placement-b', '456'));

        assert.notEqual(courseA, courseB);

        const resolvedA = context.resolve(requestFor(session, { query: { ctx: courseA } }));
        const resolvedB = context.resolve(requestFor(session, { query: { ctx: courseB } }));

        assert.equal(context.courseId(resolvedA.lti), '123',
            'the first tab must still act in the course it was launched for');
        assert.equal(context.courseId(resolvedB.lti), '456');
    });

    await t.test('a relaunch of a placement replaces its entry rather than adding one', () => {
        const session = emptySession();

        context.store(requestFor(session), launchFor('placement-a', '123'));
        context.store(requestFor(session), launchFor('placement-a', '123'));

        assert.equal(Object.keys(session.launches).length, 1);
    });

    await t.test('the key travels in the query string or in the header', () => {
        const session = emptySession();
        const key = context.store(requestFor(session), launchFor('placement-a', '123'));

        assert.equal(context.resolve(requestFor(session, { query: { ctx: key } })).key, key,
            'a navigation carries it in the url');
        assert.equal(context.resolve(requestFor(session, { headers: { 'x-lti-context': key } })).key, key,
            'an api call carries it in a header');
    });

    /* No fallback, and this is the point rather than an edge case. */
    await t.test('a request naming no launch resolves to nothing', () => {
        const session = emptySession();

        context.store(requestFor(session), launchFor('placement-a', '123'));

        assert.equal(context.resolve(requestFor(session)), undefined,
            'a request with no key must not be answered from the most recent launch');
    });

    await t.test('a request naming a launch this session never made resolves to nothing', () => {
        const session = emptySession();

        context.store(requestFor(session), launchFor('placement-a', '123'));

        assert.equal(context.resolve(requestFor(session, { query: { ctx: 'not-a-key' } })), undefined);
    });

    await t.test('a session cannot accumulate launches without bound', () => {
        const session = emptySession();

        for (let n = 0; n < context.MAX_LAUNCHES + 5; n++) {
            context.store(requestFor(session), launchFor('placement-' + n, String(n)));
        }

        assert.equal(Object.keys(session.launches).length, context.MAX_LAUNCHES);

        /* Oldest first, so the tabs somebody is actually using are the ones that survive. */
        const newest = context.keyForLaunch(launchFor('placement-' + (context.MAX_LAUNCHES + 4),
            String(context.MAX_LAUNCHES + 4)));

        assert.ok(session.launches[newest], 'the most recent launch must still be there');
    });

    await t.test('the key is added to a url with the separator that url needs', () => {
        assert.equal(context.withKey('/admin', 'abc'), '/admin?ctx=abc');
        assert.equal(context.withKey('/?availability=1', 'abc'), '/?availability=1&ctx=abc');
        assert.equal(context.withKey('/admin', undefined), '/admin',
            'with no key there is nothing to add, and the url must be left alone');
    });

    /*
     * Every canvas_course_id column is an integer, so the context_id fallback cannot match one: it
     * is not a wrong answer but an invalid integer, and a launch taking that branch already fails
     * on the first course-scoped query. Asserted so the shape is visible rather than surprising.
     */
    await t.test('a launch without a Canvas course id falls back to its context id', () => {
        assert.equal(context.courseId({ custom_canvas_course_id: '123', context_id: 'ctx-1' }), '123');
        assert.equal(context.courseId({ context_id: 'ctx-1' }), 'lti_context_id:ctx-1');
    });
});
