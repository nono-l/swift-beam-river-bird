import { createFileRoute } from "@tanstack/react-router";
import { handleMigrateRequest } from "@/server/migrate.server";

export const Route = createFileRoute("/api/migrate")({
  server: { handlers: { POST: ({ request }) => handleMigrateRequest(request) } },
});
