import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { appendNode, defaultNodes, layoutFrom } from "@/lib/flow-graph";
import { DEFAULT_FLOW } from "@/lib/flow-blocks";

/**
 * The flow graph: local state that loads once from the visitor's FlowGraph
 * record and saves back (debounced) whenever the nodes change.
 */
export function useFlowGraph() {
  const { user, isLoadingAuth } = useAuth();
  const [nodes, setNodes] = useState(defaultNodes);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const recordId = useRef(null);
  const warned = useRef(false);

  useEffect(() => {
    if (isLoadingAuth || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await base44.entities.FlowGraph.filter(
          { created_by_id: user.id },
          { sort: "-created_date", limit: 1 },
        );
        const record = page?.items?.[0];
        if (cancelled) return;
        if (record) {
          recordId.current = record.id;
          const stored = JSON.parse(record.graph || "[]");
          if (Array.isArray(stored) && stored.length) {
            setNodes(stored.map((n) => ({ ...n, id: n.id || String(Math.random()) })));
          }
        }
      } catch {
        if (!cancelled && !warned.current) {
          warned.current = true;
          toast("Could not load your saved flow — showing the default one.");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoadingAuth, user?.id]);

  useEffect(() => {
    if (!ready || !user?.id) return;
    setSaveState("saving");
    const timer = setTimeout(async () => {
      const payload = { name: "My flow", graph: JSON.stringify(nodes) };
      try {
        if (recordId.current) {
          await base44.entities.FlowGraph.update(recordId.current, payload);
        } else {
          const created = await base44.entities.FlowGraph.create(payload);
          recordId.current = created.id;
        }
        setSaveState("saved");
      } catch {
        setSaveState("idle");
        if (!warned.current) {
          warned.current = true;
          toast("Could not save this flow — it stays on this screen only.");
        }
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [nodes, ready, user?.id]);

  const addNode = useCallback((type) => {
    setNodes((current) => appendNode(current, type));
  }, []);

  const removeNode = useCallback((id) => {
    setNodes((current) => current.filter((n) => n.id !== id));
  }, []);

  const moveNode = useCallback((id, patch) => {
    setNodes((current) => current.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  const loadTypes = useCallback((types) => setNodes(layoutFrom(types)), []);
  const reset = useCallback(() => setNodes(layoutFrom(DEFAULT_FLOW)), []);

  return { nodes, ready, saveState, addNode, removeNode, moveNode, loadTypes, reset };
}