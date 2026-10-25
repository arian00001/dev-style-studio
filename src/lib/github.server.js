import { secrets } from "base44:runtime";

export const API = "https://api.github.com";

const TOKEN_NAMES = ["Github-acces-token", "GITHUB_TOKEN", "GITHUB_ACCESS_TOKEN"];

export function githubToken() {
  const token = TOKEN_NAMES.map((name) => secrets.get(name)).find(Boolean);
  if (!token) {
    throw Object.assign(new Error("GitHub token is not configured on the server yet."), { status: 400 });
  }
  return token;
}

function headers(extra = {}) {
  return {
    Authorization: `Bearer ${githubToken()}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "dev-style-studio",
    ...extra,
  };
}

export async function gh(path, { method = "GET", body, accept } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: headers({
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(accept ? { Accept: accept } : {}),
    }),
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
    const message =
      data?.message ||
      (res.status === 401 ? "GitHub rejected the token (401)." : `GitHub API error (${res.status}).`);
    const error = new Error(message);
    error.status = res.status;
    error.detail = data?.errors;
    throw error;
  }
  return data;
}

export async function ghOptional(path, options) {
  try {
    return await gh(path, options);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

export async function fetchJobLog(owner, repo, jobId) {
  const res = await fetch(`${API}/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`, {
    headers: headers(),
    redirect: "manual",
  });

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    if (!location) return "GitHub returned a redirect without a log location.";
    const file = await fetch(location);
    return file.ok ? file.text() : `Could not read logs (${file.status}).`;
  }
  if (res.ok) return res.text();
  return `Could not read logs (${res.status}).`;
}

export function mapRun(run) {
  return {
    id: run.id,
    name: run.name || run.display_title || "Workflow run",
    title: run.display_title || run.name || "",
    branch: run.head_branch,
    status: run.status,
    conclusion: run.conclusion,
    created_at: run.created_at,
    started_at: run.run_started_at || run.created_at,
    updated_at: run.updated_at,
    html_url: run.html_url,
    attempt: run.run_attempt,
  };
}

export function mapRepo(repo) {
  return {
    id: repo.id,
    name: repo.name,
    owner: repo.owner.login,
    full_name: repo.full_name,
    private: repo.private,
    default_branch: repo.default_branch,
    html_url: repo.html_url,
    updated_at: repo.updated_at,
    empty: !repo.size,
  };
}