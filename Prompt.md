You are working on ElendIn, a privacy-first CV analysis application.

MISSION: Stabilize the existing app and prepare a beta release within approximately 1 hour.

Work autonomously. Inspect the code first, identify root causes, implement fixes, and run tests. Be token-efficient. Avoid lengthy explanations.

1. Critical analysis bugs — highest priority

Our independent testing found serious false negatives:

* Professional CV explicitly contains TypeScript, Figma, Git, GitHub, REST API integrations and English B1, but ElendIn incorrectly reports several of these as missing.
* Amateur CV contains Git in Skills and “Intermediate” English, but ElendIn reports no Git or English evidence.
* Amateur CV contains work dates (2023–Present and 2022), but the report suggests dates are missing.
* “API” should be recognized as partial evidence for REST API, not automatically treated as full proof.
* Vitest and React Testing Library should be recognized as related testing tools, but must not automatically be treated as exact Jest evidence.
* CI/CD is genuinely absent from both CVs.

Investigate PDF text extraction, section scanning, normalization, matching logic and report generation. Fix the actual root causes.

The analysis must distinguish:

1. Explicitly found evidence
2. Related or partial evidence
3. Not documented in the CV
4. Confirmed missing requirement

Do not claim a candidate lacks a skill merely because the exact keyword was not found. Search all relevant CV sections, including experience, projects, skills and education.

2. Scoring and report reliability

* Make scoring consistent and explainable.
* Do not inflate potential scores.
* Do not penalize undocumented evidence as if it proves lack of competence.
* Make findings consistent between the summary and detailed tables.
* Distinguish CV documentation quality from job requirement match.
* Preserve the existing rule-based, offline architecture.

3. PDF reliability

* Verify PDF extraction with real PDF files if test fixtures are available.
* Handle missing, malformed or empty PDF text gracefully.
* Ensure the PDF worker and extraction process work in the actual Vite build.
* Do not silently produce misleading reports when extraction fails.

4. Mobile UI and beta quality

* Fix the mobile hero headline overlap.
* Check responsive layouts, report readability and buttons.
* Check TR/EN/ES language consistency.
* Remove obvious unfinished or broken UI behavior.
* Keep the existing visual identity and working features.

5. Beta scope

* Stabilize the two existing inspectors: ATS Inspector and Copy-Paste Detector.
* Do not invent or falsely activate the four unfinished inspectors.
* Keep unfinished features clearly marked as coming soon.
* Do not add a backend, AI API, API keys or unnecessary dependencies.
* Do not perform a large architectural rewrite.
* Preserve privacy-first and offline behavior.

6. Verification and release

Run the existing test suite and production build. Add focused regression tests for every fixed bug.

If possible, test actual PDF inputs and verify that the professional CV no longer receives false missing-evidence flags.

Update the version to an appropriate beta version (for example, 0.2.0-beta.1), update relevant documentation and changelog, and ensure the GitHub Actions workflow passes.

Rules

* Prioritize correctness over adding features.
* Do not delete working functionality.
* Do not hide failing tests or weaken assertions to make tests pass.
* Do not claim something was verified if it was not.
* If time is limited, fix critical analysis bugs first, then mobile issues and beta packaging.
* Stop when the time budget is exhausted and report unfinished work honestly.

Final response: Give me a concise report of changes, tests passed/failed, remaining risks and exact steps to publish the beta. Do not waste tokens describing routine operations.
