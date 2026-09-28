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
        const result = await lookup(parsed.data);
        const status = result.ok ? 200 : result.http_status && result.http_status >= 400 ? (result.http_status === 503 ? 503 : 502) : 500;
        return Response.json(result, { status });
      },
    },
  },
});
