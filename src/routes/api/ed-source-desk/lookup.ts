import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Schema = z.union([
  z.object({ mode: z.literal("ecfr-section"), title: z.string().regex(/^\d{1,2}$/).optional(), section: z.string().regex(/^\d{1,4}\.\d{1,4}[a-z]?$/) }),
  z.object({ mode: z.literal("fr-doc"), document_number: z.string().regex(/^\d{4}-\d{3,6}$/) }),
  z.object({ mode: z.literal("reggov-doc"), document_id: z.string().regex(/^[A-Z0-9-]{5,60}$/i) }),
  z.object({ mode: z.literal("fr-search"), q: z.string().trim().min(2).max(300), per_page: z.number().int().min(1).max(10).optional() }),
  z.object({ q: z.string().trim().min(2).max(500) }),
]);

export const Route = createFileRoute("/api/ed-source-desk/lookup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null);
        const parsed = Schema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ ok: false, error: "Please enter a question between 2 and 500 characters." }, { status: 400 });
        }
        const { lookup } = await import("@/lib/ed-source-desk.server");
        const { includeStagedFor } = await import("@/lib/handbook-lookup");
        const { logUsage, overDailyCap } = await import("@/lib/usage.server");
        const { LOOKUP_CAP_MESSAGE, storableQuestion } = await import("@/lib/usage");
        const question = "q" in parsed.data ? parsed.data.q : null;
        // Staged (unreviewed) handbook rows only in preview builds (development mode) or on known preview hosts, never the published site.
        const host = new URL(request.url).hostname;
        const includeStaged = includeStagedFor(import.meta.env.MODE, host);
        if (await overDailyCap("lookups")) {
          await logUsage({ kind: "lookup", ok: false, capped: true, staged: includeStaged });
          return Response.json({ ok: false, capped: true, error: LOOKUP_CAP_MESSAGE }, { status: 429 });
        }
        const started = Date.now();
        const result = (await lookup(parsed.data, { includeStaged })) as {
          ok: boolean; http_status?: number; mode?: string; refuse?: boolean; handbook_embedding_tokens?: number | null;
        };
        await logUsage({
          kind: "lookup", ok: result.ok, mode: result.mode ?? null, refused: !!result.refuse, staged: includeStaged,
          latency_ms: Date.now() - started, embedding_tokens: result.handbook_embedding_tokens ?? null,
          question: storableQuestion(question, !!result.refuse),
        });
        // Which build and address answered, so a reviewer can tell a preview from the published site.
        Object.assign(result, { served_by: { build_mode: import.meta.env.MODE, host, staged_included: includeStaged } });
        const hs = result.http_status ?? 500;
        const status = result.ok ? 200 : hs === 503 ? 503 : hs >= 400 && hs !== 500 ? 502 : 500;
        return Response.json(result, { status });
      },
    },
  },
});
