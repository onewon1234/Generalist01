import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEIGHTS } from '../src/config.ts';
import { assignCardSizes, coverageFrom, gate, newestAgeHours, selectEdition, suitability } from '../src/select.ts';
import { EMPTY_COVERAGE, NOW, article, cluster, evergreen, hoursAgo, scores } from './helpers.ts';

const CATS = ['world-politics-society', 'economics-finance-business', 'science-technology-ai',
  'history-civilization-geography', 'philosophy-literature-arts-culture', 'psychology-behavior-everyday'];

test('weights sum to 1 and suitability is on a 0–100 scale', () => {
  const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.equal(suitability(scores()), 70);
  assert.equal(suitability(scores({ curiosity: 10, understanding: 10, narrative: 10, payoff: 10, relevance: 10, evidence: 10 })), 100);
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
  assert.match(gated(cluster('ev', { evidence: 4 }))!, /central claims not supportable/);
});

test('gates: elementary topics need a relevant current development', () => {
  assert.match(gated(cluster('g', { elementary: true }))!, /elementary/);
  assert.equal(gated(cluster('h', { elementary: true, contemporaryHook: true, relevance: 9 })), null);
});

test('gates: evergreen bar', () => {
  assert.match(gated(evergreen('i', { curiosity: 5, understanding: 5, narrative: 5, payoff: 5, relevance: 5 }))!, /evergreen suitability/);
  assert.match(gated(evergreen('j', { contemporaryHook: false, curiosity: 9, payoff: 7, understanding: 9, narrative: 9 }))!, /unusually strong idea/);
  assert.equal(gated(evergreen('k', { contemporaryHook: false, curiosity: 9, payoff: 9, understanding: 9, narrative: 9 })), null);
});

/** Six current stories and four evergreen pieces of comparable reader value. */
function pool() {
  const current = CATS.map((cat, i) => cluster(`t${i}`, { category: cat, payoff: 8 - i * 0.2, relevance: 8 }));
  const pieces = [0, 1, 2, 3].map((i) => evergreen(`e${i}`, { category: CATS[(i + 2) % 6], curiosity: 9, payoff: 8.5 - i * 0.3, understanding: 8, narrative: 8 }));
  return [...current, ...pieces];
}

test('no news-first mix: current stories and evergreen pieces compete equally, and the edition is varied', () => {
  const { chosen, warnings } = selectEdition(pool(), NOW, [], EMPTY_COVERAGE);
  const forms = chosen.map((c) => c.form);
  assert.equal(chosen.length, 6);
  assert.ok(forms.includes('timely') && forms.includes('evergreen'), forms.join());
  assert.deepEqual(warnings, []);
});

test('strong evergreen pieces may outnumber current stories (no quota either way)', () => {
  const weakCurrent = CATS.map((cat, i) => cluster(`w${i}`, { category: cat, curiosity: 6, understanding: 6, narrative: 6, payoff: 6, relevance: 7 }));
  const strong = [0, 1, 2, 3, 4].map((i) => evergreen(`s${i}`, { category: CATS[i], curiosity: 10, understanding: 9, narrative: 9, payoff: 10, relevance: 7 }));
  const { chosen } = selectEdition([...weakCurrent, ...strong], NOW, [], EMPTY_COVERAGE);
  assert.ok(chosen.filter((c) => c.form === 'evergreen').length >= 4);
});

test('one AI-primary story at most; subjects repeat only when clearly better (soft penalty, no cap)', () => {
  const ai = [0, 1, 2].map((i) => cluster(`ai${i}`, { category: 'science-technology-ai', aiPrimary: true, payoff: 10, curiosity: 10 }));
  const { chosen } = selectEdition([...ai, ...pool()], NOW, [], EMPTY_COVERAGE);
  assert.equal(chosen.filter((c) => c.scores!.aiPrimary).length, 1);
  const politics = [0, 1, 2].map((i) => cluster(`p${i}`, { category: CATS[0], curiosity: 10, understanding: 10, narrative: 10, payoff: 10, relevance: 10, evidence: 10 }));
  const r = selectEdition([...politics, ...pool()], NOW, [], EMPTY_COVERAGE);
  assert.equal(r.chosen.filter((c) => c.scores!.category === CATS[0]).length >= 3, true, 'three exceptional stories of one subject can all be chosen');
});

test('an all-news edition gets a variety note, never a forced swap', () => {
  const news = CATS.map((cat) => cluster(`n${cat}`, { category: cat }));
  const { chosen, warnings } = selectEdition(news, NOW, [], EMPTY_COVERAGE);
  assert.equal(chosen.length, 6);
  assert.ok(warnings.some((w) => /variety/.test(w)));
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

test('an edition can form without current stories when none qualify', () => {
  const ev = CATS.map((cat, i) => evergreen(`e${i}`, { category: cat, curiosity: 9, payoff: 9, understanding: 9, narrative: 9 - (i % 2) }));
  const { chosen, warnings } = selectEdition(ev, NOW, [], EMPTY_COVERAGE);
  assert.ok(chosen.length >= 5);
  assert.ok(!warnings.some((w) => /underfilled/.test(w)));
});

test('freshness follows the newest development; the primary carries it', () => {
  const old = article({ reliabilityTier: 1, publisher: 'Old Wire', publishedAt: hoursAgo(100) });
  const fresh = article({ reliabilityTier: 2, publisher: 'Fresh Daily', publishedAt: hoursAgo(2) });
  const other = article({ reliabilityTier: 2, publisher: 'Second Paper', publishedAt: hoursAgo(5) });
  const c = cluster('nd', {}, { articles: [old, fresh, other] });
  assert.equal(gated(c), null);
  assert.notEqual(c.primary, old, 'stale article is not the primary');
});

test('significant ongoing developments get a longer window', () => {
  const at = (h: number) => [article({ publishedAt: hoursAgo(h) }), article({ publishedAt: hoursAgo(h) })];
  assert.match(gated(cluster('o1', { isMajor: true }, { articles: at(100) }))!, /freshness/);
  assert.equal(gated(cluster('o2', { isMajor: true, ongoing: true }, { articles: at(100) })), null);
  assert.match(gated(cluster('o3', { isMajor: false, ongoing: true }, { articles: at(100) }))!, /freshness/, 'ongoing alone is not enough');
  assert.match(gated(cluster('o4', { isMajor: true, ongoing: true }, { articles: at(130) }))!, /freshness/);
});

test('card sizes: one featured large story only when the payoff is high', () => {
  const sizes = assignCardSizes([cluster('x', { payoff: 9 }), cluster('y', { payoff: 6 }), cluster('z', { payoff: 6 }), cluster('w', { payoff: 6 })]);
  assert.deepEqual([...sizes.values()].map((s) => s.size), ['large', 'medium', 'medium', 'small']);
  const flat = assignCardSizes([cluster('p', { payoff: 6 }), cluster('q', { payoff: 5 })]);
  assert.ok([...flat.values()].every((s) => !s.featured));
});
