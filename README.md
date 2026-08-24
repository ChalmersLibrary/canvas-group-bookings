# canvas-group-bookings
A group booking tool for use with Canvas, with LTI and OAuth2.

The tool is intended to be started as an external LTI app from the course navigation context. From there the app gets the course context and the logged in user's enrollment state and course role together with (via user generated Access Token for reading in Canvas API) the group(s) the user belongs to (when having the Student role). 

This application has been developed for Language and Communication and Chalmers Library, at the department of Communication and Learning in Science at Chalmers University of Technology.


## Setup

For all this to work, these steps are required:

1. Add a Developer Key (API) in the Admin section of Canvas, which is environment variables ```AUTH_CLIENT_ID``` and ```AUTH_CLIENT_SECRET```. Redirect URIs is your installation of the Booking tool, suffixed with /callback, for example ```http://localhost:3000/callback```.

2. Add LTI Consumer Key(s) and Shared Secret(s) into enviroment variable ```LTI_KEYS```, in the format:
```<Consumer Key>:<Shared Secret>[,<Consumer Key>:<Shared Secret>,...]```.

3. Add the tool in Canvas on the level you wish, it could be on Account Level or Course Level. The important thing is to add it with XML to get a correct link into the Course Navigation. There are documentation on how to do this from Instructure and also an example file in ```src/lti/example_lti.xml```. Include the correct Consumer Key and Consumer Secret.

4. Important: when adding the tool as an External Application, make sure that ```Privacy Level``` is set to ```Public``` and ```Custom Fields``` includes ```custom_canvas_roles=$Canvas.membership.roles```. This is to make sure the user gets the correct enrolled role for the course.

5. (Optional) If you want the system to send confirmation messages in Canvas (via Inbox) you need to setup a user account in Canvas, to be able to send messages via the Conversations API. On this account, generate an Access Token and use this token in the environment variable ```CONVERSATION_ROBOT_API_TOKEN```.

    1. If you are using an account that is NOT an Account Admin, you must add this user account to the course where the tool is being used, with Administrator role. This will make sure the account has access to sending messages to people in the course roster.

    2. If your course has visibility "institution", that means any user that can log in to Canvas can access the course and use the tool. In this case, adding the user account to the course roster has no effect, since it needs to send messages to any user in the Canvas account. In this case, the user account MUST be an Account Admin, so that it has access to sending messages to any user.

    3. If you have installed the tool for the whole account so course administrators can activate it via Course Navigation, it's probably impossible to add the user account to each course. In this case, you will have to make the account an Account Admin.


## Requirements

This application requires PostgreSQL (12) as a database backend for storing time slots, reservations etc. Also sessions are stored in database. It is possible that other database engines could be used, all SQL code is in ```src/db/setup.sql``` and database upgrades are handled with a basic increasing number pattern, ie ```setup_2.sql``` etc for db upgrades from version 1 (baseline). 

All other requirements are Node-related modules specified in ```packages.json```.


## Configuration

Copy ```.env_example``` to ```.env``` and fill it in. Every variable the application reads is listed there, with a note on the ones where a wrong value is not obvious from the outside. Both files stay out of version control.

The Postgres variables are read by the database driver rather than by this application, so they do not appear anywhere in the source.


## Running without Canvas

The tool is normally started by an LTI launch from Canvas, which is what supplies the course, the user's role and their enrollment state. For local development that launch can be mocked: copy ```mock-lti_example.json``` to ```mock-lti.json``` and edit it.

With ```NODE_ENV=development```, the file is read at startup and its contents become the LTI session on every request. **Only the launch is mocked.** Signing in still goes to the real Canvas named by ```AUTH_HOST```, the Canvas API is real, and the database is real — so a local run obtains genuine credentials for the account that signs in, and writes them to whatever ```PGDATABASE``` points at.

```custom_canvas_roles``` in that file decides what you are allowed to do locally, and ```custom_canvas_course_id``` decides which course you are working in. Both come from the file, not from Canvas.

Two things to expect: the file is read once at startup, so changes need a restart, and its contents replace the LTI session on every request, so a genuine launch against a local instance would be overwritten by it.


## Starting

Start it with ```npm run dev```, which runs the application on port 3000 and restarts it when a file under ```src```, ```views``` or ```app.js``` changes. Node does the watching itself, so there is nothing else to install.

The application must be started from the repository root. Several paths are resolved against the working directory, including the log files, the ```.env``` file and the migration files, and a missing migration file is indistinguishable from being up to date.

The first start creates the tables and views from ```src/db/setup.sql```, then applies each ```setup_<n>.sql``` in turn. Every start repeats that check, so a new file is applied by restarting. A migration that fails is logged and **does not stop the application**, which then serves on a half-applied schema, so the startup output is worth reading rather than glancing at.

Two lines say whether the start was healthy: one giving the port, and one naming the Canvas, database, runtime and log destination the instance is configured with. The second is the quickest way to confirm an instance is pointed where you think it is. In development the level is raised to debug and everything also goes to the console; in production only these and genuine events are written.


## Tests

```npm test``` runs the test suite. It needs no database and reaches nothing outside the machine; where a test needs a server to talk to, it starts one on the loopback address.

Every test file moves the process into a temporary directory before requiring anything from the application, so a run cannot write into the working copy and cannot find the ```.env``` or ```mock-lti.json``` belonging to the developer. That has to happen first in the file, because the logging module resolves its path when it is required.


## Student preview in the tool

Canvas built-in "Student view" will not work, as the tool uses the provided custom roles. However, if you are an administrator or teacher in the Canvas course or an Account Admin, you can change your role in the course roster to "Student" to view the tool as a student will see it. The tool will always look at the most local role first, provided that you have added ```custom_canvas_roles=$Canvas.membership.roles``` to the LTI configuration.


## Language and locale

The package "i18n" is used for translating the interface and backend messages. All translations can be found in the ```src/lang/locales``` folder. 

If you wish to add a translation, add the desired locale to ```src/lang/i18n.config.js``` and copy any existing translation file from the locales folder and name it according to the new locale. 

Some parts of the interface are translated in sub-folders of the ```views``` folder, for exampel ```views/en/pages/privacy/privacy.ejs```. In this case, only the first two characters of the locale (language) is used.

Note that Canvas sends the "presentation locale" in LTI data, and this is used. However, for some use cases where Canvas only returns two characters this string is fixed to a default full locale, including both language and country (for example "en" becomes "en-GB" and "sv" becomes "sv-SE"). This list of translations can be found in ```src/lti/canvas.js```.


## Deployment notes for Chalmers

For our Chalmers environment, the development branch is automatically built and deployed to the development slot in the Azure Webapp.

The main branch is built and deployed to the staging slot in the Azure Webapp. Some sanity testing can be done in this slot, which is then manually swapped with the production slot.
