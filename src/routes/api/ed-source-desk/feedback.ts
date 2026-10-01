import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Public "Was this helpful?" feedback. Stored server-side only (ed_feedback, service_role); daily-capped.
const Schema = z.object({
  helpful: z.boolean(),
  q: z.string().trim().max(500).optional(),
  lookup_mode: z.string().max(40).optional(),
  citation_id: z.string().max(200).optional(),
  comment: z.string().trim().max(500).optional(),
});

export const Route = createFileRoute("/api/ed-source-desk/feedback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ ok: false, error: "Feedback must include helpful: true or false (comment up to 500 characters)." }, { status: 400 });
        const { overDailyCap, saveFeedback } = await import("@/lib/usage.server");
        const { storableQuestion } = await import("@/lib/usage");
        const { detectRefuse } = await import("@/lib/ed-source-desk.server");
        if (await overDailyCap("feedback")) return Response.json({ ok: false, error: "Thanks — feedback is paused for today." }, { status: 429 });
        const d = parsed.data;
        try {
          await saveFeedback({
            helpful: d.helpful, lookup_mode: d.lookup_mode ?? null, citation_id: d.citation_id ?? null,
            question: storableQuestion(d.q, !!d.q && detectRefuse(d.q) !== null), comment: d.comment || null,
          });
          return Response.json({ ok: true });
        } catch (e) {
          console.error("feedback save failed", e);
          return Response.json({ ok: false, error: "Couldn't save feedback. Please try again." }, { status: 500 });
        }
      },
    },
  },
});
