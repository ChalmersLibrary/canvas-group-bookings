/*
 * A message body left blank in the administration interface is stored as null, and the
 * application is meant to fall back to the template it ships with. The guard that made that
 * choice compared against the string 'undefined' rather than against null, so a blank body was
 * taken for a real one: replacing the magics in it threw, no message was sent, nothing was
 * written to the conversation log, and the reservation still reported success. Silent at every
 * level, and the branch written to report it could not be reached.
 *
 * getMessageBody is the one place that choice is made now. These assert the values a course row
 * and a missing template actually produce, rather than the ones the old guard was written for.
 */
'use strict';

/* Must come first: moves the process into a temp directory, which is also what gives the
   working-directory assertion below something to prove. */
const sandbox = require('./helpers/sandbox');

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const utils = require('../src/utilities');

/* Every template the reservation and manual message paths ask for. */
const TEMPLATES = [
    'reservation_group_done',
    'reservation_group_full',
    'reservation_group_canceled',
    'reservation_individual_done',
    'reservation_individual_canceled',
    'manual_message'
];

const CONFIGURED = 'A body written for this course.';

test('a course with a body of its own', async (t) => {
    await t.test('uses it as it stands', () => {
        assert.equal(utils.getMessageBody(CONFIGURED, 'reservation_group_done'), CONFIGURED);
    });

    await t.test('is preferred over the template, which is not consulted', () => {
        assert.equal(utils.getMessageBody(CONFIGURED, 'no_such_template'), CONFIGURED);
    });
});

test('a course with no body of its own falls back to the template', async (t) => {
    const template = utils.getTemplate('reservation_group_done');

    /* A body cleared in the administration interface: src/db/index.js stores '' as null. */
    await t.test('when the column is null', () => {
        assert.equal(utils.getMessageBody(null, 'reservation_group_done'), template);
    });

    await t.test('when the column is an empty string', () => {
        assert.equal(utils.getMessageBody('', 'reservation_group_done'), template);
    });

    /* The administration page assigns the stored value to innerHTML, where undefined becomes
       this string, and it is posted back and stored that way. */
    await t.test('when the column holds the string undefined', () => {
        assert.equal(utils.getMessageBody('undefined', 'reservation_group_done'), template);
    });

    /* A column the schema does not have reads as undefined on the row. */
    await t.test('when the column does not exist', () => {
        assert.equal(utils.getMessageBody(undefined, 'reservation_group_done'), template);
    });
});

test('with neither a body nor a template', async (t) => {
    await t.test('nothing is returned, so the caller reports it instead of sending', () => {
        assert.equal(utils.getMessageBody(null, 'no_such_template'), null);
        assert.equal(utils.getMessageBody('', 'no_such_template'), null);
        assert.equal(utils.getMessageBody(undefined, 'no_such_template'), null);
    });
});

test('the templates that ship with the application', async (t) => {
    await t.test('are found from a working directory other than the repository root', () => {
        assert.notEqual(process.cwd(), path.resolve(__dirname, '..'));

        for (const type of TEMPLATES) {
            const content = utils.getTemplate(type);

            assert.equal(typeof content, 'string', type + ' was not found');
            assert.ok(content.length > 0, type + ' is empty');
        }
    });
});

test('a blank body ends in a message rather than an exception', async (t) => {
    const magics = (body) => utils.replaceMessageMagics(body, 'A course', 'a message', 24,
        'A Student', 'a time', 'A room', '', '', 'An Instructor', 'instructor@example.com',
        'Group 1', 'Group 1, Group 2', 'A Canvas course');

    await t.test('the reservation templates carry no magic the substitution leaves behind', () => {
        for (const type of TEMPLATES.filter((type) => type !== 'manual_message')) {
            const message = magics(utils.getMessageBody(null, type));

            assert.equal(message.match(/[{][{][^}]*[}][}]/g), null, type + ' has an unsubstituted magic');
        }
    });

    await t.test('the group booking message names the group that booked', () => {
        assert.ok(magics(utils.getMessageBody(null, 'reservation_group_done')).includes('Group 1'));
    });

    /* The instructor path substitutes this one itself, before the shared magics. */
    await t.test('the manual message keeps the text the instructor writes', () => {
        const message = magics(utils.getMessageBody(null, 'manual_message'));

        assert.ok(message.includes('{{message_text}}'));
    });
});
