import type {
    DrawdyElementSchema,
    DriverCommandIssuer,
    DriverModule,
    SubscribeableKey,
    SubscribedDrawdyElement,
} from "@drawdy/driver-protocol";
import { createBar, type Bar, type BarChoice } from "./bar";
import { guideElements } from "./guides";
import { createStrokeWatch, type StrokeWatch } from "./lib/stroke-watch";
import {
    SEGMENT_CHOICES,
    isSegments,
    symmetryCopies,
    type Point,
    type Segments,
    type Symmetry,
} from "./lib/symmetry";

// Drawdy shows this through <img>, where currentColor is black, so the colours are explicit.
const ACTION_BUTTON_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="18" height="18"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs><rect x="1" y="1" width="22" height="22" rx="6" fill="url(#g)"/><g fill="#ffffff" fill-opacity="0.92"><ellipse cx="12" cy="7.4" rx="1.8" ry="3.4"/><ellipse cx="12" cy="7.4" rx="1.8" ry="3.4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="7.4" rx="1.8" ry="3.4" transform="rotate(120 12 12)"/><ellipse cx="12" cy="7.4" rx="1.8" ry="3.4" transform="rotate(180 12 12)"/><ellipse cx="12" cy="7.4" rx="1.8" ry="3.4" transform="rotate(240 12 12)"/><ellipse cx="12" cy="7.4" rx="1.8" ry="3.4" transform="rotate(300 12 12)"/></g><circle cx="12" cy="12" r="1.5" fill="#8b5cf6"/></svg>`;

const LOG = "[mickyngub.kaleidoscope]";
const BUTTON_RETRIES_MS = [800, 2000, 4000, 8000, 15000];
const SETTINGS_KEY = "settings";
const FRAME_ATTACH_MS = 120;
const DEFAULT_SETTINGS: Settings = { segments: 6, mirror: true };
const ADDED_PROPERTIES: SubscribeableKey[] = ["type", "points", "meta"];
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

const CHOICES: BarChoice[] = [
    ...SEGMENT_CHOICES.map((n) => ({ key: String(n), label: String(n) })),
    { key: "mirror", label: "Mirror" },
    { key: "recentre", label: "Recentre" },
    { key: "stop", label: "Stop" },
];

type Settings = { segments: Segments; mirror: boolean };

type Mode = {
    sym: Symmetry;
    watch: StrokeWatch;
    subscriptions: string[];
    guides: string | null;
    queue: Promise<void>;
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

const activeKeys = (s: Settings): string[] =>
    s.mirror ? [String(s.segments), "mirror"] : [String(s.segments)];

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
    ]);
    const subscriptions = subscribed.flatMap((res) =>
        res.res.value ? [res.res.value.subscriptionId] : []
    );
    mode = {
        sym,
        watch: createStrokeWatch({ driverId }),
        subscriptions,
        guides,
        queue: Promise.resolve(),
    };
    await bar.show(activeKeys(s));
}

async function stop(): Promise<void> {
    const active = mode;
    mode = null;
    const tasks: Promise<unknown>[] = [bar.hide()];
    if (active) {
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
        await bar.show(activeKeys(next));
        await saveSettings(next);
        return;
    }
    const segments = Number(key);
    if (!isSegments(segments) || segments === current.segments) return;
    const next = { ...current, segments };
    active.sym = { ...active.sym, segments };
    await bar.show(activeKeys(next));
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
    const copies = symmetryCopies(stroke.points, active.sym);
    const ids = copies.map(() => generateId());
    active.watch.markSeen(ids);
    const added = await issue({
        type: "command:scene:add-drawdy-elements",
        ...stamp(),
        req: {
            elements: copies.map((points, i) => copyOf(ids[i], points, stroke)),
        },
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

async function onElementsAdded(
    added: readonly SubscribedDrawdyElement[]
): Promise<void> {
    const active = mode;
    if (!active) return;
    const now = performance.now();
    const zoom = await currentZoom();
    if (mode !== active) return;
    const id = active.watch.candidate(added, now, zoom);
    if (id === null) return;
    const tool = activeTool();
    active.queue = active.queue
        .then(() => copyStroke(active, id, tool))
        .catch((err) => log("copying a stroke failed", err));
    await active.queue;
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
        choices: CHOICES,
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
                mode?.watch.onPointer(
                    event.body.position.canvasSpace,
                    performance.now()
                );
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
                await bar.resize(event.body.width);
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
