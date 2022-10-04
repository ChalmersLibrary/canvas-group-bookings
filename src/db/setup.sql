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
    "is_group" boolean,
    "is_individual" boolean,
    "max_groups" integer,
    "max_individuals" integer,
    "default_slot_duration" integer,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "created_by" integer REFERENCES "instructor",
    "updated_at" timestamp,
    "updated_by" integer REFERENCES "instructor",
    "deleted_at" timestamp,
    "deleted_by" integer REFERENCES "instructor",
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "instructor" 
(
    "id" serial,
    "name" varchar,
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
    "created_at" timestamp NOT NULL DEFAULT now(),
    "created_by" integer REFERENCES "instructor",
    "updated_at" timestamp,
    "updated_by" integer REFERENCES "instructor",
    "deleted_at" timestamp,
    "deleted_by" integer REFERENCES "instructor",
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "slot" 
(
    "id" serial,
    "course_id" integer REFERENCES "course",
    "instructor_id" integer REFERENCES "instructor",
    "location_id" integer REFERENCES "location",
    "time_start" timestamp(6) NOT NULL,
    "time_end" timestamp(6) NOT NULL,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "created_by" integer REFERENCES "instructor",
    "updated_at" timestamp,
    "updated_by" integer REFERENCES "instructor",
    "deleted_at" timestamp,
    "deleted_by" integer REFERENCES "instructor",
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "reservation" 
(
    "id" serial,
    "slot_id" integer REFERENCES "slot",
    "canvas_user_id" integer NOT NULL,
    "canvas_group_id" integer,
    "message" text,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "created_by" integer,
    "updated_at" timestamp,
    "updated_by" integer,
    "deleted_at" timestamp,
    "deleted_by" integer,
    PRIMARY KEY ("id")
);

-- Mockup data
INSERT INTO "course" ("name", "date_start", "date_end", "is_group", "is_individual", "max_groups", "max_individuals") VALUES ('Handledningstillfälle 1','2022-01-01','2023-12-31',true,false,1,0);
INSERT INTO "course" ("name", "date_start", "date_end", "is_group", "is_individual", "max_groups", "max_individuals") VALUES ('Handledningstillfälle 2','2022-09-21','2023-12-31',true,false,2,0);
INSERT INTO "course" ("name", "date_start", "date_end", "is_group", "is_individual", "max_groups", "max_individuals") VALUES ('Föreläsning 1','2022-09-21','2023-12-31',false,true,0,100);
INSERT INTO "instructor" ("name", "canvas_user_id") VALUES ('Rolf Johansson', 1618);
INSERT INTO "instructor" ("name", "canvas_user_id") VALUES ('Carl Johan Carlsson', 1060);
INSERT INTO "instructor" ("name", "canvas_user_id") VALUES ('Fia Börjesson', 1058);
INSERT INTO "instructor" ("name", "canvas_user_id") VALUES ('Magnus Axelsson', 8);
INSERT INTO "location" ("name", "created_by") VALUES ('Lokal A1', 1);
INSERT INTO "location" ("name", "created_by") VALUES ('Lokal A2', 1);
INSERT INTO "location" ("name", "created_by") VALUES ('Lokal A3', 1);

-- Version history
INSERT INTO version (db_version) VALUES (1);
