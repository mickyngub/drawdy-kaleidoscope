import type {
    DomElementSchema,
    DriverCommandIssuer,
    ModuleStyling,
} from "@drawdy/driver-protocol";

export type BarChoice = { key: string; label: string };

export type BarNotice = { key: string; text: string };

export type BarLook = { driverId: string; styling: ModuleStyling };

// Clears Drawdy's main toolbar, which spans about y 12 to 50 px.
export const BAR_Y = 64;
export const NOTICE_MS = 3000;

const PADDING = 6;
const BORDER = 1;
const GAP = 4;
const BUTTON_HEIGHT = 28;
const MIN_BUTTON = 32;
const LABEL_CHAR_PX = 7.5;
const LABEL_PADDING = 20;

export const barId = (driverId: string): string => `${driverId}:bar`;

export const barButtonId = (driverId: string, key: string): string =>
    `${driverId}:bar:${key}`;

export const barNoticeId = (driverId: string, key: string): string =>
    `${driverId}:bar:notice:${key}`;

const buttonWidth = (label: string): number =>
    Math.max(
        MIN_BUTTON,
        Math.round(LABEL_PADDING + label.length * LABEL_CHAR_PX)
    );

// The bar is centred from its own width because a floating element is placed by its top-left corner.
export const barWidth = (choices: readonly BarChoice[]): number =>
    2 * (PADDING + BORDER) +
    choices.reduce((sum, c) => sum + buttonWidth(c.label), 0) +
    GAP * Math.max(0, choices.length - 1);

export function barSchema(
    look: BarLook,
    choices: readonly BarChoice[],
    active: readonly string[],
    notice?: BarNotice
): DomElementSchema {
    const { driverId, styling } = look;
    const width = barWidth(choices);
    const buttons: DomElementSchema[] = choices.map((c) => {
        const on = active.includes(c.key);
        return {
            type: "button",
            domId: barButtonId(driverId, c.key),
            styles: {
                width: [buttonWidth(c.label), "px"],
                height: [BUTTON_HEIGHT, "px"],
                borderRadius: [6, "px"],
                backgroundColor: on ? styling.primary : "transparent",
                cursor: "pointer",
                ...(on ? {} : { hover: { backgroundColor: styling.surface2 } }),
            },
            children: [
                {
                    type: "text",
                    child: c.label,
                    styles: {
                        color: on
                            ? styling.primaryForeground
                            : styling.foreground,
                        fontSize: [13, "px"],
                        fontWeight: "medium",
                        textAlign: "center",
                    },
                },
            ],
        };
    });
    const children: DomElementSchema[] = [
        {
            type: "row",
            children: buttons,
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
            padding: [PADDING, "px"],
            gap: GAP,
            backgroundColor: styling.surface,
            borderColor: styling.border,
            borderWidth: [BORDER, "px"],
            borderRadius: [10, "px"],
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
    resize(windowWidth: number): Promise<void>;
    restyle(styling: ModuleStyling): Promise<void>;
    hide(): Promise<void>;
    readonly shown: boolean;
};

// A notice raised while the bar is hidden shows the bar on its own and takes it away with the notice.
export function createBar(o: {
    issue: DriverCommandIssuer;
    driverId: string;
    choices: readonly BarChoice[];
    styling: ModuleStyling;
    requestId: () => string;
    log: (message: string, err: unknown) => void;
}): Bar {
    const { issue, driverId, choices } = o;
    const domId = barId(driverId);
    const stamp = () => ({ driverId, requestId: o.requestId() });
    let styling = o.styling;
    let wanted: { active: readonly string[]; transient: boolean } | null = null;
    let notice: BarNotice | null = null;
    let noticeTimer: ReturnType<typeof setTimeout> | null = null;
    let windowWidth: number | null = null;
    let created = false;
    let chain: Promise<void> = Promise.resolve();

    const position = () => ({
        x: Math.max(
            0,
            Math.round(((windowWidth ?? 0) - barWidth(choices)) / 2)
        ),
        y: BAR_Y,
    });

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
        if (windowWidth === null) {
            const size = await issue({
                type: "command:dom:window-size",
                ...stamp(),
            });
            windowWidth = size.res.value?.width ?? 0;
        }
        if (!wanted) return;
        const schema = barSchema(
            { driverId, styling },
            choices,
            wanted.active,
            notice ?? undefined
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
        resize(width) {
            windowWidth = width;
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
            wanted = null;
            return sync();
        },
        get shown() {
            return wanted !== null;
        },
    };
}
