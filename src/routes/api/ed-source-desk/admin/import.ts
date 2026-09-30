import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Admin-only handbook import. Returns 404 unless ED_SOURCE_DESK_ADMIN_TOKEN is set; the bearer token is compared timing-safely.
const Schema = z.object({
  action: z.enum(["dry-run", "import", "promote"]),
  source: z.string().default("fsa-hb-2026-27-vol7-ch2"),
  document_version_key: z.string().max(200).optional(),
  confirm_content_hash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
});

export const Route = createFileRoute("/api/ed-source-desk/admin/import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateAdmin, runHandbookImport } = await import("@/lib/handbook-import.server");
        const denied = await authenticateAdmin(request);
        if (denied) return denied;
        const parsed = Schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ ok: false, error: 'Body must be {"action":"dry-run"|"import"|"promote", "source"?, "document_version_key"?, "confirm_content_hash"?}.' }, { status: 400 });
        const { findHandbookSource } = await import("@/data/ed-source-desk/handbook-sources");
        const source = findHandbookSource(parsed.data.source);
        if (!source) return Response.json({ ok: false, error: `unknown source ${parsed.data.source}` }, { status: 400 });
        try {
          const { status, ...body } = await runHandbookImport(source, parsed.data.action, parsed.data.document_version_key, parsed.data.confirm_content_hash);
          return Response.json(body, { status });
        } catch (e) {
          console.error("handbook import failed", e);
          return Response.json({ ok: false, error: e instanceof Error ? e.message : "import failed" }, { status: 500 });
        }
      },
    },
  },
});
