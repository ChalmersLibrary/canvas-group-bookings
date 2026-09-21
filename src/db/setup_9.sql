-- Aggregate the course-wide reservation arrays in slots_view once per course instead of once per slot

BEGIN;

DROP VIEW IF EXISTS "slots_view";

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
    rc.res_course_group_ids,
    rc.res_course_user_ids
   FROM slot s
   JOIN course c ON s.course_id = c.id
   JOIN instructor i ON s.instructor_id = i.id
   JOIN location l ON s.location_id = l.id
   /* The two course-wide arrays hold every reservation in the slot's course, so their value is
      the same for every slot sharing a course. Correlating them on the slot recomputed that one
      value once per slot, which made listing a course cost its slots times its reservations.
      Aggregating once per course and joining gives each slot the same members it had before.

      The join list repeats what reservations_view applies, rather than selecting from it: those
      joins are inner and a slot may carry no location or instructor, so reproducing them keeps
      such a slot's reservations out of the arrays exactly as before. A course with no
      reservations has no row here and the outer join yields NULL, which is what array_agg over
      no rows gave. Grouping by the course yields at most one row per course, so no slot is
      duplicated. Element order within an array is unspecified either way; the arrays are counted
      and never displayed. */
   LEFT JOIN (
       SELECT s2.course_id,
              array_agg(r.canvas_group_id) AS res_course_group_ids,
              array_agg(r.canvas_user_id) AS res_course_user_ids
         FROM reservation r
         JOIN slot s2 ON r.slot_id = s2.id
         JOIN course c2 ON s2.course_id = c2.id
         JOIN location l2 ON s2.location_id = l2.id
         JOIN instructor i2 ON s2.instructor_id = i2.id
        WHERE r.deleted_at IS NULL AND s2.deleted_at IS NULL
        GROUP BY s2.course_id
   ) rc ON rc.course_id = s.course_id
  WHERE s.deleted_at IS NULL
  ORDER BY s.time_start;

INSERT INTO version (db_version) VALUES (9);

COMMIT;
