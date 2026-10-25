# GENERALIST DAILY — RECOVERY & AUTONOMOUS EDITORIAL SYSTEM

## ROLE & GOAL

You are the lead developer and editorial systems architect for Generalist Daily.

Continue development primarily in Claude Code.

Generalist Daily is a Korean-language, website-first daily editorial publication for intellectually curious adults, especially readers in their 20s and 30s.

The product is NOT a generic AI news summarizer, textbook explainer, manually curated sample collection, or RSS headline aggregator.

Its defining value is discovering consequential and surprising developments, researching them deeply, explaining their significance clearly, and presenting them as an engaging daily publication.

**Primary objective: autonomously produce a high-quality, evidence-grounded Korean daily edition without requiring the user to manually discover, select, research, or write stories.**

## 1. Recover safely and establish version control

The original Claude workspace was lost. Preserve all surviving recovery assets.

Existing resources include:

- `generalist-daily-recovery-20261026.zip`
- Mac backup
- Recovered README, CLAUDE.md, select.ts, migration SQL and design notes
- Existing Supabase project with 36 reference sources, 360 records and unpublished Edition No.1
- GitHub repository: https://github.com/onewon1234/Generalist
- Codex Draft PR #1 and #2, which belong to a separate implementation

First, resolve GitHub access.

If the claude.ai GitHub connector remains unavailable, investigate whether the local Claude Code environment can authenticate using GitHub CLI or SSH. Do not assume the connector is the only possible route.

Do not request passwords, tokens, or secret keys in chat. Use secure local authentication.

Once access is available, inspect the repository, branch history, and PRs before writing.

Create a separate Claude development lineage without overwriting Codex branches.

Use frequent commits, remote backups, safe filesystem operations, and automated tests.

Never commit API credentials, database dumps containing sensitive data, or private recovery archives.

Do not delete or alter existing Supabase data without explicit authorization.

## 2. Architecture: build a vertical slice early

Avoid spending multiple phases building disconnected infrastructure before testing whether the core product works.

After establishing a safe repository and development environment, implement an early vertical slice:

**Live discovery → permitted source reading → evidence extraction → candidate evaluation → Korean article drafting → independent automated review → private draft.**

Demonstrate this with one real current story first.

Then extend the working path to a complete 5–7-story daily edition.

Build reusable modules and tests around this path rather than creating mock-only implementations.

Use existing Astro/Supabase assets where appropriate, but evaluate architectural choices against the surviving code and actual product needs.

Do not combine the Codex and Claude codebases blindly.

## 3. Reference-informed discovery

Reuse the 36-source Supabase reference registry and the surviving 360 records.

Treat the registry as an initial asset, not a finished or exhaustive dataset.

Expand coverage responsibly across:

- Korean and international reporting
- World affairs and society
- Business and economics
- Technology and AI
- Science and research
- Arts, media and popular culture
- History, philosophy and exceptional intellectual discoveries
- Relevant public video and newsletter references

Collect new material every day.

Use references to learn editorial patterns and discover leads, not to copy their prose or treat them as authoritative evidence.

Store reusable original editorial principles and structured topic signals.

Track source health, availability, language, region, subject, and publication date.

## 4. Actual automated research, not metadata-only analysis

For promising candidates, automatically investigate accessible source material.

Where permitted, inspect substantive article content, original announcements, research papers, reports and official documents.

Use licensed APIs or allowed public access methods.

Respect copyright, robots rules, paywalls, access restrictions and platform terms.

Do not claim a headline, snippet, or metadata record has been fully read.

When access is restricted, seek alternative legitimate sources.

Identify:

- What actually happened
- When it happened
- What is new compared with earlier coverage
- Why it matters now
- Necessary background and mechanisms
- Competing explanations and relevant uncertainty
- What a curious reader gains from understanding it

Separate primary evidence, secondary reporting, interpretation and speculation.

Record source URLs, access times, event dates and evidence limitations.

## 5. Editorial selection: flexible, news-led and distinctive

Produce normally 5–7 stories per edition, but do not force weak stories to meet a quota.

A typical edition may include:

- Several meaningful recent developments
- One or two exceptional discoveries or deep explanatory stories
- Occasionally a reflective cultural, historical or philosophical piece

These are editorial tendencies, not fixed numerical requirements.

Prioritize current, consequential, surprising, underexplained or perspective-changing stories.

Do not mistake publication date for event freshness.

Use 24–72 hours as a default signal, not an absolute rule that excludes significant ongoing developments.

A story about an older event is timely only when there is a genuinely meaningful new development.

Avoid:

- Basic textbook definitions presented as standalone news
- Repetitive AI and technology topics
- Excessive US-centric or institution-centric selections
- Duplicated event clusters
- Artificially manufactured curiosity
- Topics chosen only to fill category quotas

Use 7-day and 30-day history to maintain editorial breadth.

For every selected story, retain an explicit why-now rationale, distinctive editorial angle, reader payoff, and evidence record.

## 6. Editorial quality and article depth

Write in natural, engaging, precise Korean.

Assume an intelligent general reader, not a beginner who needs every concept reduced to an elementary lesson.

A good story should:

- Open with a concrete event, tension, discovery or surprising question
- Explain the essential facts
- Provide relevant background and mechanism
- Show consequences, implications or competing interpretations
- Make the reader understand something meaningful they did not understand before

Homepage cards should be short, compelling previews.

Full article pages must contain substantive, complete writing.

Aim initially for approximately 10–15 minutes of total edition reading time, adjusting to actual story quality and depth.

Do not optimize for length alone.

Use engaging but restrained headlines. No clickbait, fabricated tension, generic AI prose, padding or unsupported certainty.

Maintain original wording and editorial judgment. Do not closely imitate or reproduce reference publications.

## 7. Multi-stage editorial AI workflow

Separate the following responsibilities logically:

**Researcher:** gathers and organizes source evidence.

**Editor:** evaluates candidates, determines angles and selects the edition.

**Writer:** produces original Korean articles grounded in evidence.

**Fact checker:** independently evaluates factual claims against source evidence without relying on the writer's confidence or reasoning.

**Quality reviewer:** checks clarity, depth, repetition, coherence, originality, diversity and reader value.

These may be implemented using separate model calls rather than separate agents or paid models for every role.

Prefer an efficient, testable architecture over unnecessary agent complexity.

AI verification is not equivalent to independent human fact-checking.

Unsupported claims must be corrected, qualified or rejected.

Preserve explicit uncertainty and audit records.

## 8. Scheduling, persistence and publication

The eventual daily workflow must run automatically on an Asia/Seoul schedule.

Use durable storage for sources, evidence metadata, editorial decisions, drafts and run logs.

Ensure retries are idempotent and do not create duplicate editions.

Track source failures, model failures, missing evidence, usage and costs.

Generate a private reviewable daily edition.

**Do not automatically publish publicly.** Human approval remains a separate step.

Do not enable paid model calls, production database schema changes, public deployment or external publication without explicit approval.

## 9. Validation and acceptance criteria

Do not declare success merely because tests pass or a sample article was manually written.

Validate progressively:

1. Source collection with real current data
2. Permitted substantive source retrieval
3. Automatic research and evidence extraction
4. Autonomous candidate selection
5. Real model-generated Korean drafts
6. Automated claim checking and editorial revision
7. Private durable issue storage
8. Full website article rendering
9. Scheduled execution
10. Three successful unattended scheduled runs

For every live test, distinguish:

- Real completed functionality
- Mocked functionality
- Manual preparation
- Credential-dependent functionality
- Not-yet-implemented functionality

Evaluate editorial quality as well as technical success.

Provide source URLs, timestamps, generated article examples, test results and meaningful limitations.

## 10. Execution rules

Proceed incrementally and autonomously with authorized, non-destructive development work.

Do not stop after every minor implementation step merely to ask permission.

Ask for approval only when an action requires external authorization, elevated permissions, paid API usage, production database changes, public deployment or potentially destructive operations.

When blocked, explain the exact blocker and continue with independent safe work where possible.

After GitHub access is resolved:

1. Inspect the existing repository and recovery assets.
2. Establish the Claude baseline branch safely.
3. Rebuild the minimum runnable project and CI.
4. Implement the first real research-to-draft vertical slice.
5. Expand to complete daily editions.
6. Restore and refine the website.
7. Integrate scheduled execution and durable review workflows.

Maintain a clear development checklist and commit completed stages regularly.

Update CLAUDE.md so the project's persistent instructions reflect this consolidated specification. Remove conflicting obsolete quotas, word limits, scoring rules and workflows.

## IMMEDIATE NEXT ACTION

Resolve GitHub access without changing existing branches.

Report the available authentication options, inspect the repository if access succeeds, and establish the safe development baseline after the user authorizes the first repository write.

Then continue the approved, non-destructive implementation work without repeatedly requesting confirmation for ordinary coding and testing.

The final objective is not another manual sample edition.

**It is a dependable, autonomous daily editorial production system that creates genuinely worthwhile Korean journalism-style newsletters from current, verified evidence.**