/**
 * Clustering regression cases from live data. Every headline below is real,
 * copied from the ingest cluster audit of GitHub Actions run 40502558450
 * (2026-10-27, 18 sources). Each case documents a split or false merge that a
 * previous version of the grouping produced.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anchorWords, groupArticles } from '../src/ingest/group.ts';
import type { Article, Cluster } from '../src/types.ts';
import { article, hoursAgo } from './helpers.ts';

let t = 0;
function mk(title: string, language: 'ko' | 'en', publisher: string): Article {
  t += 0.05;
  return article({ title, language, publisher, publishedAt: hoursAgo(1 + t), excerpt: null });
}
const clusterOf = (cs: Cluster[], a: Article) => cs.find((c) => c.articles.includes(a))!;

// Guryong village fire: one event, previously split into three clusters
// (3bb9662ffe7c "spreading", 7fbefdfbd4b0 "77 households", fbbe8a8bef7e "wind shift / 7th district").
const FIRE_SPREAD = [
  '구룡마을 불길 안 잡히고 확산…강풍 타고 남쪽으로 번져',
  '[ 속보 ] 구룡마을 화재 아직 안 잡혔다…인근 확산 우려 커져',
  '[ 속보 ]구룡마을 화재 확산…"용수 부족해 진압 어려움"',
  '[ 속보 ]소방당국 “구룡마을 화재, 계속 번지는 상황…물 부족해 진압 애...',
  '[ 속보 ] 구룡마을 화재 7지구 확산중…"용수 부족해 진압 어려워"',
  '[ 속보 ]구룡마을 불 계속 번져…"용수 부족해 진압 어려움"',
  '[ 속보 ] ‘강남 마지막 판자촌’ 구룡마을 화재 확산 중…“용수 부족해...',
];
const FIRE_DAMAGE = [
  '[ 속보 ] 구룡마을 화재로 77가구 107명 피해…비상대피소 임시거처',
  '[ 속보 ] 구룡마을 화재, 77가구·107명 피해…비상대피소로',
  '[ 속보 ] 구룡마을 화재, 7지구로 확산… 77가구 107명 피해',
  '[ 속보 ] 구룡마을 화재 77가구, 107명 피해...비상대피소 임시거처',
  '[속보] 구룡마을 화재로 77가구 107명 피해…비상대피소 임시거처',
  '[ 속보 ] 구룡마을 화재, 강풍 타고 확산 중…77가구 107명 이재민 발생',
];
const FIRE_WIND = [
  '오세훈, 국힘 의원 만찬 취소하고 구룡마을 화재 현장으로(종합)',
  '구룡마을 화재, 7지구 인근으로...인명 피해는 없어',
  '[ 속보 ] 구룡마을 화재, 풍향 바뀌며 7지구 확산중',
  '[ 속보 ] 구룡마을 화재, 구룡산 향하다 풍향 바뀌며 7지구 확산중',
  '[ 속보 ] 소방 "구룡마을 화재, 주변 지구로 연소 확대 중"',
  '[ 속보 ] 구룡마을 화재 확산, 구룡산 향하다 7지구까지',
];

// Correctly grouped stories that must stay grouped and separate from each other.
const KO_STORIES: Record<string, string[]> = {
  pinewilt: [
    '경남도 "소나무재선충병 사회재난 지정하고 국가가 방제 나서야"',
    '경남도, 재선충병 국가 차원 대응 촉구',
    '경남도, "소나무재선충병 전국적 피해 확산, 국가 차원 방제 추진해야"',
    '경남도 "소나무재선충병 방제, 국가가 나서야"',
  ],
  mbappe: [
    '"중국 모욕했다"…축구 음바페, \'마오쩌둥 밈\'에 中서 \'후폭풍\'',
    '음바페, \'마오쩌둥 희화화\' 논란에…중국 광고 줄취소',
    '음바페, \'마오쩌둥 합성사진\' 농담했다가 중국 광고 줄해지',
    '축구스타 음바페, \'마오쩌둥 희화화\' 논란에 中광고 줄줄이 취소',
  ],
  gdp: [
    '3분기 경제 1.0% \'깜짝 성장\'…올해 4% 가시권',
    '3분기 성장률 1.0%로 반등…반도체·정부 지출 확대 영향',
    '3분기 GDP 1% ‘깜짝 성장’ …연간 4%도 보인다',
  ],
  takaichi: [
    '다카이치, 내달 中선전 APEC 참석 추진…시진핑과 정상회담은 미정',
    '日외무상 “다카이치, 中선전 APEC 참석 조율…중일회담은 검토 중”',
  ],
  kcc: [
    '\'디펜딩 챔피언\' KCC, SK에 져 6연패…프로농구 단독 최하위 추락',
    '프로농구 \'디펜딩 챔피언\' KCC, 6연패 수렁…단독 최하위로',
  ],
};

// Previous false merges: every headline here belongs to a different story.
const KO_FALSE_MERGES = [
  // 272a23e4199a: linked only by the date "27일"
  '평택산업진흥원 \'반도체 환경설비 오픈랩\' 11월 2일 개소',
  '[프로농구 중간순위] 27일',
  '복지부·재생의료진흥재단, 27~28일 2026 연례 심포지엄 개최',
  // 6bf2a2be57b5: linked only by "대전"
  '대전, ACLE 3차전서 \'K리그 천적\' 고베에 0-1 석패',
  '온통대전 캐시백 차등 지원 요구…"추가 혜택은 구비로 해야"',
];
const EN_FALSE_MERGES = [
  // c0ed045b148d: linked only by "see" / "everything"
  '‘A cultural moment’: smash hit doc You Can See Everything continues to dazzle America',
  'In the biotech world, you can’t see everything',
  'Hokusai’s Great Wave is one of 46 prints of Mount Fuji – seeing them together changes everything',
];
const EN_STORIES: Record<string, string[]> = {
  jordan: [
    'Why Jordan has struck Syria: What we know',
    'Jordan carries out deadly strike in Syria in retaliation for church attack',
    'Jordan attacks militants in Syria in retaliation for church attack',
  ],
  israel: [
    'Israel election live: polls open in most consequential vote in country’s history',
    'What does Israel\'s election mean for Gaza and the wider world?',
    'Israel election results 2026: When will we know who won and what’s next?',
  ],
};

function build() {
  t = 0;
  let p = 0;
  const pub = () => `pub${p++}`;
  const fire = [...FIRE_SPREAD, ...FIRE_DAMAGE, ...FIRE_WIND].map((x) => mk(x, 'ko', pub()));
  const ko = Object.fromEntries(Object.entries(KO_STORIES).map(([k, v]) => [k, v.map((x) => mk(x, 'ko', pub()))]));
  const en = Object.fromEntries(Object.entries(EN_STORIES).map(([k, v]) => [k, v.map((x) => mk(x, 'en', pub()))]));
  const falseKo = KO_FALSE_MERGES.map((x) => mk(x, 'ko', pub()));
  const falseEn = EN_FALSE_MERGES.map((x) => mk(x, 'en', pub()));
  // interleave so arrival order does not hide problems
  const all = [...fire, ...Object.values(ko).flat(), ...Object.values(en).flat(), ...falseKo, ...falseEn]
    .sort((a, b) => (a.url < b.url ? -1 : 1));
  return { fire, ko, en, falseKo, falseEn, clusters: groupArticles(all) };
}

test('anchor words: 4+ syllable names, particles stripped, generic names excluded', () => {
  assert.deepEqual([...anchorWords('[ 속보 ] 구룡마을 화재로 77가구 107명 피해')], ['구룡마을']);
  assert.deepEqual([...anchorWords('구룡마을의 불길')], ['구룡마을']);
  assert.deepEqual([...anchorWords('국민의힘, 국정감사 보이콧')], []);
});

test('regression: the Guryong village fire is one cluster (was split into three)', () => {
  const { fire, clusters } = build();
  const ids = new Set(fire.map((a) => clusterOf(clusters, a).key));
  assert.equal(ids.size, 1, `fire split into ${ids.size} clusters`);
  assert.equal(clusterOf(clusters, fire[0]).articles.length, fire.length, 'no unrelated story joined the fire cluster');
});

test('regression: date-only and single-word links no longer merge stories', () => {
  const { falseKo, falseEn, clusters } = build();
  for (const a of [...falseKo, ...falseEn]) {
    const c = clusterOf(clusters, a);
    assert.equal(c.articles.length, 1, `"${a.title}" merged with: ${c.articles.filter((x) => x !== a).map((x) => x.title).join(' | ')}`);
  }
});

test('regression: correctly grouped stories stay grouped and separate', () => {
  const { ko, en, clusters } = build();
  for (const [name, arts] of Object.entries({ ...ko, ...en })) {
    const c = clusterOf(clusters, arts[0]);
    assert.equal(c.articles.length, arts.length, `${name}: ${c.articles.map((a) => a.title).join(' | ')}`);
    for (const a of arts) assert.equal(clusterOf(clusters, a), c, `${name} split at "${a.title}"`);
  }
});

test('known limitation: English stories with varied headlines may still split', { todo: 'Lula coverage formed two clusters (16b266d90876, 95695fd4f9f7); English anchor merging is not enabled because names like "Trump" would merge unrelated stories. The editor stage must merge these.' }, () => {
  const a = [
    'How Lula beat far-right Bolsonaro in Brazil – The Latest',
    'Who is Lula? From ex-worker and prisoner to Brazil\'s president again',
    'Lula\'s comeback in Brazil dents Trump\'s ambitions for Latin America',
    'How the streets and social media drove Lula to a historic comeback in Brazil',
  ].map((x, i) => mk(x, 'en', `l${i}`));
  const cs = groupArticles(a);
  assert.equal(cs.length, 1);
});
