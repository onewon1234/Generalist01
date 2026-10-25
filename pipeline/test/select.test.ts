import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEIGHTS } from '../src/config.ts';
import { assignCardSizes, buckets, coverageFrom, gate, newestAgeHours, selectEdition, suitability } from '../src/select.ts';
import { EMPTY_COVERAGE, NOW, article, cluster, evergreen, hoursAgo, scores } from './helpers.ts';

const CATS = ['world-politics-society', 'economics-finance-business', 'science-technology-ai',
  'history-civilization-geography', 'philosophy-literature-arts-culture', 'psychology-behavior-everyday'];

test('weights sum to 1 and suitability is on a 0–100 scale', () => {
  const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.equal(suitability(scores()), 70);
  assert.equal(suitability(scores({ significance: 10, timeliness: 10, interest: 10, insight: 10, novelty: 10, accessibility: 10 })), 100);
});

test('buckets follow freshness and editorial functions', () => {
  assert.deepEqual(buckets(cluster('t', { functions: ['must_know'] })), ['timely']);
  assert.deepEqual(buckets(evergreen('d', { functions: ['something_new'] })), ['discovery']);
  assert.deepEqual(buckets(evergreen('r', { functions: ['food_for_thought'] })), ['reflection']);
  assert.deepEqual(buckets(cluster('x', { functions: ['in_the_know', 'good_to_know'] })), ['timely', 'discovery']);
});

function gated(c: ReturnType<typeof cluster>) {
  c.suitability = suitability(c.scores!);
  return gate(c, NOW, []);
}

test('gates: reliability, freshness, background, corroboration', () => {
  assert.match(gated(cluster('a', { reliable: false }))!, /unreliable/);
  assert.match(gated(cluster('b', {}, { articles: [article({ publishedAt: hoursAgo(60) }), article({ publishedAt: hoursAgo(60) })] }))!, /freshness/);
  assert.equal(gated(cluster('c', { isMajor: true }, { articles: [article({ publishedAt: hoursAgo(60) }), article({ publishedAt: hoursAgo(60) })] })), null);
  assert.match(gated(cluster('d', {}, { articles: [article({ eventDate: '2026-08-01' }), article({ eventDate: '2026-08-01' })] }))!, /old event/);
  assert.match(gated(cluster('e', {}, { articles: [article()] }))!, /second independent source/);
  assert.equal(gated(cluster('f', {}, { articles: [article({ reliabilityTier: 1 })] })), null, 'tier-1 single source allowed');
});

test('gates: elementary topics need a significant current development', () => {
  assert.match(gated(cluster('g', { elementary: true }))!, /elementary/);
  assert.equal(gated(cluster('h', { elementary: true, contemporaryHook: true, significance: 9 })), null);
});

test('gates: evergreen bar', () => {
  assert.match(gated(evergreen('i', { significance: 5, interest: 5, insight: 5, novelty: 5, accessibility: 5 }))!, /evergreen suitability/);
  assert.match(gated(evergreen('j', { contemporaryHook: false, novelty: 7, significance: 9, interest: 9, insight: 9 }))!, /hook/);
  assert.equal(gated(evergreen('k', { contemporaryHook: false, novelty: 9, significance: 9, interest: 9, insight: 9 })), null);
});

function pool() {
  const timely = CATS.slice(0, 5).map((cat, i) => cluster(`t${i}`, { category: cat, significance: 9 - i * 0.5 }));
  const discovery = [0, 1, 2].map((i) => evergreen(`d${i}`, { category: CATS[(i + 2) % 6], significance: 8, interest: 9, insight: 8, novelty: 9 - i }));
  const reflection = [evergreen('r0', { category: 'philosophy-literature-arts-culture', functions: ['food_for_thought'], significance: 8, interest: 8, insight: 9, novelty: 8 })];
  return [...timely, ...discovery, ...reflection];
}

test('selection yields the preferred shape from a healthy pool', () => {
  const { chosen, warnings } = selectEdition(pool(), NOW, [], EMPTY_COVERAGE);
  const count = (b: string) => chosen.filter((c) => c.bucket === b).length;
  assert.equal(chosen.length, 6);
  assert.ok(count('timely') >= 3 && count('timely') <= 4, `timely ${count('timely')}`);
  assert.ok(count('discovery') >= 1 && count('discovery') <= 2);
  assert.ok(count('reflection') <= 1);
  assert.deepEqual(warnings, []);
});

test('at most one AI-primary story and at most two per broad subject', () => {
  const ai = [0, 1, 2].map((i) => cluster(`ai${i}`, { category: 'science-technology-ai', aiPrimary: true, significance: 10 }));
  const { chosen } = selectEdition([...ai, ...pool()], NOW, [], EMPTY_COVERAGE);
  assert.equal(chosen.filter((c) => c.scores!.aiPrimary).length, 1);
  const perSubject = new Map<string, number>();
  for (const c of chosen) perSubject.set(c.scores!.category, (perSubject.get(c.scores!.category) ?? 0) + 1);
  for (const [, v] of perSubject) assert.ok(v <= 2);
});

test('never pads: a thin pool is flagged as underfilled', () => {
  const { chosen, warnings } = selectEdition(pool().slice(0, 3), NOW, [], EMPTY_COVERAGE);
  assert.equal(chosen.length, 3);
  assert.ok(warnings.some((w) => /underfilled/.test(w)));
});

test('fresher source wins a tie', () => {
  const older = cluster('old', { category: CATS[0] }, { articles: [article({ publishedAt: hoursAgo(40) }), article({ publishedAt: hoursAgo(40) })] });
  const newer = cluster('new', { category: CATS[1] }, { articles: [article({ publishedAt: hoursAgo(3) }), article({ publishedAt: hoursAgo(3) })] });
  assert.ok(newestAgeHours(newer, NOW)! < newestAgeHours(older, NOW)!);
  const { chosen } = selectEdition([older, newer], NOW, [], EMPTY_COVERAGE);
  assert.equal(chosen[0].key, 'new');
});

test('recent coverage of a subject lowers its priority', () => {
  const a = cluster('a', { category: CATS[0] });
  const b = cluster('b', { category: CATS[1] });
  const cov = coverageFrom([{ category: CATS[0], subtopic: null, stories: 3, window: '7d' }]);
  const { chosen } = selectEdition([a, b], NOW, [], cov);
  assert.equal(chosen[0].key, 'b');
});

test('card sizes: one featured large story only when significant', () => {
  const sizes = assignCardSizes([cluster('x', { significance: 9 }), cluster('y'), cluster('z'), cluster('w')]);
  assert.deepEqual([...sizes.values()].map((s) => s.size), ['large', 'medium', 'medium', 'small']);
  const flat = assignCardSizes([cluster('p', { significance: 6 }), cluster('q', { significance: 5 })]);
  assert.ok([...flat.values()].every((s) => !s.featured));
});
