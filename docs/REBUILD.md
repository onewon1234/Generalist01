# Rebuild checklist

Status labels: **real** (works against live systems), **mocked**, **manual**,
**credential-dependent**, **todo**. A box is ticked only for real, verified work.

## 0. Access and baseline
- [x] Recovery assets verified (zip on Mac and in chat, 23/23 checksums OK) — 2026-10-26
- [x] Supabase checked read-only: 3 migrations, 16 tables, RLS on all, 0 policies,
      reference_sources 36, reference_items 360 (34 analysed), Edition No.1 in_review — 2026-10-26
- [x] Local `claude/main` lineage with recovered files (not yet pushed)
- [ ] GitHub access — **blocked**: no GitHub account linked to the claude.ai session;
      repository is not readable anonymously (private). See options in the session report.
- [ ] Inspect existing branches and Codex PRs #1, #2 (read-only)
- [ ] Push `claude/main` as a new, independent branch (needs user OK for first write)

## 1. Minimum runnable project + CI
- [ ] `pipeline/` package (Node 22, TypeScript, node:test), types and config for the
      consolidated spec (no fixed quotas)
- [ ] Restore tests around `select.ts`, adjusted to the new editorial rules
- [ ] CI: typecheck, tests, guard tests; Postgres service container applying
      `supabase/migrations/*` for integration tests
- [ ] `supabase/rollbacks/` rewritten from the migration originals

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
