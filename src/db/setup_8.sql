-- Add properties to canvas_conversation_log table

BEGIN;

ALTER TABLE canvas_conversation_log ADD COLUMN success bool DEFAULT true;
ALTER TABLE canvas_conversation_log ADD COLUMN error_message text;

INSERT INTO version (db_version) VALUES (8);

COMMIT;
