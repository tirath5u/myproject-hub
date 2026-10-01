// Server-only: usage log, daily caps and feedback (tables ed_usage_log / ed_feedback, service_role only).
// Logging and cap checks fail open: a monitoring outage never blocks a lookup, it only logs to the console.
import type { SupabaseClient } from "@supabase/supabase-js";
import { capsFrom, startOfUtcDay, summarizeUsage, type FeedbackRow, type UsageRow } from "@/lib/usage";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The generated types don't include these tables yet.
  return supabaseAdmin as unknown as SupabaseClient;
}

export type UsageEntry = Partial<Omit<UsageRow, "created_at" | "kind" | "ok">> & Pick<UsageRow, "kind" | "ok">;
export async function logUsage(entry: UsageEntry) {
  try {
    const { error } = await (await db()).from("ed_usage_log").insert(entry);
    if (error) console.error("usage log insert failed", error.message);
  } catch (e) {
    console.error("usage log insert failed", e);
  }
}

/** Is today's (UTC) limit reached? `lookups` counts lookups; `ai_tokens` sums explanation and comparison tokens; `feedback` counts feedback rows. */
export async function overDailyCap(which: "lookups" | "ai_tokens" | "feedback", now = new Date()) {
  const caps = capsFrom(process.env);
  const since = startOfUtcDay(now);
  try {
    const client = await db();
    if (which === "ai_tokens") {
      const { data, error } = await client.from("ed_usage_log").select("ai_tokens").in("kind", ["explain", "compare"]).gte("created_at", since).limit(10_000);
      if (error) throw new Error(error.message);
      return (data as { ai_tokens: number | null }[]).reduce((a, r) => a + (r.ai_tokens ?? 0), 0) >= caps.ai_tokens;
    }
    const q = which === "lookups"
      ? client.from("ed_usage_log").select("id", { count: "exact", head: true }).eq("kind", "lookup").eq("capped", false).gte("created_at", since)
      : client.from("ed_feedback").select("id", { count: "exact", head: true }).gte("created_at", since);
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return (count ?? 0) >= caps[which];
  } catch (e) {
    console.error(`daily cap check (${which}) failed; allowing`, e);
    return false;
  }
}

export async function saveFeedback(row: Omit<FeedbackRow, "created_at">) {
  const { error } = await (await db()).from("ed_feedback").insert(row);
  if (error) throw new Error(error.message);
}

export async function usageSummary(days: number) {
  const client = await db();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [u, f] = await Promise.all([
    client.from("ed_usage_log").select("created_at, kind, ok, mode, refused, capped, check_failed, staged, latency_ms, embedding_tokens, ai_tokens, question")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(20_000),
    client.from("ed_feedback").select("created_at, helpful, lookup_mode, citation_id, question, comment")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(5_000),
  ]);
  if (u.error) throw new Error(u.error.message);
  if (f.error) throw new Error(f.error.message);
  return { ...summarizeUsage(u.data as UsageRow[], f.data as FeedbackRow[], days), caps: capsFrom(process.env), generated_at: new Date().toISOString() };
}
