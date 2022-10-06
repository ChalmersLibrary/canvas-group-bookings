DROP VIEW "reservations_view";

CREATE VIEW "reservations_view" AS
 SELECT r.id,
    r.slot_id,
    r.canvas_user_id,
    r.canvas_group_id,
    r.created_at,
    r.updated_at,
    r.message,
    r.updated_by,
    s.time_start,
    s.time_end,
    c.is_group,
    c.is_individual,
    c.max_groups,
    c.max_individuals,
    (SELECT count(DISTINCT canvas_user_id) FROM reservation WHERE slot_id=r.slot_id) AS res_now,
    c.name AS course_name,
    l.name AS location_name,
    i.name AS instructor_name
   FROM reservation r,
    slot s,
    course c,
    location l,
    instructor i
  WHERE r.slot_id = s.id AND s.course_id = c.id AND s.location_id = l.id AND s.instructor_id = i.id AND s.deleted_at IS NULL AND r.deleted_at IS NULL;
