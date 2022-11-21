'use strict';

const express = require('express');
const router = express.Router();

const routesApiInstructor = require('./instructor');
const routesApiAdmin = require('./admin');

router.use('/instructor', routesApiInstructor);
router.use('/admin', routesApiAdmin);

module.exports = router;
