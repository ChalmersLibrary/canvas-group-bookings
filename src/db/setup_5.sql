-- Change canvas_user_id from integer to varchar to be more flexible,
-- some id's could be long (bigint) or we might want to use non-numerical id.

alter table user_token alter column canvas_user_id type varchar;
alter table instructor alter column canvas_user_id type varchar;

alter table segment alter column created_by type varchar;
alter table segment alter column updated_by type varchar;
alter table segment alter column deleted_by type varchar;

alter table course alter column created_by type varchar;
alter table course alter column updated_by type varchar;
alter table course alter column deleted_by type varchar;

alter table instructor alter column created_by type varchar;
alter table instructor alter column updated_by type varchar;
alter table instructor alter column deleted_by type varchar;

alter table "location" alter column created_by type varchar;
alter table "location" alter column updated_by type varchar;
alter table "location" alter column deleted_by type varchar;

DROP VIEW slots_view;
DROP VIEW reservations_view;

alter table slot alter column created_by type varchar;
alter table slot alter column updated_by type varchar;
alter table slot alter column deleted_by type varchar;

alter table reservation alter column canvas_user_id type varchar;
alter table reservation alter column canvas_group_id type varchar;
alter table reservation alter column created_by type varchar;
alter table reservation alter column updated_by type varchar;
alter table reservation alter column deleted_by type varchar;

CREATE VIEW reservations_view AS
  SELECT r.id,
    r.slot_id,
    r.canvas_user_id,
    r.canvas_user_name,
    r.canvas_group_id,
    r.canvas_group_name,
    r.created_at,
    r.updated_at,
    r.message,
    r.updated_by,
    s.time_start,
    s.time_end,
    c.is_group,
    c.is_individual,
        CASE
            WHEN c.is_group THEN 'group'::text
            ELSE 'individual'::text
        END AS type,
    c.max_groups,
    c.max_individuals,
    ( SELECT count(reservation.canvas_user_id) AS count
           FROM reservation
          WHERE reservation.slot_id = r.slot_id AND reservation.deleted_at IS NULL) AS res_now,
    c.id AS course_id,
    c.name AS course_name,
    c.description AS course_description,
    c.cancellation_policy_hours,
        CASE
            WHEN (now() AT TIME ZONE 'Europe/Stockholm'::text) <= (s.time_start - c.cancellation_policy_hours::double precision * '01:00:00'::interval) THEN true
            ELSE false
        END AS is_cancelable,
        CASE
            WHEN (now() AT TIME ZONE 'Europe/Stockholm'::text) >= s.time_start THEN true
            ELSE false
        END AS is_passed,
    c.canvas_course_id,
    l.id AS location_id,
    l.name AS location_name,
    l.description AS location_description,
    l.campus_maps_id AS location_cmap_id,
    l.external_url AS location_url,
    i.id AS instructor_id,
    i.name AS instructor_name
   FROM reservation r,
    slot s,
    course c,
    location l,
    instructor i
  WHERE r.slot_id = s.id AND s.course_id = c.id AND s.location_id = l.id AND s.instructor_id = i.id AND s.deleted_at IS NULL AND r.deleted_at IS NULL;

CREATE VIEW slots_view AS
SELECT s.id,
    s.course_id,
    c.canvas_course_id,
    c.name AS course_name,
    c.description AS course_description,
    c.max_per_type AS course_max_per_type,
    c.message_is_mandatory AS course_message_required,
    c.message_all_when_full AS course_message_all_when_full,
    c.segment_id AS course_segment_id,
        CASE
            WHEN c.segment_id IS NOT NULL THEN ( SELECT segment.sign
               FROM segment
              WHERE segment.id = c.segment_id)
            ELSE NULL::character varying
        END AS course_segment_sign,
        CASE
            WHEN c.segment_id IS NOT NULL THEN ( SELECT segment.hex_color
               FROM segment
              WHERE segment.id = c.segment_id)
            ELSE NULL::character varying
        END AS course_segment_hex_color,
    s.instructor_id,
    i.name AS instructor_name,
    s.location_id,
    l.name AS location_name,
    l.description AS location_description,
    l.external_url AS location_url,
    l.campus_maps_id AS location_cmap_id,
    l.max_groups AS location_max_groups,
    l.max_individuals AS location_max_individuals,
    s.time_start,
    s.time_end,
        CASE
            WHEN c.is_group THEN 'group'::text
            ELSE 'individual'::text
        END AS type,
        CASE
            WHEN c.is_group THEN
            CASE
                WHEN l.max_groups IS NOT NULL AND l.max_groups < c.max_groups THEN l.max_groups
                ELSE c.max_groups
            END
            ELSE
            CASE
                WHEN l.max_individuals IS NOT NULL AND l.max_individuals < c.max_individuals THEN l.max_individuals
                ELSE c.max_individuals
            END
        END AS res_max,
    (( SELECT count(re.canvas_user_id) AS reserved
           FROM reservation re
          WHERE re.slot_id = s.id AND re.deleted_at IS NULL))::integer AS res_now,
    ( SELECT array_agg(r.canvas_group_id) AS array_agg
           FROM reservations_view r
          WHERE r.slot_id = s.id) AS res_group_ids,
    ( SELECT array_agg(r.canvas_group_name) AS array_agg
           FROM reservations_view r
          WHERE r.slot_id = s.id) AS res_group_names,
    ( SELECT array_agg(r.canvas_user_id) AS array_agg
           FROM reservations_view r
          WHERE r.slot_id = s.id) AS res_user_ids,
    ( SELECT array_agg(r.canvas_group_id) AS array_agg
           FROM reservations_view r,
            slot s2
          WHERE r.slot_id = s2.id AND s2.course_id = s.course_id AND s2.deleted_at IS NULL) AS res_course_group_ids,
    ( SELECT array_agg(r.canvas_user_id) AS array_agg
           FROM reservations_view r,
            slot s2
          WHERE r.slot_id = s2.id AND s2.course_id = s.course_id AND s2.deleted_at IS NULL) AS res_course_user_ids
   FROM slot s,
    course c,
    instructor i,
    location l
  WHERE s.course_id = c.id AND s.instructor_id = i.id AND s.location_id = l.id AND s.deleted_at IS NULL
  ORDER BY s.time_start;

-- Version upgrade
INSERT INTO version (db_version) values (5);
