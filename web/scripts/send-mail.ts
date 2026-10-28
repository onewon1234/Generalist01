/**
 * send-mail: send the daily email (or a failure alert) through Gmail SMTP.
 *   npx tsx scripts/send-mail.ts edition <edition.json> --base <site url> [--test]
 *   npx tsx scripts/send-mail.ts alert "<subject>" "<body>"
 *   npx tsx scripts/send-mail.ts preview <edition.json> --base <url> --out mail.html   (no sending)
 * Credentials come only from the environment (GitHub secrets): GMAIL_USER,
 * GMAIL_APP_PASSWORD, NEWSLETTER_TO. Nothing is logged except the subject and
 * the SMTP response id.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import nodemailer from 'nodemailer';
import { renderEmail } from '../src/email.ts';
import type { Edition } from '../src/types.ts';

const [mode, a1, a2] = process.argv.slice(2);
const flag = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };

async function send(subject: string, html: string | undefined, text: string) {
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD, to = process.env.NEWSLETTER_TO;
  if (!user || !pass || !to) throw new Error('GMAIL_USER, GMAIL_APP_PASSWORD and NEWSLETTER_TO must be set');
  const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass } });
  const info = await t.sendMail({ from: { name: 'Generalist Daily', address: user }, to, subject, html, text });
  console.log(`sent "${subject}" (${info.messageId}; accepted ${info.accepted.length}, rejected ${info.rejected.length})`);
  if (info.rejected.length) process.exit(1);
}

if (mode === 'edition' || mode === 'preview') {
  const e = JSON.parse(readFileSync(a1, 'utf8')) as Edition;
  const base = flag('--base');
  if (!base) { console.error('--base is required'); process.exit(2); }
  const m = renderEmail(e, base, { test: process.argv.includes('--test') });
  if (mode === 'preview') { writeFileSync(flag('--out') ?? 'mail.html', m.html); console.log(`preview: ${m.subject}`); }
  else await send(m.subject, m.html, m.text);
} else if (mode === 'alert' && a1) {
  await send(a1, undefined, a2 ?? a1);
} else { console.error('usage: send-mail edition|preview|alert …'); process.exit(2); }
