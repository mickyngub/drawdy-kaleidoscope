import type { DrawdyPreviewElementSchema } from "@drawdy/driver-protocol";
import type { Symmetry } from "./lib/symmetry";

type Rect = { x: number; y: number; width: number; height: number };

const OPACITY = 0.6;
const LINE_PX = 1.5;
const CENTRE_RADIUS_PX = 6;
const LENGTH_OF_VIEW = 0.75;

export function guideElements(
    sym: Symmetry,
    viewport: Rect,
    zoom: number,
    newId: () => string,
    colour: string
): DrawdyPreviewElementSchema[] {
    const scale = zoom > 0 ? zoom : 1;
    const { x, y } = sym.centre;
    const length = LENGTH_OF_VIEW * Math.min(viewport.width, viewport.height);
    const strokeWidth = LINE_PX / scale;
    const lines = Array.from(
        { length: sym.segments },
        (_, k): DrawdyPreviewElementSchema => {
            const angle = (k * 2 * Math.PI) / sym.segments;
            return {
                type: "line",
                drawdyElementId: newId(),
                from: [x, y],
                to: [
                    x + length * Math.cos(angle),
                    y + length * Math.sin(angle),
                ],
                color: colour,
                strokeWidth,
                strokeDash: "dashed",
                opacity: OPACITY,
            };
        }
    );
    const r = CENTRE_RADIUS_PX / scale;
    return [
        ...lines,
        {
            type: "shape",
            componentType: "circle",
            drawdyElementId: newId(),
            x: x - r,
            y: y - r,
            width: 2 * r,
            height: 2 * r,
            strokeColor: colour,
            fillColor: "transparent",
            strokeWidth,
            opacity: OPACITY,
            roughness: 0,
        },
    ];
}
