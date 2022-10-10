DROP VIEW "slots_view";

CREATE VIEW "slots_view" AS SELECT s.id,
    s.course_id,
    c.name AS course_name,
    c.max_per_user AS course_max_per_user,
    s.instructor_id,
    i.name AS instructor_name,
    s.location_id,
    l.name AS location_name,
    s.time_start,
    s.time_end,
        CASE
            WHEN c.is_group THEN 'group'::text
            ELSE 'individual'::text
        END AS type,
        CASE
            WHEN c.is_group THEN c.max_groups
            ELSE c.max_individuals
        END AS res_max,
    ( SELECT count(re.canvas_user_id) AS reserved
           FROM reservation re
          WHERE re.slot_id = s.id
          AND re.deleted_at IS NULL) AS res_now,
    ( SELECT array_agg(r.canvas_group_id) AS array_agg
           FROM reservations_view r
          WHERE r.slot_id = s.id) AS res_group_ids,
    ( SELECT array_agg(r.canvas_user_id) AS array_agg
           FROM reservations_view r
          WHERE r.slot_id = s.id) AS res_user_ids
   FROM slot s,
    course c,
    instructor i,
    location l
  WHERE s.course_id = c.id AND s.instructor_id = i.id AND s.location_id = l.id AND s.deleted_at IS NULL
  ORDER BY s.time_start;

-- Version history
INSERT INTO version (db_version) VALUES (2);
