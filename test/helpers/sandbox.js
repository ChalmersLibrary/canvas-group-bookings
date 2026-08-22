/*
 * src/logging/index.js constructs a DailyRotateFile transport with the relative filename
 * './logs/combined-%DATE%.log', resolved against the process working directory. A test run
 * from the repository root would therefore write into the developer's own ./logs.
 *
 * Requiring this module FIRST, before any application module, moves the process into a fresh
 * temporary directory so those writes land there instead. node --test runs each test file in
 * its own process, so the chdir cannot affect another file.
 *
 * It must be required before the application, not inside a test callback: the transport
 * resolves its path when the logging module is first required.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cgb-test-'));

process.chdir(dir);

/* Read the log lines this process has written, oldest first. Empty when nothing was logged. */
const logLines = () => {
    const logs = path.join(dir, 'logs');

    if (!fs.existsSync(logs)) {
        return [];
    }

    return fs.readdirSync(logs)
        .filter((name) => name.startsWith('combined-'))
        .flatMap((name) => fs.readFileSync(path.join(logs, name), 'utf8').split('\n'))
        .filter((line) => line.trim().length > 0);
};

const cleanup = () => {
    /* Back out before removing, or the cwd is gone from under the process on Windows. */
    process.chdir(os.tmpdir());

    try {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    catch { /* a rotating-file handle may still be open; the temp directory is harmless */ }
};

module.exports = { dir, logLines, cleanup };
