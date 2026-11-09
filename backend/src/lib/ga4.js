// Google Analytics 4 readback (Google Analytics Data API).
//
// The site collects real visitor behaviour with the GA4 tag; this module reads
// aggregated numbers back server-side so the admin dashboard shows them next
// to the database counts. Read-only: the service account needs exactly one
// role - Viewer on the GA4 property - nothing in Google Cloud beyond that.
//
// Inert until GA4_PROPERTY_ID (the numeric property id) and GA4_KEY_FILE (a
// service-account JSON on disk) are both set. Everything throws a clean,
// single-word error upstream otherwise.
import { existsSync, readFileSync } from "node:fs";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { config } from "../config.js";
import { logger } from "./logger.js";

let client = null;

function dataClient() {
  if (client) return client;
  const keyFile = config.ga4KeyFile;
  if (!keyFile || !existsSync(keyFile)) {
    throw new Error("GA4_KEY_FILE_MISSING");
  }
  // Validate up front so an invalid key file fails in one clear place instead
  // of surfacing as a gRPC auth error. keyFilename is the supported,
  // deprecation-free way to hand the JSON straight to the client.
  const creds = JSON.parse(readFileSync(keyFile, "utf8"));
  if (!creds.client_email || !creds.private_key) {
    throw new Error("GA4_KEY_FILE_INVALID");
  }
  client = new BetaAnalyticsDataClient({ keyFilename: keyFile });
  return client;
}

export function ga4Enabled() {
  return Boolean(config.ga4PropertyId && config.ga4KeyFile && existsSync(config.ga4KeyFile));
}

async function runReport(rows, logLabel) {
  try {
    const [response] = await dataClient().runReport(rows);
    return response;
  } catch (error) {
    // Quota/permission failures must never dump gRPC noise into the dashboard:
    // one warning line, one stable error tag.
    logger.warn({ err: error?.message, label: logLabel }, "[eye:ga4] report failed");
    throw new Error(`GA4_${logLabel.toUpperCase()}_FAILED`);
  }
}

// One dashboard read: totals, daily series, top pages and source channels.
// The series always spans the full window with zero-fills, because GA omits
// dates without traffic and admin charts must not skew.
export async function fetchGaTraffic({ days = 28 } = {}) {
  if (!ga4Enabled()) throw new Error("GA4_NOT_CONFIGURED");
  const propertyId = config.ga4PropertyId;
  const window = { startDate: `${days - 1}daysAgo`, endDate: "today" };
  const base = { property: `properties/${propertyId}`, dateRanges: [window] };

  const totalsResp = await runReport({
    ...base,
    metrics: [
      { name: "activeUsers" },
      { name: "screenPageViews" },
      { name: "sessions" },
      { name: "newUsers" },
    ],
  }, "overview");

  const dailyResp = await runReport({
    ...base,
    dimensions: [{ name: "date" }],
    metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
  }, "daily");

  const pagesResp = await runReport({
    ...base,
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    limit: 8,
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
  }, "pages");

  const sourcesResp = await runReport({
    ...base,
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "activeUsers" }],
    limit: 6,
    orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
  }, "sources");

  const rowMetrics = (row) => row?.metricValues?.map((m) => Number(m.value ?? 0)) ?? [];
  const t = totalsResp.rows?.[0] ? rowMetrics(totalsResp.rows[0]) : [0, 0, 0, 0];

  const byDate = new Map();
  for (const row of dailyResp.rows ?? []) {
    const d = row.dimensionValues?.[0]?.value ?? "";
    if (/^\d{8}$/.test(d)) byDate.set(d, rowMetrics(row));
  }
  const series = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const dt = new Date(Date.now() - i * 86400000);
    const key = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}`;
    const [users = 0, views = 0] = byDate.get(key) ?? [];
    series.push({ date: key, users, views });
  }

  return {
    enabled: true,
    windowDays: days,
    totals: {
      visitors: t[0] ?? 0,
      pageViews: t[1] ?? 0,
      sessions: t[2] ?? 0,
      newVisitors: t[3] ?? 0,
    },
    series,
    topPages: (pagesResp.rows ?? []).map((row) => ({
      path: row.dimensionValues?.[0]?.value ?? "",
      views: rowMetrics(row)[0] ?? 0,
    })),
    sources: (sourcesResp.rows ?? []).map((row) => ({
      source: row.dimensionValues?.[0]?.value ?? "Direct",
      users: rowMetrics(row)[0] ?? 0,
    })),
  };
}
