import { XMLParser } from 'fast-xml-parser';
import type { Article } from '../types.ts';
import { clip, htmlToText } from './html.ts';
import type { SourceConfig } from './registry.ts';

/** Feed-level result. Items carry metadata only (title, link, dates, publisher summary). */
export interface FeedResult {
  format: 'rss2' | 'atom' | 'rdf' | 'unknown';
  title: string;
  articles: Article[];
  /** Items skipped and why (no link, unparseable date, …). */
  skipped: { reason: string; title?: string }[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  removeNSPrefix: false,
  textNodeName: '#text',
  cdataPropName: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  isArray: (name) => ['item', 'entry', 'link', 'category'].includes(name),
});

function text(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === 'object') return text((v as Record<string, unknown>)['#text']);
  return '';
}

/** Parse RFC 822 / ISO 8601 dates; returns ISO or null. Rejects dates without a timezone only when ambiguous. */
export function parseDate(s: string | undefined | null): string | null {
  if (!s) return null;
  const t = s.trim().replace(/\s+(KST)$/i, ' +0900').replace(/\s+(GMT|UT|UTC|Z)$/i, ' +0000');
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

function atomLink(links: unknown): string {
  const arr = (Array.isArray(links) ? links : [links]) as Record<string, string>[];
  const alt = arr.find((l) => l && typeof l === 'object' && (!l['@rel'] || l['@rel'] === 'alternate') && l['@href']);
  if (alt) return alt['@href'];
  const any = arr.find((l) => l && typeof l === 'object' && l['@href']);
  return any ? any['@href'] : text(arr[0]);
}

export function parseFeed(xml: string, src: Pick<SourceConfig, 'key' | 'name' | 'language' | 'reliabilityTier'>, retrievedAt: string): FeedResult {
  const doc = parser.parse(xml) as Record<string, any>;
  const out: FeedResult = { format: 'unknown', title: '', articles: [], skipped: [] };
  let items: Record<string, any>[] = [];
  if (doc.rss?.channel) {
    out.format = 'rss2';
    const ch = Array.isArray(doc.rss.channel) ? doc.rss.channel[0] : doc.rss.channel;
    out.title = htmlToText(text(ch.title));
    items = ch.item ?? [];
  } else if (doc.feed) {
    out.format = 'atom';
    out.title = htmlToText(text(doc.feed.title));
    items = doc.feed.entry ?? [];
  } else if (doc['rdf:RDF']) {
    out.format = 'rdf';
    const r = doc['rdf:RDF'];
    out.title = htmlToText(text(r.channel?.title));
    items = r.item ?? [];
  } else {
    return out;
  }

  for (const it of items) {
    const title = htmlToText(text(it.title));
    const link = out.format === 'atom' ? atomLink(it.link) : text(it.link) || (typeof it.guid === 'object' && it.guid['@isPermaLink'] !== 'false' ? text(it.guid) : '');
    if (!title) { out.skipped.push({ reason: 'no title' }); continue; }
    if (!/^https?:\/\//.test(link)) { out.skipped.push({ reason: 'no link', title }); continue; }
    const published = parseDate(text(it.pubDate ?? it.published ?? it['dc:date'] ?? it.updated));
    const updated = out.format === 'atom' ? parseDate(text(it.updated)) : null;
    const summary = htmlToText(text(it.description ?? it.summary ?? it['content:encoded'] ?? it.content));
    out.articles.push({
      url: link.trim(),
      title,
      publisher: src.name,
      language: src.language,
      sourceKey: src.key,
      reliabilityTier: src.reliabilityTier,
      publishedAt: published,
      updatedAt: updated && updated !== published ? updated : null,
      eventDate: null,
      retrievedAt,
      excerpt: summary ? clip(summary, 1000) : null,
    });
  }
  return out;
}
