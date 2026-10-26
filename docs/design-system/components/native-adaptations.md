# Native Adaptations - Visual Differences

This page describes the native implementation, not the retained DOM/Less tables.
Runtime/API boundaries are in [RN-PORT.md](../../../RN-PORT.md); native props live in
the [host API references](../../../skills/animal-island-ui-style/references/components/native-host.md).
Dimensions here are native logical units, not CSS lengths.

## Shared Skin And Artwork

The linked upstream snapshot supplies the warm-peach/palette corrections, dot geometry,
Input cream surface, Button text height, Countdown overflow and BackTop bottom/right
offsets. Native `src/icons/` uses verified naive-icons 1.6.0 paths/colors through the
existing SVG base. The MIT artwork notice remains with the base; no second DOM icon
runtime is introduced. Decorative SVG nodes are hidden from accessibility.
The shared SVG root retains `aria-hidden` on every platform, but omits the
native-only `accessible` boolean on Web to avoid forwarding it as a DOM attribute.

Light defaults remain package-owned. Dark surfaces and brand/role colors are native
additions, not an upstream dark theme. Host accent replaces primary only. Provider-aware
new components are Avatar, Badge, Calendar, CountUp, Rate and Upload; Form's inherited
neutral-gray styling is not automatically recolored.

## Button

Button preserves its single-line, fixed-height default. The native `multiline` opt-in
wraps the full label with centered text and 8-unit vertical padding; the selected size
becomes a minimum height. The host must constrain width and wrap narrow action rows.
Colors, pill shape, pressed/loading faces and reduced-motion policy are unchanged.

## Input

The default text face has `minWidth: 0`, so browser intrinsic input widths do not
push fixed affixes or the clear action outside narrow rows. Explicit `inputStyle`
and `inputProps.style` keep their precedence.
The clear glyph uses the theme text foreground rather than the placeholder color.
Its font, line height, 20-unit button and 12-unit hitSlop are unchanged. Controlled
writeback, callback order, native events, refs and multiline sizing remain intact.
This does not establish physical font-scale, focus or keyboard acceptance.

## Avatar And Badge

Avatar uses 32/40/48 preset circles or 8-radius squares with the actual User artwork
fallback. Native text fitting replaces DOM measurement; group overlap is 8 by default.
Badge keeps 16/20 count heights and 10-unit dots, switching wider/CJK counts to a capsule.
Screen-reader labels retain full counts rather than the visual overflow suffix.

## Calendar

Six weeks and two event lanes are preserved. Native event colors map to theme brand
colors rather than exact upstream event CSS. Header/week/action labels remain built-in
Chinese; this is not a locale prop. A minimum 44-unit day target makes narrow grids
scroll horizontally; font scale increases number/event bands instead of clipping text.
Custom event nodes sit outside Text. Long-press responder range creation and the preview
are native adaptations, not the upstream mouse choreography.

## CountUp And Rate

CountUp keeps native two-ring/four-sparkle artwork and optional sticker. Its flat sticker
fill and scale sequence approximate the Web gradient/rotation choreography. Reduced
motion removes these decorations without changing count/completion semantics.
Rate uses actual upstream Star artwork; the visual small/middle/large sizes are
20/26/34 with targets at least 44 units. Unfilled stars use reduced opacity. Hover preview
is Web-only; native selection is a press. Reduced motion suppresses burst/timing.

## Select And Drawer

Select retains upstream pill/options skin and explicit clear artwork. Native search is
inside the Modal, with scrollable options and measured/fallback viewport constraints.
Keyboard-reduced layout feeds those bounds. Drawer uses provider dark surfaces,
viewport-clamped horizontal width, KeyboardAvoidingView and a scrollable body/footer.
Reduced motion mounts/unmounts immediately. Drawer background push and Web focus trap
are not implemented; a dialog does not flatten interactive native descendants.

## Progress, Background And Loading

Progress now has the upstream 2-unit outline, one 14-unit grid of 1.5-radius dots,
mint SVG gradient and completion brightening. Scene artwork spans the full track;
fillColor overrides both gradient and scene. Indeterminate retains a static partial
fill and does not announce a fabricated numeric percentage.
Background/Card pattern geometry and revised palette match the retained upstream skin.
Loading preserves its 50-flake scene as visible static artwork under reduced motion.

## Upload And Form

Upload has the upstream trigger/list/action artwork through shared native icons, but
drag is a visual skin only. The host supplies file selection/permissions/URIs.
No picker disables selection; missing action/customRequest is error, never fake done.
Native thumbnails are host-owned URIs, not automatically generated/revoked ObjectURLs.
Form's error feedback uses actual Close artwork; scrollToField remains host-owned/no-op.

## Verification Limits

Source/renderer arithmetic, mocked transports and substituted large fonts do not prove
rendered Web/native pixel equality, gestures, focus, keyboard or scroll behavior.
Current rendered Web and independently authorized installed-device checks remain separate.
Fonts must be supplied by the host through native text styles; ThemeProvider exposes
mode/accent/reducedMotion, not a font-injection API. The private manifest's licensing
discrepancy remains unresolved and is not distribution approval.
