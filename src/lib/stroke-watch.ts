import type { SubscribedDrawdyElement } from "@drawdy/driver-protocol";

export type StrokeWatch = {
    onPointer(p: { x: number; y: number }, now: number): void;
    candidate(
        added: readonly SubscribedDrawdyElement[],
        now: number,
        zoom: number
    ): string | null;
    markSeen(ids: string[]): void;
};

const SAMPLE_TTL_MS = 2000;

type Sample = { x: number; y: number; t: number };

// scene:elements-added carries no origin, so a stroke counts as the local
// user's own only when their pointer was just at its last point.
export function createStrokeWatch(o: {
    driverId: string;
    windowMs?: number;
    radiusPx?: number;
}): StrokeWatch {
    const windowMs = o.windowMs ?? 300;
    const radiusPx = o.radiusPx ?? 24;
    let samples: Sample[] = [];
    const seen = new Set<string>();

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

    return {
        onPointer(p, now) {
            prune(now);
            samples.push({ x: p.x, y: p.y, t: now });
        },
        candidate(added, now, zoom) {
            prune(now);
            const [el] = added;
            const accepted =
                added.length === 1 &&
                el.type === "freedraw" &&
                !seen.has(el.id) &&
                el.meta?.[o.driverId] === undefined &&
                nearPointer(el.points, now, zoom);
            for (const e of added) seen.add(e.id);
            return accepted ? el.id : null;
        },
        markSeen(ids) {
            for (const id of ids) seen.add(id);
        },
    };
}
