# Generalist Daily — Project Instructions

Single source of truth for how this project is built and run. It consolidates
`docs/specs/01`–`04`; where they conflict, spec 04 (2026-10-26) wins. Edit this
file in place when requirements change; do not append contradictory rules.

## 1. Product

A Korean-language, website-first daily editorial publication for intellectually
curious adults, mainly in their 20s and 30s.

Not a generic AI news summarizer, textbook explainer, RSS headline aggregator or
manually curated sample collection. Its value is discovering consequential and
surprising developments, researching them properly, explaining why they matter,
and presenting them as an engaging daily edition.

**Primary objective:** autonomously produce a high-quality, evidence-grounded
Korean daily edition without the user discovering, selecting, researching or
writing stories by hand. A manually written sample edition is never the
deliverable.

- One finite edition per day, normally 5–7 stories; never pad with weak stories.
- Total reading time initially about 10–15 minutes, set by story quality and
  depth, not by length targets.
- Homepage cards are short previews; article pages carry complete writing.
- No accounts, comments or personalization. Email is an optional future channel.

## 2. Editorial selection

Tendencies, not quotas: several meaningful recent developments, one or two
exceptional discoveries or deep explanations, occasionally a reflective
cultural, historical or philosophical piece.

Prioritize stories that are current, consequential, surprising, underexplained
or perspective-changing.

- Event freshness is not publication date. 24–72 hours is a default signal, not
  an absolute cut-off; a significant ongoing development can qualify. An older
  event is timely only with a genuinely meaningful new development, and is never
  presented as new.
- Avoid: textbook definitions as standalone stories; repetitive AI/tech topics;
  US- or institution-centric selections; duplicated event clusters; manufactured
  curiosity; topics chosen to fill categories.
- Breadth is tracked over 7 and 30 days (views `coverage_7d`, `coverage_30d`).
- Every selected story keeps an explicit **why-now rationale**, **editorial
  angle**, **reader payoff** and **evidence record**.

Subjects use the flexible taxonomy in table `subjects` (new subjects may be
added). The six editorial functions (`must_know`, `in_the_know`, `essentials`,
`good_to_know`, `something_new`, `food_for_thought`) are descriptive tags, not
slots.

## 3. Research and evidence

For promising candidates, automatically investigate accessible material:
article text where permitted, original announcements, papers, reports and
official documents.

- Use licensed APIs or allowed public access only. Respect copyright, robots
  rules, paywalls, access restrictions and platform terms. When access is
  restricted, look for an alternative legitimate source.
- Never claim a headline, snippet or metadata record was fully read. Record the
  access level actually achieved for every source.
- Establish: what happened, when, what is new versus earlier coverage, why it
  matters now, necessary background and mechanism, competing explanations and
  uncertainty, and what the reader gains.
- Separate primary evidence, secondary reporting, interpretation and speculation.
- Record source URL, access time, event date, publication date, source update
  date and evidence limitations separately.
- Prefer independent corroboration; keep supporting sources internally.
- Storage: metadata, URLs, short excerpts (≤1000 chars) and our own analysis.
  Full text may be processed transiently but is not stored unless
  `sources.allows_fulltext`. No article images.
- References (the 36-source registry and its records) teach editorial patterns
  and surface leads. They are not evidence and their prose is never copied.
  Collect new reference material daily and track source health, availability,
  language, region, subject and date.

## 4. Writing

Natural, engaging, precise Korean for an intelligent general reader, not a
beginner.

- Open with a concrete event, tension, discovery or question.
- Cover the essential facts, then background and mechanism, then consequences,
  implications or competing interpretations. The reader should come away
  understanding something meaningful they did not before.
- Restrained headlines. No clickbait, fabricated tension, generic AI prose,
  padding or unsupported certainty.
- Distinguish fact, interpretation and uncertainty in the text. Attribute claims.
- Original wording and judgment; never imitate or closely paraphrase a reference
  publication.
- Every published link (sources and concept links) must be verified.

## 5. Editorial workflow (separate model calls, not separate agents)

| Role | Responsibility |
|---|---|
| Researcher | gathers and organizes evidence per candidate |
| Editor | evaluates candidates, sets angles, selects the edition |
| Writer | writes original Korean articles grounded in the evidence |
| Fact checker | checks each claim against the evidence only, without the writer's reasoning or confidence |
| Quality reviewer | clarity, depth, repetition, coherence, originality, diversity, reader value |

Unsupported claims are corrected, qualified or rejected. Uncertainty and audit
records are preserved. **AI verification is not human fact-checking**: an
automated `passed` never equals human approval.

Deterministic code handles collection, date logic, clustering, arithmetic,
URL checks, storage, scheduling and idempotency. AI is used for judgment and
writing only. Prefer an efficient, testable design over agent complexity.

## 6. Architecture and run model

```
GitHub Actions (Asia/Seoul schedule, no local machine)
  discover → read permitted sources → extract evidence → evaluate & select
  → write → fact-check → quality review → private in_review edition
Supabase Postgres (free plan, project ref luogxbqimauqzoasgesj, ap-northeast-2)
web/ (static site built from published data only)
```

- Build a vertical slice first: one real current story end to end, then extend
  to a full edition. Reusable modules with tests around the real path; no
  mock-only implementations.
- Retries are idempotent: one edition per date, no duplicate rows.
- Log every stage to `pipeline_runs`, including source failures, model
  failures, missing evidence, token usage and cost.
- The pipeline only creates `in_review` drafts. **Public publishing is never
  automatic**; it is a separate, human-approved step.

## 7. Data and security

- Migrations live in `supabase/migrations/`, each with a matching
  `supabase/rollbacks/<name>.down.sql`. Never drop or recreate existing tables
  or alter existing data without approval.
- Least privilege: the service-role key is used only where no narrower option
  exists, only as a CI secret, never in the browser, `web/`, logs or commits.
  Prefer a dedicated database role with grants limited to what the pipeline writes.
- `anon` may only ever read published editions and public columns. Drafts,
  research, evidence, logs and link checks stay private.
- Never commit credentials, `.env` files, database dumps or recovery archives.
  Never ask for secrets in chat; the user sets them as repository secrets.

## 8. Approval required (ask first)

- Paid resources or real paid API calls (Claude API, paid NAVER plans, hosting)
- Production database schema changes, data changes or deletions
- Security policy changes (RLS policies, grants, keys, public buckets)
- Public deployment or publishing any edition
- Writes to an external system the user has not already approved for that scope
- Anything irreversible or security-sensitive

Request credentials only at the step that needs them, one at a time.

Ordinary coding, testing and commits on the Claude branch lineage do not need
per-step confirmation.

## 9. Repository workflow

- Claude's repository: `onewon1234/Generalist01`, default branch `main`.
  Larger changes go on `claude/<topic>` branches with Draft PRs into `main`.
- `onewon1234/Generalist` belongs to Codex (including PRs #1 and #2). It may be
  read for reference only: never push, modify, merge or open PRs there, and never
  merge Codex code wholesale into this repository.
- Never force-push, rewrite published history or delete remote branches.
- Commit small, verified steps and push after each stage, so the remote copy is
  always current.
- Deletes go through `scripts/safe-rm.sh` or `${VAR:?}` expansions; never chain
  a delete after `;`. The `.claude/hooks/guard_rm.py` hook enforces this.

## 10. Validation and reporting

Success is never declared because tests pass or a sample was written by hand.
Validate in order:

1. Source collection with real current data
2. Permitted substantive source retrieval
3. Automatic research and evidence extraction
4. Autonomous candidate selection
5. Real model-generated Korean drafts
6. Automated claim checking and revision
7. Private durable issue storage
8. Full website article rendering
9. Scheduled execution
10. Three successful unattended scheduled runs, each checked for real research,
    evidence verification, editorial quality, drafting and private storage

Every report labels each part as **real**, **mocked**, **manual preparation**,
**credential-dependent** or **not yet implemented**, and includes source URLs,
timestamps, generated examples, test results and limitations. Editorial quality
is evaluated alongside technical success.

## 11. Commands

Set as each part is rebuilt (see `docs/REBUILD.md`).

```
cd pipeline && npm ci && npm run check   # typecheck + tests (incl. migrations on PGlite)
python3 -I scripts/test/test_guard_rm.py   # delete-guard tests
bash scripts/test/test_safe_rm.sh          # safe-rm tests
```
