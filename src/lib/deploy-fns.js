import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { secrets } from "base44:runtime";
import { requireUser } from "@/lib/auth-middleware";

const VERCEL = "https://api.vercel.com";

function vercelToken() {
  const token = secrets.get("VERCEL_TOKEN");
  if (!token) throw Object.assign(new Error("Vercel token is not configured on the server yet."), { status: 400 });
  return token;
}

async function vercel(path, { method = "GET", body } = {}) {
  const res = await fetch(`${VERCEL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${vercelToken()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const error = new Error(data?.error?.message || data?.message || `Vercel API error (${res.status}).`);
    error.status = res.status;
    error.code = data?.error?.code;
    throw error;
  }
  return data;
}

export const vercelDeploy = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      owner: z.string().min(1).max(120),
      repo: z.string().min(1).max(120),
      repoId: z.number().int().positive().optional(),
      projectName: z
        .string()
        .min(1)
        .max(90)
        .regex(/^[a-z0-9][a-z0-9-]*$/, "Project names use lowercase letters, numbers and dashes."),
      branch: z.string().min(1).max(120),
      framework: z.string().max(40).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const slug = data.projectName;
    let project = null;
    try {
      project = await vercel(`/v9/projects/${encodeURIComponent(slug)}`);
    } catch (error) {
      if (error.status !== 404) throw error;
    }

    if (!project) {
      project = await vercel("/v11/projects", {
        method: "POST",
        body: {
          name: slug,
          ...(data.framework ? { framework: data.framework } : {}),
          gitRepository: { type: "github", repo: `${data.owner}/${data.repo}` },
        },
      });
    }

    const deployment = await vercel("/v13/deployments", {
      method: "POST",
      body: {
        name: slug,
        project: project.id,
        target: "production",
        gitSource: {
          type: "github",
          ...(data.repoId ? { repoId: data.repoId } : { org: data.owner, repo: data.repo }),
          ref: data.branch,
        },
      },
    });

    return {
      projectId: project.id,
      deploymentId: deployment.id,
      url: deployment.url ? `https://${deployment.url}` : null,
      state: deployment.readyState || deployment.status || "QUEUED",
      inspector: `https://vercel.com/${project.accountId || ""}/${slug}/deployments`,
    };
  });

export const vercelStatus = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(z.object({ deploymentId: z.string().min(3).max(120) }))
  .handler(async ({ data }) => {
    const deployment = await vercel(`/v13/deployments/${encodeURIComponent(data.deploymentId)}`);
    return {
      state: deployment.readyState || deployment.status || "QUEUED",
      url: deployment.url ? `https://${deployment.url}` : null,
      error: deployment.errorMessage || null,
      logsUrl: deployment.inspectorUrl || null,
    };
  });