-- A person can be known to have passed away without anyone knowing when —
-- common for elder generations onboarded via bulk import. Until now the only
-- way to mark someone deceased was setting a real `died` date/year, which
-- meant "definitely dead, don't know when" had no honest representation:
-- leaving it blank reads as still living. This flag is independent of
-- `died`/`died_year_only` so it can be set with zero date information.
alter table people add column if not exists died_unknown boolean not null default false;
