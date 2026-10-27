/**
 * NAVER API HUB News Search. Credential-dependent: needs NAVER_CLIENT_ID and
 * NAVER_CLIENT_SECRET (repository secrets). Returns metadata only: title, links,
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

/** Environment variable names (GitHub Actions secrets of the same name). */
export const NAVER_ENV = { id: 'NAVER_CLIENT_ID', secret: 'NAVER_CLIENT_SECRET' } as const;

/**
 * NAVER API HUB authentication: the Client ID goes in X-NCP-APIGW-API-KEY-ID and
 * the Client Secret in X-NCP-APIGW-API-KEY. Credentials issued by the old NAVER
 * Developers Center (X-Naver-Client-Id / -Secret) are not accepted by API HUB.
 */
export function naverHeaders(env: NodeJS.ProcessEnv = process.env): Record<string, string> | null {
  const id = env[NAVER_ENV.id]?.trim(), secret = env[NAVER_ENV.secret]?.trim();
  if (!id || !secret) return null;
  return { 'X-NCP-APIGW-API-KEY-ID': id, 'X-NCP-APIGW-API-KEY': secret };
}

/** Short, credential-free description of a failed API HUB response. */
export function describeNaverError(status: number, body: string, netError?: string): string {
  if (status === 0) return `network error${netError ? `: ${netError}` : ''}`;
  let detail = '';
  try {
    const j = JSON.parse(body) as Record<string, any>;
    const e = j.error ?? j;
    const code = e.errorCode ?? e.code ?? '';
    const msg = e.message ?? e.errorMessage ?? '';
    detail = [code, msg].filter(Boolean).join(' ').slice(0, 160);
  } catch { /* non-JSON body: omit */ }
  const hint = status === 401 || status === 403
    ? ' — authentication rejected: check that the Client ID/Secret were issued in NAVER API HUB (NAVER Cloud console), not the old NAVER Developers Center, and that News Search is subscribed'
    : status === 429 ? ' — rate limited' : '';
  return `HTTP ${status}${detail ? ` (${detail})` : ''}${hint}`;
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
  if (!headers) return { articles: [], error: `credentials not configured (${NAVER_ENV.id} / ${NAVER_ENV.secret})` };
  const r = await fetcher(naverUrl(query), { headers, timeoutMs: 15_000 });
  if (!r.ok) return { articles: [], error: describeNaverError(r.status, r.body, r.error) };
  try {
    return { articles: parseNaver(JSON.parse(r.body) as NaverResponse, now.toISOString()) };
  } catch (e) {
    return { articles: [], error: `invalid JSON: ${(e as Error).message}` };
  }
}
