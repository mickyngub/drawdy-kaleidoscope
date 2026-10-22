import type {
    DomElementSchema,
    DriverCommandIssuer,
    ModuleStyling,
} from "@drawdy/driver-protocol";

export type BarChoice = {
    key: string;
    label: string;
    icon?: (colour: string) => string;
};

export type BarNotice = { key: string; text: string };

export type BarLook = { driverId: string; styling: ModuleStyling };

// Bottom centre keeps clear of Drawdy's toolbar and its tooltips at the top and of its corner controls.
export const BAR_BOTTOM_GAP = 24;
export const NOTICE_MS = 3000;

const PADDING = 4;
const BORDER = 1;
const GAP = 4;
const BUTTON = 32;
const ICON = 16;
const ICON_TOP = (BUTTON - ICON) / 2;
const UNDERLINE_GAP = 3;
const UNDERLINE_WIDTH = 14;
const UNDERLINE_HEIGHT = 2;
const RADIUS = 8;
const DIVIDER_HEIGHT = 20;
const NOTICE_HEIGHT = 16;
const LABEL_CHAR_PX = 7.5;
const LABEL_PADDING = 16;

export const barId = (driverId: string): string => `${driverId}:bar`;

export const barButtonId = (driverId: string, key: string): string =>
    `${driverId}:bar:${key}`;

export const barNoticeId = (driverId: string, key: string): string =>
    `${driverId}:bar:notice:${key}`;

const buttonWidth = (c: BarChoice): number =>
    c.icon
        ? BUTTON
        : Math.max(
              BUTTON,
              Math.round(LABEL_PADDING + c.label.length * LABEL_CHAR_PX)
          );

// A floating element is placed by its top-left corner, so the bar's size is fixed here rather than measured.
export const barWidth = (groups: readonly (readonly BarChoice[])[]): number => {
    const buttons = groups.flat();
    const dividers = Math.max(0, groups.length - 1);
    const items = buttons.length + dividers;
    return (
        2 * (PADDING + BORDER) +
        buttons.reduce((sum, c) => sum + buttonWidth(c), 0) +
        dividers +
        GAP * Math.max(0, items - 1)
    );
};

export const barHeight = (withNotice: boolean): number =>
    2 * (PADDING + BORDER) + BUTTON + (withNotice ? GAP + NOTICE_HEIGHT : 0);

// Tools mark the active one the way Drawdy's own toolbar does, a soft fill and
// an underline, so they read apart from the lime settings beside them.
function toolButton(
    look: BarLook,
    c: BarChoice,
    icon: (colour: string) => string,
    on: boolean
): DomElementSchema {
    const { styling } = look;
    return {
        type: "button",
        domId: barButtonId(look.driverId, c.key),
        styles: {
            width: [BUTTON, "px"],
            height: [BUTTON, "px"],
            borderRadius: [RADIUS, "px"],
            backgroundColor: on ? styling.surface2 : "transparent",
            cursor: "pointer",
            hover: { backgroundColor: styling.surface2 },
        },
        children: [
            {
                type: "column",
                styles: {
                    width: [BUTTON, "px"],
                    height: [BUTTON, "px"],
                    crossAxisAlignment: "center",
                    pointerEvents: "none",
                },
                children: [
                    { type: "box", styles: { height: [ICON_TOP, "px"] } },
                    {
                        type: "image",
                        child: icon(styling.foreground),
                        styles: {
                            width: [ICON, "px"],
                            height: [ICON, "px"],
                        },
                    },
                    { type: "box", styles: { height: [UNDERLINE_GAP, "px"] } },
                    {
                        type: "box",
                        styles: {
                            width: [UNDERLINE_WIDTH, "px"],
                            height: [UNDERLINE_HEIGHT, "px"],
                            borderRadius: [UNDERLINE_HEIGHT / 2, "px"],
                            backgroundColor: on
                                ? styling.primary
                                : "transparent",
                        },
                    },
                ],
            },
        ],
    };
}

function button(look: BarLook, c: BarChoice, on: boolean): DomElementSchema {
    if (c.icon) return toolButton(look, c, c.icon, on);
    const { styling } = look;
    return {
        type: "button",
        domId: barButtonId(look.driverId, c.key),
        styles: {
            width: [buttonWidth(c), "px"],
            height: [BUTTON, "px"],
            borderRadius: [RADIUS, "px"],
            backgroundColor: on ? styling.primary : "transparent",
            cursor: "pointer",
            ...(on ? {} : { hover: { backgroundColor: styling.surface2 } }),
        },
        children: [
            {
                type: "text",
                child: c.label,
                styles: {
                    color: on ? styling.primaryForeground : styling.foreground,
                    fontSize: [13, "px"],
                    fontWeight: "medium",
                    textAlign: "center",
                },
            },
        ],
    };
}

export function barSchema(
    look: BarLook,
    groups: readonly (readonly BarChoice[])[],
    active: readonly string[],
    notice?: BarNotice
): DomElementSchema {
    const { driverId, styling } = look;
    const width = barWidth(groups);
    const items: DomElementSchema[] = [];
    groups.forEach((group, i) => {
        if (i > 0) {
            items.push({
                type: "box",
                styles: {
                    width: [1, "px"],
                    height: [DIVIDER_HEIGHT, "px"],
                    backgroundColor: styling.border,
                },
            });
        }
        for (const c of group) {
            items.push(button(look, c, active.includes(c.key)));
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
                color: styling.foreground,
                fontSize: [12, "px"],
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
            backgroundColor: styling.surface,
            borderColor: styling.border,
            borderWidth: [BORDER, "px"],
            borderRadius: [RADIUS + PADDING, "px"],
            pointerEvents: "auto",
            crossAxisAlignment: "center",
        },
    };
}

export type Bar = {
    subscribe(): Promise<void>;
    keyOf(domElementId: string): string | null;
    show(active: readonly string[]): Promise<void>;
    notice(notice: BarNotice): Promise<void>;
    hold(notice: BarNotice): Promise<void>;
    release(key: string): Promise<void>;
    resize(size: { width: number; height: number }): Promise<void>;
    restyle(styling: ModuleStyling): Promise<void>;
    hide(): Promise<void>;
    readonly shown: boolean;
};

// notice() shows for NOTICE_MS; hold() stays until release(). A notice raised
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
    const choices = groups.flat();
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
        notice(next) {
            clearNotice();
            notice = next;
            if (!wanted) wanted = { active: [], transient: true };
            noticeTimer = setTimeout(() => {
                noticeTimer = null;
                notice = null;
                if (wanted?.transient) wanted = null;
                void sync();
            }, NOTICE_MS);
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
