# canvas-group-bookings
A group booking tool for use with Canvas, with LTI and OAuth2.

The tool is intended to be started as an external LTI app from the course navigation context. From there the app gets the course context and the logged in user's enrollment state and course role together with (via user generated Access Token for reading in Canvas API) the group(s) the user belongs to (when having the Student role). 


## Setup

For all this to work, these steps are required:

1. Add a Developer Key (API) in the Admin section of Canvas, which is environment variables ```AUTH_CLIENT_ID``` and ```AUTH_CLIENT_SECRET```. Redirect URIs is your installation of the Booking tool, suffixed with /callback, for example ```http://localhost:3000/callback```.

2. Add LTI Consumer Key(s) and Shared Secret(s) into enviroment variable ```LTI_KEYS```, in the format:
```<Consumer Key>:<Shared Secret>[,<Consumer Key>:<Shared Secret>,...]```.

3. Add the tool in Canvas on the level you wish, it could be on Account Level or Course Level. The important thing is to add it with XML to get a correct link into the Course Navigation. There are documentation on how to do this from Instructure and also an example file in ```src/lti/example_lti.xml```. Include the correct Consumer Key and Consumer Secret.

4. Important: when adding the tool as an External Application, make sure that ```Privacy Level``` is set to ```Public``` and ```Custom Fields``` includes ```custom_canvas_roles=$Canvas.membership.roles```. This is to make sure the user gets the correct enrolled role for the course.

5. (Optional) If you want the system to send confirmation messages in Canvas (via Inbox) you need to setup a user account in Canvas with Administrative privileges, to be able to send messages via the Conversations API. On this account, generate an Access Token and use this token in the environment variable ```CONVERSATION_ROBOT_API_TOKEN```.


## Requirements

This application requires PostgreSQL (12) as a database backend for storing time slots, reservations etc. Also sessions are stored in database. It is possible that other database engines could be used, all SQL code is in ```db/setup.sql``` and database upgrades are handled with a basic increasing number pattern, ie ```setup_2.sql``` etc for db upgrades from version 1 (baseline). 

All other requirements are Node-related modules specified in ```packages.json```.


## Deployment notes for Chalmers

For our Chalmers environment, the development branch is automatically built and deployed to the development slot in the Azure Webapp.

The main branch is built and deployed to the staging slot in the Azure Webapp. Some sanity testing can be done in this slot, which is then manually swapped with the production slot.
