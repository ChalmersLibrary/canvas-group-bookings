'use strict';

const winston = require('winston');
const { combine, timestamp, json, errors } = winston.format;
const { LogstashLogger } = require('./logstash-logger');
require('winston-daily-rotate-file');
require('dotenv').config();

let transports = [];
let logstashLogger = null;

transports.push(
    new winston.transports.DailyRotateFile({
        filename: './logs/combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '14d',
    })
);

if (process.env.LOGSTASH_BASEURL?.length > 0 && process.env.LOGSTASH_USER?.length > 0 && process.env.LOGSTASH_PWD?.length > 0) {
    logstashLogger = new LogstashLogger(
        process.env.LOGSTASH_BASEURL,
        process.env.LOGSTASH_USER,
        process.env.LOGSTASH_PWD,
        process.env.LOGSTASH_SOURCE? process.env.LOGSTASH_SOURCE : "canvas-group-bookings"
    );
}

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

async function info(msg, ...meta) {
    await logger.log({ level: 'info', message: msg, ...meta });
    await logstashLogger?.info(msg.toString());
}
async function error(msg, ...meta) {
    await logger.error({ level: 'error', message: msg, ...meta });
    await logstashLogger?.error(msg.toString());
}
async function debug(msg, ...meta) {
    await logger.debug({ level: 'debug', message: msg, ...meta });
}

module.exports = {
    info,
    error,
    debug
}