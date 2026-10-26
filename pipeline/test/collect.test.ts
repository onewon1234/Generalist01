/**
 * Collector tests. Feed samples below are hand-written in the standard RSS 2.0,
 * Atom 1.0 and RSS 1.0 (RDF) formats: they test parsing, not real feeds. Real
 * feeds are verified by the check-sources workflow.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collect } from '../src/collect/collect.ts';
import { parseDate, parseFeed } from '../src/collect/feed.ts';
import { clip, htmlToText } from '../src/collect/html.ts';
import type { FetchResult, Fetcher } from '../src/collect/http.ts';
import { hostOf, naverUrl, parseNaver, searchNaver } from '../src/collect/naver.ts';
import { loadRegistry, type SourceConfig } from '../src/collect/registry.ts';

const SRC = { key: 'x', name: 'Example Times', language: 'en', reliabilityTier: 1 as const };
const NOW = '2026-10-26T00:00:00.000Z';

const RSS2 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel><title>Example &amp; Co</title>
<item><title><![CDATA[Parliament votes on <em>budget</em>]]></title><link>https://ex.org/a?utm_source=rss</link>
<pubDate>Sun, 25 Oct 2026 21:10:00 GMT</pubDate><description><![CDATA[<p>Lawmakers voted 151&ndash;140 on Sunday.</p>]]></description></item>
<item><title>Seoul announces plan</title><link>https://ex.org/b</link><pubDate>Mon, 26 Oct 2026 08:00:00 +0900</pubDate></item>
<item><title>No link here</title></item>
<item><title>Undated</title><link>https://ex.org/c</link></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title type="text">Atom Example</title>
<entry><title>Researchers map a fungal network</title>
<link rel="alternate" type="text/html" href="https://atom.example/fungi"/><link rel="enclosure" href="https://atom.example/img.jpg"/>
<published>2026-10-25T10:00:00Z</published><updated>2026-10-25T12:30:00Z</updated>
<summary type="html">&lt;p&gt;A &lt;b&gt;new&lt;/b&gt; map.&lt;/p&gt;</summary></entry>
</feed>`;

const RDF = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel><title>RDF Example</title></channel>
<item><title>Old-style item</title><link>https://rdf.example/1</link><dc:date>2026-10-24T09:00:00+09:00</dc:date></item>
</rdf:RDF>`;

test('html helpers strip tags, decode entities and clip at a word boundary', () => {
  assert.equal(htmlToText('<p>A&nbsp;&amp;&#x20;B &lt;b&gt;C&lt;/b&gt;</p>'), 'A & B C');
  assert.equal(htmlToText('&quot;quoted&quot; &#8212; dash'), '"quoted" — dash');
  const c = clip('word '.repeat(300), 100);
  assert.ok(c.length <= 100 && c.endsWith('…'));
});

test('dates: RFC 822, ISO 8601, KST suffix, garbage', () => {
  assert.equal(parseDate('Sun, 25 Oct 2026 21:10:00 GMT'), '2026-10-25T21:10:00.000Z');
  assert.equal(parseDate('Mon, 26 Oct 2026 08:00:00 +0900'), '2026-10-25T23:00:00.000Z');
  assert.equal(parseDate('2026-10-26 08:00:00 KST'), '2026-10-25T23:00:00.000Z');
  assert.equal(parseDate('not a date'), null);
  assert.equal(parseDate(undefined), null);
});

test('RSS 2.0: CDATA titles, entities, dates; items without links are skipped', () => {
  const f = parseFeed(RSS2, SRC, NOW);
  assert.equal(f.format, 'rss2');
  assert.equal(f.title, 'Example & Co');
  assert.equal(f.articles.length, 3);
  const [a, b, c] = f.articles;
  assert.equal(a.title, 'Parliament votes on budget');
  assert.equal(a.excerpt, 'Lawmakers voted 151–140 on Sunday.');
  assert.equal(a.publishedAt, '2026-10-25T21:10:00.000Z');
  assert.equal(a.publisher, 'Example Times');
  assert.equal(a.reliabilityTier, 1);
  assert.equal(a.retrievedAt, NOW);
  assert.equal(b.publishedAt, '2026-10-25T23:00:00.000Z');
  assert.equal(c.publishedAt, null, 'undated items are kept but carry no date');
  assert.deepEqual(f.undatedHint, { fields: ['title', 'link'], raw: null });
  assert.deepEqual(f.skipped, [{ reason: 'no link', title: 'No link here' }]);
});

test('Atom: alternate link, published vs updated, HTML summary', () => {
  const f = parseFeed(ATOM, SRC, NOW);
  assert.equal(f.format, 'atom');
  const [a] = f.articles;
  assert.equal(a.url, 'https://atom.example/fungi');
  assert.equal(a.publishedAt, '2026-10-25T10:00:00.000Z');
  assert.equal(a.updatedAt, '2026-10-25T12:30:00.000Z');
  assert.equal(a.excerpt, 'A new map.');
});

test('RSS 1.0 (RDF) with dc:date', () => {
  const f = parseFeed(RDF, SRC, NOW);
  assert.equal(f.format, 'rdf');
  assert.equal(f.articles[0].publishedAt, '2026-10-24T00:00:00.000Z');
});

test('non-feed content yields format unknown', () => {
  assert.equal(parseFeed('<html><body>hi</body></html>', SRC, NOW).format, 'unknown');
});

test('NAVER: request URL, response parsing, missing credentials', async () => {
  const u = new URL(naverUrl('반도체 수출', { display: 500 }));
  assert.equal(u.origin + u.pathname, 'https://naverapihub.apigw.ntruss.com/search/v1/news');
  assert.equal(u.searchParams.get('query'), '반도체 수출');
  assert.equal(u.searchParams.get('display'), '100', 'clamped');
  assert.equal(u.searchParams.get('sort'), 'date');

  const arts = parseNaver({ items: [
    { title: '<b>반도체</b> 수출 &quot;역대 최대&quot;', originallink: 'https://www.yna.co.kr/view/AKR1', link: 'https://n.news.naver.com/x', description: '산업통상자원부가 <b>26일</b> 발표했다.', pubDate: 'Mon, 26 Oct 2026 09:12:00 +0900' },
    { title: '', link: 'https://n.news.naver.com/y' },
  ] }, NOW);
  assert.equal(arts.length, 1);
  assert.equal(arts[0].title, '반도체 수출 "역대 최대"');
  assert.equal(arts[0].url, 'https://www.yna.co.kr/view/AKR1');
  assert.equal(arts[0].publisher, 'yna.co.kr');
  assert.equal(arts[0].publishedAt, '2026-10-26T00:12:00.000Z');
  assert.equal(hostOf('https://m.news.example.com/a'), 'news.example.com');

  let called = false;
  const r = await searchNaver(async () => { called = true; throw new Error('should not fetch'); }, 'q', new Date(NOW), {});
  assert.match(r.error!, /credentials not configured/);
  assert.equal(called, false);
});

test('collect isolates failing sources and de-duplicates by URL', async () => {
  const sources: SourceConfig[] = [
    { key: 'a', name: 'A', kind: 'rss', url: 'https://a.example/feed', language: 'en', region: 'GB', subject: 'world-politics-society', reliabilityTier: 1, active: true },
    { key: 'b', name: 'B', kind: 'rss', url: 'https://b.example/feed', language: 'en', region: 'US', subject: 'science-technology-ai', reliabilityTier: 2, active: true },
    { key: 'c', name: 'C', kind: 'rss', url: 'https://c.example/down', language: 'en', region: 'US', subject: 'science-technology-ai', reliabilityTier: 2, active: true },
    { key: 'd', name: 'D', kind: 'rss', url: 'https://d.example/page', language: 'en', region: 'US', subject: 'science-technology-ai', reliabilityTier: 2, active: true },
  ];
  const ok = (body: string): FetchResult => ({ ok: true, status: 200, finalUrl: '', contentType: 'application/xml', body, ms: 5 });
  const fetcher: Fetcher = async (url) => {
    if (url.includes('a.example')) return ok(RSS2);
    if (url.includes('b.example')) return ok(RSS2.replace('https://ex.org/b', 'https://ex.org/b2'));
    if (url.includes('c.example')) return { ok: false, status: 503, finalUrl: url, contentType: '', body: '', ms: 5 };
    return ok('<html>not a feed</html>');
  };
  const res = await collect(sources, fetcher, new Date(NOW));
  const h = Object.fromEntries(res.health.map((x) => [x.key, x]));
  assert.equal(h.a.ok, true);
  assert.equal(h.a.items, 3);
  assert.equal(h.a.dated, 2);
  assert.equal(h.a.newestAgeHours, 1, 'newest item 1h before NOW');
  assert.equal(h.c.ok, false);
  assert.equal(h.c.error, 'HTTP 503');
  assert.equal(h.d.error, 'not an RSS/Atom feed');
  // a and b share two URLs (one differing only by utm_ param normalisation); b adds one new URL
  assert.equal(res.articles.length, 4);
});

test('the committed registry is valid', () => {
  const reg = loadRegistry();
  assert.ok(reg.length >= 12);
  assert.ok(reg.some((s) => s.kind === 'naver'));
  assert.ok(reg.every((s) => s.active === false), 'nothing is active until check-sources verifies it');
});
