# Native Branch Workflow

This page applies to the `rn` branch and its `animal-island-ui-rn` manifest. The other
development pages retain upstream DOM/Vite/Vitest guidance; they do not change the
native runtime, command set or execution authorization.

## Runtime And Source Authority

- The host supplies React, React Native and react-native-svg peers. IsleMind currently
  links React 19.2.3, RN 0.86.3 and SVG 15.15.4; this is not the fork's standalone dev stack.
- Derive native refs/events from the installed component/TextInputProps declarations.
  Do not assume a newer standalone RN alias exists in the linked host.
- Use StyleSheet/native props and shared `src/icons/` artwork. Retained Less/demo sources
  describe the upstream skin, not a native CSS pipeline.
- dayjs is this manifest's date dependency. Use instance-local locale selection; the
  TypeScript build leaves dayjs external rather than bundling an isolated date runtime.
- Keep source exports, both TypeScript include lists and Jest testMatch aligned. Tests
  and demos are excluded from built JS/declarations.

## Commands

```sh
npm run typecheck
npm run lint
npm run test -- --runInBand --watch=false
npm run build
node scripts/check-docs-sync.mjs
npm run format:check
```

`npm run ci` chains format:check, lint, typecheck, test and build. The retained
documentation checker is separate; there is no `check:docs` npm script in this manifest.
No native Web axe/Vitest pipeline or demo/deploy script is supplied.
Use the installed tools; do not replace runtimes or install unrelated upgrades to get a
gate to pass. Keep failed attempts and distinguish lint warnings from a clean warning-free run.
Format only files touched for the change; do not reformat retained upstream history.

## Consumer Integration

Metro/browser export conditions consume `src/index.ts` and `src/theme/index.ts`.
Node/Jest consume `dist/index.js`; rebuild before host tests, and bind the resulting
artifact hashes to the source-tested revision. A passing source test with stale dist is
not consumer acceptance.

Local workspace sources may be dirty and unpublished. Default CI/EAS provisioning must
still require the saved full SHA and a clean checkout. Do not advance a remote pin to HEAD
and claim that it contains uncommitted adaptations. Necessary workspace lock reconciliation
does not authorize upgrades, package scripts or network/provider/device execution.

The October 26, 2026 checkpoint saves the current native adaptations in a local commit
for exact host-source verification. No push or publication is performed in that checkpoint.
A matching local pin does not prove that a fresh remote CI/EAS clone can fetch the commit.

### Offline Lock Verification Boundary

The linked dayjs runtime is 1.11.23, and IsleMind's text lock retains the native
dependency maps plus the existing npm lock's exact version and integrity. That
source contract is not an install receipt. On October 23, 2026, Bun 1.4.2's
offline/frozen/lockfile-only check still failed for an uncached dayjs manifest.
A disposable full-host control passes with only the library's `prepare` hook
removed; retaining the hook reproduces the workspace update and re-resolution,
even with `--ignore-scripts`. No hook is executed in either control.

Keep the real `prepare` hook and failed receipts; deleting lifecycle behavior,
fabricating registry cache data or replacing an offline check with `--prefer-offline`
does not close this gate. A separately bounded metadata-cache fix must be validated
against the unchanged real workspace. Do not install a second React/RN runtime or
advance the unpublished fork's remote pin to bypass the failure.

## Documentation And Verification Scope

Update English/Chinese routing, native API references and native visual differences
together. Start with [RN-PORT.md](../../RN-PORT.md) and
[native-host.md](../../skills/animal-island-ui-style/references/components/native-host.md).
Skill references stay self-contained and at most 200 lines per components file.
Do not regenerate retained Web coverage badges from native Jest counts.

Use awaited render/fireEvent/act for React 19/RNTL 14 tests. Keep controlled writeback,
disabled state, late callback/cancellation and reduced-motion regressions. An isolated
renderer, substituted Dimensions, Web adapter or in-memory store does not prove physical
focus, keyboard, scrolling, shadows, gestures or installed persistence.
Current rendered Web and independently authorized device/provider checks are separate gates.

The manifest remains private with CC-BY-NC-4.0 while the retained LICENSE is MIT.
This discrepancy is unresolved; these steps are not distribution or release approval.
