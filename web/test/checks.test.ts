import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBriefs, checkHeadlines, checkLine, checkSubheads, normalise } from '../src/checks.ts';
import type { Edition, Story } from '../src/types.ts';

function story(slug: string, headline: string, deck = '부제가 내용을 구체적으로 말한다', extra: Partial<Story> = {}): Story {
  return { slug, headline, deck, standfirst: '요약.', desk: 'world', domain: '세계', form: 'current', sections: [{ paragraphs: ['본문.[1]'] }],
    sources: [{ n: 1, publisher: 'P', title: 'T', url: `https://example.org/${slug}`, access: '원문 확인' }], ...extra };
}
const review = { before: { headline: '예전 제목', deck: '예전 부제' }, reason: '본문의 가장 구체적인 사실을 제목으로 올렸다' };

test('headlines: shape, hype, repetition, a reason for the change; no candidate or question quotas', () => {
  const ok = story('a', '다시 자라던 빙하가 멈춘 해', '부제가 내용을 구체적으로 말한다', { headlineReview: review });
  const e = { date: '2026-10-28', status: 'preview', stories: [ok], briefs: [] } as Edition;
  assert.deepEqual(checkHeadlines(e).errors, []);
  const bad = story('b', '충격! 빙하가 멈췄다', '충격! 빙하가 멈췄다');
  const r = checkHeadlines({ ...e, stories: [bad] }).errors.join('\n');
  assert.match(r, /hype/);
  assert.match(r, /deck repeats/);
  const allQ = ['왜 빙하는 멈췄나?', '왜 투표는 돌까?', '왜 값이 다를까?'].map((h, i) => story(`q${i}`, h, '부제가 내용을 구체적으로 말한다', { headlineReview: review }));
  assert.deepEqual(checkHeadlines({ ...e, stories: allQ }).errors, [], 'question headlines are the editor\'s call');
  const noReason = story('n', '이유 없이 바뀐 제목', '부제가 내용을 구체적으로 말한다', { headlineReview: { ...review, reason: ' ' } });
  assert.match(checkHeadlines({ ...e, stories: [noReason] }).errors.join(), /no reason/);
});

test('subheadings: generic ones are noted, concrete and short natural ones pass', () => {
  const sec = (heading: string) => ({ heading, paragraphs: ['본문.[1]'] });
  const s = story('s', '구체적인 제목입니다', '부제가 내용을 구체적으로 말한다', { sections: [{ paragraphs: ['첫.[1]'] },
    sec('배경'), sec('결선까지'), sec('금리가 말해 주는 것'), sec('고칠 수 있을까'), sec('13년 동안 26번의 불'), sec('금리는 위험의 가격')] });
  const notes = checkSubheads(s).join('\n');
  for (const h of ['배경', '결선까지', '금리가 말해 주는 것', '고칠 수 있을까']) assert.match(notes, new RegExp(`"${h}"`));
  for (const h of ['13년 동안 26번의 불', '금리는 위험의 가격']) assert.doesNotMatch(notes, new RegExp(`"${h}"`));
});

test('one-line version: length, no new numbers, hedges and attribution kept', () => {
  const b = (line: string, text: string) => ({ tag: '한국' as const, label: 'x', line, text, url: 'https://x.example/a', publisher: 'P', published: '2026-10-27T03:00:00Z' });
  const text = '금융위원회는 연 60%를 넘는 불법사금융의 처벌 상한을 징역 10년으로 높이는 법안을 발의할 계획이라고 밝혔다.';
  assert.deepEqual(checkLine(b('금융위, 연 60% 넘는 불법사금융 처벌 징역 10년으로 상향 추진', text)), []);
  assert.deepEqual(checkLine(b('금융위 "불법사금융 처벌 징역 10년으로"', text)), [], 'a quotation keeps attribution');
  assert.match(checkLine(b('불법사금융 처벌 징역 10년으로 높아진다', text)).join(), /drops the plan wording/);
  assert.match(checkLine(b('불법사금융 처벌 징역 15년으로 상향 추진', text)).join(), /number \(15\)/);
  assert.match(checkLine(b('가'.repeat(49), text)).join(), /longer than 48/);
  assert.match(checkLine(b('', text)).join(), /missing/);
  assert.deepEqual(checkLine(b('영국 경찰, 남성 2명 기소', '영국 경찰이 두 남성을 기소했다.')), [], 'native Korean counts match digits');
});

test('briefs: tags, labels, dates against the edition time, duplicates, overlap with main stories', () => {
  const b = (label: string, text: string, url: string, published = '2026-10-27T03:00:00Z', tag: any = '국제') => ({ tag, label, line: label + ' 소식', text, url, publisher: 'P', published });
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
