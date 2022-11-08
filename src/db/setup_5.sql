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

-- Version history
INSERT INTO version (db_version) VALUES (5);
