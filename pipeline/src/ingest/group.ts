/**
 * Group articles into story clusters (same event). Deterministic and cheap:
 * character-bigram similarity on titles (+ excerpt start), which works for
 * Korean without a morphological analyser. Cross-language matching is left to
 * the editor stage.
 */
import { independentPublishers } from '../cluster.ts';
import { sourceTime } from '../freshness.ts';
import type { Article, Cluster } from '../types.ts';
import { createHash } from 'node:crypto';

/** Similarity at or above which two items are treated as the same story. */
export const GROUP_THRESHOLD = 0.32;

/** Character bigrams of letters/digits (Hangul syllables, Latin, digits), lower-cased. */
export function bigrams(s: string): Set<string> {
  const clean = s.toLowerCase().normalize('NFKC')
    .replace(/\[[^\]]{0,12}\]|\([^)]{0,12}\)/g, ' ')   // [단독], (종합2보), (LEAD)
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const out = new Set<string>();
  for (const w of clean.split(' ')) {
    if (w.length === 1) { out.add(w); continue; }
    for (let i = 0; i < w.length - 1; i++) out.add(w.slice(i, i + 2));
  }
  return out;
}

export function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return (2 * inter) / (a.size + b.size);
}

function signature(a: Article): Set<string> {
  return bigrams(`${a.title} ${(a.excerpt ?? '').slice(0, 80)}`);
}

export function clusterKey(seedUrl: string): string {
  return createHash('sha256').update(seedUrl).digest('hex').slice(0, 12);
}

/**
 * Greedy single pass, newest first: each article joins the most similar
 * existing cluster of the same language if similarity ≥ threshold (compared
 * with the cluster's seed and its newest member), otherwise starts a new one.
 */
export function groupArticles(articles: Article[], threshold = GROUP_THRESHOLD): Cluster[] {
  const sorted = [...articles].sort((x, y) => (sourceTime(y) ?? '').localeCompare(sourceTime(x) ?? ''));
  const groups: { lang: string; seed: Set<string>; last: Set<string>; c: Cluster }[] = [];
  for (const a of sorted) {
    const sig = signature(a);
    let best: (typeof groups)[number] | undefined;
    let bestScore = 0;
    for (const g of groups) {
      if (g.lang !== a.language) continue;
      const s = Math.max(dice(sig, g.seed), dice(sig, g.last));
      if (s > bestScore) { bestScore = s; best = g; }
    }
    if (best && bestScore >= threshold) {
      best.c.articles.push(a);
      best.last = sig;
    } else {
      groups.push({ lang: a.language, seed: sig, last: sig, c: { key: clusterKey(a.url), title: a.title, articles: [a], freshnessType: 'timely' } });
    }
  }
  return groups.map((g) => g.c);
}

export interface CandidateSummary {
  key: string;
  title: string;
  language: string;
  articles: number;
  publishers: number;
  sources: string[];
  newest: string | null;
  urls: string[];
}

export function summarize(c: Cluster): CandidateSummary {
  const times = c.articles.map(sourceTime).filter((t): t is string => !!t).sort();
  return {
    key: c.key,
    title: c.title,
    language: c.articles[0]?.language ?? '',
    articles: c.articles.length,
    publishers: independentPublishers(c),
    sources: [...new Set(c.articles.map((a) => a.sourceKey ?? a.publisher))],
    newest: times.at(-1) ?? null,
    urls: c.articles.slice(0, 5).map((a) => a.url),
  };
}
