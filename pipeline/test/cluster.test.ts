import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRepeat, choosePrimary, independentPublishers, outletName, publisherKey, registerOutletHosts } from '../src/cluster.ts';
import { article, cluster, hoursAgo } from './helpers.ts';

test('wire copy republished elsewhere counts as one publisher', () => {
  assert.equal(publisherKey('AP via Fortune'), publisherKey('AP'));
  const c = cluster('a', {}, { articles: [article({ publisher: 'AP' }), article({ publisher: 'AP via Fortune' })] });
  assert.equal(independentPublishers(c), 1);
  c.articles.push(article({ publisher: 'SBS' }));
  assert.equal(independentPublishers(c), 2);
});

test('primary prefers reliability tier, then excerpt richness, then recency', () => {
  const weak = article({ reliabilityTier: 3, excerpt: 'x'.repeat(900) });
  const strong = article({ reliabilityTier: 1, excerpt: 'x'.repeat(50) });
  assert.equal(choosePrimary(cluster('p', {}, { articles: [weak, strong] })), strong);
  const older = article({ excerpt: 'same', publishedAt: hoursAgo(20) });
  const newer = article({ excerpt: 'same', publishedAt: hoursAgo(2) });
  assert.equal(choosePrimary(cluster('q', {}, { articles: [older, newer] })), newer);
});

test('no earlier coverage → not a repeat', () => {
  assert.deepEqual(checkRepeat(cluster('n'), []), { repeat: false, newDevelopment: false });
});

test('same URL already published with no newer source → repeat', () => {
  const a = article({ publishedAt: hoursAgo(10) });
  const c = cluster('r', {}, { articles: [a] });
  const r = checkRepeat(c, [{ issueDate: '2026-10-25', title: 'unrelated wording', urls: [a.url] }]);
  assert.equal(r.repeat, true);
  assert.equal(r.match?.issueDate, '2026-10-25');
});

test('matching topic with a fresh source well after the issue → new development', () => {
  const c = cluster('d', {}, { topicKey: 'brazil-runoff-2026', articles: [article({ publishedAt: hoursAgo(1) })] });
  const r = checkRepeat(c, [{ issueDate: '2026-10-20', title: 'x', topicKey: 'brazil-runoff-2026', urls: ['https://old.example/a'] }]);
  assert.equal(r.newDevelopment, true);
  assert.equal(r.repeat, false);
});

test('similar title within a day of the issue → repeat', () => {
  const c = cluster('s', {}, { title: 'France protests spread to universities', articles: [article({ publishedAt: hoursAgo(2) })] });
  const r = checkRepeat(c, [{ issueDate: '2026-10-26', title: 'France protests spread to universities nationwide', urls: [] }]);
  assert.equal(r.repeat, true);
});

test('one outlet is one publisher across feeds, sections, hosts and aggregators', () => {
  assert.equal(publisherKey('yna.co.kr'), publisherKey('연합뉴스'));
  assert.equal(publisherKey('BBC News – World'), publisherKey('BBC News – Business'));
  assert.equal(publisherKey('bbc.co.uk'), publisherKey('BBC News – World'));
  assert.equal(publisherKey('The Guardian – Culture'), publisherKey('theguardian.com'));
  assert.notEqual(publisherKey('The Guardian – World'), publisherKey('BBC News – World'));
  registerOutletHosts([{ name: 'Quanta Magazine', homepage: 'https://www.quantamagazine.org' }]);
  assert.equal(outletName('quantamagazine.org'), 'Quanta Magazine');
  const c = cluster('y', {}, { articles: [article({ publisher: '연합뉴스' }), article({ publisher: 'yna.co.kr' }), article({ publisher: 'BBC News – World' }), article({ publisher: 'BBC News – Business' })] });
  assert.equal(independentPublishers(c), 2);
});
