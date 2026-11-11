# ElendIn

**CV diagnostics against one specific job listing — entirely in your browser.**
Upload a PDF CV, paste a job listing, get an investigative-style report of *potential* weaknesses: requirements without
clear evidence, unclear dates, generic wording, reading-order problems. No account, no backend, no AI API, no upload.

> ElendIn cannot know why an employer rejected an application and does not reproduce any real ATS. It reports
> potential problems based on your CV and the listing. The score is a simulated diagnostic, not a hiring probability.

**Status: version 0.1.0 — complete source, partly verified.** Read [`CURRENT_STATE.md`](CURRENT_STATE.md) for exactly what
was tested and what was not (the Vite production build and the Android build have not been run yet).

*Türkçe özet:* ElendIn, PDF CV'nizi bir iş ilanıyla karşılaştırır ve olası zayıflıkları (kanıtsız gereksinimler, belirsiz
tarihler, klişe ifadeler, okuma sırası sorunları) raporlar. Her şey tarayıcınızda çalışır; CV'niz hiçbir yere gönderilmez.
Arayüz Türkçe / İngilizce / İspanyolca. Doğrulananlar ve doğrulanmayanlar için `CURRENT_STATE.md` dosyasına bakın.

## Features
- **Local analysis**: PDF text extraction with pdf.js, rule-based engine in a Web Worker. Nothing leaves the device (CSP enforces `connect-src 'self'`).
- **Inspectors**: ATS Inspector and Copy-Paste Detector are active; HR Reviewer, Manager Murat, Security Officer and The Benchmarker are designed and registered but not implemented yet.
- **Findings** always show *Problem · Why it matters · Severity · How to fix · Before/After template*. Templates contain `[placeholders]`; ElendIn never invents your facts.
- **Explainable score**: severity points × intensity, per-dimension caps, no double counting, all numbers in `src/engine/config.ts`. The "potential score" only counts what editing the CV can fix.
- **Languages**: Turkish, English, Spanish (UI, findings, and independent cliché dictionaries).
- **Exports** (on request only): privacy-safe 1080×1350 PNG share card (score, critical count, cliché density, number of requirements without evidence) and a PDF report.
- **PWA** (manifest, icons, offline app shell) and **Android APK** via Capacitor + GitHub Actions.

## Tech stack
React 19 · TypeScript · Vite 7 · pdfjs-dist · zod · jsPDF · html-to-image · Capacitor 7. Tests run on Node's built-in test runner (Node ≥ 22.18, TypeScript is type-stripped, no extra test framework).

## Getting started
```bash
npm install          # first time: commit the generated package-lock.json
npm test             # 76 tests, no browser needed
npm run dev          # http://localhost:5173
npm run build        # tsc --noEmit && vite build → dist/
npm run preview
```
Regenerate the PWA icons (optional, needs Pillow): `npm run icons`. Regenerate the synthetic PDF test fixtures (optional, needs reportlab): `python3 scripts/make_test_pdfs.py`.

## Project layout
```
src/engine/        pure analysis engine (parsers, matcher use, severity, scoring, inspectors)
src/lib/pdf/       PDF → CvDocument (layout, columns, reading order)
src/lib/matching/  skill matcher (found / alias / related / fuzzy / missing)
src/lib/export/    PDF report composer + jsPDF adapter, download helpers
src/i18n/          en (reference) · tr · es catalogues + helpers
src/app/           App, i18n context, worker runner, analysis worker
src/components/    UI pieces (report/ has score card, findings, share card, export panel)
src/pages/         Landing, Analyze, Report
public/            manifest, service worker, icons
tests/             Node tests + fixtures (samples.ts, pdf/*.pdf)
.github/workflows/ ci.yml, android-apk.yml
```
Rules for contributors and AI assistants: [`AGENTS.md`](AGENTS.md). History: [`CHANGELOG.md`](CHANGELOG.md).

## How the score works (short)
Every finding has a severity (CRITICAL 18 · MEDIUM 8 · LOW 3 points) scaled by an intensity factor. Findings that describe the
same root cause share a dedup group and only the costliest counts. Each dimension (job match, structure, language, consistency)
has a cap. Score = 100 − counted points. CRITICAL findings must carry a written justification. Employment gaps are context only.
See `src/engine/config.ts` and `src/engine/scoringEngine.ts`; the report screen has a "How the score works" section.

## Android APK (Capacitor + GitHub Actions)
The `android/` project is **generated in CI** (`npx cap add android`) so it always matches the installed Capacitor version.
App id `app.elendin.cv`, name `ElendIn`, web assets from `dist/`, no remote server URL (works offline).

1. Push the repository to GitHub. Make sure `package-lock.json` is committed (the workflow falls back to `npm install` otherwise).
2. **Debug APK (no secrets needed):** Actions → *Android APK* → *Run workflow*. Download the `ElendIn-apk` artifact (`ElendIn-debug.apk`) and install it on a phone (allow installs from unknown sources).
3. **Signed release APK:** create your own keystore **locally** (never commit it):
   ```bash
   keytool -genkeypair -v -keystore elendin-release.keystore -alias elendin -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 elendin-release.keystore    # macOS: base64 -i elendin-release.keystore
   ```
   Add these repository secrets (Settings → Secrets and variables → Actions):

   | Secret | Value |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | the base64 text from the command above |
   | `ANDROID_KEYSTORE_PASSWORD` | keystore password |
   | `ANDROID_KEY_ALIAS` | `elendin` (or the alias you chose) |
   | `ANDROID_KEY_PASSWORD` | key password |

   With all four present the workflow also builds, `zipalign`s and `apksigner`-signs `ElendIn-release.apk` and verifies the signature. Keep a backup of the keystore: Play Store updates require the same key.
4. **Release:** push a tag such as `git tag v0.1.0 && git push --tags`; the APKs are attached to a GitHub Release.

Version name comes from `VERSION`; version code = the workflow run number.
**Not yet verified:** this workflow has never been executed, and file downloads (PNG/PDF export) inside the Android WebView will probably need a Capacitor Filesystem/Share plugin — see `CURRENT_STATE.md`.

## Privacy
- The CV is read with `File.arrayBuffer()` and parsed locally; the listing is only text in memory. No analytics, no cookies.
- Only the chosen interface language is remembered (`localStorage`, wrapped in try/catch). CVs, listings and results are never stored.
- The service worker only caches the static app files (same-origin GET).
- PDF report: contains short, PII-redacted evidence quotes from the CV; never the file name, e-mail, phone or links.

## Licences
Application code: yours to choose (no licence file included yet). Bundled fonts for the PDF report: DejaVu Sans subset, see `src/assets/fonts/LICENSE-DejaVu.txt`. UI fonts (Anton, Inter, JetBrains Mono) come from `@fontsource` packages (SIL OFL 1.1).
