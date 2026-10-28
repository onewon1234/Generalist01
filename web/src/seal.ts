/**
 * Sealed editions: the daily editorial session writes the edition before it is
 * public, and this repository is public. The session encrypts the edition with
 * the committed public key (keys/edition-public.pem); only the publish workflow
 * holds the private key (GitHub secret EDITION_PRIVATE_KEY) and decrypts it at
 * publication time. RSA-OAEP-256 wraps a random AES-256-GCM key.
 *
 *   npx tsx src/seal.ts seal <edition.json> <out.sealed.json> [--pub keys/edition-public.pem]
 *   npx tsx src/seal.ts unseal <in.sealed.json> <out.json>   (key from $EDITION_PRIVATE_KEY)
 */
import { constants, createCipheriv, createDecipheriv, privateDecrypt, publicEncrypt, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Sealed { v: 1; alg: 'RSA-OAEP-256+A256GCM'; date: string; key: string; iv: string; tag: string; data: string }

export function seal(plain: string, publicKeyPem: string, date: string): Sealed {
  const k = randomBytes(32), iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', k, iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  const key = publicEncrypt({ key: publicKeyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, k);
  return { v: 1, alg: 'RSA-OAEP-256+A256GCM', date, key: key.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') };
}

export function unseal(s: Sealed, privateKeyPem: string): string {
  if (s.v !== 1 || s.alg !== 'RSA-OAEP-256+A256GCM') throw new Error('unknown sealed format');
  const k = privateDecrypt({ key: privateKeyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(s.key, 'base64'));
  const d = createDecipheriv('aes-256-gcm', k, Buffer.from(s.iv, 'base64'));
  d.setAuthTag(Buffer.from(s.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(s.data, 'base64')), d.final()]).toString('utf8');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, input, output] = process.argv.slice(2);
  const pubIdx = process.argv.indexOf('--pub');
  if (cmd === 'seal' && input && output) {
    const pub = readFileSync(pubIdx > 0 ? process.argv[pubIdx + 1] : join(import.meta.dirname, '..', '..', 'keys', 'edition-public.pem'), 'utf8');
    const plain = readFileSync(input, 'utf8');
    const date = (JSON.parse(plain) as { date: string }).date;
    writeFileSync(output, JSON.stringify(seal(plain, pub, date)) + '\n');
    console.log(`sealed edition ${date} → ${output}`);
  } else if (cmd === 'unseal' && input && output) {
    const key = process.env.EDITION_PRIVATE_KEY;
    if (!key) { console.error('EDITION_PRIVATE_KEY is not set'); process.exit(2); }
    writeFileSync(output, unseal(JSON.parse(readFileSync(input, 'utf8')), key));
    console.log(`unsealed ${input} → ${output}`);
  } else { console.error('usage: seal <edition.json> <out> | unseal <in> <out>'); process.exit(2); }
}
