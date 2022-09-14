'use strict';

const pkg = require('./package.json');
const fs = require('fs');
const bodyParser = require('body-parser');
const express = require('express');
const session = require('express-session');
const log = require('./src/logging/');
const pg = require('pg');
const fileStore = require('session-file-store')(session);
const pgSessionStore = require('connect-pg-simple')(session);
const helmet = require('helmet');
const cors = require('cors');
const auth = require('./src/auth/oauth2');
const lti = require('./src/lti/canvas');
const canvasApi = require('./src/api/canvas');

// Uncomment to use PostgreSQL
const db = require('./src/db');

const port = process.env.PORT || 3000;
const cookieMaxAge = 3600000 * 72; // 72h
const fileStoreOptions = { ttl: 3600 * 12, retries: 3 };
let developmentLtiData;

// PostgreSQL Session store

const sessionOptions = { 
    store: new pgSessionStore({
        pool: db,
        tableName: "user_session",
        createTableIfMissing: true
    }),
    name: process.env.SESSION_NAME ? process.env.SESSION_NAME : "LTI_TEST_SID",
    secret: process.env.SESSION_SECRET ? process.env.SESSION_SECRET : "keyboard cat dog mouse",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: cookieMaxAge  }
};


// Uncomment to use Session File Store
/*
const sessionOptions = { 
    store: new fileStore(fileStoreOptions),
    name: process.env.SESSION_NAME ? process.env.SESSION_NAME : "LTI_TEST_SID",
    secret: process.env.SESSION_SECRET ? process.env.SESSION_SECRET : "keyboard cat dog mouse",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: cookieMaxAge  }
};
*/

const app = express();

app.disable('X-Powered-By');

app.set('json spaces', 2);

app.use("/assets",
    express.static(__dirname + '/public/assets')
);
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(helmet({
    frameguard: false
}));
app.use(cors());

// Content Security Policy
app.use(function (req, res, next) {
    res.setHeader(
      'Content-Security-Policy', 
      "default-src 'self'; script-src 'self'; style-src 'self' cdn.jsdelivr.net; font-src 'self'; img-src 'self'; frame-src 'self'" + (process.env.CSP_FRAME_SRC_ALLOW ? " " + process.env.CSP_FRAME_SRC_ALLOW : "")
    );
    
    next();
});

if (process.env.NODE_ENV === "production") {
    app.set('trust proxy', 1);
    sessionOptions.cookie.secure = 'true';
    sessionOptions.cookie.sameSite = 'none'; 
}

if (process.env.NODE_ENV === 'development') {
    try {
        const data = fs.readFileSync('./mock-lti.json', 'utf8');
        developmentLtiData = data;
    }
    catch (err) {
        console.error(err);
    }
}

// Session options
app.use(session(sessionOptions));

// set the view engine to ejs
app.set('view engine', 'ejs');

// Handle LTI Launch
app.post('/lti', lti.handleLaunch('/'));

// Setup OAuth2 endpoints and communication
auth.setupAuthEndpoints(app, process.env.AUTH_REDIRECT_CALLBACK);

// Test
app.get('/test', async (req, res) => {
    await log.info("Testing endpoint requested.");

    req.session.test = true;

    let result = await db.query("SELECT version()").then((result) => {
            return res.send({
                status: 'up',
                session: req.session,
                result: result.rows
            });
        }).catch((error) => {
            console.error(error);
            
            return res.send({
                status: 'up',
                session: req.session,
                result: error
            });
    });

    await log.info("Db query done.");
});

app.get('/', async (req, res) => {
    // Just for fun to see that something is happening
    if (req.session.views) {
        req.session.views++;
    }
    else {
        req.session.views = 1;
    }

    console.log(req.session);
    console.log("Checking access token...");

    await auth.checkAccessToken(req).then(async (result) => {
        console.log(result);

        if (result.success === true) {
            // Mock session with LTI object in development
            if (process.env.NODE_ENV === 'development' && developmentLtiData) {
                req.session.lti = JSON.parse(developmentLtiData);
            }
            // Check that we have an LTI object in the session    
            if (req.session.lti) {
                // Populate user session with information based on LTI roles
                if(req.session.user && req.session.lti.roles) {
                    req.session.lti.roles.forEach((role) => {
                        console.log("LTI role: " + role);
                        if (role === "Instructor" || role === "Administrator") {
                            req.session.user.isAdministrator = true;
                        }
                        if (role === "Student" || role === "Learner") {
                            req.session.user.isAdministrator = false;
                        }
                    });
                }

                // Numerical course_id if running Public, if Anonymous we use context_id
                let courseId = req.session.lti.custom_canvas_course_id ? req.session.lti.custom_canvas_course_id : "lti_context_id:" + req.session.lti.context_id;
    
                // Load groups that the logged in user belongs to in the course context
                await canvasApi.getCourseGroups(courseId, req).then((courseGroups) => {
                    return res.render('pages/index', {
                        status: 'up',
                        version: pkg.version,
                        session: req.session,
                        groups: courseGroups
                    });
                }).catch((error) => {
                    console.error(error);

                    return res.render('pages/error', {
                        status: 'up',
                        version: pkg.version,
                        error: "CANVAS_API",
                        message: error
                    });
                });    
            }
            else {
                return res.render('pages/error', {
                    status: 'up',
                    version: pkg.version,
                    error: "NO_LTI_LAUNCH",
                    message: "This app must be launched at endpoint /lti to get the LTI context from Canvas. Contact an administrator to set it up correctly."
                });
            }
        }
        else {
            console.log("Redirect to auth flow...");
            return res.redirect("/auth");
        }    
    }).catch((error) => {
        console.error(error);
        return res.error(error);
    });
});

app.listen(port, () => console.log(`Application listening on port ${port}.`));

process.on('uncaughtException', (err) => {
    console.error("There was an uncaught error", err);
    process.exit(1); //mandatory (as per the Node docs)
});
