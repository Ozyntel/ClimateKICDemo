# Ozyntel design system — foundation

This directory holds the brand-level design tokens that drive the new
Ozyntel digital-twin look (coral / teal / sand / ink palette, Newsreader
serif + Manrope sans + JetBrains Mono).

The foundation is installed **additively** — nothing visually changes on
existing screens until a screen is explicitly opted in by wrapping its
root container in `.oz-canvas` or `.oz-sand`. That keeps in-flight pages
from breaking while screen redesigns land one at a time.

## What's where

| File / path | Purpose |
|---|---|
| `ozyntel-design.css` | Raw colour / type / spacing / radii tokens on `:root`, the two opt-in theme scopes (`.oz-canvas`, `.oz-sand`), and the `.oz-*` typography helper classes. |
| `../index.css` | Imports `ozyntel-design.css` after the Tailwind base, and extends the Tailwind `@theme` block so every Ozyntel colour is also reachable as a utility (`bg-coral`, `text-ink-paper`, `border-sand-line`, etc.). |
| `../../index.html` | Loads the three webfonts from Google Fonts. |
| `../../public/brand/` | Brand assets — `orbit-o-mark.svg`, `orbit-o-mark-teal.svg`, `lockup-horizontal-dark.svg`, `lockup-horizontal-light.svg`, `lockup-stacked-dark.svg`, `wordmark-ozy-short.svg`, `marble-hero.png`, `marble-divider.png`, `marble-light.png`. |

## Using it in a screen redesign

```tsx
// 1. Wrap the root of the redesigned screen in one of the surface scopes.
//    .oz-canvas → dark studio (Twin, hero panels, modals over dark).
//    .oz-sand   → paper working surface (Artefacts, Pathways, Finish).
<main className="oz-canvas min-h-screen">
  {/* 2. Use the typography helpers for editorial copy. */}
  <p className="oz-mono oz-coral">Step 03 · Digital Twin · Live</p>
  <h1 className="oz-h1">
    Your organisation, <span className="oz-italic-emphasis oz-coral">made visible</span>
  </h1>
  <p className="oz-lede">A small editorial sub-headline in Newsreader italic.</p>

  {/* 3. For chrome — buttons, borders, fills — reach for the Tailwind
       utilities, which now include the Ozyntel palette. */}
  <button className="bg-coral text-ink-deep font-semibold px-4 py-2 rounded">
    Run stress-test
  </button>

  {/* 4. For precise overrides, use raw tokens via inline style or arbitrary values. */}
  <div className="border border-[var(--sand-line)] bg-[var(--sand-100)]" />
</main>
```

## Token reference (the most-used ones)

### Surfaces

- `--ink-deep` `#0B100F` — primary dark canvas
- `--ink-warm` `#15191A` — cards on dark
- `--ink-line` `#2A2F30` — hairlines on dark
- `--sand-200` `#E7DFCF` — default paper
- `--sand-100` `#F4EFE6` — paper card
- `--sand-line` `#C8BFAE` — hairlines on sand

### Text

- `--ink-paper` `#ECECE6` — headings on dark
- `--ink-soft` `#C8C5BE` — body on dark
- `--sand-ink` `#1A1714` — body on sand

### Accents (used sparingly — one point of energy per screen)

- `--coral` `#E89A82` — primary signal on canvas
- `--terracotta` `#9C4A45` — primary on sand
- `--copper` `#C97A5A` — tertiary, use rarely

### Teal scale (sampled from the marble texture)

- `--teal-deep` `#1E5C58`
- `--teal-mid` `#4A8580`
- `--teal-soft` `#93B4AF`

### Categorical (for systems-map node chips)

- `--tag-blue` (People / Org), `--tag-pink` (Market / External),
  `--tag-mint` (Supply), `--tag-sand` (Process), `--tag-mauve` (Capital)

## Typography helpers

| Class | Use for |
|---|---|
| `.oz-display` | Hero numerals and very large editorial heads |
| `.oz-h1` `.oz-h2` `.oz-h3` `.oz-h4` | Editorial section heads (h1–h3 serif, h4 sans) |
| `.oz-body` | Default body copy |
| `.oz-lede` | Italic Newsreader sub-headline that sits under a serif title |
| `.oz-caption` | Small captions / helper text |
| `.oz-mono` `.oz-mono-sm` | Uppercase mono labels, breadcrumbs, IDs |
| `.oz-italic-emphasis` | Inline italic emphasis inside a serif head |
| `.oz-coral` `.oz-terracotta` `.oz-soft` `.oz-quiet` | Inline colour utilities |

## Adding to this foundation

If a future redesign needs a new design token, add the raw value to
`ozyntel-design.css` first (at the right semantic section). If the token
should also be available as a Tailwind utility, add a matching entry to
the `@theme inline` block in `../index.css`. Keep raw tokens uniquely
prefixed (e.g. `--ink-*`, `--sand-*`, `--coral`) so they cannot collide
with the existing shadcn theme variables.
