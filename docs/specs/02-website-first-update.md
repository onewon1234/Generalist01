# GENERALIST DAILY — CLAUDE CODE PROJECT UPDATE

You are continuing the existing Generalist Daily project.

This instruction supersedes conflicting earlier product-direction and UI requirements. It does not replace valid technical, security, editorial accuracy, or cost-control requirements.

Do not restart the project unnecessarily.

## 1. FIRST: AUDIT THE EXISTING PROJECT

Before making changes, inspect:

- Current repository structure
- Existing project instructions
- Skills, hooks, agents, and tool configurations
- Existing source collection logic
- AI editorial pipeline
- Supabase integration
- Database schema and migrations
- Scheduling configuration
- Email functionality, if implemented
- Existing tests and deployment status

Identify what is actually implemented versus planned.

Do not assume that a database schema means the complete system is functional.

Do not overwrite working components without a concrete reason.

Preserve useful existing configurations, including token-saving and workflow optimizations.

Consolidate conflicting instructions instead of continually appending new rules.

## 2. UPDATED PRODUCT IDENTITY

Generalist Daily is now a **website-first, AI-curated daily knowledge publication**.

It is not primarily an email newsletter.

It is also not a conventional news portal, infinite news feed, or specialist academic publication.

Its audience consists of curious generalists who want:

- Important current affairs
- Essential general knowledge
- Broad conversational literacy
- Interesting discoveries across unfamiliar fields
- Clear explanations of how things work
- Opportunities to develop their own reasoning and perspectives

The product should combine breadth and meaningful depth without overwhelming readers.

### Core promise

"Things worth knowing, things everyone should understand, and things you didn't know you'd find interesting — in one manageable daily edition."

## 3. DAILY EDITION MODEL

Publish one complete daily edition.

Target:
- 5–7 stories
- Normally 6 stories
- Approximately 5–7 minutes of total reading

Readers should feel that completing the edition is sufficient for the day.

Do not build an endless content feed.

Past editions should remain available in an archive.

## 4. UPDATED EDITORIAL MIX

Use the following six editorial functions:

1. MUST KNOW — consequential current affairs
2. IN THE KNOW — contemporary trends and conversations
3. THE ESSENTIALS — foundational general knowledge
4. GOOD TO KNOW — interesting and useful knowledge
5. SOMETHING NEW — unfamiliar subjects and discoveries
6. FOOD FOR THOUGHT — topics encouraging reasoning and reflection

These are editorial selection functions, not rigid daily slots.

One story may serve multiple functions.

Do not force all six functions to appear every day.

### Starting balance

For six stories, normally aim for:

- 2 timely/current stories
- 1 foundational knowledge story
- 2 interesting/discovery-oriented stories
- 1 reflection-oriented story

Adjust based on quality and importance.

Do not force weak stories into the edition.

## 5. BROAD SUBJECT COVERAGE

Support a flexible taxonomy including:

- World, Politics & Society
- Economics, Finance & Business
- Science, Technology & AI
- History, Civilization & Geography
- Philosophy, Literature, Arts & Culture
- Psychology, Human Behavior & Everyday Life

Also allow subjects such as mathematics, environment, medicine, architecture, design, law, language, anthropology, and other valuable topics.

Do not limit editorial discovery to a fixed list.

Track subject and subtopic diversity across rolling 7-day and 30-day periods.

Daily variety matters, but every category does not need to appear every day.

Do not disproportionately favor AI, finance, or geopolitics simply because they generate frequent headlines.

## 6. TOPIC QUALITY & DEPTH

Select topics that combine:

- Importance and essential knowledge
- Genuine interest
- Clear explainability
- Reasoning potential
- Novelty and discovery

Use these initial suitability weights:

- Essential knowledge/significance: 25%
- Interest/curiosity: 25%
- Accessibility: 20%
- Thinking potential: 15%
- Novelty: 15%

These weights are adjustable editorial heuristics.

Accuracy and source reliability remain mandatory gates.

For current news, enforce freshness separately.

Avoid:
- Empty trivia
- Clickbait
- Overly specialized technical discussions without accessible context
- Unnecessarily academic writing
- Repetitive topics
- Superficial summaries lacking explanation

Do not avoid intellectually difficult subjects merely because they are difficult.

Explain important complexity clearly.

Each article should ideally cover:

1. What it is / what happened
2. Why or how it works
3. Why it matters

Where useful, add an example, uncertainty, counterargument, or thoughtful question.

Do not artificially force reflection into every article.

Write in natural, polished Korean.

## 7. PRESERVE EXISTING EDITORIAL SAFEGUARDS

Retain and verify the existing requirements for:

- News freshness: normally 24–48 hours, up to 72 hours for major developments
- Separate event, publication, update, and retrieval timestamps
- Reliable sources and corroboration
- Story clustering and deduplication
- Distinguishing new developments from repeated coverage
- Source-grounded writing
- Fact checking
- Editorial decision logging
- Copyright and paywall compliance
- Verified original source links
- Relevant educational concept hyperlinks
- Cost-efficient AI usage

Evergreen educational material does not require recent publication dates.

Do not present old background information as breaking news.

Do not fabricate sources, URLs, quotes, or facts.

## 8. REPLACE EMAIL-FIRST UI WITH WEBSITE-FIRST UI

Build a responsive **Daily Edition Dashboard**.

Use an editorial bento-grid layout.

Avoid conventional newspaper homepages, news portals, analytics dashboards, and endless article feeds.

### Homepage requirements

- Minimal Generalist Daily header
- Date and edition number
- Brief editorial introduction
- Number of stories and estimated reading time
- A clear, finite selection of daily stories
- One visually prominent story when editorially justified
- Medium and small cards with coherent visual hierarchy
- Card title, short subtitle, category, and reading time
- Optional reading progress
- Clear completion state

Do not force cards to connect conceptually.

Do not make visual variety more important than readability.

Avoid decorative widgets and excessive complexity.

### Additional pages

- Individual Story Pages
- Past Editions Archive
- Topic/Category Browsing
- About / Editorial Principles

Do not add accounts, comments, social feeds, or personalized recommendation systems to the initial MVP.

### Story page requirements

- Readable editorial typography
- Clear background and explanation
- Verified factual content
- Source attribution
- Relevant educational concept links
- Optional further reading
- Mobile-first readability

### Design direction

The website should feel like a contemporary editorial knowledge publication.

Use restrained colors, whitespace, typography, and card hierarchy.

The experience should communicate:

"Here is today's carefully selected knowledge. This is enough."

## 9. DATABASE MIGRATION STRATEGY

An existing Supabase project and core schema have already been created.

Inspect the actual database and migration state before changing anything.

Preserve existing data and working relationships.

Review the existing tables:

- sources
- articles
- story_clusters
- cluster_articles
- ai_summaries
- glossary_terms
- issues
- issue_items
- item_terms
- editorial_log

Extend only where needed for:

- Flexible categories and subtopics
- Editorial function tags
- Rolling topic coverage
- Website publication states
- Public article access
- Reading-time metadata
- Source verification records

Use versioned, reversible migrations.

Do not drop or recreate existing tables unnecessarily.

Do not expose service-role credentials to the browser.

The current RLS configuration must be evaluated before enabling public website access.

Public visitors should only be able to read explicitly published content.

Unpublished drafts, internal research, editorial logs, and credentials must remain private.

## 10. EMAIL FUNCTIONALITY

Email is no longer the primary product interface.

If email functionality already exists and works, preserve it as an optional future distribution channel.

Do not prioritize new email features over the website.

Do not delete working email code merely because the product direction has changed.

## 11. DEVELOPMENT & AGENT ORGANIZATION

Use existing Claude Code skills, agents, hooks, and tools when appropriate.

Assign logical responsibilities for:

- Architecture and integration
- Data collection/backend
- AI editorial pipeline
- Frontend/UI
- QA/security

Use subagents only when they provide a meaningful benefit.

Avoid duplicated research, repeated model calls, and conflicting file edits.

Production editorial roles may include:

- News Scout
- Knowledge Scout
- Research Analyst
- Writer
- Fact Checker
- Editor-in-Chief

These do not need to run as six independent agents every day.

Prefer deterministic code for mechanical operations.

Optimize for editorial quality, reliability, and cost.

## 12. AUTOMATION & DEPLOYMENT

The system should run without requiring the user's Mac to remain awake.

Separate collection, generation, review, and publication.

Preserve existing scheduler or automation work if functional.

During development, use draft mode by default.

Do not automatically publish unverified content.

Use free-tier infrastructure where appropriate.

Ask before creating paid resources or initiating real API charges.

## 13. IMPLEMENTATION PLAN

After auditing the current project:

1. Report which existing components can be reused.
2. Identify genuine conflicts with the updated requirements.
3. Propose minimal necessary schema changes.
4. Update the consolidated project instructions.
5. Implement the website-first frontend.
6. Integrate it with the existing editorial pipeline.
7. Implement or repair missing pipeline stages.
8. Test data access, editorial output, and publication workflow.
9. Generate a representative daily edition.
10. Document deployment, costs, and remaining limitations.

Do not stop after proposing changes.

Proceed with safe, reversible implementation.

Request approval before:
- Paid resource creation
- Destructive database changes
- Public deployment
- Publishing real content
- Other irreversible or security-sensitive operations

## 14. ACCEPTANCE CRITERIA

The updated project must demonstrate:

- A complete daily edition of approximately 5–7 stories
- Broad subject coverage over time
- Meaningful editorial selection
- Accessible but substantive Korean writing
- Correct news freshness
- Source-based factual verification
- Valid article and educational links
- A responsive editorial bento-grid homepage
- Functional story pages
- A past-edition archive
- Safe access to published content
- Draft/approval/publication workflow
- Automated execution without a local computer
- Clear failure logging
- Documented costs and limitations

Distinguish completed integrations from mock demonstrations.

## FINAL DIRECTIVE

Preserve valid prior work and technical safeguards, but replace the previous email-first, news-style presentation with a finite, curated, website-first Daily Edition experience.

Do not simply add these requirements on top of conflicting old instructions.

Audit, reconcile, consolidate, implement, and test.

The final experience should help readers become better-informed, broadly knowledgeable, curious, and capable of thinking independently — a little more each day.