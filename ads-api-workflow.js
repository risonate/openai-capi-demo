// ads-api-workflow.js - dry-run OpenAI Ads API launch workflow.
// Run with: node ads-api-workflow.js
//
// This intentionally makes no network calls. The Advertiser API creates live
// campaign objects, so the interview-safe version prints the exact request
// sequence and validates the payload contract locally.

const API_BASE = 'https://api.ads.openai.com/v1';
const AUTH_HEADER = 'Bearer <OPENAI_ADS_API_KEY>';

function dollarsToMicros(dollars) {
  return Math.round(dollars * 1_000_000);
}

function request(method, path, body, note) {
  return {
    method,
    url: `${API_BASE}${path}`,
    headers: {
      Authorization: AUTH_HEADER,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body,
    note,
  };
}

function buildLaunchPlan() {
  const accountId = 'act_demo';
  const campaignId = 'cmpn_demo_openai_ads';
  const adGroupId = 'adgrp_demo_contextual';
  const fileId = 'file_demo_card';
  const adId = 'ad_demo_measurement_card';

  return [
    request('GET', '/ad_account', null, 'Confirm the bearer token maps to the expected advertiser account.'),
    request('POST', '/upload', {
      image_url: 'https://example.com/assets/mattress-openai-card.png',
    }, 'Upload the creative asset and keep the returned file_id.'),
    request('POST', '/campaigns', {
      name: 'Back pain mattress spring launch',
      status: 'paused',
      budget: {
        lifetime_spend_limit_micros: dollarsToMicros(25),
      },
      targeting: {
        locations: { countries: ['US'] },
      },
    }, 'Create campaign paused first so measurement can be verified before spend.'),
    request('POST', '/ad_groups', {
      campaign_id: campaignId,
      name: 'US contextual intent - back pain mattress',
      status: 'paused',
      context_hints: [
        'back pain mattress recommendations',
        'medium firm mattress for side sleepers',
        'sleep posture and lumbar support',
      ],
      bidding_config: {
        billing_event_type: 'impression',
        max_bid_micros: 60_000,
      },
    }, 'Add contextual hints and bid controls inside the campaign.'),
    request('POST', '/ads', {
      ad_group_id: adGroupId,
      name: 'Hybrid mattress chat card',
      status: 'paused',
      creative: {
        type: 'chat_card',
        title: 'Find the right back-support mattress',
        body: 'Compare medium-firm hybrids with a 100-night trial.',
        target_url: 'https://shop.example.com/mattress?utm_source=chatgpt',
        file_id: fileId,
      },
    }, 'Create the chat_card ad and wait for review_status before activation.'),
    request(
      'GET',
      `/campaigns/${campaignId}/insights?time_granularity=daily&aggregation_level=ad&fields[]=ad_id&fields[]=clicks&fields[]=impressions&fields[]=conversions&fields[]=spend`,
      null,
      'Pull daily insights after launch and compare clicks/conversions to pixel and CAPI logs.'
    ),
  ].map((step, index) => ({
    step: index + 1,
    ...step,
    expected_response_id: [accountId, fileId, campaignId, adGroupId, adId, 'insights_rows'][index],
  }));
}

function validateLaunchPlan(plan) {
  const errors = [];
  const [account, upload, campaign, adGroup, ad, insights] = plan;

  if (account.method !== 'GET' || !account.url.endsWith('/ad_account')) {
    errors.push('Step 1 must confirm /ad_account access.');
  }
  if (!upload.body || !upload.body.image_url) {
    errors.push('Step 2 must upload a creative image URL.');
  }
  if (!campaign.body || campaign.body.status !== 'paused') {
    errors.push('Step 3 should create the campaign paused for launch readiness review.');
  }
  if (campaign.body.budget.lifetime_spend_limit_micros < 1_000_000) {
    errors.push('Campaign lifetime budget must meet the documented minimum.');
  }
  if (!adGroup.body.context_hints || adGroup.body.context_hints.length < 2) {
    errors.push('Ad group should include multiple context hints.');
  }
  if (ad.body.creative.type !== 'chat_card' || !ad.body.creative.file_id) {
    errors.push('Ad creative must be a chat_card that references an uploaded file_id.');
  }
  if (!insights.url.includes('/insights') || !insights.url.includes('conversions')) {
    errors.push('Final step must retrieve insights including conversions.');
  }

  return errors;
}

function renderCurl(step) {
  const lines = [
    `curl -X ${step.method} "${step.url}"`,
    `  -H "Authorization: Bearer $OPENAI_ADS_API_KEY"`,
  ];

  if (step.body) {
    lines.push('  -H "Content-Type: application/json"');
    lines.push(`  -d '${JSON.stringify(step.body, null, 2)}'`);
  } else {
    lines.push('  -H "Accept: application/json"');
  }

  return lines.join(' \\\n');
}

function printPlan(plan) {
  console.log('OpenAI Ads API dry-run: launch + insights workflow');
  console.log('No network calls are made. Review the requests, then run live only with an approved Ads Manager account.\n');

  plan.forEach(step => {
    console.log(`STEP ${step.step}: ${step.note}`);
    console.log(renderCurl(step));
    console.log(`Expected response handle: ${step.expected_response_id}\n`);
  });
}

if (require.main === module) {
  const plan = buildLaunchPlan();
  const errors = validateLaunchPlan(plan);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ ok: errors.length === 0, errors, plan }, null, 2));
    process.exit(errors.length ? 1 : 0);
  }

  printPlan(plan);
  if (errors.length) {
    console.error('Validation failed:');
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }
  console.log('Validation passed: launch plan is internally consistent.');
}

module.exports = {
  API_BASE,
  dollarsToMicros,
  buildLaunchPlan,
  validateLaunchPlan,
  renderCurl,
};
