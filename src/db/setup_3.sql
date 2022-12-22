-- Add max_groups and max_indivuduals to location to be able to override course max numbers.

-- alter table location add column max_groups integer;
-- alter table location add column max_individuals integer;

insert into version(db_version) values (3);
