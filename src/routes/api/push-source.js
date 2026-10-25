import { createFileRoute } from "@tanstack/react-router";
import { secrets } from "base44:runtime";
import { requireUserRoute } from "@/lib/auth-middleware";
import { pushAppToNewRepo } from "@/lib/github-push.server";
import { appSourceFiles } from "@/lib/source-bundle.server";

export const Route = createFileRoute("/api/push-source")({
  server: {
    middleware: [requireUserRoute],
    handlers: {
      GET: async () => {
        const files = appSourceFiles();
        return Response.json({
          files: files.length,
          bytes: files.reduce((sum, file) => sum + file.content.length, 0),
        });
      },
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const result = await pushAppToNewRepo({
          name: typeof body?.name === "string" ? body.name : undefined,
          isPrivate: body?.isPrivate !== false,
        });
        return Response.json(result);
      },
    },
  },
});