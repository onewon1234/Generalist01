/**
 * robots.txt per RFC 9309.
 * - The group for our product token wins over "*"; rules of all matching
 *   groups with the same most-specific agent are combined.
 * - Longest matching path wins; on a tie, allow wins. "*" and "$" supported.
 * - 4xx (incl. 404) when fetching robots.txt → no restrictions.
 *   5xx / network failure → treat the whole site as disallowed.
 */
import type { Fetcher } from '../collect/http.ts';

export const ROBOTS_TOKEN = 'generalistdailybot';

interface Rule { allow: boolean; path: string }
interface Group { agents: string[]; rules: Rule[] }
export interface RobotsRules { groups: Group[] }

export function parseRobots(text: string): RobotsRules {
  const groups: Group[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if ((key === 'allow' || key === 'disallow') && cur) {
      lastWasAgent = false;
      if (key === 'disallow' && val === '') continue; // empty Disallow = allow all
      cur.rules.push({ allow: key === 'allow', path: val });
    } else {
      lastWasAgent = false;
    }
  }
  return { groups };
}

function toRegex(path: string): RegExp {
  const anchored = path.endsWith('$');
  const body = (anchored ? path.slice(0, -1) : path)
    .split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp('^' + body + (anchored ? '$' : ''));
}

/** Decide for a path (+query) on a host whose rules are given. */
export function isAllowed(rules: RobotsRules, pathAndQuery: string, token = ROBOTS_TOKEN): boolean {
  const named = rules.groups.filter((g) => g.agents.some((a) => a !== '*' && token.includes(a)));
  const applicable = named.length ? named : rules.groups.filter((g) => g.agents.includes('*'));
  let best: Rule | null = null;
  for (const r of applicable.flatMap((g) => g.rules)) {
    if (!toRegex(r.path).test(pathAndQuery)) continue;
    const len = r.path.replace(/\$$/, '').length;
    const bestLen = best ? best.path.replace(/\$$/, '').length : -1;
    if (len > bestLen || (len === bestLen && r.allow && !best!.allow)) best = r;
  }
  return best ? best.allow : true;
}

export type RobotsState = 'allowed' | 'disallowed' | 'no-robots' | 'unreachable';

export class RobotsCache {
  private cache = new Map<string, Promise<{ state: 'ok' | 'none' | 'unreachable'; rules: RobotsRules }>>();
  constructor(private fetcher: Fetcher) {}

  private load(origin: string) {
    let p = this.cache.get(origin);
    if (!p) {
      p = (async () => {
        const r = await this.fetcher(`${origin}/robots.txt`, { timeoutMs: 10_000, headers: { accept: 'text/plain, */*;q=0.5' } });
        if (r.status >= 200 && r.status < 300) return { state: 'ok' as const, rules: parseRobots(r.body) };
        if (r.status >= 400 && r.status < 500) return { state: 'none' as const, rules: { groups: [] } };
        return { state: 'unreachable' as const, rules: { groups: [] } };
      })();
      this.cache.set(origin, p);
    }
    return p;
  }

  async check(url: string): Promise<RobotsState> {
    let u: URL;
    try { u = new URL(url); } catch { return 'unreachable'; }
    const r = await this.load(u.origin);
    if (r.state === 'unreachable') return 'unreachable';
    if (r.state === 'none') return 'no-robots';
    return isAllowed(r.rules, u.pathname + u.search) ? 'allowed' : 'disallowed';
  }
}
