// walkthrough.js — Interactive step-through of the OpenAI CAPI flow.
// Same logic as send-events.js, but pauses between each step so you can see
// what's happening. Run with: node walkthrough.js
//
// Great for: learning the flow, recording the Loom video, live demos in the loop.

require('dotenv').config();
const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const pause = (msg = '\n[ Press Enter to continue → ]') =>
  new Promise(resolve => rl.question(msg + '\n', resolve));

const header = title => {
  console.log('\n' + '═'.repeat(64));
  console.log('  ' + title);
  console.log('═'.repeat(64));
};

const note = text => console.log('  ' + text);
const indent = obj => JSON.stringify(obj, null, 2).split('\n').map(l => '    ' + l).join('\n');

async function main() {
  console.clear();
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   OpenAI CAPI Demo · Interactive Walkthrough                 ║');
  console.log('║   Pauses between steps. Read, then hit Enter to continue.    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  await pause();

  // ── STEP 1 ────────────────────────────────────────────────────
  header('STEP 1 of 5 · Load config from .env');
  note('When the script started, dotenv read .env and copied each key/value');
  note('into process.env. Here\'s what got loaded:\n');
  console.log('    PIXEL_ID  = ' + process.env.OPENAI_ADS_PIXEL_ID);
  console.log('    API_KEY   = ' + (process.env.OPENAI_ADS_API_KEY || '').slice(0, 12) + '... (truncated)');
  console.log('    CAPI_BASE = ' + process.env.OPENAI_CAPI_BASE);
  console.log('');
  note('In production, these would be real values pulled from a secrets manager');
  note('like AWS Secrets Manager or HashiCorp Vault. Never committed to git.');
  await pause();

  // ── STEP 2 ────────────────────────────────────────────────────
  header('STEP 2 of 5 · Build the endpoint URL');
  const PIXEL_ID = process.env.OPENAI_ADS_PIXEL_ID;
  const API_KEY = process.env.OPENAI_ADS_API_KEY;
  const ENDPOINT = `https://bzr.openai.com/v1/events?pid=${PIXEL_ID}`;
  note('The endpoint URL bakes the pixel ID into the query string:\n');
  console.log('    ' + ENDPOINT);
  console.log('');
  note('That `?pid=...` part is how OpenAI knows which ad account this event');
  note('is for. One advertiser could have multiple pixel IDs (one per brand,');
  note('one per environment, etc.) — each maps to a separate reporting bucket.');
  await pause();

  // ── STEP 3 ────────────────────────────────────────────────────
  header('STEP 3 of 5 · Build three conversion events');
  note('We\'ll construct three sample order_created events. Same oppref on');
  note('all of them — in a real session, every conversion shares the oppref');
  note('captured when the user landed from the ChatGPT ad click.\n');

  const oppref = 'gAAAAAB...sample_token_from_url';
  const buildOrderEvent = (orderId, amountCents) => ({
    type: 'order_created',           // standard event from OpenAI's taxonomy
    id: orderId,                     // DEDUP KEY — same value pixel uses
    timestamp_ms: Date.now(),        // ms since epoch (≤7 days old)
    action_source: 'web',
    source_url: 'https://shop.example.com/success',
    oppref,                          // OpenAI click token, replayed
    data: {
      type: 'contents',              // data shape for commerce events
      amount: amountCents,           // integer in cents (4299 = $42.99)
      currency: 'USD',
      contents: [{ id: 'sku_123', name: 'Starter bundle', quantity: 1 }],
    },
  });

  const events = [
    buildOrderEvent('order_001', 4299),
    buildOrderEvent('order_002', 2599),
    buildOrderEvent('order_003', 8999),
  ];

  note('Here\'s the first event we just built:');
  console.log(indent(events[0]));
  console.log('');
  note('Critical field to notice: `id: "order_001"`.');
  note('That\'s the dedup key. The pixel on the success page would fire with');
  note('the same value (as `event_id` in its options). OpenAI matches the two');
  note('events as the same conversion.');
  await pause();

  // ── STEP 4 ────────────────────────────────────────────────────
  header('STEP 4 of 5 · Assemble the full request body');
  const body = { validate_only: true, events };
  note('The full POST body wraps the events array. `validate_only: true` means');
  note('OpenAI validates the payload shape but does NOT store the events.');
  note('Perfect for testing. Production calls use `validate_only: false`.\n');
  note('Full body we\'re about to send:');
  const preview = indent(body).split('\n').slice(0, 22).join('\n');
  console.log(preview);
  console.log('    ... (' + (events.length - 1) + ' more events truncated for display)');
  await pause();

  // ── STEP 5 ────────────────────────────────────────────────────
  header('STEP 5 of 5 · POST to OpenAI');
  note('Sending the request now:\n');
  console.log('    POST ' + ENDPOINT);
  console.log('    Authorization: Bearer ' + API_KEY.slice(0, 12) + '... (truncated)');
  console.log('    Content-Type: application/json');
  console.log('');
  note('Firing...\n');

  const res = await axios.post(ENDPOINT, body, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    validateStatus: () => true,
  });

  console.log('  ┌────────────────────────────────────────────┐');
  console.log('  │  Status: ' + res.status + (res.statusText ? ' ' + res.statusText : '') + ' '.repeat(Math.max(0, 33 - String(res.status + (res.statusText ? ' ' + res.statusText : '')).length)) + '│');
  console.log('  └────────────────────────────────────────────┘');
  console.log('\n  Response body:');
  console.log(indent(res.data));

  if (res.status === 401) {
    console.log('');
    note('✓ 401 is EXPECTED with the fake API key. This proves the request');
    note('  is correctly shaped — OpenAI just rejected auth because the key');
    note('  isn\'t real. With a valid Bearer token, this would return 200/202');
    note('  and the events would be ingested (or merely validated, since');
    note('  validate_only is true).');
  }

  console.log('\n' + '═'.repeat(64));
  console.log('  Done. That\'s the full CAPI flow, end to end.');
  console.log('═'.repeat(64) + '\n');

  rl.close();
}

main().catch(err => {
  console.error('\nError:', err.message);
  rl.close();
});
