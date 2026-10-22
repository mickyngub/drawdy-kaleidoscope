import type { SubscribedDrawdyElement } from "@drawdy/driver-protocol";

export type Kind = "freedraw" | "line" | "arrow";

export type Candidate = { id: string; kind: Kind };

export type StrokeWatch = {
    onPointer(p: { x: number; y: number }, now: number): void;
    onTool(tool: string | null, now: number): void;
    onSelection(ids: readonly string[], now: number): Candidate | null;
    candidate(
        added: readonly SubscribedDrawdyElement[],
        now: number,
        zoom: number
    ): Candidate | null;
    markSeen(ids: string[]): void;
};

const SAMPLE_TTL_MS = 2000;
const SELECTION_WINDOW_MS = 400;
const TOOL_MEMORY_MS = 2000;
const NOT_DRAWING = new Set(["select", "drag", "eraser", "laser-pointer"]);

type Sample = { x: number; y: number; t: number };

// scene:elements-added carries no origin. A pencil stroke is the local
// user's when their pointer was just at its last point. Lines and arrows
// report the same type, so they count when Drawdy selects the new path
// locally, which it does right after the Line and Arrow tools commit, and
// the last drawing tool seen says which of the two it is.
export function createStrokeWatch(o: {
    driverId: string;
    windowMs?: number;
    radiusPx?: number;
}): StrokeWatch {
    const windowMs = o.windowMs ?? 300;
    const radiusPx = o.radiusPx ?? 24;
    let samples: Sample[] = [];
    const seen = new Set<string>();
    let drawingTool: { tool: string; at: number } | null = null;
    let pendingPath: { id: string; at: number } | null = null;
    let lastSelection: { ids: readonly string[]; at: number } | null = null;

    const prune = (now: number): void => {
        const oldest = now - SAMPLE_TTL_MS;
        if (samples.length > 0 && samples[0].t < oldest) {
            samples = samples.filter((s) => s.t >= oldest);
        }
    };

    const nearPointer = (
        points: [number, number][] | undefined,
        now: number,
        zoom: number
    ): boolean => {
        const last = points?.[points.length - 1];
        if (!last) return false;
        const radius = radiusPx / (zoom > 0 ? zoom : 1);
        return samples.some(
            (s) =>
                Math.abs(now - s.t) <= windowMs &&
                Math.hypot(s.x - last[0], s.y - last[1]) <= radius
        );
    };

    const pathKind = (id: string, now: number): Candidate | null => {
        if (!drawingTool || now - drawingTool.at > TOOL_MEMORY_MS) return null;
        const { tool } = drawingTool;
        return tool === "line" || tool === "arrow" ? { id, kind: tool } : null;
    };

    const selects = (
        selection: { ids: readonly string[]; at: number },
        id: string,
        at: number
    ): boolean =>
        selection.ids.length === 1 &&
        selection.ids[0] === id &&
        Math.abs(selection.at - at) <= SELECTION_WINDOW_MS;

    return {
        onPointer(p, now) {
            prune(now);
            samples.push({ x: p.x, y: p.y, t: now });
        },
        onTool(tool, now) {
            if (tool !== null && !NOT_DRAWING.has(tool)) {
                drawingTool = { tool, at: now };
            }
        },
        onSelection(ids, now) {
            lastSelection = { ids: [...ids], at: now };
            if (
                !pendingPath ||
                !selects(lastSelection, pendingPath.id, pendingPath.at)
            ) {
                return null;
            }
            const { id } = pendingPath;
            pendingPath = null;
            return pathKind(id, now);
        },
        candidate(added, now, zoom) {
            prune(now);
            const [el] = added;
            const fresh =
                added.length === 1 &&
                !seen.has(el.id) &&
                el.meta?.[o.driverId] === undefined;
            for (const e of added) seen.add(e.id);
            if (!fresh) return null;
            if (el.type === "freedraw") {
                return nearPointer(el.points, now, zoom)
                    ? { id: el.id, kind: "freedraw" }
                    : null;
            }
            if (el.type !== "path" || el.componentType !== undefined) {
                return null;
            }
            if (lastSelection && selects(lastSelection, el.id, now)) {
                return pathKind(el.id, now);
            }
            pendingPath = { id: el.id, at: now };
            return null;
        },
        markSeen(ids) {
            for (const id of ids) seen.add(id);
        },
    };
}
