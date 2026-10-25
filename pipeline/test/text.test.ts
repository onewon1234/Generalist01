import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoursBetween, normalizeUrl, similarity, tokens } from '../src/text.ts';

test('hoursBetween is signed and accepts strings or Dates', () => {
  assert.equal(hoursBetween('2026-10-25T00:00:00Z', '2026-10-25T12:00:00Z'), 12);
  assert.equal(hoursBetween(new Date('2026-10-25T12:00:00Z'), '2026-10-25T00:00:00Z'), -12);
  assert.throws(() => hoursBetween('nope', new Date()), RangeError);
});

test('tokens keep Hangul and drop short Latin words', () => {
  assert.deepEqual([...tokens('Brazil 대선 is on, 결선투표!')], ['brazil', '대선', '결선투표']);
});

test('similarity is 1 for identical titles and 0 for unrelated ones', () => {
  assert.equal(similarity('France protests spread', 'France protests spread'), 1);
  assert.equal(similarity('France protests spread', 'Asteroid samples analysed'), 0);
  assert.ok(similarity('Brazil runoff vote today', 'Brazil runoff vote result') >= 0.5);
});

test('normalizeUrl ignores www, hash, tracking params and trailing slash', () => {
  assert.equal(
    normalizeUrl('https://WWW.Example.org/a/b/?utm_source=x&id=3#top'),
    normalizeUrl('https://example.org/a/b?id=3'),
  );
  assert.notEqual(normalizeUrl('https://example.org/a?id=3'), normalizeUrl('https://example.org/a?id=4'));
});
