import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inline, readingMinutes, renderArticle, renderHome, safeUrl, validateEdition } from '../src/render.ts';
import type { Edition } from '../src/types.ts';

/** Synthetic fixture (not real content). */
function edition(): Edition {
  return {
    date: '2026-10-28', status: 'preview', provenance: '시험용 가짜 데이터',
    intro: '오늘은 두 편입니다.',
    stories: [
      { slug: 'first-story', headline: '첫 번째 <제목>', standfirst: '요약 문장.', question: '무엇이 바뀌었나?', domain: '세계', place: '어딘가', form: 'current',
        sections: [{ paragraphs: ['첫 문단입니다.[1] **중요한** 대목입니다.[1][2]'] }, { heading: '배경', paragraphs: ['둘째 문단.[2]'] }],
        timeline: { title: '흐름', events: [{ when: '10월 4일', what: '1차 투표.[1]' }] },
        sources: [
          { n: 1, publisher: 'Example News', title: 'One', url: 'https://example.org/1', published: '2026-10-27T01:46:38Z', access: '원문 확인' },
          { n: 2, publisher: 'Example Review', author: 'A. Writer', title: 'Two', url: 'https://example.org/2', access: '원문 확인' },
        ] },
      { slug: 'second', headline: '두 번째', standfirst: '둘째 요약.', question: '왜 놀라운가?', domain: '과학', form: 'evergreen',
        sections: [{ paragraphs: ['본문.[1]'] }], sources: [{ n: 1, publisher: 'Lab', title: 'Paper', url: 'https://example.org/p', access: '원문 확인' }] },
    ],
    briefs: [{ text: '한 문장 소식이다.', url: 'https://example.org/b', publisher: 'Wire' }],
  };
}

test('inline: escapes HTML, renders bold and citation groups as footnote links', () => {
  const h = inline('<b>x</b> **굵게** 끝.[1][2]', [{ n: 1 } as any, { n: 2 } as any]);
  assert.match(h, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(h, /<strong>굵게<\/strong>/);
  assert.match(h, /<sup class="cite"><a href="#note-1" aria-label="출처 1">1<\/a><a href="#note-2" aria-label="출처 2">2<\/a><\/sup>/);
  assert.throws(() => inline('없는 출처.[3]', [{ n: 1 } as any]), /no matching source/);
});

test('safeUrl: only http(s)', () => {
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('https://example.org/a'), 'https://example.org/a');
});

test('validateEdition: citations, sources and links must match', () => {
  assert.deepEqual(validateEdition(edition()), []);
  const e = edition();
  e.stories[0].sources.push({ n: 3, publisher: 'X', title: 'Unused', url: 'ftp://x', access: '원문 확인' });
  e.stories[1].slug = 'Bad Slug';
  const p = validateEdition(e);
  assert.ok(p.some((x) => /source 3 is never cited/.test(x)));
  assert.ok(p.some((x) => /no http\(s\) URL/.test(x)));
  assert.ok(p.some((x) => /bad slug/.test(x)));
});

test('home: question-led previews, preview banner, briefs, noindex while unpublished', () => {
  const h = renderHome(edition());
  assert.match(h, /<h1 class="lead-question">무엇이 바뀌었나\?<\/h1>/);
  assert.match(h, /첫 번째 &lt;제목&gt;/);
  assert.match(h, /비공개 미리보기입니다/);
  assert.match(h, /noindex/);
  assert.match(h, /짧게 보는 세상/);
  assert.match(h, /2026년 10월 28일 수요일/);
  const pub = renderHome({ ...edition(), status: 'published' });
  assert.doesNotMatch(pub, /비공개 미리보기|noindex/);
});

test('article: standfirst, sections, timeline after the first section, numbered notes', () => {
  const e = edition();
  const h = renderArticle(e, e.stories[0]);
  assert.match(h, /<p class="standfirst">요약 문장.<\/p>/);
  assert.ok(h.indexOf('첫 문단') < h.indexOf('class="timeline"') && h.indexOf('class="timeline"') < h.indexOf('<h2>배경</h2>'));
  assert.match(h, /<li id="note-2" value="2"><span class="note-by">Example Review, A. Writer<\/span>/);
  assert.match(h, /2026년 10월 27일 게시/);
  assert.match(h, /href="\.\.\/style\.css"/);
  assert.equal(readingMinutes(e.stories[1]), 1);
});
