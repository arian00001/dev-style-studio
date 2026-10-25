// Collects this app's real source files at build time so a server route can
// commit them to GitHub. Vite inlines the raw file text into the server bundle,
// so no filesystem access is needed on Cloudflare Workers.

import { ROOT_FILES } from "@/lib/repo-root-files";

const srcModules = import.meta.glob("../**/*.{js,jsx,json,css,md}", {
  query: "?raw",
  import: "default",
  eager: true,
});

const SKIP = [/routeTree\.gen\.ts$/, /source-bundle\.server\.js$/, /repo-root-files\.js$/];

const GITIGNORE = "node_modules/\ndist/\n.wrangler/\n.tanstack/\n.env\n.env.*\n";

function toRepoPath(key) {
  let path = key.replace(/\\/g, "/");
  while (path.startsWith("../")) path = path.slice(3);
  const nested = path.lastIndexOf("/src/");
  if (nested !== -1) return path.slice(nested + 1);
  if (path.startsWith("src/")) return path;
  return `src/${path.replace(/^\.\//, "")}`;
}

export function appSourceFiles() {
  const files = new Map();
  for (const [key, content] of Object.entries(srcModules)) {
    const path = toRepoPath(key);
    if (!path || SKIP.some((rule) => rule.test(path))) continue;
    files.set(path, typeof content === "string" ? content : String(content ?? ""));
  }
  for (const [path, content] of Object.entries(ROOT_FILES)) files.set(path, content);
  files.set(".gitignore", GITIGNORE);
  return [...files.entries()]
    .map(([path, content]) => ({ path, content }))
    .sort((a, b) => a.path.localeCompare(b.path));
}