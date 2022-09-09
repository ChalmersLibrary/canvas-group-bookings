'use strict';

const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
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
      format: winston.format.simple(),
    }));
}

async function info(msg) {
    await logger.info(msg);
}
async function error(msg) {
    await logger.error(msg);
}
async function debug(msg) {
    await logger.debug(msg);
}

module.exports = {
    info,
    error,
    debug
}