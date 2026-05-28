# Codex Design Brief - OpenAI Ads Study Guide

## Surface

Standalone static study guide for the OpenAI Ads Solutions Engineering interview loop. Target file opens directly in a Chromium browser such as Dia.

## User & JTBD

Rishabh is preparing for a customer-facing technical interview. He needs a dense, visually memorable guide that turns the role, Ads APIs, measurement concepts, and his demo into a rehearsable story.

## Success Criteria

- Opens locally without a dev server or external JavaScript.
- Explains the role fit, demo flow, measurement architecture, deduplication contract, API launch workflow, troubleshooting matrix, and talk track.
- Uses light-mode OpenAI-adjacent styling: warm off-white background, near-black text, teal/green accent, restrained borders, dense cards.
- Diagrams are readable on desktop and mobile.
- No emojis, dark patterns, hidden dependencies, or live API calls.

## Brand Brief

- Feel: technical, calm, premium, precise.
- Palette: warm off-white page, white cards, near-black text, OpenAI-green-style accent, plus blue/amber/coral for semantic distinction.
- Typography: system sans, tabular numbers for metrics and API labels.
- Components: dense cards, tables, process rails, SVG architecture diagram, compact callouts.

## Hard Constraints

- Light mode default.
- No emojis.
- WCAG AA contrast floor.
- No pure black or pure white for the page background.
- No external dependencies; local browser open must work.
- No OpenAI logo replication or trademark-heavy decoration; use OpenAI-inspired colors and restrained product-doc styling.

## Output Expected

- `index.html`
- `styles.css`
- Static content only, with anchors for quick navigation and links to official OpenAI sources.
