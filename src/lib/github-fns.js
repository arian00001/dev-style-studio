import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { API, fetchJobLog, gh, ghOptional, githubToken, mapRepo, mapRun } from "@/lib/github.server";

const repoSchema = z.object({
  owner: z.string().min(1).max(120),
  repo: z.string().min(1).max(120),
});

export const githubIdentity = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async () => {
    const user = await gh("/user");
    return { login: user.login, name: user.name || user.login, avatar_url: user.avatar_url, html_url: user.html_url };
  });

export const listRepos = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(z.object({ page: z.number().int().min(1).max(40).optional() }))
  .handler(async ({ data }) => {
    const page = data?.page ?? 1;
    const repos = await gh(
      `/user/repos?per_page=50&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
    );
    return { repos: repos.map(mapRepo), hasMore: repos.length === 50 };
  });

export const listBranches = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(repoSchema)
  .handler(async ({ data }) => {
    const branches = await gh(`/repos/${data.owner}/${data.repo}/branches?per_page=100`);
    return { branches: branches.map((b) => b.name) };
  });

export const createRepo = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      name: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[A-Za-z0-9._-]+$/, "Use letters, numbers, dots, dashes or underscores only."),
      isPrivate: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const repo = await gh("/user/repos", {
      method: "POST",
      body: { name: data.name, private: data.isPrivate, auto_init: false },
    });
    return { repo: mapRepo(repo) };
  });

export const deleteRepo = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(repoSchema.extend({ confirm: z.literal(true) }))
  .handler(async ({ data }) => {
    await gh(`/repos/${data.owner}/${data.repo}`, { method: "DELETE" });
    return { deleted: true };
  });

export const createBlobs = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      owner: z.string().min(1).max(120),
      repo: z.string().min(1).max(120),
      files: z
        .array(z.object({ path: z.string().min(1).max(400), content: z.string().max(8_000_000) }))
        .min(1)
        .max(25),
    }),
  )
  .handler(async ({ data }) => {
    const created = [];
    const queue = [...data.files];
    const worker = async () => {
      for (;;) {
        const file = queue.shift();
        if (!file) return;
        const blob = await gh(`/repos/${data.owner}/${data.repo}/git/blobs`, {
          method: "POST",
          body: { content: file.content, encoding: "base64" },
        });
        created.push({ path: file.path, sha: blob.sha });
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, data.files.length) }, worker));
    return { files: created };
  });

export const commitPush = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      owner: z.string().min(1).max(120),
      repo: z.string().min(1).max(120),
      branch: z.string().min(1).max(120),
      message: z.string().min(1).max(300),
      entries: z
        .array(z.object({ path: z.string().min(1).max(400), sha: z.string().min(10).max(80) }))
        .min(1)
        .max(20000),
    }),
  )
  .handler(async ({ data }) => {
    const { owner, repo, branch } = data;
    const meta = await gh(`/repos/${owner}/${repo}`);

    const ref = await ghOptional(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);

    let parentSha = ref?.object?.sha ?? null;
    if (!parentSha) {
      const fallback = await ghOptional(
        `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(meta.default_branch)}`,
      );
      parentSha = fallback?.object?.sha ?? null;
    }

    let baseTree = null;
    if (parentSha) {
      const parentCommit = await ghOptional(`/repos/${owner}/${repo}/git/commits/${parentSha}`);
      baseTree = parentCommit?.tree?.sha ?? null;
    }

    const tree = await gh(`/repos/${owner}/${repo}/git/trees`, {
      method: "POST",
      body: {
        tree: data.entries.map((entry) => ({
          path: entry.path,
          mode: "100644",
          type: "blob",
          sha: entry.sha,
        })),
        ...(baseTree ? { base_tree: baseTree } : {}),
      },
    });

    const commit = await gh(`/repos/${owner}/${repo}/git/commits`, {
      method: "POST",
      body: {
        message: data.message,
        tree: tree.sha,
        parents: parentSha ? [parentSha] : [],
      },
    });

    if (ref) {
      await gh(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
        method: "PATCH",
        body: { sha: commit.sha, force: false },
      });
    } else {
      await gh(`/repos/${owner}/${repo}/git/refs`, {
        method: "POST",
        body: { ref: `refs/heads/${branch}`, sha: commit.sha },
      });
    }

    return {
      commit: commit.sha,
      branch,
      html_url: `${meta.html_url}/commit/${commit.sha}`,
      repo_url: meta.html_url,
    };
  });

export const getFileContent = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(
    repoSchema.extend({ path: z.string().min(1).max(400), ref: z.string().min(1).max(120) }),
  )
  .handler(async ({ data }) => {
    const res = await fetch(`${API}/repos/${data.owner}/${data.repo}/contents/${data.path}?ref=${data.ref}`, {
      headers: {
        Authorization: `Bearer ${githubToken()}`,
        Accept: "application/vnd.github.raw",
        "User-Agent": "dev-style-studio",
      },
    });
    if (!res.ok) throw Object.assign(new Error(`Could not read ${data.path} (${res.status}).`), { status: res.status });
    const text = await res.text();
    return { path: data.path, content: text.slice(0, 60000) };
  });

export const listWorkflows = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(repoSchema)
  .handler(async ({ data }) => {
    const result = await gh(`/repos/${data.owner}/${data.repo}/actions/workflows?per_page=50`);
    return {
      workflows: (result.workflows || []).map((w) => ({
        id: w.id,
        name: w.name,
        path: w.path,
        state: w.state,
      })),
    };
  });

export const listRuns = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(repoSchema.extend({ branch: z.string().min(1).max(120).optional() }))
  .handler(async ({ data }) => {
    const qs = data.branch ? `?per_page=8&branch=${encodeURIComponent(data.branch)}` : "?per_page=8";
    const result = await gh(`/repos/${data.owner}/${data.repo}/actions/runs${qs}`);
    return { runs: (result.workflow_runs || []).map(mapRun) };
  });

export const dispatchWorkflow = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(repoSchema.extend({ workflowId: z.number().int().positive(), ref: z.string().min(1).max(120) }))
  .handler(async ({ data }) => {
    await gh(`/repos/${data.owner}/${data.repo}/actions/workflows/${data.workflowId}/dispatches`, {
      method: "POST",
      body: { ref: data.ref },
    });
    return { dispatched: true };
  });

export const runDetail = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(repoSchema.extend({ runId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const base = `/repos/${data.owner}/${data.repo}/actions/runs/${data.runId}`;
    const run = await gh(base);
    const jobs = await gh(`${base}/jobs?per_page=30`);
    const artifacts = await gh(`${base}/artifacts?per_page=30`);
    return {
      run: mapRun(run),
      jobs: (jobs.jobs || []).map((job) => ({
        id: job.id,
        name: job.name,
        status: job.status,
        conclusion: job.conclusion,
        started_at: job.started_at,
        completed_at: job.completed_at,
        html_url: job.html_url,
      })),
      artifacts: (artifacts.artifacts || []).map((a) => ({
        id: a.id,
        name: a.name,
        size_in_bytes: a.size_in_bytes,
        expired: a.expired,
        download_url: a.archive_download_url,
        html_url: a.archive_download_url,
      })),
    };
  });

export const jobLog = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(repoSchema.extend({ jobId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const text = await fetchJobLog(data.owner, data.repo, data.jobId);
    return { log: text.slice(-80000) };
  });

export const enablePages = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(repoSchema.extend({ branch: z.string().min(1).max(120) }))
  .handler(async ({ data }) => {
    const body = { source: { branch: data.branch, path: "/" } };
    const existing = await ghOptional(`/repos/${data.owner}/${data.repo}/pages`);
    if (!existing) {
      try {
        await gh(`/repos/${data.owner}/${data.repo}/pages`, { method: "POST", body });
      } catch (error) {
        if (error.status === 409) {
          await gh(`/repos/${data.owner}/${data.repo}/pages`, { method: "PUT", body });
        } else {
          throw error;
        }
      }
    } else {
      await gh(`/repos/${data.owner}/${data.repo}/pages`, { method: "PUT", body });
    }
    const pages = await gh(`/repos/${data.owner}/${data.repo}/pages`);
    return { url: pages.html_url, status: pages.status };
  });

export const pagesStatus = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(repoSchema)
  .handler(async ({ data }) => {
    const pages = await ghOptional(`/repos/${data.owner}/${data.repo}/pages`);
    if (!pages) return { url: null, status: "not_configured" };
    return { url: pages.html_url, status: pages.status };
  });

export const releaseApk = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    repoSchema.extend({
      artifactId: z.number().int().positive(),
      tag: z.string().min(1).max(60),
      title: z.string().min(1).max(120),
      notes: z.string().max(4000).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { owner, repo } = data;
    const artifact = await gh(`/repos/${owner}/${repo}/actions/artifacts/${data.artifactId}/zip`, {
      accept: "application/vnd.github+json",
    });
    void artifact;

    const zipRes = await fetch(`${API}/repos/${owner}/${repo}/actions/artifacts/${data.artifactId}/zip`, {
      headers: { Authorization: `Bearer ${githubToken()}`, "User-Agent": "dev-style-studio" },
      redirect: "follow",
    });
    if (!zipRes.ok) throw new Error(`Could not download the build artifact (${zipRes.status}).`);
    const buffer = await zipRes.arrayBuffer();
    if (buffer.byteLength > 180 * 1024 * 1024) {
      throw new Error("This artifact is too large to repackage as a release asset.");
    }

    const bytes = new Uint8Array(buffer);
    const target = findApkEntry(bytes);
    if (!target) throw new Error("No .apk file was found inside the build artifact.");

    const release = await gh(`/repos/${owner}/${repo}/releases`, {
      method: "POST",
      body: {
        tag_name: data.tag,
        name: data.title,
        body: data.notes || "Built with Dev Style Studio.",
        draft: false,
        prerelease: false,
      },
    });

    const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(target.name)}`;
    const upload = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken()}`,
        "Content-Type": "application/vnd.android.package-archive",
        "User-Agent": "dev-style-studio",
      },
      body: target.bytes,
    });
    if (!upload.ok) {
      const detail = await upload.text();
      throw new Error(`Release created, but the APK upload failed (${upload.status}). ${detail.slice(0, 200)}`);
    }

    return {
      release_url: release.html_url,
      tag: data.tag,
      asset_name: target.name,
      size_in_bytes: target.bytes.length,
    };
  });

// Reads the central directory of the artifact zip and inflates the first .apk entry.
function findApkEntry(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();

  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLen));
    offset += 46 + nameLen + extraLen + commentLen;

    if (!/\.apk$/i.test(name)) continue;

    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(start, start + compressedSize);
    if (method !== 0) return null;

    return { name: name.split("/").pop(), bytes: raw };
  }
  return null;
}