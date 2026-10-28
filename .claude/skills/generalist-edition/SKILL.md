---
name: generalist-edition
description: Produce or revise a Generalist Daily edition in a Claude Code session on the user's subscription (semi-automatic editor, writer, fact-check and quality-review stages). Use when asked to make, select, write, review or render an edition or a test edition.
---

# Generalist Daily edition (semi-automatic)

This skill runs the AI stages of CLAUDE.md §5 inside a Claude Code session the
user starts. It is **not unattended automation**: say so in every report, and
label manual editorial work separately from pipeline results. No paid API, no
database writes, no publishing. Run everything locally (the repository is
public; never put drafts in Actions logs).

## 1. Candidates (automatic, rule-based)

```
cd pipeline
npm run preview -- --out-dir ~/development/generalist-preview/<date> --pool 36
```

Read `preview.md` (candidates, read status, evidence) and `audit.md` (source
distribution by stage). If one source or language dominates the pool, note it
before selecting.

## 2. Select (editor)

Score every plausible candidate 0–10 on the reader-payoff criteria of
CLAUDE.md §2: curiosity, understanding, narrative potential, intellectual
payoff, relevance, evidence quality; then build a varied portfolio. Weigh the
user's default composition (about 1 Korea, 1–2 world, 1 economy, 1 AI/tech,
0–2 exploration; desks are shown in `preview.md`): fill a desk only with a
candidate that is genuinely good, say so when a desk is empty that day, and
exceed a desk's usual range only for an exceptional story. For each pick write: why now, angle, reader payoff (one line),
and the question or discovery the homepage preview will pose. Record why strong
candidates were left out. Foreign events found via a Korean outlet: find the
original or international sources first.

## 3. Research (researcher)

`npm run read -- <url> …` prints the permitted text of each source (robots,
opt-outs and paywalls respected; nothing stored). Read every source you cite in
full. Background facts need a source (institution page or read article), never
memory. Prefer independent corroboration; note disagreements and who says what.

## 4. Write (writer)

Follow CLAUDE.md §4. An explanatory feature, not a news report: each section
answers the question the previous one raised; concrete scenes and examples
only if sourced; choose the structure that fits (discovery, mystery, conflict,
experiment, transformation, comparison, intellectual journey). Separate fact,
whose analysis, expert opinion, stakeholder claim, open question and forecast.
No fabricated scenes, dialogue, causal links or emotions. Write the edition as
`web/editions/<date>.json` (schema: `web/src/types.ts`): headline, standfirst,
homepage question, sections, optional timeline/explainer, numbered sources.

Economy and AI/tech pieces: news plus one piece of lasting knowledge (event →
why it draws attention → principle/background → unexpected connection or case
→ meaning for people), as an example structure, not a template.

오늘의 한 줄 (news strip): 6–10 items, each with a field tag, a short label,
one scannable `line` (≤ 48 characters) and one or two complete sentences
(`text`), the source and its publication time. Check every sentence with
`validateBrief` (`pipeline/src/preview/briefs.ts`); the build checks the line
against the text (`checkLine`). No item may repeat a main story.

## 4b. Headline Editor

Read `docs/editorial/HEADLINE-STUDY.md` first. For each piece, after the body is
final:

1. Find the most interesting concrete fact in the body. Does the headline carry
   it, and does the headline alone say what the story is about while making the
   reader want to read? If not, rewrite. No abstract metaphor or unfamiliar term
   as the entry point; follow Korean headline grammar.
2. Verify every record, number, scientific or causal claim in the headline and
   deck against the primary source; mark claims as the speaker's.
3. Rewrite the deck to add the actor, figure, scale, time or question.
4. Rewrite each subheading to name its section's event, finding, change or
   conflict; read them in order and check they tell the story.
5. Re-read the lead, the placement of background, the causal chain and the
   ending; fix only what is wrong, and say why.

Record the previous headline and deck, the reason, the body edits and the
subheadings before/after in `headlineReview`. There is no candidate-count,
style or question-ratio rule: quality, not variety of forms, decides.

## 5. Fact-check (fact checker)

Check each claim against the read sources only, without the writer's
reasoning. Numbers, names, dates, attributions and hedges must match. Unsupported
claims are corrected, qualified or removed. AI checking is not human approval.

## 6. Quality review (quality reviewer)

For each piece, answer yes/no and revise on any no:

- Is it a coherent story, not a stitched summary?
- Does the reader get context before complex details?
- Are causal claims adequately supported and attributed?
- Does each section add new understanding (no repetition)?
- Does the headline accurately reflect the article?
- Is there a memorable insight or intellectual payoff?
- Is the prose accessible without being simplistic? Is it longer than it needs to be?
- Does the preview's question get answered by the page?

For the edition: is there genuine variety beyond daily news (domains, regions,
forms)?

## 7. Render and look (automatic)

```
cd web && npm run build -- editions/<date>.json --out ~/development/generalist-preview/<date>/site
npm run shots -- ~/development/generalist-preview/<date>/site
```

Look at the desktop and mobile screenshots of the homepage and every article
page before reporting. Fix layout or writing problems you see.

## 8. Report

Korean. Label each part real / heuristic / manual / not yet implemented. Show
the rendered pages. Nothing is published; publishing needs the user's approval.
