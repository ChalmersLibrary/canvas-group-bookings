'use strict';

const { Pool } = require('pg');
const fs = require('fs');
const log = require('../logging')

// Pool uses env variables: PGUSER, PGHOST, PGPASSWORD, PGDATABASE and PGPORT
const pool = new Pool();

pool.connect();

// log.info(pool);

pool.on('connect', client => {
    log.info("Pool connected.");
});
pool.on('error', (error, client) => {
    log.info("Pool error!");
    log.info(error);
    log.info(client);
});

async function query(text, params) {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    log.info('Executed query', { text, duration, rows: res.rowCount });
    return res;
}

async function getValidCourses(date) {
    let data;

    await query("SELECT id, name FROM course WHERE date_start <= $1 AND date_end >= $1", [ date ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
    });
    
    return data;
}

async function getValidInstructors() {
    let data;

    await query("SELECT id, name FROM instructor").then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
    });
    
    console.log(data);
    return data;
}

async function getValidLocations() {
    let data;

    await query("SELECT id, name FROM location").then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
    });
    
    console.log(data);
    return data;
}

async function checkDatabaseVersion() {
    let run_setup = false;

    await query("SELECT db_version FROM version ORDER BY applied_at DESC LIMIT 1").then((result) => {
        if (result.rows.length > 0) {
            log.info("Ok, latest db_version is " + result.rows[0].db_version);
        }
        else {
            log.error("No versions in the version table, running initial setup...");
            run_setup = true;
        }
    }).catch((error) => {
        log.error(error);
        run_setup = true;
    });

    if (run_setup) {
        await setupDatabase();        
    }
}

async function setupDatabase() {
    let sql = fs.readFileSync('src/db/setup.sql').toString();

    log.info("Setting up database...");

    await query(sql).then((result) => {
        log.info(result);
    }).catch((error) => {
        log.error(error);
    });
}

module.exports = {
    query,
    getValidCourses,
    getValidInstructors,
    getValidLocations,
    checkDatabaseVersion,
}
