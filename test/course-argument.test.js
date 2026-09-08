/*
 * Every course-scoped statement refuses to run without a course.
 *
 * This is here because of the way adding the course went wrong. Eighteen database functions gained
 * the course as their first argument, and eight call sites were left on the old signature -- so the
 * record id was passed as the course and the id was undefined. The statement then matched nothing,
 * which is indistinguishable from "no such record", and the symptom surfaced as a TypeError several
 * frames away, in code that had nothing to do with the mistake.
 *
 * The route tests could not have caught it: they replace the database module with a stub that
 * accepts any arguments, so an arity mistake is invisible to them by construction. Nor could the
 * statements be blamed -- they were correct. What was missing was any complaint about being called
 * wrongly.
 *
 * So each function now refuses an absent course and names itself, and this file is what holds that
 * in place. It needs no database: the refusal happens before any query.
 */
'use strict';

/* Must come first: moves the process into a temp directory before the logging module resolves its
   relative './logs' path. */
const sandbox = require('./helpers/sandbox');

const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/db');

/* res, for the two that take one to format times with. */
const res = { getLocale: () => 'en-GB', __n: (key) => key };

/*
 * Every scoped function, with a call that supplies everything except the course. The arguments
 * after the course do not matter: the guard runs first, so nothing here reaches a database.
 */
const calls = {
    getCourseWithStatistics: () => db.getCourseWithStatistics(undefined, 1),
    updateCourse: () => db.updateCourse(undefined, 1, 'user', {}),
    deleteCourse: () => db.deleteCourse(undefined, 1, 'user'),
    getCourse: () => db.getCourse(undefined, 1),
    getSegmentWithStatistics: () => db.getSegmentWithStatistics(undefined, 1),
    updateSegment: () => db.updateSegment(undefined, 1, 'user', 'n', 's', '#000000', 'd'),
    deleteSegment: () => db.deleteSegment(undefined, 1, 'user'),
    replaceExistingSegmentInCourses: () => db.replaceExistingSegmentInCourses(undefined, 1, null, 'user'),
    getSlot: () => db.getSlot(res, undefined, 1),
    getSlotReservations: () => db.getSlotReservations(undefined, 1),
    getSimpleSlotReservations: () => db.getSimpleSlotReservations(undefined, 1),
    getSlotMessages: () => db.getSlotMessages(undefined, 1),
    updateSlot: () => db.updateSlot(undefined, 1, 1, 1, 1, 'start', 'end'),
    deleteSlot: () => db.deleteSlot(undefined, 1),
    updateInstructor: () => db.updateInstructor(undefined, 1, 'n', 'e', 'user'),
    updateLocation: () => db.updateLocation(undefined, 1, 'n', 'd', 'u', 'c', 1),
    getLocation: () => db.getLocation(undefined, 1),
    createSlotReservation: () => db.createSlotReservation(res, undefined, 1, 'u', 'n', null, null, 'm'),
    createSlots: () => db.createSlots({ course_id: 1, instructor_id: 1, location_id: 1, slots: [] })
};

test('a course-scoped statement will not run without a course', async (t) => {
    t.after(() => sandbox.cleanup());

    for (const [name, call] of Object.entries(calls)) {
        await t.test(name + ' refuses, and says which function it was', async () => {
            await assert.rejects(call, (error) => {
                assert.match(error.message, new RegExp(name),
                    'the message has to name the function, since the caller is elsewhere');
                assert.match(error.message, /needs the course/);

                return true;
            });
        });
    }

    /* The unscoped survivors, named so nobody adds a guard to them by symmetry. Locations and
       instructors are shared between courses through their mapping tables, and the paths that
       connect a course to one of them look it up precisely because this course does not have it
       yet. Scoping those lookups would make connecting impossible. */
    await t.test('the two lookups that must stay unscoped are still unscoped', () => {
        assert.equal(typeof db.getLocationById, 'function',
            'the connect path needs a location lookup with no course');
        assert.equal(typeof db.getInstructor, 'function',
            'and its instructor counterpart, which was already unscoped');
    });
});
