import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { parseZip } from "@/lib/zip";
import { buildTree, detectProject } from "@/lib/project-detect";

export const STEPS = [
  { id: "upload", title: "Upload project", hint: "Select a ZIP of your project" },
  { id: "files", title: "Project files", hint: "Review what was extracted" },
  { id: "repo", title: "Repository", hint: "Pick or create a GitHub repo" },
  { id: "push", title: "Git push", hint: "Upload every file" },
  { id: "run", title: "Build", hint: "Run and watch the build" },
  { id: "ship", title: "Ship", hint: "APK, release or live site" },
];

const StudioContext = createContext(null);

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used inside StudioProvider");
  return ctx;
}

export function StudioProvider({ children }) {
  const [step, setStep] = useState(0);
  const [zip, setZip] = useState(null);
  const [project, setProject] = useState(null);
  const [repo, setRepo] = useState(null);
  const [push, setPush] = useState(null);
  const [build, setBuild] = useState(null);
  const [ship, setShip] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const loadArchive = useCallback(async (file) => {
    setError(null);
    if (!/\.zip$/i.test(file.name)) {
      setError("Choose a .zip archive — other file types cannot be extracted.");
      return;
    }
    setBusy({ label: "Reading archive…", progress: 5 });
    try {
      const parsed = await parseZip(file, (p) => setBusy({ label: "Reading archive…", progress: p }));
      setBusy({ label: "Detecting project…", progress: 80 });
      const paths = parsed.entries.map((e) => e.path);
      const readText = async (path) => {
        const entry = parsed.entries.find((e) => e.path === path);
        if (!entry) return null;
        return new TextDecoder().decode(await parsed.readEntry(entry));
      };
      const info = await detectProject(paths, readText);
      const bytes = parsed.entries.reduce((sum, e) => sum + (e.uncompressedSize || 0), 0);
      setZip({ file, parsed });
      setProject({
        paths,
        tree: buildTree(parsed.entries),
        info,
        stats: { files: parsed.entries.length, bytes },
      });
      setBusy(null);
      setStep(1);
    } catch (err) {
      setBusy(null);
      setError(err?.message || "This archive could not be read.");
    }
  }, []);

  const reset = useCallback(() => {
    setStep(0);
    setZip(null);
    setProject(null);
    setRepo(null);
    setPush(null);
    setBuild(null);
    setShip(null);
    setBusy(null);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({
      step,
      setStep,
      zip,
      project,
      repo,
      setRepo,
      push,
      setPush,
      build,
      setBuild,
      ship,
      setShip,
      busy,
      setBusy,
      error,
      setError,
      loadArchive,
      reset,
    }),
    [step, zip, project, repo, push, build, ship, busy, error, loadArchive, reset],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}