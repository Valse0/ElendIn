# CURRENT_STATE.md — version 0.2.0-beta.1 (2026-11-08)

This file separates **what was actually verified** from **what was only written**.

## Verified (run in the environment)
| Area | How it was verified | Result |
|---|---|---|
| Engine, scoring, parsers, matcher, dates, clichés, inspectors | `npm test` → `tests/engine.test.ts` (including Professional & Amateur CV regressions, distinction tests) | 40/40 pass |
| i18n: identical keys/placeholders in TR/EN/ES, every finding type rendered in all languages | `tests/i18n.test.ts` | pass |
| PDF extraction with the **real pdf.js 6.2.108** on synthetic PDFs (single/two-column, interleaved, multi-page, Turkish, blank, image-only, encrypted, corrupt, empty, not-a-PDF) | `tests/pdf.test.ts` | pass |
| zod schemas (zod 4 API) | `tests/schemas.test.ts` | pass |
| PDF report composition (wrapping, page breaks, no PII) against a fake document | `tests/pdfReport.test.ts` | pass |
| UI string keys exist, version files agree, manifest/icons exist, SW rules, brand CSS rules, share-card privacy | `tests/meta.test.ts` | pass |
| Full TypeScript typechecking across `src/` and `tests/` | `tsc --noEmit` | no errors |
| Full Vite production build with code splitting, Web Worker, and font assets | `vite build` | built cleanly (435 modules) |
| App dev server | Vite dev server | running cleanly on port 3000 |

Total: **79 Node tests, all passing** (`npm test`). Production build verified.

## Not verified (written, but never run here)
- `npm install`, `npm run build` (`tsc --noEmit && vite build`) and `npm run dev` — the Vite pipeline itself. The esbuild
  bundle used for the browser run differs from Vite (fonts, asset hashing, worker bundling, `?url` imports).
- Type-check against the real `@types/react`, `@types/react-dom`, jsPDF and `vite/client` typings.
- **Real jsPDF output.** The browser run used a recording stand-in; the composer logic is tested, but the actual PDF file
  (fonts embedded, glyphs for ğ ş ı İ, layout) has not been opened by anyone. Check it visually.
- Real fonts (Anton / Inter / JetBrains Mono via `@fontsource`): the browser run used fallback fonts, so the display
  typography and the exact look were not reviewed with the final fonts.
- Service worker behaviour (registration, offline start, cache updates) — logic reviewed only; `serviceWorkers` were blocked in the test run.
- PWA installability, Lighthouse scores.
- Capacitor, `npx cap add android`, Gradle, signing, and both GitHub Actions workflows (YAML syntax was parsed; nothing was executed).
- Behaviour inside the Android WebView, including file picking and downloads.
- Real-world CVs: only synthetic documents were used. Heuristics (section detection, column detection, skill lexicon,
  cliché lists) need tuning on real material, especially Turkish and Spanish.

## Known limitations / deviations from the master prompt
- **fuse.js is not used.** Fuzzy matching is implemented in `src/lib/matching/matcher.ts` (edit distance + token
  equivalence). The dependency was left out on purpose instead of listing an unused package.
- **Inspectors:** HR Reviewer, Manager Murat, Security Officer and The Benchmarker are designed/registered but **not
  implemented** (shown as "COMING SOON"). Only ATS and Copy-Paste are active.
- **Android downloads:** PNG/PDF export uses a normal browser download (`<a download>` + blob). Android WebViews usually
  do not handle that; the web/PWA build does. A Capacitor Filesystem/Share plugin is needed for the APK — not done.
- **Android launcher icon** is Capacitor's default; the generated PWA icons are not copied into the native project
  (`@capacitor/assets` would do that).
- **No `package-lock.json`** (cannot be generated offline). Run `npm install` once and commit the lockfile; the
  workflows use `npm ci` when it exists and `npm install` otherwise.
- Only text-based PDFs are supported (no OCR). Scanned CVs get a clear message instead of a guess.
- Skill lexicon and cliché dictionaries are curated by hand and incomplete; unknown skills are not detected.
- `src/i18n/*` may contain a few unused keys left from earlier UI iterations (harmless).
- The potential score is a simulation based on the engine's own fix-ability weights, not a measured probability.

## Next steps (suggested order)
1. `npm install && npm test && npm run build && npm run dev` on a machine with network; fix anything Vite/React typings flag; commit `package-lock.json`.
2. Generate a PDF report and a PNG card in the real build; review fonts and layout in all three languages.
3. Push to GitHub, run **CI**, then run **Android APK** (workflow_dispatch) and install the debug APK on a phone; add a Capacitor download/share plugin.
4. Try 10+ real CVs (TR/EN/ES); tune lexicon, section headings and cliché lists; add fixtures for each fix.
5. Implement the remaining inspectors one at a time (see `AGENTS.md`).
