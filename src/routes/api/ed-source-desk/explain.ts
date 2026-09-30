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
        try {
          const { status, ...body } = await runExplain(parsed.data.q, includeStagedFor(import.meta.env.MODE, new URL(request.url).hostname));
          return Response.json(body, { status });
        } catch (e) {
          console.error("explain failed", e);
          return Response.json({ ok: false, error: e instanceof Error ? e.message : "explain failed" }, { status: 500 });
        }
      },
    },
  },
});
