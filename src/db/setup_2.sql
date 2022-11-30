-- Add client_id to token register to get rid of the error 'invalid_grant', error_description: 'incorrect client',
-- if we move between test and prod servers in same live Canvas.

BEGIN;
alter table user_token drop constraint user_token_pkey;
alter table user_token add column canvas_client_id varchar;
update user_token set canvas_client_id='125230000000000156';
alter table user_token add constraint user_token_pkey primary key (canvas_user_id, canvas_domain, canvas_client_id);
COMMIT;

insert into version(db_version) values (2);
