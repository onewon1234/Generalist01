/**
 * One story per event across languages. Title clustering works within a
 * language, so a Korean wire report and an English report of the same event
 * stay apart (r11: the Spanish train crash was selected twice, once from
 * Yonhap and once from The Guardian). After reading, two stories in different
 * languages are the same event when they name the same country and share a
 * casualty or people count in their read evidence. Conservative on purpose:
 * a missed merge is noted by the editor; a false merge hides a story. The
 * countries are foreign, so the international report is kept as the story.
 */
import type { PreviewStory } from './preview.ts';

const COUNTRIES: [RegExp, RegExp][] = ([
  ['스페인', 'spain|spanish'], ['프랑스', 'france|french'], ['독일', 'germany|german'], ['영국', 'britain|british|\\buk\\b|england'],
  ['이탈리아', 'italy|italian'], ['그리스', 'greece|greek'], ['벨기에', 'belgium|belgian'], ['폴란드', 'poland|polish'],
  ['우크라', 'ukrain'], ['러시아', 'russia'], ['튀르키예|터키', 'turkey|türkiye|turkish'], ['이스라엘', 'israel'], ['이란', '\\biran'],
  ['시리아', 'syria'], ['요르단', 'jordan'], ['레바논', 'lebanon'], ['가자', 'gaza'], ['사우디', 'saudi'], ['이집트', 'egypt'],
  ['수단', '\\bsudan'], ['남수단', 'south sudan'], ['나이지리아', 'nigeria'], ['콩고', 'congo'], ['케냐', 'kenya'], ['에티오피아', 'ethiopia'],
  ['인도(?!네시아)', '\\bindia'], ['파키스탄', 'pakistan'], ['방글라데시', 'bangladesh'], ['인도네시아|인니', 'indonesia'], ['필리핀', 'philippin'],
  ['베트남', 'vietnam'], ['태국', 'thailand|thai'], ['미얀마', 'myanmar|burma'], ['중국', 'china|chinese'], ['일본', 'japan'], ['대만', 'taiwan'],
  ['북한', 'north korea'], ['미국', '\\bus\\b|\\bu\\.s\\.|united states|america'], ['캐나다', 'canada'], ['멕시코', 'mexico'],
  ['브라질', 'brazil'], ['아르헨', 'argentin'], ['칠레', 'chile'], ['콜롬비아', 'colombia'], ['페루', '\\bperu'], ['베네수엘라', 'venezuela'],
  ['호주', 'australia'], ['뉴질랜드', 'new zealand'],
] as [string, string][]).map(([ko, en]) => [new RegExp(ko), new RegExp(en, 'i')]);

const PEOPLE = /^(\d+)(명|people|persons?|dead|killed|deaths?|injured|victims?)$/i;

function text(s: PreviewStory): string {
  return [s.title, ...s.records.flatMap((r) => [r.title ?? '', ...r.evidence.map((e) => e.text)])].join(' \n ');
}
function countries(s: PreviewStory): Set<number> {
  const t = text(s), out = new Set<number>();
  COUNTRIES.forEach(([ko, en], i) => { if (s.language === 'ko' ? ko.test(t) : en.test(t)) out.add(i); });
  return out;
}
function peopleCounts(s: PreviewStory): Set<string> {
  const figs = [...s.corroboration.corroboratedFigures.map((f) => f.figure), ...s.corroboration.singleSourceFigures.map((f) => f.figure),
    ...s.records.flatMap((r) => r.evidence.flatMap((e) => e.figures))];
  return new Set(figs.map((f) => f.replace(/\s+/g, '').match(PEOPLE)?.[1]).filter((n): n is string => !!n && Number(n) > 2));
}

/** Pairs [kept, duplicate] of stories in different languages that report the same event. */
export function crossLanguageDuplicates(stories: PreviewStory[]): [PreviewStory, PreviewStory][] {
  const out: [PreviewStory, PreviewStory][] = [];
  const gone = new Set<string>();
  const facts = new Map(stories.map((s) => [s.key, { c: countries(s), n: peopleCounts(s) }]));
  const ranked = [...stories].sort((a, b) => b.suitability - a.suitability);
  for (const a of ranked) {
    if (gone.has(a.key)) continue;
    for (const b of ranked) {
      if (b === a || gone.has(b.key) || b.language === a.language) continue;
      const fa = facts.get(a.key)!, fb = facts.get(b.key)!;
      const sameCountry = [...fa.c].some((x) => fb.c.has(x));
      const sharedCount = [...fa.n].some((x) => fb.n.has(x));
      if (!sameCountry || !sharedCount) continue;
      // A foreign event: keep the international report as the story (the writer still uses the Korean one).
      const [kept, dup] = a.language === 'ko' ? [b, a] : [a, b];
      out.push([kept, dup]); gone.add(dup.key);
      if (dup === a) break;
    }
  }
  return out;
}
