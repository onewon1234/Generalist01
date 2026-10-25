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

/** Publisher identity: "AP via Fortune" → "ap", case/space-insensitive. */
export function publisherKey(p: string): string {
  return p.toLowerCase().split(/\s+via\s+/)[0].replace(/[^\p{L}\p{N}]+/gu, '');
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
