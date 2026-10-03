import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Owner-only AI explanation. Same bearer token as the admin import (404 when ED_SOURCE_DESK_ADMIN_TOKEN is unset).
// `question` is accepted as an alias of `q`.
const Schema = z.preprocess(
  (b) => (b && typeof b === "object" && !("q" in b) && "question" in b ? { q: (b as { question: unknown }).question } : b),
  z.object({ q: z.string().trim().min(2).max(500) }),
);

export const Route = createFileRoute("/api/ed-source-desk/explain")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateAdmin } = await import("@/lib/handbook-import.server");
        const denied = await authenticateAdmin(request);
        if (denied) return denied;
        const parsed = Schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ ok: false, error: "Please send a question between 2 and 500 characters." }, { status: 400 });
        const { runExplain } = await import("@/lib/explain.server");
        const { includeStagedFor } = await import("@/lib/handbook-lookup");
        const { logUsage, overDailyCap } = await import("@/lib/usage.server");
        const { AI_CAP_MESSAGE, storableQuestion } = await import("@/lib/usage");
        const { detectRefuse } = await import("@/lib/ed-source-desk.server");
        const staged = includeStagedFor(import.meta.env.MODE, new URL(request.url).hostname);
        if (await overDailyCap("ai_tokens")) {
          await logUsage({ kind: "explain", ok: false, capped: true, staged });
          return Response.json({ ok: true, capped: true, explanation: null, reason: AI_CAP_MESSAGE }, { status: 200 });
        }
        const started = Date.now();
        try {
          const { status, ...body } = await runExplain(parsed.data.q, staged);
          const b = body as { ok: boolean; tokens?: unknown; checks?: { ok: boolean }; lookup_mode?: unknown };
          await logUsage({
            kind: "explain", ok: b.ok, mode: typeof b.lookup_mode === "string" ? b.lookup_mode : null, staged,
            check_failed: b.checks ? !b.checks.ok : false, ai_tokens: typeof b.tokens === "number" ? b.tokens : null,
            latency_ms: Date.now() - started, question: storableQuestion(parsed.data.q, detectRefuse(parsed.data.q) !== null),
          });
          return Response.json(body, { status });
        } catch (e) {
          await logUsage({ kind: "explain", ok: false, staged, latency_ms: Date.now() - started });
          console.error("explain failed", e);
          return Response.json({ ok: false, error: e instanceof Error ? e.message : "explain failed" }, { status: 500 });
        }
      },
    },
  },
});
