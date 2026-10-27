import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Fetcher } from '../src/collect/http.ts';
import type { SourceConfig } from '../src/collect/registry.ts';
import { bigrams, dice, groupArticles } from '../src/ingest/group.ts';
import { ingest, rankCandidates } from '../src/ingest/ingest.ts';
import { isLiveBlog, noiseReason } from '../src/ingest/noise.ts';
import { article, hoursAgo, NOW } from './helpers.ts';

test('noise filter: notices, obituaries, media-only, promo; real news passes', () => {
  assert.equal(noiseReason({ title: '[인사] 행정안전부' }), 'notice');
  assert.equal(noiseReason({ title: '[부고] 홍길동씨 별세' }), 'obituary');
  assert.equal(noiseReason({ title: '김모씨 모친상' }), 'obituary');
  assert.equal(noiseReason({ title: '[포토] 가을 단풍' }), 'media-only');
  assert.equal(noiseReason({ title: '[보도자료] 신제품 출시' }), 'promo');
  assert.equal(noiseReason({ title: 'In pictures: autumn in Seoul' }), 'media-only');
  assert.equal(noiseReason({ title: '3분기 성장률 1.0%로 반등…반도체·정부 지출 확대 영향' }), null);
  assert.equal(noiseReason({ title: '[단독] 정부, 전작권 전환 시점 합의' }), null, 'scoop tag is not noise');
  assert.equal(noiseReason({ title: 'Serbia wakes up to new reality after Vučić ousted' }), null);
  assert.equal(isLiveBlog({ title: 'Brazil runoff live updates', url: 'https://x.example/world/live/2026/oct/25/a' }), true);
});

test('bigram similarity tolerates Korean particles and punctuation', () => {
  const a = bigrams('구룡마을 화재, 강풍타고 남쪽으로 번져...이재민 100명 넘어');
  const b = bigrams('구룡마을 화재 확산…이재민 100명 넘어서 (종합2보)');
  const c = bigrams('프로농구 KCC, 6연패 수렁…단독 최하위로');
  assert.ok(dice(a, b) >= 0.32, `same story ${dice(a, b)}`);
  assert.ok(dice(a, c) < 0.15, `different story ${dice(a, c)}`);
});

test('grouping: same event together, different events and languages apart', () => {
  const ko1 = article({ title: '구룡마을 화재, 강풍타고 남쪽으로 번져…이재민 100명 넘어', language: 'ko', publisher: 'ajunews.com', publishedAt: hoursAgo(1) });
  const ko2 = article({ title: '구룡마을 화재 확산…이재민 100명 넘어서', language: 'ko', publisher: 'yna.co.kr', publishedAt: hoursAgo(2) });
  const ko3 = article({ title: '3분기 성장률 1.0%로 반등…반도체·정부 지출 확대 영향', language: 'ko', publisher: 'econovill.com', publishedAt: hoursAgo(1) });
  const en1 = article({ title: 'Fire spreads through Seoul shanty town', language: 'en', publisher: 'BBC', publishedAt: hoursAgo(1) });
  const cs = groupArticles([ko1, ko2, ko3, en1]);
  assert.equal(cs.length, 3);
  const fire = cs.find((c) => c.articles.includes(ko1))!;
  assert.ok(fire.articles.includes(ko2));
  assert.equal(fire.title, ko1.title, 'newest article seeds the title');
  assert.equal(cs.find((c) => c.articles.includes(en1))!.articles.length, 1);
});

test('candidates rank by corroboration, then size, then recency', () => {
  const r = rankCandidates([
    { key: 'a', title: 'A', language: 'ko', articles: 5, publishers: 1, sources: [], newest: hoursAgo(1), urls: [] },
    { key: 'b', title: 'B', language: 'ko', articles: 2, publishers: 2, sources: [], newest: hoursAgo(5), urls: [] },
    { key: 'c', title: 'C', language: 'ko', articles: 3, publishers: 2, sources: [], newest: hoursAgo(9), urls: [] },
  ]);
  assert.deepEqual(r.map((x) => x.key), ['c', 'b', 'a']);
});

test('ingest end to end with a fake network: only active sources, noise and stale dropped', async () => {
  const rss = (items: string) => `<rss version="2.0"><channel><title>T</title>${items}</channel></rss>`;
  const item = (title: string, link: string, h: number) => `<item><title>${title}</title><link>${link}</link><pubDate>${new Date(Date.parse(hoursAgo(h))).toUTCString()}</pubDate></item>`;
  const sources: SourceConfig[] = [
    { key: 'one', name: 'One', kind: 'rss', url: 'https://one.example/rss', language: 'ko', region: 'KR', subject: 'world-politics-society', reliabilityTier: 1, active: true, verified: 'test' },
    { key: 'two', name: 'Two', kind: 'rss', url: 'https://two.example/rss', language: 'ko', region: 'KR', subject: 'world-politics-society', reliabilityTier: 2, active: true, verified: 'test' },
    { key: 'off', name: 'Off', kind: 'rss', url: 'https://off.example/rss', language: 'ko', region: 'KR', subject: 'world-politics-society', reliabilityTier: 2, active: false },
  ];
  const requested: string[] = [];
  const fetcher: Fetcher = async (url) => {
    requested.push(url);
    const body = url.includes('one.example')
      ? rss(item('구룡마을 화재 확산…이재민 100명 넘어', 'https://one.example/1', 2) + item('[인사] 행정안전부', 'https://one.example/2', 1) + item('지난주 행사 결산', 'https://one.example/3', 200))
      : rss(item('구룡마을 화재, 강풍타고 번져…이재민 100명 넘어서', 'https://two.example/9', 1) + item('프로농구 KCC 6연패', 'https://two.example/8', 3));
    return { ok: true, status: 200, finalUrl: url, contentType: 'application/xml', body, ms: 1 };
  };
  const r = await ingest(sources, fetcher, NOW, {});
  assert.ok(!requested.some((u) => u.includes('off.example')), 'inactive sources are not fetched');
  assert.deepEqual(
    { collected: r.counts.collected, noise: r.counts.noise, stale: r.counts.stale, fresh: r.counts.fresh, clusters: r.counts.clusters, multi: r.counts.multiSource },
    { collected: 5, noise: 1, stale: 1, fresh: 3, clusters: 2, multi: 1 });
  assert.equal(r.candidates[0].publishers, 2);
  assert.match(r.candidates[0].title, /구룡마을/);
  assert.deepEqual(r.noiseByReason, { notice: 1 });
});
