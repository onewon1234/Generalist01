/**
 * Render the editorial preview as Korean Markdown for private review.
 * Evidence snippets are quoted in their original language (translation and
 * article writing need the AI stages, which are not enabled).
 */
import { broadOf } from '../config.ts';
import type { RetrievalRecord } from '../research/retrieve.ts';
import { MOD_LABEL } from './briefs.ts';
import { SUBJECT_KO } from './classify.ts';
import type { Preview, PreviewStory } from './preview.ts';

const KST = (iso: string | null) => (iso ? new Date(Date.parse(iso) + 9 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ') + ' KST' : '시각 미상');
const STATUS: Record<string, string> = {
  read: '✅ 원문 확인', partial: '⚠️ 본문 부족(미확인)', paywalled: '🔒 유료(미확인)', restricted: '⛔ 게시자 이용 제한(미사용)',
  'blocked-robots': '⛔ robots.txt 차단(미요청)', 'robots-unreachable': '⛔ robots.txt 확인 불가(미요청)', 'http-error': '❌ HTTP 오류',
  'network-error': '❌ 접속 실패', 'not-html': '❌ 문서 형식 아님',
};
const BUCKET: Record<string, string> = { timely: '시의성', discovery: '발견', reflection: '성찰', fill: '보충' };

function sourceLine(r: RetrievalRecord, i: number): string {
  const when = r.pagePublishedAt ?? r.feedPublishedAt;
  return `${i + 1}. ${r.publisher} — ${r.title ?? '(제목 미상)'} · 게시 ${KST(when)} · ${STATUS[r.status] ?? r.status}${r.httpStatus ? ` (HTTP ${r.httpStatus})` : ''}\n   <${r.url}>`;
}

function story(s: PreviewStory, n: number): string {
  const out: string[] = [];
  out.push(`### ${n}. ${s.title}`);
  out.push(`분야: ${SUBJECT_KO[broadOf(s.subject)] ?? s.subject}${s.bucket ? ` · 구분: ${BUCKET[s.bucket] ?? s.bucket}` : ''}${s.cardSize ? ` · 카드: ${s.cardSize}` : ''}`);
  out.push('', '**선정 근거**', ...s.reasoning.map((r) => `- ${r}`));
  const idx = new Map(s.records.map((r, i) => [r, i + 1]));
  const ev = s.records.filter((r) => r.status === 'read').flatMap((r) => r.evidence.map((e) => ({ e, i: idx.get(r)! })));
  out.push('', '**원문에서 확인한 근거** (짧은 인용, 원문 언어 그대로)');
  if (ev.length) for (const { e, i } of ev.slice(0, 8)) out.push(`- [${i}] (${e.kind}) “${e.text}”`);
  else out.push('- 원문을 읽지 못해 근거가 없습니다. 이 기사는 검증되지 않았습니다.');
  out.push('', '**출처와 접근 상태**', ...s.records.map(sourceLine));
  return out.join('\n');
}

export function renderPreview(p: Preview): string {
  const sel = p.stories.filter((s) => s.selected);
  const rest = p.stories.filter((s) => !s.selected);
  const readTotal = p.stories.reduce((t, s) => t + s.records.filter((r) => r.status === 'read').length, 0);
  const byStatus = new Map<string, number>();
  for (const s of p.stories) for (const r of s.records) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
  const subjects = [...new Set(sel.map((s) => SUBJECT_KO[broadOf(s.subject)] ?? s.subject))];
  return [
    `# Generalist Daily 편집 미리보기 (비공개 검토용)`,
    '',
    `생성 ${KST(p.generatedAt)} · 자동 파이프라인 결과 · **발행본 아님**`,
    '',
    '> 이 문서는 자동 수집·원문 확인·근거 추출·규칙 기반 선정의 결과입니다. AI 편집 평가와 한국어 원고 작성은 아직 켜지 않았으므로,',
    '> 점수는 투명한 규칙 기반 추정치이고 근거 인용은 원문 언어 그대로입니다. "원문 확인"이 아닌 출처는 검증에 쓰지 않았습니다.',
    '',
    '## 요약',
    `- 수집: 출처 ${p.ingest.sourcesOk}/${p.ingest.sources}곳 정상, 기사 ${p.ingest.collected}건 → 신선 ${p.ingest.fresh}건 → 이야기 묶음 ${p.ingest.clusters}개`,
    `- 조사: 후보 ${p.pool}개, 원문 요청 ${p.fetches}건, 원문 확인 ${readTotal}건 (${[...byStatus].map(([k, v]) => `${STATUS[k]?.replace(/^\S+\s/, '') ?? k} ${v}`).join(', ')})`,
    `- 선정: ${sel.length}편 · 분야 ${subjects.join(', ')}`,
    ...(p.warnings.length ? [`- 선정 메모: ${p.warnings.join(' / ')}`] : []),
    '',
    '## 선정된 이야기',
    '',
    ...sel.map((s, i) => story(s, i + 1) + '\n'),
    '## 짧게 보는 세상 (후보)',
    '',
    '> 메인에 들지 않은 소식 중 원문이 확인된 것입니다. 한 문장 원고는 작성 단계에서 쓰고 `validateBrief`로 검사합니다.',
    '> 원문 문장의 확실성 표시(사실·발표·의혹·예정·전망·가능성)는 문장에서 유지해야 합니다.',
    '',
    ...(p.briefs.length ? p.briefs.map((b, i) => `${i + 1}. **${b.title}** · ${SUBJECT_KO[broadOf(b.subject)] ?? b.subject} · 확실성: ${b.modality.map((m) => MOD_LABEL[m]).join('/')} · ${b.reason}\n   원문(${b.sourcePublisher}): “${b.sourceSentence}”\n   <${b.links[0]}>`) : ['- 후보 없음']),
    '',
    ...(p.briefsExcluded.length ? ['제외: ' + p.briefsExcluded.map((x) => `${x.title} (${x.reason})`).join(' · '), ''] : []),
    '## 선정되지 않은 후보',
    '',
    ...rest.map((s) => `- ${s.title} — ${s.rejectReason} · 원문 확인 ${s.corroboration.readPublishers.length}/${s.records.length}`),
    '',
    '## 한계',
    '- 점수와 분야 분류는 규칙 기반 추정입니다. 편집 판단(각도, 독자에게 주는 의미)과 한국어 원고는 AI 단계 승인 후 생성됩니다.',
    '- 영어 기사의 근거는 번역하지 않았습니다.',
    '- 게시자의 이용 약관 전체를 자동으로 판단할 수는 없습니다. robots.txt, noai/TDM 표시, 유료 표시를 지켰고 저장은 짧은 인용만 했습니다.',
  ].join('\n');
}
