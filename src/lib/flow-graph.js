import { DEFAULT_FLOW } from "@/lib/flow-blocks";

/** Card metrics, shared by the canvas maths and the node component. */
export const NODE_W = 104;
export const NODE_H = 96;
export const STEP = 138;
export const TOP = 72;

/** Zig-zag columns — keeps a long chain readable on a 420px screen. */
const COLUMNS = [0.5, 0.14, 0.86, 0.5, 0.14, 0.86, 0.5];

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function makeNode(type, x, y) {
  return { id: uid(), type, x, y };
}

export function layoutFrom(types) {
  return types.map((type, i) => makeNode(type, COLUMNS[i % COLUMNS.length], TOP + i * STEP));
}

export function defaultNodes() {
  return layoutFrom(DEFAULT_FLOW);
}

export function appendNode(nodes, type) {
  const last = nodes[nodes.length - 1];
  return [
    ...nodes,
    makeNode(type, COLUMNS[nodes.length % COLUMNS.length], last ? last.y + STEP : TOP),
  ];
}

export function worldHeight(nodes) {
  if (!nodes.length) return 460;
  return Math.max(...nodes.map((n) => n.y)) + NODE_H + 120;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Vertical S-curve from the bottom of one card to the top of the next. */
export function wirePath(from, to, width) {
  const span = Math.max(0, width - NODE_W);
  const x1 = from.x * span + NODE_W / 2;
  const y1 = from.y + NODE_H;
  const x2 = to.x * span + NODE_W / 2;
  const y2 = to.y;
  const bend = Math.max(28, Math.abs(y2 - y1) * 0.42);
  return {
    d: `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`,
    mx: (x1 + x2) / 2,
    my: (y1 + y2) / 2,
  };
}