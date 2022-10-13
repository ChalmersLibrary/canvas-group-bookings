-- Canvas caches, can change

CREATE TABLE IF NOT EXISTS "canvas_cache_group_members"
(
    "id" serial,
    "canvas_course_id" integer,
    "canvas_group_id" integer,
    "canvas_group_name" varchar,
    "canvas_user_id" integer,
    "canvas_user_name" varchar,
    "canvas_user_email" varchar,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp,
    "deleted_at" timestamp,
    PRIMARY KEY ("id")
);

-- Version history
INSERT INTO version (db_version) VALUES (2);
