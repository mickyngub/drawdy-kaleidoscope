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

const FLAT = { theme: "light", primary: "#2563eb", surface2: "#e4e4e7" };
const CONTROL = "#00000014";
const ACCENT = "#c5f601";
const TERTIARY = "#00000080";
const STYLING = {
    ...FLAT,
    tokens: {
        "--dd-control-surface": CONTROL,
        "--dd-accent": ACCENT,
        "--dd-text-tertiary": TERTIARY,
    },
};

async function started(options: Parameters<typeof fakeHost>[0] = {}) {
    const host = fakeHost(options);
    const { emit } = await boot(driver, host, manifest, STYLING);
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

const sizeOf = (host: FakeHost) => {
    const styles = host.floating.get(BAR)?.schema.styles;
    return {
        width: styles?.width?.[0] as number,
        height: styles?.height?.[0] as number,
    };
};

// Settings light up with the neutral control fill; the tool indicators add a lime underline, as in Drawdy's toolbar.
const highlighted = (host: FakeHost, fill: string = CONTROL) =>
    schemaNodes(host.floating.get(BAR)?.schema ?? { type: "box" })
        .filter(
            (node) =>
                node.type === "button" && node.styles?.backgroundColor === fill
        )
        .map((node) => node.domId);

const toolSets = (host: FakeHost) =>
    host.sent.filter((s) => s.type === "command:tools:set-active");

const TOOL_KEYS = ["pencil", "line", "arrow"];

/** Each tool's underline fill, read through the underline node's own domId. */
const underlines = (host: FakeHost) => {
    const nodes = schemaNodes(
        host.floating.get(BAR)?.schema ?? { type: "box" }
    );
    return Object.fromEntries(
        TOOL_KEYS.map((tool) => [
            tool,
            nodes.find((node) => node.domId === `${barButton(tool)}:underline`)
                ?.styles?.backgroundColor,
        ])
    );
};

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("turning the mode on leaves Drawdy's tool alone, puts the bar at the bottom centre, draws the guides and watches strokes", async () => {
    const { host, emit } = await started();
    const bar = host.floating.get(BAR);
    assert.ok(bar);
    assert.equal(bar.asPopover, false);
    assert.equal(bar.schema.styles?.pointerEvents, "auto");
    const { width, height } = sizeOf(host);
    assert.deepEqual(bar.position, {
        x: Math.round((1600 - width) / 2),
        y: 1000 - height - 24,
    });
    assert.ok(
        width <= 1024 - 2 * 240,
        "at 1024 px wide the bar stays clear of Drawdy's corner controls"
    );
    assert.deepEqual(highlighted(host), [barButton("6"), barButton("mirror")]);
    assert.deepEqual(underlines(host), {
        pencil: ACCENT,
        line: "transparent",
        arrow: "transparent",
    });
    const pencil = schemaNodes(bar.schema).find(
        (node) => node.domId === barButton("pencil")
    );
    assert.equal(pencil?.styles?.backgroundColor, CONTROL);
    assert.deepEqual(toolSets(host), []);
    assert.deepEqual(noticeKeys(host), []);
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
    await escape(emit);
});

test("a host that sends no tokens styles the bar from the flat keys", async () => {
    const host = fakeHost();
    const { emit } = await boot(driver, host, manifest, FLAT);
    await click(emit, BUTTON);
    assert.deepEqual(highlighted(host, FLAT.surface2), [
        barButton("6"),
        barButton("mirror"),
    ]);
    assert.equal(underlines(host).pencil, FLAT.primary);
    await escape(emit);
});

test("a theme change repaints the bar and the guides from the new tokens", async () => {
    const { host, emit } = await started();
    const guideColours = () =>
        new Set(host.previews.map((el) => el.color ?? el.strokeColor));
    assert.deepEqual(guideColours(), new Set([TERTIARY]));
    await emit("subscription:dom:theme-changed", {
        styling: {
            ...STYLING,
            theme: "dark",
            tokens: {
                "--dd-control-surface": "#ffffff1f",
                "--dd-accent": ACCENT,
                "--dd-text-tertiary": "#ffffff80",
            },
        },
    });
    assert.deepEqual(highlighted(host, "#ffffff1f"), [
        barButton("6"),
        barButton("mirror"),
    ]);
    assert.equal(host.previews.length, 7);
    assert.deepEqual(guideColours(), new Set(["#ffffff80"]));
    await escape(emit);
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
    const { host, emit } = await started();
    host.setTool("select");
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

test("a window resize moves the bar to the new bottom centre", async () => {
    const { host, emit } = await started();
    const { width, height } = sizeOf(host);
    await emit("subscription:dom:screen-resized", { width: 1000, height: 700 });
    assert.deepEqual(host.floating.get(BAR)?.position, {
        x: Math.round((1000 - width) / 2),
        y: 700 - height - 24,
    });
    await escape(emit);
});

test("the tool icons only show state: they take no clicks", async () => {
    const { host, emit } = await started();
    for (const tool of TOOL_KEYS) {
        assert.equal(await click(emit, barButton(tool)), false);
    }
    const group = schemaNodes(host.floating.get(BAR)!.schema).find(
        (node) =>
            node.type === "row" &&
            (node.children ?? []).some(
                (child) => child.domId === barButton("line")
            )
    );
    assert.equal(group?.styles?.pointerEvents, "none");
    assert.deepEqual(toolSets(host), []);
    await escape(emit);
});

test("turning on with a tool Kaleidoscope can't mirror says which tools to pick, for 4 s", async () => {
    const off = await started({ tool: "select" });
    assert.deepEqual(noticeKeys(off.host), [barNotice("pick")]);
    assert.deepEqual(underlines(off.host), {
        pencil: "transparent",
        line: "transparent",
        arrow: "transparent",
    });
    await escape(off.emit);

    const on = await started({ tool: "pencil" });
    assert.deepEqual(noticeKeys(on.host), []);
    await escape(on.emit);
});

test("the poll keeps the tool highlight in sync with Drawdy's toolbar", async (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    const { host, emit } = await started();
    for (const tool of ["arrow", "line", "select", "pencil"]) {
        host.setTool(tool);
        t.mock.timers.tick(1000);
        await settle();
        assert.deepEqual(
            underlines(host),
            Object.fromEntries(
                TOOL_KEYS.map((k) => [k, k === tool ? ACCENT : "transparent"])
            )
        );
    }
    assert.deepEqual(toolSets(host), []);
    await escape(emit);
});

test("an unsupported drawing tool holds the tool notice; select and eraser never do", async (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    const { host, emit } = await started();
    const noticeFor = async (tool: string) => {
        host.setTool(tool);
        t.mock.timers.tick(1000);
        await settle();
        return noticeKeys(host);
    };
    assert.deepEqual(await noticeFor("rect"), [barNotice("tool")]);
    const { height } = sizeOf(host);
    assert.equal(host.floating.get(BAR)?.position.y, 1000 - height - 24);
    assert.deepEqual(await noticeFor("select"), []);
    assert.deepEqual(await noticeFor("text"), [barNotice("tool")]);
    assert.deepEqual(await noticeFor("eraser"), []);
    assert.deepEqual(await noticeFor("line"), []);
    await escape(emit);
});

test("stopping ends the tool poll", async (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    const { host, emit } = await started();
    await escape(emit);
    host.clear();
    host.setTool("rect");
    t.mock.timers.tick(3000);
    await settle();
    assert.ok(!host.types().includes("command:tools:get-active"));
    assert.ok(!host.floating.has(BAR));
});

const LINE: Stored = {
    drawdyElementId: "l1",
    type: "path",
    points: [900, 500, 1000, 450],
    strokeColor: "#ef4444",
    strokeWidth: 3,
    strokeDash: "dashed",
    opacity: 0.9,
    layer: 2,
    roughness: 1,
    seed: 42,
};

const ELBOW: Stored = {
    ...LINE,
    drawdyElementId: "e1",
    points: [900, 500, 950, 500, 950, 580, 1000, 580],
};

// Long enough without pointer moves that the next one starts a new burst.
const pause = () => new Promise((resolve) => setTimeout(resolve, 170));

/** The local user dragging a line or arrow: the pointer moves with the tool active, Drawdy commits, then selects it on Select. */
async function drawPath(
    host: FakeHost,
    emit: Emit,
    tool: string,
    el: Stored = LINE,
    { select = true }: { select?: boolean } = {}
) {
    await pause();
    host.setTool(tool);
    const [[x0, y0], [x1, y1]] = pointsOf(el);
    await pointerAt(emit, x0, y0);
    await pointerAt(emit, x1, y1);
    host.setTool("select");
    host.put({ ...el });
    await emit("subscription:scene:elements-added", {
        drawdyElements: [
            { id: el.drawdyElementId, type: "path", points: pointsOf(el) },
        ],
        properties: ["type", "componentType", "points", "meta"],
    });
    if (select) {
        await emit("subscription:scene:drawdy-element-selection", {
            drawdyElementIds: [el.drawdyElementId],
        });
    }
}

const lineCopiesOf = (host: FakeHost, id: string) =>
    [...host.elements.values()].filter(
        (el) => (el.meta as any)?.[manifest.driverId]?.of === id
    );

test("a line is copied when Drawdy selects it right after the add; a remote one is not", async () => {
    const { host, emit } = await started();
    await drawPath(host, emit, "line", LINE, { select: false });
    assert.equal(adds(host).length, 0);

    await drawPath(host, emit, "line", { ...LINE, drawdyElementId: "l2" });
    assert.equal(adds(host).length, 1);
    const made = lineCopiesOf(host, "l2");
    assert.equal(made.length, 11);
    assert.ok(made.every((el) => el.type === "line"));
    await escape(emit);
});

test("an arrow at 6 segments with Mirror gives 11 arrows whose ends are the originals turned about the centre", async () => {
    const { host, emit } = await started();
    await drawPath(host, emit, "arrow");
    const made = lineCopiesOf(host, "l1");
    assert.equal(made.length, 11);
    const radius = ([x, y]: [number, number]) => Math.hypot(x - 800, y - 500);
    for (const el of made) {
        assert.equal(el.type, "arrow");
        assert.ok(Math.abs(radius(el.from as [number, number]) - 100) < 1e-9);
        assert.ok(
            Math.abs(radius(el.to as [number, number]) - Math.hypot(200, 50)) <
                1e-9
        );
        assert.equal(el.color, "#ef4444");
        assert.equal(el.strokeDash, "dashed");
        assert.equal(el.roughness, 1);
        assert.equal(el.seed, 42);
    }
    const sixty = Math.PI / 3;
    const [first] = made;
    assert.ok(
        Math.abs((first.from as number[])[0] - (800 + 100 * Math.cos(sixty))) <
            1e-9
    );
    assert.ok(
        Math.abs((first.from as number[])[1] - (500 + 100 * Math.sin(sixty))) <
            1e-9
    );
    await escape(emit);
});

test("an elbow arrow is never mirrored, at any segment count, and the bar says so", async () => {
    const { host, emit } = await started();
    await drawPath(host, emit, "arrow", ELBOW);
    assert.equal(adds(host).length, 0);
    assert.deepEqual(noticeKeys(host), [barNotice("elbow")]);

    await click(emit, barButton("4"));
    await drawPath(host, emit, "arrow", { ...ELBOW, drawdyElementId: "e2" });
    assert.equal(adds(host).length, 0);
    assert.equal(lineCopiesOf(host, "e2").length, 0);
    assert.deepEqual(noticeKeys(host), [barNotice("elbow")]);
    await escape(emit);
});

test("the tool seen as the drag starts decides line or arrow, even after Drawdy switches to Select", async (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    const { host, emit } = await started();
    await drawPath(host, emit, "line", { ...LINE, drawdyElementId: "p1" });
    assert.ok(lineCopiesOf(host, "p1").every((el) => el.type === "line"));

    await drawPath(host, emit, "arrow", { ...LINE, drawdyElementId: "p2" });
    assert.ok(lineCopiesOf(host, "p2").every((el) => el.type === "arrow"));

    await pause();
    host.setTool("line");
    await pointerAt(emit, 900, 500);
    host.setTool("select");
    t.mock.timers.tick(1000);
    await settle();
    host.put({ ...LINE, drawdyElementId: "p3" });
    await emit("subscription:scene:elements-added", {
        drawdyElements: [{ id: "p3", type: "path", points: pointsOf(LINE) }],
        properties: ["type", "componentType", "points", "meta"],
    });
    await emit("subscription:scene:drawdy-element-selection", {
        drawdyElementIds: ["p3"],
    });
    const p3 = lineCopiesOf(host, "p3");
    assert.equal(p3.length, 11);
    assert.ok(p3.every((el) => el.type === "line"));
    await escape(emit);
});

test("a line pasted on Select is not copied even though Drawdy selects it", async () => {
    const { host, emit } = await started();
    await drawPath(host, emit, "select");
    assert.equal(adds(host).length, 0);
    await escape(emit);
});
