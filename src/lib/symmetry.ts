export type Point = { x: number; y: number };

export const SEGMENT_CHOICES = [2, 3, 4, 6, 8, 12] as const;

export type Segments = (typeof SEGMENT_CHOICES)[number];

export type Symmetry = { segments: Segments; mirror: boolean; centre: Point };

export const isSegments = (n: unknown): n is Segments =>
    SEGMENT_CHOICES.includes(n as Segments);

const rotateAbout = (centre: Point, angle: number) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return ([x, y]: [number, number]): [number, number] => {
        const dx = x - centre.x;
        const dy = y - centre.y;
        return [centre.x + dx * cos - dy * sin, centre.y + dx * sin + dy * cos];
    };
};

export function symmetryCopies(
    points: [number, number][],
    s: Symmetry
): [number, number][][] {
    const step = (2 * Math.PI) / s.segments;
    const copies: [number, number][][] = [];
    for (let k = 1; k < s.segments; k++) {
        copies.push(points.map(rotateAbout(s.centre, k * step)));
    }
    if (s.mirror) {
        const reflected = points.map(([x, y]): [number, number] => [
            x,
            2 * s.centre.y - y,
        ]);
        for (let k = 0; k < s.segments; k++) {
            copies.push(reflected.map(rotateAbout(s.centre, k * step)));
        }
    }
    return copies;
}
