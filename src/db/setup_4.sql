-- Add relevant indexes to tables to speed up all queries.

BEGIN;

create index course_idx_canvas_course_id on course (canvas_course_id);
create index course_idx_segment_id on course (segment_id);

create index segment_idx_canvas_course_id on segment (canvas_course_id);

create index slot_idx_course_id on slot (course_id);
create index slot_idx_instructor_id on slot (instructor_id);
create index slot_idx_location_id on slot (location_id);

create index reservation_idx_slot_id on reservation (slot_id);
create index reservation_idx_canvas_user_id on reservation (canvas_user_id);
create index reservation_idx_canvas_group_id on reservation (canvas_group_id);

create index canvas_course_location_mapping_idx_canvas_course_id on canvas_course_location_mapping (canvas_course_id);
create index canvas_course_location_mapping_idx_location_id on canvas_course_location_mapping (location_id);

create index canvas_course_instructor_mapping_idx_canvas_course_id on canvas_course_instructor_mapping (canvas_course_id);
create index canvas_course_instructor_mapping_idx_instructor_id on canvas_course_instructor_mapping (instructor_id);

create index canvas_course_group_category_mapping_idx_canvas_course_id on canvas_course_group_category_mapping (canvas_course_id);
create index canvas_course_group_category_mapping_idx_canvas_group_category_id on canvas_course_group_category_mapping (canvas_group_category_id);

insert into version(db_version) values (4);

vacuum analyze; -- superuser should vacuum too

COMMIT;
