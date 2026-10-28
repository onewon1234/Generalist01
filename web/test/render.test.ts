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
      { slug: 'first-story', headline: '첫 번째 <제목>이 바꾼 것', deck: '부제가 내용을 구체적으로 말한다', standfirst: '요약 문장.', desk: 'world', domain: '세계', place: '어딘가', form: 'current',
        sections: [{ paragraphs: ['첫 문단입니다.[1] **중요한** 대목입니다.[1][2]'] }, { heading: '배경', paragraphs: ['둘째 문단.[2]'] }],
        timeline: { title: '흐름', events: [{ when: '10월 4일', what: '1차 투표.[1]' }] },
        sources: [
          { n: 1, publisher: 'Example News', title: 'One', url: 'https://example.org/1', published: '2026-10-27T01:46:38Z', access: '원문 확인' },
          { n: 2, publisher: 'Example Review', author: 'A. Writer', title: 'Two', url: 'https://example.org/2', access: '원문 확인' },
        ] },
      { slug: 'second', headline: '두 번째 이야기의 역설', deck: '둘째 부제도 구체적으로 쓴다', standfirst: '둘째 요약.', desk: 'explore', domain: '과학', form: 'evergreen',
        sections: [{ paragraphs: ['본문.[1]'] }], sources: [{ n: 1, publisher: 'Lab', title: 'Paper', url: 'https://example.org/p', access: '원문 확인' }] },
    ],
    briefs: [{ tag: '국제', label: '어느 나라 선거', line: '어느 나라 선거 결과 발표', text: '한 문장 소식이다.', url: 'https://example.org/b', publisher: 'Wire', published: '2026-10-27T03:00:00Z' }],
  };
}

test('inline: escapes HTML, renders bold and citation groups as footnote links', () => {
  const h = inline('<b>x</b> **굵게** 끝.[1][2]', [{ n: 1 } as any, { n: 2 } as any]);
  assert.match(h, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(h, /<strong>굵게<\/strong>/);
  assert.match(h, /<sup class="cite"><a href="#note-1" aria-label="출처 1">1<\/a><a href="#note-2" aria-label="출처 2">2<\/a><\/sup>/);
  assert.throws(() => inline('없는 출처.[3]', [{ n: 1 } as any]), /no matching source/);
  const once = inline('첫 문장.[1] 둘째 문장.[1] 셋째.[2]', [{ n: 1 } as any, { n: 2 } as any]);
  assert.equal((once.match(/href="#note-1"/g) ?? []).length, 1, 'a repeated citation is shown once per run');
  assert.ok(once.indexOf('note-1') > once.indexOf('둘째'), 'kept at the later position');
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

test('home: lead, then the one-line news strip, then the other stories; preview banner, noindex', () => {
  const h = renderHome(edition());
  assert.match(h, /<h1 class="lead-headline">첫 번째 &lt;제목&gt;이 바꾼 것<\/h1>/);
  assert.match(h, /<p class="lead-deck">부제가 내용을 구체적으로 말한다<\/p>/);
  assert.match(h, /<section class="lines" id="briefs"/);
  assert.match(h, /<h2 id="lines-title">오늘의 한 줄<\/h2>/);
  assert.match(h, /<summary><span class="line-tag">국제<\/span><span class="line-text">어느 나라 선거 결과 발표 <time datetime="2026-10-27T03:00:00Z">10월 27일<\/time><\/span><\/summary>/);
  assert.match(h, /<div class="line-detail">\s*<p>한 문장 소식이다.<\/p>/);
  assert.match(h, /href="https:\/\/example.org\/b" rel="noopener">Wire 원문/);
  const lead = h.indexOf('class="lead"'), strip = h.indexOf('class="lines"'), rest = h.indexOf('class="entries"');
  assert.ok(lead < strip && strip < rest, 'the strip sits right under the lead story');
  assert.ok(strip < h.indexOf('</main>'));
  assert.match(h, /비공개 미리보기입니다/);
  assert.match(h, /noindex/);
  assert.match(h, /2026년 10월 28일 수요일/);
  const pub = renderHome({ ...edition(), status: 'published' });
  assert.doesNotMatch(pub, /비공개 미리보기/);
  assert.match(pub, /noindex/, 'not indexed until search visibility is approved');
  assert.doesNotMatch(renderHome({ ...edition(), status: 'published', indexable: true }), /noindex/);
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
