/*
 * The CSV export is built in memory and sent from memory.
 *
 * It was previously written into an exports/ directory beside the process and then handed to
 * res.download, so every export a teacher took left a file of student and group names on the
 * instance with nothing to remove it. The rows are already in memory, so the file was never
 * needed; what this asserts is the property that replaced it.
 */
'use strict';

/* Must come first: moves the process into a temp directory before the logging module resolves its
   relative './logs' path, and before dotenv can find the developer's .env. */
const sandbox = require('./helpers/sandbox');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const COURSE = '123';

/* Replace a module by its resolved filename, before anything requires it for real. */
const stubModule = (relative, exports) => {
    const resolved = require.resolve(path.join(__dirname, '..', relative));

    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};

const reservation = {
    time_start: '2026-01-02 09:00',
    canvas_group_name: 'Grupp 1',
    canvas_user_name: 'Anna Andersson',
    course_name: 'Handledning',
    instructor_name: 'Bertil Berg'
};

stubModule('src/db/index.js', {
    getAllGroupReservationsForCanvasCourse: async () => [ reservation ]
});
stubModule('src/api/canvas.js', {});

const express = require('express');

/* Required after the stubs, or they reach the real modules. */
const adminRoutes = require('../src/routes/api/admin');

const request = (port, url) => new Promise((resolve, reject) => {
    const call = http.request({ port, host: '127.0.0.1', path: url, method: 'GET' }, (response) => {
        let body = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => resolve({
            status: response.statusCode,
            headers: response.headers,
            body
        }));
    });

    call.on('error', reject);
    call.end();
});

test('the CSV export is sent from memory', async (t) => {
    const app = express();

    /* Stands in for the LTI middleware: an administrator, and the course the request acts in. */
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

    const server = app.listen(0);
    await new Promise((r) => server.on('listening', r));

    t.after(() => {
        server.close();
        sandbox.cleanup();
    });

    const response = await request(server.address().port,
        '/api/admin/exports/csv/group-reservations/' + COURSE);

    await t.test('the response carries the header row and the reservations', () => {
        assert.equal(response.status, 200);
        assert.equal(response.body.split('\r\n')[0],
            'Start time\tGroup name\tReserved by\tCourse name\tInstructor name');
        assert.equal(response.body.split('\r\n')[1],
            [ reservation.time_start, reservation.canvas_group_name, reservation.canvas_user_name,
                reservation.course_name, reservation.instructor_name ].join('\t'));
    });

    await t.test('the response is an attachment the browser saves under the export name', () => {
        assert.match(response.headers['content-disposition'],
            new RegExp('^attachment; filename="res_grp_c_' + COURSE + '_.*\\.csv"$'));
        assert.match(response.headers['content-type'], /^text\/csv/);
    });

    await t.test('nothing is written to the filesystem', () => {
        assert.equal(fs.existsSync(path.join(sandbox.dir, 'exports')), false,
            'a copy left on the server outlives the download it was made for');
    });
});
