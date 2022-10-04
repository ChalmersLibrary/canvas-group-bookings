DROP VIEW "reservations_view";

CREATE VIEW "reservations_view" AS
 SELECT r.id,
    r.slot_id,
    r.canvas_user_id,
    r.canvas_group_id,
    r.created_at,
    r.updated_at,
    r.deleted_at,
    r.message,
    r.updated_by,
    r.created_by,
    r.deleted_by,
    s.time_start,
    s.time_end,
    c.name AS course_name,
    l.name AS location_name,
    i.name AS instructor_name
   FROM reservation r,
    slot s,
    course c,
    location l,
    instructor i
  WHERE r.slot_id = s.id AND s.course_id = c.id AND s.location_id = l.id AND s.instructor_id = i.id;
