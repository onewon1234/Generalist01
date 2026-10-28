/**
 * prepare: decrypt every sealed edition, mark them published, validate and
 * build the whole site. Used by .github/workflows/publish.yml.
 *   npx tsx scripts/prepare.ts --date YYYY-MM-DD --sealed ../sealed-editions --work <dir> --site <dir>
 * Prints key=value lines for $GITHUB_OUTPUT: ready=true|false, reason=…,
 * edition=<path of the decrypted target edition>. A missing or invalid edition
 * for the target date is never replaced by an older one.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { unseal } from '../src/seal.ts';
import { buildSite } from '../src/site.ts';
import type { Edition } from '../src/types.ts';

const flag = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const date = flag('--date')!, sealedDir = flag('--sealed')!, work = flag('--work')!, site = flag('--site')!;
const out = (k: string, v: string) => console.log(`${k}=${v.replace(/\n/g, ' ')}`);

function fail(reason: string): never { out('ready', 'false'); out('reason', reason); process.exit(0); }

const key = process.env.EDITION_PRIVATE_KEY;
if (!key) fail('EDITION_PRIVATE_KEY secret is not set');
if (!existsSync(join(sealedDir, `${date}.sealed.json`))) fail(`no edition for ${date}`);
mkdirSync(work, { recursive: true });
const editions: Edition[] = [];
for (const f of readdirSync(sealedDir).filter((x) => /^\d{4}-\d{2}-\d{2}\.sealed\.json$/.test(x)).sort()) {
  const d = f.slice(0, 10);
  if (d > date) continue;
  let e: Edition;
  try { e = JSON.parse(unseal(JSON.parse(readFileSync(join(sealedDir, f), 'utf8')), key)) as Edition; }
  catch (err) { if (d === date) fail(`cannot decrypt the ${date} edition: ${(err as Error).message}`); console.error(`skipping ${f}: cannot decrypt`); continue; }
  if (e.date !== d) { if (d === date) fail(`sealed file ${f} holds edition ${e.date}`); continue; }
  e.status = 'published';
  writeFileSync(join(work, `${d}.json`), JSON.stringify(e));
  editions.push(e);
}
const target = editions.find((e) => e.date === date);
if (!target) fail(`no edition for ${date}`);
if (target.stories.length < 5) fail(`only ${target.stories.length} main stories (5–7 needed); not publishing a thin edition`);
const problems = buildSite(editions, site);
if (problems.length) fail(`validation failed: ${problems.slice(0, 5).join('; ')}`);
out('ready', 'true');
out('edition', join(work, `${date}.json`));
out('slugs', target.stories.map((s) => s.slug).join(' '));
out('reason', `built ${editions.length} edition(s)`);
