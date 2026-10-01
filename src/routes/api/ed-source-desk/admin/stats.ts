import { createFileRoute } from "@tanstack/react-router";

// Owner-only usage and quality summary (same bearer token as the admin import; 404 without one).
// GET /api/ed-source-desk/admin/stats?days=7 → lookups by mode, no-answer rate, latency, tokens, AI check failures, feedback.
export const Route = createFileRoute("/api/ed-source-desk/admin/stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateAdmin } = await import("@/lib/handbook-import.server");
        const denied = await authenticateAdmin(request);
        if (denied) return denied;
        const n = Number(new URL(request.url).searchParams.get("days") ?? 7);
        const days = Number.isFinite(n) ? Math.min(90, Math.max(1, Math.floor(n))) : 7;
        const { usageSummary } = await import("@/lib/usage.server");
        try {
          return Response.json({ ok: true, ...(await usageSummary(days)) });
        } catch (e) {
          console.error("stats failed", e);
          return Response.json({ ok: false, error: e instanceof Error ? e.message : "stats failed" }, { status: 500 });
        }
      },
    },
  },
});
