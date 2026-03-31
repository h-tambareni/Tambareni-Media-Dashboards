import { isSupabaseConfigured } from "./supabase";

const PUB_ID = import.meta.env.VITE_BEEHIIV_PUB_ID || "";

/** Call Beehiiv API through the Supabase Edge Function proxy. */
async function beehiivFetch(path, params = {}) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
  const { data, error } = await supabase.functions.invoke("beehiiv-proxy", {
    body: { path, params },
  });
  if (error) throw new Error(error.message || "Beehiiv proxy error");
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Fetch paginated subscriber list. Returns { data: [...], total_results }. */
export async function fetchSubscribers({ status, limit = 100, page = 1 } = {}) {
  if (!PUB_ID) throw new Error("VITE_BEEHIIV_PUB_ID not set");
  const params = { limit: String(limit), page: String(page) };
  if (status) params.status = status;
  return beehiivFetch(`/publications/${PUB_ID}/subscriptions`, params);
}

/** Fetch all subscribers by paginating through. Returns full array. */
export async function fetchAllSubscribers(status = "active") {
  const all = [];
  let page = 1;
  let total = Infinity;
  while (all.length < total) {
    const res = await fetchSubscribers({ status, limit: 100, page });
    const subs = res?.data || [];
    total = res?.total_results ?? subs.length;
    if (!subs.length) break;
    all.push(...subs);
    page++;
    if (subs.length < 100) break;
  }
  return { subscribers: all, total };
}

/** Fetch subscriber stats summary. */
export async function fetchSubscriberStats() {
  if (!PUB_ID) throw new Error("VITE_BEEHIIV_PUB_ID not set");
  // Get active count via a small page request
  const active = await fetchSubscribers({ status: "active", limit: 1, page: 1 });
  const inactive = await fetchSubscribers({ status: "inactive", limit: 1, page: 1 });
  // Get recent subscribers for the list
  const recent = await fetchSubscribers({ limit: 20, page: 1 });
  return {
    activeCount: active?.total_results ?? 0,
    inactiveCount: inactive?.total_results ?? 0,
    totalCount: (active?.total_results ?? 0) + (inactive?.total_results ?? 0),
    recentSubscribers: recent?.data || [],
  };
}

export function isBeehiivConfigured() {
  return !!PUB_ID && isSupabaseConfigured();
}
