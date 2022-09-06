
CREATE TABLE IF NOT EXISTS "user_token" (
    "canvas_user_id" integer NOT NULL,
    "canvas_domain" varchar NOT NULL,
    "data" json NOT NULL,
    PRIMARY KEY ("canvas_user_id", "canvas_domain")
);

