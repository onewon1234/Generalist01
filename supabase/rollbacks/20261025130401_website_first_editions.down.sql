-- Rollback of 20261025130401_website_first_editions.
-- DESTRUCTIVE: drops subjects, item_sources, link_checks, pipeline_runs, the
-- coverage views and all website edition columns, and maps statuses and
-- subject slugs back to the original five categories (lossy for narrow
-- subjects). Never run against production without explicit approval and a
-- fresh export.

drop view if exists public.coverage_30d;
drop view if exists public.coverage_7d;

drop table if exists public.pipeline_runs;
drop table if exists public.link_checks;
drop table if exists public.item_sources;

-- issue_items: website columns
alter table public.issue_items drop constraint if exists issue_items_issue_slug_key;
alter table public.issue_items drop constraint if exists issue_items_functions_check;
alter table public.issue_items
  drop column if exists slug,
  drop column if exists title,
  drop column if exists subtitle,
  drop column if exists body_md,
  drop column if exists subtopic,
  drop column if exists functions,
  drop column if exists freshness_type,
  drop column if exists event_date,
  drop column if exists card_size,
  drop column if exists is_featured,
  drop column if exists reading_minutes,
  drop column if exists fact_check_status,
  drop column if exists fact_check_notes;

-- issues: statuses back to the email-era set
drop index if exists public.issues_status_date_idx;
alter table public.issues drop constraint if exists issues_status_check;
update public.issues set status = case status
  when 'in_review' then 'draft'
  when 'published' then 'sent'
  when 'withdrawn' then 'failed'
  else status end;
alter table public.issues add constraint issues_status_check
  check (status in ('draft','approved','sent','failed'));
alter table public.issues
  drop column if exists edition_number,
  drop column if exists intro,
  drop column if exists total_reading_minutes,
  drop column if exists approved_at,
  drop column if exists published_at;

-- story_clusters: editorial columns and statuses
drop index if exists public.story_clusters_topic_key_idx;
alter table public.story_clusters drop constraint if exists story_clusters_functions_check;
alter table public.story_clusters drop constraint if exists story_clusters_status_check;
update public.story_clusters set status = 'candidate' where status = 'backlog';
alter table public.story_clusters add constraint story_clusters_status_check
  check (status in ('candidate','selected','rejected','published'));
alter table public.story_clusters
  drop column if exists freshness_type,
  drop column if exists is_major,
  drop column if exists subtopic,
  drop column if exists topic_key,
  drop column if exists functions,
  drop column if exists scores,
  drop column if exists suitability,
  drop column if exists last_development_at;

-- categories: subject foreign keys back to the five-category check constraints
drop index if exists public.sources_category_idx;
drop index if exists public.story_clusters_category_idx;
drop index if exists public.issue_items_category_idx;
alter table public.sources        drop constraint if exists sources_category_fkey;
alter table public.articles       drop constraint if exists articles_category_fkey;
alter table public.story_clusters drop constraint if exists story_clusters_category_fkey;
alter table public.issue_items    drop constraint if exists issue_items_category_fkey;

do $$
declare t text;
begin
  foreach t in array array['sources','articles','story_clusters','issue_items'] loop
    execute format($f$update public.%I set category = case category
      when 'world-politics-society'            then 'korea_world'
      when 'law'                               then 'korea_world'
      when 'economics-finance-business'        then 'economy_business'
      when 'science-technology-ai'             then 'technology_ai'
      when 'history-civilization-geography'    then 'knowledge_science_history'
      when 'mathematics'                       then 'knowledge_science_history'
      when 'environment'                       then 'knowledge_science_history'
      when 'medicine'                          then 'knowledge_science_history'
      when 'anthropology'                      then 'knowledge_science_history'
      when 'philosophy-literature-arts-culture' then 'humanities'
      when 'psychology-behavior-everyday'      then 'humanities'
      when 'architecture-design'               then 'humanities'
      when 'language'                          then 'humanities'
      else category end$f$, t);
  end loop;
end $$;

alter table public.sources add constraint sources_category_check check (category in (
  'korea_world','economy_business','technology_ai','knowledge_science_history','humanities'));
alter table public.articles add constraint articles_category_check check (category in (
  'korea_world','economy_business','technology_ai','knowledge_science_history','humanities'));
alter table public.story_clusters add constraint story_clusters_category_check check (category in (
  'korea_world','economy_business','technology_ai','knowledge_science_history','humanities'));
alter table public.issue_items add constraint issue_items_category_check check (category in (
  'korea_world','economy_business','technology_ai','knowledge_science_history','humanities'));

drop table if exists public.subjects;
