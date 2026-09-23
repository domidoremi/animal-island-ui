# Decorative — pixel spec

> **RN fork:** Background substitutes dark provider canvas/dot colors for wallpaper while retaining pattern geometry and scene artwork. [RN contract](../../../RN-PORT.md). The remaining tables describe the upstream Web/light skin.

## Theme transition (RN host)

`ThemeTransitionProvider` provides a short, interruptible reveal for explicit appearance choices.
Supporting browsers reveal the new root snapshot with a 340ms circular clip from the press point;
native/older browsers expand an opaque destination-colored circle for 190ms, apply the host update
under cover, then fade the cover over 130ms. Only transform/opacity use the native animation driver.
Keyboard changes without a press point originate at the viewport center. Reduced motion applies
immediately; there is no spinner, invented progress or minimum loading delay. A 1200ms safety deadline
finishes stalled transitions. The overlay is decorative, does not take focus, and does not clone
the application tree. The host owns settings, persistence, error feedback and destination surface color.

Exact values for the scene-setting pieces that carry the island theme: Time, Phone, Footer and Wallet.

## Footer (copyright bar)

A copyright bar that renders `© {year} {text}` — the year is fetched dynamically (current year), and the text defaults to `All Rights Reserved.`.

```tsx
<Footer />                  // © 2026 All Rights Reserved.
<Footer text="Acme Ltd." /> // custom text
<Footer text="Acme" year={2020} />
```

```less
.footer {
    color: #807d75;
    font-size: 12px;
    padding: 16px 0;
    text-align: center;
}
```

- The `year` defaults to the current year (`new Date().getFullYear()`); pass `year` to override it. The `text` replaces `All Rights Reserved.`.
- Styling is fully overridable via `style` / `className`.
