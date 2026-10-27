import { sourceTime } from './freshness.ts';
import { hoursBetween, normalizeUrl, similarity } from './text.ts';
import type { Article, Cluster } from './types.ts';

/** A previously published story, used for de-duplication. */
export interface PublishedRef {
  issueDate: string;
  title: string;
  topicKey?: string | null;
  urls: string[];
}

/** Title similarity above which two items are treated as the same story. */
export const SAME_STORY_SIMILARITY = 0.5;
/** A matching cluster counts as a new development if its newest source is this many hours after the earlier issue. */
export const NEW_DEVELOPMENT_HOURS = 24;

/**
 * Outlet names by web host, so one outlet is one publisher whether an item came
 * from its RSS feed ("연합뉴스", "BBC News – World") or from an aggregator or
 * API that only gives the host ("yna.co.kr", "bbc.co.uk"). Registry homepages
 * are added by registerOutletHosts().
 */
const OUTLET_BY_HOST = new Map<string, string>(Object.entries({
  'yna.co.kr': '연합뉴스', 'yonhapnewstv.co.kr': '연합뉴스TV', 'hani.co.kr': '한겨레', 'khan.co.kr': '경향신문',
  'chosun.com': '조선일보', 'joongang.co.kr': '중앙일보', 'donga.com': '동아일보', 'kbs.co.kr': 'KBS', 'imbc.com': 'MBC',
  'sbs.co.kr': 'SBS', 'newsis.com': '뉴시스', 'news1.kr': '뉴스1',
  'bbc.co.uk': 'BBC News', 'bbc.com': 'BBC News', 'theguardian.com': 'The Guardian', 'reuters.com': 'Reuters', 'apnews.com': 'AP',
}));

export function hostKey(urlOrHost: string): string {
  let h = urlOrHost;
  try { if (/^https?:/i.test(h)) h = new URL(h).hostname; } catch { /* keep as given */ }
  return h.toLowerCase().replace(/^(www|m|news|n|mobile)\./, '');
}

/** Map each registry homepage host to the outlet name (feed section suffix removed). */
export function registerOutletHosts(sources: { name: string; homepage?: string }[]): void {
  for (const s of sources) if (s.homepage) {
    const h = hostKey(s.homepage);
    if (!OUTLET_BY_HOST.has(h)) OUTLET_BY_HOST.set(h, outletName(s.name));
  }
}

/**
 * Canonical outlet name: "AP via Fortune" → "AP", "BBC News – Business" →
 * "BBC News", "yna.co.kr" → "연합뉴스".
 */
export function outletName(p: string): string {
  const base = p.split(/\s+via\s+/i)[0].trim();
  const byHost = OUTLET_BY_HOST.get(hostKey(base));
  if (byHost) return byHost;
  return base.split(/\s+[–—-]\s+/)[0].trim();
}

/** Publisher identity for counting independent sources: canonical outlet, case/space-insensitive. */
export function publisherKey(p: string): string {
  return outletName(p).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

export function independentPublishers(c: Cluster): number {
  return new Set(c.articles.map((a) => publisherKey(a.publisher))).size;
}

/**
 * Primary article: most reliable tier first, then the richest excerpt, then the newest.
 * Sets and returns `c.primary`.
 */
export function choosePrimary(c: Cluster): Article | undefined {
  const ranked = [...c.articles].sort((a, b) =>
    (a.reliabilityTier ?? 2) - (b.reliabilityTier ?? 2) ||
    (b.excerpt?.length ?? 0) - (a.excerpt?.length ?? 0) ||
    (sourceTime(b) ?? '').localeCompare(sourceTime(a) ?? ''));
  c.primary = ranked[0];
  return c.primary;
}

export interface RepeatResult {
  /** Already covered and nothing meaningfully new. */
  repeat: boolean;
  /** Matches an earlier story but has a newer development. */
  newDevelopment: boolean;
  match?: PublishedRef;
}

function matches(c: Cluster, p: PublishedRef): boolean {
  if (c.topicKey && p.topicKey && c.topicKey === p.topicKey) return true;
  const urls = new Set(p.urls.map(normalizeUrl));
  if (c.articles.some((a) => urls.has(normalizeUrl(a.url)))) return true;
  return similarity(c.title, p.title) >= SAME_STORY_SIMILARITY;
}

/** Compare a cluster against recently published stories (normally the last 30 days). */
export function checkRepeat(c: Cluster, recent: PublishedRef[]): RepeatResult {
  const match = recent
    .filter((p) => matches(c, p))
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate))[0];
  if (!match) return { repeat: false, newDevelopment: false };
  const newest = c.articles.map(sourceTime).filter((t): t is string => !!t).sort().at(-1);
  const newer = !!newest && hoursBetween(`${match.issueDate}T00:00:00+09:00`, newest) >= NEW_DEVELOPMENT_HOURS;
  // A story whose sources are all already-published URLs is not new, however recent.
  const knownUrls = new Set(match.urls.map(normalizeUrl));
  const freshSource = c.articles.some((a) => !knownUrls.has(normalizeUrl(a.url)));
  const newDevelopment = newer && freshSource;
  return { repeat: !newDevelopment, newDevelopment, match };
}
