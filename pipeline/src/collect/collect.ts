import { normalizeUrl, hoursBetween } from '../text.ts';
import type { Article } from '../types.ts';
import { parseFeed } from './feed.ts';
import type { Fetcher } from './http.ts';
import { searchNaver } from './naver.ts';
import type { SourceConfig } from './registry.ts';

export interface SourceHealth {
  key: string;
  kind: SourceConfig['kind'];
  url: string;
  ok: boolean;
  status: number;
  ms: number;
  format?: string;
  items: number;
  dated: number;
  newestAgeHours: number | null;
  error?: string;
  /** Present when some items had no parseable date: field names and raw value of the first one. */
  undatedHint?: string;
}

export interface Collection {
  collectedAt: string;
  articles: Article[];
  health: SourceHealth[];
}

/** Korean discovery queries for NAVER (broad, news-led; refined later by the editor stage). */
export const NAVER_QUERIES = ['속보', '정부 발표', '연구 결과', '경제', '국제'];

function health(src: SourceConfig, articles: Article[], now: Date, base: Partial<SourceHealth>): SourceHealth {
  const dated = articles.filter((a) => a.publishedAt);
  const newest = dated.map((a) => a.publishedAt!).sort().at(-1);
  return {
    key: src.key, kind: src.kind, url: src.url, ok: false, status: 0, ms: 0, items: articles.length,
    dated: dated.length, newestAgeHours: newest ? Math.round(hoursBetween(newest, now) * 10) / 10 : null, ...base,
  };
}

/**
 * Fetch every given source. Failures are recorded per source and never abort the run.
 * Articles are de-duplicated by normalised URL (first occurrence wins).
 */
export async function collect(sources: SourceConfig[], fetcher: Fetcher, now = new Date(), env = process.env): Promise<Collection> {
  const collectedAt = now.toISOString();
  const results = await Promise.all(sources.map(async (src): Promise<{ arts: Article[]; h: SourceHealth }> => {
    if (src.kind === 'naver') {
      const all: Article[] = [];
      let error: string | undefined;
      const t0 = Date.now();
      for (const q of NAVER_QUERIES) {
        const r = await searchNaver(fetcher, q, now, env);
        if (r.error) { error = r.error; break; }
        all.push(...r.articles);
      }
      return { arts: all, h: health(src, all, now, { ok: !error, ms: Date.now() - t0, error, status: error ? 0 : 200 }) };
    }
    const r = await fetcher(src.url, { timeoutMs: 20_000 });
    if (!r.ok) return { arts: [], h: health(src, [], now, { ok: false, status: r.status, ms: r.ms, error: r.error ?? `HTTP ${r.status}` }) };
    try {
      const feed = parseFeed(r.body, src, collectedAt);
      const ok = feed.format !== 'unknown' && feed.articles.length > 0;
      const undatedHint = feed.undatedHint ? `fields=${feed.undatedHint.fields.join(',')} raw=${JSON.stringify(feed.undatedHint.raw)}` : undefined;
      return { arts: feed.articles, h: health(src, feed.articles, now, { ok, status: r.status, ms: r.ms, format: feed.format, undatedHint, error: ok ? undefined : feed.format === 'unknown' ? 'not an RSS/Atom feed' : 'feed has no usable items' }) };
    } catch (e) {
      return { arts: [], h: health(src, [], now, { ok: false, status: r.status, ms: r.ms, error: `parse error: ${(e as Error).message}` }) };
    }
  }));
  const seen = new Set<string>();
  const articles: Article[] = [];
  for (const { arts } of results) for (const a of arts) {
    const k = normalizeUrl(a.url);
    if (seen.has(k)) continue;
    seen.add(k);
    articles.push(a);
  }
  return { collectedAt, articles, health: results.map((r) => r.h) };
}
