import assert from "node:assert/strict";
import { test } from "node:test";
import type { DriverManifest } from "@drawdy/driver-protocol";
import * as driver from "../src/index";
import {
    boot,
    fakeHost,
    pointsOf,
    schemaNodes,
    type FakeHost,
    type Stored,
} from "./fake-host";

const manifest = {
    driverId: "mickyngub.kaleidoscope",
    driverName: "Kaleidoscope",
} as DriverManifest;

const BUTTON = `${manifest.driverId}:action-button`;
const BAR = `${manifest.driverId}:bar`;
const barButton = (key: string) => `${manifest.driverId}:bar:${key}`;
const barNotice = (key: string) => `${manifest.driverId}:bar:notice:${key}`;

const STROKE: Stored = {
    drawdyElementId: "s1",
    type: "freedraw",
    points: [900, 500, 930, 520, 950, 540],
    strokeColor: "#ef4444",
    strokeWidth: 4,
    opacity: 0.8,
    layer: 3,
    frameId: "frame-1",
};

type Emit = Awaited<ReturnType<typeof boot>>["emit"];

async function started(options: Parameters<typeof fakeHost>[0] = {}) {
    const host = fakeHost(options);
    const { emit } = await boot(driver, host, manifest);
    await click(emit, BUTTON);
    return { host, emit };
}

const click = (emit: Emit, domElementId: string) =>
    emit("subscription:dom:element-clicked", {
        domElementId,
        clientX: 0,
        clientY: 0,
    });

const escape = (emit: Emit) =>
    emit("subscription:keyboard:control-keys", {
        key: "escape",
        shift: false,
        ctrl: false,
        meta: false,
        alt: false,
    });

const pointerAt = (emit: Emit, x: number, y: number) =>
    emit("subscription:scene:pointer-position", {
        position: { canvasSpace: { x, y }, domSpace: { x: 0, y: 0 } },
    });

const announce = (emit: Emit, els: Stored[]) =>
    emit("subscription:scene:elements-added", {
        drawdyElements: els.map((el) => ({
            id: el.drawdyElementId,
            type: el.type,
            points: pointsOf(el),
            meta: el.meta,
        })),
        properties: ["type", "points", "meta"],
    });

/** The local user finishing a pencil stroke: pointer samples along it, then the add event. */
async function draw(host: FakeHost, emit: Emit, el: Stored = STROKE) {
    host.put({ ...el });
    for (const [x, y] of pointsOf(el)) await pointerAt(emit, x, y);
    return announce(emit, [el]);
}

const copies = (host: FakeHost) =>
    [...host.elements.values()].filter(
        (el) => (el.meta as any)?.[manifest.driverId] !== undefined
    );

const adds = (host: FakeHost) =>
    host.sent.filter((s) => s.type === "command:scene:add-drawdy-elements");

const noticeKeys = (host: FakeHost) => {
    const bar = host.floating.get(BAR);
    if (!bar) return [];
    return schemaNodes(bar.schema)
        .map((node) => node.domId ?? "")
        .filter((id) => id.startsWith(barNotice("")));
};

test("activate asks for nothing that prompts: no storage, no scene, no tools", async () => {
    const host = fakeHost();
    await boot(driver, host, manifest);
    const types = host.types();
    assert.ok(!types.some((t) => t.startsWith("command:kv-storage")));
    assert.ok(!types.some((t) => t.startsWith("command:scene")));
    assert.ok(!types.some((t) => t.startsWith("command:tools")));
    assert.ok(!types.some((t) => t.startsWith("subscription:scene")));
    assert.ok(types.includes("command:dom:create-action-button"));
});

test("turning the mode on centres the bar at the top, draws the guides and watches strokes", async () => {
    const { host } = await started();
    const bar = host.floating.get(BAR);
    assert.ok(bar);
    assert.equal(bar.asPopover, false);
    assert.equal(bar.schema.styles?.pointerEvents, "auto");
    const width = bar.schema.styles?.width?.[0] as number;
    assert.deepEqual(bar.position, {
        x: Math.round((1600 - width) / 2),
        y: 64,
    });
    assert.equal(host.previews.length, 7);
    const circle = host.previews.find((el) => el.type === "shape");
    assert.ok(circle);
    assert.equal(
        (circle.x as number) + (circle.width as number) / 2,
        800,
        "the centre is the viewport centre"
    );
    assert.ok(host.subscribedTo("subscription:scene:elements-added"));
    assert.ok(host.subscribedTo("subscription:scene:pointer-position"));
});

test("a local pencil stroke gains 11 copies in one add, tagged with the original", async () => {
    const { host, emit } = await started();
    await draw(host, emit);
    assert.equal(adds(host).length, 1);
    const made = copies(host);
    assert.equal(made.length, 11);
    for (const el of made) {
        assert.equal(el.type, "freedraw");
        assert.deepEqual((el.meta as any)[manifest.driverId], {
            v: 1,
            of: "s1",
        });
        assert.equal(el.strokeColor, "#ef4444");
        assert.equal(el.strokeWidth, 4);
        assert.equal(el.opacity, 0.8);
        assert.equal(el.layer, 3);
        assert.equal(el.frameId, undefined);
        assert.equal(el.groupId, undefined);
        assert.equal(pointsOf(el).length, 3);
    }
    await escape(emit);
});

test("a stroke drawn while another tool is active is not copied", async () => {
    const { host, emit } = await started({ tool: "select" });
    await draw(host, emit);
    assert.equal(adds(host).length, 0);
    await escape(emit);
});

test("a stroke with no local pointer at its end, like a collaborator's, is not copied", async () => {
    const { host, emit } = await started();
    host.put({ ...STROKE });
    await pointerAt(emit, 100, 100);
    await announce(emit, [STROKE]);
    assert.equal(adds(host).length, 0);
    await escape(emit);
});

test("the extension's own copies are never copied again, even one at a time", async () => {
    const { host, emit } = await started({
        kv: { settings: { segments: 2, mirror: false } },
    });
    await draw(host, emit);
    const [copy] = copies(host);
    assert.equal(copies(host).length, 1);
    const [x, y] = pointsOf(copy).at(-1)!;
    await pointerAt(emit, x, y);
    await announce(emit, [copy]);
    assert.equal(adds(host).length, 1);
    await escape(emit);
});

test("a stroke re-added by undo and redo is not copied twice", async () => {
    const { host, emit } = await started();
    await draw(host, emit);
    await draw(host, emit);
    assert.equal(adds(host).length, 1);
    await escape(emit);
});

test("Stop removes the guides, the bar and the stroke subscriptions", async () => {
    const { host, emit } = await started();
    await click(emit, barButton("stop"));
    assert.equal(host.previews.length, 0);
    assert.ok(!host.floating.has(BAR));
    assert.ok(!host.subscribedTo("subscription:scene:elements-added"));
    assert.ok(!host.subscribedTo("subscription:scene:pointer-position"));
    assert.equal(await draw(host, emit), false);
});

test("Escape removes the guides, the bar and the stroke subscriptions", async () => {
    const { host, emit } = await started();
    await escape(emit);
    assert.equal(host.previews.length, 0);
    assert.ok(!host.floating.has(BAR));
    assert.ok(!host.subscribedTo("subscription:scene:elements-added"));
    assert.ok(!host.subscribedTo("subscription:scene:pointer-position"));
});

test("pressing the action button again turns the mode off", async () => {
    const { host, emit } = await started();
    await click(emit, BUTTON);
    assert.equal(host.previews.length, 0);
    assert.ok(!host.floating.has(BAR));
});

test("a stroke still waiting when the mode stops is dropped", async () => {
    const { host, emit } = await started();
    const drawing = draw(host, emit);
    await escape(emit);
    await drawing;
    assert.equal(adds(host).length, 0);
});

test("a stroke removed before it is read is ignored", async () => {
    const { host, emit } = await started();
    const drawing = draw(host, emit);
    host.elements.delete("s1");
    await drawing;
    assert.equal(adds(host).length, 0);
    await escape(emit);
});

test("switching boards turns the mode off and takes the guides away", async () => {
    const { host, emit } = await started();
    await emit("subscription:scene:elements-replaced", {
        drawdyElements: [],
        replaced: [],
        properties: [],
    });
    assert.equal(host.previews.length, 0);
    assert.ok(!host.floating.has(BAR));
    assert.ok(!host.subscribedTo("subscription:scene:elements-added"));
});

test("without board permission the bar says so and the mode stays off", async () => {
    const { host, emit } = await started({
        denied: ["command:scene", "command:tools"],
    });
    assert.deepEqual(noticeKeys(host), [barNotice("permission")]);
    assert.ok(!host.subscribedTo("subscription:scene:elements-added"));
    assert.equal(host.previews.length, 0);
    await escape(emit);
    assert.ok(!host.floating.has(BAR));
});

test("a full board shows the board-full notice in the bar", async () => {
    const { host, emit } = await started({ full: true });
    await draw(host, emit);
    assert.deepEqual(noticeKeys(host), [barNotice("board-full")]);
    await escape(emit);
});

test("a refused add shows a notice and adds nothing", async () => {
    const { host, emit } = await started({ failAdd: true });
    await draw(host, emit);
    assert.deepEqual(noticeKeys(host), [barNotice("add-failed")]);
    assert.equal(copies(host).length, 0);
    await escape(emit);
});

test("segments and mirror apply to the next stroke, redraw the guides and are remembered", async () => {
    const { host, emit } = await started();
    await click(emit, barButton("8"));
    assert.equal(host.previews.length, 9);
    assert.deepEqual(host.kv.settings, { segments: 8, mirror: true });
    await draw(host, emit);
    assert.equal(copies(host).length, 15);

    await click(emit, barButton("mirror"));
    assert.deepEqual(host.kv.settings, { segments: 8, mirror: false });
    assert.equal(host.previews.length, 9);
    await draw(host, emit, { ...STROKE, drawdyElementId: "s2" });
    assert.equal(copies(host).length, 15 + 7);
    await escape(emit);
});

test("remembered settings are used the next time the mode turns on", async () => {
    const { host, emit } = await started({
        kv: { settings: { segments: 3, mirror: false } },
    });
    assert.equal(host.previews.length, 4);
    await draw(host, emit);
    assert.equal(copies(host).length, 2);
    await escape(emit);
});

test("Recentre moves the guides to the centre of the current view", async () => {
    const viewport = { x: 0, y: 0, width: 1600, height: 1000 };
    const { host, emit } = await started({ viewport });
    viewport.x = 1000;
    await click(emit, barButton("recentre"));
    const circles = host.previews.filter((el) => el.type === "shape");
    assert.equal(circles.length, 1);
    assert.equal(
        (circles[0].x as number) + (circles[0].width as number) / 2,
        1800
    );
    await escape(emit);
});

test("a window resize re-centres the bar", async () => {
    const { host, emit } = await started();
    const width = host.floating.get(BAR)!.schema.styles?.width?.[0] as number;
    await emit("subscription:dom:screen-resized", { width: 1000, height: 700 });
    assert.deepEqual(host.floating.get(BAR)?.position, {
        x: Math.round((1000 - width) / 2),
        y: 64,
    });
    await escape(emit);
});
