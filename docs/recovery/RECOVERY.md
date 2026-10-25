# Generalist Daily 복구 보고서 (2026-10-26)

## 1. 결론

- **이전 작업 공간의 프로젝트 폴더(`/home/claude/generalist-daily`)는 통째로 사라졌다.** 사고 뒤 컨테이너가 교체되었고, 새 컨테이너에는 프로젝트 폴더도 `.git`도 없다. `/old_root`는 비어 있다.
- **GitHub에는 이 프로젝트가 한 번도 올라간 적이 없다.** 이 세션에는 GitHub 계정이 연결되어 있지 않고(`list_repos`: "no GitHub account linked"), 이전 작업에서도 저장소 생성은 승인 대기 항목이었다. 따라서 "마지막 정상 커밋"이 존재하지 않아, 그것을 기준으로 한 비교와 복원은 할 수 없다.
- **Supabase 프로젝트와 데이터는 온전하다.** 스키마 3개 마이그레이션, 에디션 No.1, 참고 데이터 360건이 그대로 있다. 이번 복구 작업에서 Supabase에는 읽기 쿼리만 실행했다.
- 남아 있던 대화 기록과 Supabase에서 아래 파일들을 **원본 그대로(바이트 단위)** 추출해 이 백업에 담았다.

## 2. 복구한 파일 (`recovered/`)

| 파일 | 출처 | 상태 |
|---|---|---|
| `CLAUDE.md` | 대화 기록에 남은 프로젝트 지침 전문 | 원본. 사고 시점 버전(2단계 기준, 3단계 플레이북 반영 전) |
| `pipeline/src/select.ts` | 대화 기록에 남은 Read 결과 전문 | 원본. 3단계 신규 선정 로직(3–4/1–2/0–1 구성, AI 상한, 신선도 보너스) |
| `supabase/migrations/20261025105202_newsletter_core_schema.sql` | Supabase `schema_migrations` | 실제 적용된 SQL 원문 |
| `supabase/migrations/20261025130401_website_first_editions.sql` | 같음 | 같음 |
| `supabase/migrations/20261025135513_reference_intelligence.sql` | 같음 | 같음 |
| `references/sql/items_3.sql`, `items_4.sql`, `items_5.sql` | 대화 기록 | 생성 스크립트 출력 원본 |
| `references/sql/applied_01~03.sql` | 대화 기록 | 실제 DB에 실행한 버전(주제 분류 수정 반영) |
| `references/sql/applied_04~06.sql` | 대화 기록 | 확인 쿼리 2개 + 미적용 업데이트 1개(아래 4절) |
| `db-export/edition-and-core-tables.json` | Supabase 읽기 전용 내보내기 | 에디션 No.1 전체(본문 6개, 출처 9, 용어 9, 링크 검사 18, 편집 로그), sources 12, subjects 13 |
| `db-export/reference-tables.json` | Supabase 읽기 전용 내보내기 | reference_sources 36, reference_items 360(분석 메모 34) |
| `notes/previous-session-summary.md` | 대화 압축 요약 | 설계 결정, 설정값, 파일 구조를 서술한 문서(코드 아님) |

## 3. 유실된 변경 사항

아래 파일은 이전 컨테이너에만 있었다. 어디에도 사본이 없어 **원본을 복구할 수 없다.** 3단계(참고 자료 기반 편집 체계) 작업 중이었고, 1~2단계 파일도 함께 사라졌다.

**코드**
- `pipeline/`: `package.json`, `tsconfig.json`, `src/`의 `types.ts`, `config.ts`, `stages.ts`, `dryrun.ts`, `freshness.ts`, `cluster.ts`, `text.ts`, `import-edition.ts`, `ai/prompts.ts`, `store/supabase.ts`, 수집기 등 `select.ts` 외 전부
- `pipeline/fixtures/dry-run.json`, `pipeline/test/*.test.ts`(사고 전 24개 통과)
- `web/`: Astro 사이트 전체(홈 bento grid, 기사, 아카이브, 주제, 소개 페이지, 스타일)
- `.github/workflows/`: `ci`, `daily-draft`, `publish`, `check-sources`
- `README.md`

**Supabase 보조 파일**
- `supabase/rollbacks/*.down.sql` 3개: 원문 유실. 마이그레이션 원문에서 다시 작성할 수 있다.
- `supabase/pending/20261025150000_public_read_published.sql`: 미적용 보안 마이그레이션(published 전용 공개 읽기 정책). 원문 유실.
- `supabase/seed/sources.sql`: 원문은 유실됐지만 데이터는 DB에 있다(sources 12건).

**편집·참고 자료**
- `editorial/AUDIT.md`, `editorial/PLAYBOOK.md`: 원문 유실. 핵심 내용(12개 원칙, 수치)은 `notes/previous-session-summary.md`에 요약으로만 남아 있다.
- `editions/2026-10-25.json`: 파일은 유실됐지만 같은 내용이 DB에 있다(`db-export`).
- `references/registry.json`, `raw/wave1~3.tsv`, `records.jsonl`, `analysis/stats.json`, `analysis/deep_reads.json`, `subject_overrides.json`: 원문은 유실됐다. 담겨 있던 데이터(출처 36, 항목 360, 주제 분류, 분석 메모)는 DB 내보내기에 있어 다시 만들 수 있다.
- `references/analyze.py`, `references/to_sql.py`: 유실.
- 임시 SQL `sources.sql`, `items_1.sql`, `items_2.sql`: 원본 파일은 유실. `items_2`는 실행본(`applied_01.sql`)이 남아 있고, 나머지는 데이터가 DB에 있다.

## 4. Supabase 데이터 상태 (읽기 전용 확인, 2026-10-26)

- 프로젝트 `luogxbqimauqzoasgesj`(무료 플랜). 모든 테이블에 RLS가 켜져 있고 공개 정책은 없다.
- 마이그레이션 3개 적용. 미적용 보안 마이그레이션은 적용되지 않은 상태 그대로다.
- `issues` 1건(No.1, `in_review`, **미발행**), `issue_items` 6, `item_sources` 9, `glossary_terms` 9, `item_terms` 9, `articles` 9, `link_checks` 18, `editorial_log` 1, `sources` 12(전부 비활성), `subjects` 13
- `reference_sources` 36, `reference_items` 360(중복 없음, id 1–360)
- 분석 메모 34건: 본문 분석 8/9, 제목 분석 26/27
  - 빠진 1건은 Quanta "AI Proved the Quasi-Riemann Hypothesis"(id 62)의 본문 분석이다. 마지막 업데이트 직전에 서버 확인 질문이 시간 초과되어 적용되지 않았다. 주제는 이미 `mathematics`로 맞다. 적용할 SQL은 `references/sql/applied_06.sql`에 있다(요청대로 실행하지 않음).
  - 빠진 제목 분석 1건은 어떤 항목인지 알 수 없다. 해당 원본 SQL(`items_1.sql`)이 남아 있지 않기 때문이다.
- `pipeline_runs`, `story_clusters`, `ai_summaries`는 0건이다(정상: 자동 파이프라인은 아직 실행된 적이 없음).

## 5. 사고 원인 분석

실행한 명령(요지):

```
cd …/references && sed -i … analysis/deep_reads.json && S=…; rm -f $S/*
```

1. `a && b && S=…` 체인에서 `sed`가 실패하자 체인이 멈추면서 `S`가 할당되지 않았다.
2. 그런데 그 뒤의 구분자가 `;`여서, 앞 단계가 실패해도 `rm -f $S/*`는 그대로 실행됐다.
3. `$S`에 따옴표가 없고 빈 값을 막는 장치(`set -u` 또는 `${S:?}`)도 없어서, 명령이 `rm -f /*`로 펼쳐졌다.
4. `-r`이 없어 디렉터리는 지워지지 않았다. 대신 루트의 심볼릭 링크(`/bin`, `/lib`, `/lib64`, `/sbin`)가 삭제됐고, 그때부터 셸과 git, node, python이 실행되지 않았다.
5. 그 상태로 작업 공간이 비활성화되었다가 컨테이너가 교체되면서, 커밋도 외부 백업도 없던 프로젝트 파일이 함께 사라졌다. **실질적인 손실 원인은 원격 저장소와 외부 백업이 없었던 것이다.**

## 6. 재발 방지 장치 (이 백업에 포함, 테스트 완료)

- `.claude/hooks/guard_rm.py` + `.claude/settings.json`: Claude Code가 Bash 명령을 실행하기 전에 검사해 다음을 차단한다(exit 2).
  - 삭제 명령(`rm`, `rmdir`, `unlink`, `shred`, `find -delete`)의 인자에 변수나 명령 치환이 들어간 경우. 비어 있으면 실패하는 `${VAR:?}` 형식만 허용한다.
  - 대상이 `/`, 최상위 디렉터리, 홈 디렉터리이거나 `/*`, `~/*` 같은 글롭인 경우
  - `--no-preserve-root`
  - `&&` 체인 뒤에 `;`로 이어 붙인 삭제(이번 사고 패턴)
  - `eval` 또는 `bash -c` 안에서 변수를 쓰는 `rm`
- `scripts/safe-rm.sh`: `SAFE_RM_ROOT` 안쪽 경로만 삭제한다. 빈 인자, `/`, 최상위 디렉터리, 홈, 루트 자체, 바깥 경로, `..` 탈출은 거부한다. 모든 인자를 먼저 검사한 뒤 하나라도 문제가 있으면 아무것도 지우지 않는다.
- 테스트 결과
  - `scripts/test/test_guard_rm.py`: 차단 20개(사고 명령 포함), 허용 8개, 훅 입출력 규약 3개 검사 모두 통과
  - `scripts/test/test_safe_rm.sh`: 14개 검사 모두 통과
- 프로젝트 규칙으로 `CLAUDE.md`에 넣을 문구(제안):
  - 삭제는 `scripts/safe-rm.sh` 또는 `${VAR:?}`만 사용한다.
  - 삭제를 `;`로 이어 붙이지 않는다.
  - 작업 단위마다 커밋하고 원격 저장소에 push한다.
  - 원격 저장소가 없을 때는 큰 변경 직후 외부 백업을 남긴다.

## 7. 실행할 수 없었던 단계와 이유

| 요청 | 결과 | 이유 |
|---|---|---|
| 1. GitHub 마지막 정상 커밋과 비교 | 불가 | GitHub 저장소와 커밋이 존재하지 않음. 로컬 `.git`도 이전 컨테이너와 함께 사라짐 |
| 2. 변경 파일 백업 | 부분 완료 | 남아 있는 것은 모두 백업함(2절). 나머지는 사본이 없음(3절) |
| 5. 타입 검사·테스트·빌드 | 불가 | `package.json`, `tsconfig`, 테스트, 대부분의 소스, `web/`이 유실되어 실행할 코드가 없음. 대신 안전장치 테스트는 실행함 |
| 6. 브랜치 커밋 + Draft PR | 보류 | GitHub 계정이 연결되지 않았고 대상 저장소가 없음. 저장소 생성은 사용자 승인이 필요한 작업 |

## 8. 복구 계획 (승인 요청)

1. **GitHub 연결과 저장소 생성(사용자 승인 필요)**: claude.ai 설정에서 GitHub을 연결하고 private 저장소(예: `generalist-daily`)를 지정 또는 생성한다. `main`에는 이 백업(복구된 원본 + 안전장치)만 첫 커밋으로 올린다. 이후 모든 작업은 브랜치와 Draft PR로 진행한다.
2. **재구성(승인 후)**: 유실된 코드는 원본이 아니라 다시 작성해야 한다. 근거는 세 가지다. 남은 `select.ts`·`CLAUDE.md`·마이그레이션 원문, DB 데이터, 그리고 `notes/previous-session-summary.md`에 기록된 설계와 설정값이다. 재구성한 코드는 별도 브랜치에서 타입 검사, 테스트, 빌드를 통과한 뒤 Draft PR로 검토받는다.
3. Supabase는 계속 읽기 전용으로 둔다. Quanta 분석 메모 1건 반영(`applied_06.sql`)과 보안 마이그레이션 재작성은 별도 승인 후 진행한다.
