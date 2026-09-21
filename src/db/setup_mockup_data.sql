-- Fictional mockup data, kept as a template for seeding a database with something to work against.
-- Every name, address, identifier and url below is invented and belongs to nobody. Replace them
-- before use: the Canvas course id and the instructor Canvas user ids have to be real ones from the
-- installation for the tool to recognise a launch, and the rest is there to show the shape.
-- The application does not read this file. The statements are run by hand in a database connection.

INSERT INTO "segment" ("name", "canvas_course_id") VALUES ('Språkstödets tillfällen', 12345);
INSERT INTO "segment" ("name", "canvas_course_id") VALUES ('Bibliotekets tillfällen', 12345);

INSERT INTO "course" ("name", "segment_id", "canvas_course_id", "is_group", "is_individual", "max_groups", "max_individuals", "message_all_when_full") VALUES ('Språkstöd handledningstillfälle 1',1,12345,true,false,2,0,true);
INSERT INTO "course" ("name", "segment_id", "canvas_course_id", "is_group", "is_individual", "max_groups", "max_individuals") VALUES ('Språkstöd handledningstillfälle 2',1,12345,true,false,1,0);
INSERT INTO "course" ("name", "segment_id", "canvas_course_id", "is_group", "is_individual", "max_groups", "max_individuals") VALUES ('Språkstöd handledningstillfälle 3',1,12345,true,false,1,0);
INSERT INTO "course" ("name", "segment_id", "canvas_course_id", "is_group", "is_individual", "max_groups", "max_individuals") VALUES ('Biblioteket infoworkshop',2,12345,true,false,10,0);
INSERT INTO "course" ("name", "segment_id", "canvas_course_id", "is_group", "is_individual", "max_groups", "max_individuals") VALUES ('Språkstöd föreläsning 1',1,12345,false,true,0,100);

INSERT INTO "instructor" ("name", "email", "canvas_user_id") VALUES ('Anna Andersson', 'anna.andersson@example.com', 1001);
INSERT INTO "instructor" ("name", "email", "canvas_user_id") VALUES ('Bertil Berg', 'bertil.berg@example.com', 1002);
INSERT INTO "instructor" ("name", "email", "canvas_user_id") VALUES ('Cecilia Dahl', 'cecilia.dahl@example.com', 1003);
INSERT INTO "instructor" ("name", "email", "canvas_user_id") VALUES ('David Ek', 'david.ek@example.com', 1004);
INSERT INTO "instructor" ("name", "email", "canvas_user_id") VALUES ('Elin Forsberg', 'elin.forsberg@example.com', 1005);

INSERT INTO "canvas_course_instructor_mapping" ("canvas_course_id", "instructor_id") VALUES (12345, 1);
INSERT INTO "canvas_course_instructor_mapping" ("canvas_course_id", "instructor_id") VALUES (12345, 2);
INSERT INTO "canvas_course_instructor_mapping" ("canvas_course_id", "instructor_id") VALUES (12345, 3);
INSERT INTO "canvas_course_instructor_mapping" ("canvas_course_id", "instructor_id") VALUES (12345, 4);
INSERT INTO "canvas_course_instructor_mapping" ("canvas_course_id", "instructor_id") VALUES (12345, 5);

INSERT INTO "location" ("name", "description", "external_url") VALUES ('Annas ZOOM', 'Tillfället är digitalt och använder Zoom. Anslut med länken.', 'https://example.com/j/00000000001');
INSERT INTO "location" ("name", "external_url") VALUES ('Cecilias ZOOM', 'https://example.com/j/00000000002');
INSERT INTO "location" ("name", "description") VALUES ('Seminarierum 1', 'Seminarierum 1 ligger en trappa upp från huvudentrén och sedan till vänster.');
INSERT INTO "location" ("name", "description") VALUES ('Language Lab/Språklabb', 'Språklabbet ligger en våning under entréplanet. Ta trappan ner och gå till höger, förbi lunchrummet.');
INSERT INTO "location" ("name", "campus_maps_id", "description") VALUES ('Språkytan', '00000000-0000-0000-0000-000000000000', 'Lokal beskrivning parallellt med länk till Chalmers Maps.');

INSERT INTO "canvas_course_location_mapping" ("canvas_course_id", "location_id") VALUES (12345, 1);
INSERT INTO "canvas_course_location_mapping" ("canvas_course_id", "location_id") VALUES (12345, 2);
INSERT INTO "canvas_course_location_mapping" ("canvas_course_id", "location_id") VALUES (12345, 3);
INSERT INTO "canvas_course_location_mapping" ("canvas_course_id", "location_id") VALUES (12345, 4);
INSERT INTO "canvas_course_location_mapping" ("canvas_course_id", "location_id") VALUES (12345, 5);
