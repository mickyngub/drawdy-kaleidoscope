const svg = (attributes: string, paths: string): string =>
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" ${attributes}>${paths}</svg>`
    )}`;

// Lucide 1.61.0 (ISC): pencil, slash and move-up-right, drawn in the bar's own colour.
const lucide =
    (paths: string) =>
    (colour: string): string =>
        svg(
            `fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`,
            paths
        );

// Remix Icon 4.9.0 (Apache-2.0), Drawdy's own set: flip-horizontal, focus-3 and stop-circle.
const remix =
    (d: string) =>
    (colour: string): string =>
        svg(`fill="${colour}"`, `<path d="${d}"/>`);

export const PENCIL_ICON = lucide(
    '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>'
);

export const LINE_ICON = lucide('<path d="M22 2 2 22"/>');

export const ARROW_ICON = lucide(
    '<path d="M13 5H19V11"/><path d="M19 5L5 19"/>'
);

export const MIRROR_ICON = remix(
    "M11 2V22H13V2H11ZM2 6C2 4.89543 2.89543 4 4 4H7C8.10457 4 9 4.89543 9 6V18C9 19.1046 8.10457 20 7 20H4C2.89543 20 2 19.1046 2 18V6ZM20 6V18H17V6H20ZM17 4C15.8954 4 15 4.89543 15 6V18C15 19.1046 15.8954 20 17 20H20C21.1046 20 22 19.1046 22 18V6C22 4.89543 21.1046 4 20 4H17Z"
);

export const RECENTRE_ICON = remix(
    "M13 1L13.001 4.06201C16.6192 4.51365 19.4869 7.38163 19.9381 11L23 11V13L19.938 13.001C19.4864 16.6189 16.6189 19.4864 13.001 19.938L13 23H11L11 19.9381C7.38163 19.4869 4.51365 16.6192 4.06201 13.001L1 13V11L4.06189 11C4.51312 7.38129 7.38129 4.51312 11 4.06189L11 1H13ZM12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6ZM12 10C13.1046 10 14 10.8954 14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12C10 10.8954 10.8954 10 12 10Z"
);

export const STOP_ICON = remix(
    "M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM9 9H15V15H9V9Z"
);
