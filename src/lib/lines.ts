import type { LineSchema } from "@drawdy/driver-protocol";
import { symmetryCopies, type Symmetry } from "./symmetry";

export type LineStroke = {
    id: string;
    kind: "line" | "arrow";
    points: [number, number][];
    color?: string;
    strokeWidth?: number;
    strokeDash?: LineSchema["strokeDash"];
    opacity?: number;
    layer?: number;
    roughness?: number;
    seed?: number;
};

export const ELBOW_SEGMENTS: readonly number[] = [2, 4];

const AXIS_EPSILON = 1e-6;

// Elbow arrows store their route as corners, so every segment runs along an axis.
export const isElbow = (points: [number, number][]): boolean =>
    points.length >= 3 &&
    points
        .slice(1)
        .every(
            ([x, y], i) =>
                Math.abs(x - points[i][0]) < AXIS_EPSILON ||
                Math.abs(y - points[i][1]) < AXIS_EPSILON
        );

/**
 * The rotated and mirrored copies of a line or arrow, or null for an elbow
 * arrow at a segment count whose turns would not stay on the axes. Drawdy
 * stores [from, to, ...bend] and re-routes an elbow arrow from its two ends.
 */
export function lineCopies(
    line: LineStroke,
    sym: Symmetry,
    newId: () => string,
    meta: Record<string, unknown>
): LineSchema[] | null {
    const elbow = isElbow(line.points);
    if (elbow && !ELBOW_SEGMENTS.includes(sym.segments)) return null;
    const source = elbow
        ? [line.points[0], line.points[line.points.length - 1]]
        : line.points;
    return symmetryCopies(source, sym).map(([from, to, ...bend]) => {
        const base = {
            drawdyElementId: newId(),
            from,
            to,
            ...(bend.length > 0 && { bend }),
            color: line.color ?? "#000000",
            ...(line.strokeWidth !== undefined && {
                strokeWidth: line.strokeWidth,
            }),
            ...(line.strokeDash !== undefined && {
                strokeDash: line.strokeDash,
            }),
            ...(line.opacity !== undefined && { opacity: line.opacity }),
            ...(line.layer !== undefined && { layer: line.layer }),
            ...(line.roughness !== undefined && { roughness: line.roughness }),
            ...(line.seed !== undefined && { seed: line.seed }),
            ...(elbow && { elbowRouting: true }),
            meta,
        };
        return line.kind === "arrow"
            ? { ...base, type: "arrow" }
            : { ...base, type: "line" };
    });
}
