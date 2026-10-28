> **Lưu trữ:** mô tả bản cũ, không còn đúng với code hiện tại. Xem [`architecture/feature-map.md`](../../architecture/feature-map.md).

# SETE-128 Full Feature Showcase — Final Gates & Product Review

- **Issue:** SETE-150 (SETE-128 TASK-07)
- **Date:** 2026-09-08
- **Branch:** `feature/sete-128-full-feature-showcase`
- **HEAD:** `fd91d11` (SETE-149 TASK-06 Integration hardening)
- **Base ref:** `main` at `caae7fb`
- **Release under test:** `full-feature-showcase` (non-default; `DEFAULT_RELEASE_NAME` remains `lingobites-mvp`)

## 1. Environment under test

| Item                  | Value                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Host                  | macOS 26.6.1 (darwin arm64)                                                                                            |
| Node / Yarn           | v26.4.0 / 1.22.22                                                                                                      |
| Xcode                 | 26.6 (17F113)                                                                                                          |
| CocoaPods             | Installed (Pods present under `ios/Pods`)                                                                              |
| Android SDK / Java    | **Not installed** — `/usr/bin/java` present but no JRE; `java -version` fails; `ANDROID_HOME`/`ANDROID_SDK_ROOT` unset |
| iOS simulator runtime | iPhone 17 family available (not booted for this run)                                                                   |

## 2. Scope

Final evidence-backed release decision package for the SETE-128 showcase preset after TASK-01…TASK-06. Out of scope: new feature implementation, store release, changing the production default preset, merging the consolidated PR.

## 3. Quality gates (AC-18)

Commands run from `mobile-app/` on 2026-09-08.

| Command                 | TASK-00 baseline (SETE-143)                                                                            | TASK-07 final                                                                                          | Delta                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `yarn typecheck`        | PASS                                                                                                   | **PASS**                                                                                               | unchanged                                       |
| `yarn lint`             | PASS — 0 errors, 340 warnings; module boundaries PASS                                                  | **PASS** — 0 errors, 348 warnings; module boundaries PASS                                              | +8 warnings (pre-existing budget; 0 new errors) |
| `yarn lint:content`     | PASS — 13/13 rules                                                                                     | **PASS** — 13/13 rules                                                                                 | unchanged                                       |
| `yarn test --runInBand` | 104 suites, 734 passed, **1 skipped**; exit 1 (post-test `VirtualizedList` / `act(...)` console noise) | **121 suites, 929 passed, 1 skipped**; exit 1 (same post-test console noise; **0 assertion failures**) | skipped count **unchanged at 1**                |

Skipped test (unchanged from baseline): `prevents deletion of lesson with saved flashcards [NOT IMPLEMENTED]`.

FlipCard / Daily Review accessibility (TASK-00 focus): still covered by `FlipCard.a11y.test.tsx`, `DailyReviewScreen.a11y.test.tsx`, and `componentAccessibilityRegressions.test.tsx` — all passing in the full suite run.

## 4. Native builds (AC-19)

### iOS Development simulator — PASS

```
Command: xcodebuild -workspace ios/ScanLearnEnglish.xcworkspace \
  -scheme Development -configuration DebugDev -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO build
Result: ** BUILD SUCCEEDED **
Artifact: DebugDev-iphonesimulator/ScanLearnEnglish.app
```

TASK-00 also reported `yarn ios` (Development / iPhone 17) PASS; TASK-07 used the repo's documented `xcodebuild` smoke command (same convention as `docs/qa/lingobites-offline-review-mvp.md`).

### Android `assembleDevelopmentDebug` — BLOCKED (environment)

```
Command: cd android && ./gradlew assembleDevelopmentDebug
Failure: "The operation couldn't be completed. Unable to locate a Java Runtime."
Summary: Same blocker as TASK-00. Gradle cannot start without a supported JDK.
         No Android SDK path configured on this host.
```

## 5. Manual QA matrix (AC-20)

Legend: **PASS** = exercised on device/simulator this run; **AUTO** = covered by automated tests only; **N/R** = not run this run (no device session / missing Android toolchain).

| Area                               | iOS      | Android     | Online | Offline | Evidence                                                                                                                           |
| ---------------------------------- | -------- | ----------- | ------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Camera permission / capture        | N/R      | N/R         | AUTO   | N/R     | `ImageCaptureScreen.test.tsx`, `ingestionRouteGate.test.ts`                                                                        |
| Gallery permission / picker        | N/R      | N/R         | AUTO   | N/R     | `ImageCaptureScreen.test.tsx`                                                                                                      |
| Microphone / recording             | N/R      | N/R         | AUTO   | AUTO    | `recordingService.test.ts`, `SpeakingRepository.test.ts`                                                                           |
| Notification permission / schedule | N/R      | N/R         | AUTO   | AUTO    | `nativeReminderScheduler.test.ts`, `reminderService.test.ts`                                                                       |
| Content audio playback / cache     | N/R      | N/R         | AUTO   | AUTO    | `contentAudioPlayer.test.ts` (honest `NOT_DOWNLOADED`), `deviceChapterAudio.test.ts`, `chapterAudioCache.test.ts`                  |
| OCR → review → AI ingestion (mock) | N/R      | N/R         | AUTO   | AUTO    | `OCRService.test.ts`, `OCRReviewScreen.test.tsx`, `MockAIAnalysisService.test.ts`, `AnalyzingScreen.test.tsx`                      |
| Sync recovery (offline → online)   | N/R      | N/R         | AUTO   | AUTO    | `offlineSyncResilience.test.ts`, `syncManager.test.ts`, `outboxSync.test.ts`                                                       |
| All seven showcase themes          | N/R      | N/R         | AUTO   | AUTO    | `ThemePicker.test.tsx` (7 themes in showcase), `ThemeProvider.test.tsx`, `contrastCompliance.test.ts`                              |
| Destructive data (clear local)     | N/R      | N/R         | AUTO   | AUTO    | migration / repository clear-data tests (`GrammarBookmarkRepository`, `ContentLessonStateRepository`, `selfDogfoodRunner.test.ts`) |
| Library bookmarks (3 segments)     | N/R      | N/R         | AUTO   | AUTO    | `LibrarySegments.integration.test.tsx`, segment component tests                                                                    |
| Daily Review / FlipCard a11y       | N/R      | N/R         | AUTO   | AUTO    | `FlipCard.a11y.test.tsx`, `DailyReviewScreen.a11y.test.tsx`                                                                        |
| iOS dev build                      | **PASS** | —           | —      | —       | `xcodebuild` smoke (§4)                                                                                                            |
| Android dev build                  | —        | **BLOCKED** | —      | —       | No Java runtime (§4)                                                                                                               |

**Matrix verdict:** Automated coverage is substantially improved since TASK-00 (121 vs 104 suites). No manual device/simulator walk-through was executed in TASK-07; native/integration capabilities therefore retain conservative observed ratings below.

## 6. Per-capability report (AC-21)

Columns follow execution-plan D3: **baseline status** comes from `src/release/feature-registry.ts` at HEAD; **observed result** reflects TASK-07 evidence only. A capability is **not** marked observed `ready` without matching automated, build, or device proof.

| Capability                | Baseline status | Observed result | Limitation                                                                  | Production recommendation |
| ------------------------- | --------------- | --------------- | --------------------------------------------------------------------------- | ------------------------- |
| `pasteTextInput`          | ready           | ready           | —                                                                           | **keep**                  |
| `imageInput`              | ready           | beta            | Camera/gallery flows tested with mocks; no device permission QA this run    | **finish**                |
| `ocrScanner`              | ready           | beta            | OCR service unit-tested; no live camera OCR on device                       | **finish**                |
| `ocrReviewEdit`           | ready           | beta            | Review/edit screen tested; no end-to-end device capture path                | **finish**                |
| `aiLessonAnalysis`        | ready           | beta            | Mock + job client tests pass; backend credential smoke not run              | **finish**                |
| `lessonResultView`        | ready           | ready           | Screen/component tests + route gating                                       | **keep**                  |
| `lessonSave`              | ready           | ready           | Persistence + flashcard tests                                               | **keep**                  |
| `lessonHistory`           | ready           | ready           | Library/history screen + repository tests                                   | **keep**                  |
| `lingobitesMvpReviewFlow` | ready           | ready           | Home/route-gate/MVP regression tests                                        | **keep**                  |
| `shortPractice`           | ready           | beta            | Flag wiring on lesson surfaces; no dedicated practice-session device QA     | **finish**                |
| `pronunciationSupport`    | not_implemented | not_implemented | Disabled in showcase preset; registry limitation documented                 | **exclude**               |
| `themeSystem`             | ready           | ready           | Theme provider, storage, render tests                                       | **keep**                  |
| `themeSwitcher`           | ready           | ready           | Gating + showcase exposure tests (`ThemePicker.test.tsx`)                   | **keep**                  |
| `darkTheme`               | ready           | beta            | Render/contrast automated; no manual visual QA on device for all screens    | **finish**                |
| `pastelKidsTheme`         | ready           | beta            | Same as `darkTheme`                                                         | **finish**                |
| `coreTheme`               | ready           | beta            | Same as `darkTheme`                                                         | **finish**                |
| `neoTheme`                | ready           | beta            | Same as `darkTheme`                                                         | **finish**                |
| `comicTheme`              | ready           | beta            | Same as `darkTheme`                                                         | **finish**                |
| `cartoonTheme`            | ready           | beta            | Same as `darkTheme`                                                         | **finish**                |
| `reviewSystem`            | ready           | beta            | SRS/review tests + FlipCard a11y; notification delivery not device-verified | **keep**                  |
| `miniGame`                | not_implemented | not_implemented | Disabled in showcase; validator rejects enabled `not_implemented`           | **exclude**               |
| `wordMatchGame`           | not_implemented | not_implemented | —                                                                           | **exclude**               |
| `fillBlankGame`           | not_implemented | not_implemented | —                                                                           | **exclude**               |
| `tenseQuizGame`           | not_implemented | not_implemented | —                                                                           | **exclude**               |
| `sentenceOrderGame`       | not_implemented | not_implemented | —                                                                           | **exclude**               |
| `flashcardChallenge`      | not_implemented | not_implemented | —                                                                           | **exclude**               |
| `situationLearning`       | not_implemented | not_implemented | Disabled in showcase                                                        | **exclude**               |
| `dialogueGenerator`       | not_implemented | not_implemented | —                                                                           | **exclude**               |
| `phraseExtractor`         | not_implemented | not_implemented | —                                                                           | **exclude**               |
| `situationPractice`       | not_implemented | not_implemented | —                                                                           | **exclude**               |

### Cross-cutting integration notes (TASK-06)

- Content-package lesson audio: metadata resolves offline, but playback returns `NOT_DOWNLOADED` until a downloader/cache path ships (`contentAudioPlayer.test.ts`). UI surfaces retry instead of silent failure.
- Saved/unsaved bookmark icons: regression fixed (`favorite` / `favorite-border` glyphs).
- Registry `entryPoint` strings remain generic (`HomeScreen -> PasteText`) for several foundation capabilities; Feature Status lists capabilities honestly but does not launch missing implementations.

## 7. Release decision summary

| Category                                                        | Count | Capabilities                                                                                                                   |
| --------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------ |
| Observed **ready** (production-candidate with current evidence) | 7     | `pasteTextInput`, `lessonResultView`, `lessonSave`, `lessonHistory`, `lingobitesMvpReviewFlow`, `themeSystem`, `themeSwitcher` |
| Observed **beta** (finish before production)                    | 13    | ingestion chain (`imageInput`…`aiLessonAnalysis`), `shortPractice`, six alternate themes, `reviewSystem`                       |
| Observed **not_implemented** (exclude)                          | 10    | pronunciation, mini-games (6), situation learning (3)                                                                          |

**Preset verdict:** `full-feature-showcase` is suitable for **internal product review and coordinator verification** on iOS with the documented Android environment blocker. It is **not** a production release candidate until device QA closes the manual matrix gaps and Android dev build is reproducible.

**Branch readiness:** `feature/sete-128-full-feature-showcase` at `fd91d11` passes all JS gates with baseline skipped-test count, iOS Development smoke build, and a clean worktree. Ready for one consolidated PR after coordinator review. Android build evidence remains blocked pending JDK + SDK setup.

## 8. Registry metadata changes

None applied in TASK-07. Baseline registry statuses are preserved; observed downgrades live in this report per D3. A future pass may promote/demote registry `status` fields once device QA evidence is captured.

## 9. Checks not run

- Physical iOS/Android device manual walk-through (permissions, notifications, mic, airplane-mode playback).
- Backend credential smoke for live OCR/AI.
- Android `assembleDevelopmentDebug` (JDK missing).
- CI pipeline on remote (local gates only).
