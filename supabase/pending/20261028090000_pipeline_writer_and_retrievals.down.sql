-- Rollback of the pending 20261028090000_pipeline_writer_and_retrievals.
-- DESTRUCTIVE for public.retrievals (drops its rows). Ask before running.

do $$
declare t text;
begin
  foreach t in array array['articles','story_clusters','cluster_articles','ai_summaries','issue_items','item_sources',
                           'glossary_terms','item_terms','retrievals','editorial_log','link_checks','pipeline_runs',
                           'sources','subjects'] loop
    execute format('drop policy if exists pipeline_writer_all on public.%I', t);
  end loop;
end $$;
drop policy if exists pipeline_writer_read_issues on public.issues;
drop policy if exists pipeline_writer_insert_draft on public.issues;
drop policy if exists pipeline_writer_update_draft on public.issues;

drop table if exists public.retrievals;

revoke all on all tables in schema public from pipeline_writer;
revoke all on all sequences in schema public from pipeline_writer;
revoke usage on schema public from pipeline_writer;
drop role if exists pipeline_writer;
