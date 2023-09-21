-- Creates a (very simple) configuration table for the system, for different settings for specific courses

BEGIN;

CREATE TABLE IF NOT EXISTS "canvas_course_configuration"
(
    "id" serial,
    "canvas_course_id" integer,
    "config_key" varchar,
    "config_value" varchar,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp,
    "deleted_at" timestamp,
    PRIMARY KEY ("id")
);

CREATE INDEX course_configuration_idx_canvas_course_id on canvas_course_configuration (canvas_course_id);

INSERT INTO version(db_version) VALUES (6);

COMMIT;
