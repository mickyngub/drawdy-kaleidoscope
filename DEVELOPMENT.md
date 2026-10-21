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

`scene:elements-added` does not say who added an element, so `src/lib/stroke-watch.ts` treats a stroke as the local user's only when it is a single freedraw, untagged by this extension, not seen before, and ends where the local pointer was within the last 300 ms. `src/lib/stroke-watch.ts`, `src/bar.ts` and `test/fake-host.ts` are shared with Fancy Brushes; keep them free of Kaleidoscope specifics.
