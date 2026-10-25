# Rebuild checklist

Status labels: **real** (works against live systems), **mocked**, **manual**,
**credential-dependent**, **todo**. A box is ticked only for verified work;
the label says how far it has been verified.

## 0. Access and baseline
- [x] Recovery assets verified (zip on Mac and in chat, 23/23 checksums OK) — 2026-10-26
- [x] Supabase checked read-only: 3 migrations, 16 tables, RLS on all, 0 policies,
      reference_sources 36, reference_items 360 (34 analysed), Edition No.1 in_review — 2026-10-26
- [x] `onewon1234/Generalist01` inspected: empty (0 branches, 0 commits) — 2026-10-26
- [ ] Push local history to `main` — **blocked**: push returns 403, the Claude GitHub App
      has no access to Generalist01. Reads work. Local commits are backed up as a git bundle
      on the Mac (`~/development/generalist-daily-backup/`).

## 1. Minimum runnable project + CI
- [x] `pipeline/` package (Node 22, TypeScript 5.9, node:test via tsx) — local
- [x] Modules recreated for recovered `select.ts`: types, config, text, freshness, cluster — local
- [x] `select.ts` aligned with spec 04: shape as preference, freshness from newest
      development, ongoing-story window — local, 33 tests
- [x] `supabase/rollbacks/` rewritten; migrations + rollbacks round-trip on PGlite — local
- [x] CI workflow (typecheck, tests, guard tests, secret/dump check) — actionlint OK and
      steps run in a clean checkout; **not yet run on GitHub** (push blocked)

## 2. Vertical slice: one real current story
- [ ] Live discovery (RSS first; NAVER API HUB when keys are provided)
- [ ] Permitted source reading with recorded access level (robots, paywall, terms)
- [ ] Evidence extraction: claims, dates, primary vs secondary, limitations
- [ ] Candidate evaluation and why-now / angle / payoff
- [ ] Korean draft (credential-dependent: Claude API, needs approval)
- [ ] Independent fact check + quality review
- [ ] Private draft storage (needs approved schema for evidence records)

## 3. Full daily edition
- [ ] 5–7 stories, breadth over 7/30 days, dedup against history
- [ ] Idempotent re-runs, cost and usage logging

## 4. Website
- [ ] Static site: homepage cards, full article pages, archive, topics, about
- [ ] Private preview build as a workflow artifact (no deployment)

## 5. Scheduling and acceptance
- [ ] Scheduled workflow (Asia/Seoul)
- [ ] Three unattended scheduled runs, each verified for research, evidence,
      quality, drafting and private storage
- [ ] Publishing remains manual and human-approved
