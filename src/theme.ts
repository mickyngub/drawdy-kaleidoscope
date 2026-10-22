import type { ModuleStyling } from "@drawdy/driver-protocol";

// Live Drawdy sends --dd-* tokens beside the flat keys, but @drawdy/driver-protocol 1.3.0 does not type them.
type Styling = ModuleStyling & { tokens?: Partial<Record<string, string>> };

export const themeColour = (
    styling: ModuleStyling,
    token: string,
    fallback: keyof ModuleStyling
): string => (styling as Styling).tokens?.[token] || styling[fallback];
