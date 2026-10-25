import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { pushAppToNewRepo } from "@/lib/github-push.server";

export const pushAppToGitHub = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      name: z.string().max(90).optional(),
      isPrivate: z.boolean().optional(),
    }),
  )
  .handler(({ data }) => pushAppToNewRepo({ name: data?.name, isPrivate: data?.isPrivate ?? true }));