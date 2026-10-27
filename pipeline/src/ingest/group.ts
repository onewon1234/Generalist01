/**
 * Group articles into story clusters (same event). Deterministic and cheap.
 *
 * Features are language-aware: Hangul words become character bigrams (works
 * without a morphological analyser, tolerates particles), Latin text becomes
 * stemmed word tokens without stopwords (character bigrams are far too common
 * in English and chain unrelated stories). Features are weighted by IDF over
 * the day's corpus so boilerplate ("속보", "live", "확산") counts little.
 *
 * Single pass, newest first: an article joins the same-language cluster with
 * the highest average IDF-weighted overlap (≥ threshold), otherwise it seeds a
 * new cluster. Average linkage, not the last member, prevents chaining.
 * Cross-language matching is left to the editor stage.
 */
import { createHash } from 'node:crypto';
import { independentPublishers } from '../cluster.ts';
import { sourceTime } from '../freshness.ts';
import type { Article, Cluster } from '../types.ts';

/** Average weighted overlap with a cluster at or above which an article joins it.
 *  Calibrated on real headlines (2026-10-27): same-event pairs >= 0.27, different-event pairs <= 0.20. */
export const GROUP_THRESHOLD = 0.24;

const STOP = new Set(('the a an and or but of to in on at for from by with as is are was were be been being it its this that these those ' +
  'has have had will would can could may might should not no new says said say after before over under into about up down out ' +
  'more most than then there their they them he she his her we you your our who what when where why how which all just one two ' +
  'live updates update latest news report reports today week year years day').split(' '));

function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** Feature list (with repeats) for a piece of text. */
export function features(text: string): string[] {
  const clean = text.toLowerCase().normalize('NFKC')
    .replace(/\[[^\]]{0,12}\]|\([^)]{0,12}\)|【[^】]{0,12}】/g, ' ') // [속보], (종합2보), (LEAD)
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const out: string[] = [];
  for (const w of clean.split(' ')) {
    if (!w) continue;
    if (/\p{Script=Hangul}/u.test(w)) {
      for (const run of w.match(/\p{Script=Hangul}+|\p{N}+/gu) ?? []) {
        if (/^\p{N}+$/u.test(run)) { if (run.length >= 2) out.push(`#${run}`); continue; }
        if (run.length === 1) out.push(run);
        for (let i = 0; i < run.length - 1; i++) out.push(run.slice(i, i + 2));
      }
    } else if (/^\p{N}+$/u.test(w)) {
      if (w.length >= 2) out.push(`#${w}`);
    } else if (w.length >= 3 && !STOP.has(w)) {
      out.push(stem(w));
    }
  }
  return out;
}

function text(a: Article): string {
  return a.title;
}

/** IDF over the given documents: ln((N + 1) / (df + 1)) + 1. */
export function idfOf(docs: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const n = docs.length;
  const idf = new Map<string, number>();
  for (const [t, c] of df) idf.set(t, Math.log((n + 1) / (c + 1)) + 1);
  return idf;
}

interface Doc { feats: Set<string>; mass: number }

/**
 * IDF-weighted overlap: total weight of shared features divided by the weight
 * of the lighter document. Short headlines are dominated by their unique words,
 * which sinks cosine; overlap keeps the shared event name decisive.
 */
export function weightedOverlap(a: Doc, b: Doc, idf: Map<string, number>): number {
  const [small, big] = a.feats.size <= b.feats.size ? [a, b] : [b, a];
  let shared = 0;
  for (const f of small.feats) if (big.feats.has(f)) shared += idf.get(f) ?? 1;
  const m = Math.min(a.mass, b.mass);
  return m ? shared / m : 0;
}

export function clusterKey(seedUrl: string): string {
  return createHash('sha256').update(seedUrl).digest('hex').slice(0, 12);
}

/** Members compared per cluster (most recent ones) to bound cost on big days. */
const LINKAGE_SAMPLE = 8;

export function groupArticles(articles: Article[], threshold = GROUP_THRESHOLD): Cluster[] {
  const sorted = [...articles].sort((x, y) => (sourceTime(y) ?? '').localeCompare(sourceTime(x) ?? ''));
  const featLists = sorted.map((a) => [...new Set(features(text(a)))]);
  const idf = idfOf(featLists);
  const docs: Doc[] = featLists.map((fs) => ({ feats: new Set(fs), mass: fs.reduce((s, f) => s + (idf.get(f) ?? 1), 0) }));
  const groups: { lang: string; members: Doc[]; c: Cluster }[] = [];
  sorted.forEach((a, i) => {
    const d = docs[i];
    let best: (typeof groups)[number] | undefined;
    let bestScore = 0;
    for (const g of groups) {
      if (g.lang !== a.language) continue;
      // Average linkage: the article must resemble the cluster as a whole, not just one member.
      const sample = g.members.slice(-LINKAGE_SAMPLE);
      const s = sample.reduce((t, m) => t + weightedOverlap(d, m, idf), 0) / sample.length;
      if (s > bestScore) { bestScore = s; best = g; }
    }
    if (best && bestScore >= threshold) {
      best.c.articles.push(a);
      best.members.push(d);
    } else {
      groups.push({ lang: a.language, members: [d], c: { key: clusterKey(a.url), title: a.title, articles: [a], freshnessType: 'timely' } });
    }
  });
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
