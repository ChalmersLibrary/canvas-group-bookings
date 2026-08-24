'use strict';

const log = require('../../logging/');

/*
 * One line for every write that reaches the router this is mounted on.
 *
 * Middleware rather than a call in each handler, so an endpoint added later is covered without
 * anyone remembering to add it, and so the shape of the line cannot drift between endpoints.
 *
 * The course id is the field worth having. Which course a request acts on is resolved from the
 * session, and a session is shared by every tab in a browser, so a write can land on a course the
 * operator was not looking at. Nothing else in the application records which one it was, and the
 * result is indistinguishable from an intended change.
 *
 * Reads are left out: they are the bulk of the traffic and none of them changes anything. The
 * request body is left out too, because instructor records carry names and email addresses.
 */
const logWrites = (area) => (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
        return next();
    }

    /* On finish rather than up front, so the line states what happened rather than what was
       attempted, and carries the status the client actually got. */
    res.on('finish', () => {
        const detail = {
            area,
            method: req.method,
            path: req.baseUrl + req.path,
            course_id: res.locals.courseId,
            canvas_user_id: req.session?.user?.id,
            administrator: req.session?.user?.isAdministrator === true,
            instructor: req.session?.user?.isInstructor === true,
            status: res.statusCode
        };

        /* Nothing awaits this, and a rejection outside a request's own chain would reach the
           process rather than a handler. Failing to log must not stop the application. */
        Promise.resolve(
            log.info(`${area} write ${req.method} ${detail.path} in course ${detail.course_id} by ${detail.canvas_user_id}, status ${detail.status}.`, detail)
        ).catch(() => {});
    });

    next();
};

module.exports = { logWrites };
