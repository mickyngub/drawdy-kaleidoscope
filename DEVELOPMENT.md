# Developing Kaleidoscope

```bash
npm install
npm test
npm run typecheck
npm run dev          # dev server on :5195; in Drawdy run ⌘K → "Add extension dev server" on a local board
npm run build        # builds dist/main.js and dist/*.drawdyx
npm run preflight    # before submitting: committed, built, pushed, under Drawdy's limits, above the live version
```

Drawdy builds published versions from this repository's `src/index.ts`. Bump `driverVersion` in `manifest.json` for every release and add it to `CHANGELOG.md`. `npm test` holds the manifest and listing files to Drawdy's submission rules (a description of at most 500 characters, an icon of at most 256 KB, only `@drawdy/driver-protocol` imported from outside the repository).

`scene:elements-added` does not say who added an element, so `src/lib/stroke-watch.ts` decides. A pencil stroke counts when it is a single freedraw, untagged by this extension, not seen before, and ends where the local pointer was within the last 300 ms. Lines and arrows both report `type: "path"` with no `componentType`, so a path counts when Drawdy selects it locally within 400 ms of the add (the Line and Arrow tools do that on commit), and the last drawing tool seen in the past 2 s, asked for as each pointer burst starts and every 200 ms while it moves, says which of the two it is. `src/lib/lines.ts` sends copies as `[from, to, ...bend]`, the order Drawdy stores.
