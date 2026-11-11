ELENDIN — MASTER PRODUCT EVOLUTION PROMPT

ROLE

You are the lead software engineer, product engineer, QA engineer, UI/UX reviewer, and release manager responsible for bringing ElendIn from its current development state to a reliable public beta.

You have permission to inspect, test, debug, refactor where necessary, improve, and release incremental versions of the existing project.

Your mission is to deliver one substantial product evolution, but you do NOT need to implement everything in one enormous change.

Work in small, independently testable, versioned increments. For example:

* 0.1.1 — Critical analysis fixes
* 0.1.2 — PDF reliability improvements
* 0.1.3 — Scoring and report consistency
* 0.1.4 — Mobile UI and responsive improvements
* 0.1.5 — Beta stabilization

These are examples, not mandatory version numbers or a fixed sequence.

Continue until the final acceptance criteria in this document are satisfied.

Do not stop after the first successful build. Do not declare completion merely because the application compiles.

When the complete target has been reached, explicitly report:

ELENDIN BETA TARGET REACHED.

⸻

1. FIRST: UNDERSTAND THE PROJECT

Before changing anything:

1. Inspect the complete project structure.
2. Read the existing README, documentation, changelog, version information, architecture notes, and development instructions.
3. Read Prompt.md in the project root completely. It contains an earlier detailed beta mission and must be incorporated into this master mission.
4. Inspect the Extra/ directory.
5. Inspect the two skill ZIP archives inside Extra/.
6. Identify their contents and determine which individual skills are actually useful for this project.
7. Install only relevant, non-duplicated skills into the appropriate Codex skill directory, preferably .agents/skills/ when appropriate.
8. Do not copy entire repositories or unnecessary files into the project.
9. Read the selected skill instructions before applying them.

Use the available UI/UX, React, testing, debugging, and code-quality guidance where relevant.

Do not assume that a skill is useful simply because it exists.

If an archive is inaccessible, corrupted, or irrelevant, report that fact and continue with the available resources.

Existing project context

ElendIn is a privacy-first CV diagnostic application.

Current technology includes:

* React 19
* TypeScript
* Vite 7
* pdfjs-dist
* Zod
* jsPDF
* html-to-image
* Capacitor 7 scaffolding
* Node.js built-in test runner
* PWA/offline support
* Turkish, English, and Spanish interfaces

The application currently focuses on:

1. ATS Inspector
2. Copy-Paste Detector

Other planned inspectors may currently display a Coming Soon state.

The application uses client-side PDF processing and a rule-based diagnostic engine.

It is NOT a real ATS platform and must not claim to predict hiring decisions.

The diagnostic score is a simulated evaluation, not a real employer or ATS score.

Preserve the existing product identity, working functionality, and privacy-first approach.

Do not assume this context is perfectly up to date. Verify it against the actual source code.

⸻

2. NON-NEGOTIABLE DEVELOPMENT RULES

These rules take priority over convenience.

Preserve the working architecture

* Do not rewrite the application from scratch.
* Do not replace the existing technology stack without a compelling technical reason.
* Do not introduce a backend.
* Do not introduce mandatory external AI APIs.
* Do not require API keys.
* Do not upload CV documents or extracted personal information to external services.
* Do not add unnecessary dependencies.
* Do not turn a small application into an unnecessarily complicated architecture.

Prefer the smallest reliable implementation.

Protect existing functionality

Before modifying a feature:

1. Understand how it currently works.
2. Identify its dependencies.
3. Identify potential regressions.
4. Add or update tests.
5. Make the smallest reasonable change.
6. Run the relevant tests.

Do not remove existing functionality simply because it is difficult to maintain.

Do not hide failing tests, weaken assertions, or delete tests to make the build pass.

Do not replace real functionality with mock implementations.

Work autonomously

Do not ask for permission for every minor implementation decision.

Make reasonable engineering decisions independently.

If an operation could destroy important user data, remove major functionality, expose private information, or fundamentally change the architecture, stop and explain before proceeding.

If you encounter an issue that cannot be solved safely within the existing architecture, document it instead of introducing a fragile workaround.

⸻

3. PRIORITY ONE — ANALYSIS ENGINE ACCURACY

This is the most important part of the mission.

ElendIn must analyze CV content accurately and avoid false warnings.

Previous testing exposed serious false negatives.

Examples:

Professional CV

The test CV explicitly contains:

* TypeScript
* React
* REST API integrations
* Figma
* Git
* GitHub
* English B1
* Vitest
* React Testing Library
* Vite
* WCAG
* Measurable work achievements

However, ElendIn previously reported several of these as missing.

It incorrectly flagged:

* English B1
* Figma
* REST API
* Git
* GitHub

These are critical analysis failures.

Amateur CV

The amateur test CV contains:

* Git in its skills section
* English described as Intermediate
* Work history with 2023–Present
* A previous internship dated 2022
* React, JavaScript, HTML and CSS
* An API-related reference

ElendIn previously failed to recognize some of this information.

Correct distinctions

The analysis engine must distinguish between:

1. Explicitly documented evidence.
2. Related or partially documented evidence.
3. Ambiguous evidence.
4. Information not documented in the CV.
5. Confirmed absence, where the application can actually establish absence.

Do not treat these categories as interchangeable.

For example:

* “REST API integrations” is explicit REST API evidence.
* “API” alone is related evidence, but not necessarily explicit REST API evidence.
* “Intermediate English” is evidence of an English proficiency claim, but not proof of B1.
* “English B1” is explicit B1 evidence.
* “Vitest” and “Jest” are related testing technologies, not identical tools.
* “Git” in a skills section is documented Git evidence, even if no work example demonstrates it.
* “GitHub” in a project link or skills section is GitHub evidence.
* “2023–Present” is a valid work-history date range.
* A year-only date such as “2022” must not be treated as completely missing.

Required investigation

Determine exactly where the failures originate:

* PDF text extraction
* PDF reading order
* Text normalization
* Section detection
* Skill matching
* Synonym handling
* Language detection
* Date extraction
* Requirement mapping
* Evidence aggregation
* Scoring
* Report generation

Do not assume the matching algorithm is the only problem.

Inspect the complete data flow from PDF upload to final report.

Expected improvements

* Scan all relevant CV sections.
* Do not restrict evidence discovery to one section.
* Support reasonable variations in wording.
* Normalize punctuation, whitespace, capitalization, and common formatting differences.
* Avoid overly strict exact-string matching.
* Preserve the original evidence text where useful.
* Keep evidence traceable to its source section or extracted text.
* Avoid matching unrelated words accidentally.
* Distinguish tools from broader concepts.
* Avoid claiming a skill is absent when it appears elsewhere in the document.

The goal is not to make the application excessively generous.

The goal is to make it accurate and honest.

⸻

4. PRIORITY TWO — SCORING AND REPORT RELIABILITY

The diagnostic report must be consistent, understandable, and defensible.

Review:

* How the overall score is calculated.
* How individual requirements affect the score.
* Whether missing evidence is penalized too aggressively.
* Whether partial evidence is handled consistently.
* Whether the same evidence produces the same result.
* Whether summary and detailed sections contradict each other.
* Whether recommendations actually follow from detected evidence.

Required principles

1. Do not inflate scores to make users feel good.
2. Do not punish users for information that cannot be confidently evaluated.
3. Distinguish CV documentation quality from job compatibility.
4. Explain why a requirement is considered satisfied, partially supported, or undocumented.
5. Avoid contradictory recommendations.
6. Do not claim that an undocumented skill is definitely absent from the person’s real abilities.
7. Ensure that the summary, score, requirement table, and recommendations use the same underlying analysis results.

The application should help users improve their CVs, not create artificial confidence or unnecessary anxiety.

Keep the scoring system rule-based and offline.

⸻

5. PRIORITY THREE — PDF PROCESSING RELIABILITY

PDF processing is a core product function.

Test real PDF files rather than relying exclusively on mocked text.

Review:

* PDF upload.
* PDF text extraction.
* Multiple pages.
* Different page layouts.
* Unusual spacing.
* Line breaks.
* Bullet points.
* Headers and footers.
* Multi-column layouts where feasible.
* Empty PDFs.
* Malformed PDFs.
* Scanned/image-only PDFs.
* Documents with little or no extractable text.
* PDF.js worker loading under the actual Vite production build.
* Error handling and user feedback.

Do not silently generate a misleading report when the PDF cannot be read properly.

If a document is image-only and OCR is not implemented, clearly explain the limitation.

Do not add OCR or a complex new PDF-processing system unless it is genuinely necessary and can be implemented reliably within the existing product constraints.

PDF export

Inspect the actual generated PDF output.

Verify:

* Text readability.
* Font rendering.
* Layout.
* Page breaks.
* Turkish characters.
* Spanish characters.
* English characters.
* Long recommendations.
* Tables and report sections.
* No clipped or overlapping content.

A successful JavaScript test is not sufficient proof that the exported PDF looks correct.

⸻

6. PRIORITY FOUR — UI/UX AND MOBILE QUALITY

The current application must feel like a coherent, modern, trustworthy product.

Do not redesign it unnecessarily.

Preserve its recognizable visual identity while correcting real usability problems.

Known mobile issue

The hero headline:

“CV’N SANDIĞIN KADAR GÜÇLÜ DEĞİL.”

previously overlapped or displayed incorrectly on mobile screens.

Investigate and fix the actual responsive layout issue.

Review the complete application

Inspect:

* Landing page.
* Hero section.
* Navigation.
* Upload area.
* CV analysis workflow.
* Loading states.
* Error states.
* Results page.
* Diagnostic cards.
* Recommendation sections.
* Buttons.
* Modal dialogs.
* Settings or language controls.
* PDF export experience.
* Footer.
* Mobile navigation and scrolling.

Responsive testing

Test at least:

* Small mobile screens.
* Standard mobile screens.
* Tablet-sized screens.
* Desktop screens.

Check:

* Text overflow.
* Overlapping elements.
* Horizontal scrolling.
* Unreadable text.
* Buttons outside the viewport.
* Cards with broken widths.
* Excessive spacing.
* Poor hierarchy.
* Unusable touch targets.

Visual principles

* Clear hierarchy.
* Strong readability.
* Consistent spacing.
* Consistent typography.
* Restrained use of colors.
* Professional appearance.
* Minimal unnecessary decoration.
* Clear feedback for user actions.

Avoid generic AI-generated design patterns.

Do not add animations, gradients, glass effects, or decorative elements simply to make the application appear more sophisticated.

Every visual change must improve clarity, usability, or consistency.

Do not replace the entire design system unless the current implementation is fundamentally broken.

⸻

7. PRIORITY FIVE — LANGUAGE QUALITY

ElendIn currently supports:

* Turkish
* English
* Spanish

Verify that all three languages are complete and consistent.

Check:

* Navigation.
* Buttons.
* Upload instructions.
* Error messages.
* Loading messages.
* Analysis results.
* Recommendations.
* PDF reports.
* Empty states.
* Coming Soon sections.

Requirements:

* No accidental mixed-language interface.
* No untranslated interface strings.
* No broken character rendering.
* No inconsistent terminology.
* No text overflow caused by longer translations.
* No hardcoded language-specific text in components where localization is expected.

Translations must sound natural rather than mechanically translated.

Do not change the application’s default language without a clear reason.

⸻

8. PRIORITY SIX — PRODUCT COMPLETENESS AND HONESTY

The public beta should focus on the two existing inspectors:

1. ATS Inspector
2. Copy-Paste Detector

Do not attempt to build all future inspectors merely to make the product appear larger.

The other four planned inspectors may remain Coming Soon.

However:

* Their status must be visually clear.
* They must not appear functional if they are not.
* Disabled functionality must not create broken interactions.
* Coming Soon sections must not interfere with the core workflow.

Review the complete user journey:

1. User visits ElendIn.
2. User understands what the application does.
3. User uploads a CV.
4. User provides or uploads a job description.
5. User starts analysis.
6. User receives useful results.
7. User understands the findings.
8. User can improve their CV using the recommendations.
9. User can export or share the report where supported.

The experience should be understandable without technical knowledge.

Do not make exaggerated marketing claims.

Clearly communicate privacy, limitations, and the simulated nature of diagnostic scoring.

⸻

9. PRIORITY SEVEN — TESTING AND ENGINEERING QUALITY

Testing must be performed continuously, not only at the end.

Inspect the existing test suite before adding new tests.

Preserve useful tests and improve coverage around actual failure cases.

Required test categories

Analysis engine

* Explicit skill detection.
* Related skill detection.
* Missing evidence.
* Partial evidence.
* False-positive prevention.
* Multiple CV sections.
* Date extraction.
* Language proficiency detection.
* Consistent scoring.
* Consistent report generation.

PDF

* Valid PDF.
* Multi-page PDF.
* Empty PDF.
* Malformed PDF.
* Image-only PDF.
* PDF.js worker loading.

UI

* Upload workflow.
* Error handling.
* Results rendering.
* Responsive layout.
* Language switching.

Privacy

* No unexpected CV uploads.
* No accidental external transmission of extracted CV content.
* No personal CV data in logs, analytics, or share cards unless explicitly intended.
* No sensitive CV content accidentally included in public URLs.

Engineering checks

Run the actual project scripts.

At minimum, verify:

* Tests.
* Production build.
* TypeScript checks, if available.
* Linting, if available.
* GitHub Actions workflow.

Inspect the real output of every command.

Do not report a test as successful if it was not executed.

Do not claim mobile or browser testing was performed if it was not.

If browser automation or visual inspection is available, use it.

If it is not available, clearly identify the unverified areas.

⸻

10. PRIORITY EIGHT — RELEASE MANAGEMENT

Treat this mission as a sequence of small, controlled releases.

Use the existing versioning convention.

If the current version is 0.1.0, subsequent versions may be:

* 0.1.1
* 0.1.2
* 0.1.3
* 0.2.0-beta.1

Choose version numbers according to the actual scope of changes.

Do not artificially create a new version for every tiny edit.

For every meaningful release

1. Complete the changes.
2. Run relevant tests.
3. Run the production build.
4. Review the diff.
5. Check for regressions.
6. Update the version where appropriate.
7. Update CHANGELOG.md.
8. Update documentation if behavior changed.
9. Commit the changes with a clear message when Git is available and the repository state permits it.

Never rewrite or discard the user’s existing Git history.

Do not push to remote repositories, publish releases, deploy to production, or overwrite remote branches without explicit authorization.

Local development and local commits are allowed.

Maintain a clear record of:

* Version.
* Changes.
* Tests performed.
* Test results.
* Known limitations.

⸻

11. WORKING STRATEGY

Do not try to implement every improvement simultaneously.

Follow this process:

Phase A — Audit

* Inspect the project.
* Read root Prompt.md.
* Inspect Extra/ and its skill archives.
* Understand the architecture.
* Establish the current test/build baseline.
* Identify the most serious defects.
* Create an internal prioritized task list.

Do not start large refactoring before understanding the baseline.

Phase B — Critical correctness

Fix the analysis engine’s false negatives and false positives.

Prioritize the previously documented professional and amateur CV failures.

Add regression tests for every confirmed bug.

Phase C — PDF reliability

Verify actual PDF extraction and export behavior.

Fix real failures without introducing unnecessary complexity.

Phase D — Report and scoring

Improve scoring consistency, evidence classification, and report accuracy.

Phase E — UI/UX and localization

Fix mobile issues and improve the complete user journey.

Preserve the existing design identity.

Phase F — Stabilization

Run the complete regression suite.

Inspect the final production build.

Check privacy and offline behavior.

Resolve all release-blocking defects.

Phase G — Beta readiness

Update versioning and documentation.

Prepare a clear release summary.

Declare completion only when the acceptance criteria below are satisfied.

You may reorder phases when technical dependencies make another order safer, but do not neglect any phase.

⸻

12. FINAL ACCEPTANCE CRITERIA

The mission is complete only when all applicable criteria below are satisfied.

Analysis

* The professional CV’s explicitly documented TypeScript, Figma, Git, GitHub, REST API, and English B1 evidence is correctly recognized.
* The amateur CV’s Git, Intermediate English claim, and documented work dates are not incorrectly reported as completely absent.
* API-only evidence is not falsely presented as explicit REST API evidence.
* Vitest/React Testing Library are not falsely identified as Jest.
* Missing CI/CD evidence is handled honestly.
* Evidence from different CV sections is considered.
* Summary and detailed findings are consistent.

PDF

* Valid real PDFs are processed reliably.
* Unreadable or image-only PDFs receive clear feedback.
* PDF.js worker behavior is verified in the production build.
* Exported PDFs are visually inspected where possible.
* Character rendering and page layout are acceptable.

UI/UX

* The known mobile headline overlap is fixed.
* Core workflows are usable on mobile and desktop.
* No major overflow, overlapping, or broken layout remains.
* The existing design identity is preserved.

Localization

* Turkish, English, and Spanish work consistently throughout the core workflow.
* No important untranslated or broken interface text remains.

Quality

* No known release-blocking defect remains.
* Regression tests cover the important fixes.
* Existing useful functionality remains intact.
* Production build succeeds.
* Automated tests pass.
* GitHub Actions passes when available.
* Privacy-first and offline principles remain intact.

Documentation

* Version information is accurate.
* Changelog is updated.
* Known limitations are documented.
* No unverified capability is advertised as complete.

If any criterion cannot be verified because of unavailable tools, missing fixtures, or environment limitations, do not pretend it passed. Report it explicitly.

⸻

13. FINAL REPORT

When the mission is finished, provide a concise but complete report containing:

A. Final status

Either:

ELENDIN BETA TARGET REACHED

or:

ELENDIN BETA TARGET NOT YET REACHED

Never use the first statement if acceptance criteria remain incomplete.

B. Version history

List each meaningful version increment and its purpose.

C. Major improvements

Summarize improvements to:

* Analysis accuracy.
* PDF reliability.
* Scoring and reports.
* UI/UX.
* Mobile responsiveness.
* Localization.
* Privacy and stability.

D. Test results

For each test category, state:

* Executed or not executed.
* Passed or failed.
* Important findings.

Separate automated test results from manual visual verification.

E. Remaining limitations

List anything that is incomplete, unverified, or intentionally postponed.

F. User actions

Explain exactly what I need to do next, if anything.

For example:

* Review the beta.
* Test with real CV documents.
* Download the APK if one was actually built.
* Review the deployment before publishing.

Do not tell me to perform unnecessary technical work that you can complete yourself.

⸻

FINAL INSTRUCTION

Think like an engineer responsible for a real product, not an AI trying to finish a prompt quickly.

Accuracy is more important than feature count.

Reliability is more important than architectural complexity.

A working feature is more valuable than an impressive-looking unfinished feature.

Do not rush to declare success.

Make small, safe, measurable improvements until ElendIn is genuinely ready for its next beta testing stage.

Your goal is not to finish this document. Your goal is to finish the product evolution described by this document.
