/**
 * Page extraction: metadata, access signals and the article's paragraphs.
 * The paragraphs are used transiently (evidence extraction) and never stored.
 */
import { parse, type HTMLElement } from 'node-html-parser';
import { parseDate } from '../collect/feed.ts';
import { htmlToText } from '../collect/html.ts';

export interface PageExtract {
  title: string | null;
  canonical: string | null;
  lang: string | null;
  siteName: string | null;
  author: string | null;
  publishedAt: string | null;
  modifiedAt: string | null;
  /** JSON-LD isAccessibleForFree === false (paywalled or metered). */
  paywalled: boolean;
  /** Publisher opt-outs found on the page: 'noai', 'tdm-reservation'. */
  restrictions: string[];
  paragraphs: string[];
  textChars: number;
}

const CONTAINERS = [
  '[itemprop=articleBody]', '#dic_area', '#articleBodyContents', '#article-view-content-div', '#articleBody',
  '.article_body', '.article-body', '.news_body', '#newsct_article', '.story-body', '.article__body',
  '[data-component=text-block]', 'article', 'main',
];

const BOILERPLATE = [
  /무단\s*전재|재배포\s*금지|저작권자|ⓒ|©|copyright/i,
  /^[\p{Script=Hangul}\s]{2,10}\s*기자\s*=?\s*$/u,
  /[\w.+-]+@[\w-]+\.[\w.]+/,
  /^(사진|그래픽|자료)\s*[=:]/,
  /^(sign up|subscribe|newsletter|advertisement|read more|related:|follow us)/i,
];

function meta(root: HTMLElement, ...keys: string[]): string | null {
  for (const k of keys) {
    const el = root.querySelector(`meta[property="${k}"]`) ?? root.querySelector(`meta[name="${k}"]`) ?? root.querySelector(`meta[itemprop="${k}"]`);
    const v = el?.getAttribute('content')?.trim();
    if (v) return v;
  }
  return null;
}

function jsonLd(root: HTMLElement): Record<string, any>[] {
  const out: Record<string, any>[] = [];
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(s.text);
      const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
      for (const it of items) if (it && typeof it === 'object') out.push(it);
    } catch { /* malformed JSON-LD is common; ignore */ }
  }
  return out;
}

function isFalse(v: unknown): boolean {
  return v === false || (typeof v === 'string' && v.trim().toLowerCase() === 'false');
}

/** Korean wire-style dateline/byline at the start of a paragraph: "(서울=연합뉴스) 홍길동 기자 =". */
const DATELINE = /^\([^)]{2,24}=[^)]{1,24}\)\s*(?:[\p{Script=Hangul}]{2,4}\s*(?:특파원|기자)\s*=\s*)?/u;

function clean(s: string): string {
  return htmlToText(s).replace(/\s+/g, ' ').trim().replace(DATELINE, '').trim();
}

function paragraphsOf(root: HTMLElement): string[] {
  for (const sel of CONTAINERS) {
    const el = root.querySelector(sel);
    if (!el) continue;
    for (const junk of el.querySelectorAll('script, style, figure, figcaption, aside, nav, footer, form, button, .ad, .advert, [aria-hidden=true]')) junk.remove();
    let paras = el.querySelectorAll('p').map((p) => clean(p.innerHTML));
    // Many Korean sites separate paragraphs with <br> inside one container.
    if (paras.filter((p) => p.length >= 40).length < 2) {
      paras = el.innerHTML.split(/<br\s*\/?>\s*(?:<br\s*\/?>)?|<\/p>|<\/div>/i).map(clean);
    }
    const kept = paras.filter((p) => p.length >= 30 && !BOILERPLATE.some((re) => re.test(p)));
    if (kept.join('').length >= 120) return dedupe(kept);
  }
  return [];
}

function dedupe(ps: string[]): string[] {
  const seen = new Set<string>();
  return ps.filter((p) => (seen.has(p) ? false : (seen.add(p), true)));
}

export function extractPage(html: string, headers: Record<string, string> = {}): PageExtract {
  const root = parse(html, { comment: false, blockTextElements: { script: true, style: true, noscript: false, pre: true } });
  const ld = jsonLd(root);
  const article = ld.find((x) => /Article|NewsArticle|BlogPosting|Report/i.test(String(x['@type'] ?? ''))) ?? ld[0] ?? {};
  const restrictions: string[] = [];
  const robotsMeta = [meta(root, 'robots'), headers['x-robots-tag']].filter(Boolean).join(',').toLowerCase();
  if (/\bnoai\b/.test(robotsMeta)) restrictions.push('noai');
  const tdm = meta(root, 'tdm-reservation') ?? headers['tdm-reservation'];
  if (tdm && tdm.trim() === '1') restrictions.push('tdm-reservation');
  const paywalled = isFalse(article.isAccessibleForFree) ||
    (Array.isArray(article.hasPart) ? article.hasPart : [article.hasPart]).some((p: any) => p && isFalse(p.isAccessibleForFree));
  const author = article.author ? (Array.isArray(article.author) ? article.author : [article.author]).map((a: any) => a?.name ?? a).filter(Boolean).join(', ') : meta(root, 'author', 'article:author');
  const paragraphs = paragraphsOf(root);
  return {
    title: meta(root, 'og:title', 'twitter:title') ?? (root.querySelector('title')?.text.trim() || null),
    canonical: root.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? meta(root, 'og:url'),
    lang: root.querySelector('html')?.getAttribute('lang') ?? null,
    siteName: meta(root, 'og:site_name') ?? (article.publisher?.name ?? null),
    author: author || null,
    publishedAt: parseDate(meta(root, 'article:published_time', 'og:published_time', 'pubdate', 'datePublished') ?? article.datePublished),
    modifiedAt: parseDate(meta(root, 'article:modified_time', 'og:updated_time', 'dateModified') ?? article.dateModified),
    paywalled,
    restrictions,
    paragraphs,
    textChars: paragraphs.join(' ').length,
  };
}
