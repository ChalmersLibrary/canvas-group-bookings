/*
 * The numbering the migration loop walks.
 *
 * Startup reads the highest applied version and looks for the file one above it, stopping when
 * that file does not exist. A missing number in the middle is therefore not an error: the loop
 * treats it as the end, every later migration is skipped, and the application serves on the old
 * schema without logging anything. A file whose version insert disagrees with its own name is
 * the same shape of fault from the other side, applying one file and recording another.
 *
 * Both are failures that fall open, which is why they are asserted here rather than read. The
 * files are parsed as text and no database is touched.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIRECTORY = path.join(__dirname, '..', 'src', 'db');

/* The version a file records as applied, which is what the next startup reads back. */
const declaredVersion = (file) => {
    const sql = fs.readFileSync(path.join(DIRECTORY, file)).toString();
    const inserts = [...sql.matchAll(/INSERT\s+INTO\s+version\s*\(\s*db_version\s*\)\s*VALUES\s*\(\s*(\d+)\s*\)/gi)];

    assert.equal(inserts.length, 1, file + ' records its version exactly once');

    return Number(inserts[0][1]);
};

const migrations = fs.readdirSync(DIRECTORY)
    .filter(file => /^setup_\d+\.sql$/.test(file))
    .map(file => ({ file, numbered: Number(file.match(/\d+/)[0]) }))
    .sort((a, b) => a.numbered - b.numbered);

test('the base schema is version 1', () => {
    assert.equal(declaredVersion('setup.sql'), 1);
});

test('every migration records the version its name promises', () => {
    assert.ok(migrations.length > 0, 'there are migrations to check');

    for (const { file, numbered } of migrations) {
        assert.equal(declaredVersion(file), numbered, file + ' records version ' + numbered);
    }
});

test('the numbering runs unbroken from the base schema upwards', () => {
    assert.deepEqual(
        migrations.map(m => m.numbered),
        migrations.map((_, index) => index + 2),
        'a gap ends the migration loop silently, skipping everything above it');
});
