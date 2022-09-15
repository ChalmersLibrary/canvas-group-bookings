'use strict';

const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.json(),
    ),
    defaultMeta: { service: 'user-service' },
    transports: [
      //
      // - Write all logs with importance level of `error` or less to `error.log`
      // - Write all logs with importance level of `info` or less to `combined.log`
      //
      new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: './logs/combined.log' }),
    ]
});

if (process.env.NODE_ENV !== 'production') {
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
}
async function error(msg, ...meta) {
    await logger.error({ level: 'error', message: msg, ...meta });
}
async function debug(msg, ...meta) {
    await logger.debug({ level: 'debug', message: msg, ...meta });
}

module.exports = {
    info,
    error,
    debug
}