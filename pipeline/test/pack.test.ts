import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEDE_CHARS, longestText, toPack } from '../src/preview/pack.ts';

test('research pack: metadata and short ledes only, no excerpts or full text', () => {
  const long = '가'.repeat(900);
  const preview: any = {
    generatedAt: '2026-10-29T20:20:00Z', ingest: { sources: 40, sourcesOk: 38 }, pool: 1, fetches: 2, warnings: [], leads: [], formExcluded: [],
    stories: [{ title: 'T', desk: 'world', subject: 's', form: 'timely', language: 'ko', publishers: 2, newestAgeHours: 3, suitability: 60, selected: true,
      corroboration: { corroboratedFigures: [{ figure: '30명' }] },
      records: [{ publisher: 'P', url: 'https://x.example/a', finalUrl: null, pagePublishedAt: null, feedPublishedAt: '2026-10-29T00:00:00Z', status: 'read', textChars: 5000,
        excerpt: long, evidence: [{ kind: 'lede', text: long, figures: ['30명'] }] },
        { publisher: 'Q', url: 'https://y.example/b', status: 'blocked-robots', textChars: 0, evidence: [] }] }],
    briefs: [{ title: 'B', tag: '국제', sourcePublisher: 'P', links: ['https://x.example/a'], publishedAt: null, sourceSentence: long, evidenceText: long }],
  };
  const pack = toPack(preview, '2026-10-30');
  const json = JSON.stringify(pack);
  assert.ok(longestText(pack) <= LEDE_CHARS);
  assert.ok(!json.includes('excerpt') && !json.includes('evidenceText') && !json.includes('가'.repeat(LEDE_CHARS + 1)));
  assert.equal(pack.stories[0].sources[1].lede, null, 'unread sources carry no text');
  assert.deepEqual(pack.stories[0].figures, ['30명']);
});
