# Generalist Daily — Consolidated Project Instructions

Single source of truth for this project. It replaces the earlier email-first
"Generalist Daily Newsletter" brief. When requirements change, edit this file in
place; do not append contradictory rules.

## 1. Product

Generalist Daily is a **website-first, AI-curated daily knowledge publication**
for curious generalists. Not an email newsletter, not a news portal, not an
infinite feed, not an academic journal.

Promise: *"Things worth knowing, things everyone should understand, and things
you didn't know you'd find interesting — in one manageable daily edition."*

- One finite edition per day: 5–7 stories (normally 6), ~5–7 minutes total.
- Finishing the edition should feel like enough for the day.
- Past editions stay in an archive. No accounts, comments, social feeds or
  personalization in the MVP.
- Email is an optional future distribution channel only (none exists yet).
- All reader-facing writing is natural, polished Korean.

## 2. Editorial model

Editorial functions (tags, not fixed slots; a story may carry several; do not
force all six daily):

| key | label | meaning |
|---|---|---|
| `must_know` | MUST KNOW | consequential current affairs |
| `in_the_know` | IN THE KNOW | contemporary trends and conversations |
| `essentials` | THE ESSENTIALS | foundational general knowledge |
| `good_to_know` | GOOD TO KNOW | interesting and useful knowledge |
| `something_new` | SOMETHING NEW | unfamiliar subjects and discoveries |
| `food_for_thought` | FOOD FOR THOUGHT | reasoning and reflection |

Starting balance for six stories: 2 timely, 1 foundational, 2 discovery,
1 reflection. Quality beats quota: never pad with weak stories (minimum 5).

Subjects (flexible taxonomy, table `subjects`; new subjects may be added):
world-politics-society, economics-finance-business, science-technology-ai,
history-civilization-geography, philosophy-literature-arts-culture,
psychology-behavior-everyday, plus mathematics, environment, medicine,
architecture-design, law, language, anthropology, …

Diversity: track subjects and subtopics over rolling 7 and 30 days (views
`coverage_7d`, `coverage_30d`). Do not over-weight AI, finance or geopolitics
because they produce many headlines. Not every subject needs to appear daily.

Suitability score (adjustable heuristics, in `pipeline/src/config.ts`):
significance 25%, interest 25%, accessibility 20%, thinking potential 15%,
novelty 15%. Accuracy and source reliability are **gates**, not weights.

Each story ideally covers: (1) what it is / what happened, (2) why or how it
works, (3) why it matters. Add an example, uncertainty, counterargument or
question only where it helps. Avoid trivia, clickbait, sensationalism, forced
humor, needless metaphors, unexplained jargon and academic tone. Do not avoid
hard subjects; explain them.

## 3. Non-negotiable safeguards (carried over from the original brief)

- Freshness for timely stories: normally ≤48h, up to 72h for major
  developments (flag `major=true`). Evergreen stories have no date limit but
  must never be presented as breaking news.
- Store event date, publication date, source update date and retrieval time
  separately.
- Cluster articles on the same event; deduplicate against the last 30 days of
  published stories unless there is a meaningful new development.
- Prefer independent corroboration; record supporting sources internally.
- Source-grounded writing only. Never fabricate sources, URLs, quotes or facts.
  Never claim to have read inaccessible or paywalled content.
- Respect copyright and paywalls: store metadata, URLs and short excerpts only
  (≤1000 chars). No full-text storage unless `sources.allows_fulltext`.
  No article images.
- Every published link (source and concept links) must pass `link_checks`.
- Every published story must have `fact_check_status = 'passed'`.
- Log editorial decisions (`editorial_log`) and pipeline failures
  (`pipeline_runs`).

## 4. Architecture

```
GitHub Actions (cron, no local machine needed)
  └─ pipeline/ (TypeScript, Node 22)
       collect → filter(freshness) → cluster/dedupe → score/select
       → write (Claude) → fact-check (Claude) → link-check → assemble draft
  └─ publish (manual, approval required) → rebuild site
Supabase (Postgres, free plan, project ref luogxbqimauqzoasgesj, ap-northeast-2)
web/ (Astro static site, built from published data only)
```

- Deterministic code for collection, date filtering, clustering, scoring
  arithmetic, URL checks, storage, scheduling and publishing.
- AI only for: topic evaluation (scores), writing, fact-check review.
  Default models are configurable via env (`CLAUDE_MODEL_FAST`,
  `CLAUDE_MODEL_WRITER`). Use one batched scoring call per day, not one call
  per article.
- Production editorial roles (News Scout, Knowledge Scout, Research Analyst,
  Writer, Fact Checker, Editor-in-Chief) are pipeline stages, not six agents.
- During development use Claude Code subagents only when they clearly save
  work; avoid duplicate research and conflicting edits.

### Collection sources
- Korean news: NAVER API HUB News Search
  (`https://naverapihub.apigw.ntruss.com/search/v1/news`, headers
  `X-NCP-APIGW-API-KEY-ID` / `X-NCP-APIGW-API-KEY`). The legacy
  openapi.naver.com host stopped accepting new apps on 2026-07-31.
- International / specialist / educational: RSS feeds in `sources`.
- Evergreen ideas: `story_clusters` rows with `freshness_type='evergreen'`
  (Knowledge Scout backlog).

## 5. Data and security

- Migrations live in `supabase/migrations/`, each with a matching
  `supabase/rollbacks/<same name>.down.sql`. Never drop or recreate existing
  tables without approval.
- The pipeline uses the service-role key **only** as a CI secret. It never
  goes to the browser or into `web/`.
- Public visitors (`anon`) may read only rows belonging to an edition with
  `status='published'`, and only public columns. Drafts, research, summaries,
  editorial logs, pipeline runs and link checks stay private.
- The website is statically built with the publishable key, so it can only
  ever see published content.

## 6. Workflow states

`issues.status`: draft → in_review → approved → published (or failed /
withdrawn). The pipeline only creates drafts. Publishing is a separate,
manually triggered step that refuses any edition with unchecked links or
unpassed fact checks.

## 7. Approval required (ask the user first)

- Creating paid resources or starting real API charges (Claude API, paid
  Naver plans, paid hosting)
- Destructive database changes (drop, delete, truncate) and data retention jobs
- Security policy changes (RLS policies, grants, public buckets)
- Public deployment of the website
- Publishing any real edition
- Any other irreversible or security-sensitive operation

## 8. Commands

```
cd pipeline && npm test            # unit tests (no network)
cd pipeline && npm run daily -- --dry-run   # full pipeline with fixtures/mock AI
cd web && npm run build            # static site (needs PUBLIC_SUPABASE_URL/KEY or DATA_FILE)
```
