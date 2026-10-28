/**
 * Original-article retrieval with an explicit, recorded access status.
 *
 * Only status 'read' means the article text was obtained and used. Every
 * other status means the article was NOT read and must not count as
 * independent verification. Full text is used in memory for evidence
 * extraction and then discarded; records keep metadata, a hash of the text,
 * and short evidence snippets only.
 */
import { createHash } from 'node:crypto';
import type { Fetcher } from '../collect/http.ts';
import type { Article } from '../types.ts';
import { extractEvidence, type Evidence } from './evidence.ts';
import { extractPage } from './extract.ts';
import { RobotsCache, type RobotsState } from './robots.ts';

export type RetrievalStatus =
  | 'read'               // substantive article text obtained and used
  | 'partial'            // page fetched but too little article text found
  | 'paywalled'          // publisher marks content as not free
  | 'restricted'         // publisher opt-out (noai / TDM reservation): text not used
  | 'blocked-robots'     // robots.txt disallows our agent
  | 'robots-unreachable' // robots.txt could not be fetched (5xx/network): treated as disallowed
  | 'http-error'
  | 'network-error'
  | 'not-html';

export interface RetrievalRecord {
  url: string;
  finalUrl: string | null;
  publisher: string;
  sourceKey: string | null;
  feedPublishedAt: string | null;
  retrievedAt: string;
  status: RetrievalStatus;
  httpStatus: number | null;
  robots: RobotsState;
  restrictions: string[];
  title: string | null;
  pagePublishedAt: string | null;
  pageModifiedAt: string | null;
  author: string | null;
  textChars: number;
  textSha256: string | null;
  evidence: Evidence[];
  /**
   * Opening of the permitted article text, at most EXCERPT_CHARS characters
   * (the storage limit for source text). Only for status 'read'.
   */
  excerpt?: string;
  note?: string;
}

export const EXCERPT_CHARS = 1000;
export function excerptOf(paragraphs: string[], max = EXCERPT_CHARS): string {
  let out = '';
  for (const p of paragraphs) {
    const next = out ? `${out}\n${p}` : p;
    if ([...next].length > max) { if (!out) out = [...p].slice(0, max - 1).join('') + '…'; break; }
    out = next;
  }
  return out;
}

/** Minimum article text for 'read' (Korean text is denser than English). */
export const MIN_READ_CHARS = { ko: 300, other: 800 } as const;

export interface RetrieveDeps { fetcher: Fetcher; robots: RobotsCache; now?: () => Date }

export async function retrieveArticle(a: Article, deps: RetrieveDeps): Promise<RetrievalRecord> {
  return (await readArticle(a, deps)).record;
}

/**
 * Same access rules as retrieveArticle, also returning the article paragraphs
 * when (and only when) the status is `read`. The paragraphs are for transient
 * use by the editor/writer stage; they are never stored or logged.
 */
export async function readArticle(a: Article, deps: RetrieveDeps): Promise<{ record: RetrievalRecord; paragraphs: string[]; description?: string | null; subheads?: string[] }> {
  let page: ReturnType<typeof extractPage> | undefined;
  const done = (record: RetrievalRecord, paragraphs: string[] = []) => ({ record, paragraphs, description: page?.description ?? null, subheads: record.status === 'read' ? page?.subheads ?? [] : [] });
  const retrievedAt = (deps.now?.() ?? new Date()).toISOString();
  const base: RetrievalRecord = {
    url: a.url, finalUrl: null, publisher: a.publisher, sourceKey: a.sourceKey ?? null, feedPublishedAt: a.publishedAt ?? null,
    retrievedAt, status: 'network-error', httpStatus: null, robots: 'unreachable', restrictions: [], title: null,
    pagePublishedAt: null, pageModifiedAt: null, author: null, textChars: 0, textSha256: null, evidence: [],
  };
  base.robots = await deps.robots.check(a.url);
  if (base.robots === 'disallowed') return done({ ...base, status: 'blocked-robots' });
  if (base.robots === 'unreachable') return done({ ...base, status: 'robots-unreachable' });

  const r = await deps.fetcher(a.url, { timeoutMs: 20_000, headers: { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' } });
  base.httpStatus = r.status || null;
  base.finalUrl = r.finalUrl || null;
  if (r.status === 0) return done({ ...base, status: 'network-error', note: r.error });
  if (!r.ok) return done({ ...base, status: r.status === 402 ? 'paywalled' : 'http-error' });
  if (!/html/i.test(r.contentType) && !/^\s*</.test(r.body)) return done({ ...base, status: 'not-html', note: r.contentType });

  // The fetch may have been redirected to another host: its robots.txt must allow us too.
  if (r.finalUrl && new URL(r.finalUrl).origin !== new URL(a.url).origin) {
    const after = await deps.robots.check(r.finalUrl);
    if (after === 'disallowed') return done({ ...base, robots: after, status: 'blocked-robots', note: 'redirect target disallowed' });
    if (after === 'unreachable') return done({ ...base, robots: after, status: 'robots-unreachable', note: 'redirect target robots unreachable' });
  }

  page = extractPage(r.body);
  const meta = {
    title: page.title, pagePublishedAt: page.publishedAt, pageModifiedAt: page.modifiedAt, author: page.author,
    restrictions: page.restrictions,
  };
  if (page.restrictions.length) return done({ ...base, ...meta, status: 'restricted', note: 'publisher opt-out; text not used' });
  if (page.paywalled) return done({ ...base, ...meta, status: 'paywalled', note: 'isAccessibleForFree=false' });
  const min = a.language === 'ko' ? MIN_READ_CHARS.ko : MIN_READ_CHARS.other;
  const text = page.paragraphs.join('\n');
  const hash = text ? createHash('sha256').update(text).digest('hex') : null;
  if (page.textChars < min) return done({ ...base, ...meta, textChars: page.textChars, textSha256: hash, status: 'partial', note: `only ${page.textChars} chars of article text found` });
  return done({ ...base, ...meta, textChars: page.textChars, textSha256: hash, status: 'read', evidence: extractEvidence(page.paragraphs), excerpt: excerptOf(page.paragraphs) }, page.paragraphs);
}

/** Sequential per host with a minimum gap, small global concurrency. */
export function politeFetcher(inner: Fetcher, minGapMs = 1500): Fetcher {
  const nextAt = new Map<string, number>();
  return async (url, init) => {
    let host = '';
    try { host = new URL(url).host; } catch { /* inner will fail */ }
    const now = Date.now();
    const at = Math.max(now, nextAt.get(host) ?? 0);
    nextAt.set(host, at + minGapMs);
    if (at > now) await new Promise((res) => setTimeout(res, at - now));
    return inner(url, init);
  };
}
