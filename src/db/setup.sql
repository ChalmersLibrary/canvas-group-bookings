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

-- Main table for courses/things offered within a Canvas course, slots are made on these

CREATE TABLE IF NOT EXISTS "course" 
(
    "id" serial,
    "canvas_course_id" integer NOT NULL,
    "segment_id" integer,
    "name" varchar,
    "description" text,
    "is_group" boolean,
    "is_individual" boolean,
    "max_groups" integer,
    "max_individuals" integer,
    "max_per_type" integer NOT NULL DEFAULT 1,
    "default_slot_duration_minutes" integer,
    "cancellation_policy_hours" integer NOT NULL DEFAULT 24,
    "message_is_mandatory" boolean NOT NULL DEFAULT false,
    "message_all_when_full" boolean NOT NULL DEFAULT false,
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

-- Segments are used to tag courses for better filtering, ie Fackspråk/Biblioteket

CREATE TABLE IF NOT EXISTS "segment" 
(
    "id" serial,
    "name" varchar,
    "description" text,
    "canvas_course_id" integer,
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
    "campus_maps_id" varchar,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "created_by" integer,
    "updated_at" timestamp,
    "updated_by" integer,
    "deleted_at" timestamp,
    "deleted_by" integer,
    PRIMARY KEY ("id")
);

-- Mapping tables to re-use instructor and location information

CREATE TABLE IF NOT EXISTS "canvas_course_instructor_mapping"
(
    "id" serial,
    "canvas_course_id" integer,
    "instructor_id" integer REFERENCES "instructor",
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp,
    "deleted_at" timestamp,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "canvas_course_location_mapping"
(
    "id" serial,
    "canvas_course_id" integer,
    "location_id" integer REFERENCES "location",
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp,
    "deleted_at" timestamp,
    PRIMARY KEY ("id")
);

-- Mapping for possible filtering of Group Category in a Canvas Course

CREATE TABLE IF NOT EXISTS "canvas_course_group_category_mapping"
(
    "id" serial,
    "canvas_course_id" integer,
    "canvas_group_category_id" integer,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp,
    "deleted_at" timestamp,
    PRIMARY KEY ("id")
);

-- Main table for available slots (times)

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

-- Main table for reservations on slots

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

-- Logging of messages sent with Canvas Conversations API

CREATE TABLE IF NOT EXISTS "canvas_conversation_log"
(
    "id" serial,
    "slot_id" integer,
    "reservation_id" integer,
    "canvas_course_id" integer,
    "canvas_recipients" varchar,
    "message_subject" varchar,
    "message_body" text,
    "created_at" timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);

-- Views, includes "Europe/Stockholm" which is not optimal, TODO: Fix timezone before public release

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

-- Version history, new versions are named setup_2.sql, setup_3.sql and so on, must remember to end SQL with version insert.
INSERT INTO version (db_version) VALUES (1);
