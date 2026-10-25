/**
 * NAVER API HUB News Search. Credential-dependent: needs NAVER_API_KEY_ID and
 * NAVER_API_KEY (repository secrets). Returns metadata only: title, links,
 * a short description and the publication date.
 */
import type { Article } from '../types.ts';
import { parseDate } from './feed.ts';
import { clip, htmlToText } from './html.ts';
import type { Fetcher } from './http.ts';

export const NAVER_NEWS_ENDPOINT = 'https://naverapihub.apigw.ntruss.com/search/v1/news';

export interface NaverItem { title: string; originallink?: string; link: string; description?: string; pubDate?: string }
export interface NaverResponse { lastBuildDate?: string; total?: number; start?: number; display?: number; items?: NaverItem[] }

export function naverUrl(query: string, opts: { display?: number; start?: number; sort?: 'date' | 'sim' } = {}): string {
  const u = new URL(NAVER_NEWS_ENDPOINT);
  u.searchParams.set('query', query);
  u.searchParams.set('display', String(Math.min(100, Math.max(1, opts.display ?? 50))));
  u.searchParams.set('start', String(opts.start ?? 1));
  u.searchParams.set('sort', opts.sort ?? 'date');
  return u.toString();
}

export function naverHeaders(env: NodeJS.ProcessEnv = process.env): Record<string, string> | null {
  const id = env.NAVER_API_KEY_ID, key = env.NAVER_API_KEY;
  if (!id || !key) return null;
  return { 'X-NCP-APIGW-API-KEY-ID': id, 'X-NCP-APIGW-API-KEY': key };
}

/** Publisher label from the original article host (e.g. "yna.co.kr"). */
export function hostOf(u: string): string {
  try { return new URL(u).hostname.replace(/^(www|m|news|n)\./, ''); } catch { return 'unknown'; }
}

export function parseNaver(json: NaverResponse, retrievedAt: string): Article[] {
  return (json.items ?? []).flatMap((it) => {
    const url = it.originallink || it.link;
    const title = htmlToText(it.title);
    if (!url || !title) return [];
    const description = htmlToText(it.description);
    return [{
      url,
      title,
      publisher: hostOf(url),
      language: 'ko',
      sourceKey: 'naver-news',
      reliabilityTier: 2 as const,
      publishedAt: parseDate(it.pubDate),
      updatedAt: null,
      eventDate: null,
      retrievedAt,
      excerpt: description ? clip(description, 1000) : null,
    }];
  });
}

export async function searchNaver(fetcher: Fetcher, query: string, now = new Date(), env = process.env): Promise<{ articles: Article[]; error?: string }> {
  const headers = naverHeaders(env);
  if (!headers) return { articles: [], error: 'credentials not configured (NAVER_API_KEY_ID / NAVER_API_KEY)' };
  const r = await fetcher(naverUrl(query), { headers, timeoutMs: 15_000 });
  if (!r.ok) return { articles: [], error: `HTTP ${r.status}${r.error ? `: ${r.error}` : ''}` };
  try {
    return { articles: parseNaver(JSON.parse(r.body) as NaverResponse, now.toISOString()) };
  } catch (e) {
    return { articles: [], error: `invalid JSON: ${(e as Error).message}` };
  }
}
