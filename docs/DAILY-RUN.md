# Daily editorial run (unattended scheduled session)

A Claude scheduled task starts a fresh cloud session every morning (Asia/Seoul)
and follows this file. Its only output is one sealed edition pushed to `main`;
`.github/workflows/publish.yml` publishes it at 08:00 KST and sends the email.
Approved by the user on 2026-10-28: automatic publication of editions that pass
every check; subscription session (no paid API); recipient set in secrets.

## Hard rules

- Never commit an unencrypted edition, draft, note or source text. The run adds
  only `sealed-editions/<date>.sealed.json`, or a `research-packs/request-<date>`
  or `delivery/<date>.skip.json` file as described below.
- No paid API calls, no database writes, no other repository writes, no new
  scheduled tasks, no changes to workflows, keys or settings.
- If a good edition (at least 5 main stories that pass the checks) cannot be
  finished by **07:45 KST**, push no edition. Instead push one file,
  `delivery/<date>.skip.json` with `{"date":"<date>","reason":"<one Korean sentence: why>"}`
  (no article text); the publish workflow then alerts the publisher at once.
  Never reuse or re-date an earlier edition.
- A message added when the task is fired by hand does not reach the session
  (run log 2026-10-29), so a manual firing cannot change the deadline.
- **Test mode** (no publication): run these steps by hand in an interactive
  session, give the edition a test provenance, validate with `src/build.ts`,
  seal it to a file outside `sealed-editions/` (for example the session's
  scratch folder) and check it with `scripts/prepare.ts` where the private key
  is available. Nothing is pushed to `sealed-editions/`, so nothing is
  published or emailed. Verified 2026-10-29 (report in the conversation).
- GitHub's scheduled workflows can start hours late (observed 2026-10-29), so
  never wait for one: request the research pack yourself (step 3).
- Facts only from (a) the morning research pack (`research-packs/<date>.json`,
  public, minimal: titles, URLs, outlets, times, access status, figures and one
  short opening sentence per read source) and (b) pages you fetch in this run.
  In an unattended session WebFetch works only for URLs that a WebSearch in the
  same session returned (checked 2026-10-28); direct URLs are refused. Do not
  use Firecrawl (it is billed) or any other way around a block. Background
  facts need a source too. Record the access level honestly: `원문 확인` for
  pages you read in full, `요지 확인(자동 수집)` when only the pack's lede and
  figures were available; claims from such a source must not go beyond them.
- No keys or secrets are needed. The only key involved is the public key that
  seals the edition (`keys/edition-public.pem`, used by `src/seal.ts seal`).

## Steps

1. `git clone https://github.com/onewon1234/Generalist01 generalist-daily`
   (or pull), then read `CLAUDE.md`, `.claude/skills/generalist-edition/SKILL.md`,
   `docs/editorial/HEADLINE-STUDY.md` and `web/src/types.ts` (the edition schema).
   `cd web && npm ci`.
2. Edition date: today in Asia/Seoul (`TZ=Asia/Seoul date +%F`). Look at the
   last 7 days of `sealed-editions/` file names to know which dates exist; you
   cannot read them, so avoid repeating an event only if you know it was covered.
3. **Read the research pack** `research-packs/<date>.json` (the shell reaches
   GitHub and npm only, not news sites). It holds about 60 researched
   candidates (`stories`: title, desk, sources with url, outlet, time, access
   status, figures and a short lede), heuristic scores (not editorial
   judgment), brief candidates (`briefs`), discovery leads and format
   exclusions (schema: `pipeline/src/preview/pack.ts`). Check each lede against
   its title: some Korean aggregator entries carry the lede of a different
   article, and a cluster can still mix two events; never use a lede that does
   not match its title. If today's pack is not
   there, request one immediately: `echo <date> > research-packs/request-<date>` then
   commit and push that file only (it starts `.github/workflows/research.yml`,
   about 4 minutes), and `git pull` every 2 minutes. If no pack exists 30
   minutes after the run started, push the skip file (see the hard rules).
4. **Select** following CLAUDE.md §2 and the default composition: about one
   Korea story (a domestic social, cultural or economic phenomenon worth
   understanding, not routine news), one or two world stories with history and
   causality, one economy story that teaches a principle through the news, one
   AI/technology story about how it works and what it changes, zero to two
   exploration pieces. Exclude reviews, opinion, sponsored, live blogs, video,
   digests and routine notices (`pipeline/src/kind.ts`). One story per event:
   check that the articles you combine describe the same event. Do not pad:
   five excellent stories beat seven.
5. **Research** each chosen story beyond the pack: run WebSearch with the
   story's distinctive names and terms (mode extended for same-day news:
   standard searches returned only older pages in the 2026-10-29 test), then WebFetch the relevant results to read more of the reporting
   and the primary source (paper, official release, data) for scientific,
   numeric, record ("처음", "n년 만에") and causal claims. Prefer at least two
   independent sources per story. If a story cannot be supported well, drop it.
6. **Write** each story in Korean per CLAUDE.md §4 (narrative-first, attributed
   interpretation, no fabricated scenes). Depth, not length: every main story
   explains, each with a cited source, (a) the background and how we got here,
   (b) the cause or mechanism, (c) the main actors and their interests,
   (d) the consequences, and (e) what is still unknown or disputed. When a part
   cannot be supported by a source you read, say it is not known yet; never
   fill it from memory. Find free, reliable additional material (official
   releases, papers, institutions' pages, reputable outlets) through
   WebSearch. Several outlets repeating one wire report or one press release
   count as one source, not as independent corroboration; say "단일 출처"
   when that is all there is. A story that cannot be explained this way is
   dropped, even if that leaves five. Then the
   Headline Editor pass (CLAUDE.md "Headlines and subheadings"), recording
   `headlineReview` with the reason.
7. **오늘의 한 줄**: 6–10 items not covered by the main stories, from fetched
   sources published within 72 hours before 09:00 KST of the edition date: tag,
   label, `line` (≤ 48 characters), `text` (1–2 sentences), url, publisher,
   published (ISO).
8. **Fact-check** every number, name, date, quote and hedge against the fetched
   text, then the quality review checklist in the skill. Fix or drop.
9. Save the edition as `/tmp/edition/<date>.json` (outside the repository) with
   `status: "published"`, `provenance: "매일 아침 자동 편집: 기사 선정·조사·집필·검증을 Claude가 수행하고, 규칙 기반 검사를 통과한 판만 발행합니다."`.
   Validate: `cd web && npx tsx src/build.ts /tmp/edition/<date>.json --out /tmp/site`
   must succeed (it runs every deterministic check). Fix until it passes.
10. Seal and push (only this file):
    ```
    cd web && npx tsx src/seal.ts seal /tmp/edition/<date>.json ../sealed-editions/<date>.sealed.json
    cd .. && git add sealed-editions/<date>.sealed.json && git commit -m "edition: <date> (sealed)" && git push origin HEAD:main
    ```
    If the push is rejected, `git pull --rebase` and push again.
11. The run log (`run-log/<date>.txt` on branch `claude/run-log`) must record:
    actual start and end time (KST); number of main stories and total reading
    time (from `readingMinutes`); for every story, its sources with the access
    level actually reached and whether its key claims are independently
    corroborated or single-source; whether every quality check passed (build
    errors and editor notes); and whether sealing and the push to GitHub
    succeeded (commit id). Then end with a short report: chosen stories by desk with the reason, stories
    considered and dropped, sources that could not be read, and the time the
    edition was pushed.
