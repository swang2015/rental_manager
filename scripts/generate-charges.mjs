#!/usr/bin/env node
/**
 * Railway cron entrypoint: calls the idempotent charge-generation endpoint.
 *
 *   APP_URL=https://your-app.up.railway.app CRON_SECRET=... \
 *     node scripts/generate-charges.mjs [YYYY-MM]
 *
 * Omit the month to bill the current month.
 */
const baseUrl =
  process.env.APP_URL?.replace(/\/+$/, '') ??
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : undefined);
const secret = process.env.CRON_SECRET;

if (!baseUrl) {
  console.error('APP_URL (or RAILWAY_PUBLIC_DOMAIN) is required.');
  process.exit(1);
}
if (!secret) {
  console.error('CRON_SECRET is required.');
  process.exit(1);
}

const month = process.argv[2];
if (month && !/^\d{4}-\d{2}$/.test(month)) {
  console.error(`Invalid month "${month}", expected YYYY-MM.`);
  process.exit(1);
}

const url = new URL('/api/cron/generate-charges', baseUrl);
if (month) url.searchParams.set('month', month);

const response = await fetch(url, {
  headers: { Authorization: `Bearer ${secret}` },
});
const body = await response.text();

if (!response.ok) {
  console.error(`Charge generation failed (${response.status}): ${body}`);
  process.exit(1);
}

console.log(body);
