import type { Article, Cluster, Scores } from '../src/types.ts';

export const NOW = new Date('2026-10-26T06:00:00+09:00');

/** ISO timestamp `h` hours before NOW. */
export function hoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 3_600_000).toISOString();
}

let n = 0;
export function article(p: Partial<Article> = {}): Article {
  n++;
  return {
    url: `https://example${n}.org/story-${n}`,
    title: `Story ${n}`,
    publisher: `Publisher ${n}`,
    language: 'en',
    reliabilityTier: 2,
    publishedAt: hoursAgo(6),
    retrievedAt: NOW.toISOString(),
    excerpt: 'x'.repeat(200),
    ...p,
  };
}

export function scores(p: Partial<Scores> = {}): Scores {
  return {
    significance: 7, timeliness: 7, interest: 7, insight: 7, novelty: 7, accessibility: 7,
    reliable: true, isMajor: false, elementary: false, contemporaryHook: false, aiPrimary: false,
    whyNow: 'new data published this week', angle: 'what changed', category: 'world-politics-society',
    subtopic: null, functions: ['must_know'],
    ...p,
  };
}

/** A timely cluster with two independent sources by default. */
export function cluster(key: string, s: Partial<Scores> = {}, p: Partial<Cluster> = {}): Cluster {
  return {
    key,
    title: `Cluster ${key} about a distinct event ${key}`,
    freshnessType: 'timely',
    articles: [article(), article()],
    scores: scores(s),
    ...p,
  };
}

export function evergreen(key: string, s: Partial<Scores> = {}, p: Partial<Cluster> = {}): Cluster {
  return cluster(key, { timeliness: 3, functions: ['something_new'], contemporaryHook: true, ...s },
    { freshnessType: 'evergreen', articles: [article({ publishedAt: hoursAgo(24 * 200) })], ...p });
}

export const EMPTY_COVERAGE = { subject7d: new Map(), subject30d: new Map(), subtopic7d: new Map() };
