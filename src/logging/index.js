'use strict';

const crypto = require('crypto');
const winston = require('winston');
const { combine, timestamp, json, errors } = winston.format;
const { LogstashLogger } = require('./logstash-logger');
require('winston-daily-rotate-file');
require('dotenv').config();

/*
 * A refresh token is a long-lived credential granting full Canvas API access as that user, and a
 * refresh does not rotate it, so one in a log file stays useful indefinitely. It must never be
 * written. The callers are supposed to pass a fingerprint instead of the value, but this is the
 * backstop for the ones that do not, and for whatever gets added later.
 *
 * Deliberately not matching a key called "code": error objects carry `code` ('ECONNRESET' and
 * such) and fingerprinting those would throw away the diagnosis. The authorization code in the
 * OAuth callback is redacted where it actually appears, in the morgan url token in app.js.
 */
const SECRET_KEY = /^(access_token|refresh_token|api_token|client_secret|password|secret|authorization|cookie)$/i;

/*
 * An LTI launch body carries personal data under innocuous names: lis_person_sourcedid is the
 * personnummer, and ims-lti derives `username` from the given name. None of it belongs in a log,
 * and the opaque ids beside it are what a launch is actually debugged with. Redacted outright
 * rather than fingerprinted, since there is no reason to compare one occurrence with another.
 */
const PERSONAL_KEY = /^(lis_person_sourcedid|lis_person_contact_email_primary|lis_person_name_full|lis_person_name_given|lis_person_name_family|lis_person_name_sourcedid|custom_canvas_user_login_id|username)$/i;

/* The same shape in a log and in a database row can be compared without either being readable. */
const fingerprint = (value) => {
    if (value === null || value === undefined) {
        return String(value);
    }

    const text = String(value);

    return 'sha256:' + crypto.createHash('sha256').update(text).digest('hex').slice(0, 12) +
        ' len=' + text.length;
};

/* One key/value pair: a credential becomes a fingerprint, personal data goes entirely. */
const redactValue = (key, item, seen) => {
    if (PERSONAL_KEY.test(key)) {
        return '[redacted]';
    }

    if (SECRET_KEY.test(key) && (item === null || typeof item !== 'object')) {
        return fingerprint(item);
    }

    return sanitize(item, seen);
};

/* Replace credential values, turn Errors into something json() will not flatten to {}. */
const sanitize = (value, seen = new WeakSet()) => {
    if (value instanceof Error) {
        if (seen.has(value)) {
            return '[circular]';
        }

        seen.add(value);

        /* name, message and stack are not enumerable, so they have to be named. Everything else
           an Error carries is: `code` and `errno` on a system error, `cause`, and whatever the
           application attached, such as the `status` that getSecret sets. Dropping those would
           throw away the diagnosis, which is half of what this fix is for. */
        const out = { name: value.name, message: value.message, stack: value.stack };

        for (const [key, item] of Object.entries(value)) {
            if (!(key in out)) {
                out[key] = redactValue(key, item, seen);
            }
        }

        return out;
    }

    if (value === null || typeof value !== 'object') {
        return value;
    }

    if (seen.has(value)) {
        return '[circular]';
    }

    seen.add(value);

    if (Array.isArray(value)) {
        return value.map((item) => sanitize(item, seen));
    }

    const out = {};

    for (const [key, item] of Object.entries(value)) {
        out[key] = redactValue(key, item, seen);
    }

    return out;
};

/* A token stringified into the message is not reachable by key, so the text needs scrubbing too. */
const redactText = (text) => text.replace(
    /("(?:access_token|refresh_token|api_token|client_secret|lis_person_sourcedid|lis_person_contact_email_primary|lis_person_name_full|lis_person_name_given|lis_person_name_family|custom_canvas_user_login_id)"\s*:\s*)"[^"]*"/gi,
    '$1"[redacted]"');

/* Errors are left alone so the errors({ stack: true }) format can still expand them. */
const scrubMessage = (msg) => {
    if (typeof msg === 'string') {
        return redactText(msg);
    }

    return msg instanceof Error ? msg : sanitize(msg);
};

let transports = [];
let logstashLogger = null;
let logstashSource = null;

transports.push(
    new winston.transports.DailyRotateFile({
        filename: './logs/combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '14d',
    })
);

if (process.env.LOGSTASH_BASEURL?.length > 0 && process.env.LOGSTASH_USER?.length > 0 && process.env.LOGSTASH_PWD?.length > 0) {
    logstashSource = process.env.LOGSTASH_SOURCE? process.env.LOGSTASH_SOURCE : "canvas-group-bookings";

    logstashLogger = new LogstashLogger(
        process.env.LOGSTASH_BASEURL,
        process.env.LOGSTASH_USER,
        process.env.LOGSTASH_PWD,
        logstashSource
    );
}

/*
 * The source this instance ships under, or null when the transport was not built at all. The
 * client is constructed inside a condition and its send failures are reported to the console, so
 * not configured, configured and failing, and configured with nothing to say all look the same
 * from the log. Naming the target once at startup is what separates them.
 */
const logstashTarget = () => logstashSource;

const logger = winston.createLogger({
    level: 'info',
    format: combine(errors({ stack: true }), timestamp(), json()),
    defaultMeta: {},
    transports: transports
});

// fired when a log file is created
// fileRotateTransport.on('new', (filename) => {});
// fired when a log file is rotated
// fileRotateTransport.on('rotate', (oldFilename, newFilename) => {});
// fired when a log file is archived
// fileRotateTransport.on('archive', (zipFilename) => {});
// fired when a log file is deleted
// fileRotateTransport.on('logRemoved', (removedFilename) => {});

if (process.env.NODE_ENV !== 'production') {
    logger.level = 'debug';
    console.log("setting logger.level to debug because process.env.NODE_ENV=" + process.env.NODE_ENV)
    
    logger.add(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.simple()
      )
    }));

    winston.addColors({
        info: 'bold blue', // fontStyle color
        warn: 'italic yellow',
        error: 'bold red',
        debug: 'green',
    });
}

/*
 * One meta argument is sent as itself and several as an array, so the common case — an Error
 * beside a message — arrives as an object rather than a one-element list.
 */
const forLogstash = (meta) => (meta.length === 1 ? meta[0] : (meta.length ? meta : undefined));

/*
 * The same detail for the file, under one key rather than spread. Meta is an array, so spreading
 * it names each argument by its position and a reader has to know how many there were. Built from
 * the same function as the wire, so the two sinks cannot describe one call differently. A call
 * with no detail adds nothing, which keeps those lines exactly as they were.
 */
const forFile = (meta) => (meta.length ? { data: forLogstash(meta) } : {});

async function info(msg, ...meta) {
    const message = scrubMessage(msg);
    const detail = sanitize(meta);

    await logger.log({ level: 'info', message, ...forFile(detail) });
    await logstashLogger?.info(message, forLogstash(detail));
}
async function error(msg, ...meta) {
    const message = scrubMessage(msg);
    const detail = sanitize(meta);

    await logger.error({ level: 'error', message, ...forFile(detail) });
    await logstashLogger?.error(message, forLogstash(detail));
}
/*
 * Deliberately not sent to logstash. winston filters debug by level, but a direct call would not
 * be, so every debug line would be shipped in production — the volume it was filtered out to
 * avoid, and the level that carries whole objects.
 */
async function debug(msg, ...meta) {
    await logger.debug({ level: 'debug', message: scrubMessage(msg), ...forFile(sanitize(meta)) });
}

module.exports = {
    info,
    error,
    debug,
    fingerprint,
    logstashTarget
}