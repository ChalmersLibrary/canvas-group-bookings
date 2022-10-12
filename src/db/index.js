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

/* Returns all slots from a specific date */
async function getAllSlots(canvas_course_id, date) {
    let data;
    let returnedData = [];
    const dateOptions = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };

    await query("SELECT * FROM slots_view s WHERE s.canvas_course_id = $1 AND s.time_start >= $2", [
        canvas_course_id,
        date
    ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    /* TODO: think about if these additions/conversions should be done outside, and this should be just clean db code? */
    if (data !== undefined && data.length) {
        data.forEach(slot => {
            slot.time_human_readable_sv = new Date(slot.time_start).toLocaleDateString('sv-SE', dateOptions) + " kl " + new Date(slot.time_start).toLocaleTimeString('sv-SE', timeOptions) + "&ndash;" + new Date(slot.time_end).toLocaleTimeString('sv-SE', timeOptions);
            returnedData.push(slot);
        });
    }

    return returnedData;
}

async function getSlot(id) {
    let data;

    await query("SELECT * FROM slots_view WHERE id = $1", [ id ]).then((result) => {
        data = result.rows[0];
    }).catch((error) => {
        log.error(error);
    });
    
    return data;
}

async function getSlotReservations(id) {
    let data;

    await query("SELECT * FROM reservation WHERE slot_id = $1", [ id ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
    });
    
    return data;
}

async function getReservationsForUser(canvas_course_id, user_id, groups) {
    let data;
    let returnedData = [];
    const dateOptions = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    
    await query("SELECT * FROM reservations_view WHERE canvas_course_id = $1 AND (canvas_user_id = $2 OR canvas_group_id = ANY ($3)) ORDER BY time_start ASC", [ 
        canvas_course_id,
        user_id,
        groups
    ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    if (data !== undefined && data.length) {
        data.forEach(reservation => {
            reservation.created_at_human_readable_sv = new Date(reservation.created_at).toLocaleDateString('sv-SE', dateOptions);
            reservation.time_human_readable_sv = new Date(reservation.time_start).toLocaleDateString('sv-SE', dateOptions) + " kl " + new Date(reservation.time_start).toLocaleTimeString('sv-SE', timeOptions) + "&ndash;" + new Date(reservation.time_end).toLocaleTimeString('sv-SE', timeOptions);
            
            returnedData.push(reservation);
        });
    }

    return returnedData;
}

/* Get one reservation, calling user must be reserver or in correct group */
async function getReservation(user_id, groups, reservation_id) {
    let data;
    let returnedData = [];
    const dateOptions = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    
    await query("SELECT * FROM reservations_view WHERE id=$3 AND (canvas_user_id=$1 OR canvas_group_id=ANY($2)) ORDER BY time_start ASC", [ 
        user_id,
        groups,
        reservation_id
    ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    if (data !== undefined && data.length) {
        data.forEach(reservation => {
            reservation.created_at_human_readable_sv = new Date(reservation.created_at).toLocaleDateString('sv-SE', dateOptions);
            reservation.time_human_readable_sv = new Date(reservation.time_start).toLocaleDateString('sv-SE', dateOptions) + " kl " + new Date(reservation.time_start).toLocaleTimeString('sv-SE', timeOptions) + "&ndash;" + new Date(reservation.time_end).toLocaleTimeString('sv-SE', timeOptions);
            
            returnedData.push(reservation);
        });
    }

    return returnedData[0];
}

/* Delete one reservation, calling user must be reserver or in correct group */
async function deleteReservation(user_id, groups, reservation_id) {
    await query("UPDATE reservation SET deleted_at=now(), deleted_by=$1 WHERE id=$3 AND (canvas_user_id=$1 OR canvas_group_id=ANY($2))", [ 
        user_id,
        groups,
        reservation_id
    ]).then((result) => {
        console.log(result);
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
}

/* Makes a reservation for a slot time, either individual or group */
async function createSlotReservation(slot_id, user_id, group_id, message) {
    let data;

    // Load data about the slot being reserved
    const slot = await getSlot(slot_id);

    // Always set group_id to null if individual
    if (slot.type == "individual") {
        group_id = null;
    }

    // Check if number of reservations are max (should already be checked)
    if (slot.res_max == slot.res_now) {
        throw new Error("Max antal platser är uppnått, kan inte boka.");
    }

    await query("INSERT INTO reservation (slot_id, canvas_user_id, canvas_group_id, message, created_by) VALUES ($1, $2, $3, $4, $2) RETURNING id", [ 
        slot_id,
        user_id,
        group_id,
        message
    ]).then((result) => {
        data = result.rows[0];
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    return data;
}

async function getValidCourses(canvas_course_id, date) {
    let data;

    await query("SELECT id, name FROM course WHERE date_start <= $1 AND date_end >= $1", [ date ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
    });
    
    return data;
}

async function getCourse(id) {
    let data;

    await query("SELECT * FROM course WHERE id = $1", [ id ]).then((result) => {
        data = result.rows[0];
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    return data;
}

async function getValidInstructors(canvas_course_id) {
    let data;

    await query("SELECT id, name FROM instructor WHERE canvas_course_id=$1", [ canvas_course_id ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    return data;
}

async function getValidLocations(canvas_course_id) {
    let data;

    await query("SELECT id, name FROM location WHERE canvas_course_id=$1", [ canvas_course_id ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    return data;
}

async function createSlots(data) {
    const { course_id, instructor_id, location_id, slots } = data;

    for (const slot of slots) {
        console.log(slot);
        await query("INSERT INTO slot (course_id, instructor_id, location_id, time_start, time_end) VALUES ($1, $2, $3, $4, $5)", [
            course_id,
            instructor_id,
            location_id,
            slot.start,
            slot.end
        ]).then((result) => {
            log.info(result);
        }).catch((error) => {
            log.error(error);
            throw new Error(error);
        });
    }
}

async function updateSlot(id, course_id, instructor_id, location_id, time_start, time_end) {
    await query("UPDATE slot SET course_id=$2, instructor_id=$3, location_id=$4, time_start=$5, time_end=$6, updated_at=now() WHERE id=$1", [
        id,
        course_id,
        instructor_id,
        location_id,
        time_start,
        time_end
    ]).then((result) => {
        log.info(result);
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
}

async function deleteSlot(id) {
    await query("UPDATE slot SET deleted_at=now() WHERE id=$1", [ id ]).then((result) => {
        log.info(result);
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
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
    getAllSlots,
    getSlot,
    getSlotReservations,
    getReservationsForUser,
    getReservation,
    createSlotReservation,
    deleteReservation,
    getValidCourses,
    getValidInstructors,
    getValidLocations,
    createSlots,
    updateSlot,
    deleteSlot,
    checkDatabaseVersion,
}
