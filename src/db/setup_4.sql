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

-- Version history
INSERT INTO version (db_version) VALUES (4);
