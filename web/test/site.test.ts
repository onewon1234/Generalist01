import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../src/site.ts';
import { articleUrl, renderEmail } from '../src/email.ts';
import type { Edition } from '../src/types.ts';

function ed(date: string): Edition {
  return { date, status: 'published', intro: '오늘은 한 편입니다.', provenance: '자동 편집',
    stories: [{ slug: 'first', headline: '첫 번째 제목입니다', deck: '부제가 내용을 구체적으로 말한다', standfirst: '요약.', desk: 'world', domain: '세계', form: 'current',
      sections: [{ paragraphs: ['본문.[1]'] }], sources: [{ n: 1, publisher: 'Example', title: 'T', url: `https://example.org/${date}`, access: '원문 확인' }] }],
    briefs: [{ tag: '국제', label: '소식', line: '어느 나라에서 생긴 일 한 줄', text: '어느 나라에서 일이 생겼다.', url: `https://example.org/b/${date}`, publisher: 'Wire', published: `${date}T00:00:00+09:00` }] };
}

test('site: one directory per edition, root points to the newest, archive, robots disallow', () => {
  const out = mkdtempSync(join(tmpdir(), 'site-'));
  assert.deepEqual(buildSite([ed('2026-10-28'), ed('2026-10-29')], out), []);
  for (const f of ['2026-10-28/index.html', '2026-10-29/articles/first.html', '2026-10-29/style.css', 'archive.html', '.nojekyll']) assert.ok(existsSync(join(out, f)), f);
  assert.match(readFileSync(join(out, 'index.html'), 'utf8'), /url=\.\/2026-10-29\//);
  assert.match(readFileSync(join(out, 'robots.txt'), 'utf8'), /Disallow: \//);
  assert.match(readFileSync(join(out, '2026-10-29/index.html'), 'utf8'), /noindex/);
  assert.doesNotMatch(readFileSync(join(out, '2026-10-29/index.html'), 'utf8'), /비공개 미리보기/);
  const bad = ed('2026-10-30'); bad.stories[0].sections[0].paragraphs = ['출처 없는 인용.[9]'];
  assert.ok(buildSite([bad], mkdtempSync(join(tmpdir(), 'site-'))).length > 0, 'an invalid edition builds nothing');
});

test('email: absolute article links, the news strip, sources, test label', () => {
  const e = ed('2026-10-29');
  const m = renderEmail(e, 'https://onewon1234.github.io/Generalist01/', { test: true });
  assert.equal(articleUrl('https://onewon1234.github.io/Generalist01', e, 'first'), 'https://onewon1234.github.io/Generalist01/2026-10-29/articles/first.html');
  assert.match(m.subject, /^\[테스트\] Generalist Daily 10월 29일/);
  assert.match(m.html, /href="https:\/\/onewon1234\.github\.io\/Generalist01\/2026-10-29\/articles\/first\.html"/);
  assert.match(m.html, /오늘의 한 줄/);
  assert.match(m.html, /어느 나라에서 생긴 일 한 줄/);
  assert.match(m.html, /href="https:\/\/example\.org\/2026-10-29"/);
  assert.match(m.text, /2026-10-29\/articles\/first\.html/);
  assert.doesNotMatch(m.html, /<script/);
});
