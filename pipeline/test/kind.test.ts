import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentKind } from '../src/kind.ts';
import { classify } from '../src/preview/classify.ts';
import { depthNarrative } from '../src/preview/preview.ts';

// Titles, URLs and bylines from the 2026-10-28 r9 preview pool.
test('content kind: formats that must not become main stories (r9 cases)', () => {
  const k = (title: string, url = '', author = '', publisher = '') => contentKind({ title, url, author, publisher });
  assert.equal(k('The Devils review – Ken Russell’s 1971 possessed-nuns tale is a frenzied aria of confrontation and hysteria'), 'review');
  assert.equal(k('Pairing industrial AI autonomy and human control', 'https://www.technologyreview.com/2026/10/28/1147637/pairing-industrial-ai-autonomy-and-human-control/', 'MIT Technology Review Insights'), 'sponsored');
  assert.equal(k('Israel election results live: Netanyahu bloc and main opposition set to fall short', 'https://www.theguardian.com/world/live/2026/oct/28/israel-election-results-live'), 'live');
  assert.equal(k('Budget 2026 live: Burnham faces PMQs before Healey delivers budget'), 'live');
  assert.equal(k('Israeli voters: hope and despair as election ballots are counted', 'https://www.aljazeera.com/video/newsfeed/2026/10/28/israeli-voters'), 'video');
  assert.equal(k('What we know about Ukraine-Russia truce in Oleshky', 'https://www.bbc.co.uk/news/videos/c687z5ne1w4ro'), 'video');
  assert.equal(k('Lit Hub Daily: October 28, 2026'), 'digest');
  assert.equal(k('This week we launched the new Dezeen website'), 'house');
  assert.equal(k('Dezeen Awards public vote reveals 16 winning designs', '', '', 'Dezeen'), 'house');
  // Stories, including ones about reviews or live events, stay in.
  for (const t of ['How Voting Is Like a Klein Bottle', 'AI models cost more when you don’t use English', 'Lula\'s comeback in Brazil dents Trump\'s ambitions for Latin America',
    '스페인 중부서 고속열차 충돌로 최소 30명 사망…한국인 6명 경상(종합2보)', 'How AI is helping fight art theft', 'The Amarna letters', 'Peer review is failing science, study finds'])
    assert.equal(k(t, 'https://example.org/2026/10/28/a'), 'story', t);
  assert.equal(k('[사설] 국정감사 이후가 더 중요하다'), 'opinion');
  assert.equal(k('Opinion | The case for ranked voting', 'https://example.org/opinion/2026/ranked'), 'opinion');
});

test('classify: a specialist outlet\'s beat outweighs incidental keywords', () => {
  const t = ['Dezeen Awards public vote reveals 16 winning designs', 'Readers cast a vote in the poll for the best design of the year'];
  assert.equal(classify(t, 'philosophy-literature-arts-culture').subject, 'world-politics-society', 'without the beat prior: vote/poll → world');
  assert.equal(classify(t, 'philosophy-literature-arts-culture', { beat: true }).subject, 'philosophy-literature-arts-culture');
  const strong = ['Election', 'election vote poll parliament president minister government court'];
  assert.equal(classify(strong, 'philosophy-literature-arts-culture', { beat: true }).subject, 'world-politics-society', 'a clearly different subject still wins');
});

test('depth: short wire items carry less narrative material than long features', () => {
  assert.equal(depthNarrative({ maxChars: 843, figures: 0 }), -1);
  assert.equal(depthNarrative({ maxChars: 3000, figures: 0 }), 0);
  assert.equal(depthNarrative({ maxChars: 7000, figures: 0 }), 1);
  assert.equal(depthNarrative({ maxChars: 30000, figures: 0 }), 2);
});

test('classify: "war" is a word, not part of "Awards" or "software"', () => {
  assert.deepEqual(classify(['Design awards for new software'], 'philosophy-literature-arts-culture').hits, {});
  assert.equal(classify(['The war in Ukraine'], 'x').subject, 'world-politics-society');
});

test('routine notices (r10): main-story material only with another angle', async () => {
  const { isRoutineNotice } = await import('../src/kind.ts');
  for (const t of ['이재용, 故이건희 6주기 추모음악회 참석…삼성家·경영진 한자리에', 'SK하닉 ‘최고 실적’…3분기 영업익 83조', '유한양행, 3분기 영업이익 347억…전년 동기 대비 44.2% 증가',
    '티맥스소프트, 자사주 300억원 매입·소각 결정', 'LG화학, 엔솔 지분 2.5조 PRS 처분', '농협銀, NH미소금융에 1000억 출연', "'인도 최대 IPO' 지오 플랫폼스, 상장 첫날 21% 폭등…시총 176조원 달해"])
    assert.ok(isRoutineNotice(t), t);
  for (const t of ['구룡마을 또 큰불…강남 마지막 판자촌이 해마다 타는 이유', '구글·애플 ‘인앱결제 강제’ 과징금 637억원 확정', '아직 들어오지 않은 주문 예측까지…배민이 꿈꾸는 도시', 'AI models cost more when you don’t use English'])
    assert.ok(!isRoutineNotice(t), t);
});

test('coverage breadth counts at most three publishers per language', async () => {
  const { coverageBreadth } = await import('../src/preview/preview.ts');
  const a = (publisher: string, language: string) => ({ publisher, language }) as any;
  const ko = { key: 'k', title: 't', freshnessType: 'timely', articles: ['연합뉴스', '경향신문', '한국경제', '매일경제', '블로터'].map((p) => a(p, 'ko')) } as any;
  const mixed = { key: 'm', title: 't', freshnessType: 'timely', articles: [a('BBC', 'en'), a('Guardian', 'en'), a('연합뉴스', 'ko')] } as any;
  assert.equal(coverageBreadth(ko), 3);
  assert.equal(coverageBreadth(mixed), 3);
});
