import type {
    DrawdyElementSchema,
    DriverCommandIssuer,
    DriverModule,
    SubscribeableKey,
    SubscribedDrawdyElement,
} from "@drawdy/driver-protocol";
import { createBar, type Bar, type BarChoice } from "./bar";
import { guideElements } from "./guides";
import { ARROW_ICON, LINE_ICON, PENCIL_ICON } from "./icons";
import { lineCopies, type LineStroke } from "./lib/lines";
import {
    createStrokeWatch,
    type Candidate,
    type StrokeWatch,
} from "./lib/stroke-watch";
import {
    SEGMENT_CHOICES,
    isSegments,
    symmetryCopies,
    type Point,
    type Segments,
    type Symmetry,
} from "./lib/symmetry";

// Drawdy shows this through <img>, where currentColor is black, so the colours are explicit.
const ACTION_BUTTON_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="18" height="18"><image href="data:image/webp;base64,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" x="0" y="0" width="24" height="24"/></svg>`;

const LOG = "[mickyngub.kaleidoscope]";
const BUTTON_RETRIES_MS = [800, 2000, 4000, 8000, 15000];
const SETTINGS_KEY = "settings";
const FRAME_ATTACH_MS = 120;
const DEFAULT_SETTINGS: Settings = { segments: 6, mirror: true };
const ADDED_PROPERTIES: SubscribeableKey[] = [
    "type",
    "componentType",
    "points",
    "meta",
];
const LINE_PROPERTIES: SubscribeableKey[] = [
    "points",
    "strokeColor",
    "strokeWidth",
    "strokeDash",
    "opacity",
    "layer",
    "roughness",
    "seed",
];
const STROKE_PROPERTIES: SubscribeableKey[] = [
    "points",
    "strokeColor",
    "strokeWidth",
    "opacity",
    "layer",
    "frameId",
];

export const NEEDS_PERMISSION = "Needs board permission";
export const BOARD_FULL =
    "The board is full (10,000 elements), so no copies were added";
export const ADD_FAILED = "The board would not take the copies";
export const UNSUPPORTED_TOOL =
    "Kaleidoscope mirrors the Pencil, Line and Arrow";

export const PICK_TOOL = "Pick the Pencil, Line or Arrow in Drawdy's toolbar";
export const ELBOW_NOT_MIRRORED = "Elbow arrows aren't mirrored";

const PICK_TOOL_MS = 4000;
const TOOL_POLL_MS = 1000;
const BURST_GAP_MS = 150;
const TOOL_RECHECK_MS = 200;
const TOOLS = ["pencil", "line", "arrow"];
// Drawing tools whose marks are never mirrored; select, drag, eraser and the laser stay quiet.
const UNSUPPORTED_TOOLS = new Set([
    "rect",
    "circle",
    "diamond",
    "text",
    "sticky-note",
    "image",
    "frame",
]);

const GROUPS: BarChoice[][] = [
    [
        { key: "pencil", label: "Pencil", icon: PENCIL_ICON, indicator: true },
        { key: "line", label: "Line", icon: LINE_ICON, indicator: true },
        { key: "arrow", label: "Arrow", icon: ARROW_ICON, indicator: true },
    ],
    SEGMENT_CHOICES.map((n) => ({ key: String(n), label: String(n) })),
    [{ key: "mirror", label: "Mirror" }],
    [
        { key: "recentre", label: "Recentre" },
        { key: "stop", label: "Stop" },
    ],
];

type Settings = { segments: Segments; mirror: boolean };

type Mode = {
    sym: Symmetry;
    watch: StrokeWatch;
    subscriptions: string[];
    guides: string | null;
    queue: Promise<void>;
    poll: ReturnType<typeof setInterval>;
    polling: boolean;
    recheck: boolean;
    tool: string | null;
    pointerAt: number;
    toolCheckedAt: number;
};

type Rect = { x: number; y: number; width: number; height: number };

class PermissionDenied extends Error {}

let issue: DriverCommandIssuer;
let driverId: string;
let generateId: () => string;
let bar: Bar;
let seq = 0;
let settings: Settings | null = null;
let mode: Mode | null = null;
let control: Promise<void> = Promise.resolve();

const stamp = () => ({ driverId, requestId: String(seq++) });

const buttonId = (): string => `${driverId}:action-button`;

const denied = (res: { res: { error?: { type: string } } }): boolean =>
    res.res.error?.type === "unauthorized";

const log = (message: string, err: unknown): void => {
    console.error(`${LOG} ${message}`, err);
};

const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

const serial = (task: () => Promise<void>): Promise<void> => {
    control = control.then(task).catch((err) => {
        if (err instanceof PermissionDenied) {
            return bar.notice({ key: "permission", text: NEEDS_PERMISSION });
        }
        log("action failed", err);
    });
    return control;
};

const activeKeys = (s: Settings, tool: string | null): string[] => [
    ...(tool !== null && TOOLS.includes(tool) ? [tool] : []),
    String(s.segments),
    ...(s.mirror ? ["mirror"] : []),
];

const centreOf = (rect: Rect): Point => ({
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
});

async function viewportRect(): Promise<Rect> {
    const res = await issue({
        type: "command:camera:get-viewport-rect",
        ...stamp(),
    });
    if (res.res.error !== undefined) throw new Error(res.res.error.type);
    return res.res.value.rect;
}

async function currentZoom(): Promise<number> {
    const res = await issue({ type: "command:camera:get-info", ...stamp() });
    return res.res.value?.zoom ?? 1;
}

function readSettings(raw: unknown): Settings {
    const s = (raw ?? {}) as Partial<Settings>;
    return {
        segments: isSegments(s.segments)
            ? s.segments
            : DEFAULT_SETTINGS.segments,
        mirror:
            typeof s.mirror === "boolean" ? s.mirror : DEFAULT_SETTINGS.mirror,
    };
}

async function loadSettings(): Promise<Settings> {
    if (settings) return settings;
    const res = await issue({
        type: "command:kv-storage:get",
        ...stamp(),
        req: { key: SETTINGS_KEY },
    });
    settings = readSettings(res.res.value?.got?.[SETTINGS_KEY]);
    return settings;
}

async function saveSettings(next: Settings): Promise<void> {
    settings = next;
    const res = await issue({
        type: "command:kv-storage:set",
        ...stamp(),
        req: { key: SETTINGS_KEY, payload: { [SETTINGS_KEY]: next } },
    });
    if (res.res.error !== undefined) log("settings not saved", res.res.error);
}

async function createGuides(sym: Symmetry): Promise<string | null> {
    const viewport = await viewportRect();
    const zoom = await currentZoom();
    const res = await issue({
        type: "command:scene:create-drawdy-preview-elements",
        ...stamp(),
        req: {
            elements: guideElements(sym, viewport, zoom, generateId),
            hitTestable: false,
        },
    });
    if (denied(res)) throw new PermissionDenied();
    if (res.res.error !== undefined) {
        log("guides not shown", res.res.error);
        return null;
    }
    return res.res.value.previewId;
}

async function deleteGuides(previewId: string | null): Promise<void> {
    if (previewId === null) return;
    await issue({
        type: "command:scene:delete-drawdy-preview-elements",
        ...stamp(),
        req: { previewIds: [previewId] },
    });
}

async function start(): Promise<void> {
    if (mode) return;
    const s = await loadSettings();
    const sym: Symmetry = {
        segments: s.segments,
        mirror: s.mirror,
        centre: centreOf(await viewportRect()),
    };
    // The first scene command, so a refused permission stops here with nothing to undo.
    const guides = await createGuides(sym);
    // Never set the tool: the driver call moves the engine but not Drawdy's toolbar highlight.
    const tool = await activeTool();
    const subscribed = await Promise.all([
        issue({
            type: "subscription:scene:elements-added",
            ...stamp(),
            req: { properties: ADDED_PROPERTIES },
        }),
        issue({ type: "subscription:scene:pointer-position", ...stamp() }),
        issue({
            type: "subscription:scene:elements-replaced",
            ...stamp(),
            req: { properties: [] },
        }),
        issue({
            type: "subscription:scene:drawdy-element-selection",
            ...stamp(),
        }),
    ]);
    const subscriptions = subscribed.flatMap((res) =>
        res.res.value ? [res.res.value.subscriptionId] : []
    );
    const active: Mode = {
        sym,
        watch: createStrokeWatch({ driverId }),
        subscriptions,
        guides,
        queue: Promise.resolve(),
        poll: setInterval(() => {
            checkTool(active).catch((err) => log("tool check failed", err));
        }, TOOL_POLL_MS),
        polling: false,
        recheck: false,
        tool,
        pointerAt: -Infinity,
        toolCheckedAt: -Infinity,
    };
    active.watch.onTool(tool, performance.now());
    mode = active;
    await bar.show(activeKeys(s, tool));
    await holdForTool(tool);
    if (tool === null || !TOOLS.includes(tool)) {
        await bar.notice({ key: "pick", text: PICK_TOOL }, PICK_TOOL_MS);
    }
}

const holdForTool = (tool: string | null): Promise<void> =>
    tool !== null && UNSUPPORTED_TOOLS.has(tool)
        ? bar.hold({ key: "tool", text: UNSUPPORTED_TOOL })
        : bar.release("tool");

async function showTool(active: Mode, tool: string | null): Promise<void> {
    const highlightChanged =
        TOOLS.includes(tool ?? "") || TOOLS.includes(active.tool ?? "");
    const changed = tool !== active.tool;
    active.tool = tool;
    if (changed && highlightChanged) {
        await bar.show(activeKeys(await loadSettings(), tool));
    }
    await holdForTool(tool);
}

// Drawdy announces no tool changes, so the highlight, the notice and the
// line-or-arrow decision all rest on asking; a check asked for mid-flight runs again after.
async function checkTool(active: Mode): Promise<void> {
    if (mode !== active) return;
    if (active.polling) {
        active.recheck = true;
        return;
    }
    active.polling = true;
    try {
        do {
            active.recheck = false;
            active.toolCheckedAt = performance.now();
            const tool = await activeTool();
            if (mode !== active) return;
            active.watch.onTool(tool, performance.now());
            await showTool(active, tool);
        } while (active.recheck && mode === active);
    } finally {
        active.polling = false;
    }
}

// A line takes its tool from the drag that drew it, so the tool is asked for as a pointer burst starts and while it moves.
async function onPointerMoved(
    active: Mode,
    at: { x: number; y: number }
): Promise<void> {
    const now = performance.now();
    active.watch.onPointer(at, now);
    const burst = now - active.pointerAt >= BURST_GAP_MS;
    active.pointerAt = now;
    if (burst || now - active.toolCheckedAt >= TOOL_RECHECK_MS) {
        await checkTool(active);
    }
}

async function stop(): Promise<void> {
    const active = mode;
    mode = null;
    const tasks: Promise<unknown>[] = [bar.hide()];
    if (active) {
        clearInterval(active.poll);
        tasks.push(deleteGuides(active.guides));
        for (const subscriptionId of active.subscriptions) {
            tasks.push(
                issue({
                    type: "command:subscription:remove",
                    ...stamp(),
                    req: { subscriptionId },
                })
            );
        }
    }
    const results = await Promise.allSettled(tasks);
    for (const r of results) {
        if (r.status === "rejected") log("stop cleanup failed", r.reason);
    }
}

const toggle = (): Promise<void> => (mode ? stop() : start());

async function rebuildGuides(active: Mode): Promise<void> {
    const old = active.guides;
    active.guides = await createGuides(active.sym);
    await deleteGuides(old);
}

async function choose(key: string): Promise<void> {
    if (key === "stop") return stop();
    const active = mode;
    if (!active) return;
    const current = await loadSettings();
    if (key === "recentre") {
        active.sym = { ...active.sym, centre: centreOf(await viewportRect()) };
        await rebuildGuides(active);
        return;
    }
    if (key === "mirror") {
        const next = { ...current, mirror: !current.mirror };
        active.sym = { ...active.sym, mirror: next.mirror };
        await bar.show(activeKeys(next, active.tool));
        await saveSettings(next);
        return;
    }
    const segments = Number(key);
    if (!isSegments(segments) || segments === current.segments) return;
    const next = { ...current, segments };
    active.sym = { ...active.sym, segments };
    await bar.show(activeKeys(next, active.tool));
    await rebuildGuides(active);
    await saveSettings(next);
}

async function activeTool(): Promise<string | null> {
    const res = await issue({ type: "command:tools:get-active", ...stamp() });
    return res.res.value?.toolId ?? null;
}

async function readStroke(id: string): Promise<SubscribedDrawdyElement | null> {
    const res = await issue({
        type: "command:scene:get-drawdy-elements",
        ...stamp(),
        req: { properties: STROKE_PROPERTIES, drawdyElementIds: [id] },
    });
    if (res.res.error !== undefined) return null;
    return res.res.value.drawdyElements[0] ?? null;
}

function copyOf(
    drawdyElementId: string,
    points: [number, number][],
    stroke: SubscribedDrawdyElement
): DrawdyElementSchema {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    return {
        type: "freedraw",
        drawdyElementId,
        points: points.flat(),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
        ...(stroke.strokeColor !== undefined && {
            strokeColor: stroke.strokeColor,
        }),
        ...(stroke.strokeWidth !== undefined && {
            strokeWidth: stroke.strokeWidth,
        }),
        ...(stroke.opacity !== undefined && { opacity: stroke.opacity }),
        ...(stroke.layer !== undefined && { layer: stroke.layer }),
        meta: { [driverId]: { v: 1, of: stroke.id } },
    };
}

async function addCopies(
    active: Mode,
    elements: DrawdyElementSchema[]
): Promise<void> {
    if (elements.length === 0) return;
    const ids = elements.map((el) => el.drawdyElementId);
    active.watch.markSeen(ids);
    const added = await issue({
        type: "command:scene:add-drawdy-elements",
        ...stamp(),
        req: { elements },
    });
    if (added.res.error !== undefined) {
        await bar.notice(
            denied(added)
                ? { key: "permission", text: NEEDS_PERMISSION }
                : { key: "add-failed", text: ADD_FAILED }
        );
        return;
    }
    // Over its element limit the board adds nothing but still answers success.
    const back = await issue({
        type: "command:scene:element-rects",
        ...stamp(),
        req: { drawdyElementIds: [ids[0]] },
    });
    if (back.res.error === undefined && back.res.value.rects.length === 0) {
        await bar.notice({ key: "board-full", text: BOARD_FULL });
    }
}

async function copyStroke(
    active: Mode,
    id: string,
    tool: Promise<string | null>
): Promise<void> {
    if ((await tool) !== "pencil") return;
    await sleep(FRAME_ATTACH_MS);
    if (mode !== active) return;
    const stroke = await readStroke(id);
    if (mode !== active || !stroke?.points || stroke.points.length < 2) return;
    await addCopies(
        active,
        symmetryCopies(stroke.points, active.sym).map((points) =>
            copyOf(generateId(), points, stroke)
        )
    );
}

async function readLine(
    id: string,
    kind: LineStroke["kind"]
): Promise<LineStroke | null> {
    const res = await issue({
        type: "command:scene:get-drawdy-elements",
        ...stamp(),
        req: { properties: LINE_PROPERTIES, drawdyElementIds: [id] },
    });
    if (res.res.error !== undefined) return null;
    const el = res.res.value.drawdyElements[0];
    if (!el?.points || el.points.length < 2) return null;
    return {
        id,
        kind,
        points: el.points,
        color: el.strokeColor,
        strokeWidth: el.strokeWidth,
        strokeDash: el.strokeDash,
        opacity: el.opacity,
        layer: el.layer,
        roughness: el.roughness,
        seed: el.seed,
    };
}

async function copyLine(
    active: Mode,
    id: string,
    kind: LineStroke["kind"]
): Promise<void> {
    const line = await readLine(id, kind);
    if (mode !== active || !line) return;
    const copies = lineCopies(line, active.sym, generateId, {
        [driverId]: { v: 1, of: id },
    });
    if (copies === null) {
        await bar.notice({ key: "elbow", text: ELBOW_NOT_MIRRORED });
        return;
    }
    await addCopies(active, copies);
}

async function copyCandidate(active: Mode, c: Candidate): Promise<void> {
    const { id, kind } = c;
    let task: () => Promise<void>;
    if (kind === "freedraw") {
        const tool = activeTool();
        task = () => copyStroke(active, id, tool);
    } else {
        task = () => copyLine(active, id, kind);
    }
    active.queue = active.queue
        .then(task)
        .catch((err) => log("copying a stroke failed", err));
    await active.queue;
}

async function onElementsAdded(
    added: readonly SubscribedDrawdyElement[]
): Promise<void> {
    const active = mode;
    if (!active) return;
    const now = performance.now();
    const zoom = await currentZoom();
    if (mode !== active) return;
    const c = active.watch.candidate(added, now, zoom);
    if (c) await copyCandidate(active, c);
}

const installButton = async (attempt: number): Promise<void> => {
    try {
        const created = await issue({
            type: "command:dom:create-action-button",
            ...stamp(),
            req: { domElementId: buttonId(), svg: ACTION_BUTTON_SVG },
        });
        if (created.res.value?.created) {
            await issue({
                type: "subscription:dom:element-clicked",
                ...stamp(),
                req: { domElementId: buttonId() },
            });
            return;
        }
    } catch (err) {
        log(`button attempt ${attempt} failed`, err);
    }
    if (attempt >= BUTTON_RETRIES_MS.length) {
        console.error(`${LOG} action button never created`);
        return;
    }
    setTimeout(() => {
        void installButton(attempt + 1);
    }, BUTTON_RETRIES_MS[attempt]);
};

export const activate: DriverModule["activate"] = async (ctx) => {
    issue = ctx.issueCommand;
    driverId = ctx.manifest.driverId;
    generateId = ctx.generateId;
    settings = null;
    mode = null;
    control = Promise.resolve();
    bar = createBar({
        issue,
        driverId,
        groups: GROUPS,
        styling: ctx.styling,
        requestId: () => String(seq++),
        log,
    });
    try {
        await issue({
            type: "subscription:keyboard:control-keys",
            ...stamp(),
        });
        await issue({ type: "subscription:dom:screen-resized", ...stamp() });
        await issue({ type: "subscription:dom:theme-changed", ...stamp() });
        await bar.subscribe();
        await installButton(0);
    } catch (err) {
        log("activation failed", err);
    }
};

export const onEvent: DriverModule["onEvent"] = async (event) => {
    if (!bar) return;
    try {
        switch (event.type) {
            case "subscription:dom:element-clicked": {
                const id = event.body.domElementId;
                if (id === buttonId()) return await serial(toggle);
                const key = bar.keyOf(id);
                if (key !== null) await serial(() => choose(key));
                return;
            }
            case "subscription:keyboard:control-keys": {
                if (event.body.key !== "escape") return;
                if (!mode && !bar.shown) return;
                await serial(stop);
                return;
            }
            case "subscription:scene:pointer-position": {
                if (mode) {
                    await onPointerMoved(mode, event.body.position.canvasSpace);
                }
                return;
            }
            case "subscription:scene:drawdy-element-selection": {
                const active = mode;
                const c = active?.watch.onSelection(
                    event.body.drawdyElementIds,
                    performance.now()
                );
                if (active && c) await copyCandidate(active, c);
                return;
            }
            case "subscription:scene:elements-added": {
                await onElementsAdded(event.body.drawdyElements);
                return;
            }
            case "subscription:scene:elements-replaced": {
                if (mode) await serial(stop);
                return;
            }
            case "subscription:dom:screen-resized": {
                await bar.resize(event.body);
                return;
            }
            case "subscription:dom:theme-changed": {
                await bar.restyle(event.body.styling);
                return;
            }
            default:
                return;
        }
    } catch (err) {
        log("onEvent failed", err);
    }
};
