# OpenAI Ads Solutions Interview Demo

This demo is designed for the OpenAI Ads Solutions Engineering role: technical discovery, launch readiness, measurement quality, API fluency, and executive-level narrative.

## Source Anchors

| Source | Why it matters | Demo coverage |
|---|---|---|
| [OpenAI Ads Solutions role](https://openai.com/careers/solutions-engineering-ads-solutions-new-york-city/) | Calls out discovery, pixels, APIs, server-to-server integrations, identity, offline conversions, measurement, demos, docs, and enablement. | The runbook is structured as a customer-facing SA demo, not a code toy. |
| [JavaScript Pixel](https://developers.openai.com/ads/measurement-pixel) | Pixel install, `oaiq("measure", ...)`, `event_id`, automatic `oppref`, and browser transport behavior. | `pixel.html` and the browser pane in `demo.html`. |
| [Conversions API](https://developers.openai.com/ads/conversions-api) | Server-side events, batch atomicity, `validate_only`, `id` deduplication, timestamps, and manual `oppref` replay. | `send-events.js`, `walkthrough.js`, and the CAPI pane in `demo.html`. |
| [Advertiser API Overview](https://developers.openai.com/ads/api-overview) | Campaigns, ad groups, ads, files, reporting, auth, and rate limits. | `ads-api-workflow.js` dry-runs the campaign launch workflow. |
| [Insights API](https://developers.openai.com/ads/api-reference/insights) | Reporting across account, campaign, ad group, and ad scopes. | `ads-api-workflow.js` ends with a daily insights pull for conversion QA. |

## Demo Assets

| Asset | What it proves | Interview move |
|---|---|---|
| `ads-api-workflow.js` | You understand campaign execution through the Advertiser API without creating live spend. | Start here to show launch workflow discipline. |
| `demo.html` | You can explain pixel, CAPI, deduplication, `oppref`, and launch readiness visually. | Use this as the main customer-facing demo. |
| `send-events.js` | You can implement server-side conversion delivery with correct auth, event shape, batching, and `validate_only`. | Open this when the interviewer asks how real integration would work. |
| `pixel.html` | You understand browser SDK setup, event firing, DevTools validation, and dedup contract. | Use this for troubleshooting and partner enablement. |
| `walkthrough.js` | You can teach the flow step by step. | Use this for a live interview walkthrough or Loom. |

## Seven-Minute Talk Track

| Minute | Action | What to say |
|---|---|---|
| 0-1 | Frame the customer | "Assume an advertiser wants to launch on ChatGPT, but their buying team will not scale spend until attribution is trusted." |
| 1-2 | Run `npm run demo:ads-api` | "I would create campaign objects paused first, verify account scope, upload creative, create campaign/ad group/ad, wait for review, then inspect insights." |
| 2-4 | Open `demo.html` and play conservative mode | "The pixel gives real-time browser telemetry and captures `oppref`; CAPI gives resilient server-side conversion delivery. The dedup key is deliberately shared." |
| 4-5 | Toggle aggressive mode | "For higher signal resilience, server-side tagging can mirror more events, but you need validation, dedup discipline, and consent-aware routing." |
| 5-6 | Open `send-events.js` | "The production risk is not writing the POST. It is preserving `oppref`, using stable order IDs, validating batches, and separating retryable from non-retryable failures." |
| 6-7 | Close with monitoring | "Post-launch, I would compare Ads Insights, pixel logs, CAPI acknowledgements, commerce source of truth, and discrepancy thresholds before recommending scale." |

## Architecture

```text
ChatGPT ad impression/click
        |
        v
Advertiser landing URL with oppref
        |
        +--> Browser pixel captures oppref and sends page/action events
        |
        +--> Advertiser backend stores oppref in session/customer context
                 |
                 v
        Commerce webhook sends server-side conversion via CAPI
                 |
                 v
OpenAI reconciles pixel + CAPI by pixel ID, event name, and event ID
                 |
                 v
Ads API insights are checked against advertiser source-of-truth reporting
```

## Failure Scenarios

| Failure | Symptom | Mitigation |
|---|---|---|
| Missing `oppref` server-side | Pixel shows conversions, CAPI conversions under-attribute. | Capture URL `oppref` at landing, persist it in first-party session storage, replay it on server events. |
| Dedup key mismatch | Conversion count doubles when pixel and CAPI both fire. | Use the commerce source-of-truth ID for pixel `event_id` and CAPI `id`. |
| Batch-level 4xx | A whole CAPI batch fails because one event is malformed. | Validate locally, isolate bad records, bisect failed batches, and alert on validation error class. |
| Ad object active before measurement is ready | Spend begins before attribution QA is complete. | Create campaign, ad group, and ad paused; activate after pixel/CAPI smoke checks and review approval. |
| Reporting discrepancy after launch | Ads Manager conversions do not match advertiser BI. | Compare Ads API insights, pixel logs, CAPI responses, order system, time zones, attribution windows, and filtering. |

## Interview Close

In an SA interview, present this as:

> "I built the demo around the advertiser lifecycle: launch the campaign safely, instrument conversion measurement, reconcile signals, and monitor performance before recommending scale. The core tradeoff is coverage versus complexity: pixel-only is simple but lossy, CAPI adds reliability but requires disciplined identifier and `oppref` handling."

Run:

```bash
npm install
npm run demo:ads-api
node walkthrough.js
open demo.html
npm test
```
