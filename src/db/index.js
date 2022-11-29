'use strict';

const { Pool } = require('pg');
const fs = require('fs');
const log = require('../logging')
const utils = require('../utilities');

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

/**
 * Returns data about a specific segment
 * 
 * @param {integer} segment_id Id for segment
 * @returns 
 */
async function getSegment(segment_id) {
    let data;

    await query("SELECT * FROM segment s WHERE s.id=$1", [
        segment_id
    ]).then((result) => {
        data = result.rows[0];
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });

    return data;
}

/**
 * Returns possible segments for a Canvas course, segments are used in courses and slots 
 * to enable easy filtering of slots.
 */
async function getSegments(canvas_course_id) {
    let data;

    await query("SELECT * FROM segment s WHERE s.canvas_course_id=$1", [
        canvas_course_id
    ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });

    return data;
}

/**
 * Get all segments for a course, with statistics
 * @param {number} canvas_course_id Id for Canvas course
 * @returns 
 */
async function getSegmentsWithStatistics(canvas_course_id) {
    let data;

    await query("SELECT s.*,(SELECT count(DISTINCT id)::integer AS courses FROM course WHERE segment_id=s.id) FROM segment s WHERE s.canvas_course_id=$1", [
        canvas_course_id
    ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });

    return data;
}

/**
 * Returns all slots, available or not, for a specific Canvas course, starting from a specific date
 */
async function getAllSlots(canvas_course_id, date) {
    let data;
    let returnedData = [];
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
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
            slot.time_human_readable_sv = utils.capitalizeFirstLetter(new Date(slot.time_start).toLocaleDateString('sv-SE', dateOptions) + " kl " + new Date(slot.time_start).toLocaleTimeString('sv-SE', timeOptions) + "–" + new Date(slot.time_end).toLocaleTimeString('sv-SE', timeOptions));
            returnedData.push(slot);
        });
    }

    return returnedData;
}

/**
 * Returns all slots, available or not, for a specific Canvas course and a segment, starting from a specific date
 */
 async function getAllSlotsInSegment(canvas_course_id, segment_id, date) {
    let data;
    let returnedData = [];
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };

    await query("SELECT * FROM slots_view s WHERE s.canvas_course_id = $1 AND s.course_segment_id = $2 AND s.time_start >= $3", [
        canvas_course_id,
        segment_id,
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
            slot.time_human_readable_sv = utils.capitalizeFirstLetter(new Date(slot.time_start).toLocaleDateString('sv-SE', dateOptions) + " kl " + new Date(slot.time_start).toLocaleTimeString('sv-SE', timeOptions) + "–" + new Date(slot.time_end).toLocaleTimeString('sv-SE', timeOptions));
            returnedData.push(slot);
        });
    }

    return returnedData;
}

async function getSlot(id) {
    let data;
    let returnedData = [];
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };

    await query("SELECT * FROM slots_view WHERE id = $1", [ id ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
    });

    /* TODO: think about if these additions/conversions should be done outside, and this should be just clean db code? */
    if (data !== undefined && data.length) {
        data.forEach(slot => {
            slot.time_human_readable_sv = utils.capitalizeFirstLetter(new Date(slot.time_start).toLocaleDateString('sv-SE', dateOptions) + " kl " + new Date(slot.time_start).toLocaleTimeString('sv-SE', timeOptions) + "–" + new Date(slot.time_end).toLocaleTimeString('sv-SE', timeOptions));
            returnedData.push(slot);
        });
    }

    return returnedData[0];
}

/* Get reservations for a slot, full view */
async function getSlotReservations(id) {
    let data;

    await query("SELECT * FROM reservations_view WHERE slot_id=$1", [ id ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
    });
    
    return data;
}

/* Get reservations for a slot, simple view (for end user) */
async function getSimpleSlotReservations(id) {
    let data;

    await query("SELECT canvas_group_id, canvas_group_name, is_group, is_individual, max_groups, max_individuals, res_now FROM reservations_view WHERE slot_id = $1", [ id ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
    });
    
    return data;
}

/* Get some more information on reservations for a slot (instructor) */
async function getExtendedSlotReservations(id) {
    let data;

    await query("SELECT canvas_group_id, canvas_group_name, canvas_user_id, canvas_user_name, type, max_groups, max_individuals, res_now FROM reservations_view WHERE slot_id = $1", [ id ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
    });
    
    return data;
}

async function getAllSlotsForInstructor(canvas_course_id, instructor_id, date) {
    let data;
    let returnedData = [];
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };

    await query("SELECT s.* FROM slots_view s, instructor i WHERE s.canvas_course_id = $1 AND s.time_start >= $3 AND s.instructor_id = i.id AND i.canvas_user_id=$2 ORDER BY s.time_start ASC", [
        canvas_course_id,
        instructor_id,
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
            slot.time_human_readable_sv = utils.capitalizeFirstLetter(new Date(slot.time_start).toLocaleDateString('sv-SE', dateOptions) + " kl " + new Date(slot.time_start).toLocaleTimeString('sv-SE', timeOptions) + "–" + new Date(slot.time_end).toLocaleTimeString('sv-SE', timeOptions));
            returnedData.push(slot);
        });
    }

    return returnedData;
}

async function getReservationsForUser(canvas_course_id, user_id, groups) {
    let data;
    let returnedData = [];
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    
    await query("SELECT * FROM reservations_view WHERE canvas_course_id = $1 AND (canvas_user_id = $2 OR canvas_group_id = ANY ($3)) ORDER BY is_passed, time_start ASC", [ 
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
            reservation.created_at_human_readable_sv = utils.capitalizeFirstLetter(new Date(reservation.created_at).toLocaleDateString('sv-SE', dateOptions));
            reservation.time_human_readable_sv = utils.capitalizeFirstLetter(new Date(reservation.time_start).toLocaleDateString('sv-SE', dateOptions) + " kl " + new Date(reservation.time_start).toLocaleTimeString('sv-SE', timeOptions) + "–" + new Date(reservation.time_end).toLocaleTimeString('sv-SE', timeOptions));
            
            returnedData.push(reservation);
        });
    }

    return returnedData;
}

/* Get one reservation, calling user must be reserver or in correct group */
async function getReservation(user_id, groups, reservation_id) {
    let data;
    let returnedData = [];
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
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
            reservation.created_at_human_readable_sv = utils.capitalizeFirstLetter(new Date(reservation.created_at).toLocaleDateString('sv-SE', dateOptions));
            reservation.time_human_readable_sv = utils.capitalizeFirstLetter(new Date(reservation.time_start).toLocaleDateString('sv-SE', dateOptions) + " kl " + new Date(reservation.time_start).toLocaleTimeString('sv-SE', timeOptions) + "–" + new Date(reservation.time_end).toLocaleTimeString('sv-SE', timeOptions));
            
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
async function createSlotReservation(slot_id, user_id, user_name, group_id, group_name, message) {
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

    await query("INSERT INTO reservation (slot_id, canvas_user_id, canvas_user_name, canvas_group_id, canvas_group_name, message, created_by) VALUES ($1, $2, $3, $4, $5, $6, $2) RETURNING id", [ 
        slot_id,
        user_id,
        user_name,
        group_id,
        group_name,
        message
    ]).then((result) => {
        data = result.rows[0];
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    return data;
}

async function getNumberOfReservations(user_id, groups) {
    let data;
    
    await query("SELECT count(*) FROM reservations_view WHERE (canvas_user_id=$1 OR canvas_group_id=ANY($2))", [ 
        user_id,
        groups
    ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });

    return data[0];
}

async function getValidCourses(canvas_course_id) {
    let data;

    await query("SELECT * FROM course WHERE canvas_course_id=$1 AND deleted_at IS NULL", [ canvas_course_id ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
    });
    
    return data;
}

async function getCourseWithStatistics(course_id) {
    let data;

    await query("SELECT c.*, " +
                "(SELECT COUNT(*)::integer AS slots FROM slots_view sv WHERE sv.course_id=c.id), " +
                "(SELECT COUNT(*)::integer AS slots_all FROM slot s WHERE s.course_id=c.id), " +
                "(SELECT COALESCE(SUM(res_max), 0)::integer AS spots FROM slots_view sv WHERE sv.course_id=c.id), " +
                "(SELECT COUNT(rv.*)::integer AS reservations FROM reservations_view rv, slot s WHERE rv.slot_id=s.id AND s.course_id=c.id), " +
                "(SELECT COUNT(r.*)::integer AS reservations_all FROM reservation r, slot s WHERE r.slot_id=s.id AND s.course_id=c.id), " +
                "(SELECT COUNT(r.*)::integer AS deleted FROM reservation r, slot s WHERE r.deleted_at IS NOT NULL AND r.slot_id=s.id AND s.course_id=c.id) " +
                "FROM course c " + 
                "WHERE c.id=$1", [ course_id ]).then((result) => {
        data = result.rows[0];
    }).catch((error) => {
        log.error(error);
    });
    
    return data;
}

async function getAllCoursesWithStatistics(canvas_course_id) {
    let data;

    await query("SELECT c.*, " +
                "(SELECT COUNT(*)::integer AS slots FROM slots_view sv WHERE sv.course_id=c.id), " +
                "(SELECT COALESCE(SUM(res_max), 0)::integer AS spots FROM slots_view sv WHERE sv.course_id=c.id), " +
                "(SELECT COUNT(rv.*)::integer AS reservations FROM reservations_view rv, slot s WHERE rv.slot_id=s.id AND s.course_id=c.id), " +
                "(SELECT COUNT(r.*)::integer AS deleted FROM reservation r, slot s WHERE r.deleted_at IS NOT NULL AND r.slot_id=s.id AND s.course_id=c.id) " +
                "FROM course c " + 
                "WHERE c.deleted_at IS NULL AND c.canvas_course_id=$1", [ canvas_course_id ]).then((result) => {
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

/**
 * Create a new course for a specific Canvas course, with lots of attributes.
 * Returns the created course id.
 */
async function createCourse(canvas_course_id, canvas_user_id, parameters) {
    let data;

    let {
        segment_id, name, description, is_group, is_individual, max_groups, max_individuals, max_per_type, default_slot_duration_minutes, 
        cancellation_policy_hours, message_is_mandatory, message_all_when_full, message_cc_instructor, message_confirmation_body, message_full_body, message_cancelled_body
    } = parameters;

    if (is_group) {
        max_individuals = null;
    }
    else if (is_individual) {
        max_groups = null;
    }

    if (message_confirmation_body == '') {
        message_confirmation_body = null;
    }
    if (message_full_body == '') {
        message_full_body = null;
    }
    if (message_cancelled_body == '') {
        message_cancelled_body = null;
    }

    await query("INSERT INTO course (canvas_course_id, segment_id, name, description, is_group, is_individual, max_groups, max_individuals, max_per_type, default_slot_duration_minutes, cancellation_policy_hours, message_is_mandatory, message_all_when_full, message_cc_instructor, message_confirmation_body, message_full_body, message_cancelled_body, created_by) " +
                "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id", [ 
        canvas_course_id,
        segment_id, 
        name, 
        description, 
        is_group, 
        is_individual, 
        max_groups, 
        max_individuals, 
        max_per_type, 
        default_slot_duration_minutes, 
        cancellation_policy_hours, 
        message_is_mandatory, 
        message_all_when_full, 
        message_cc_instructor, 
        message_confirmation_body, 
        message_full_body, 
        message_cancelled_body,
        canvas_user_id
    ]).then((result) => {
        data = result.rows[0];
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });

    return data;
}

/**
 * Update information about a course.
 */
async function updateCourse(course_id, canvas_user_id, parameters) {
    let {
        segment_id, name, description, is_group, is_individual, max_groups, max_individuals, max_per_type, default_slot_duration_minutes, 
        cancellation_policy_hours, message_is_mandatory, message_all_when_full, message_cc_instructor, message_confirmation_body, message_full_body, message_cancelled_body
    } = parameters;

    if (is_group) {
        max_individuals = null;
    }
    else if (is_individual) {
        max_groups = null;
    }

    if (message_confirmation_body == '') {
        message_confirmation_body = null;
    }
    if (message_full_body == '') {
        message_full_body = null;
    }
    if (message_cancelled_body == '') {
        message_cancelled_body = null;
    }

    await query("UPDATE course SET segment_id=$1, name=$2, description=$3, is_group=$4, is_individual=$5, max_groups=$6, max_individuals=$7, max_per_type=$8, default_slot_duration_minutes=$9, " +
                "cancellation_policy_hours=$10, message_is_mandatory=$11, message_all_when_full=$12, message_cc_instructor=$13, message_confirmation_body=$14, message_full_body=$15, message_cancelled_body=$16, " +
                "updated_at=now(), updated_by=$17 WHERE id=$18", [ 
        segment_id, 
        name, 
        description, 
        is_group, 
        is_individual, 
        max_groups, 
        max_individuals, 
        max_per_type, 
        default_slot_duration_minutes, 
        cancellation_policy_hours, 
        message_is_mandatory, 
        message_all_when_full, 
        message_cc_instructor, 
        message_confirmation_body, 
        message_full_body, 
        message_cancelled_body,
        canvas_user_id,
        course_id
    ]).then((result) => {
        log.info(result);
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
}

async function deleteCourse(course_id, canvas_user_id) {
    await query("UPDATE course SET deleted_at=now(), deleted_by=$1 WHERE id=$2", [
        canvas_user_id,
        course_id
    ]).then((result) => {
        log.info(result);
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
}

async function getValidInstructors(canvas_course_id) {
    let data;

    await query("SELECT DISTINCT i.id, i.name FROM instructor i, canvas_course_instructor_mapping c WHERE i.id=c.instructor_id AND c.canvas_course_id=$1", [ 
        canvas_course_id 
    ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    return data;
}

async function getInstructor(id) {
    let data;

    await query("SELECT * FROM instructor WHERE id = $1", [ id ]).then((result) => {
        data = result.rows[0];
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    return data;
}

async function getInstructorWithStatistics(canvas_course_id, instructor_id) {
    let data;

    await query("SELECT DISTINCT i.*,(SELECT count(DISTINCT s.id)::integer AS slots FROM slot s, course c2 WHERE s.instructor_id=i.id AND s.course_id=c2.id AND c2.canvas_course_id=$1) FROM instructor i, canvas_course_instructor_mapping c WHERE i.id=c.instructor_id AND c.canvas_course_id=$1 AND i.id=$2", [ 
        canvas_course_id,
        instructor_id 
    ]).then((result) => {
        data = result.rows[0];
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });

    return data;
}

async function getInstructorsWithStatistics(canvas_course_id) {
    let data;

    await query("SELECT DISTINCT i.*,(SELECT count(DISTINCT s.id)::integer AS slots FROM slot s, course c2 WHERE s.instructor_id=i.id AND s.course_id=c2.id AND c2.canvas_course_id=$1) FROM instructor i, canvas_course_instructor_mapping c WHERE i.id=c.instructor_id AND c.canvas_course_id=$1", [ 
        canvas_course_id 
    ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });

    return data;
}

async function getAllInstructors() {
    let data;

    await query("SELECT * FROM instructor ORDER BY name").then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    return data;
}

async function createInstructor(canvas_user_id, name, email) {
    let data;

    await query("INSERT INTO instructor (canvas_user_id, name, email) VALUES ($1, $2, $3) RETURNING id", [
        canvas_user_id,
        name,
        email
    ]).then((result) => {
        data = result.rows[0];
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    return data;
}

async function connectInstructor(canvas_course_id, instructor_id) {
    let data;

    await query("INSERT INTO canvas_course_instructor_mapping (canvas_course_id, instructor_id) VALUES ($1, $2) RETURNING id", [
        canvas_course_id,
        instructor_id
    ]).then((result) => {
        data = result.rows[0];
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    return data;
}

async function disconnectInstructor(canvas_course_id, instructor_id) {
    await query("DELETE FROM canvas_course_instructor_mapping WHERE canvas_course_id=$1 AND instructor_id=$2", [
        canvas_course_id,
        instructor_id
    ]).then((result) => {
        log.info(result);
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
}

async function replaceConnectedInstructor(canvas_course_id, instructor_id, new_instructor_id) {
    await query("UPDATE slot SET instructor_id=$3 FROM course WHERE slot.instructor_id=$2 AND slot.course_id=course.id AND course.canvas_course_id=$1", [
        canvas_course_id,
        instructor_id,
        new_instructor_id
    ]).then((result) => {
        log.info(result);
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
}

async function getValidLocations(canvas_course_id) {
    let data;

    await query("SELECT DISTINCT l.id, l.name FROM location l, canvas_course_location_mapping c WHERE l.id=c.location_id AND c.canvas_course_id=$1", [ canvas_course_id ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    return data;
}

async function getLocationWithStatistics(canvas_course_id, location_id) {
    let data;

    await query("SELECT DISTINCT l.*,(SELECT count(DISTINCT s.id)::integer AS slots FROM slot s, course c2 WHERE s.location_id=l.id AND s.course_id=c2.id AND c2.canvas_course_id=$1) FROM location l, canvas_course_location_mapping c WHERE l.id=c.location_id AND c.canvas_course_id=$1 AND l.id=$2", [ 
        canvas_course_id,
        location_id
    ]).then((result) => {
        data = result.rows[0];
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });

    return data;
}
async function getLocationsWithStatistics(canvas_course_id) {
    let data;

    await query("SELECT DISTINCT l.*,(SELECT count(DISTINCT s.id)::integer AS slots FROM slot s, course c2 WHERE s.location_id=l.id AND s.course_id=c2.id AND c2.canvas_course_id=$1) FROM location l, canvas_course_location_mapping c WHERE l.id=c.location_id AND c.canvas_course_id=$1", [ 
        canvas_course_id 
    ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });

    return data;
}

async function getAllLocations() {
    let data;

    await query("SELECT * FROM location ORDER BY name").then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    return data;
}

async function getLocation(location_id) {
    let data;

    await query("SELECT * FROM location WHERE id=$1", [ 
        location_id 
    ]).then((result) => {
        data = result.rows[0];
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    return data;
}

async function createLocation(name, description, external_url, campus_maps_id) {
    let data;

    await query("INSERT INTO location (name, description, external_url, campus_maps_id) VALUES ($1, $2, $3, $4) RETURNING id", [
        name,
        description,
        external_url,
        campus_maps_id
    ]).then((result) => {
        data = result.rows[0];
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    return data;
}

async function updateLocation(id, name, description, external_url, campus_maps_id) {
    let data;

    await query("UPDATE location SET name=$2, description=$3, external_url=$4, campus_maps_id=$5 WHERE id=$1", [
        id,
        name,
        description,
        external_url,
        campus_maps_id
    ]).then((result) => {
        data = result.rows[0];
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    return data;
}

async function connectLocation(canvas_course_id, location_id) {
    let data;

    await query("INSERT INTO canvas_course_location_mapping (canvas_course_id, location_id) VALUES ($1, $2) RETURNING id", [
        canvas_course_id,
        location_id
    ]).then((result) => {
        data = result.rows[0];
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    return data;
}

async function disconnectLocation(canvas_course_id, location_id) {
    await query("DELETE FROM canvas_course_location_mapping WHERE canvas_course_id=$1 AND location_id=$2", [
        canvas_course_id,
        location_id
    ]).then((result) => {
        log.info(result);
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
}

async function replaceConnectedLocation(canvas_course_id, location_id, new_location_id) {
    await query("UPDATE slot SET location_id=$3 FROM course WHERE slot.location_id=$2 AND slot.course_id=course.id AND course.canvas_course_id=$1", [
        canvas_course_id,
        location_id,
        new_location_id
    ]).then((result) => {
        log.info(result);
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
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

async function addCanvasConversationLog(slot_id, reservation_id, canvas_course_id, canvas_recipients, message_subject, message_body) {
    let data;

    await query("INSERT INTO canvas_conversation_log (slot_id, reservation_id, canvas_course_id, canvas_recipients, message_subject, message_body) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id", [ 
        slot_id, 
        reservation_id, 
        canvas_course_id, 
        canvas_recipients, 
        message_subject, 
        message_body
    ]).then((result) => {
        data = result.rows[0];
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
    
    return data;
}

/**
 * FUNCTIONS FOR ADMINISTRATION
 */

/**
 * Returns an array of Canvas Group Category Ids that are force-filtered for a specific Canvas Course Id
 */
async function getCourseGroupCategoryFilter(canvas_course_id) {
    let data;
    let returnedData = [];

    await query("SELECT DISTINCT canvas_group_category_id FROM canvas_course_group_category_mapping c WHERE c.canvas_course_id=$1", [
        canvas_course_id
    ]).then((result) => {
        data = result.rows;
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });

    if (data !== undefined && data.length) {
        data.forEach(mapping => {
            returnedData.push(mapping.canvas_group_category_id);
        });
    }

    return returnedData;
}

/**
 * Updates Canvas connection in db with possible mapping for group category filtering
 */
async function updateCanvasConnection(canvas_course_id, group_category_mappings) {
    await query("DELETE FROM canvas_course_group_category_mapping WHERE canvas_course_id=$1", [ 
        canvas_course_id
    ]).then((result) => {
        for (const group_category_id of group_category_mappings) {
            query("INSERT INTO canvas_course_group_category_mapping (canvas_course_id, canvas_group_category_id) VALUES ($1, $2)", [
                canvas_course_id,
                group_category_id
            ]);
        }
    }).catch((error) => {
        log.error(error);
        throw new Error(error);
    });
}



async function checkDatabaseVersion() {
    let run_setup = false;
    let check_new_version = true;
    let current_version = 0;
    let latest_applied_version = 0;

    await query("SELECT db_version FROM version ORDER BY applied_at DESC LIMIT 1").then((result) => {
        if (result.rows.length > 0) {
            current_version = result.rows[0].db_version;
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
        latest_applied_version = 1;
    }

    while (check_new_version) {
        await query("SELECT db_version FROM version ORDER BY applied_at DESC LIMIT 1").then(async (result) => {
            if (result.rows.length > 0) {
                current_version = result.rows[0].db_version;
                console.log("Current db_version is " + current_version);

                if (current_version < latest_applied_version) {
                    console.error("Db version mismatch!");
                    check_new_version = false;
                }
                else {
                    let file = "src/db/setup_" + (current_version + 1) + ".sql";
    
                    if (fs.existsSync(file)) {
                        let sql = fs.readFileSync(file).toString();
            
                        await query(sql).then((result) => {
                            console.log(result);
                            console.log("Database updated from " + file);
                            latest_applied_version = (current_version + 1);
                        }).catch((error) => {
                            log.error(error);
                        });
                    }
                    else {
                        check_new_version = false;
                    }    
                }
            }
            else {
                log.error("No versions in the version table!");
                check_new_version = false;
            }
        }).catch((error) => {
            log.error(error);
            check_new_version = false;
        });    
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

async function applyVersion(version) {
    
}

module.exports = {
    query,
    getSegment,
    getSegments,
    getSegmentsWithStatistics,
    getCourseGroupCategoryFilter,
    getAllSlots,
    getAllSlotsInSegment,
    getSlot,
    getSlotReservations,
    getAllSlotsForInstructor,
    getSimpleSlotReservations,
    getExtendedSlotReservations,
    getReservationsForUser,
    getReservation,
    createSlotReservation,
    deleteReservation,
    getNumberOfReservations,
    getValidCourses,
    getCourseWithStatistics,
    getAllCoursesWithStatistics,
    createCourse,
    updateCourse,
    deleteCourse,
    getValidInstructors,
    getInstructorWithStatistics,
    getInstructorsWithStatistics,
    getInstructor,
    getAllInstructors,
    createInstructor,
    connectInstructor,
    disconnectInstructor,
    replaceConnectedInstructor,
    getValidLocations,
    getLocationWithStatistics,
    getLocationsWithStatistics,
    getAllLocations,
    getLocation,
    createLocation,
    updateLocation,
    connectLocation,
    disconnectLocation,
    replaceConnectedLocation,
    getCourse,
    createSlots,
    updateSlot,
    deleteSlot,
    addCanvasConversationLog,
    updateCanvasConnection,
    checkDatabaseVersion,
}
