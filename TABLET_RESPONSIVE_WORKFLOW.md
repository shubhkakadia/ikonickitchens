# Tablet Responsive Workflow (One File at a Time)

Use this workflow for all tablet responsiveness fixes.

## Target Devices and Breakpoints

- Tablet landscape only: `1024 x 768`
- Tailwind breakpoint to use: `md` (`min-width: 768px`)

## Rule of Execution

- Only change one UI file at a time.
- After each file change, test before touching the next file.
- Do not batch edits across multiple pages/components.

## Per-File Cycle

1. Pick exactly one file and define the tablet issue in one sentence.
2. Apply responsive fixes only in that file.
3. Run and check in browser at:
   - `1024 x 768` (landscape)
   - Desktop (to ensure no regression)
4. Verify:
   - No horizontal scroll.
   - Text is readable without overlap/cutoff.
   - Buttons/inputs are accessible and not clipped.
   - Grids/cards align correctly.
   - Images/media keep proper aspect and do not overflow.
5. If passed, mark the file as complete and move to next file.
6. If failed, keep editing the same file until it passes.

## Preferred Fix Patterns (Tailwind)

- Layout:
  - `grid-cols-1 md:grid-cols-2`
  - `flex-col md:flex-row`
  - `w-full md:w-auto`
- Spacing:
  - Reduce large desktop spacing on tablet (example: `px-8 md:px-10 lg:px-16` only if needed)
- Typography:
  - Use stepped sizes (`text-base md:text-lg lg:text-xl`)
- Media:
  - Use responsive widths/heights and `object-cover` / `object-contain` appropriately
- Overflow safety:
  - Avoid fixed widths that break at tablet
  - Prefer `max-w-*`, `min-w-0`, `overflow-x-auto` (only where necessary)

## Change Log Template

For each file, append an entry:

```md
### File: src/path/to/file.jsx
- Issue:
- Changes made:
- Tablet landscape (1024x768): Pass/Fail
- Desktop regression check: Pass/Fail
- Notes:
```

## Definition of Done (Per File)

- File works on `1024x768`.
- Desktop behavior remains correct.
- No new visual regressions introduced.
- File entry added to the change log.
