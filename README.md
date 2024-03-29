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

This application requires PostgreSQL (12) as a database backend for storing time slots, reservations etc. Also sessions are stored in database. It is possible that other database engines could be used, all SQL code is in ```db/setup.sql``` and database upgrades are handled with a basic increasing number pattern, ie ```setup_2.sql``` etc for db upgrades from version 1 (baseline). 

All other requirements are Node-related modules specified in ```packages.json```.


## Starting

To start on your local machine, just type ```npm run dev```. This should start nodemon and the application on port 3000. The first time, database tables and views will be created from ```db/setup.sql``` and then
the newer versions will be applied from sql files. Reloading the application will always check for new sql file versions to apply.

```js
> canvas-group-bookings@1.1.2 dev
> nodemon --trace-warnings app.js

[nodemon] 2.0.19
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): *.*
[nodemon] watching extensions: js,mjs,json
[nodemon] starting `node --trace-warnings app.js`
setting logger.level to debug because process.env.NODE_ENV=development
debug: This is not a production environment. {"timestamp":"2023-05-16T14:25:44.628Z"}
info: Application listening on port 3000. {"timestamp":"2023-05-16T14:25:44.636Z"}
info: Pool connected. {"timestamp":"2023-05-16T14:25:44.856Z"}
info: Pool connected. {"timestamp":"2023-05-16T14:25:44.873Z"}
info: Pool connected. {"timestamp":"2023-05-16T14:25:44.899Z"}
debug: Executed query {"0":{"duration":291,"rows":1,"text":"SELECT db_version FROM version ORDER BY applied_at DESC LIMIT 1"},"timestamp":"2023-05-16T14:25:44.919Z"}
debug: Executed query {"0":{"duration":302,"rows":1,"text":"SELECT to_regclass($1::text)"},"timestamp":"2023-05-16T14:25:44.942Z"}
debug: Executed query {"0":{"duration":42,"rows":1,"text":"SELECT db_version FROM version ORDER BY applied_at DESC LIMIT 1"},"timestamp":"2023-05-16T14:25:44.962Z"}
info: Current db_version is 5 {"timestamp":"2023-05-16T14:25:44.964Z"}
debug: Executed query {"0":{"duration":45,"rows":3,"text":"DELETE FROM \"user_session\" WHERE expire < to_timestamp($1)"},"timestamp":"2023-05-16T14:25:44.987Z"}
```


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
