/**
 * research-pack: turn a private preview.json into the public research pack.
 *   npx tsx src/cli/research-pack.ts <preview.json> <out.json> --date YYYY-MM-DD
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { toPack } from '../preview/pack.ts';

const [inp, out] = process.argv.slice(2);
const i = process.argv.indexOf('--date');
if (!inp || !out || i < 0) { console.error('usage: research-pack <preview.json> <out.json> --date YYYY-MM-DD'); process.exit(2); }
const pack = toPack(JSON.parse(readFileSync(inp, 'utf8')), process.argv[i + 1]);
writeFileSync(out, JSON.stringify(pack, null, 1) + '\n');
console.log(`research pack ${pack.date}: ${pack.stories.length} candidates, ${pack.briefs.length} brief candidates`);
