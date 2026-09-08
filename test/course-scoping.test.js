/*
 * Every endpoint that takes a record id from the url also takes the course the request acts in.
 *
 * The gap this covers: the role guard establishes that the caller is an administrator or an
 * instructor, but it establishes it for the course they launched from, and nothing then checked
 * that the record being read or changed belonged to that course. Record ids are sequential
 * integers, so a teacher in any one course could reach another course's booking configuration by
 * asking for its id -- and the CSV export, which takes a Canvas course id, returned student names
 * for any course at all.
 *
 * The database is replaced by a recorder, so what these tests assert is the argument each route
 * passes: whether the course reaches the statement. That the statement then uses it is a property
 * of the SQL, which no test here can reach without a Postgres; the two are separated deliberately
 * rather than left to a test that would need a live database and would therefore not run.
 */
'use strict';

/* Must come first: moves the process into a temp directory before the logging module resolves its
   relative './logs' path, and before dotenv can find the developer's .env. */
const sandbox = require('./helpers/sandbox');

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');

const COURSE = '123';
const OTHER_COURSE = '456';

/* Replace a module by its resolved filename, before anything requires it for real. */
const stubModule = (relative, exports) => {
    const resolved = require.resolve(path.join(__dirname, '..', relative));

    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};

/* Every call the routes make, in order, with the arguments they made it with. */
const calls = [];

/*
 * A database that records instead of querying. Each function answers something shaped enough for
 * the route to finish: a row for a read, nothing for a write.
 */
const recordingDb = new Proxy({}, {
    get: (target, name) => {
        if (name === 'then') {
            return undefined;
        }

        return (...args) => {
            calls.push({ name: String(name), args });

            /* Shaped for the routes that read a value back out of the answer. */
            if (String(name).startsWith('get')) {
                if (String(name) === 'getAllGroupReservationsForCanvasCourse') {
                    return Promise.resolve([]);
                }

                return Promise.resolve({ id: 7, canvas_course_id: COURSE, type: 'group', slots: 0 });
            }

            return Promise.resolve(undefined);
        };
    }
});

stubModule('src/db/index.js', recordingDb);
stubModule('src/api/canvas.js', {
    getCourseGroupsSelfReference: async () => [],
    sendConversationMessage: async () => ({ success: true })
});

const express = require('express');

/* Required after the stubs, or they reach the real modules. */
const adminRoutes = require('../src/routes/api/admin');
const instructorRoutes = require('../src/routes/api/instructor');

const request = (port, method, path) => new Promise((resolve, reject) => {
    const sendsBody = method === 'PUT' || method === 'POST';
    const call = http.request({ port, host: '127.0.0.1', path, method,
        headers: sendsBody ? { 'content-type': 'application/json' } : {} }, (response) => {
        let body = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => resolve({ status: response.statusCode, body }));
    });

    call.on('error', reject);
    call.end(sendsBody ? '{}' : undefined);
});

/* The call a named database function received, or undefined when the route never made it. */
const callTo = (name) => calls.find((call) => call.name === name);

test('the administration and instructor endpoints are scoped to the course', async (t) => {
    const app = express();

    app.use(express.json());

    /*
     * Stands in for the LTI middleware: a session with the roles, and the course this request acts
     * in. The real one derives both from the launch the request names, which test/lti-context
     * covers; here the point is what the routes do with the course once it is decided.
     */
    app.use((req, res, next) => {
        req.session = {
            user: { id: 'user-1', isAdministrator: true, isInstructor: true }
        };
        res.locals.courseId = COURSE;
        res.locals.contextKey = 'a-context-key';
        res.locals.lti = { context_title: 'A course' };

        next();
    });

    app.use('/api/admin', adminRoutes);
    app.use('/api/instructor', instructorRoutes);

    app.use((err, req, res, next) => res.status(403).send({ success: false, message: err.message }));

    const server = app.listen(0);
    await new Promise((r) => server.on('listening', r));

    const port = server.address().port;

    t.after(() => {
        server.close();
        sandbox.cleanup();
    });

    const call = async (method, path) => {
        calls.length = 0;

        return request(port, method, path);
    };

    /*
     * The by-id writes named in the notes as ending `WHERE id=`, each now carrying the course as
     * its first argument. A miss here is the whole defect, so they are asserted one by one rather
     * than as a group.
     */
    const byId = [
        ['PUT', '/api/admin/course/99', 'updateCourse'],
        ['DELETE', '/api/admin/course/99', 'deleteCourse'],
        ['GET', '/api/admin/course/99', 'getCourseWithStatistics'],
        ['GET', '/api/admin/segment/99', 'getSegmentWithStatistics'],
        ['PUT', '/api/admin/segment/99', 'updateSegment'],
        ['PUT', '/api/admin/instructor/99', 'updateInstructor'],
        ['PUT', '/api/instructor/slot/99', 'updateSlot'],
        ['DELETE', '/api/instructor/slot/99', 'deleteSlot']
    ];

    for (const [method, url, fn] of byId) {
        await t.test(`${method} ${url} passes the course to ${fn}`, async () => {
            await call(method, url);

            const made = callTo(fn);

            assert.ok(made, `${fn} should have been called`);
            assert.equal(String(made.args[0]), COURSE,
                `${fn} must be given the course the request acts in, as its first argument`);
        });
    }

    await t.test('a slot is read within the course, not by id alone', async () => {
        await call('GET', '/api/instructor/slot/99');

        const made = callTo('getSlot');

        assert.ok(made, 'getSlot should have been called');
        /* getSlot takes res first, for the locale it formats with. */
        assert.equal(String(made.args[1]), COURSE);
        assert.equal(String(made.args[2]), '99');
    });

    await t.test('a slot reservation list is read within the course', async () => {
        await call('GET', '/api/instructor/slot/99');

        assert.equal(String(callTo('getSlotReservations').args[0]), COURSE);
    });

    await t.test('a location is read within the course', async () => {
        await call('GET', '/api/instructor/location/99');

        assert.equal(String(callTo('getLocation').args[0]), COURSE);
    });

    await t.test('a course is read within the Canvas course', async () => {
        await call('GET', '/api/instructor/course/99');

        assert.equal(String(callTo('getCourse').args[0]), COURSE);
    });

    /*
     * The two endpoints whose url names a Canvas course rather than a record. There is nothing to
     * scope a statement against here -- the url parameter *is* the course -- so the route refuses
     * a request naming another one.
     */
    await t.test('the CSV export refuses a Canvas course that is not the launched one', async () => {
        const { body } = await call('GET', `/api/admin/exports/csv/group-reservations/${OTHER_COURSE}`);

        assert.equal(JSON.parse(body).success, false,
            'the export carries student names, so another course must be refused');
        assert.equal(callTo('getAllGroupReservationsForCanvasCourse'), undefined,
            'the refusal must come before the query, not after it');
    });

    await t.test('the CSV export serves the launched course', async () => {
        await call('GET', `/api/admin/exports/csv/group-reservations/${COURSE}`);

        assert.equal(String(callTo('getAllGroupReservationsForCanvasCourse').args[0]), COURSE);
    });

    await t.test('the Canvas connection refuses a course that is not the launched one', async () => {
        const { body } = await call('PUT', `/api/admin/canvas/${OTHER_COURSE}`);

        assert.equal(JSON.parse(body).success, false);
        assert.equal(callTo('updateCanvasConnection'), undefined,
            'the statement deletes before it inserts, so it must not be reached at all');
    });

    /*
     * The two instructor reads that had no role check at all, so any launched user -- a student --
     * could read a location or a course by id.
     */
    await t.test('the instructor reads require the instructor role', async () => {
        const noRole = express();

        noRole.use((req, res, next) => {
            req.session = { user: { id: 'student-1', isAdministrator: false, isInstructor: false } };
            res.locals.courseId = COURSE;

            next();
        });

        noRole.use('/api/instructor', instructorRoutes);
        noRole.use((err, req, res, next) => res.status(403).send({ success: false, message: err.message }));

        const other = noRole.listen(0);
        await new Promise((r) => other.on('listening', r));

        const otherPort = other.address().port;

        try {
            calls.length = 0;

            const location = await request(otherPort, 'GET', '/api/instructor/location/99');
            const course = await request(otherPort, 'GET', '/api/instructor/course/99');

            assert.equal(location.status, 403, 'a location must not be readable without the role');
            assert.equal(course.status, 403, 'a course must not be readable without the role');
            assert.equal(calls.length, 0, 'neither should have reached the database');
        }
        finally {
            other.close();
        }
    });

    /* Slots are created in a course that arrives from the form, so the Canvas course goes with it. */
    await t.test('slot creation carries the Canvas course', async () => {
        await call('POST', '/api/instructor/slot');

        const made = callTo('createSlots');

        assert.ok(made, 'createSlots should have been called');
        assert.equal(String(made.args[0].canvas_course_id), COURSE);
    });
});
