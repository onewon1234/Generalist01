# GENERALIST DAILY — EDITORIAL IDENTITY & READING EXPERIENCE REFINEMENT

## 1. Core editorial identity

Generalist Daily is not primarily a daily news digest.

It is a curiosity-driven, reference-informed Korean editorial publication that helps readers understand the world, discover unfamiliar knowledge, and encounter perspectives worth thinking about.

A successful edition should leave the reader feeling:

- I understand something about the world that I previously did not.
- I learned something genuinely interesting.
- I discovered a new perspective or question.
- The experience was enjoyable, not like reading a collection of conventional news reports.

News is one important source of stories, not the defining content format.

Preserve the value of freshness, but do not make recency the overriding criterion for every article.

## 2. Replace news-led quotas with reader-value-led curation

Remove rigid assumptions that the main edition should contain 3–4 news reports.

Select 5–7 main stories based on their combined intellectual, explanatory, cultural and narrative value.

Maintain a healthy mix of:

- Context-rich stories explaining current global events
- Science and research discoveries
- History and overlooked historical connections
- Culture, art, books, film, design and media
- Psychology, human behavior and cognitive science
- Philosophy and meaningful contemporary questions
- Economics, technology and social change
- Language, anthropology and unfamiliar societies
- Unexpected connections across disciplines

These are discovery domains, not required daily categories.

Allow excellent non-news stories to compete equally for prominent homepage placement.

Keep "짧게 보는 세상" as a separate concise current-affairs section, so the main edition does not need to carry every news update.

Do not create another rigid numerical quota system.

## 3. Expand the reference intelligence system

Audit the existing source registry and discovery pipeline.

Expand beyond conventional news media and government announcements.

Research and integrate suitable accessible references from publications and creators such as:

- Generalist and explanatory: The Browser, The Knowledge, 1440, Vox, The Conversation, The Atlantic, Aeon
- Science and knowledge: Quanta Magazine, Knowable Magazine, Nautilus, New Scientist, Nature, Smithsonian Magazine, Scientific American
- Culture and humanities: JSTOR Daily, The Public Domain Review, Hyperallergic, Literary Hub, Arts & Letters Daily, Psyche
- History and society: History Today, Atlas Obscura, BBC Future or equivalent accessible archives
- Design and visual culture: The Pudding, It's Nice That, Dezeen
- Business and technology: MIT Technology Review, Rest of World, Works in Progress
- Video discovery: Veritasium, Cleo Abram, Kurzgesagt, Vox, TED-Ed, PolyMatter, Asianometry, Wendover Productions and relevant Korean educational creators

These are candidate references, not a claim that all are accessible or licensed for automated ingestion.

Verify availability, access conditions, feed/API support and useful content before activating a source.

Do not bypass paywalls or access restrictions.

Use references to discover editorial angles, topic patterns and intellectual connections, not to copy prose.

The system must learn from the actual variety of good reference content rather than repeatedly generating generic AI topic suggestions.

## 4. Story selection must evaluate reader payoff

For each candidate, evaluate:

1. Curiosity: Is there something surprising, unfamiliar or compelling?
2. Understanding: Does the story explain a meaningful mechanism, context or connection?
3. Narrative potential: Can it be told as a coherent story rather than a list of facts?
4. Intellectual payoff: What will readers know, reconsider or remember afterward?
5. Relevance: Why is this worth reading today, even if it is not breaking news?
6. Evidence quality: Can the central claims be supported?
7. Portfolio diversity: Does it add something distinct to the edition?

Avoid topics that are merely current, easy to summarize, or widely repeated.

For current affairs, prioritize stories that reveal deeper historical, cultural, institutional or social forces.

For evergreen topics, require an unusually strong idea, discovery, narrative or perspective.

Do not let a high-frequency news wire dominate candidate rankings.

Apply the previously proposed source-balancing fixes, subject to tests and source-access verification:

- Different freshness handling for breaking news and slower intellectual publications
- Source-balanced ranking instead of recency-only tie breaking
- Legitimate investigation of high-quality standalone non-news articles
- Canonical source identity across RSS, aggregators and APIs

Do not artificially suppress foreign events merely because they were reported by Korean outlets. Distinguish the event's geography from the reporting source.

## 5. Narrative-first writing

The main article should read like an accessible, engaging explanatory feature, not a conventional news report.

For current affairs, investigate:

- Historical and cultural background
- The people, institutions and interests involved
- The events that led to the current situation
- The causal mechanisms behind key developments
- What changed and why
- Competing interpretations, with attribution
- Consequences and broader implications

Build a coherent narrative in which each section naturally answers a question raised by the previous one.

Prefer concrete scenes, examples and chronological or causal progression over lists of disconnected facts.

For science, culture, history and philosophy, choose the narrative structure that best fits the subject: discovery, mystery, conflict, experiment, transformation, comparison or intellectual journey.

Do not force every article into an identical template.

Distinguish established facts from interpretations and unresolved questions.

Do not fabricate scenes, dialogue, causal links or emotional details for storytelling.

## 6. Improve article-page readability

Audit the actual website's article rendering, not only Markdown drafts.

Implement a readable editorial layout:

- Comfortable reading width and responsive typography
- Clear headline and concise standfirst
- Short, coherent paragraphs with natural whitespace
- Meaningful section headings
- Strong hierarchy between headline, introduction, body and supporting context
- Selective bold emphasis, without overuse
- Contextual timelines or compact explainers when they materially aid comprehension
- Source references and attribution that do not interrupt every sentence
- Mobile-first readability and accessible contrast

Use visuals only when they genuinely improve understanding and when usage rights permit.

Avoid dense blocks, excessive nested cards, decorative clutter and formulaic AI-generated layouts.

Homepage previews should communicate a compelling question or discovery, not merely summarize a headline.

Full article pages must deliver the depth promised by their previews.

## 7. Editorial quality control

Extend automated editorial review beyond factual correctness.

Check whether:

- The piece is a coherent story, not a stitched summary.
- The reader understands relevant context before encountering complex details.
- Causal claims are adequately supported.
- Each section adds new understanding.
- The headline accurately reflects the article.
- The story has a memorable insight or intellectual payoff.
- The prose is accessible without being simplistic.
- The edition contains genuine variety beyond daily news.

Revise articles that fail these criteria.

Do not confuse longer writing with deeper writing.

## 8. Practical validation before full rollout

Do not immediately rewrite the entire edition manually.

First audit the existing selection and writing prompts, reference registry, and website components.

Then:

1. Implement and test the four proposed source-balancing corrections.
2. Expand a manageable, verified set of non-news references.
3. Update editorial selection and writing guidance.
4. Produce a comparative test edition with diverse content domains.
5. Evaluate the actual full article pages in desktop and mobile previews.
6. Compare against the current edition for narrative coherence, learning value, diversity, readability and source quality.
7. Identify remaining gaps before scaling the daily automation.

Where actual model/API execution is not authorized, clearly distinguish manually produced editorial demonstrations from automated pipeline results.

Preserve the existing Supabase data, Git history, security gates and publication restrictions.

Do not incur paid API costs, modify production database schemas, or publish externally without authorization.

## Final acceptance criteria

A reader should not feel they have merely read six news articles.

They should feel they have explored several fascinating parts of the world, understood the deeper story behind important developments, learned something unexpected, and encountered ideas worth remembering.

The publication should feel closer to a thoughtfully curated intellectual magazine with daily freshness than a conventional news briefing.

Update CLAUDE.md and relevant editorial specifications to reflect this consolidated direction, removing conflicting old quotas and news-first assumptions.

Proceed with safe, incremental implementation and tests. Report concrete changes and show actual rendered article previews for review.