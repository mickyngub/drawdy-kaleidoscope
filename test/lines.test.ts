import assert from "node:assert/strict";
import { test } from "node:test";
import { isElbow, lineCopies, type LineStroke } from "../src/lib/lines";
import type { Symmetry } from "../src/lib/symmetry";

const centre = { x: 0, y: 0 };

const ids = () => {
    let n = 0;
    return () => `c${++n}`;
};

const arrow: LineStroke = {
    id: "a1",
    kind: "arrow",
    points: [
        [100, 0],
        [200, 0],
    ],
    color: "#ef4444",
    strokeWidth: 3,
    strokeDash: "dashed",
    opacity: 0.9,
    layer: 2,
    roughness: 1,
    seed: 42,
};

const close = (a: [number, number], b: [number, number]) =>
    Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

test("an arrow at 4 segments gives arrows rotated a quarter turn at a time, styles kept", () => {
    const sym: Symmetry = { segments: 4, mirror: false, centre };
    const copies = lineCopies(arrow, sym, ids(), { tag: 1 });
    assert.ok(copies);
    assert.deepEqual(
        copies.map((c) => c.type),
        ["arrow", "arrow", "arrow"]
    );
    const ends: [number, number][][] = [
        [
            [0, 100],
            [0, 200],
        ],
        [
            [-100, 0],
            [-200, 0],
        ],
        [
            [0, -100],
            [0, -200],
        ],
    ];
    copies.forEach((c, i) => {
        assert.ok(close(c.from as [number, number], ends[i][0]));
        assert.ok(close(c.to as [number, number], ends[i][1]));
        assert.equal(c.color, "#ef4444");
        assert.equal(c.strokeWidth, 3);
        assert.equal(c.strokeDash, "dashed");
        assert.equal(c.opacity, 0.9);
        assert.equal(c.layer, 2);
        assert.equal(c.roughness, 1);
        assert.equal(c.seed, 42);
        assert.deepEqual(c.meta, { tag: 1 });
        assert.equal(c.bend, undefined);
        assert.equal(c.elbowRouting, undefined);
    });
});

test("Drawdy's [from, to, ...bend] order is kept, so a bent line's bend turns with it", () => {
    const bent: LineStroke = {
        ...arrow,
        kind: "line",
        points: [
            [100, 0],
            [200, 0],
            [150, 30],
        ],
    };
    const [half] =
        lineCopies(bent, { segments: 2, mirror: false, centre }, ids(), {}) ??
        [];
    assert.equal(half.type, "line");
    assert.ok(close(half.from as [number, number], [-100, 0]));
    assert.ok(close(half.to as [number, number], [-200, 0]));
    assert.ok(close(half.bend![0], [-150, -30]));
});

test("an elbow arrow is copied from its ends with elbow routing at 2 or 4 segments, and skipped otherwise", () => {
    const elbow: LineStroke = {
        ...arrow,
        points: [
            [100, 0],
            [150, 0],
            [150, 80],
            [200, 80],
        ],
    };
    assert.ok(isElbow(elbow.points));
    assert.ok(!isElbow(arrow.points));
    assert.equal(
        lineCopies(elbow, { segments: 6, mirror: true, centre }, ids(), {}),
        null
    );
    const copies = lineCopies(
        elbow,
        { segments: 4, mirror: true, centre },
        ids(),
        {}
    );
    assert.equal(copies?.length, 7);
    for (const c of copies ?? []) {
        assert.equal(c.elbowRouting, true);
        assert.equal(c.bend, undefined);
    }
    assert.ok(close(copies![0].from as [number, number], [0, 100]));
    assert.ok(close(copies![0].to as [number, number], [-80, 200]));
});
