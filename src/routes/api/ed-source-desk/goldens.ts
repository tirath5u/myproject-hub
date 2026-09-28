import { createFileRoute } from "@tanstack/react-router";
import { GOLDENS } from "@/data/ed-source-desk/goldens";

export const Route = createFileRoute("/api/ed-source-desk/goldens")({
  server: {
    handlers: {
      GET: async () => Response.json(GOLDENS),
    },
  },
});
