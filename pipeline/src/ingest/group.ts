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
  'live updates update latest news report reports today week year years day ' +
  'see seen seeing everything something anything nothing thing things way ways make makes made get gets got ' +
  'still back first last next big small good bad best people time times know knew why look looks just even ' +
  'also much many very really here now could would should every other another again against between while').split(' '));

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
        // Short numbers are mostly dates and counts ("27일", "3분기"); single syllables are particles/units.
        if (/^\p{N}+$/u.test(run)) { if (run.length >= 3) out.push(`#${run}`); continue; }
        for (let i = 0; i < run.length - 1; i++) out.push(run.slice(i, i + 2));
      }
    } else if (/^\p{N}+$/u.test(w)) {
      if (w.length >= 3) out.push(`#${w}`);
    } else if (w.length >= 3 && !STOP.has(w)) {
      out.push(stem(w));
    }
  }
  return out;
}

/**
 * Capitalised words of a Latin-script headline (stemmed, lower-cased): names
 * of people, places and organisations. Stopwords are excluded, so sentence
 * starters like "How" or "Why" do not count.
 */
export function properNouns(title: string): Set<string> {
  const out = new Set<string>();
  for (const m of title.normalize('NFKC').matchAll(/\p{Lu}[\p{L}\p{N}]*(?:['’]s)?/gu)) {
    const w = m[0].replace(/['’]s$/, '').toLowerCase();
    if (w.length >= 3 && !STOP.has(w)) out.add(stem(w));
  }
  return out;
}

/** Consecutive content-word pairs of a Latin-script headline, e.g. "israel election". */
export function phrases(title: string): Set<string> {
  const toks = features(title).filter((f) => !f.startsWith('#'));
  const out = new Set<string>();
  for (let i = 0; i < toks.length - 1; i++) out.add(`${toks[i]} ${toks[i + 1]}`);
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

interface Doc { feats: Set<string>; mass: number; latin: boolean; proper: Set<string>; phrases: Set<string> }

/**
 * IDF-weighted overlap: total weight of shared features divided by the weight
 * of the lighter document. Short headlines are dominated by their unique words,
 * which sinks cosine; overlap keeps the shared event name decisive.
 */
export function weightedOverlap(a: Doc, b: Doc, idf: Map<string, number>): number {
  return overlapDetail(a, b, idf).score;
}

export function overlapDetail(a: Doc, b: Doc, idf: Map<string, number>): { score: number; shared: number } {
  const [small, big] = a.feats.size <= b.feats.size ? [a, b] : [b, a];
  let mass = 0, shared = 0;
  for (const f of small.feats) if (big.feats.has(f)) { mass += idf.get(f) ?? 1; shared++; }
  const m = Math.min(a.mass, b.mass);
  return { score: m ? mass / m : 0, shared };
}

/** A single shared feature ("대전", one English word) never links two stories. */
export const MIN_SHARED_FEATURES = 2;
/** English headlines sharing only one proper noun (and no two-word phrase) must be this similar to join.
 *  Measured 2026-10-27: same-event pairs 0.29–0.34, India privacy/drug-price false merge 0.22. */
export const LATIN_ONE_NAME_THRESHOLD = 0.3;

export function clusterKey(seedUrl: string): string {
  return createHash('sha256').update(seedUrl).digest('hex').slice(0, 12);
}

/** Members compared per cluster (most recent ones) to bound cost on big days. */
const LINKAGE_SAMPLE = 8;

export function groupArticles(articles: Article[], threshold = GROUP_THRESHOLD): Cluster[] {
  const sorted = [...articles].sort((x, y) => (sourceTime(y) ?? '').localeCompare(sourceTime(x) ?? ''));
  const featLists = sorted.map((a) => [...new Set(features(text(a)))]);
  const idf = idfOf(featLists);
  const docs: Doc[] = featLists.map((fs, i) => {
    const latin = !/\p{Script=Hangul}/u.test(sorted[i].title);
    return { feats: new Set(fs), mass: fs.reduce((s, f) => s + (idf.get(f) ?? 1), 0), latin, proper: latin ? properNouns(sorted[i].title) : new Set<string>(), phrases: latin ? phrases(sorted[i].title) : new Set<string>() };
  });
  const groups: { lang: string; members: Doc[]; c: Cluster }[] = [];
  sorted.forEach((a, i) => {
    const d = docs[i];
    let best: (typeof groups)[number] | undefined;
    let bestScore = 0;
    for (const g of groups) {
      if (g.lang !== a.language) continue;
      // Average linkage: the article must resemble the cluster as a whole, not just one member.
      const sample = g.members.slice(-LINKAGE_SAMPLE);
      const det = sample.map((m) => overlapDetail(d, m, idf));
      if (Math.max(...det.map((x) => x.shared)) < MIN_SHARED_FEATURES) continue;
      const s = det.reduce((t, x) => t + x.score, 0) / det.length;
      if (d.latin) {
        // English: common words ("court", "risk", "call") link unrelated stories; require shared names.
        const props = Math.max(...sample.map((m) => [...d.proper].filter((w) => m.proper.has(w)).length));
        const phrase = sample.some((m) => [...d.phrases].some((p) => m.phrases.has(p)));
        if (props < 1 || (props < 2 && !phrase && s < LATIN_ONE_NAME_THRESHOLD)) continue;
      }
      if (s > bestScore) { bestScore = s; best = g; }
    }
    if (best && bestScore >= threshold) {
      best.c.articles.push(a);
      best.members.push(d);
    } else {
      groups.push({ lang: a.language, members: [d], c: { key: clusterKey(a.url), title: a.title, articles: [a], freshnessType: 'timely' } });
    }
  });
  return mergeByAnchor(groups.map((g) => g.c));
}

/** Common multi-syllable names that dominate many unrelated stories; never used as a merge anchor. */
const GENERIC_ANCHORS = new Set(['국민의힘', '더불어민주당', '민주당', '대통령실', '국정감사', '국회의원', '기획재정부', '서울시장',
  '서울시의회', '교육청', '경찰청', '검찰청', '대법원장', '헌법재판소', '정부서울청사', '지방자치단체', '프로농구', '프로야구', '프로축구']);
const PARTICLE = /(에서|으로|에게|까지|부터|처럼|보다|이라|이다|은|는|이|가|을|를|의|에|로|와|과|도|만)$/;

/** Hangul words of 4+ syllables (particles stripped), the usual shape of a specific place/event/organisation name. */
export function anchorWords(title: string): Set<string> {
  const out = new Set<string>();
  const clean = title.normalize('NFKC').replace(/\[[^\]]{0,12}\]|\([^)]{0,12}\)/g, ' ');
  for (const m of clean.matchAll(/\p{Script=Hangul}{4,}/gu)) {
    let w = m[0];
    if (w.length >= 5) w = w.replace(PARTICLE, '');
    if (w.length >= 4 && !GENERIC_ANCHORS.has(w)) out.add(w);
  }
  return out;
}

/** The anchor present in at least `share` of a cluster's headlines, if any (most frequent wins). */
export function dominantAnchor(c: Cluster, share = 0.6): string | null {
  const counts = new Map<string, number>();
  for (const a of c.articles) for (const w of anchorWords(a.title)) counts.set(w, (counts.get(w) ?? 0) + 1);
  const best = [...counts].sort((x, y) => y[1] - x[1] || y[0].length - x[0].length)[0];
  return best && best[1] >= Math.max(1, share * c.articles.length) ? best[0] : null;
}

/** Max gap between two clusters' newest items for an anchor merge (hours). */
const ANCHOR_MERGE_HOURS = 24;

/**
 * Second pass for Korean: clusters that are dominated by the same specific
 * name (e.g. several angles on the "구룡마을" fire) are merged. Then a lone
 * headline that names the anchor of an established cluster (3+ articles,
 * within 24 hours) joins it, e.g. the mayor visiting the fire site.
 */
export function mergeByAnchor(clusters: Cluster[]): Cluster[] {
  const newest = (c: Cluster) => c.articles.map(sourceTime).filter((t): t is string => !!t).sort().at(-1) ?? null;
  const close = (a: Cluster, b: Cluster) => {
    const x = newest(a), y = newest(b);
    return !!(x && y && Math.abs(Date.parse(x) - Date.parse(y)) <= ANCHOR_MERGE_HOURS * 3_600_000);
  };
  const out: Cluster[] = [];
  const byAnchor = new Map<string, Cluster>();
  const singles: Cluster[] = [];
  for (const c of clusters) {
    const ko = c.articles[0]?.language === 'ko';
    if (ko && c.articles.length === 1) { singles.push(c); continue; }
    const anchor = ko ? dominantAnchor(c) : null;
    const target = anchor ? byAnchor.get(anchor) : undefined;
    if (target && close(target, c)) { target.articles.push(...c.articles); continue; }
    out.push(c);
    if (anchor && !byAnchor.has(anchor)) byAnchor.set(anchor, c);
  }
  for (const c of singles) {
    const target = [...anchorWords(c.title)].map((w) => byAnchor.get(w)).find((t) => t && t.articles.length >= 3 && close(t, c));
    if (target) target.articles.push(...c.articles);
    else out.push(c);
  }
  return out;
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
