import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seal } from '../src/seal.ts';
import type { Edition } from '../src/types.ts';

/** Synthetic five-story edition (not real content). */
function ed(date: string, tag = 'v1'): Edition {
  return { date, status: 'preview', intro: '오늘은 다섯 편입니다.', provenance: '자동 편집',
    stories: [1, 2, 3, 4, 5].map((i) => ({ slug: `s${i}-${tag}`, headline: `${i}번째 기사 제목입니다`, deck: '부제가 내용을 구체적으로 말한다', standfirst: '요약.', desk: 'world' as const, domain: '세계', form: 'current' as const,
      sections: [{ paragraphs: ['본문.[1]'] }], sources: [{ n: 1, publisher: 'Example', title: 'T', url: `https://example.org/${date}/${i}`, access: '원문 확인' }] })),
    briefs: [] };
}

const keys = () => generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const { publicKey, privateKey } = keys();

function repo(files: Record<string, Edition | object>) {
  const root = mkdtempSync(join(tmpdir(), 'prep-'));
  for (const d of ['sealed-editions', 'delivery']) mkdirSync(join(root, d));
  for (const [f, v] of Object.entries(files)) {
    const body = f.startsWith('sealed-editions/') ? seal(JSON.stringify(v), publicKey, (v as Edition).date) : v;
    writeFileSync(join(root, f), JSON.stringify(body));
  }
  return root;
}

function prepare(root: string, date: string, key = privateKey, delivery = true) {
  const args = ['--import', 'tsx', 'scripts/prepare.ts', '--date', date, '--sealed', join(root, 'sealed-editions'),
    '--work', join(root, 'work'), '--site', join(root, 'site'), ...(delivery ? ['--delivery', join(root, 'delivery')] : [])];
  const r = spawnSync(process.execPath, args, { cwd: join(import.meta.dirname, '..'), env: { ...process.env, EDITION_PRIVATE_KEY: key }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return Object.fromEntries(r.stdout.trim().split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
}

test('prepare: a valid edition is ready, with its slugs', () => {
  const o = prepare(repo({ 'sealed-editions/2026-11-03.sealed.json': ed('2026-11-03') }), '2026-11-03');
  assert.equal(o.ready, 'true');
  assert.equal(o.slugs, 's1-v1 s2-v1 s3-v1 s4-v1 s5-v1');
});

test('prepare: a corrected sealed file is the one used', () => {
  const root = repo({ 'sealed-editions/2026-11-03.sealed.json': ed('2026-11-03', 'v2') });
  const o = prepare(root, '2026-11-03');
  assert.equal(o.ready, 'true');
  assert.match(readFileSync(o.edition, 'utf8'), /s1-v2/);
});

test('prepare: a skip (cancel) file stops publication even when a sealed edition exists', () => {
  const o = prepare(repo({ 'sealed-editions/2026-11-03.sealed.json': ed('2026-11-03'), 'delivery/2026-11-03.skip.json': { date: '2026-11-03', reason: '취소' } }), '2026-11-03');
  assert.equal(o.ready, 'false');
  assert.equal(o.skipped, 'true');
  assert.match(o.reason, /cancel/);
});

test('prepare: missing edition and wrong key are not ready', () => {
  assert.equal(prepare(repo({}), '2026-11-03').ready, 'false');
  const o = prepare(repo({ 'sealed-editions/2026-11-03.sealed.json': ed('2026-11-03') }), '2026-11-03', keys().privateKey);
  assert.equal(o.ready, 'false');
  assert.match(o.reason, /cannot decrypt/);
});

test('prepare: without --delivery it behaves as before (skip file not consulted)', () => {
  const o = prepare(repo({ 'sealed-editions/2026-11-03.sealed.json': ed('2026-11-03') }), '2026-11-03', privateKey, false);
  assert.equal(o.ready, 'true');
});
