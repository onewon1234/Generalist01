import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { seal, unseal } from '../src/seal.ts';

test('seal/unseal: round trip, tamper detection, wrong key fails', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const other = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const plain = JSON.stringify({ date: '2026-10-29', stories: [{ headline: '한글 제목' }] });
  const s = seal(plain, publicKey, '2026-10-29');
  assert.ok(!s.data.includes('한글') && !Buffer.from(s.data, 'base64').toString().includes('한글'), 'ciphertext only');
  assert.equal(unseal(s, privateKey), plain);
  assert.throws(() => unseal({ ...s, data: Buffer.from('x' + s.data).toString('base64') }, privateKey));
  assert.throws(() => unseal(s, other.privateKey));
});
