# Self-hosted fonts

Loaded in [`src/app/layout.jsx`](../app/layout.jsx) with `next/font/local`, so nothing is fetched
from Google at build or run time.

| File                    | Family     | Axis / weights | Subset | Licence |
| ----------------------- | ---------- | -------------- | ------ | ------- |
| `Archivo-latin.woff2`   | Archivo    | wght 300–600   | latin  | SIL OFL |
| `Geist-latin.woff2`     | Geist      | wght 100–900   | latin  | SIL OFL |
| `GeistMono-latin.woff2` | Geist Mono | wght 100–900   | latin  | SIL OFL |

Source: the Google Fonts CSS API (`fonts.googleapis.com/css2`), which serves these as files on
`fonts.gstatic.com`. Archivo was requested as `Archivo:wght@300..600`, Geist and Geist Mono as
`wght@100..900`.

`next/font/local` has no `unicode-range` support, so only the `latin` subset is included.
Characters outside it (Latin Extended, Vietnamese, Cyrillic) render in the Arial fallback.
