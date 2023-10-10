-- Add instructor email to reservations and slots view

BEGIN;

DROP VIEW IF EXISTS "slots_view";
DROP VIEW IF EXISTS "reservations_view";

CREATE VIEW "reservations_view" AS
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
    (SELECT count(canvas_user_id) FROM reservation WHERE slot_id=r.slot_id AND deleted_at IS NULL) AS res_now,
    c.id AS course_id,
    c.name AS course_name,
    c.description AS course_description,
    c.cancellation_policy_hours AS cancellation_policy_hours,
        CASE 
            WHEN now() at time zone 'Europe/Stockholm' <= s.time_start - (c.cancellation_policy_hours * interval '1 hour') THEN true 
            ELSE false 
        END AS is_cancelable,
        CASE 
            WHEN now() at time zone 'Europe/Stockholm' >= s.time_start THEN true 
            ELSE false 
        END AS is_passed,
    c.canvas_course_id,
    l.id AS location_id,
    l.name AS location_name,
    l.description AS location_description,
    l.campus_maps_id AS location_cmap_id,
    l.external_url AS location_url,
    i.id AS instructor_id,
    i.name AS instructor_name,
    i.email AS instructor_email
   FROM reservation r,
    slot s,
    course c,
    location l,
    instructor i
  WHERE r.slot_id = s.id AND s.course_id = c.id AND s.location_id = l.id AND s.instructor_id = i.id AND s.deleted_at IS NULL AND r.deleted_at IS NULL;

CREATE VIEW "slots_view" AS SELECT s.id,
    s.course_id,
    c.canvas_course_id,
    c.name AS course_name,
    c.description AS course_description,
    c.max_per_type AS course_max_per_type,
    c.message_is_mandatory AS course_message_required,
    c.message_all_when_full AS course_message_all_when_full,
    c.segment_id AS course_segment_id,
        CASE 
            WHEN c.segment_id IS NOT NULL THEN
                (SELECT sign FROM segment WHERE segment.id=c.segment_id)
            ELSE
                NULL
        END AS course_segment_sign,
        CASE 
            WHEN c.segment_id IS NOT NULL THEN
                (SELECT hex_color FROM segment WHERE segment.id=c.segment_id)
            ELSE
                NULL
        END AS course_segment_hex_color,
    s.instructor_id,
    i.name AS instructor_name,
    i.email AS instructor_email,
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
                    WHEN l.max_groups IS NOT NULL AND l.max_groups::integer < c.max_groups::integer THEN
                        l.max_groups::integer
                    ELSE
                        c.max_groups::integer
                END
            ELSE
                CASE
                    WHEN l.max_individuals IS NOT NULL AND l.max_individuals::integer < c.max_individuals::integer THEN
                        l.max_individuals::integer
                    ELSE
                        c.max_individuals::integer
                END
        END AS res_max,
    ( SELECT count(re.canvas_user_id) AS reserved
           FROM reservation re
          WHERE re.slot_id = s.id
          AND re.deleted_at IS NULL)::integer AS res_now,
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
           FROM reservations_view r, slot s2
          WHERE r.slot_id = s2.id 
            AND s2.course_id=s.course_id
            AND s2.deleted_at IS NULL) AS res_course_group_ids,
    ( SELECT array_agg(r.canvas_user_id) AS array_agg
           FROM reservations_view r, slot s2
          WHERE r.slot_id = s2.id
            AND s2.course_id=s.course_id
            AND s2.deleted_at IS NULL) AS res_course_user_ids
   FROM slot s,
    course c,
    instructor i,
    location l
  WHERE s.course_id = c.id AND s.instructor_id = i.id AND s.location_id = l.id AND s.deleted_at IS NULL
  ORDER BY s.time_start;

INSERT INTO version (db_version) VALUES (7);

COMMIT;
