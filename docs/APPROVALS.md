# Pending approvals (2026-10-27)

Nothing below is enabled. Each item states exactly what would change.

## A. Database write path for the pipeline

SQL: `supabase/pending/20261028090000_pipeline_writer_and_retrievals.sql`
(rollback `…down.sql`; tested on PGlite by `pipeline/test/pending-migration.test.ts`).

1. New table `public.retrievals`: one row per article fetch attempt (URL,
   publisher, access status, robots result, opt-outs, timestamps, text length
   and SHA-256, ≤ 4,000 bytes of evidence snippets). Never full text. A check
   constraint forbids evidence on any row whose status is not `read`.
2. New role `pipeline_writer` (created NOLOGIN, no password in the repo):
   - SELECT/INSERT/UPDATE on the editorial tables the pipeline writes; INSERT
     only on logs; read-only on `sources`, `subjects` and coverage views
   - no DELETE, no DDL, no access to `reference_*`, no RLS bypass
   - RLS policies scoped to this role; on `issues` it may create/edit only
     `draft` / `in_review` / `failed` rows, never set `published` or
     `approved_at`, so automatic publishing is impossible at the database level
   - `anon` and `authenticated` gain nothing
3. Enabling login (after approval): `alter role pipeline_writer login password …`
   and a GitHub secret `SUPABASE_DB_URL` (pooler connection string for this
   role). Options for setting the password without it appearing in chat:
   - (recommended) you run one statement yourself in the Supabase SQL editor
     and paste the connection string into GitHub Secrets; or
   - Claude generates it in the workspace and sets the GitHub secret directly
     (the value would appear in this session's tool log).

The service-role key is not needed for any of this.

## B. Paid Claude API calls (editor, writer, fact checker, quality reviewer)

Prices from the Claude Platform pricing page (2026-10-27): Sonnet 5.5 $2 / $10
per million input / output tokens; Haiku 5.5 $0.10 / $0.50 (prompts ≤ 100k);
Batch API halves both.

Estimated tokens per daily edition (6 stories, 24 researched candidates):

| Stage | Model | Input | Output | Cost |
|---|---|---|---|---|
| Editor: evaluate 24 candidates, angles, selection | Sonnet 5.5 | ~22k | ~3k | ~$0.07 |
| Writer: 6 Korean articles from evidence | Sonnet 5.5 | ~24k | ~12k | ~$0.17 |
| Fact checker: claims vs evidence, independent of writer | Sonnet 5.5 | ~30k | ~4k | ~$0.10 |
| Quality reviewer: whole edition | Sonnet 5.5 | ~15k | ~2k | ~$0.05 |
| Revision of flagged stories (~2) | Sonnet 5.5 | ~12k | ~4k | ~$0.06 |
| **Total** | | ~103k | ~25k | **~$0.45/day (~$14/month)** |

- Batch API: ~$0.23/day, results within hours (fits a pre-dawn run).
- Haiku 5.5 for editor + fact checker instead: ~$0.30/day, weaker judgement.
- Retries could double a bad day; proposed hard cap: abort a run above $1.00
  of estimated spend, plus a monthly spend limit set in the Anthropic console.
- Needs secret `ANTHROPIC_API_KEY` and variable `PIPELINE_ENABLED=true`.

## C. Where previews are generated

`Generalist01` is public, so Actions logs, annotations and artifacts are public.
Previews (unpublished drafts and evidence) therefore run on your Mac into
`~/development/generalist-preview/`. Alternatives: make the repository
private (then previews can run on GitHub Actions), or store previews only in
Supabase (needs A).
