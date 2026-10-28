import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBriefs, checkHeadlines, normalise } from '../src/checks.ts';
import type { Edition, Story } from '../src/types.ts';

function story(slug: string, headline: string, deck = '부제가 내용을 구체적으로 말한다', extra: Partial<Story> = {}): Story {
  return { slug, headline, deck, standfirst: '요약.', desk: 'world', domain: '세계', form: 'current', sections: [{ paragraphs: ['본문.[1]'] }],
    sources: [{ n: 1, publisher: 'P', title: 'T', url: `https://example.org/${slug}`, access: '원문 확인' }], ...extra };
}
const review = (h: string, d: string) => ({ candidates: [
  { style: 'plain' as const, headline: '평범한 사실형 제목입니다', deck: '부제 하나를 여기에 적는다' },
  { style: 'paradox' as const, headline: h, deck: d },
  { style: 'question' as const, headline: '이것은 질문형 제목일까요?', deck: '부제 둘을 여기에 적는다' },
], chosen: 1, reason: '이야기를 가장 정확하게 드러내면서 궁금증을 만든다' });

test('headlines: shape, hype, repetition, candidates in several styles, not all questions', () => {
  const ok = story('a', '다시 자라던 빙하가 멈춘 해', '부제가 내용을 구체적으로 말한다', { headlineReview: review('다시 자라던 빙하가 멈춘 해', '부제가 내용을 구체적으로 말한다') });
  const e = { date: '2026-10-28', status: 'preview', stories: [ok], briefs: [] } as Edition;
  assert.deepEqual(checkHeadlines(e).errors, []);
  const bad = story('b', '충격! 빙하가 멈췄다', '충격! 빙하가 멈췄다');
  const r = checkHeadlines({ ...e, stories: [bad] }).errors.join('\n');
  assert.match(r, /hype/);
  assert.match(r, /deck repeats/);
  const allQ = ['왜 빙하는 멈췄나?', '왜 투표는 돌까?', '왜 값이 다를까?'].map((h, i) => story(`q${i}`, h));
  assert.match(checkHeadlines({ ...e, stories: allQ }).errors.join(), /3 of 3 headlines are questions/);
  const mismatch = story('m', '실제 게재된 다른 제목', '부제가 내용을 구체적으로 말한다', { headlineReview: review('후보에서 고른 제목', '부제가 내용을 구체적으로 말한다') });
  assert.match(checkHeadlines({ ...e, stories: [mismatch] }).errors.join(), /differ from the chosen candidate/);
});

test('briefs: tags, labels, dates against the edition time, duplicates, overlap with main stories', () => {
  const b = (label: string, text: string, url: string, published = '2026-10-27T03:00:00Z', tag: any = '국제') => ({ tag, label, text, url, publisher: 'P', published });
  const e = { date: '2026-10-28', status: 'preview', stories: [story('main', '메인 기사의 제목입니다')], briefs: [
    b('요르단 공습', '요르단군이 시리아 남부를 공습했다고 밝혔다.', 'https://bbc.example/1?at_medium=RSS'),
    b('같은 링크', '다른 문장이지만 같은 원문을 가리킨다.', 'https://bbc.example/1'),
    b('너무 오래됨', '지난주에 있었던 일을 전하는 문장이다.', 'https://x.example/old', '2026-10-20T00:00:00Z'),
    b('미래 시각', '아직 나오지 않은 기사를 가리키는 문장이다.', 'https://x.example/future', '2026-10-29T00:00:00Z'),
    b('메인과 중복', '메인 기사와 같은 원문을 쓰는 문장이다.', 'https://example.org/main'),
    b('태그 오류', '태그가 정해진 목록에 없는 문장이다.', 'https://x.example/tag', '2026-10-27T03:00:00Z', '연예'),
    b('거의 같은 문장', '요르단군이 시리아 남부를 공습했다고 밝혔다.', 'https://other.example/2'),
    b('문장이 아님', '요르단 시리아 공습', 'https://x.example/frag'),
  ] } as Edition;
  const r = checkBriefs(e).errors.join('\n');
  for (const re of [/same link as brief 1/, /older than 72 h/, /published after the edition time/, /repeats a main story/, /unknown tag 연예/, /near-duplicate of brief 1/, /one or two complete sentences/]) assert.match(r, re);
  assert.ok(!/brief 1 \(요르단 공습\)/.test(r), 'the first brief is fine');
  assert.equal(normalise('https://www.bbc.co.uk/news/a?at_medium=RSS&at_campaign=rss'), 'bbc.co.uk/news/a');
});
