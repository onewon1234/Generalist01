/**
 * Heuristic subject classification for the preview (no AI). Keyword hits on
 * headlines and evidence pick a broad subject; ties fall back to the source's
 * registry subject. Sports results are flagged so they rank low.
 */
const KW: Record<string, RegExp> = {
  'world-politics-society': /대통령|국회|국정|선거|총선|대선|투표|정당|여당|야당|외교|정상회담|장관|총리|전쟁|휴전|공습|군사|시위|탄핵|법원|대법원|검찰|경찰|재판|구속|수사|기소|형사|검사|공소청|중수청|법안|법률|규제|위원회|난민|이재민|화재|재난|사고|참사|election|president|minister|parliament|war|strike|militant|protest|government|court|police|refugee|ceasefire|vote|poll|congress|senate|diplomat|sanction/i,
  'economics-finance-business': /성장률|gdp|경제|금리|환율|증시|주가|코스피|코스닥|수출|수입|물가|기업|인수|합병|m&a|실적|투자|부동산|집값|관세|예산|세금|은행|고용|실업|economy|economic|inflation|market|stock|shares|bank|budget|tax|trade|tariff|company|profit|loan|housing|mortgage|jobs|unemployment|investor/i,
  'science-technology-ai': /연구|과학|인공지능|ai\b|반도체|우주|위성|로켓|의학|백신|질병|바이러스|감염|에볼라|기후|탄소|발견|화석|유전자|뇌|신약|study|research|scientist|space|satellite|climate|species|fossil|cancer|brain|physics|vaccine|virus|disease|gene|dinosaur|telescope|quantum|biotech/i,
  'history-civilization-geography': /역사|유적|고대|조선|고려|발굴|문화재|기념일|history|historic|ancient|archaeolog|century|medieval|empire|war memorial/i,
  'philosophy-literature-arts-culture': /영화|드라마|음악|전시|문학|소설|예술|공연|콘서트|k팝|케이팝|작가|미술|다큐|film|movie|music|art\b|artist|novel|book|museum|culture|documentary|theatre|theater|poetry|philosoph/i,
  'psychology-behavior-everyday': /수면|심리학|행복감|식단|육아|외로움|습관|정신건강|mental|sleep|exercise|happiness|behaviou?r|habit|loneliness|wellbeing|relationship|parenting/i,
};
const SPORTS = /프로농구|프로야구|프로축구|k리그|kbo|kbl|챔피언스리그|월드컵|올림픽|전적|연패|연승|득점|홈런|선발 (?:투수|출전|등판)|(?<!예술|음악|영화|연출|미술)감독|리그|\bvs\b|premier league|champions league|world cup|olympic|match report|score[sd]?\b|\bnba\b|\bnfl\b|\bmlb\b/i;

export interface Classification { subject: string; sports: boolean; hits: Record<string, number> }

export function classify(texts: string[], fallback: string): Classification {
  const joined = texts.join(' \n ');
  const hits: Record<string, number> = {};
  for (const [s, re] of Object.entries(KW)) {
    const n = (joined.match(new RegExp(re.source, 'gi')) ?? []).length;
    if (n) hits[s] = n;
  }
  const best = Object.entries(hits).sort((a, b) => b[1] - a[1])[0];
  const sports = (joined.match(new RegExp(SPORTS.source, 'gi')) ?? []).length >= 2;
  return { subject: best ? best[0] : fallback, sports, hits };
}

export const SUBJECT_KO: Record<string, string> = {
  'world-politics-society': '세계·정치·사회',
  'economics-finance-business': '경제·금융·비즈니스',
  'science-technology-ai': '과학·기술·AI',
  'history-civilization-geography': '역사·문명·지리',
  'philosophy-literature-arts-culture': '철학·문학·예술·문화',
  'psychology-behavior-everyday': '심리·행동·일상',
};
