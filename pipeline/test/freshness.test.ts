import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFreshness, sourceTime } from '../src/freshness.ts';
import { NOW, article, hoursAgo } from './helpers.ts';

test('undated and future-dated sources fail', () => {
  assert.equal(checkFreshness(article({ publishedAt: null }), NOW, false).reason, 'undated source');
  assert.match(checkFreshness(article({ publishedAt: hoursAgo(-5) }), NOW, false).reason!, /future/);
  assert.equal(checkFreshness(article({ publishedAt: hoursAgo(-0.5) }), NOW, false).ok, true, 'small clock skew tolerated');
});

test('48h default window, 72h for major developments', () => {
  assert.equal(checkFreshness(article({ publishedAt: hoursAgo(47) }), NOW, false).ok, true);
  assert.equal(checkFreshness(article({ publishedAt: hoursAgo(50) }), NOW, false).ok, false);
  assert.equal(checkFreshness(article({ publishedAt: hoursAgo(50) }), NOW, true).ok, true);
  assert.equal(checkFreshness(article({ publishedAt: hoursAgo(80) }), NOW, true).ok, false);
});

test('a recent update refreshes an older article', () => {
  const a = article({ publishedAt: hoursAgo(100), updatedAt: hoursAgo(3) });
  assert.equal(sourceTime(a), a.updatedAt);
  assert.equal(checkFreshness(a, NOW, false).ok, true);
});

test('an old event in a new article is flagged as background', () => {
  const r = checkFreshness(article({ publishedAt: hoursAgo(5), eventDate: '2026-09-01' }), NOW, false);
  assert.equal(r.ok, true);
  assert.equal(r.background, true);
  assert.equal(checkFreshness(article({ publishedAt: hoursAgo(5), eventDate: '2026-10-25' }), NOW, false).background, false);
});
