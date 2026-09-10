# DESIGN.md — Ikonic Kitchens Design System

> **Scope**: Visual and interaction rules for the admin dashboard and the public site.
> **Status**: These rules are derived from the dominant patterns already in the codebase.
> Where the codebase disagrees with itself, this document picks the winner and marks the
> loser as **deprecated**. New code follows this document; old code migrates opportunistically.

**Rule of thumb**: If you are about to invent a value (a font size, a radius, a padding, a
colour), stop and pick the nearest one from this document instead.

---

## Table of Contents

1. [Foundations](#1-foundations)
2. [Typography](#2-typography)
3. [Spacing](#3-spacing)
4. [Corner Radius](#4-corner-radius)
5. [Colour](#5-colour)
6. [Elevation & Borders](#6-elevation--borders)
7. [Motion](#7-motion)
8. [Layering (z-index)](#8-layering-z-index)
9. [Component Specs](#9-component-specs)
10. [Iconography](#10-iconography)
11. [Feedback & Messaging](#11-feedback--messaging)
12. [Dark Mode](#12-dark-mode)
13. [Accessibility Rules](#13-accessibility-rules)
14. [Known Debt](#14-known-debt)

---

## 1. Foundations

| Concern      | Decision                                                                 |
| ------------ | ------------------------------------------------------------------------ |
| Styling      | Tailwind CSS v4 utility classes in JSX. No CSS modules for new work.      |
| Theme source | `src/app/globals.css` — the `@theme inline` block and the `:root` block.  |
| Base unit    | **4px**. Every spacing, size and radius value is a multiple of 4 (or 2).  |
| Density      | The admin is a **dense data application**. Default to compact, not roomy. |
| Breakpoints  | Tailwind defaults: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536.  |

Do **not** add new CSS to `globals.css` unless it is a token or a genuinely global
primitive. That file is already 2,900+ lines and most of it is per-page overrides.

> ⚠️ **Adding a theme token: keep namespaces grouped.** Inside the `@theme inline` block,
> a `--color-*` declaration placed *after* the `--font-*` declarations is silently ignored —
> the utility is never generated and the class resolves to nothing, with no build error.
> Add new colours alongside the existing `--color-*` entries, fonts alongside `--font-*`.
> After adding one, confirm the utility actually exists before relying on it:
>
> ```bash
> curl -s "$(curl -s http://localhost:3000/admin/login | grep -o '/_next/static/chunks/[^"]*\.css' | head -1 | sed 's|^|http://localhost:3000|')" | grep -c 'bg-your-token'
> ```

---

## 2. Typography

### 2.1 Font families

| Role                | Token                 | Family                     | Use for                                     |
| ------------------- | --------------------- | -------------------------- | ------------------------------------------- |
| **Primary (all UI)**| `var(--font-archivo)` | Archivo                    | Everything — admin, public site, headings, body |
| Monospace           | `font-mono`           | Geist Mono                 | IDs, codes, SKUs, timestamps, numeric tables |

- Archivo is loaded in [layout.jsx](src/app/layout.jsx) via `next/font/google` and is the
  de-facto family across the app. It is the **only** UI typeface.
- **Deprecated**: Montserrat and Source Sans Pro. They are `@import`ed at the top of
  `globals.css` and exposed as `--font-montserrat` / `--font-source-sans`, but nothing
  uses them. Do not use them; delete the import when convenient.
- **Deprecated**: `font-geist` / Geist Sans for UI text. Keep Geist Mono only.

**Applying the font**: it should be inherited from `<body>`. Do **not** copy the
`font-family: var(--font-archivo), Arial, sans-serif;` declaration into new CSS rules —
that line already appears ~30 times in `globals.css` and is pure duplication.

### 2.2 Type scale

Use only these steps. `text-sm` is the **default body size** for the admin — not `text-base`.

| Class       | Size      | Line height | Use for                                                    |
| ----------- | --------- | ----------- | ---------------------------------------------------------- |
| `text-xs`   | 12px      | 16px        | Table headers, badges, helper text, timestamps, metadata    |
| `text-sm`   | 14px      | 20px        | **Default.** Body copy, labels, inputs, buttons, table cells |
| `text-base` | 16px      | 24px        | Public-site body copy only                                  |
| `text-lg`   | 18px      | 28px        | Card titles, modal titles, section headings                 |
| `text-xl`   | 20px      | 28px        | Page titles (admin)                                         |
| `text-2xl`  | 24px      | 32px        | Major page titles, dashboard stat numbers                   |
| `text-3xl`  | 30px      | 36px        | Public-site section headings                                |
| `text-4xl`+ | 36px+     | —           | Public-site hero headlines only. Never in the admin.        |

Avoid arbitrary sizes (`text-[10px]`, `text-[13px]`). If something must be smaller than
`text-xs`, it is probably not important enough to show.

### 2.3 Font weights

Archivo is loaded with weights **300, 400, 500, 600** only.

| Class           | Weight | Use for                                              |
| --------------- | ------ | ---------------------------------------------------- |
| `font-normal`   | 400    | Body copy, table cell values                          |
| `font-medium`   | 500    | **Default for UI chrome** — labels, buttons, nav, badges |
| `font-semibold` | 600    | Card titles, modal titles, emphasised values          |
| `font-bold`     | 700    | ⚠️ Not loaded — see below                            |

> ⚠️ **`font-bold` is synthesised.** 700 is not in the Archivo weight list, so the browser
> fakes it. It renders inconsistently across platforms. **Use `font-semibold` for headings
> instead.** If real 700 is wanted, add `"700"` to the `weight` array in
> [layout.jsx](src/app/layout.jsx:17) — do that once, globally, rather than working around it.

`font-light` (300) is reserved for large public-site display text. Never below `text-lg`.

### 2.4 Heading conventions (admin)

```jsx
// Page title
<h1 className="text-xl font-semibold text-slate-800">Purchase Orders</h1>

// Section / card title
<h2 className="text-lg font-semibold text-slate-800">Line Items</h2>

// Sub-section
<h3 className="text-sm font-semibold text-slate-700">Delivery</h3>

// Field label
<label className="text-sm font-medium text-slate-700">Supplier</label>

// Helper / hint
<p className="text-xs text-slate-500">Leave blank to use the default.</p>
```

### 2.5 Text colour hierarchy

Neutral text is always **slate**, never `gray`/`zinc`/`neutral`.

| Class             | Use for                                       |
| ----------------- | --------------------------------------------- |
| `text-slate-900`  | Highest-emphasis headings (sparingly)          |
| `text-slate-800`  | Page and card titles                           |
| `text-slate-700`  | **Default body text**, labels                  |
| `text-slate-600`  | Secondary text, table headers                  |
| `text-slate-500`  | Tertiary text, hints, placeholders             |
| `text-slate-400`  | Disabled text, empty-state text, muted icons   |

---

## 3. Spacing

Base unit **4px**. Approved steps only:

| Class step | px  | Typical use                                          |
| ---------- | --- | ---------------------------------------------------- |
| `0.5`      | 2   | Micro-nudges inside badges                            |
| `1`        | 4   | Icon-to-text in tight chips                           |
| `1.5`      | 6   | Icon button padding                                   |
| `2`        | 8   | **Default gap.** Icon-to-text, inline control groups  |
| `2.5`      | 10  | Badge/pill horizontal padding only                    |
| `3`        | 12  | Compact padding, gaps between related fields          |
| `4`        | 16  | **Default padding.** Card padding, form field spacing |
| `6`        | 24  | Roomy card padding, gaps between sections             |
| `8`        | 32  | Section separation                                    |
| `12`       | 48  | Public-site section separation                        |

Avoid `3.5`, `5`, `7`, `9`, `10`, `11` and arbitrary values like `p-[13px]`.

### 3.1 Standard spacing recipes

| Context                        | Classes                          |
| ------------------------------ | -------------------------------- |
| Button padding (default)       | `px-4 py-2`                       |
| Button padding (compact)       | `px-3 py-1.5`                     |
| Input padding                  | `px-4 py-3` (form) / `px-3 py-2` (inline/filter) |
| Card padding                   | `p-4` (dense) / `p-6` (roomy)     |
| Modal body padding             | `p-6`                             |
| Table cell padding             | `px-4 py-2` (header) / `px-4 py-3` (row) |
| Icon-to-label gap              | `gap-2`                           |
| Between form fields            | `space-y-4`                       |
| Between form sections          | `space-y-6`                       |
| Between toolbar controls       | `gap-3`                           |
| Label to input                 | `mb-1.5`                          |
| Heading to content             | `mb-4`                            |

---

## 4. Corner Radius

> ⚠️ **Read this — the radius scale in this project is not Tailwind's default.**
> The `@theme inline` block in [globals.css](src/app/globals.css:79) redefines
> `--radius-sm/md/lg/xl` from `--radius: 0.625rem` (10px). The `rounded-*` classes
> therefore resolve to different values than stock Tailwind.

| Class          | Actual value  | Use for                                                          |
| -------------- | ------------- | ---------------------------------------------------------------- |
| `rounded`      | 4px           | Micro-elements only (colour swatches, tiny tags). Avoid.          |
| `rounded-sm`   | **6px**       | Inline chips, tight nested elements                               |
| `rounded-md`   | **8px**       | Compact/secondary buttons, dropdown items, small controls         |
| `rounded-lg`   | **10px**      | **DEFAULT.** Buttons, inputs, cards, panels, dropdown menus       |
| `rounded-xl`   | **14px**      | Modals, hero cards, large surfaces                                |
| `rounded-2xl`  | 16px          | Public-site feature cards only                                    |
| `rounded-full` | pill          | Badges, status pills, avatars, toggles, circular icon buttons     |

### 4.1 The rule

- **Buttons: `rounded-lg`.** Every button — primary, secondary, destructive, icon-only.
  The only exception is a status/count pill, which is `rounded-full`.
- **Inputs, selects, textareas: `rounded-lg`.** Must match buttons so they align in a row.
- **Cards and panels: `rounded-lg`.**
- **Modals: `rounded-xl`.**
- **Badges and pills: `rounded-full`.**

Never mix radii on adjacent controls in the same row. When elements are joined into a
segmented control, use directional variants (`rounded-l-lg`, `rounded-r-lg`) and leave the
inner corners square.

To change the radius of the whole application, edit `--radius` in `:root` — not individual
components.

---

## 5. Colour

### 5.1 Brand tokens

| Token                | Value     | Name       | Use for                                       |
| -------------------- | --------- | ---------- | --------------------------------------------- |
| `primary`            | `#000080` | Navy       | Primary actions, focus rings, active nav, links |
| `secondary`          | `#b82f34` | Ikonic Red | Brand accents, public-site CTAs, highlights     |
| `tertiary`           | `#f4f5f6` | Off-white  | Subtle page/section backgrounds                 |

Use them as `bg-primary`, `text-primary`, `border-primary`, `focus:ring-primary`, and with
opacity as `bg-primary/10`, `hover:bg-primary/90`.

> ⚠️ **Never hardcode brand hex values in JSX.** `#b92f34` is hardcoded 61 times and is
> *one digit off* the actual `secondary` token `#b82f34`. Always use the token.

### 5.2 Neutrals

**Slate is the only neutral ramp.** Do not introduce `gray-*`, `zinc-*` or `neutral-*`.

| Class            | Use for                                            |
| ---------------- | -------------------------------------------------- |
| `bg-white`       | Cards, modals, table surfaces, inputs               |
| `bg-slate-50`    | Page background, table header rows, read-only inputs |
| `bg-slate-100`   | Hover states, inactive tabs, subtle fills           |
| `bg-slate-200`   | Dividers-as-fills, disabled toggles                 |
| `border-slate-200` | **Default border** on cards and panels            |
| `border-slate-300` | **Default border** on inputs and outlined buttons |

### 5.3 Semantic colours

Use the `-50/-100` background + `-800` text + `-200` border formula for badges and banners.

| Meaning              | Background       | Text             | Border             |
| -------------------- | ---------------- | ---------------- | ------------------ |
| Success / Done       | `bg-green-100`   | `text-green-800` | `border-green-200` |
| Info / In progress   | `bg-blue-100`    | `text-blue-800`  | `border-blue-200`  |
| Warning / Pending    | `bg-amber-100`   | `text-amber-800` | `border-amber-200` |
| Error / Destructive  | `bg-red-100`     | `text-red-800`   | `border-red-200`   |
| Neutral / Not started| `bg-slate-100`   | `text-slate-800` | `border-slate-200` |

Solid destructive actions use `bg-red-600 hover:bg-red-700 text-white`.

### 5.4 Status → colour mapping

Keep these consistent everywhere a status is rendered:

| Enum value                              | Colour  |
| --------------------------------------- | ------- |
| `DONE`, `COMPLETED`, `FULLY_RECEIVED`, `FULLY_ORDERED` | green   |
| `IN_PROGRESS`, `ACTIVE`, `ORDERED`, `PARTIALLY_RECEIVED`, `PARTIALLY_ORDERED` | blue |
| `DRAFT`                                 | amber   |
| `CANCELLED`                             | red     |
| `NOT_STARTED`, `NA`, `CLOSED`           | slate   |

Never encode status by colour alone — always include the label text.

### 5.5 Extended categorical hues

The five semantic hues above cover *meaning*. A few places need to tell apart items
that carry no meaning — log action types, chart series. For those, and only those,
`violet` and `indigo` are also sanctioned, using the same `-100`/`-800` formula.

Never use violet or indigo to mean success, failure, warning or progress.

### 5.6 Chart and data-viz marks

Chart libraries (Chart.js, Recharts) take colour strings, not Tailwind classes, so series
colours live as **named constants** — never inline hex literals scattered through JSX.

| Constant     | Theme token       | Value     | Use for                                 |
| ------------ | ----------------- | --------- | --------------------------------------- |
| `SERIES_1`   | `bg-series-1`     | `#3d4fb5` | Primary/single-series bars and sparklines |
| `SERIES_2`   | `bg-series-2`     | `#b82f34` | Second series when two are compared      |

- A single-series magnitude bar is **one hue**; identity is carried by its text label.
- Bars use `rounded-r` (4px) on the growing end only. Sparkline bars use `rounded-t`.
- Bar tracks are `bg-slate-100`.
- `primary` (#000080) is too dark for fills — use it for progress bars only, never chart series.

---

## 6. Elevation & Borders

**This is a flat UI. Do not use shadows.**

`shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`, `shadow-xl` and `shadow-2xl` are all
banned, including on hover. Separation between surfaces is carried entirely by
**borders and background tone**.

| Surface                     | Treatment                                          |
| --------------------------- | -------------------------------------------------- |
| Page background             | `bg-slate-50`                                       |
| Card / panel                | `bg-white` + `border border-slate-200`              |
| Nested / inset block        | `bg-slate-50` + `border border-slate-200`           |
| Dropdown, popover, menu     | `bg-white` + `border border-slate-300`              |
| Modal panel                 | `bg-white` + `border border-slate-200` + `bg-black/50` backdrop |
| Divider                     | `border-t border-slate-200` / `divide-slate-200`    |

Rules:

- **Every floating layer needs an opaque background and a border.** Without a shadow, a
  `border-slate-300` (one step darker than a card's) is what separates a dropdown from the
  content behind it. Never render a menu or popover on a transparent or semi-transparent
  background.
- **Hover is a background or border change, never elevation.** Use `hover:bg-slate-50` for
  rows, `hover:border-primary/25` for clickable tiles.
- **Borders are 1px on surfaces.** No `border-2` on a card, panel, modal or row. When a
  surface needs to carry state, use its border *colour* — plus a text label, per §5.3.
  `border-2` is reserved for three things that are not surfaces:
  - a **cut-out ring** on overlapping elements (stacked avatars, a status dot on an icon),
    where `border-2 border-white` masks the shape from what it overlaps;
  - a **selection ring** on a picker item (a chosen thumbnail, a selected swatch);
  - a **dashed dropzone** (`border-2 border-dashed border-slate-300`), where the dashes are
    the affordance — and its hover state is a border-colour change, never a transform.
- **State is never a transform.** No `scale-*` or `translate-*` to mark something selected,
  hovered or active. Use background and border colour.
- **No `transform` on hover** (`hover:scale-*`, `hover:-translate-y-*`). Flat means flat.

The `.card-hover` helper in `globals.css` (`hover:-translate-y-2 hover:shadow-2xl`) is
**deprecated** and must not be used.

---

## 7. Motion

| Property         | Value                                       |
| ---------------- | ------------------------------------------- |
| Default duration | `duration-200`                              |
| Entrances/exits  | `duration-300`                              |
| Default property | `transition-colors` (cheapest, most common) |
| Easing           | Tailwind default (`ease-in-out`)            |

- Use `transition-colors` for hover/active states. Reach for `transition-all` only when
  more than one property genuinely animates — it currently appears 411 times and most of
  those should be `transition-colors`.
- `hover:scale-105` and similar transforms are for the **public site only**. The admin does
  not bounce.
- Never animate `width`/`height`/`top`/`left`. Use `transform` and `opacity`.
- Respect `prefers-reduced-motion` for anything decorative.

---

## 8. Layering (z-index)

Use only these steps:

| Class    | Layer                                                    |
| -------- | -------------------------------------------------------- |
| `z-10`   | Sticky table headers, in-flow overlays                    |
| `z-20`   | Sticky toolbars, floating action controls                 |
| `z-30`   | Sidebar, app chrome                                       |
| `z-40`   | Dropdowns and popovers anchored to chrome                 |
| `z-50`   | **Modals, dialogs, and their backdrops**                  |
| `z-[60]` | Toasts (must sit above modals)                            |

> ⚠️ `z-100` and `z-9999` exist in the codebase. Both are escape hatches for a stacking
> context bug, not a solution. Do not add more — fix the stacking context instead.

---

## 9. Component Specs

There is currently **no shared `<Button>` component**. Until one exists, copy these class
strings verbatim so the app stays consistent. Building the shared component is the single
highest-value cleanup available (see [Known Debt](#14-known-debt)).

### 9.1 Buttons

All buttons: `rounded-lg`, `text-sm font-medium`, `cursor-pointer`,
`transition-colors duration-200`, and `disabled:opacity-50 disabled:cursor-not-allowed`.

**Primary**
```jsx
<button className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
```

**Secondary / outlined**
```jsx
<button className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
```

**Ghost / tertiary**
```jsx
<button className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200">
```

**Destructive**
```jsx
<button className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
```

**Icon-only**
```jsx
<button className="cursor-pointer p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200" aria-label="Edit">
  <Pencil className="w-4 h-4" />
</button>
```

Rules:
- Every clickable `<button>` gets `cursor-pointer` — this codebase relies on it explicitly.
- Icon-only buttons **must** have `aria-label` or a `title`.
- Loading state: disable the button and swap the leading icon for a spinner. Do not change
  the button's width — reserve the label text.
- **Deprecated**: `bg-primary/80 hover:bg-primary`. Primary buttons are full-opacity at rest
  and darken on hover (`hover:bg-primary/90`), never the reverse.
- **Deprecated**: the `.btn-primary` / `.btn-secondary` `@apply` classes in `globals.css`.
  They use the hardcoded `#B92F34` and `hover:scale-105`. Public-site legacy only.

### 9.2 Inputs, selects, textareas

**Form field (default)**
```jsx
<label className="block text-sm font-medium text-slate-700 mb-1.5">Supplier</label>
<input
  className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
/>
```

**Inline / filter field (compact)**
```jsx
<input className="w-full text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
```

- Focus ring is **always** `focus:ring-2 focus:ring-primary focus:border-transparent`,
  paired with `focus:outline-none`. Never remove the outline without adding a ring.
- **Deprecated**: `focus:ring-secondary` on inputs. Focus is a `primary` affordance.
- Disabled/read-only: `bg-slate-50 text-slate-600 cursor-not-allowed`.
- Error state: `border-red-500 focus:ring-red-500`, with the message below as
  `text-xs text-red-600 mt-1`.
- Required fields: mark the label with `<span className="text-red-600">*</span>`.

### 9.3 Cards

```jsx
<div className="bg-white rounded-lg border border-slate-200 p-4">
```

Roomy variant uses `p-6`. Full-height list cards add `flex flex-col h-full overflow-hidden`.
No shadow — see §6.

### 9.4 Modals

```jsx
{/* Backdrop */}
<div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4">
  {/* Panel */}
  <div className="bg-white rounded-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col">
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
      <h2 className="text-lg font-semibold text-slate-800">Title</h2>
      <button className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg" aria-label="Close">
        <X className="w-5 h-5" />
      </button>
    </div>
    <div className="flex-1 overflow-y-auto p-6">{/* body */}</div>
    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
      {/* Cancel (secondary) then Confirm (primary) — primary always rightmost */}
    </div>
  </div>
</div>
```

Standard widths: `max-w-md` (confirm), `max-w-lg` (compact form — a handful of fields),
`max-w-2xl` (form), `max-w-4xl` (data), `max-w-6xl` (full editor). Always cap height at
`max-h-[90vh]` and scroll the body only.

Modals close on Escape and on backdrop click — except destructive confirmations, which
require an explicit button.

### 9.5 Tables

```jsx
<thead className="bg-slate-50">
  <tr>
    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
      Supplier
    </th>
  </tr>
</thead>
<tbody className="divide-y divide-slate-200">
  <tr className="hover:bg-slate-50 transition-colors">
    <td className="px-4 py-3 text-sm text-slate-700">…</td>
  </tr>
</tbody>
```

- Header: `text-xs font-medium text-slate-500 uppercase tracking-wider` on `bg-slate-50`.
- Rows: `text-sm text-slate-700`, hover `bg-slate-50`, separated by `divide-y divide-slate-200`.
- Numeric and currency columns are `text-right` and `font-mono`.
- Actions column is `text-right`, icon-only buttons, sticky if the table scrolls.
- Sticky headers use `sticky top-0 z-10 bg-slate-50`.
- Every table needs an empty state — centred, `py-12`, `text-sm text-slate-500`, with an icon.

### 9.6 Badges & status pills

```jsx
<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
  Done
</span>
```

Count badges on tabs/nav: `bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded-full`.

### 9.7 Toggles

```jsx
<div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-primary peer-focus:ring-4 peer-focus:ring-primary/20 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
```

Track `w-11 h-6`, knob `h-5 w-5`, on-state `bg-primary`.

### 9.8 Dropdowns / popovers

```jsx
<div className="absolute z-40 mt-1 w-64 bg-white border border-slate-300 rounded-lg max-h-60 overflow-auto">
  <button className="cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors">
```

Menu items are `rounded` only if the menu has padding; otherwise square with rounded
first/last children. Cap height at `max-h-60` / `max-h-96` and scroll.

---

## 10. Iconography

- **Library**: `lucide-react`. Do not mix in `react-icons` for new work.
- **Sizes**: `w-4 h-4` (default, inside buttons and table cells), `w-5 h-5` (headers,
  modal close, nav), `w-3 h-3` (inside badges). Nothing else.
- Icons inherit `currentColor` — never set an icon colour that differs from its label.
- Decorative icons get `aria-hidden="true"`. Meaningful icons need an accessible name.
- Icon and label are always `gap-2` apart.

---

## 11. Feedback & Messaging

**Toasts** (`react-toastify`) are the standard mechanism for the outcome of an action.

| Call             | Use for                                                      |
| ---------------- | ------------------------------------------------------------ |
| `toast.success`  | A write succeeded. Short: "Purchase order created."           |
| `toast.error`    | A write failed or a request errored. Say what to do next.     |
| `toast.warn`     | The action succeeded with a caveat.                           |
| `toast.info`     | Rare. Prefer inline text.                                     |

- Never toast on a successful read.
- Validation errors belong **inline on the field**, not in a toast.
- Loading: use the shared `<Loader>` for full-page/panel loads; use skeletons or an inline
  spinner for partial ones. Never leave a blank region with no indicator.
- Empty states: icon (`w-8 h-8 text-slate-300`), a `text-sm text-slate-600` line saying what
  is missing, and — where applicable — a primary button to create the first record.
- Destructive confirmations use the shared `<DeleteConfirmation>` component. Name the
  record being deleted in the prompt.

---

## 12. Dark Mode

Dark mode is **partially implemented** — `dark:` variants appear in roughly 228 places, but
the great majority of admin surfaces are light-only. The variant is class-based
(`@custom-variant dark (&:is(.dark *))`).

**Current rule for new work**: design light-first and correct. Add `dark:` variants only if
you are working inside a component tree that already has them, and then add them
consistently to *every* colour in that tree — a half-converted component is worse than an
unconverted one.

Pairings, when you do add them:

| Light                | Dark                        |
| -------------------- | --------------------------- |
| `bg-white`           | `dark:bg-slate-900`         |
| `bg-slate-50`        | `dark:bg-slate-900/50`      |
| `bg-slate-100`       | `dark:bg-slate-800`         |
| `border-slate-200`   | `dark:border-slate-700`     |
| `border-slate-300`   | `dark:border-slate-600`     |
| `text-slate-800`     | `dark:text-slate-100`       |
| `text-slate-700`     | `dark:text-slate-200`       |
| `text-slate-500`     | `dark:text-slate-400`       |

---

## 13. Accessibility Rules

Non-negotiable:

1. **Focus is always visible.** `focus:outline-none` is only permitted when immediately
   followed by `focus:ring-2`.
2. **Contrast**: body text ≥ 4.5:1, large text ≥ 3:1. `text-slate-400` is for disabled and
   decorative text only — never for content the user must read.
3. **Icon-only controls carry `aria-label`.**
4. **Colour is never the only signal.** Status pills carry text; error fields carry a message.
5. **Every input has a `<label>`** with a matching `htmlFor`/`id`. Placeholder ≠ label.
6. **Modals** trap focus, close on Escape, and restore focus to the trigger.
7. **Interactive elements are `<button>` or `<a>`** — not a `<div>` with `onClick`.
8. **Touch targets** are at least 32×32px in the dense admin; `p-1.5` on a `w-4 h-4` icon
   is the minimum acceptable icon-button size.

---

## 14. Known Debt

Tracked here so it is not re-litigated in every review. None of these block new work; all of
them should be fixed opportunistically.

| # | Issue                                                                                                | Fix                                                                          |
| - | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1 | **No shared `<Button>` component.** Button classes are copy-pasted hundreds of times with drift.       | Build `src/components/ui/Button.jsx` with `variant` and `size` props; migrate. |
| 2 | `font-bold` (700) is used 217 times but weight 700 is not loaded for Archivo — it is synthesised.       | Add `"700"` in [layout.jsx](src/app/layout.jsx:17) or migrate to `font-semibold`. |
| 3 | `#b92f34` hardcoded 61 times; the `secondary` token is `#b82f34`. Two near-identical reds ship today.  | Pick one, put it in the token, replace all hardcoded hex.                      |
| 4 | Montserrat and Source Sans Pro are downloaded on every page load and never used.                        | Delete the `@import` at the top of `globals.css`.                              |
| 5 | `font-family: var(--font-archivo)` is redeclared ~30 times in `globals.css`.                            | Declare once on `body`; delete the rest.                                      |
| 6 | Two primary-button styles coexist: `bg-primary` and `bg-primary/80 hover:bg-primary`.                   | Standardise on `bg-primary hover:bg-primary/90`.                              |
| 7 | Six different `<th>` class strings across admin tables.                                                 | Standardise on §9.5; extract a `<DataTable>` when the shared Button lands.     |
| 8 | `z-100` and `z-9999` escape hatches.                                                                    | Fix the underlying stacking contexts; use the §8 scale.                       |
| 9 | `transition-all` used 411 times where `transition-colors` would do.                                     | Replace as files are touched.                                                 |
| 10| Shadows are still on ~290 elements across the admin (pre-flat-UI code).                                | Strip `shadow-*` page by page; replace hover elevation with border/background changes. |
| 11| Dark mode is ~15% implemented.                                                                          | Decide: finish it or remove the `dark:` variants. Half-done is the worst state.|

---

## Quick Reference Card

```
FONT        Archivo everywhere · Geist Mono for codes/numbers
BODY        text-sm  (14px)  text-slate-700  font-normal
LABEL       text-sm  font-medium  text-slate-700
TITLE       text-lg  font-semibold text-slate-800   (page: text-xl)
META        text-xs  text-slate-500

RADIUS      buttons/inputs/cards = rounded-lg (10px)
            modals = rounded-xl (14px)   badges = rounded-full

SPACING     button px-4 py-2 · input px-4 py-3 · card p-4
            gap-2 inline · space-y-4 fields · space-y-6 sections

COLOUR      primary #000080 · secondary #b82f34 · neutrals = slate
            never hardcode a hex

BUTTON      px-4 py-2 text-sm font-medium rounded-lg cursor-pointer
            transition-colors duration-200
            disabled:opacity-50 disabled:cursor-not-allowed

FOCUS       focus:outline-none focus:ring-2 focus:ring-primary
            focus:border-transparent

SHADOW      none, anywhere — separation is borders + background tone
MOTION      duration-200 · transition-colors
ICONS       lucide-react · w-4 h-4 default · gap-2 from label
```

---

**Last Updated**: 2026-09-10
**Owner**: Frontend
**Related**: [CLAUDE.md](CLAUDE.md) · [ADMIN_REPEATING_CODE_ANALYSIS.md](ADMIN_REPEATING_CODE_ANALYSIS.md)
