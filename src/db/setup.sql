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
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp,
    "deleted_at" timestamp,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "instructor" 
(
    "id" serial,
    "name" varchar,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp,
    "deleted_at" timestamp,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "location" 
(
    "id" serial,
    "name" varchar,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp,
    "deleted_at" timestamp,
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
    "updated_at" timestamp,
    "deleted_at" timestamp,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "reservation" 
(
    "id" serial,
    "slot_id" integer REFERENCES "slot",
    "canvas_user_id" integer NOT NULL,
    "canvas_group_id" integer,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp,
    "deleted_at" timestamp,
    PRIMARY KEY ("id")
);

-- Version history
INSERT INTO version (db_version) VALUES (1);
