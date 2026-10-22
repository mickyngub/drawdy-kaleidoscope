import assert from "node:assert/strict";
import { test } from "node:test";
import type { SubscribedDrawdyElement } from "@drawdy/driver-protocol";
import { createStrokeWatch } from "../src/lib/stroke-watch";

const DRIVER_ID = "mickyngub.kaleidoscope";

const stroke = (
    id: string,
    extra: Partial<SubscribedDrawdyElement> = {}
): SubscribedDrawdyElement =>
    ({
        id,
        type: "freedraw",
        points: [
            [0, 0],
            [50, 40],
        ],
        ...extra,
    }) as SubscribedDrawdyElement;

const watchWithSample = (at: { x: number; y: number }, t: number) => {
    const watch = createStrokeWatch({ driverId: DRIVER_ID });
    watch.onPointer(at, t);
    return watch;
};

test("a single freedraw ending under a pointer sample 100 ms old is accepted", () => {
    const watch = watchWithSample({ x: 52, y: 41 }, 1000);
    assert.deepEqual(watch.candidate([stroke("a")], 1100, 1), {
        id: "a",
        kind: "freedraw",
    });
});

test("a batch of two is rejected", () => {
    const watch = watchWithSample({ x: 50, y: 40 }, 1000);
    assert.equal(watch.candidate([stroke("a"), stroke("b")], 1100, 1), null);
});

test("an element tagged with the extension's own meta is rejected", () => {
    const watch = watchWithSample({ x: 50, y: 40 }, 1000);
    const own = stroke("a", { meta: { [DRIVER_ID]: { v: 1, of: "x" } } });
    assert.equal(watch.candidate([own], 1100, 1), null);
});

test("an id already seen is rejected, so undo and redo re-adds are not copied", () => {
    const watch = watchWithSample({ x: 50, y: 40 }, 1000);
    assert.deepEqual(watch.candidate([stroke("a")], 1050, 1), {
        id: "a",
        kind: "freedraw",
    });
    watch.onPointer({ x: 50, y: 40 }, 1100);
    assert.equal(watch.candidate([stroke("a")], 1150, 1), null);
});

test("ids marked seen and rejected batches are both remembered", () => {
    const watch = watchWithSample({ x: 50, y: 40 }, 1000);
    watch.markSeen(["copy"]);
    assert.equal(watch.candidate([stroke("copy")], 1100, 1), null);
    watch.candidate([stroke("b"), stroke("c")], 1100, 1);
    assert.equal(watch.candidate([stroke("b")], 1100, 1), null);
});

test("no pointer sample within 300 ms rejects the stroke", () => {
    const watch = watchWithSample({ x: 50, y: 40 }, 1000);
    assert.equal(watch.candidate([stroke("a")], 1400, 1), null);
});

test("a sample 100 px away at zoom 1 rejects the stroke; the radius scales with zoom", () => {
    const far = watchWithSample({ x: 150, y: 40 }, 1000);
    assert.equal(far.candidate([stroke("a")], 1100, 1), null);
    const zoomedOut = watchWithSample({ x: 150, y: 40 }, 1000);
    assert.deepEqual(zoomedOut.candidate([stroke("a")], 1100, 0.2), {
        id: "a",
        kind: "freedraw",
    });
});

test("a non-freedraw element is rejected", () => {
    const watch = watchWithSample({ x: 50, y: 40 }, 1000);
    assert.equal(
        watch.candidate([stroke("a", { type: "text" })], 1100, 1),
        null
    );
});

const path = (id: string, extra: Partial<SubscribedDrawdyElement> = {}) =>
    ({
        id,
        type: "path",
        points: [
            [0, 0],
            [100, 0],
        ],
        ...extra,
    }) as SubscribedDrawdyElement;

test("a path selected within 400 ms of its add is a line or arrow, by the last drawing tool", () => {
    for (const tool of ["line", "arrow"] as const) {
        const watch = createStrokeWatch({ driverId: DRIVER_ID });
        watch.onTool(tool, 1000);
        watch.onTool("select", 1500);
        assert.equal(watch.candidate([path("p")], 1600, 1), null);
        assert.deepEqual(watch.onSelection(["p"], 1700), {
            id: "p",
            kind: tool,
        });
    }
});

test("the selection may arrive before the add", () => {
    const watch = createStrokeWatch({ driverId: DRIVER_ID });
    watch.onTool("arrow", 1000);
    assert.equal(watch.onSelection(["p"], 1100), null);
    assert.deepEqual(watch.candidate([path("p")], 1200, 1), {
        id: "p",
        kind: "arrow",
    });
});

test("a path is rejected without its own selection, late, or after another drawing tool", () => {
    const remote = createStrokeWatch({ driverId: DRIVER_ID });
    remote.onTool("line", 1000);
    remote.candidate([path("p")], 1100, 1);
    assert.equal(remote.onSelection(["p", "q"], 1200), null);

    const late = createStrokeWatch({ driverId: DRIVER_ID });
    late.onTool("line", 1000);
    late.candidate([path("p")], 1100, 1);
    assert.equal(late.onSelection(["p"], 1600), null);

    const rect = createStrokeWatch({ driverId: DRIVER_ID });
    rect.onTool("line", 1000);
    rect.onTool("rect", 1050);
    rect.candidate([path("p")], 1100, 1);
    assert.equal(rect.onSelection(["p"], 1200), null);

    const stale = createStrokeWatch({ driverId: DRIVER_ID });
    stale.onTool("line", 1000);
    stale.candidate([path("p")], 3100, 1);
    assert.equal(stale.onSelection(["p"], 3200), null);
});

test("shapes, pasted paths on Select and the extension's own lines are never candidates", () => {
    const watch = createStrokeWatch({ driverId: DRIVER_ID });
    watch.onTool("select", 1000);
    watch.candidate([path("pasted")], 1100, 1);
    assert.equal(watch.onSelection(["pasted"], 1200), null);

    watch.onTool("line", 1300);
    watch.candidate([path("box", { componentType: "rect" })], 1400, 1);
    assert.equal(watch.onSelection(["box"], 1450), null);
    const own = path("copy", { meta: { [DRIVER_ID]: { v: 1, of: "x" } } });
    watch.candidate([own], 1500, 1);
    assert.equal(watch.onSelection(["copy"], 1550), null);
});
