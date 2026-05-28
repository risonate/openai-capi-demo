const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  API_BASE,
  dollarsToMicros,
  buildLaunchPlan,
  validateLaunchPlan,
  renderCurl,
} = require('./ads-api-workflow');

const root = __dirname;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

assert.strictEqual(API_BASE, 'https://api.ads.openai.com/v1');
assert.strictEqual(dollarsToMicros(25), 25_000_000);

const plan = buildLaunchPlan();
assert.strictEqual(plan.length, 6);
assert.deepStrictEqual(validateLaunchPlan(plan), []);
assert.ok(renderCurl(plan[4]).includes('POST "https://api.ads.openai.com/v1/ads"'));
assert.ok(plan[5].url.includes('/insights'));

const server = read('send-events.js');
const pixel = read('pixel.html');
const demo = read('demo.html');
const guide = read('DEMO_GUIDE.md');

assert.ok(server.includes('https://bzr.openai.com/v1/events?pid='));
assert.ok(server.includes('validate_only: true'));
assert.ok(server.includes('oppref'));
assert.ok(pixel.includes('event_id'));
assert.ok(pixel.includes('__oppref'));
assert.ok(demo.includes('Launch Readiness'));
assert.ok(guide.includes('OpenAI Ads Solutions Interview Demo'));

console.log('Smoke checks passed.');
