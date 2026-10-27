# Rebuild checklist

Status labels: **real** (works against live systems), **mocked**, **manual**,
**credential-dependent**, **todo**. A box is ticked only for verified work;
the label says how far it has been verified.

## 0. Access and baseline
- [x] Recovery assets verified (zip on Mac and in chat, 23/23 checksums OK) — 2026-10-26
- [x] Supabase checked read-only: 3 migrations, 16 tables, RLS on all, 0 policies,
      reference_sources 36, reference_items 360 (34 analysed), Edition No.1 in_review — 2026-10-26
- [x] `onewon1234/Generalist01` inspected: empty (0 branches, 0 commits) — 2026-10-26
- [x] Local history pushed unchanged to `main` (9 commits, `edcf4e0`…`124277b`) — 2026-10-26

## 1. Minimum runnable project + CI
- [x] `pipeline/` package (Node 22, TypeScript 5.9, node:test via tsx) — local
- [x] Modules recreated for recovered `select.ts`: types, config, text, freshness, cluster — local
- [x] `select.ts` aligned with spec 04: shape as preference, freshness from newest
      development, ongoing-story window — local, 33 tests
- [x] `supabase/rollbacks/` rewritten; migrations + rollbacks round-trip on PGlite — local
- [x] CI workflow (typecheck, tests, guard tests, secret/dump check) — **real**: green on
      GitHub Actions (runs 40316787591, 40317070818)

## 2. Vertical slice: real stories end to end
- [x] Live discovery — **real** (18 sources incl. NAVER; daily ingest workflow)
- [x] Story grouping with regression fixtures from live data (fire split, date/word false
      merges, English India/Sudan false merges) — **real data**, English split remains a todo
- [x] Original-article retrieval: robots.txt (RFC 9309), noai/TDM opt-outs, paywall flag,
      explicit access status; only `read` counts — **real**: private preview runs 2026-10-27
      (run 2: 37 requests, 28 read, 5 robots-blocked, 4 insufficient body)
- [x] Evidence extraction (lede, figures, quotes, statements; ≤ 1000 chars/article) and
      corroboration across read articles only — **real**
- [x] Editorial preview (pool, heuristic scores, selection, Korean Markdown with citations)
      — **real but heuristic**: selection quality is weak without the AI editor
- [x] Sample Korean newsletter from real evidence — **manual**: selection and writing done
      by Claude in-session standing in for the unapproved AI stages
- [x] '짧게 보는 세상' candidates and sentence checks (`briefs.ts`, `validateBrief`) — **real
      candidates, manual sentences**: 10 briefs for the 2026-10-28 sample all pass the checks
- [x] Source balancing (canonical outlets, evergreen window, turn-taking ranking, no
      language share) and 8 verified non-news references — **real**: runs r5–r7
- [x] Reader-payoff selection without a news-first mix — **real code, heuristic scores**
- [x] Static site renderer (homepage + article pages, desktop/mobile screenshots) —
      **real**; edition content of the 2026-10-28 test edition is **manual**
- [ ] AI editor / writer / fact checker / quality reviewer — **needs approval** (docs/APPROVALS.md B)
- [ ] Private draft storage — **needs approval** (docs/APPROVALS.md A)

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
