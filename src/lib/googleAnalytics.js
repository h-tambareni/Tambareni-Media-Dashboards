import { isSupabaseConfigured } from "./supabase";

const PROPERTY_ID = import.meta.env.VITE_GA_PROPERTY_ID || "";

/** Call GA4 Data API through the Supabase Edge Function proxy (service account auth). */
async function gaFetch(reportType, body) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
  if (!PROPERTY_ID) throw new Error("VITE_GA_PROPERTY_ID not set");
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
  const { data, error } = await supabase.functions.invoke("ga-proxy", {
    body: { propertyId: PROPERTY_ID, reportType, body },
  });
  if (error) throw new Error(error.message || "GA proxy error");
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Parse GA4 runReport response into simple rows. */
function parseReport(data) {
  const headers = (data?.dimensionHeaders || []).map((h) => h.name);
  const metricHeaders = (data?.metricHeaders || []).map((h) => h.name);
  return (data?.rows || []).map((row) => {
    const obj = {};
    (row.dimensionValues || []).forEach((v, i) => {
      obj[headers[i]] = v.value;
    });
    (row.metricValues || []).forEach((v, i) => {
      obj[metricHeaders[i]] = Number(v.value) || 0;
    });
    return obj;
  });
}

/** Get overview KPIs for a date range. */
export async function fetchGAOverview(startDate = "30daysAgo", endDate = "today") {
  const data = await gaFetch("report", {
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: "activeUsers" },
      { name: "screenPageViews" },
      { name: "sessions" },
      { name: "averageSessionDuration" },
      { name: "bounceRate" },
      { name: "newUsers" },
      { name: "eventCount" },
    ],
  });
  const rows = parseReport(data);
  // Single-row summary (no dimensions)
  const r = rows[0] || {};
  return {
    activeUsers: r.activeUsers || 0,
    pageViews: r.screenPageViews || 0,
    sessions: r.sessions || 0,
    avgSessionDuration: r.averageSessionDuration || 0,
    bounceRate: r.bounceRate || 0,
    newUsers: r.newUsers || 0,
    eventCount: r.eventCount || 0,
  };
}

/** Get top pages. */
export async function fetchGATopPages(startDate = "30daysAgo", endDate = "today", limit = 10) {
  const data = await gaFetch("report", {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "pagePath" }],
    metrics: [
      { name: "screenPageViews" },
      { name: "activeUsers" },
    ],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit,
  });
  return parseReport(data);
}

/** Get traffic sources / channels. */
export async function fetchGATrafficSources(startDate = "30daysAgo", endDate = "today") {
  const data = await gaFetch("report", {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [
      { name: "sessions" },
      { name: "activeUsers" },
    ],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 10,
  });
  return parseReport(data);
}

/** Get daily pageviews/users for a date range (for chart). */
export async function fetchGADaily(startDate = "30daysAgo", endDate = "today") {
  const data = await gaFetch("report", {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "screenPageViews" },
      { name: "activeUsers" },
      { name: "sessions" },
    ],
    orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
  });
  return parseReport(data).map((r) => ({
    ...r,
    // GA returns date as YYYYMMDD — format for display
    dateLabel: r.date ? `${r.date.slice(4, 6)}/${r.date.slice(6, 8)}` : r.date,
  }));
}

/** Get country breakdown. */
export async function fetchGACountries(startDate = "30daysAgo", endDate = "today") {
  const data = await gaFetch("report", {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "country" }],
    metrics: [{ name: "activeUsers" }],
    orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    limit: 10,
  });
  return parseReport(data);
}

/** Get realtime active users. */
export async function fetchGARealtime() {
  const data = await gaFetch("realtime", {
    metrics: [{ name: "activeUsers" }],
  });
  const rows = parseReport(data);
  return rows[0]?.activeUsers || 0;
}

/** Get referral sources (specific websites sending traffic). */
export async function fetchGAReferrals(startDate = "30daysAgo", endDate = "today") {
  const data = await gaFetch("report", {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "sessionSource" }],
    metrics: [
      { name: "sessions" },
      { name: "activeUsers" },
    ],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 10,
  });
  return parseReport(data);
}

export function isGAConfigured() {
  return !!PROPERTY_ID && isSupabaseConfigured();
}
