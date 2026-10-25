import { gh } from "@/lib/github.server";
import { appSourceFiles } from "@/lib/source-bundle.server";

const DESCRIPTION = "Dev Style Studio — mobile-first build studio (React + TanStack Start).";

function slugify(value) {
  return (
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "dev-style-studio"
  );
}

async function findRepo(owner, name) {
  try {
    return await gh(`/repos/${owner}/${name}`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

// Creates (or reuses) a repository and commits this app's source into it.
export async function pushAppToNewRepo({ name, isPrivate = true } = {}) {
  const repoName = slugify(name);
  const files = appSourceFiles();
  const me = await gh("/user");

  let repo = await findRepo(me.login, repoName);
  const created = !repo;
  if (!repo) {
    repo = await gh("/user/repos", {
      method: "POST",
      body: { name: repoName, private: Boolean(isPrivate), auto_init: true, description: DESCRIPTION },
    });
  }

  const branch = repo.default_branch || "main";
  let headSha = null;
  try {
    const ref = await gh(`/repos/${repo.full_name}/git/ref/heads/${branch}`);
    headSha = ref?.object?.sha ?? null;
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  const tree = await gh(`/repos/${repo.full_name}/git/trees`, {
    method: "POST",
    body: {
      tree: files.map((file) => ({
        path: file.path,
        mode: "100644",
        type: "blob",
        content: file.content,
      })),
    },
  });

  const commit = await gh(`/repos/${repo.full_name}/git/commits`, {
    method: "POST",
    body: {
      message: "Dev Style Studio — application source",
      tree: tree.sha,
      parents: headSha ? [headSha] : [],
    },
  });

  if (headSha) {
    await gh(`/repos/${repo.full_name}/git/refs/heads/${branch}`, {
      method: "PATCH",
      body: { sha: commit.sha, force: true },
    });
  } else {
    await gh(`/repos/${repo.full_name}/git/refs`, {
      method: "POST",
      body: { ref: `refs/heads/${branch}`, sha: commit.sha },
    });
  }

  const remote = await gh(`/repos/${repo.full_name}/git/trees/${branch}?recursive=1`);
  const remoteFiles = (remote?.tree || []).filter((entry) => entry.type === "blob");

  return {
    created,
    repo: {
      full_name: repo.full_name,
      html_url: repo.html_url,
      private: repo.private,
      branch,
    },
    pushed: files.length,
    remote_files: remoteFiles.length,
    commit: commit.sha.slice(0, 7),
    verified: remoteFiles.length >= files.length,
  };
}