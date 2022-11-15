-- Mockup some data, bound to Canvas course id 1508 (Rolf Anakin testkurs in Playground).
-- This file is not read by application, statements must be manually made in db connection.

INSERT INTO "segment" ("name", "canvas_course_id") VALUES ('Fackspråks tillfällen', 1508);
INSERT INTO "segment" ("name", "canvas_course_id") VALUES ('Bibliotekets tillfällen', 1508);

INSERT INTO "course" ("name", "segment_id", "canvas_course_id", "is_group", "is_individual", "max_groups", "max_individuals", "message_all_when_full") VALUES ('Fackspråk handledningstillfälle 1',1,1508,true,false,2,0,true);
INSERT INTO "course" ("name", "segment_id", "canvas_course_id", "is_group", "is_individual", "max_groups", "max_individuals") VALUES ('Fackspråk handledningstillfälle 2',1,1508,true,false,1,0);
INSERT INTO "course" ("name", "segment_id", "canvas_course_id", "is_group", "is_individual", "max_groups", "max_individuals") VALUES ('Fackspråk handledningstillfälle 3',1,1508,true,false,1,0);
INSERT INTO "course" ("name", "segment_id", "canvas_course_id", "is_group", "is_individual", "max_groups", "max_individuals") VALUES ('Biblioteket infoworkshop',2,1508,true,false,10,0);
INSERT INTO "course" ("name", "segment_id", "canvas_course_id", "is_group", "is_individual", "max_groups", "max_individuals") VALUES ('Fackspråk föreläsning 1',1,1508,false,true,0,100);

INSERT INTO "instructor" ("name", "email", "canvas_course_id", "canvas_user_id") VALUES ('Rolf Johansson', 'rolf.johansson@chalmers.se', 1508, 1618);
INSERT INTO "instructor" ("name", "email", "canvas_course_id", "canvas_user_id") VALUES ('Fia Börjesson', 'fibo@chalmers.se', 1508, 1058);
INSERT INTO "instructor" ("name", "email", "canvas_course_id", "canvas_user_id") VALUES ('Carl Johan Carlsson', 'caca@chalmers.se', 1508, 1060);
INSERT INTO "instructor" ("name", "email", "canvas_course_id", "canvas_user_id") VALUES ('Magnus Axelsson', 'magnax@chalmers.se', 1508, 8);
INSERT INTO "instructor" ("name", "email", "canvas_course_id", "canvas_user_id") VALUES ('Karin Ljungklint', 'karin.ljungklint@chalmers.se', 1508, 938);

INSERT INTO "canvas_course_instructor_mapping" ("canvas_course_id", "instructor_id") VALUES (1508, 1);
INSERT INTO "canvas_course_instructor_mapping" ("canvas_course_id", "instructor_id") VALUES (1508, 2);
INSERT INTO "canvas_course_instructor_mapping" ("canvas_course_id", "instructor_id") VALUES (1508, 3);
INSERT INTO "canvas_course_instructor_mapping" ("canvas_course_id", "instructor_id") VALUES (1508, 4);
INSERT INTO "canvas_course_instructor_mapping" ("canvas_course_id", "instructor_id") VALUES (1508, 5);

INSERT INTO "location" ("name", "description", "external_url") VALUES ('Calles ZOOM', 'Tillfället är digitalt och använder Zoom. Anslut med länken.', 'https://chalmers.zoom.us/j/64438289001');
INSERT INTO "location" ("name", "external_url") VALUES ('Fias ZOOM', 'https://chalmers.zoom.us/j/69630313118');
INSERT INTO "location" ("name", "description") VALUES ('Seminarierum 1', 'För att enklast komma till Seminarierum 1: gå in genom bibliotekets nya glasentré (närmast Kemigården) och gå upp för stora trappan rakt fram. Seminarierum 1 ligger sedan till vänster.');
INSERT INTO "location" ("name", "description") VALUES ('Language Lab/Språklabb', 'För att komma till Fackspråk - språklabb går ni in på biblioteket och fortsätter förbi lånedisken fram till spiraltrappan. Vid trappan ska ni en våning ner. På våningen under ska ni till höger efter trappan och ta er till studentköket och lunchrummet. När ni kommit till lunchrummet ser ni Fackspråks lokaler samt lässtudion snett till vänster.');
INSERT INTO "location" ("name", "campus_maps_id", "description") VALUES ('Språkytan', '3949e862-7323-47d7-ab15-bb56c429fb62', 'Lokal beskrivning parallellt med länk till Chalmers Maps.');

INSERT INTO "canvas_course_location_mapping" ("canvas_course_id", "location_id") VALUES (1508, 1);
INSERT INTO "canvas_course_location_mapping" ("canvas_course_id", "location_id") VALUES (1508, 2);
INSERT INTO "canvas_course_location_mapping" ("canvas_course_id", "location_id") VALUES (1508, 3);
INSERT INTO "canvas_course_location_mapping" ("canvas_course_id", "location_id") VALUES (1508, 4);
INSERT INTO "canvas_course_location_mapping" ("canvas_course_id", "location_id") VALUES (1508, 5);
