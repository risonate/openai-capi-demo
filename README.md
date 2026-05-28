# OpenAI CAPI Demo

A four-file demo of OpenAI Ads measurement: server-side CAPI, client-side pixel, an interactive step-through walkthrough, and a single-page end-to-end visualization showing all three event sources reconciling on OpenAI's servers.

Built against the [public docs](https://developers.openai.com/ads) as a learning exercise for the Solutions Engineering interview loop.

## What's in this repo

| File | Purpose |
|---|---|
| `send-events.js` | Server-side CAPI. The production-style reference: builds + sends conversion events to `bzr.openai.com/v1/events` |
| `ads-api-workflow.js` | Dry-run Advertiser API workflow: account check, creative upload, campaign, ad group, ad, and insights |
| `walkthrough.js` | Interactive step-through of `send-events.js`. Pauses between each step so you can see the flow build up |
| `pixel.html` | Browser-side reference. The `oaiq()` SDK loaded in `<head>`, plus buttons that fire sample events you can inspect in DevTools |
| `demo.html` | Single-page end-to-end visualization. ChatGPT + advertiser browser + advertiser server + OpenAI dashboard, animated event packets, live reconciliation, and a **Conservative ↔ Aggressive CAPI toggle** |
| `DEMO_GUIDE.md` | Seven-minute interview talk track, source anchors, failure modes, and close-out narrative |
| `study-guide/index.html` | Polished browser study guide for rehearsing the OpenAI Ads Solutions interview story |

## Quick start

```bash
git clone https://github.com/risonate/openai-capi-demo.git
cd openai-capi-demo
npm install

# 1. Production-style CAPI client
node send-events.js

# 2. Interactive step-through of the same flow
node walkthrough.js

# 3. Open pixel reference in browser
open pixel.html

# 4. Open the full end-to-end visualization
open demo.html

# 5. Open the interview study guide
open study-guide/index.html

# 6. Dry-run Ads API launch workflow
npm run demo:ads-api

# 7. Smoke checks
npm test
```

With fake keys in `.env`, `send-events.js` returns 401 — that's expected, the request is correctly shaped, OpenAI just rejects auth. To inspect the actual payload, point `ENDPOINT` at a https://webhook.site URL.

---

## How the client side works (browser pixel)

The pixel is a JavaScript SDK (`oaiq.min.js`) loaded from `bzrcdn.openai.com`. The advertiser installs an init snippet in their site template, then fires events with `oaiq("measure", ...)` calls on conversion pages.

### Client-side flow, step by step

```
═══════════════════════════════════════════════════════════════
  USER JOURNEY: ChatGPT click → advertiser site → conversion
═══════════════════════════════════════════════════════════════

  1. User clicks ad in ChatGPT
        │
        ▼
  2. OpenAI mints an "oppref" token, redirects the user to:
       shop.mattress.co/?oppref=gAAAAAB...&utm_source=chatgpt&...
        │
        ▼
  3. Advertiser page loads. SDK init snippet (in <head>) runs:
       • Loads bzrcdn.openai.com/sdk/oaiq.min.js asynchronously
       • Calls oaiq("init", { pixelId: "..." })
        │
        ▼
  4. SDK auto-captures oppref from URL into __oppref cookie (30d)
        │
        ▼
  5. SDK fires page_viewed (automatically or via explicit call):
       POST bzr.openai.com/v1/events
       { type: "page_viewed", oppref: "gAAAAAB...", ... }
        │
        ▼
  6. User adds to cart → oaiq("measure", "items_added", {...})
        │
        ▼
  7. User completes purchase → advertiser calls:
       oaiq("measure", "order_created", {
         type: "contents", amount: 259900, currency: "USD", contents: [...]
       }, {
         event_id: "order_8a4f2c"   ◄── DEDUP KEY (matches CAPI's id field)
       })
        │
        ▼
  8. SDK POSTs to bzr.openai.com/v1/events with oppref + event_id attached.
```

### Critical client-side details

- **oppref auto-capture** is the pixel's superpower. It reads `?oppref=...` from the landing URL and stores it in a 1p cookie. Every subsequent `oaiq("measure", ...)` call attaches it automatically.
- **event_id is the dedup key.** Goes in the 4th argument as `{ event_id: "..." }`. Must match the `id` field your server's CAPI call uses.
- **In production, the init snippet is usually deployed via a tag manager** (Google Tag Manager, Tealium) rather than hand-coded into every template. Tag managers also handle consent gating and version pinning.

See `pixel.html` for a working reference. Open in a browser with DevTools → Network filtered to `bzr`, then click the buttons.

---

## How the server side works (CAPI)

CAPI is a server-side HTTP API. The advertiser's backend POSTs conversion events directly to `bzr.openai.com/v1/events`, bypassing the browser. This is what `send-events.js` demonstrates.

### Server-side flow, step by step

```
═══════════════════════════════════════════════════════════════
  CONVERSION FIRES: pixel + CAPI both send → OpenAI dedupes
═══════════════════════════════════════════════════════════════

  1. User completes purchase on advertiser site
        │
        ├─→ Browser:  oaiq("measure", "order_created", {...},
        │              { event_id: "order_8a4f2c" })
        │             POST bzr.openai.com/v1/events
        │
        └─→ Backend:  Shopify/Stripe webhook fires at advertiser's server
              │
              ▼
  2. Advertiser backend receives webhook with order details:
        { order_id: "order_8a4f2c", amount_cents: 259900, ... }
        │
        ▼
  3. Backend looks up the user's __oppref from session storage:
        oppref = "gAAAAAB..."
        │
        ▼
  4. Backend builds the CAPI event:
        {
          type: "order_created",
          id: "order_8a4f2c",          ◄── SAME value as pixel's event_id
          timestamp_ms: 1716826800000,
          action_source: "web",
          source_url: "https://shop.mattress.co/success",
          oppref: "gAAAAAB...",        ◄── REPLAYED (CAPI doesn't auto-capture)
          data: {
            type: "contents",
            amount: 259900,
            currency: "USD",
            contents: [{ id: "sku_123", name: "...", quantity: 1 }]
          }
        }
        │
        ▼
  5. Backend POSTs to bzr.openai.com/v1/events:
        Authorization: Bearer <API_KEY>
        Content-Type: application/json
        Body: { validate_only: false, events: [event] }
        │
        ▼
  6. OpenAI ingests. Sees TWO events with same id="order_8a4f2c":
        one from pixel, one from CAPI → DEDUPES → counts ONE conversion.
```

### Critical server-side details

- **The `id` field is the dedup key.** Same value as the pixel's `event_id`. Use the advertiser's authoritative order ID (Shopify order, Stripe PaymentIntent) — never a server-generated UUID the pixel can't see.
- **`oppref` is the silent attribution killer.** Pixel auto-captures it; CAPI does NOT. Your server must read oppref from the inbound URL when the user lands and replay it on every conversion event.
- **Batches are atomic (≤1,000 events).** One bad event fails the entire batch. Different from Meta's per-event status. Production code validates client-side first; on 4xx, bisects and retries.
- **`validate_only: true`** for testing. OpenAI validates the payload shape but does NOT store events. Safe to call repeatedly.

See `send-events.js` for the production-style implementation, `walkthrough.js` for an interactive step-through.

---

## How the Ads API launch flow works

The Advertiser API side of the demo is intentionally dry-run only. A real campaign create call can create live account objects, so `ads-api-workflow.js` prints the request sequence and validates the payload contract locally.

```
  1. GET  /ad_account
       Confirm the API key maps to the expected advertiser account.

  2. POST /upload
       Upload the creative image and retain file_id.

  3. POST /campaigns
       Create the campaign paused with budget and country targeting.

  4. POST /ad_groups
       Attach context_hints and bidding_config.

  5. POST /ads
       Create a chat_card creative with title, body, target_url, and file_id.

  6. GET  /campaigns/{id}/insights
       Pull daily performance and compare conversions against measurement logs.
```

The interview point: campaign execution and measurement launch are one system. I would not recommend scaling spend until the API objects, creative review, pixel, CAPI, and insights reconciliation are all green.

See `DEMO_GUIDE.md` for the full interview talk track.

---

## Why both pixel AND CAPI?

The pixel and CAPI are two independent signals for the same conversions. Each has gaps the other covers:

```
   PIXEL (browser-side)              CAPI (server-side)
   • real-time                       • reliable, bypasses browser
   • auto-captures oppref            • catches offline conversions
   • lost to ad blockers               (phone, in-store, refunds)
     (~10-20%), iOS ITP, Firefox     • but: must replay oppref manually
   • misses offline conversions
              │                                │
              └───────────────┬────────────────┘
                              ▼
            both POST to bzr.openai.com/v1/events
                              │
                              ▼
          OpenAI dedupes by matching  id ↔ event_id
                              │
                              ▼
           each conversion counted exactly ONCE
```

Pixel handles real-time browser conversions. CAPI handles reliability, ITP/ad-blocker resilience, and offline conversions. Together they cover both halves; the `id ↔ event_id` dedup keeps counts honest.

**Conservative vs aggressive patterns** (toggle in `demo.html`): the conservative pattern fires CAPI only for key conversions (`order_created`) and lets the pixel handle everything else. The aggressive pattern — increasingly common via server-side tagging — mirrors *every* event through CAPI for maximum resilience against pixel loss. Both are safe because dedup collapses the duplicates.

---

## Field mapping — OpenAI ↔ Meta ↔ Google

| OpenAI CAPI              | Meta CAPI                  | Google Enhanced Conversions |
|--------------------------|----------------------------|------------------------------|
| `type`                   | `event_name`               | `conversion_action`          |
| `id` (dedup key)         | `event_id`                 | `order_id`                   |
| `timestamp_ms` (ms)      | `event_time` (sec)         | `conversion_date_time`       |
| `oppref` (top-level)     | `user_data.fbc`            | `gclid`                      |
| `data` (typed shape)     | `custom_data`              | tag-specific                 |
| `action_source: "web"`   | `action_source: "website"` | (implicit)                   |
| `validate_only`          | `test_event_code`          | `validate_only`              |

## What's NOT in this demo

- Real auth (uses fake keys — would 401 against prod)
- Hashed PII in the optional `user` field (sha256 email/phone in production)
- Webhook ingestion from commerce platforms (Shopify/Stripe webhooks would trigger this)
- Exponential backoff on transient failures
- Bisect-and-retry on batch-level 4xx responses

## Built by

[Rishabh Natarajan](https://linkedin.com/in/rishabhnatarajan) · 11+ years in adtech across Magnite, TripleLift, Amazon
