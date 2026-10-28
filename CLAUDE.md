# Generalist Daily — Project Instructions

Single source of truth for how this project is built and run. It consolidates
`docs/specs/01`–`05`; where they conflict, the newest spec wins (05,
2026-10-27: editorial identity and reading experience). Edit this
file in place when requirements change; do not append contradictory rules.

## 1. Product

A curiosity-driven, reference-informed Korean editorial publication,
website-first, for intellectually curious adults mainly in their 20s and 30s.
It helps readers understand the world, discover unfamiliar knowledge and meet
perspectives worth thinking about. It is a **global generalist** publication,
not a Korean news digest, and closer to a thoughtfully curated intellectual
magazine with daily freshness than to a news briefing. News is one important
source of stories, not the defining format; freshness is valued but never the
overriding criterion. Everyone gets the same broad edition (no personalization).

A successful edition leaves the reader feeling: I understand something about
the world I did not before; I learned something genuinely interesting; I met a
new perspective or question; and it was enjoyable, not a pile of news reports.

Not a generic AI news summarizer, textbook explainer, RSS headline aggregator or
manually curated sample collection.

**Primary objective:** autonomously produce a high-quality, evidence-grounded
Korean daily edition without the user discovering, selecting, researching or
writing stories by hand. A manually written sample edition is never the
deliverable.

- One finite edition per day, normally 5–7 stories; never pad with weak stories.
- Total reading time follows story quality and depth (the 2026-10-28 test
  edition, about 22 minutes, is an accepted reference); never cut a good piece
  to hit a length target.
- Homepage cards are short previews; article pages carry complete writing.
- No accounts, comments or personalization. The daily email links each story
  to its article page (`web/src/email.ts`).

## 2. Editorial selection

Select 5–7 main stories by their combined intellectual, explanatory, cultural
and narrative value. There is no news/feature mix, no minimum number of news
reports and no hard per-subject or per-country quota.

**Default composition (the user's editorial preference, not a quota):** about
one Korea story, one or two world/politics/international stories, one economy
story, one AI/technology story, and zero to two free-exploration pieces
(science, culture, history, philosophy, psychology, language, art). Selection
weighs it (`pipeline/src/desk.ts`), but only among items that are stories
(reviews, opinion, sponsored content, live blogs, video pages, digests and a
publisher's own announcements never become main stories: `pipeline/src/kind.ts`).
A desk below its usual count gets a bonus only for candidates clearly above the
quality bar; a desk past its usual
maximum is penalised; a missing desk is noted, never padded; an exceptional
story may exceed the usual range. The research pool reserves a few places per
desk so the editor can actually consider them. Excellent non-news stories
compete equally, including for the featured homepage place. Short news updates
belong in "오늘의 한 줄", so the main edition need not carry every update.

Discovery domains (a healthy mix over time, not daily categories): context-rich
current global events; science and research; history and overlooked historical
connections; culture, art, books, film, design and media; psychology, behaviour
and cognitive science; philosophy and contemporary questions; economics,
technology and social change; language, anthropology and unfamiliar societies;
unexpected connections across disciplines.

Evaluate every candidate for reader payoff (`Scores` in `pipeline/src/types.ts`):

1. **Curiosity** – something surprising, unfamiliar or compelling.
2. **Understanding** – explains a meaningful mechanism, context or connection.
3. **Narrative potential** – can be told as a coherent story, not a fact list.
4. **Intellectual payoff** – what readers will know, reconsider or remember.
5. **Relevance** – why it is worth reading today, even if not breaking news.
6. **Evidence quality** – the central claims can be supported (below 5 rejected).
7. **Portfolio diversity** – adds something distinct to the edition (applied by
   selection as soft penalties, never as a quota).

Avoid topics that are merely current, easy to summarize or widely repeated. For
current affairs, prefer stories that reveal deeper historical, cultural,
institutional or social forces. Evergreen topics need an unusually strong idea,
discovery, narrative or perspective. Article counts, buzz and recency alone
never decide, and a high-frequency news wire must not dominate the ranking
(ranking takes turns between sources; see `rankCandidates`).

- Event freshness is not publication date. For current stories 24–72 hours is
  a default signal, not an absolute cut-off; a significant ongoing development
  can qualify. An older event is timely only with a genuinely meaningful new
  development, and is never presented as new. Slow intellectual publishers
  (registry `evergreen: true`) are kept 30 days and judged as evergreen pieces.
- Avoid: textbook definitions as standalone stories; repetitive AI/tech topics;
  US- or institution-centric selections; duplicated event clusters; manufactured
  curiosity; topics chosen to fill categories.
- Breadth is tracked over 7 and 30 days (views `coverage_7d`, `coverage_30d`).
- **One story per event.** Coverage of the same event by several outlets is
  merged into one story: shared facts are stated once, and each source adds only
  its new facts, context or perspective. Where sources disagree, state the
  difference and who says what; never silently pick one. Wrongly merged
  different events are a defect (kept out by regression tests).
- **Follow-ups.** Candidates are compared with previously published stories at
  event level. An event already covered is selected again only for new facts,
  figures, decisions, outcomes or a meaningful change of perspective, and the
  story must state what is new versus the earlier coverage. A new headline,
  outlet or the passage of time alone is not a development.
- **Global outlook.** About one main story is a Korea story (see the default
  composition); the rest of the edition looks outward.
- Distinguish the **event's geography** from the **reporting source**. A foreign
  event reported by a Korean outlet is a foreign story: never suppress it for
  that reason, and look for the original or international sources before
  writing. NAVER complements Korean coverage; it is not the centre of the edition.
- One outlet is one publisher across feed sections, aggregators and APIs
  (`outletName` in `pipeline/src/cluster.ts`).
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
- **Reference intelligence.** The source registry (`sources/registry.json`)
  reaches beyond news media and government announcements: explanatory,
  science, culture, history, design and technology publications, plus
  discovery-only video channels (`referenceOnly`: they surface topics and
  angles, never evidence). References teach angles, topic patterns and
  intellectual connections from the actual variety of good work, not prose to
  copy, and not generic AI topic lists.
- A candidate reference is activated only after `npm run verify-sources`
  confirms a working dated feed and a readable sample article (robots.txt,
  noai/TDM opt-outs and paywalls respected); listing a publication is not a
  claim that it is accessible or licensed. Never bypass paywalls or access
  restrictions. Track source health, availability, language, region, subject
  and date.

## 4. Writing

Natural, engaging, precise Korean for an intelligent general reader, not a
beginner. A main article reads like an accessible explanatory feature, not a
conventional news report or a stitched summary.

- A reader with no background should understand the whole situation from one
  piece: the key facts, the main perspectives and how events connect.
- For current affairs, investigate and convey: historical and cultural
  background; the people, institutions and interests involved; the events that
  led here; the causal mechanisms behind key developments; what changed and
  why; competing interpretations with attribution; consequences and broader
  implications.
- Build a coherent narrative in which each section answers a question raised by
  the previous one. Prefer concrete scenes, examples and chronological or
  causal progression over lists of disconnected facts.
- For science, culture, history and philosophy, choose the structure that fits
  the subject: discovery, mystery, conflict, experiment, transformation,
  comparison or intellectual journey. Never force one template on every piece.
- Open with a concrete event, scene, tension, discovery or question. Plain,
  natural sentences; explain technical terms briefly in passing.
- Keep apart: established fact, causal analysis (whose), expert opinion,
  stakeholder claim, unresolved question and uncertain forecast. Every
  interpretation is attributed to a named source; never add the model's own
  opinion.
- Never fabricate scenes, dialogue, causal links or emotional details for the
  sake of storytelling. Background facts need sources too (an institution page
  or a read article), not the model's memory.
- Longer is not deeper: cut ornament, padding and repetition.
- **Economy and AI/technology** deliver the news and one piece of lasting
  knowledge each day, for example: the latest event → why people are watching
  → the principle and background → an unexpected connection or concrete case
  → what it means for our lives and society (an example, not a template).
  Economy pieces teach economic principles and people's choices through real
  events, not textbook exposition. AI/technology pieces go beyond product
  launches: how it works, its limits, costs, and industrial and social change.
- Original wording and judgment; never imitate or closely paraphrase a reference
  publication.
- Every published link (sources and concept links) must be verified.

### Headlines and subheadings (Headline Editor stage)

After the body is final, a separate Headline Editor step reviews the headline,
deck and subheadings as a professional editor would. Criteria come from a study
of real Korean and international outlets (`docs/editorial/HEADLINE-STUDY.md`);
never reuse another outlet's headline.

- Read alone, the headline says roughly what the story is about and makes the
  reader want to read it. No abstract metaphors, unfamiliar technical terms or
  teasers that hide the subject.
- It carries the body's most interesting concrete fact (a place, person,
  number, record or change) when there is one. Follow Korean headline grammar:
  news leads with the event and its result; explainers state the event and the
  question the piece answers (`~이유`, `무엇으로 ~나`).
- Records, firsts, numbers, scientific and causal claims in a headline or deck
  are verified against the primary source; a claim is marked as the speaker's.
- The deck adds what the headline cannot hold (actor, figure, scale, time,
  the question) and never repeats it.
- Subheadings name the event, finding, change or conflict of their section and,
  read in order, tell the story. Short natural ones are fine; generic ones
  ("배경", "앞으로", "~하는 것", "고칠 수 있을까") are not (`checkSubheads` notes them).
- No candidate-count, style or question-ratio rule. Record the previous version,
  the reason and the body edits made in the same pass (`headlineReview`).

### Homepage and article pages

- The homepage preview shows the headline and a short deck that makes it
  concrete; the article page delivers the depth the preview promises.
- Article layout: comfortable reading width, responsive mobile-first
  typography, accessible contrast; clear headline and concise standfirst;
  short coherent paragraphs with natural whitespace; meaningful section
  headings; selective bold; a compact timeline or explainer only when it
  materially aids comprehension; source references gathered as unobtrusive
  numbered notes rather than interrupting every sentence.
- Visuals only when they genuinely improve understanding and usage rights
  permit (no article images from sources). No dense blocks, nested cards,
  decorative clutter or formulaic AI layouts.

### 오늘의 한 줄 (news strip)

A news strip directly under the lead story on the homepage (articles link back
to it) for useful domestic and international items that do not merit a main
story: usually 6–10 items. Same collection, retrieval and editorial flow; no
extra cost.

- Each row shows a field tag (한국, 국제, 경제, 기술, 과학, 문화, 사회), **one
  scannable line** (`line`, at most 48 characters, Korean headline grammar) and
  the source date; it opens (`<details>`, no script) to **one or two complete
  Korean sentences** (`text`) stating who, what happened and the key result or
  meaning, with the source link. A short `label` is kept for checks.
- The line may only shorten the text: no number the text lacks, and the text's
  plan, possibility or suspicion wording and attribution are kept (`checkLine`).
- Dates are checked against the edition (source published within 72 hours
  before 09:00 KST of the edition date, never after); duplicates and items that
  repeat a main story are rejected (`checkBriefs` in `web/src/checks.ts`).
- Keep certainty exactly: fact, claim, allegation, scheduled, forecast and
  possibility stay distinguishable; never turn uncertainty into fact. If an item
  cannot be told accurately in one sentence, drop it rather than cut accuracy.
- Each item links to a source whose text was actually read.
- No item repeats a main story, another brief, or earlier coverage without
  genuinely new information. No domestic/foreign or subject quotas.
- Candidates and checks are deterministic (`pipeline/src/preview/briefs.ts`):
  the writer stage writes the sentence; `validateBrief` must pass (one sentence,
  numbers present in the evidence, hedges and attribution preserved, verified
  link, no hype words).

## 5. Editorial workflow (separate model calls, not separate agents)

Current operating mode (2026-10-28): **no paid AI API and no database writes**
until separately approved. The AI roles below run in a Claude scheduled task on
the user's subscription: a fresh cloud session every morning follows
`docs/DAILY-RUN.md` and pushes one sealed edition. It depends on the
subscription's usage limits; when a run cannot finish a good edition, nothing is
published. Rule-based stages run at no cost. Never present a skill or plugin as
unattended automation unless it actually runs on a schedule without the user.

| Role | Responsibility |
|---|---|
| Researcher | gathers and organizes evidence per candidate |
| Editor | evaluates candidates, sets angles, selects the edition |
| Writer | writes original Korean articles grounded in the evidence |
| Fact checker | checks each claim against the evidence only, without the writer's reasoning or confidence |
| Quality reviewer | editorial quality beyond facts (checklist below) |

The quality reviewer checks that each piece is a coherent story rather than a
stitched summary; the reader gets context before complex details; causal claims
are adequately supported; each section adds new understanding; the headline
reflects the article; there is a memorable insight or intellectual payoff; the
prose is accessible without being simplistic; and the edition has genuine
variety beyond daily news. Pieces that fail are revised. Longer writing is not
deeper writing. The checklist and workflow for subscription-based sessions are
in `.claude/skills/generalist-edition/SKILL.md`.

Unsupported claims are corrected, qualified or rejected. Uncertainty and audit
records are preserved. **AI verification is not human fact-checking**: an
automated `passed` never equals human approval.

Deterministic code handles collection, date logic, clustering, arithmetic,
URL checks, storage, scheduling and idempotency. AI is used for judgment and
writing only. Prefer an efficient, testable design over agent complexity.

## 6. Architecture and run model

```
Claude scheduled task (~06:00 KST, subscription, docs/DAILY-RUN.md)
  discover → read → select → write → headline edit → fact-check → review
  → validate (web checks) → seal → push sealed-editions/<date>.sealed.json
GitHub Actions publish.yml (push or 08:12/08:47 KST fallback)
  decrypt → validate → wait for 08:00 KST → GitHub Pages → verify URLs
  → Gmail email once → delivery log; alert on failure
pipeline/ (rule-based collection, reading, selection previews; runs locally/CI)
Supabase Postgres (free plan, project ref luogxbqimauqzoasgesj): not yet used by the daily flow
```

- Build a vertical slice first: one real current story end to end, then extend
  to a full edition. Reusable modules with tests around the real path; no
  mock-only implementations.
- Retries are idempotent: one edition per date, no duplicate rows.
- Log every stage to `pipeline_runs`, including source failures, model
  failures, missing evidence, token usage and cost.
- **Publishing** (approved by the user on 2026-10-28): an edition that passes
  every deterministic check is published automatically at 08:00 KST by
  `.github/workflows/publish.yml` (GitHub Pages, https://onewon1234.github.io/Generalist01/,
  and one Gmail email to the publisher). Editions reach the public repository
  only encrypted (`sealed-editions/`, `web/src/seal.ts`); the private key is the
  GitHub secret `EDITION_PRIVATE_KEY`. Each date is sent once (`delivery/`); a
  missing or invalid edition triggers an alert and is never replaced by an older
  one. Pages stay `noindex` until search visibility is separately approved.

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
- Public deployment beyond the approved daily flow above, search-engine
  indexing, new recipients, or publishing outside that flow
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
