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
 * The rotated and mirrored copies of a line or arrow, in the [from, to, ...bend]
 * order Drawdy stores. Elbow arrows give null: Drawdy re-routes them from their
 * two ends, and the new route does not always turn the way the mirrored one would.
 */
export function lineCopies(
    line: LineStroke,
    sym: Symmetry,
    newId: () => string,
    meta: Record<string, unknown>
): LineSchema[] | null {
    if (isElbow(line.points)) return null;
    return symmetryCopies(line.points, sym).map(([from, to, ...bend]) => {
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
            meta,
        };
        return line.kind === "arrow"
            ? { ...base, type: "arrow" }
            : { ...base, type: "line" };
    });
}
