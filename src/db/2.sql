SELECT s.id,
    s.course_id,
    c.name AS course_name,
    s.instructor_id,
    i.name AS instructor_name,
    s.location_id,
    l.name AS location_name,
    s.time_start,
    s.time_end,
    (((to_char(s.time_start, 'TMDy DD TMMonth'::text) || ' kl '::text) || to_char(s.time_start, 'HH24:MI'::text)) || '&ndash;'::text) || to_char(s.time_end, 'HH24:MI'::text) AS time_human_readable,
        CASE
            WHEN c.is_group THEN 'group'::text
            ELSE 'individual'::text
        END AS type,
        CASE
            WHEN c.is_group THEN c.max_groups
            ELSE c.max_individuals
        END AS max
   FROM slot s,
    course c,
    instructor i,
    location l
  WHERE s.course_id = c.id AND s.instructor_id = i.id AND s.location_id = l.id
  ORDER BY s.time_start;

-- Version history
INSERT INTO version (db_version) VALUES (2);