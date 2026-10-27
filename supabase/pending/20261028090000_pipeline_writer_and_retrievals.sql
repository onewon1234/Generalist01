-- PENDING — NOT APPLIED. Requires explicit approval (schema + security policy change).
--
-- 1. A table for retrieval records (one row per article fetch attempt): access
--    status, timestamps, a hash of the text and short evidence snippets. Never
--    full article text.
-- 2. A least-privilege database role for the pipeline instead of the
--    service-role key: it can read and insert/update the editorial tables it
--    writes, but cannot delete, change schema, read reference data it does not
--    need, or bypass RLS. Publishing (issues.status = 'published') is blocked
--    for this role by a policy, so automatic public publishing is impossible.
--
-- The role is created WITHOUT a password. A password is set separately (see the
-- approval note) so it never appears in this file or in the repository.

create table public.retrievals (
  id                bigint generated always as identity primary key,
  cluster_id        bigint references public.story_clusters(id) on delete cascade,
  article_id        bigint references public.articles(id) on delete set null,
  url               text not null,
  final_url         text,
  publisher         text not null,
  status            text not null check (status in ('read','partial','paywalled','restricted','blocked-robots',
                                                     'robots-unreachable','http-error','network-error','not-html')),
  http_status       smallint,
  robots            text not null check (robots in ('allowed','disallowed','no-robots','unreachable')),
  restrictions      text[] not null default '{}',
  feed_published_at timestamptz,
  page_published_at timestamptz,
  page_modified_at  timestamptz,
  retrieved_at      timestamptz not null,
  text_chars        integer not null default 0,
  text_sha256       text check (text_sha256 is null or text_sha256 ~ '^[0-9a-f]{64}$'),
  -- short snippets only: [{kind, text, paragraph, figures}], total text bounded
  evidence          jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array' and length(evidence::text) <= 4000),
  note              text,
  -- an unread article can never carry evidence
  constraint retrievals_evidence_only_when_read check (status = 'read' or evidence = '[]'::jsonb)
);
create index retrievals_cluster_idx on public.retrievals (cluster_id);
create index retrievals_article_idx on public.retrievals (article_id);
create index retrievals_url_idx on public.retrievals (url, retrieved_at desc);
alter table public.retrievals enable row level security;

-- Least-privilege pipeline role (no password here; NOLOGIN until approved and set).
create role pipeline_writer nologin noinherit;
grant usage on schema public to pipeline_writer;

grant select, insert, update on
  public.articles, public.story_clusters, public.cluster_articles, public.ai_summaries,
  public.issues, public.issue_items, public.item_sources, public.glossary_terms, public.item_terms,
  public.retrievals
to pipeline_writer;
grant select, insert on public.editorial_log, public.link_checks, public.pipeline_runs to pipeline_writer;
grant update (status, finished_at, stats, error) on public.pipeline_runs to pipeline_writer;
grant select on public.sources, public.subjects, public.coverage_7d, public.coverage_30d, public.edition_freshness to pipeline_writer;
grant usage on all sequences in schema public to pipeline_writer;

-- RLS policies scoped to this role only (anon / authenticated get nothing new).
do $$
declare t text;
begin
  foreach t in array array['articles','story_clusters','cluster_articles','ai_summaries','issue_items','item_sources',
                           'glossary_terms','item_terms','retrievals','editorial_log','link_checks','pipeline_runs',
                           'sources','subjects'] loop
    execute format('create policy pipeline_writer_all on public.%I for all to pipeline_writer using (true) with check (true)', t);
  end loop;
end $$;

-- Issues: the pipeline may create and edit drafts, never publish.
create policy pipeline_writer_read_issues on public.issues for select to pipeline_writer using (true);
create policy pipeline_writer_insert_draft on public.issues for insert to pipeline_writer
  with check (status in ('draft','in_review','failed'));
create policy pipeline_writer_update_draft on public.issues for update to pipeline_writer
  using (status in ('draft','in_review','failed'))
  with check (status in ('draft','in_review','failed') and published_at is null and approved_at is null);
