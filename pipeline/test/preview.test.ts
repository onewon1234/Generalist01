import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FetchResult, Fetcher } from '../src/collect/http.ts';
import type { IngestResult } from '../src/ingest/ingest.ts';
import { summarize } from '../src/ingest/group.ts';
import { classify } from '../src/preview/classify.ts';
import { buildPreview, choosePool, pickArticles } from '../src/preview/preview.ts';
import { renderPreview } from '../src/preview/render.ts';
import type { Cluster } from '../src/types.ts';
import { NOW, article, hoursAgo } from './helpers.ts';

const page = (title: string, body: string[]) => `<html><head><meta property="og:title" content="${title}"><meta property="article:published_time" content="${hoursAgo(2)}"></head><body><article>${body.map((p) => `<p>${p}</p>`).join('')}</article></body></html>`;
const ok = (body: string): FetchResult => ({ ok: true, status: 200, finalUrl: '', contentType: 'text/html', body, ms: 1 });

function cl(key: string, titles: [string, string, string][]): Cluster {
  return { key, title: titles[0][0], freshnessType: 'timely', articles: titles.map(([t, pub, url]) => article({ title: t, publisher: pub, url, language: 'ko', publishedAt: hoursAgo(2) })) };
}

const FIRE_BODY = [
  '27일 오후 서울 강남구 구룡마을에서 불이 나 77가구 107명의 이재민이 발생했다고 소방당국이 밝혔다.',
  '소방당국은 "용수가 부족해 진압에 어려움을 겪고 있다"고 말했다. 불길은 강풍을 타고 7지구 쪽으로 번졌다.',
  '서울시는 인근 비상대피소에 임시 거처를 마련했다고 밝혔다. 화재 원인은 조사 중이다. 구룡마을은 화재에 취약한 판자촌이다.',
  '구룡마을은 1980년대 형성된 무허가 판자촌으로, 비닐과 합판 등 불에 잘 타는 자재로 지은 집이 밀집해 있어 화재에 취약하다는 지적이 꾸준히 나왔다.',
  '이 마을에서는 지난 2023년 1월에도 큰불이 나 주택 60여 채가 탔다. 재개발 사업은 수년째 보상 문제로 지연되고 있다.',
];

function fixture() {
  const fire = cl('fire', [
    ['구룡마을 화재로 77가구 107명 피해', 'yna.co.kr', 'https://yna.example/fire'],
    ['구룡마을 화재 확산…용수 부족', 'hani.co.kr', 'https://hani.example/fire'],
    ['구룡마을 화재 이재민 107명', 'blocked.co.kr', 'https://blocked.example/fire'],
  ]);
  const sport = cl('sport', [
    ['프로농구 KCC 6연패 수렁…단독 최하위', 'a.co.kr', 'https://a.example/s'],
    ['[프로농구 전적] SK 96-87 KCC, KCC 6연패', 'b.co.kr', 'https://b.example/s'],
  ]);
  const lone = cl('lone', [['단독 출처 기사 하나뿐인 소식', 'c.co.kr', 'https://c.example/x']]);
  const res: IngestResult = {
    collectedAt: NOW.toISOString(), health: [], noiseByReason: {},
    counts: { collected: 6, noise: 0, undated: 0, stale: 0, future: 0, fresh: 6, clusters: 3, multiSource: 2, liveBlogs: 0 },
    clusters: [fire, sport, lone], candidates: [fire, sport, lone].map(summarize),
  };
  const fetcher: Fetcher = async (url) => {
    const u = new URL(url);
    if (u.pathname === '/robots.txt') return u.host === 'blocked.example' ? ok('User-agent: *\nDisallow: /') : { ...ok(''), ok: false, status: 404 };
    if (u.host === 'yna.example') return ok(page('구룡마을 화재로 77가구 107명 피해', FIRE_BODY));
    if (u.host === 'hani.example') return ok(page('구룡마을 화재 확산', [FIRE_BODY[1], '이재민은 77가구 107명으로 집계됐다고 서울시가 밝혔다. 현장에는 소방관 수백 명이 투입됐다.', FIRE_BODY[2], FIRE_BODY[3], FIRE_BODY[4]]));
    return { ...ok(''), ok: false, status: 404 };
  };
  return { res, fetcher, fire };
}

test('classify: subject by keywords, sports flagged', () => {
  assert.equal(classify(['3분기 성장률 1.0%로 반등, 수출 증가'], 'world-politics-society').subject, 'economics-finance-business');
  assert.equal(classify(['프로농구 KCC 6연패, 리그 최하위'], 'world-politics-society').sports, true);
  assert.equal(classify(['무관한 제목'], 'psychology-behavior-everyday').subject, 'psychology-behavior-everyday', 'fallback to source subject');
  assert.equal(classify(['공소청-중수청 권한다툼 수면위로…리니언시 접수권 어디에', '수사·기소 분리 원칙'], 'psychology-behavior-everyday').subject, 'world-politics-society');
});

test('pool excludes sports and single-publisher stories; picks distinct publishers', () => {
  const { res, fire } = fixture();
  const pool = choosePool(res, 10, () => 'world-politics-society');
  assert.deepEqual(pool.map((c) => c.key), ['fire']);
  assert.equal(pickArticles(fire, 3).length, 3);
});

test('preview end to end: unread sources never verify, evidence cited, heuristics labelled', async () => {
  const { res, fetcher } = fixture();
  const p = await buildPreview(res, fetcher, () => 'world-politics-society', { now: NOW, minGapMs: 0 });
  const fire = p.stories.find((s) => s.key === 'fire')!;
  const status = Object.fromEntries(fire.records.map((r) => [r.publisher, r.status]));
  assert.deepEqual(status, { 'yna.co.kr': 'read', 'hani.co.kr': 'read', 'blocked.co.kr': 'blocked-robots' });
  assert.equal(fire.corroboration.level, 'corroborated');
  assert.deepEqual(fire.corroboration.readPublishers.sort(), ['hani.co.kr', 'yna.co.kr']);
  assert.ok(fire.corroboration.corroboratedFigures.some((f) => f.figure === '107명'));
  assert.equal(fire.scores.rationale, 'heuristic (no AI)');
  const md = renderPreview(p);
  assert.match(md, /비공개 검토용/);
  assert.match(md, /발행본 아님/);
  assert.match(md, /robots\.txt 차단\(미요청\)/);
  assert.match(md, /\[1\] \(lede\) “27일 오후 서울 강남구 구룡마을/);
  assert.match(md, /<https:\/\/yna\.example\/fire>/);
  assert.match(md, /AI 편집 판단 아님/);
  assert.ok(!md.includes('blocked.example/fire\n   ') || /blocked/.test(md));
});

test('a story whose articles could not be read is not selected', async () => {
  const { res } = fixture();
  const deny: Fetcher = async (url) => new URL(url).pathname === '/robots.txt' ? ok('User-agent: *\nDisallow: /') : ok('');
  const p = await buildPreview(res, deny, () => 'world-politics-society', { now: NOW, minGapMs: 0 });
  const fire = p.stories.find((s) => s.key === 'fire')!;
  assert.equal(fire.corroboration.level, 'unverified');
  assert.equal(fire.selected, false);
  assert.match(fire.rejectReason!, /unreliable|insufficient/);
});

test('classify: arts words that look like sports words', () => {
  assert.equal(classify(["'도암 펠로우' 음악 영재들, 獨 라이프치히 국립음대 초청 연주", '아트센터도암이 선발하고 지원하는 예술 영재들이 무대에 오른다.', '송 예술감독은 성사 배경을 설명했다.'], 'culture').sports, false);
  assert.equal(classify(['프로야구 LG 선발 투수 호투', '감독은 승리 후 소감을 밝혔다.'], 'culture').sports, true);
});
