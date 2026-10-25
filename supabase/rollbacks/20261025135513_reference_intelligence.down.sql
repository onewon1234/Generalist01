-- Rollback of 20261025135513_reference_intelligence.
-- DESTRUCTIVE: drops the reference registry (36 sources, 360 items in production)
-- and the issue_items editorial columns. Never run against production without
-- explicit approval and a fresh export.

drop view if exists public.edition_freshness;

alter table public.issue_items
  drop column if exists source_age_hours,
  drop column if exists why_now,
  drop column if exists angle;

drop table if exists public.reference_items;
drop table if exists public.reference_sources;
