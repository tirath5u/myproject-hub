import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Owner-only model comparison (same bearer token as the admin import; 404 without one).
// Runs one lookup, explains the same sources with each model, checks and rubric-grades every reply with a judge model.
const MODEL = z.string().regex(/^[a-z0-9-]+\/[a-z0-9.\-]+$/i).max(80);
const Schema = z.object({ q: z.string().trim().min(2).max(500), models: z.array(MODEL).min(1).max(3).optional(), judge: MODEL.optional() });

export const Route = createFileRoute("/api/ed-source-desk/admin/compare")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateAdmin } = await import("@/lib/handbook-import.server");
        const denied = await authenticateAdmin(request);
        if (denied) return denied;
        const parsed = Schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ ok: false, error: 'Body must be {"q": string, "models"?: string[] (1-3), "judge"?: string}.' }, { status: 400 });
        const { runCompare } = await import("@/lib/explain.server");
        const { includeStagedFor } = await import("@/lib/handbook-lookup");
        const { logUsage, overDailyCap } = await import("@/lib/usage.server");
        const { AI_CAP_MESSAGE, compareTokens, storableQuestion } = await import("@/lib/usage");
        const staged = includeStagedFor(import.meta.env.MODE, new URL(request.url).hostname);
        if (await overDailyCap("ai_tokens")) {
          await logUsage({ kind: "compare", ok: false, capped: true, staged });
          return Response.json({ ok: false, capped: true, error: AI_CAP_MESSAGE }, { status: 429 });
        }
        const started = Date.now();
        try {
          const { status, ...body } = await runCompare(parsed.data.q, staged, parsed.data.models, parsed.data.judge);
          await logUsage({
            kind: "compare", ok: body.ok, mode: typeof body.lookup_mode === "string" ? body.lookup_mode : null, staged,
            ai_tokens: compareTokens(body.models as { tokens?: unknown; judge_tokens?: unknown }[]), latency_ms: Date.now() - started,
            question: storableQuestion(parsed.data.q, false),
          });
          return Response.json(body, { status });
        } catch (e) {
          console.error("compare failed", e);
          return Response.json({ ok: false, error: e instanceof Error ? e.message : "compare failed" }, { status: 500 });
        }
      },
    },
  },
});
