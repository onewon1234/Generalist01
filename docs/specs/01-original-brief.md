# Project: Generalist Daily Newsletter

## ROLE
You are the lead architect and engineering agent for an AI-powered daily newsletter designed for curious generalists.

Build a modular, source-driven editorial system that discovers, verifies, selects, and explains important news and timeless knowledge across multiple disciplines.

## GOAL
Create a personal daily email newsletter that can later expand into a public subscription service.

The newsletter should take approximately 5 minutes to read and help readers understand a broad range of subjects without requiring prior expertise.

## EDITORIAL CATEGORIES
1. Korea & World News
2. Economy & Business
3. Technology & AI
4. Knowledge, Science & History
5. Literature, Philosophy & Humanities

Keep Economy and Technology as separate categories.

## CORE REQUIREMENTS

### 1. Multi-source Discovery
- Collect content from multiple reliable sources per category.
- Prioritize Naver News for Korean news discovery.
- Include international publishers, educational resources, research institutions, and specialist publications.
- Use official APIs and RSS where available.
- Maintain a configurable source registry.
- Do not assume that every website allows automated full-text collection.

### 2. News Freshness
- Prioritize news published within the last 24 hours.
- Allow up to 48 hours for relevant stories.
- Allow older background materials only when they explain a current development.
- Track event dates, original publication dates, update dates, and retrieval timestamps separately.
- Never present an old event as a new development.

### 3. Topic Selection
- Group articles covering the same event.
- Compare multiple independent sources.
- Select one primary recommended article based on accuracy, completeness, clarity, and accessibility.
- Preserve supporting sources internally for fact-checking.
- Avoid repeating previously published stories unless there is a meaningful new development.
- Maintain editorial diversity without personalizing content based on individual reading behavior.

### 4. Writing Style
Use a clear, structured, concise editorial style.

Explain each topic in a logical sequence:
- Background
- Key facts or explanation
- Significance and implications

Avoid sensationalism, forced humor, unnecessary metaphors, repetitive sentences, and overly academic language.

Preserve essential facts even when simplifying complex topics.

Distinguish facts, interpretations, and uncertainties.

### 5. Educational Links
- Link the main story to one carefully selected original article.
- Identify 2–4 important technical terms when relevant.
- Find accessible, trustworthy explanations for those terms.
- Add hyperlinks directly to relevant terms in the newsletter.
- Provide an optional deeper-learning resource.
- Verify URLs and page relevance.
- Never invent links or claim to have read inaccessible content.

### 6. Quality Assurance
Verify:
- Factual accuracy
- News freshness
- Source independence
- Logical structure
- Readability
- Working links
- Duplicate topics
- Appropriate category coverage

Reject or flag content that cannot be sufficiently verified.

### 7. Architecture
Use a modular pipeline with six editorial responsibilities:
- News Scout
- Knowledge Scout
- Research Analyst
- Content Writer
- Fact Checker
- Editor-in-Chief

Use Claude Code subagents where useful during development, but do not assume that all subagents must run during daily production.

Prefer deterministic code for data collection, date filtering, URL checks, storage, scheduling, and email delivery.

Use AI selectively for topic evaluation, explanation, and editorial review.

### 8. Deployment
- Begin with one personal email recipient.
- Generate a mobile-friendly HTML newsletter.
- Save article metadata, source URLs, editorial decisions, and publication history.
- Design for future expansion to public subscribers.
- Prioritize free or low-cost tools.
- Clearly identify any paid APIs or operational costs.

## EXECUTION INSTRUCTIONS

Do not implement the entire system immediately.

First:
1. Propose the complete technical architecture.
2. Design the source registry and collection methods.
3. Define editorial agent responsibilities and data handoffs.
4. Specify freshness, ranking, and fact-checking rules.
5. Identify free and paid dependencies.
6. Propose an MVP implementation plan.
7. Identify technical limitations and risks.

Do not fabricate source availability, API capabilities, or pricing.

Present the design for review before implementation.