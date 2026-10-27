/**
 * Daily ingestion: collect active sources → drop noise → freshness window →
 * group into story clusters → rank candidates for the editor stage.
 * No AI calls and no database writes (storage needs an approved write path).
 */
import { collect, type SourceHealth } from '../collect/collect.ts';
import type { Fetcher } from '../collect/http.ts';
import type { SourceConfig } from '../collect/registry.ts';
import { FRESHNESS } from '../config.ts';
import { checkFreshness } from '../freshness.ts';
import type { Article, Cluster } from '../types.ts';
import { groupArticles, summarize, type CandidateSummary } from './group.ts';
import { isLiveBlog, noiseReason } from './noise.ts';

export interface IngestResult {
  collectedAt: string;
  health: SourceHealth[];
  counts: { collected: number; noise: number; undated: number; stale: number; future: number; fresh: number; clusters: number; multiSource: number; liveBlogs: number };
  noiseByReason: Record<string, number>;
  candidates: CandidateSummary[];
  /** Full clusters (articles in memory only; never persisted by ingest). */
  clusters: Cluster[];
}

/** Ranking for the editor's attention, not an editorial verdict: corroboration first, then size, then recency. */
export function rankCandidates(cs: CandidateSummary[]): CandidateSummary[] {
  return [...cs].sort((a, b) =>
    b.publishers - a.publishers || b.articles - a.articles || (b.newest ?? '').localeCompare(a.newest ?? ''));
}

export async function ingest(sources: SourceConfig[], fetcher: Fetcher, now = new Date(), env = process.env): Promise<IngestResult> {
  const active = sources.filter((s) => s.active);
  const col = await collect(active, fetcher, now, env);
  const counts = { collected: col.articles.length, noise: 0, undated: 0, stale: 0, future: 0, fresh: 0, clusters: 0, multiSource: 0, liveBlogs: 0 };
  const noiseByReason: Record<string, number> = {};
  const fresh: Article[] = [];
  for (const a of col.articles) {
    const n = noiseReason(a);
    if (n) { counts.noise++; noiseByReason[n] = (noiseByReason[n] ?? 0) + 1; continue; }
    // Widest window here (ongoing major stories); the editor gate applies the per-story window.
    const fr = checkFreshness(a, now, { isMajor: true, ongoing: true });
    if (!fr.ok) {
      if (fr.reason === 'undated source') counts.undated++;
      else if (/future/.test(fr.reason ?? '')) counts.future++;
      else counts.stale++;
      continue;
    }
    if (isLiveBlog(a)) counts.liveBlogs++;
    fresh.push(a);
  }
  counts.fresh = fresh.length;
  const clusters = groupArticles(fresh);
  counts.clusters = clusters.length;
  const candidates = rankCandidates(clusters.map(summarize));
  counts.multiSource = candidates.filter((c) => c.publishers >= 2).length;
  return { collectedAt: col.collectedAt, health: col.health, counts, noiseByReason, candidates, clusters };
}

export const INGEST_WINDOW_HOURS = FRESHNESS.ongoingMaxHours;
