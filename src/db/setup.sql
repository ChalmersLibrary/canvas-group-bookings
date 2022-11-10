-- Session storage is handled by connect-pg-simple

-- Some sort of version history, or look at https://dev.to/koistya/database-change-management-with-node-js-12dk
CREATE TABLE IF NOT EXISTS "version"
(
    "db_version" integer NOT NULL,
    "applied_at" timestamp DEFAULT now()
);

-- User API tokens
CREATE TABLE IF NOT EXISTS "user_token" 
(
    "canvas_user_id" integer NOT NULL,
    "canvas_domain" varchar NOT NULL,
    "data" json NOT NULL,
    "updated_at" timestamp DEFAULT now(),
    PRIMARY KEY ("canvas_user_id", "canvas_domain")
);

CREATE TABLE IF NOT EXISTS "course" 
(
    "id" serial,
    "canvas_course_id" integer NOT NULL,
    "name" varchar,
    "description" text,
    "is_group" boolean,
    "is_individual" boolean,
    "max_groups" integer,
    "max_individuals" integer,
    "max_per_type" integer NOT NULL DEFAULT 1,
    "default_slot_duration_minutes" integer,
    "cancellation_policy_hours" integer,
    "message_is_mandatory" boolean NOT NULL default false,
    "message_all_when_full" boolean NOT NULL default false,
    "message_cc_instructor" boolean NOT NULL DEFAULT true,
    "message_confirmation_body" text,
    "message_full_body" text,
    "message_cancelled_body" text,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "created_by" integer,
    "updated_at" timestamp,
    "updated_by" integer,
    "deleted_at" timestamp,
    "deleted_by" integer,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "instructor" 
(
    "id" serial,
    "name" varchar,
    "email" varchar,
    "canvas_user_id" integer,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "created_by" integer,
    "updated_at" timestamp,
    "updated_by" integer,
    "deleted_at" timestamp,
    "deleted_by" integer,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "location" 
(
    "id" serial,
    "name" varchar,
    "description" text,
    "external_url" varchar,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "created_by" integer,
    "updated_at" timestamp,
    "updated_by" integer,
    "deleted_at" timestamp,
    "deleted_by" integer,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "slot" 
(
    "id" serial,
    "course_id" integer REFERENCES "course",
    "instructor_id" integer,
    "location_id" integer REFERENCES "location",
    "time_start" timestamp(6) NOT NULL,
    "time_end" timestamp(6) NOT NULL,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "created_by" integer,
    "updated_at" timestamp,
    "updated_by" integer,
    "deleted_at" timestamp,
    "deleted_by" integer,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "reservation" 
(
    "id" serial,
    "slot_id" integer REFERENCES "slot",
    "canvas_user_id" integer NOT NULL,
    "canvas_user_name" varchar,
    "canvas_group_id" integer,
    "canvas_group_name" varchar,
    "message" text,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "created_by" integer,
    "updated_at" timestamp,
    "updated_by" integer,
    "deleted_at" timestamp,
    "deleted_by" integer,
    PRIMARY KEY ("id")
);

-- Views

DROP VIEW IF EXISTS "reservations_view";
CREATE VIEW "reservations_view" AS
 SELECT r.id,
    r.slot_id,
    r.canvas_user_id,
    r.canvas_user_name,
    r.canvas_group_id,
    r.canvas_group_name,
    r.created_at,
    r.updated_at,
    r.message,
    r.updated_by,
    s.time_start,
    s.time_end,
    c.is_group,
    c.is_individual,
        CASE
            WHEN c.is_group THEN 'group'::text
            ELSE 'individual'::text
        END AS type,
    c.max_groups,
    c.max_individuals,
    (SELECT count(canvas_user_id) FROM reservation WHERE slot_id=r.slot_id AND deleted_at IS NULL) AS res_now,
    c.id AS course_id,
    c.name AS course_name,
    c.description AS course_description,
    c.cancellation_policy_hours AS cancellation_policy_hours,
        CASE 
            WHEN now() at time zone 'Europe/Stockholm' <= s.time_start - (c.cancellation_policy_hours * interval '1 hour') THEN true 
            ELSE false 
        END AS is_cancelable,
        CASE 
            WHEN now() at time zone 'Europe/Stockholm' >= s.time_start THEN true 
            ELSE false 
        END AS is_passed,
    c.canvas_course_id,
    l.id AS location_id,
    l.name AS location_name,
    l.description AS location_description,
    l.campus_maps_id AS location_cmap_id,
    l.external_url AS location_url,
    i.id AS instructor_id,
    i.name AS instructor_name
   FROM reservation r,
    slot s,
    course c,
    location l,
    instructor i
  WHERE r.slot_id = s.id AND s.course_id = c.id AND s.location_id = l.id AND s.instructor_id = i.id AND s.deleted_at IS NULL AND r.deleted_at IS NULL;

DROP VIEW IF EXISTS "slots_view";
CREATE VIEW "slots_view" AS SELECT s.id,
    s.course_id,
    c.canvas_course_id,
    c.name AS course_name,
    c.description AS course_description,
    c.max_per_type AS course_max_per_type,
    c.message_is_mandatory AS course_message_required,
    c.message_all_when_full AS course_message_all_when_full,
    c.segment_id AS course_segment_id,
    s.instructor_id,
    i.name AS instructor_name,
    s.location_id,
    l.name AS location_name,
    l.description AS location_description,
    l.external_url AS location_url,
    l.campus_maps_id AS location_cmap_id,
    s.time_start,
    s.time_end,
        CASE
            WHEN c.is_group THEN 'group'::text
            ELSE 'individual'::text
        END AS type,
        CASE
            WHEN c.is_group THEN c.max_groups::integer
            ELSE c.max_individuals::integer
        END AS res_max,
    ( SELECT count(re.canvas_user_id) AS reserved
           FROM reservation re
          WHERE re.slot_id = s.id
          AND re.deleted_at IS NULL)::integer AS res_now,
    ( SELECT array_agg(r.canvas_group_id) AS array_agg
           FROM reservations_view r
          WHERE r.slot_id = s.id) AS res_group_ids,
    ( SELECT array_agg(r.canvas_group_name) AS array_agg
           FROM reservations_view r
          WHERE r.slot_id = s.id) AS res_group_names,
    ( SELECT array_agg(r.canvas_user_id) AS array_agg
           FROM reservations_view r
          WHERE r.slot_id = s.id) AS res_user_ids,
    ( SELECT array_agg(r.canvas_group_id) AS array_agg
           FROM reservations_view r, slot s2
          WHERE r.slot_id = s2.id 
            AND s2.course_id=s.course_id
            AND s2.deleted_at IS NULL) AS res_course_group_ids,
    ( SELECT array_agg(r.canvas_user_id) AS array_agg
           FROM reservations_view r, slot s2
          WHERE r.slot_id = s2.id
            AND s2.course_id=s.course_id
            AND s2.deleted_at IS NULL) AS res_course_user_ids
   FROM slot s,
    course c,
    instructor i,
    location l
  WHERE s.course_id = c.id AND s.instructor_id = i.id AND s.location_id = l.id AND s.deleted_at IS NULL
  ORDER BY s.time_start;

-- Mockup some data, bound to Canvas course id 1508 (this will not work since all tables are not in this, should be a separate file...)
INSERT INTO "course" ("name", "canvas_course_id", "is_group", "is_individual", "max_groups", "max_individuals") VALUES ('Handledningstillfälle 1', 1508, true, false, 2, 0);
INSERT INTO "course" ("name", "canvas_course_id", "is_group", "is_individual", "max_groups", "max_individuals") VALUES ('Handledningstillfälle 2', 1508, true, false, 1, 0);
INSERT INTO "course" ("name", "canvas_course_id", "is_group", "is_individual", "max_groups", "max_individuals") VALUES ('Föreläsning 1', 1508, false, true, 0, 100);
INSERT INTO "instructor" ("name", "canvas_course_id", "canvas_user_id") VALUES ('Rolf Johansson', 1618);
INSERT INTO "instructor" ("name", "canvas_course_id", "canvas_user_id") VALUES ('Carl Johan Carlsson', 1060);
INSERT INTO "instructor" ("name", "canvas_course_id", "canvas_user_id") VALUES ('Fia Börjesson', 1058);
INSERT INTO "instructor" ("name", "canvas_course_id", "canvas_user_id") VALUES ('Magnus Axelsson', 8);
INSERT INTO "instructor" ("name", "canvas_course_id", "canvas_user_id") VALUES ('Karin Ljungklint', 938);
INSERT INTO "canvas_course_instructor_mapping" ("canvas_course_id", "instructor_id") VALUES (1508, 1);
INSERT INTO "canvas_course_instructor_mapping" ("canvas_course_id", "instructor_id") VALUES (1508, 2);
INSERT INTO "canvas_course_instructor_mapping" ("canvas_course_id", "instructor_id") VALUES (1508, 3);
INSERT INTO "canvas_course_instructor_mapping" ("canvas_course_id", "instructor_id") VALUES (1508, 4);
INSERT INTO "canvas_course_instructor_mapping" ("canvas_course_id", "instructor_id") VALUES (1508, 5);
INSERT INTO "location" ("name", "canvas_course_id", "created_by") VALUES ('Lokal A1', 1);
INSERT INTO "location" ("name", "canvas_course_id", "created_by") VALUES ('Lokal A2', 1);
INSERT INTO "location" ("name", "canvas_course_id", "created_by") VALUES ('Lokal A3', 1);
INSERT INTO "location" ("name", "canvas_course_id", "created_by", "description") VALUES ('Language Lab/Språklabb', 1, 'För att komma till Fackspråk - språklabb går ni in på biblioteket och fortsätter förbi lånedisken fram till spiraltrappan. Vid trappan ska ni en våning ner. På våningen under ska ni till höger efter trappan och ta er till studentköket och lunchrummet. När ni kommit till lunchrummet ser ni Fackspråks lokaler samt lässtudion snett till vänster.');
INSERT INTO "location" ("name", "canvas_course_id", "created_by", "external_url") VALUES ('ZOOM Calle', 1, 'https://chalmers.zoom.us/j/64438289001');
INSERT INTO "location" ("name", "canvas_course_id", "created_by", "external_url") VALUES ('ZOOM Fia', 1, 'https://chalmers.zoom.us/j/69630313118');
INSERT INTO "location" ("name", "canvas_course_id", "created_by", "description") VALUES ('CAMPUS - Seminarierum 1', 1, 'För att enklast komma till Seminarierum 1: gå in genom bibliotekets nya glasentré (närmast Kemigården) och gå upp för stora trappan rakt fram. Seminarierum 1 ligger sedan till vänster.');
INSERT INTO "canvas_course_location_mapping" ("canvas_course_id", "location_id") VALUES (1508, 1);
-- ... and some more ...

-- Version history
INSERT INTO version (db_version) VALUES (1);
