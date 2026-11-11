# AGENTS.md — rules for AI assistants and contributors

ElendIn is a **client-side CV diagnostics tool**. Read `README.md` for the product and `CURRENT_STATE.md` for what is
verified. Do not claim something works unless you ran it.

## Non-negotiable product rules
1. **Everything stays in the browser.** No backend, database, accounts, analytics, AI/LLM API or remote fonts/scripts.
   The CSP in `index.html` enforces this; do not loosen it. The service worker must stay shell-only.
2. **Never invent facts or statistics.** No "X% of recruiters…". Before/After text is a template with `[placeholders]`
   the user fills with real details.
3. **Honest wording.** Never say the CV "was rejected" or promise outcomes. The stamp means "weaknesses found". The
   potential score is a *simulation* and only counts what the user can fix by editing the CV.
4. **Employment gaps are neutral** (context, no score impact, no judgement).
5. **CRITICAL severity needs a written justification** (`justificationKey`); `makeFinding` throws without one.
6. **No double counting** in the score: findings share `dedupGroup`s; the costliest counts.
7. **Share card privacy:** score, critical count, cliché density, number of requirements without evidence — nothing
   else (no file name, job title, CV text). `tests/meta.test.ts` guards this.

## Architecture
- `src/engine/` pure TypeScript, no DOM, deterministic. Entry: `analyze(cv, jobText, {now})`. It returns finding *ids,
  i18n keys and params* — never display text. All configuration (weights, thresholds, limits) lives in
  `src/engine/config.ts`.
- `src/engine/inspectors/` one file per inspector, registered in `index.ts` (`ACTIVE_INSPECTORS` /
  `PLANNED_INSPECTORS`). To activate a planned inspector: implement it, move it to the active list, add its finding
  keys to the three catalogues, add fixtures and tests.
- `src/lib/pdf/` extraction (pdf.js is injected through `PdfJsLike` so tests can use the real library in Node).
- `src/lib/export/` PDF report composer (`PdfDocLike` interface → testable with a fake) and jsPDF adapter.
- `src/i18n/` `en.ts` is the reference catalogue; `tr.ts`/`es.ts` are typed `Record<MessageKey,string>` and must have
  exactly the same keys and `{placeholders}` (tests enforce it). Use `findingText()` to resolve finding text.
- `src/app`, `src/components`, `src/pages` React UI. State lives in memory only (`App.tsx`).
- Brand: charcoal `#21232E`, marshmallow `#F0F0F0`, blue `#105BFF`, **red `#FF2D2D` only** for the logo dot, the stamp and
  critical warnings. 0 px radius, 2 px borders, no gradients, no shadows (checked by `tests/meta.test.ts`).

## Working rules
- Run `npm test` before and after changes. Tests use Node's built-in type stripping: use explicit `.ts` import
  extensions and avoid TS-only runtime syntax (enums, parameter properties).
- New UI strings: add to all three catalogues; static `t('key')` and dynamic key families are checked by the meta test.
- Add a fixture + test for every new finding type; `tests/i18n.test.ts` requires every finding id to be exercised.
- Update `CHANGELOG.md`, `CURRENT_STATE.md` and `VERSION` (+ `package.json`, `src/app/version.ts`) for releases.
- Do not commit keystores or `.env` files. Signing material only via GitHub secrets.
