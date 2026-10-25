import { FRESHNESS } from './config.ts';
import { hoursBetween } from './text.ts';
import type { Article } from './types.ts';

export interface FreshnessResult {
  ok: boolean;
  /** Hours since the article's publication (or update, if later). */
  ageHours: number | null;
  /** The article reports an event much older than its publication date. */
  background: boolean;
  reason?: string;
}

/** Latest of publishedAt / updatedAt, as the moment the source last spoke. */
export function sourceTime(a: Article): string | null {
  const ts = [a.publishedAt, a.updatedAt].filter((t): t is string => !!t && !Number.isNaN(Date.parse(t)));
  return ts.length ? ts.sort().at(-1)! : null;
}

/**
 * Freshness signal for a timely story's primary article.
 * Default window 48h, extended to 72h for major developments. Undated or
 * future-dated articles fail. An article describing an event far older than
 * its publication date is flagged as background (never presented as new).
 */
export function checkFreshness(a: Article, now: Date, isMajor: boolean): FreshnessResult {
  const t = sourceTime(a);
  if (!t) return { ok: false, ageHours: null, background: false, reason: 'undated source' };
  const age = hoursBetween(t, now);
  if (age < -FRESHNESS.futureSkewHours) return { ok: false, ageHours: age, background: false, reason: 'publication date is in the future' };
  const limit = isMajor ? FRESHNESS.majorMaxHours : FRESHNESS.defaultMaxHours;
  let background = false;
  if (a.eventDate && a.publishedAt) {
    const lagDays = hoursBetween(`${a.eventDate}T00:00:00Z`, a.publishedAt) / 24;
    background = lagDays > FRESHNESS.backgroundEventLagDays;
  }
  if (age > limit) {
    return { ok: false, ageHours: age, background, reason: `${Math.round(age)}h old (limit ${limit}h${isMajor ? ', major' : ''})` };
  }
  return { ok: true, ageHours: Math.max(0, age), background };
}
