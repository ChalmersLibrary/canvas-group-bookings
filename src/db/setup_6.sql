-- Introduce "segments" to tag courses for better filtering, ie Fackspråk/Biblioteket
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

ALTER TABLE "course" ADD COLUMN "segment_id" integer;

-- Remove unused columns, now in logging table for messages
ALTER TABLE "reservation" DROP COLUMN "mail_sent_user";
ALTER TABLE "reservation" DROP COLUMN "mail_sent_group";

-- Version history
INSERT INTO version (db_version) VALUES (6);
