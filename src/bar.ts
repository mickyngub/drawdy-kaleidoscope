import type {
    DomElementSchema,
    DriverCommandIssuer,
    ModuleStyling,
} from "@drawdy/driver-protocol";
import { themeColour } from "./theme";

export type BarChoice = {
    key: string;
    label: string;
    icon?: (colour: string) => string;
    /** Shows state only: never clickable, lit like Drawdy's own toolbar. */
    indicator?: boolean;
};

export type BarNotice = { key: string; text: string };

export type BarLook = { driverId: string; styling: ModuleStyling };

// Bottom centre keeps clear of Drawdy's toolbar and its tooltips at the top and of its corner controls.
export const BAR_BOTTOM_GAP = 24;
export const NOTICE_MS = 3000;

const PADDING = 4;
const BORDER = 1;
const GAP = 2;
const ITEM = 30;
const ICON = 16;
const ICON_TOP = (ITEM - ICON) / 2;
const ICON_GAP = 4;
const LABEL_INSET = 8;
const UNDERLINE_GAP = 3;
const UNDERLINE_WIDTH = 16;
const UNDERLINE_HEIGHT = 2;
const RADIUS = 8;
const BAR_RADIUS = 12;
const DIVIDER_SLOT = 5;
const DIVIDER_HEIGHT = 16;
const FONT_SIZE = 12;
const NOTICE_HEIGHT = 18;

// Measured in Drawdy's Google Sans Flex at 12 px medium.
const LABEL_PX: Readonly<Record<string, number>> = {
    Mirror: 35,
    Recentre: 51,
    Stop: 26,
};

type Palette = {
    panel: string;
    border: string;
    divider: string;
    control: string;
    hover: string;
    text: string;
    muted: string;
    accent: string;
};

type Paint = { driverId: string; colours: Palette };

const palette = (styling: ModuleStyling): Palette => ({
    panel: themeColour(styling, "--dd-surface-panel", "surface"),
    border: themeColour(styling, "--dd-border-subtle", "border"),
    divider: themeColour(styling, "--dd-divider", "border"),
    control: themeColour(styling, "--dd-control-surface", "surface2"),
    hover: themeColour(styling, "--dd-interaction-hover", "surface2"),
    text: themeColour(styling, "--dd-text-primary", "foreground"),
    muted: themeColour(styling, "--dd-text-secondary", "mutedForeground"),
    accent: themeColour(styling, "--dd-accent", "primary"),
});

export const barId = (driverId: string): string => `${driverId}:bar`;

export const barButtonId = (driverId: string, key: string): string =>
    `${driverId}:bar:${key}`;

export const barUnderlineId = (driverId: string, key: string): string =>
    `${driverId}:bar:${key}:underline`;

export const barNoticeId = (driverId: string, key: string): string =>
    `${driverId}:bar:notice:${key}`;

const labelWidth = (label: string): number => {
    const px = LABEL_PX[label];
    if (px === undefined) throw new Error(`no measured width for "${label}"`);
    return px;
};

const itemWidth = (c: BarChoice): number =>
    c.icon && !c.indicator
        ? 2 * LABEL_INSET + ICON + ICON_GAP + labelWidth(c.label)
        : ITEM;

// A floating element is placed by its top-left corner, so the bar's size is fixed here rather than measured.
export const barWidth = (groups: readonly (readonly BarChoice[])[]): number => {
    const items = groups.flat();
    const dividers = Math.max(0, groups.length - 1);
    return (
        2 * (PADDING + BORDER) +
        items.reduce((sum, c) => sum + itemWidth(c), 0) +
        dividers * DIVIDER_SLOT +
        GAP * Math.max(0, items.length + dividers - 1)
    );
};

export const barHeight = (withNotice: boolean): number =>
    2 * (PADDING + BORDER) + ITEM + (withNotice ? GAP + NOTICE_HEIGHT : 0);

const label = (text: string, colour: string): DomElementSchema => ({
    type: "text",
    child: text,
    styles: {
        color: colour,
        fontSize: [FONT_SIZE, "px"],
        fontWeight: "medium",
        textAlign: "center",
    },
});

const glyph = (src: string): DomElementSchema => ({
    type: "image",
    child: src,
    styles: { width: [ICON, "px"], height: [ICON, "px"] },
});

// An indicator marks the active tool the way Drawdy's own toolbar does, with a lime underline.
function indicator(
    paint: Paint,
    c: BarChoice,
    icon: (colour: string) => string,
    on: boolean
): DomElementSchema {
    const { colours } = paint;
    return {
        type: "box",
        domId: barButtonId(paint.driverId, c.key),
        styles: {
            width: [ITEM, "px"],
            height: [ITEM, "px"],
            borderRadius: [RADIUS, "px"],
            backgroundColor: on ? colours.control : "transparent",
        },
        children: [
            {
                type: "column",
                styles: {
                    width: [ITEM, "px"],
                    height: [ITEM, "px"],
                    crossAxisAlignment: "center",
                },
                children: [
                    { type: "box", styles: { height: [ICON_TOP, "px"] } },
                    glyph(icon(on ? colours.text : colours.muted)),
                    { type: "box", styles: { height: [UNDERLINE_GAP, "px"] } },
                    {
                        type: "box",
                        domId: barUnderlineId(paint.driverId, c.key),
                        styles: {
                            width: [UNDERLINE_WIDTH, "px"],
                            height: [UNDERLINE_HEIGHT, "px"],
                            borderRadius: [UNDERLINE_HEIGHT / 2, "px"],
                            backgroundColor: on
                                ? colours.accent
                                : "transparent",
                        },
                    },
                ],
            },
        ],
    };
}

function item(paint: Paint, c: BarChoice, on: boolean): DomElementSchema {
    if (c.indicator && c.icon) return indicator(paint, c, c.icon, on);
    const { colours } = paint;
    const colour = on ? colours.text : colours.muted;
    const width = itemWidth(c);
    return {
        type: "button",
        domId: barButtonId(paint.driverId, c.key),
        styles: {
            width: [width, "px"],
            height: [ITEM, "px"],
            borderRadius: [RADIUS, "px"],
            backgroundColor: on ? colours.control : "transparent",
            cursor: "pointer",
            ...(on ? {} : { hover: { backgroundColor: colours.hover } }),
        },
        children: c.icon
            ? [
                  {
                      type: "row",
                      styles: {
                          width: [width, "px"],
                          height: [ITEM, "px"],
                          gap: ICON_GAP,
                          mainAxisAlignment: "center",
                          crossAxisAlignment: "center",
                      },
                      children: [glyph(c.icon(colour)), label(c.label, colour)],
                  },
              ]
            : [label(c.label, colour)],
    };
}

const divider = (colours: Palette): DomElementSchema => ({
    type: "row",
    styles: {
        width: [DIVIDER_SLOT, "px"],
        height: [DIVIDER_HEIGHT, "px"],
        mainAxisAlignment: "center",
    },
    children: [
        {
            type: "box",
            styles: {
                width: [1, "px"],
                height: [DIVIDER_HEIGHT, "px"],
                backgroundColor: colours.divider,
            },
        },
    ],
});

export function barSchema(
    look: BarLook,
    groups: readonly (readonly BarChoice[])[],
    active: readonly string[],
    notice?: BarNotice
): DomElementSchema {
    const { driverId } = look;
    const colours = palette(look.styling);
    const paint: Paint = { driverId, colours };
    const width = barWidth(groups);
    const items: DomElementSchema[] = [];
    groups.forEach((group, i) => {
        if (i > 0) items.push(divider(colours));
        const made = group.map((c) => item(paint, c, active.includes(c.key)));
        if (group.every((c) => c.indicator)) {
            items.push({
                type: "row",
                children: made,
                styles: { gap: GAP, pointerEvents: "none" },
            });
        } else {
            items.push(...made);
        }
    });
    const children: DomElementSchema[] = [
        {
            type: "row",
            children: items,
            styles: { gap: GAP, crossAxisAlignment: "center" },
        },
    ];
    if (notice) {
        children.push({
            type: "text",
            domId: barNoticeId(driverId, notice.key),
            child: notice.text,
            styles: {
                width: [width - 2 * (PADDING + BORDER), "px"],
                height: [NOTICE_HEIGHT, "px"],
                color: colours.muted,
                fontSize: [FONT_SIZE, "px"],
                textAlign: "center",
            },
        });
    }
    return {
        type: "column",
        children,
        styles: {
            width: [width, "px"],
            height: [barHeight(notice !== undefined), "px"],
            padding: [PADDING, "px"],
            gap: GAP,
            backgroundColor: colours.panel,
            borderColor: colours.border,
            borderWidth: [BORDER, "px"],
            borderRadius: [BAR_RADIUS, "px"],
            pointerEvents: "auto",
            crossAxisAlignment: "center",
        },
    };
}

export type Bar = {
    subscribe(): Promise<void>;
    keyOf(domElementId: string): string | null;
    show(active: readonly string[]): Promise<void>;
    notice(notice: BarNotice, ms?: number): Promise<void>;
    hold(notice: BarNotice): Promise<void>;
    release(key: string): Promise<void>;
    resize(size: { width: number; height: number }): Promise<void>;
    restyle(styling: ModuleStyling): Promise<void>;
    hide(): Promise<void>;
    readonly shown: boolean;
};

// notice() shows for NOTICE_MS unless told otherwise; hold() stays until release(). A notice raised
// while the bar is hidden shows the bar on its own and takes it away again.
export function createBar(o: {
    issue: DriverCommandIssuer;
    driverId: string;
    groups: readonly (readonly BarChoice[])[];
    styling: ModuleStyling;
    requestId: () => string;
    log: (message: string, err: unknown) => void;
}): Bar {
    const { issue, driverId, groups } = o;
    const choices = groups.flat().filter((c) => !c.indicator);
    const domId = barId(driverId);
    const stamp = () => ({ driverId, requestId: o.requestId() });
    let styling = o.styling;
    let wanted: { active: readonly string[]; transient: boolean } | null = null;
    let notice: BarNotice | null = null;
    let held: BarNotice | null = null;
    let noticeTimer: ReturnType<typeof setTimeout> | null = null;
    let windowSize: { width: number; height: number } | null = null;
    let created = false;
    let chain: Promise<void> = Promise.resolve();

    const shownNotice = (): BarNotice | null => notice ?? held;

    const position = () => {
        const size = windowSize ?? { width: 0, height: 0 };
        return {
            x: Math.max(0, Math.round((size.width - barWidth(groups)) / 2)),
            y: Math.max(
                0,
                size.height - barHeight(shownNotice() !== null) - BAR_BOTTOM_GAP
            ),
        };
    };

    const reconcile = async (): Promise<void> => {
        if (!wanted) {
            if (!created) return;
            created = false;
            await issue({
                type: "command:dom:remove-floating-element",
                ...stamp(),
                req: { domId },
            });
            return;
        }
        if (windowSize === null) {
            const size = await issue({
                type: "command:dom:window-size",
                ...stamp(),
            });
            windowSize = size.res.value ?? { width: 0, height: 0 };
        }
        if (!wanted) return;
        const schema = barSchema(
            { driverId, styling },
            groups,
            wanted.active,
            shownNotice() ?? undefined
        );
        if (created) {
            await issue({
                type: "command:dom:update-floating-element",
                ...stamp(),
                req: { domId, position: position(), schema },
            });
            return;
        }
        const res = await issue({
            type: "command:dom:create-floating-element",
            ...stamp(),
            req: { domId, position: position(), schema, asPopover: false },
        });
        if (res.res.error !== undefined) {
            o.log("bar not shown", res.res.error);
            return;
        }
        created = true;
    };

    const sync = (): Promise<void> => {
        chain = chain
            .then(reconcile)
            .catch((err) => o.log("bar update failed", err));
        return chain;
    };

    const clearNotice = (): void => {
        if (noticeTimer !== null) clearTimeout(noticeTimer);
        noticeTimer = null;
        notice = null;
    };

    return {
        async subscribe() {
            for (const c of choices) {
                await issue({
                    type: "subscription:dom:element-clicked",
                    ...stamp(),
                    req: { domElementId: barButtonId(driverId, c.key) },
                });
            }
        },
        keyOf(id) {
            return (
                choices.find((c) => barButtonId(driverId, c.key) === id)?.key ??
                null
            );
        },
        show(active) {
            wanted = { active: [...active], transient: false };
            return sync();
        },
        notice(next, ms = NOTICE_MS) {
            clearNotice();
            notice = next;
            if (!wanted) wanted = { active: [], transient: true };
            noticeTimer = setTimeout(() => {
                noticeTimer = null;
                notice = null;
                if (wanted?.transient) wanted = null;
                void sync();
            }, ms);
            return sync();
        },
        hold(next) {
            if (held?.key === next.key && held.text === next.text) {
                return chain;
            }
            held = next;
            return wanted ? sync() : Promise.resolve();
        },
        release(key) {
            if (held?.key !== key) return chain;
            held = null;
            return wanted ? sync() : Promise.resolve();
        },
        resize(size) {
            windowSize = size;
            if (!created) return Promise.resolve();
            chain = chain
                .then(async () => {
                    if (!created) return;
                    await issue({
                        type: "command:dom:move-floating-element",
                        ...stamp(),
                        req: { domId, position: position() },
                    });
                })
                .catch((err) => o.log("bar move failed", err));
            return chain;
        },
        restyle(next) {
            styling = next;
            return wanted ? sync() : Promise.resolve();
        },
        hide() {
            clearNotice();
            held = null;
            wanted = null;
            return sync();
        },
        get shown() {
            return wanted !== null;
        },
    };
}
