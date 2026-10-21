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
    assert.equal(watch.candidate([stroke("a")], 1100, 1), "a");
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
    assert.equal(watch.candidate([stroke("a")], 1050, 1), "a");
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
    assert.equal(zoomedOut.candidate([stroke("a")], 1100, 0.2), "a");
});

test("a non-freedraw element is rejected", () => {
    const watch = watchWithSample({ x: 50, y: 40 }, 1000);
    assert.equal(
        watch.candidate([stroke("a", { type: "text" })], 1100, 1),
        null
    );
});
