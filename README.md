# Generalist Daily

A website-first, AI-curated daily knowledge edition for curious Korean generalists:
5–7 stories (usually 6), about 5–7 minutes, finished once a day. Project rules live
in [CLAUDE.md](CLAUDE.md).

## Status (2026-10-25): what is real and what is not

| Component | State |
|---|---|
| Supabase project `generalist-newsletter` (free plan, Seoul) | **Live.** 2 migrations applied. RLS on every table. |
| Schema for website editions (subjects, functions, card sizes, sources, link checks, run log, 7/30-day coverage views) | **Live**, additive, with a rollback file. |
| Public read access for published editions | **Written and dry-run tested, NOT applied.** Waiting for your approval (`supabase/pending/`). |
| Pipeline: collect → freshness → cluster/dedupe → score → select → write → fact-check → link-check → draft | **Implemented and unit tested (21 tests)** with fixtures and a mock AI. **Never run against the real Claude API or NAVER API** (no keys yet). |
| Edition No.1 (2026-10-25) | **Real content, in-review draft** in Supabase. Researched and written manually in a Claude session using the pipeline's rules and checks, not by the automated pipeline. Not published. |
| Website (Astro static) | **Built and screenshot-verified** from the draft (preview mode with banner). **Not deployed.** |
| Automation (GitHub Actions) | **Written and validated locally.** No repository yet, so it has never run on GitHub. |
| Source registry | 12 sources seeded **inactive**. RSS URLs are unverified until `check-sources` runs in CI. |
| Email | Never existed. Not built (optional future channel). |

## Layout

```
CLAUDE.md                      consolidated project instructions
supabase/migrations/           applied migrations (match remote versions)
supabase/rollbacks/            one .down.sql per migration (destructive; ask first)
supabase/pending/              security migration awaiting approval
supabase/seed/sources.sql      source registry seed (applied, all inactive)
pipeline/                      TypeScript editorial pipeline + tests
editions/2026-10-25.json       representative edition No.1 with source notes
web/                           Astro static site
.github/workflows/             ci, daily-draft, publish, check-sources
```

## Daily flow

1. **05:17 KST** `daily-draft` collects metadata (NAVER API HUB News Search + RSS), drops anything
   undated or older than 72h, clusters stories, scores candidates in one batched Claude call,
   selects 5–7 with the 2/1/2/1 starting balance and diversity penalties, writes each story,
   fact-checks it against the source excerpts, resolves concept links on Wikipedia, verifies
   every URL and saves an `in_review` draft. It uploads a private preview build as a workflow artifact.
2. You read the preview.
3. You run `publish` for the date. It refuses unless every story is `fact_check_status = passed`,
   every link verified (re-checked at publish time) and the edition has 5–7 stories. Then it
   rebuilds the site with the **publishable key** and deploys.

Every stage writes to `pipeline_runs`. A failed stage is recorded with its error and fails the
workflow, so GitHub emails you.

## Setup checklist (needs you)

1. GitHub repository (private is fine) and push this folder.
2. Repository secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only),
   `SUPABASE_PUBLISHABLE_KEY`, `ANTHROPIC_API_KEY`, `NAVER_API_KEY_ID`, `NAVER_API_KEY`;
   for deployment `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
3. Create the `production` environment with yourself as required reviewer.
4. Run `check-sources`, then activate the feeds that pass.
5. Set variable `PIPELINE_ENABLED=true` to start daily drafts (starts Claude API charges).
6. Set `DEPLOY_ENABLED=true` when you approve public deployment.

## Costs

| Item | Cost |
|---|---|
| Supabase Free | $0. 500 MB database per project; projects pause after 7 days without activity (the daily run prevents this). Metadata-only storage is estimated at well under 100 MB/year. |
| GitHub Actions | $0 for public repos; private repos include a monthly free minutes allowance. The daily run should take a few minutes. |
| Cloudflare Pages | $0 on the free plan for a static site. |
| NAVER API HUB search | Free at time of writing; NAVER has announced paid plans. |
| Claude API | **Paid.** Rough estimate about $0.30/day (~$9/month), assuming ~60 candidates scored on a fast model plus 6 stories written on a writer model and fact-checked on the fast model, priced at Anthropic's April 2026 published rates for Haiku 4.5 ($1/$5 per M tokens) and Sonnet 4.6 ($3/$15). The default models here are `claude-haiku-5-5` / `claude-sonnet-5-5`; confirm their current prices before enabling. The Batch API would roughly halve this at the cost of latency. |

## Known limitations

- The automated pipeline has only been exercised with fixtures and a mock model. The first real
  run may need prompt tuning (body length, terms, Korean style) and fixes to the clustering threshold.
- Fact checking compares the story against **titles and short excerpts**, not full articles,
  because most sites don't permit full-text collection. That is deliberately conservative: thin
  material leads to flagged stories, not invented ones. Human review is still the final gate.
- The number guard catches invented figures but not invented words. Paraphrased claims rely on
  the AI fact checker plus your review.
- Knowledge Scout (evergreen topics) reads a backlog of `story_clusters` with `status='backlog'`.
  That backlog is empty today; seed ideas or add evergreen RSS sources before relying on it.
- Concept links use Wikipedia's REST summary endpoint. Korean pages are tried first, then English.
- Free-plan Supabase has no automatic backups; export periodically if the archive matters.
- Reading progress is stored per browser (localStorage) and is not synced across devices by design (no accounts).
