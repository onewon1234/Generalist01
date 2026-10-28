# Headlines, decks and subheadings: editorial criteria

Derived on 2026-10-28 from published headlines, decks and subheadings collected
with `npm run headline-study` (26 feeds: Korean dailies, weekly magazines,
economy and technology outlets; international news, explainer, science and
ideas publications; robots.txt respected, nothing stored in this repository).
The collected examples stay in private outputs. This file keeps only what an
editor learns from them. Never reuse another outlet's headline.

## What the study showed

1. **Specific nouns carry the headline.** Good headlines name the place, the
   person or institution, the number or the change: a death rate in a statistic
   headline, the year of the last comparable event, a price. Abstract nouns
   ("the invisible tax", "the paradox of …") appear only where the deck
   immediately says what they mean.
2. **Curiosity comes from a concrete gap, not a withheld subject.** The reader
   is told what happened and left wanting the how or why: a claim followed by
   counter-evidence, a familiar thing with an unexpected property, a striking
   figure, a scene. Headlines that hide the subject ("this one thing …") are
   absent from serious outlets.
3. **Korean headline grammar.** News: subject + action, `…` linking the event to
   its result or significance, a direct claim in quotation marks attributed in
   the deck or body. Explainers: the event + `~이유` / `~하는 까닭` / `무엇으로 ~나`
   stating the question the piece answers. Statistic and record headlines
   (`n년 만에`, `처음`) are common and must be exactly verified.
4. **The deck adds what the headline cannot hold**: the actor, the figure, the
   scale, the time ("first since …"), or the question the article will answer.
   It never repeats the headline and never restates the standfirst.
5. **News versus explainer.** News headlines lead with the event and its result.
   Explainer and feature headlines lead with the finding or the question, and
   the deck supplies the event. Science pieces use vivid verbs for a mechanism
   and keep the technical term for the deck or body.
6. **Subheadings tell the story in sequence.** Read in order, they outline the
   piece: what happened, the background that explains it, the turning point,
   the disagreement, what is left open. They name the event, finding, change or
   conflict of their section. Short natural subheadings (two or three words)
   are common and fine when concrete; generic ones that could sit over any
   article ("배경", "앞으로", "~하는 것", "고칠 수 있을까") are not.
7. **Long pieces stay readable** by placing a concrete scene or case early,
   giving background exactly when the reader needs it (not as a block up
   front), and alternating explanation with people, places and numbers.

## Criteria applied in the Headline Editor step

- Read alone, the headline says roughly what the story is about **and** makes
  the reader want the article. Both, not one.
- Find the most interesting concrete fact in the body; if the headline misses
  it, rewrite. Prefer a fact the body establishes over a metaphor for it.
- No unfamiliar technical term as the entry point; put it in the deck or body.
- Every record ("처음", "n년 만에"), number, scientific claim and causal claim
  in a headline or deck is checked against the primary source; a claim by the
  researchers is marked as theirs (quotation marks, or attribution in the deck).
- No fixed number of candidates, styles or question headlines. The editor writes
  what is needed to find a good headline and records the change and the reason
  (`headlineReview` in the edition JSON).
- Subheadings are rewritten with the body: each names its section's content,
  and the sequence follows the story. `checkSubheads` (web/src/checks.ts) notes
  generic ones; the editor decides.
