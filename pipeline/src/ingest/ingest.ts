/**
 * Daily ingestion: collect active sources → drop noise → freshness window →
 * group into story clusters → rank candidates for the editor stage.
 * No AI calls and no database writes (storage needs an approved write path).
 */
import { collect, type SourceHealth } from '../collect/collect.ts';
import type { Fetcher } from '../collect/http.ts';
import type { SourceConfig } from '../collect/registry.ts';
import { FRESHNESS } from '../config.ts';
import { checkFreshness, sourceTime } from '../freshness.ts';
import { hoursBetween } from '../text.ts';
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

/**
 * Ranking for the editor's attention, not an editorial verdict: corroboration
 * first. Among clusters with the same number of publishers, sources take turns
 * (each source's own clusters by size, then recency), so a feed that publishes
 * every few minutes cannot fill the band by recency alone.
 */
export function rankCandidates(cs: CandidateSummary[]): CandidateSummary[] {
  const bySize = (a: CandidateSummary, b: CandidateSummary) =>
    b.articles - a.articles || (b.newest ?? '').localeCompare(a.newest ?? '');
  const bands = new Map<number, CandidateSummary[]>();
  for (const c of cs) bands.set(c.publishers, [...(bands.get(c.publishers) ?? []), c]);
  const out: CandidateSummary[] = [];
  for (const p of [...bands.keys()].sort((a, b) => b - a)) {
    const queues = new Map<string, CandidateSummary[]>();
    for (const c of [...bands.get(p)!].sort(bySize)) {
      const lead = c.sources[0] ?? '?';
      queues.set(lead, [...(queues.get(lead) ?? []), c]);
    }
    const qs = [...queues.values()];
    for (let i = 0; qs.some((q) => i < q.length); i++) for (const q of qs) if (i < q.length) out.push(q[i]);
  }
  return out;
}

/** Freshness for an item from an evergreen source: kept up to FRESHNESS.evergreenMaxDays. */
export function evergreenFresh(a: Article, now: Date): { ok: boolean; reason?: string } {
  const t = sourceTime(a);
  if (!t) return { ok: false, reason: 'undated source' };
  const age = hoursBetween(t, now);
  if (age < -FRESHNESS.futureSkewHours) return { ok: false, reason: 'publication date is in the future' };
  if (age > FRESHNESS.evergreenMaxDays * 24) return { ok: false, reason: `older than ${FRESHNESS.evergreenMaxDays} days` };
  return { ok: true };
}

export async function ingest(sources: SourceConfig[], fetcher: Fetcher, now = new Date(), env = process.env): Promise<IngestResult> {
  const active = sources.filter((s) => s.active);
  const evergreenKeys = new Set(active.filter((s) => s.evergreen).map((s) => s.key));
  const isEvergreen = (a: Article) => evergreenKeys.has(a.sourceKey ?? '');
  const col = await collect(active, fetcher, now, env);
  const counts = { collected: col.articles.length, noise: 0, undated: 0, stale: 0, future: 0, fresh: 0, clusters: 0, multiSource: 0, liveBlogs: 0 };
  const noiseByReason: Record<string, number> = {};
  const fresh: Article[] = [];
  for (const a of col.articles) {
    const n = noiseReason(a);
    if (n) { counts.noise++; noiseByReason[n] = (noiseByReason[n] ?? 0) + 1; continue; }
    // Widest window here (ongoing major stories); the editor gate applies the per-story window.
    const fr = isEvergreen(a) ? evergreenFresh(a, now) : checkFreshness(a, now, { isMajor: true, ongoing: true });
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
  // Clusters made only of evergreen-source items are judged as evergreen pieces.
  for (const c of clusters) if (c.articles.every(isEvergreen)) c.freshnessType = 'evergreen';
  counts.clusters = clusters.length;
  const candidates = rankCandidates(clusters.map(summarize));
  counts.multiSource = candidates.filter((c) => c.publishers >= 2).length;
  return { collectedAt: col.collectedAt, health: col.health, counts, noiseByReason, candidates, clusters };
}

export const INGEST_WINDOW_HOURS = FRESHNESS.ongoingMaxHours;
