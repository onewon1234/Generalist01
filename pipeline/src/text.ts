/** Small, dependency-free text and time helpers. */

/** Hours from `from` to `to` (positive when `to` is later). */
export function hoursBetween(from: string | Date, to: string | Date): number {
  const a = typeof from === 'string' ? Date.parse(from) : from.getTime();
  const b = typeof to === 'string' ? Date.parse(to) : to.getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) throw new RangeError(`invalid date: ${from} / ${to}`);
  return (b - a) / 3_600_000;
}

/** Lower-case word tokens (Hangul, Latin letters, digits), without very short Latin words. */
export function tokens(s: string): Set<string> {
  const out = new Set<string>();
  for (const m of s.toLowerCase().normalize('NFKC').matchAll(/[\p{Script=Hangul}]+|[a-z0-9]+/gu)) {
    const t = m[0];
    if (/^[a-z]+$/.test(t) && t.length < 3) continue;
    out.add(t);
  }
  return out;
}

/** Jaccard similarity of two strings' token sets (0–1). */
export function similarity(a: string, b: string): number {
  const x = tokens(a), y = tokens(b);
  if (!x.size || !y.size) return 0;
  let inter = 0;
  for (const t of x) if (y.has(t)) inter++;
  return inter / (x.size + y.size - inter);
}

/** URL normalised for identity comparison: lower-case host, no hash, no tracking params, no trailing slash. */
export function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$|cmpid)/i.test(k)) url.searchParams.delete(k);
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    const s = url.toString();
    return s.endsWith('/') ? s.slice(0, -1) : s;
  } catch {
    return u.trim();
  }
}
