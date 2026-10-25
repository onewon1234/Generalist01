-- Rollback of 20261025105202_newsletter_core_schema.
-- DESTRUCTIVE: drops every core table and all of their data. Never run against
-- production without explicit approval and a fresh export.

drop table if exists public.editorial_log;
drop table if exists public.item_terms;
drop table if exists public.issue_items;
drop table if exists public.issues;
drop table if exists public.glossary_terms;
drop table if exists public.ai_summaries;
drop table if exists public.cluster_articles;
drop table if exists public.story_clusters;
drop table if exists public.articles;
drop table if exists public.sources;
