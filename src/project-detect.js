export function buildTree(entries) {
  const root = { type: "dir", name: "", path: "", children: [] };
  const index = new Map([["", root]]);

  for (const entry of entries) {
    const parts = entry.path.split("/").filter(Boolean);
    let parent = root;
    let acc = "";
    for (let i = 0; i < parts.length; i += 1) {
      const isFile = i === parts.length - 1;
      const path = acc ? `${acc}/${parts[i]}` : parts[i];
      let node = index.get(path);
      if (!node) {
        node = isFile
          ? { type: "file", name: parts[i], path, size: entry.uncompressedSize || 0 }
          : { type: "dir", name: parts[i], path, children: [] };
        index.set(path, node);
        parent.children.push(node);
      }
      parent = node;
      acc = path;
    }
  }

  const sort = (dir) => {
    dir.children.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1,
    );
    dir.children.forEach((child) => child.type === "dir" && sort(child));
  };
  sort(root);

  return root.children;
}

export const PROJECT_TYPES = {
  android: { label: "Android app", tone: "lime" },
  web: { label: "React web app", tone: "blue" },
  static: { label: "Static website", tone: "amber" },
  unknown: { label: "Unknown project", tone: "grey" },
};

export async function detectProject(paths, readText) {
  const set = new Set(paths);
  const has = (re) => paths.some((p) => re.test(p));

  const workflows = paths.filter((p) => /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(p));

  let pkg = null;
  if (set.has("package.json") && readText) {
    try {
      pkg = JSON.parse(await readText("package.json"));
    } catch {
      pkg = null;
    }
  }
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };

  const isAndroid =
    has(/(^|\/)settings\.gradle(\.kts)?$/i) &&
    (has(/(^|\/)build\.gradle(\.kts)?$/i) || has(/AndroidManifest\.xml$/i));

  const isVite = Boolean(deps.vite) || has(/^vite\.config\.[cm]?[jt]s$/i);
  const isReact = Boolean(deps.react);

  if (isAndroid) {
    const gradlew = set.has("gradlew");
    return {
      type: "android",
      framework: has(/\.kts$/i) ? "Kotlin DSL · Gradle" : "Groovy · Gradle",
      buildCommand: gradlew ? "./gradlew assembleDebug" : "gradle assembleDebug",
      outputDir: "app/build/outputs/apk",
      workflows,
      notes: gradlew ? [] : ["No Gradle wrapper found — a build workflow will set one up."],
    };
  }

  if (isVite || (isReact && pkg)) {
    return {
      type: "web",
      framework: deps.vite ? "React · Vite" : pkg?.name ? "Node web app" : "Web app",
      buildCommand: (pkg?.scripts && (pkg.scripts.build ? "npm run build" : "npm run dev")) || "npm run build",
      outputDir: "dist",
      workflows,
      notes: deps.vite ? [] : ["No vite dependency detected — Vercel deploy may need a build command."],
    };
  }

  if (set.has("index.html")) {
    return {
      type: "static",
      framework: "HTML · CSS · JS",
      buildCommand: null,
      outputDir: ".",
      workflows,
      notes: [],
    };
  }

  return {
    type: "unknown",
    framework: "Unrecognised",
    buildCommand: null,
    outputDir: ".",
    workflows,
    notes: ["This project could not be classified — the file tree is still browsable."],
  };
}