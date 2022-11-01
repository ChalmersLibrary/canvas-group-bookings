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

-- Remove old unused cache table
DROP TABLE IF EXISTS "canvas_cache_group_members";

-- Version history
INSERT INTO version (db_version) VALUES (3);
