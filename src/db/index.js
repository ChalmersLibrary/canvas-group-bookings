'use strict';

const { Pool } = require('pg');

// Pool uses env variables: PGUSER, PGHOST, PGPASSWORD, PGDATABASE and PGPORT
const pool = new Pool();

pool.connect();

// console.log(pool);

pool.on('connect', client => {
    console.log("Pool connected.");
});
pool.on('error', (error, client) => {
    console.log("Pool error!");
    console.log(error);
    console.log(client);
});

module.exports = {
    async query(text, params) {
        const start = Date.now()
        const res = await pool.query(text, params)
        const duration = Date.now() - start
        console.log('Executed query', { text, duration, rows: res.rowCount })
        return res
      }
}
