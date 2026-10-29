# Daily editorial run (unattended scheduled session)

A Claude scheduled task starts a fresh cloud session every morning (Asia/Seoul)
and follows this file. Its only output is one sealed edition pushed to `main`;
`.github/workflows/publish.yml` publishes it at 08:00 KST and sends the email.
Approved by the user on 2026-10-28: automatic publication of editions that pass
every check; subscription session (no paid API); recipient set in secrets.

## Hard rules

- Never commit an unencrypted edition, draft, note or source text. The only file
  the run adds is `sealed-editions/<date>.sealed.json`.
- No paid API calls, no database writes, no other repository writes, no new
  scheduled tasks, no changes to workflows, keys or settings.
- If a good edition (at least 5 main stories that pass the checks) cannot be
  finished by **07:45 KST**, push no edition. Instead push one file,
  `delivery/<date>.skip.json` with `{"date":"<date>","reason":"<one Korean sentence: why>"}`
  (no article text); the publish workflow then alerts the publisher at once.
  Never reuse or re-date an earlier edition.
- GitHub's scheduled workflows can start hours late (observed 2026-10-29), so
  never wait for one: request the research pack yourself (step 3).
- Facts only from (a) the morning research pack, whose pages the rule-based
  pipeline read under robots.txt, opt-out and paywall rules, and (b) pages you
  fetch in this run. In an unattended session WebFetch works only for URLs that
  a WebSearch in the same session returned (checked 2026-10-28); direct URLs
  are refused. Do not use Firecrawl (it is billed) or any other way around a
  block. Background facts need a source too. Record the access level
  honestly: `원문 확인` for pages the pipeline or you read, `발췌 확인` when only
  the pack's excerpt was available.
- The research key is given in the task prompt. Write it to `/tmp/research.pem`
  only; never print, commit or copy it anywhere else.

## Steps

1. `git clone https://github.com/onewon1234/Generalist01 generalist-daily`
   (or pull), then read `CLAUDE.md`, `.claude/skills/generalist-edition/SKILL.md`,
   `docs/editorial/HEADLINE-STUDY.md` and `web/src/types.ts` (the edition schema).
   `cd web && npm ci`.
2. Edition date: today in Asia/Seoul (`TZ=Asia/Seoul date +%F`). Look at the
   last 7 days of `sealed-editions/` file names to know which dates exist; you
   cannot read them, so avoid repeating an event only if you know it was covered.
3. **Open the research pack** (the shell has no internet access):
   `cd web && npx tsx src/seal.ts unseal ../research-packs/<date>.sealed.json /tmp/research.json --key-file /tmp/research.pem`.
   It is the pipeline preview (`pipeline/src/preview/preview.ts`): about 60
   researched candidates (`stories`: title, desk, records with url, publisher,
   dates, access status, evidence sentences and an excerpt of up to 1,000
   characters), heuristic scores (not editorial judgment), brief candidates
   (`briefs`), discovery leads and format exclusions. If today's pack is not
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
   story's distinctive names and terms (mode standard, extended only when
   needed), then WebFetch the relevant results to read more of the reporting
   and the primary source (paper, official release, data) for scientific,
   numeric, record ("처음", "n년 만에") and causal claims. Prefer at least two
   independent sources per story. If a story cannot be supported well, drop it.
6. **Write** each story in Korean per CLAUDE.md §4 (narrative-first, attributed
   interpretation, no fabricated scenes), about 3–5 minutes each. Then the
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
11. End with a short report: chosen stories by desk with the reason, stories
    considered and dropped, sources that could not be read, and the time the
    edition was pushed.
