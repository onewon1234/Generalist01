/**
 * Retrieval and evidence tests. HTML pages here are hand-written fixtures in
 * common publisher layouts; they test the logic, not any real site.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FetchResult, Fetcher } from '../src/collect/http.ts';
import { corroborate } from '../src/research/corroborate.ts';
import { extractEvidence, figuresIn, splitSentences } from '../src/research/evidence.ts';
import { extractPage } from '../src/research/extract.ts';
import { RobotsCache, isAllowed, parseRobots } from '../src/research/robots.ts';
import { readArticle, retrieveArticle, type RetrievalRecord } from '../src/research/retrieve.ts';
import { article } from './helpers.ts';

const res = (status: number, body: string, contentType = 'text/html; charset=utf-8', finalUrl = ''): FetchResult =>
  ({ ok: status >= 200 && status < 300, status, finalUrl, contentType, body, ms: 1 });

test('robots: specific group beats *, longest match wins, allow wins ties, wildcards', () => {
  const r = parseRobots(`
User-agent: *
Disallow: /private
Allow: /private/press
Disallow: /*.pdf$

User-agent: GPTBot
User-agent: GeneralistDailyBot
Disallow: /news/premium
`);
  // our named group applies, so "*" rules do not
  assert.equal(isAllowed(r, '/private/x'), true);
  assert.equal(isAllowed(r, '/news/premium/1'), false);
  assert.equal(isAllowed(r, '/news/free/1'), true);
  // for an unnamed agent, "*" applies
  assert.equal(isAllowed(r, '/private/x', 'otherbot'), false);
  assert.equal(isAllowed(r, '/private/press/1', 'otherbot'), true, 'longer allow wins');
  assert.equal(isAllowed(r, '/a/file.pdf', 'otherbot'), false);
  assert.equal(isAllowed(r, '/a/file.pdf?x', 'otherbot'), true, '$ anchors the end');
  assert.equal(isAllowed(parseRobots('User-agent: *\nDisallow:'), '/anything'), true, 'empty disallow allows all');
  assert.equal(isAllowed(parseRobots('User-agent: *\nDisallow: /'), '/anything'), false);
});

test('robots fetch: 404 → no restrictions; 5xx/network → treated as disallowed', async () => {
  const f: Fetcher = async (url) => url.includes('a.example') ? res(404, '') : url.includes('b.example') ? res(503, '') : res(0, '');
  const c = new RobotsCache(f);
  assert.equal(await c.check('https://a.example/x'), 'no-robots');
  assert.equal(await c.check('https://b.example/x'), 'unreachable');
  assert.equal(await c.check('https://c.example/x'), 'unreachable');
});

const KO_PAGE = `<!doctype html><html lang="ko"><head>
<meta property="og:title" content="구룡마을 화재로 77가구 107명 피해">
<meta property="article:published_time" content="2026-10-27T20:31:00+09:00">
<meta property="og:site_name" content="예시일보">
</head><body><nav>메뉴</nav><div id="dic_area">
(서울=예시일보) 홍길동 기자 = 27일 오후 서울 강남구 구룡마을에서 불이 나 77가구 107명의 이재민이 발생했다.<br><br>
소방당국은 "용수가 부족해 진압에 어려움을 겪고 있다"고 말했다. 강풍을 타고 불길이 7지구 쪽으로 번졌다.<br><br>
서울시는 인근 비상대피소에 임시 거처를 마련했다고 밝혔다. 정확한 화재 원인은 조사 중이다.<br><br>
구룡마을은 1980년대 형성된 무허가 판자촌으로, 비닐과 합판 등 불에 잘 타는 자재로 지은 집이 밀집해 있어 화재에 취약하다는 지적이 꾸준히 나왔다.<br><br>
이 마을에서는 지난 2023년 1월에도 큰불이 나 주택 60여 채가 탔다. 재개발 사업은 수년째 보상 문제로 지연되고 있다.<br><br>
저작권자(c) 예시일보, 무단 전재 및 재배포 금지<br>
hong@example.co.kr
</div></body></html>`;

test('extract: Korean <br> layout, metadata, boilerplate removed', () => {
  const p = extractPage(KO_PAGE);
  assert.equal(p.title, '구룡마을 화재로 77가구 107명 피해');
  assert.equal(p.publishedAt, '2026-10-27T11:31:00.000Z');
  assert.equal(p.siteName, '예시일보');
  assert.equal(p.paragraphs.length, 5);
  assert.match(p.paragraphs[0], /^27일 오후/, 'dateline/byline stripped');
  assert.ok(!p.paragraphs.some((x) => /무단|@/.test(x)));
  assert.equal(p.paywalled, false);
  assert.deepEqual(p.restrictions, []);
});

test('extract: the richest container wins over a summary box in an earlier <article>', () => {
  // Layout modelled on a Korean wire site: an AI summary box in its own <article> before the body.
  const html = `<html><body><div class="tlp-content"><article class="story-summary"><p>요약 첫 줄은 짧은 요약문이다</p><p>요약 둘째 줄도 짧은 요약문이다</p></article></div>
  <article id="articleWrap"><div class="story-news article"><div class="writer-zone01"><strong>홍길동 기자</strong></div>
  <p>본문 첫 문단은 사건의 핵심을 길게 설명하는 문장으로 시작한다. 정부는 27일 새 대책을 발표했다고 밝혔다.</p>
  <p>둘째 문단은 배경과 수치를 담는다. 관련 예산은 1조 2천억 원 규모로 지난해보다 15% 늘었다고 당국이 설명했다.</p>
  <p>셋째 문단은 반응을 전한다. 전문가들은 "효과를 판단하기에는 이르다"고 말했다.</p></div></article></body></html>`;
  const p = extractPage(html);
  assert.equal(p.paragraphs.length, 3);
  assert.match(p.paragraphs[0], /^본문 첫 문단/);
  assert.ok(!p.paragraphs.some((x) => /요약/.test(x)));
});

test('evidence: a byline line is not taken as the lede', () => {
  const ev = extractEvidence(['Jane Doe | Daily Correspondent', 'The first known human case of the virus was reported by French authorities this month, officials said.']);
  assert.equal(ev[0].kind, 'lede');
  assert.match(ev[0].text, /^The first known human case/);
});

test('extract: paywall and publisher opt-outs are detected', () => {
  const pw = extractPage(`<html><head><script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":"False","datePublished":"2026-10-27T01:00:00Z"}</script></head><body><article><p>${'Teaser text. '.repeat(10)}</p></article></body></html>`);
  assert.equal(pw.paywalled, true);
  assert.equal(pw.publishedAt, '2026-10-27T01:00:00.000Z');
  assert.deepEqual(extractPage('<html><head><meta name="robots" content="index, noai"></head><body></body></html>').restrictions, ['noai']);
  assert.deepEqual(extractPage('<html><head><meta name="tdm-reservation" content="1"></head><body></body></html>').restrictions, ['tdm-reservation']);
});

test('evidence: lede, figures, quotes; snippets short and within budget', () => {
  const ev = extractEvidence(extractPage(KO_PAGE).paragraphs);
  assert.equal(ev[0].kind, 'lede');
  assert.match(ev[0].text, /77가구 107명/);
  assert.ok(ev.some((e) => e.kind === 'quote' && /용수가 부족해/.test(e.text)));
  assert.ok(ev.some((e) => e.kind === 'statement' && /서울시는/.test(e.text)));
  assert.ok(ev.every((e) => e.text.length <= 240));
  assert.ok(ev.reduce((s, e) => s + e.text.length, 0) <= 1000);
  assert.deepEqual(figuresIn('77가구 107명, GDP 1.0% 성장, 2,400억 원'), ['77가구', '107명', '1.0%', '2400억']);
  assert.deepEqual(figuresIn('At least 1,200 people and 3.5 percent'), ['1200people', '3.5percent']);
  assert.deepEqual(splitSentences('첫 번째 문장은 이렇게 끝난다. 두 번째 문장도 길게 이어서 쓴다. The third sentence is in English. And a fourth one follows here.').length, 4);
});

function fetcherFor(pages: Record<string, FetchResult>, robots: Record<string, FetchResult> = {}): Fetcher {
  return async (url) => {
    const u = new URL(url);
    if (u.pathname === '/robots.txt') return robots[u.origin] ?? res(404, '');
    return pages[url] ?? res(404, 'not found');
  };
}

test('retrieve: read, blocked by robots, paywalled, restricted, partial, http error', async () => {
  const pages: Record<string, FetchResult> = {
    'https://ko.example/a': res(200, KO_PAGE),
    'https://blocked.example/a': res(200, KO_PAGE),
    'https://pay.example/a': res(200, '<html><head><script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":false}</script></head><body><article><p>' + 'x '.repeat(400) + '</p></article></body></html>'),
    'https://noai.example/a': res(200, '<html><head><meta name="robots" content="noai"></head><body><article><p>' + '본문 '.repeat(300) + '</p></article></body></html>'),
    'https://thin.example/a': res(200, '<html><body><article><p>Too short to count as the article text at all.</p></article></body></html>'),
  };
  const robots = { 'https://blocked.example': res(200, 'User-agent: *\nDisallow: /') };
  const deps = { fetcher: fetcherFor(pages, robots), robots: new RobotsCache(fetcherFor(pages, robots)) };
  const r = async (url: string, language = 'ko') => retrieveArticle(article({ url, language, publisher: new URL(url).host }), deps);
  const ok = await r('https://ko.example/a');
  assert.equal(ok.status, 'read');
  assert.equal(ok.robots, 'no-robots');
  assert.equal(ok.pagePublishedAt, '2026-10-27T11:31:00.000Z');
  assert.ok(ok.evidence.length >= 3);
  assert.match(ok.textSha256!, /^[0-9a-f]{64}$/);
  assert.ok(!('text' in ok), 'full text is not part of the record');
  const blocked = await r('https://blocked.example/a');
  assert.equal(blocked.status, 'blocked-robots');
  assert.equal(blocked.httpStatus, null, 'page never requested');
  assert.deepEqual(blocked.evidence, []);
  assert.equal((await r('https://pay.example/a', 'en')).status, 'paywalled');
  const restricted = await r('https://noai.example/a');
  assert.equal(restricted.status, 'restricted');
  assert.deepEqual(restricted.evidence, [], 'opted-out text is not used');
  assert.equal((await r('https://thin.example/a', 'en')).status, 'partial');
  assert.equal((await r('https://ko.example/missing')).status, 'http-error');
  // readArticle: paragraphs only for read pages, never for opted-out or blocked ones
  const ra = async (url: string, language = 'ko') => readArticle(article({ url, language, publisher: new URL(url).host }), deps);
  assert.ok((await ra('https://ko.example/a')).paragraphs.length >= 3);
  for (const u of ['https://blocked.example/a', 'https://noai.example/a']) assert.deepEqual((await ra(u)).paragraphs, []);
  assert.deepEqual((await ra('https://pay.example/a', 'en')).paragraphs, []);
});

test('retrieve: a redirect to a host whose robots.txt disallows us is not read', async () => {
  const pages = { 'https://short.example/x': res(200, KO_PAGE, 'text/html', 'https://dest.example/story') };
  const robots = { 'https://dest.example': res(200, 'User-agent: *\nDisallow: /story') };
  const f = fetcherFor(pages, robots);
  const rec = await retrieveArticle(article({ url: 'https://short.example/x', language: 'ko' }), { fetcher: f, robots: new RobotsCache(f) });
  assert.equal(rec.status, 'blocked-robots');
});

test('corroboration counts only read articles from different publishers', () => {
  const rec = (publisher: string, status: RetrievalRecord['status'], figures: string[]): RetrievalRecord => ({
    url: `https://${publisher}.example/a`, finalUrl: null, publisher, sourceKey: null, feedPublishedAt: null, retrievedAt: '', status,
    httpStatus: 200, robots: 'allowed', restrictions: [], title: null, pagePublishedAt: null, pageModifiedAt: null, author: null,
    textChars: 1000, textSha256: null, evidence: figures.length ? [{ kind: 'figure', text: figures.join(' '), paragraph: 0, figures }] : [],
  });
  const c = corroborate([
    rec('yna', 'read', ['107명', '77가구']),
    rec('hani', 'read', ['107명']),
    rec('AP via Fortune', 'read', ['3명']),
    rec('AP', 'read', ['3명']),               // same publisher as above: not independent
    rec('paywalled', 'paywalled', ['107명']),  // unread: never counts
  ]);
  assert.equal(c.level, 'corroborated');
  assert.deepEqual(c.corroboratedFigures, [{ figure: '107명', publishers: ['yna', 'hani'] }]);
  assert.ok(c.singleSourceFigures.some((x) => x.figure === '3명'));
  assert.deepEqual(c.unread, [{ url: 'https://paywalled.example/a', publisher: 'paywalled', status: 'paywalled' }]);
  assert.equal(corroborate([rec('x', 'blocked-robots', [])]).level, 'unverified');
  // dates are not corroborating facts (every report of the day says "27일")
  const d = corroborate([rec('a', 'read', ['27일', '2023년']), rec('b', 'read', ['27일', '2023년'])]);
  assert.deepEqual(d.corroboratedFigures, []);
});

test('extractPage: deck (og:description) and subheadings inside the article body', async () => {
  const { extractPage } = await import('../src/research/extract.ts');
  const html = `<html><head><meta property="og:description" content="부제가 여기 있다"></head><body><header><h2>사이트 메뉴</h2></header><article>
    <p>${'첫 문단의 본문이 충분히 길게 이어진다. '.repeat(4)}</p><h2>첫 소제목</h2><p>${'둘째 문단도 충분히 길게 이어진다. '.repeat(4)}</p><h3>둘째 소제목</h3><p>${'셋째 문단 역시 길게 쓴다. '.repeat(4)}</p></article></body></html>`;
  const p = extractPage(html);
  assert.equal(p.description, '부제가 여기 있다');
  assert.deepEqual(p.subheads, ['첫 소제목', '둘째 소제목']);
});

test('excerpt: whole paragraphs up to 1000 characters, never more', async () => {
  const { excerptOf, EXCERPT_CHARS } = await import('../src/research/retrieve.ts');
  const p = ['가'.repeat(400), '나'.repeat(400), '다'.repeat(400)];
  assert.equal([...excerptOf(p)].length, 801);
  assert.ok([...excerptOf(['라'.repeat(3000)])].length <= EXCERPT_CHARS);
});
