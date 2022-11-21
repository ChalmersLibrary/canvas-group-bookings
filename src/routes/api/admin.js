'use strict';

const express = require('express');
const router = express.Router();
const log = require('../../logging/');
const db = require('../../db');
const utils = require('../../utilities');

/* ============================ */
/* API Endpoints, administrator */
/* ============================ */

/**
 * Create or update information about connections to Canvas, group category filtering etc
 */
router.put('/canvas/:id', async (req, res, next) => {
    if (req.session.user.isAdministrator) {
        try {
            const { group_category_mapping } = req.body;

            await db.updateCanvasConnection(req.params.id, group_category_mapping);

            return res.send({
                success: true,
                message: 'Canvas information was updated.'
            });
        }
        catch (error) {
            log.error(error);

            return res.send({
                success: false,
                message: error.message
            });
        }
    }
    else {
        next(new Error("You must have administrator privileges to access this page."));
    }
});

router.get('/course/:id', async (req, res, next) => {
    if (req.session.user.isAdministrator) {
        try {
            const course = await db.getCourse(req.params.id);
            const segments = await db.getSegments(course.canvas_course_id);

            return res.send({
                success: true,
                segments: segments,
                course: course
            });
        }
        catch (error) {
            log.error(error);

            return res.send({
                success: false,
                message: error.message
            });
        }
    }
    else {
        next(new Error("You must have administrator privileges to access this page."));
    }   
});

module.exports = router;
