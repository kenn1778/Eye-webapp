# GA4 readback smoke test: runs the app's exact credentials against the
# property and prints row-level numbers (no key material).
set -euo pipefail
cd /opt/eye/backend
GA4_PROPERTY_ID=$(grep '^GA4_PROPERTY_ID=' .env | head -1 | cut -d= -f2- | tr -d '\r')
export GA4_KEY_FILE=secrets/ga4-key.json
export GA4_PROPERTY_ID="$GA4_PROPERTY_ID"
node --input-type=module <<'NODESCRIPT'
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { readFileSync } from "node:fs";
const creds = JSON.parse(readFileSync(process.env.GA4_KEY_FILE, "utf8"));
const client = new BetaAnalyticsDataClient({
  credentials: { client_email: creds.client_email, private_key: creds.private_key },
});
const propertyId = process.env.GA4_PROPERTY_ID;
console.log("property:", propertyId, "| account:", creds.client_email.split("@")[0].slice(0, 10) + "...");
const [resp] = await client.runReport({
  property: "properties/" + propertyId,
  dateRanges: [{ startDate: "27daysAgo", endDate: "today" }],
  dimensions: [{ name: "date" }],
  metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
  orderBys: [{ dimension: { dimensionName: "date" } }],
});
const sum = (rows, idx) => (rows ?? []).reduce((a, r) => a + Number(r.metricValues[idx].value), 0);
console.log("rowcount (days with data):", resp.rowCount ?? 0);
console.log("totals in window:", sum(resp.rows, 0), "activeUsers /", sum(resp.rows, 1), "pageViews");
const [rt] = await client.runReport({
  property: "properties/" + propertyId,
  dateRanges: [{ startDate: "today", endDate: "today" }],
  dimensions: [{ name: "date" }],
  metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
});
console.log("today so far:", sum(rt.rows, 0), "activeUsers /", sum(rt.rows, 1), "pageViews");
console.log("GA4 READBACK OK");
NODESCRIPT
