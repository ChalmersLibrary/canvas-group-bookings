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
    "name" varchar,
    "date_start" timestamp(4),
    "date_end" timestamp(4),
    "canvas_course_id" integer NOT NULL,
    "is_group" boolean,
    "is_individual" boolean,
    "max_groups" integer,
    "max_individuals" integer,
    "max_per_user" integer NOT NULL DEFAULT 1,
    "default_slot_duration" integer,
    "message_to_instructor" boolean NOT NULL default false,
    "mail_cc_instructor" boolean NOT NULL DEFAULT true,
    "mail_one_reservation_body" text,
    "mail_full_reservation_body" text,
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
    "canvas_user_id" integer,
    "canvas_course_id" integer,
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
    "canvas_course_id" integer,
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
    "canvas_group_id" integer,
    "message" text,
    "mail_sent_user" timestamp DEFAULT NULL,
    "mail_sent_group" timestamp DEFAULT NULL,
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
    r.canvas_group_id,
    r.created_at,
    r.updated_at,
    r.message,
    r.updated_by,
    s.time_start,
    s.time_end,
    c.is_group,
    c.is_individual,
    c.max_groups,
    c.max_individuals,
    (SELECT count(canvas_user_id) FROM reservation WHERE slot_id=r.slot_id AND deleted_at IS NULL) AS res_now,
    c.name AS course_name,
    c.canvas_course_id,
    l.name AS location_name,
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
    c.max_per_type AS course_max_per_type,
    s.instructor_id,
    i.name AS instructor_name,
    s.location_id,
    l.name AS location_name,
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

-- Mockup some data, bound to Canvas course id 1508
INSERT INTO "course" ("name", "date_start", "date_end", "canvas_course_id", "is_group", "is_individual", "max_groups", "max_individuals") VALUES ('Handledningstillfälle 1','2022-01-01','2023-12-31',1508,true,false,2,0);
INSERT INTO "course" ("name", "date_start", "date_end", "canvas_course_id", "is_group", "is_individual", "max_groups", "max_individuals") VALUES ('Handledningstillfälle 2','2022-09-21','2023-12-31',1508,true,false,1,0);
INSERT INTO "course" ("name", "date_start", "date_end", "canvas_course_id", "is_group", "is_individual", "max_groups", "max_individuals") VALUES ('Föreläsning 1','2022-09-21','2023-12-31',1508,false,true,0,100);
INSERT INTO "instructor" ("name", "canvas_course_id", "canvas_user_id") VALUES ('Rolf Johansson', 1508, 1618);
INSERT INTO "instructor" ("name", "canvas_course_id", "canvas_user_id") VALUES ('Carl Johan Carlsson', 1508, 1060);
INSERT INTO "instructor" ("name", "canvas_course_id", "canvas_user_id") VALUES ('Fia Börjesson', 1508, 1058);
INSERT INTO "instructor" ("name", "canvas_course_id", "canvas_user_id") VALUES ('Magnus Axelsson', 1508, 8);
INSERT INTO "instructor" ("name", "canvas_course_id", "canvas_user_id") VALUES ('Karin Ljungklint', 1508, 938);
INSERT INTO "location" ("name", "canvas_course_id", "created_by") VALUES ('Lokal A1', 1508, 1);
INSERT INTO "location" ("name", "canvas_course_id", "created_by") VALUES ('Lokal A2', 1508, 1);
INSERT INTO "location" ("name", "canvas_course_id", "created_by") VALUES ('Lokal A3', 1508, 1);
INSERT INTO "location" ("name", "canvas_course_id", "created_by", "description") VALUES ('Language Lab/Språklabb', 1508, 1, 'För att komma till Fackspråk - språklabb går ni in på biblioteket och fortsätter förbi lånedisken fram till spiraltrappan. Vid trappan ska ni en våning ner. På våningen under ska ni till höger efter trappan och ta er till studentköket och lunchrummet. När ni kommit till lunchrummet ser ni Fackspråks lokaler samt lässtudion snett till vänster.');
INSERT INTO "location" ("name", "canvas_course_id", "created_by", "external_url") VALUES ('ZOOM Calle', 1508, 1, 'https://chalmers.zoom.us/j/64438289001');
INSERT INTO "location" ("name", "canvas_course_id", "created_by", "external_url") VALUES ('ZOOM Fia', 1508, 1, 'https://chalmers.zoom.us/j/69630313118');
INSERT INTO "location" ("name", "canvas_course_id", "created_by", "description") VALUES ('CAMPUS - Seminarierum 1', 1508, 1, 'För att enklast komma till Seminarierum 1: gå in genom bibliotekets nya glasentré (närmast Kemigården) och gå upp för stora trappan rakt fram. Seminarierum 1 ligger sedan till vänster.');

-- Version history
INSERT INTO version (db_version) VALUES (1);
