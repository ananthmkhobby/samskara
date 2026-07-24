-- The single-family whole-blob KV model (app_state) is fully replaced by
-- the per-family, per-row tables in 20260723180000_multitenant_schema.sql —
-- verified working end to end (demo family, a provisioned test family,
-- and the invite flow) before this drop.
drop table if exists app_state;
