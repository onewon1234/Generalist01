/**
 * '짧게 보는 세상' tests. Source sentences are real evidence snippets from the
 * private preview run of 2026-10-27 21:31 KST.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseBriefs, modality, overlapsMain, validateBrief, type BriefCandidate } from '../src/preview/briefs.ts';
import type { PreviewStory } from '../src/preview/preview.ts';
import type { RetrievalRecord } from '../src/research/retrieve.ts';

const EBOLA_LEDE = '콩고민주공화국(민주콩고)에서 에볼라 발병 선언 165일 만에 누적 확진자가 1만명을 넘어선 것으로 확인됐다.';
const EBOLA_FIG = '이 가운데 거의 절반에 해당하는 4천887명이 사망해 치명률은 48.6%로 파악됐다.';
const EU_LEDE = '27일(현지시간) EU 본부가 자리한 브뤼셀 관가와 산업계와 따르면, 하이브리드 차량에 대한 EU 집행위원회의 세이프가드 조사가 이번 주 안으로 시작될 예정이다.';
const VN_LEDE = '베트남의 야심적인 첫 반도체 일괄 생산 공장 건설 계획이 지연되고 있어 당초 목표한 내년 시험 생산이 쉽지 않을 것으로 알려졌다.';

function rec(url: string, publisher: string, evidence: [string, string][], status: RetrievalRecord['status'] = 'read'): RetrievalRecord {
  return {
    url, finalUrl: url, publisher, sourceKey: null, feedPublishedAt: null, retrievedAt: '', status, httpStatus: 200, robots: 'allowed',
    restrictions: [], title: null, pagePublishedAt: null, pageModifiedAt: null, author: null, textChars: 1000, textSha256: null,
    evidence: status === 'read' ? evidence.map(([kind, text], i) => ({ kind: kind as any, text, paragraph: i, figures: [] })) : [],
  };
}

function story(key: string, title: string, records: RetrievalRecord[], extra: Partial<PreviewStory> = {}): PreviewStory {
  const read = records.filter((r) => r.status === 'read').map((r) => r.publisher);
  return {
    key, title, language: /\p{Script=Hangul}/u.test(title) ? 'ko' : 'en', subject: 'world-politics-society', sports: false,
    publishers: records.length, articles: records.length, newestAgeHours: 2, records,
    corroboration: { readPublishers: read, unread: [], corroboratedFigures: [], singleSourceFigures: [], level: read.length >= 2 ? 'corroborated' : read.length ? 'single-source' : 'unverified' },
    scores: {} as any, suitability: 60, reasoning: [], selected: false, ...extra,
  };
}

test('modality: facts, forecasts, schedules, possibilities, allegations, attributions', () => {
  assert.deepEqual(modality(EBOLA_LEDE), ['fact']);
  assert.ok(modality(EU_LEDE).includes('scheduled'));
  assert.ok(modality(VN_LEDE).includes('possibility'));
  assert.ok(modality(VN_LEDE).includes('attributed'), '"알려졌다" is reported, not established');
  assert.ok(modality('검찰은 그가 뇌물을 받은 혐의가 있다고 밝혔다.').includes('allegation'));
  assert.ok(modality('The ministry said prices could rise next year.').includes('possibility'));
});

test('overlap with main stories: Korean anchors, two English proper nouns', () => {
  assert.equal(overlapsMain({ title: '구룡마을 화재 이재민 107명' }, [{ title: '구룡마을 화재로 77가구 피해' }]), true);
  assert.equal(overlapsMain({ title: 'Turnout so far highest in decades as Israelis vote' }, [{ title: 'Israel election: Netanyahu coalition set to lose majority' }]), false, 'one shared name is not enough in English');
  assert.equal(overlapsMain({ title: 'Lula comeback in Brazil dents Trump' }, [{ title: 'Brazil runoff: Lula beats Bolsonaro' }]), true);
});

test('chooseBriefs: excludes main events, unread, sports, overlong sentences; one per event', () => {
  const main = story('m', '구룡마을 화재로 77가구 107명 피해', [rec('https://a.example/1', '연합뉴스', [['lede', '구룡마을에서 불이 나 77가구 107명의 이재민이 발생했다.']])], { selected: true });
  const sameAsMain = story('s1', '구룡마을 화재 확산, 진압 어려움', [rec('https://b.example/1', 'B', [['lede', '구룡마을 화재가 확산하고 있다.']])]);
  const ebola = story('e', '민주콩고 에볼라 확진자 1만명 넘어…절반 가까이 사망', [rec('https://yna.example/ebola', '연합뉴스', [['lede', EBOLA_LEDE], ['figure', EBOLA_FIG]])]);
  const unread = story('u', '단독 출처, 원문 못 읽음', [rec('https://c.example/x', 'C', [], 'blocked-robots')]);
  const sport = story('sp', '프로농구 KCC 6연패', [rec('https://d.example/s', 'D', [['lede', 'KCC가 SK에 져 6연패에 빠졌다.']])], { sports: true });
  const long = story('l', '긴 문장 기사', [rec('https://e.example/l', 'E', [['lede', '가'.repeat(239) + '…']])]);
  const { briefs, excluded } = chooseBriefs([main, sameAsMain, ebola, unread, sport, long]);
  assert.deepEqual(briefs.map((b) => b.key), ['e']);
  const why = Object.fromEntries(excluded.map((x) => [x.title, x.reason]));
  assert.equal(why['구룡마을 화재 확산, 진압 어려움'], '메인 기사와 같은 사건');
  assert.equal(why['단독 출처, 원문 못 읽음'], '원문 확인 없음');
  assert.equal(why['프로농구 KCC 6연패'], '스포츠 결과');
  assert.equal(why['긴 문장 기사'], '한 문장으로 정확히 줄이기 어려움');
  assert.deepEqual(briefs[0].links, ['https://yna.example/ebola']);
});

function cand(sourceSentence: string, evidence: string[], link = 'https://yna.example/a'): BriefCandidate {
  return { key: 'k', title: 't', subject: 'x', sourceSentence, sourcePublisher: '연합뉴스', links: [link], evidenceText: [sourceSentence, ...evidence].join('\n'), modality: modality(sourceSentence), reason: '' };
}

test('validateBrief accepts a faithful one-sentence brief', () => {
  const c = cand(EBOLA_LEDE, [EBOLA_FIG]);
  const r = validateBrief('민주콩고의 에볼라 누적 확진자가 발병 선언 165일 만에 1만 명을 넘었고 이 가운데 4천887명이 숨져 치명률이 48.6%에 이르렀다.', 'https://yna.example/a', c);
  assert.deepEqual(r.issues, []);
});

test('validateBrief rejects lost hedging, invented numbers, two sentences, unverified links, hype', () => {
  const eu = cand(EU_LEDE, []);
  assert.match(validateBrief('EU 집행위원회가 하이브리드차 세이프가드 조사를 이번 주 시작했다.', 'https://yna.example/a', eu).issues.join(), /'예정' 표현이 문장에서 사라짐/);
  // the source attributes the schedule ("…에 따르면"); dropping the attribution is an error
  assert.match(validateBrief('EU 집행위원회가 하이브리드차 세이프가드 조사를 이번 주 안에 시작할 예정이다.', 'https://yna.example/a', eu).issues.join(), /'발표·주장' 표현이 문장에서 사라짐/);
  assert.deepEqual(validateBrief('브뤼셀 관가와 산업계에 따르면 EU 집행위원회가 하이브리드차 세이프가드 조사를 이번 주 안에 시작할 예정이다.', 'https://yna.example/a', eu).issues, []);
  const vn = cand(VN_LEDE, []);
  assert.ok(validateBrief('베트남 첫 반도체 공장의 내년 시험생산이 무산됐다.', 'https://yna.example/a', vn).issues.some((i) => /사라짐/.test(i)), 'possibility turned into fact');
  assert.deepEqual(validateBrief('베트남이 추진하는 첫 반도체 공장 건설 계획이 지연돼 내년 시험생산이 쉽지 않을 것으로 알려졌다.', 'https://yna.example/a', vn).issues, []);
  const eb = cand(EBOLA_LEDE, [EBOLA_FIG]);
  assert.match(validateBrief('민주콩고 에볼라 누적 확진자가 1만2천 명을 넘었다.', 'https://yna.example/a', eb).issues.join(), /근거에 없는 숫자: 2/);
  assert.match(validateBrief('민주콩고 에볼라 확진자가 1만 명을 넘었다. 절반 가까이 숨졌다.', 'https://yna.example/a', eb).issues.join(), /두 문장 이상/);
  assert.match(validateBrief('민주콩고 에볼라 누적 확진자가 1만 명을 넘었다.', 'https://other.example/x', eb).issues.join(), /원문 확인된 출처가 아님/);
  assert.match(validateBrief('충격적으로 민주콩고 에볼라 확진자가 무려 1만 명을 넘었다.', 'https://yna.example/a', eb).issues.join(), /과장 표현/);
  assert.match(validateBrief('에볼라 1만 명 돌파', 'https://yna.example/a', eb).issues.join(), /평서문|너무 짧/);
});
