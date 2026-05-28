// send-events.js — OpenAI CAPI demo (server-side)
// Run with: node send-events.js
// With the fake key in .env you'll get a 401. The request body is correctly
// formed; OpenAI just rejects auth. To see the actual payload, point ENDPOINT
// at a https://webhook.site URL.

require('dotenv').config();              // loads .env values into process.env
const axios = require('axios');          // HTTP client (alternative to built-in fetch)

// ── 1. Config ─────────────────────────────────────────────────
const PIXEL_ID = process.env.OPENAI_ADS_PIXEL_ID;   // identifies the ad account
const API_KEY  = process.env.OPENAI_ADS_API_KEY;    // Bearer auth token
const ENDPOINT = `https://bzr.openai.com/v1/events?pid=${PIXEL_ID}`;
// `${VAR}` in backticks = template literal — substitutes the variable's value.

// ── 2. Build one conversion event ─────────────────────────────
// Factory function: take order details, return the JSON OpenAI's CAPI expects.
function buildOrderEvent(orderId, amountCents, oppref) {
  return {
    type: 'order_created',            // standard event name (from OpenAI's taxonomy)
    id: orderId,                      // DEDUP KEY — same value the pixel uses
    timestamp_ms: Date.now(),         // ms since epoch (NOT seconds; ≤7 days old)
    action_source: 'web',             // where the event happened
    source_url: 'https://shop.example.com/success',
    oppref,                           // shorthand for `oppref: oppref`
    data: {
      type: 'contents',               // data shape for commerce events
      amount: amountCents,            // 4299 = $42.99 (integer in cents, not dollars)
      currency: 'USD',
      contents: [{ id: 'sku_123', name: 'Starter bundle', quantity: 1 }],
    },
  };
}

// ── 3. Send a batch ───────────────────────────────────────────
// Up to 1,000 events per call. Atomic: one bad event fails the whole batch.
async function sendBatch(events) {
  return axios.post(ENDPOINT, {
    validate_only: true,              // test mode — doesn't store events
    events,                           // shorthand for `events: events`
  }, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    validateStatus: () => true,       // accept all status codes (don't throw on 4xx/5xx)
  });
}

// ── 4. Run the demo ───────────────────────────────────────────
// IIFE = Immediately Invoked Function Expression.
// Defines an anonymous async function and calls it right away.
// Needed because `await` only works inside async functions, and top-level
// await isn't supported in plain CommonJS modules.
(async () => {
  // In production: captured from the URL when a user clicks an OpenAI ad.
  // For the demo (validate_only: true), any string works as a placeholder.
  const oppref = 'gAAAAAB...sample_token';

  // Build 3 sample events. Same oppref on all of them — in a real flow
  // every conversion in a user's session shares the oppref captured on landing.
  const events = [
    buildOrderEvent('order_001', 4299, oppref),
    buildOrderEvent('order_002', 2599, oppref),
    buildOrderEvent('order_003', 8999, oppref),
  ];

  console.log(`Sending ${events.length} events to OpenAI CAPI...`);
  const res = await sendBatch(events);
  console.log(`Status: ${res.status}`);
  console.log('Response:', JSON.stringify(res.data, null, 2));
})();
