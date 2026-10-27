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

## 2. Vertical slice: one real current story
- [x] Live RSS discovery — **real**: check-sources on Actions fetched 18/19 sources live
      (run 40317078713); 17 dated feeds activated. `hani` has no item dates (inactive).
- [x] NAVER API HUB — **real**: secrets `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET`, 250 items
      from 5 queries (run 40500847744); activated
- [x] Daily ingestion (collect → noise filter → freshness → story grouping → ranked
      candidates) — workflow `ingest`, 05:17 KST; reports only
- [ ] Persist articles and candidate clusters (needs an approved write path to Supabase)
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
