import assert from "node:assert/strict";
import { test } from "node:test";
import { symmetryCopies, type Symmetry } from "../src/lib/symmetry";

const origin = { x: 0, y: 0 };

const close = (actual: [number, number][], expected: [number, number][]) => {
    assert.equal(actual.length, expected.length);
    actual.forEach(([x, y], i) => {
        assert.ok(
            Math.abs(x - expected[i][0]) < 1e-9 &&
                Math.abs(y - expected[i][1]) < 1e-9,
            `point ${i}: got (${x}, ${y}), expected (${expected[i]})`
        );
    });
};

test("4 segments rotate (1, 0) about the origin a quarter turn at a time", () => {
    const copies = symmetryCopies([[1, 0]], {
        segments: 4,
        mirror: false,
        centre: origin,
    });
    close(
        copies.map((c) => c[0]),
        [
            [0, 1],
            [-1, 0],
            [0, -1],
        ]
    );
});

test("6 segments give 5 copies without mirror and 11 with it", () => {
    const s: Symmetry = { segments: 6, mirror: false, centre: origin };
    assert.equal(symmetryCopies([[1, 0]], s).length, 5);
    assert.equal(symmetryCopies([[1, 0]], { ...s, mirror: true }).length, 11);
});

test("the first mirrored copy reflects across the horizontal axis through the centre", () => {
    const copies = symmetryCopies([[1, 1]], {
        segments: 2,
        mirror: true,
        centre: origin,
    });
    close(copies[1], [[1, -1]]);
});

test("copies turn about the centre, not the origin, and keep every point", () => {
    const stroke: [number, number][] = [
        [110, 100],
        [120, 105],
    ];
    const [half] = symmetryCopies(stroke, {
        segments: 2,
        mirror: false,
        centre: { x: 100, y: 100 },
    });
    close(half, [
        [90, 100],
        [80, 95],
    ]);
});
