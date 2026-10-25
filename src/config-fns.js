import { createServerFn } from "@tanstack/react-start";
import { secrets } from "base44:runtime";
import { requireUser } from "@/lib/auth-middleware";

// Booleans only — never the secret values themselves.
export const integrationStatus = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async () => ({
    github: Boolean(secrets.get("Github-acces-token") || secrets.get("GITHUB_TOKEN")),
    gemini: Boolean(secrets.get("GEMINI_API_KEY")),
    vercel: Boolean(secrets.get("VERCEL_TOKEN")),
  }));