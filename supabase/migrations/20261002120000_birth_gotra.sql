-- A woman's gotra traditionally changes to her husband's by marriage, but
-- some families want her birth gotra kept on record too. `gotra` stays the
-- single "current" value shown everywhere today; this adds one optional
-- second value, additive and nullable, same low-risk pattern as
-- tagline/logo_path/flame_streak/module_flags before it.
alter table people add column birth_gotra text;
