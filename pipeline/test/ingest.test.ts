import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Fetcher } from '../src/collect/http.ts';
import type { SourceConfig } from '../src/collect/registry.ts';
import { features, groupArticles } from '../src/ingest/group.ts';
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

test('features: Korean bigrams without tags, English stemmed words without stopwords', () => {
  assert.deepEqual(features('[속보] 구룡마을 화재'), ['구룡', '룡마', '마을', '화재']);
  assert.deepEqual(features('Leaders congratulate Lula on the election win (LEAD)'), ['leader', 'congratulate', 'lula', 'election', 'win']);
  assert.deepEqual(features('77가구 107명 2026'), ['#77', '가구', '#107', '명', '#2026']);
});

/**
 * Regression fixture: real headlines from the live ingest run 40501163781
 * (2026-10-27) and check-sources run 40317078713 (2026-10-26). The first
 * version of grouping merged unrelated English stories into one cluster of
 * 180 and split the Guryong village fire into five clusters.
 */
const FIRE = [
  '[ 속보 ] 구룡마을 화재, 풍향 바뀌며 7지구 확산중',
  '[ 속보 ] 구룡마을 화재 확산 중…"용수 부족해 진압 어려움"',
  '구룡마을 불길 안 잡히고 확산…강풍 타고 남쪽으로 번져',
  '[ 속보 ] 구룡마을 화재 아직 안 잡혔다…인근 확산 우려 커져',
  '구룡마을 화재, 강풍타고 남쪽으로 번져...이재민 100명 넘어',
];
const KO_OTHER = [
  '[현장] 추미애 지사, 소방재정 국가책임 확대·지방세제 개편 촉구...재...',
  '경남도, 재선충병 국가 차원 대응 촉구',
  '[ 속보 ] 구속만료 앞둔 김건희 추가 구속…구속기간 2개월 연장',
  '3분기 성장률 1.0%로 반등…반도체·정부 지출 확대 영향',
  "프로농구 '디펜딩 챔피언' KCC, 6연패 수렁…단독 최하위로",
  '다카이치, 내달 中선전 APEC 참석 추진…시진핑과 정상회담은 미정',
  '"베트남 첫 반도체공장 건설계획 지연…내년 시험생산 어려울듯"',
  '시진핑, 후쿠다 前총리 애도하며 日에 경고…“선배 정치가 노력 소중히...',
];
const EN_OTHER = [
  "Exercise doesn't just strengthen your heart. It rewires it",
  'I would like to rejoin EU, says Burnham, but ‘British public are the bosses’ – UK politics live',
  'Australians should prepare for online services to go down unexpectedly as threats rise, cyber agency warns',
  'Trump intensifies anti-Muslim rhetoric against Abdul El-Sayed at Michigan rally – US politics live',
  'Serbia wakes up to new reality after student-led movement ousts Vučić – Europe live',
  'First-time buyer wary of Budget housing loan scheme',
  'Love with nowhere to go',
  'How to build real peace',
];

test('grouping on real headlines: one fire cluster, no false merges', () => {
  const ko = (t: string, i: number) => article({ title: t, language: 'ko', publisher: `ko${i}`, publishedAt: hoursAgo(1 + i * 0.1), excerpt: null });
  const en = (t: string, i: number) => article({ title: t, language: 'en', publisher: `en${i}`, publishedAt: hoursAgo(1 + i * 0.1), excerpt: null });
  const fire = FIRE.map(ko);
  const others = [...KO_OTHER.map((t, i) => ko(t, 10 + i)), ...EN_OTHER.map((t, i) => en(t, 30 + i))];
  const cs = groupArticles([...others, ...fire]);
  const fireClusters = cs.filter((c) => c.articles.some((a) => fire.includes(a)));
  assert.equal(fireClusters.length, 1, `fire split into ${fireClusters.map((c) => c.articles.length)}`);
  assert.equal(fireClusters[0].articles.length, FIRE.length, 'nothing else joined the fire cluster');
  for (const o of others) {
    const c = cs.find((x) => x.articles.includes(o))!;
    assert.equal(c.articles.length, 1, `"${o.title}" merged with "${c.articles.filter((a) => a !== o).map((a) => a.title)}"`);
  }
});

test('grouping: an English pair about the same event merges (constructed pair)', () => {
  const a = article({ title: 'Brazil runoff live updates: world leaders congratulate Lula on historic election win as Bolsonaro refuses to concede', language: 'en', publisher: 'Guardian' });
  const b = article({ title: 'Lula wins Brazil runoff as Bolsonaro refuses to concede', language: 'en', publisher: 'BBC' });
  const c = article({ title: 'How to build real peace', language: 'en', publisher: 'Aeon' });
  const cs = groupArticles([a, b, c]);
  assert.equal(cs.length, 2);
  assert.equal(cs.find((x) => x.articles.includes(a))!.articles.length, 2);
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
