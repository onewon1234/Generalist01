# Source-bias audit (2026-10-27)

Private preview run r4 on the user's Mac, 2026-10-27 23:06 KST, pool 36, 3
articles per story. NAVER was **not** part of this run (its credentials exist
only as GitHub secrets), so Yonhap's weight below comes from the RSS feed
alone. Reproduce: `npm run preview -- --out-dir <dir> --pool 36` writes
`audit.md`/`audit.json` (`pipeline/src/preview/audit.ts`).

| source | collected | fresh | clusters | top 60 | pool | requested | read | auto-selected |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| yonhap | 120 | 117 | 96 | 23 | 14 | 14 | 13 | 3 |
| nature-news | 75 | 28 | 25 | 1 | 1 | 2 | 0 | 0 |
| guardian-culture | 64 | 52 | 50 | 0 | 1 | 3 | 3 | 0 |
| sciencedaily | 60 | 37 | 33 | 2 | 0 | 0 | 0 | 0 |
| conversation | 49 | 11 | 7 | 1 | 1 | 4 | 4 | 0 |
| bbc-business | 47 | 24 | 20 | 5 | 4 | 4 | 4 | 0 |
| guardian-world | 45 | 43 | 38 | 10 | 4 | 7 | 6 | 0 |
| aljazeera | 25 | 25 | 20 | 9 | 4 | 6 | 0 | 2 |
| bbc-world | 24 | 24 | 18 | 5 | 3 | 8 | 7 | 0 |
| aeon | 20 | 4 | 4 | 0 | 0 | 0 | 0 | 0 |
| knowable | 20 | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| rest-of-world | 12 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| mit-tr | 10 | 7 | 7 | 0 | 0 | 0 | 0 | 0 |
| smithsonian | 10 | 10 | 10 | 3 | 4 | 4 | 2 | 1 |
| nautilus | 10 | 10 | 9 | 1 | 0 | 1 | 1 | 0 |
| owid | 10 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| quanta | 5 | 2 | 2 | 0 | 0 | 0 | 0 | 0 |

Korean share: 20% collected → 29% fresh → 38% of the top 60 → 39% of the pool
→ 33% of read articles → 50% of the automatic selection (and 4 of 6 main
stories in the manual 2026-10-28 sample, 3 of them foreign events relayed by
Yonhap).

## Causes, by stage

1. **Freshness cut before editorial judgement.** Ingest drops everything older
   than 120 h, including slow knowledge publishers (Aeon 20→4, Knowable 20→2,
   Conversation 49→11, Nature 75→28, OWID 10→1, Rest of World 12→1). The
   evergreen path in `select.ts` never sees them. A wire service loses almost
   nothing (Yonhap 120→117).
2. **Ranking tie-break by recency.** Only 14 clusters have 2+ publishers; the
   rest of the top 60 are single-source clusters ordered by article count and
   then newest time. A wire feed that publishes every few minutes wins those
   ties: Yonhap has 28% of clusters but 38% of the top 60; Guardian culture has
   15% of clusters and none in the top 60.
3. **Pool rule favours tier-1 single sources.** Single-source clusters enter
   the research pool only from tier-1 sources, so every Yonhap item qualifies
   while ScienceDaily and Nautilus (tier 2) never do. The 60% per-language cap
   allows Korean to take up to 22 of 36 pool places.
4. **Retrieval asymmetry.** Yonhap pages read 13/14; Al Jazeera 0/6 (robots.txt
   disallows), Nature 0/2 (bot challenge), Smithsonian 2/4. Foreign stories are
   more often unverified, which pushes both the rules and the human/AI editor
   toward stories with Korean evidence. This is legitimate access behaviour; the
   fix is finding alternative sources, not bypassing it.
5. **Editorial step.** In the manual sample, foreign events (Ebola, EU hybrid
   cars, Vietnam chip plant) were taken from Yonhap's relay instead of the
   original or international sources.
6. **NAVER (scheduled GitHub runs only).** About 250 Korean items a day would
   raise the Korean share further, and a Yonhap article found both in the RSS
   feed ("연합뉴스") and via NAVER ("yna.co.kr") is counted as two publishers,
   inflating its rank. The audit flags such clusters; none in this run because
   NAVER was absent.

## Minimal changes proposed (applied 2026-10-27, see below)

No collection volume is cut and no new collection system is added.

1. Registry flag `evergreen: true` for knowledge publishers (Aeon, Knowable,
   Quanta, Nautilus, Smithsonian, The Conversation, OWID, Rest of World): ingest
   keeps them up to 30 days as `freshnessType: 'evergreen'`, judged later by the
   existing EVERGREEN bar. (`config.ts`, `ingest.ts`, `registry.json`)
2. Ranking tie-break: among clusters with the same publisher count, interleave
   by source instead of newest-first, so one prolific feed cannot fill the tie
   band. (`rankCandidates`)
3. Pool eligibility: single-source clusters qualify from tier 1 **or** from an
   evergreen source; keep the language cap but stop it from being the only
   brake (the interleave does that).
4. Outlet identity: treat NAVER host names and feed names of the same outlet as
   one publisher (`OUTLET_ALIASES` used in `publisherKey`).
5. Editor stage (subscription session, no code): for a foreign event found via
   a Korean outlet, look for the original/international sources with the
   `read` CLI before writing; label each story domestic or foreign.

## After the fixes (private runs r5–r7, 2026-10-27 23:25–23:40 KST)

Applied: canonical outlet identity, 30-day window for evergreen sources,
turn-taking ranking, evergreen pool entry, no per-language pool share, and 8
new verified non-news sources (plus discovery-only leads).

| stage | Korean share before (r4) | after (r7) |
|---|---:|---:|
| collected | 20% | 12% |
| top 60 candidates | 38% | 3% |
| research pool | 39% | 3% |
| read | 33% | 0% |

Research pool by subject (r7): world/politics 33%, culture 28%, science 18%,
economics 13%, psychology 5%, history 5%.

Remaining issues:
- Heuristic scores cannot clear the evergreen bar (70), so the *automatic*
  selection is still all current stories; the editor stage has to score
  reader payoff for evergreen pieces to compete.
- Korean domestic coverage now rarely reaches the pool; this matches the
  global-first tendency but means domestic news mostly reaches readers through
  briefs chosen by the editor.
- Some sentence-case English false merges remain (e.g. North/South Korea
  items); a known-limitation test records one.
