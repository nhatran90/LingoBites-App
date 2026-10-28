> **Lưu trữ:** mô tả bản cũ, không còn đúng với code hiện tại. Xem [`architecture/feature-map.md`](../../architecture/feature-map.md).

# LingoBites Offline Review MVP — Manual QA & Release Acceptance

- **Issue:** SETE-101 (SETE-92 Task 9), scheduler acceptance resolved in SETE-102 (Task 10)
- **Date:** 2026-09-06
- **Branch:** `main` (shared feature branch), based on `origin/main`
- **Base revision:** `c5dceec` (SETE-100). QA changes committed on top; SETE-102 restored
  the accepted fixed two-rating scheduler on top of the QA revision.
- **Release under test:** `lingobites-mvp` (activated via `DEFAULT_RELEASE_NAME`)

## 1. Environment under test

| Item               | Value                                                                               |
| ------------------ | ----------------------------------------------------------------------------------- |
| Host               | macOS (darwin arm64), Xcode 26.6 (17F113)                                           |
| Node / Yarn        | v26.4.0 / 1.22.22                                                                   |
| CocoaPods          | Pods installed via `bundle exec pod install` (system `pod` not on PATH)             |
| Android SDK / Java | **Not installed** — Java runtime not found, `ANDROID_HOME`/`ANDROID_SDK_ROOT` unset |
| iOS simulator      | iPhone 17 (iOS 26.5 sim runtime), booted                                            |
| SQLite on device   | `Documents/lingobites.db` created by app on first boot                              |

## 2. Scope

Final offline QA and release acceptance for the LingoBites offline review MVP on the
`mobile-app` repository, per the SETE-92 implementation chain (Tasks 1–8 already done).
Out of scope: no new production features, no backend/sync/auth/notification/Sentry/audio/
gamification/marketplace/ingestion work.

## 3. Release config acceptance

Baseline defect found during acceptance (release-blocking, corrected this run):

- `lingobites-mvp.json` had `lessonResultView`, `lessonSave`, `lessonHistory` and
  `reviewSystem` set to `false`. Under that matrix the MVP build could not save a
  flashcard from a saved lesson (`SavedLessonDetailScreen.tsx:261` gates the word-save
  toggle on `reviewSystem`) and could not run a Daily Review session
  (`DailyReviewScreen.tsx:190` renders `review.feature_disabled` when `reviewSystem` is off).
  This contradicted the SETE-92 Definition of Done (boot with `lingobites-mvp`, working
  offline review flow) and the approved plan's MVP config matrix.
- `feature-dependencies.ts` still chained `lessonResultView -> aiLessonAnalysis`, so the
  saved-lesson/review path could not be enabled while legacy ingestion was disabled.
- `DEFAULT_RELEASE_NAME` had been reverted to `situation-learning-release` on `main`
  (commit `02a9ef6`), so the app did not boot into the MVP config.

Corrections applied in this run:

- `src/release/configs/lingobites-mvp.json`: enabled `lessonResultView`, `lessonSave`,
  `lessonHistory`, `reviewSystem` (ingestion flags stay disabled).
- `src/release/feature-dependencies.ts`: decoupled `lessonResultView` from
  `aiLessonAnalysis` so the saved-lesson/review path no longer requires OCR/AI/paste
  ingestion (as the approved plan directed).
- `src/release/release-manifest.ts`: `DEFAULT_RELEASE_NAME = 'lingobites-mvp'`.
- `src/release/__tests__/validate-release-config.test.ts`: hardened the
  `lingobites-mvp` acceptance test to assert review enabled + legacy ingestion disabled,
  so the matrix cannot silently regress.

### Results

- `yarn jest --runInBand src/release/__tests__/validate-release-config.test.ts`
  → **PASS** (8/8). All 5 named configs validate; invalid-config guards still fail as expected.
- Runtime boot validation: `FeatureFlagProvider` throws on an invalid config; the app
  boots in the simulator under `lingobites-mvp`, i.e. the config is valid at runtime.

## 4. Automated tests & lint

Commands (run from `mobile-app/`):

| Command                                                                                                                                | Result                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `yarn jest --runInBand src/release/__tests__/validate-release-config.test.ts`                                                          | PASS                                                                                                                                                                                       |
| MVP targeted set (release config, route gating, feature flags, Home MVP/DailyReview, FlashcardRepository, reviewScheduler, offline QA) | PASS                                                                                                                                                                                       |
| `yarn jest --runInBand src/shared/db/__tests__/offlineReviewQa.test.ts`                                                                | PASS (offline review evidence test)                                                                                                                                                        |
| `yarn test --runInBand` (full suite)                                                                                                   | **PASS — 73 suites, 531 passed, 1 skipped**                                                                                                                                                |
| `yarn lint` (`eslint .`)                                                                                                               | **0 errors**, 317 pre-existing warnings (no new warnings in touched files)                                                                                                                 |
| `yarn tsc --noEmit`                                                                                                                    | 1 **pre-existing** error in `test-utils/a11yTestUtils.ts:56` (TS2367), reproduced on the clean tree at `c5dceec`; unrelated to MVP files. No `typecheck` script is configured in the repo. |

## 5. Native smoke builds

### Android — BLOCKED (environment)

```
Command: cd android && ./gradlew assembleDebug   (also tried ./gradlew --version)
Failure: "The operation couldn’t be completed. Unable to locate a Java Runtime."
Summary: No Java runtime on PATH and no Android SDK (ANDROID_HOME/ANDROID_SDK_ROOT
unset, sdkmanager absent). Gradle cannot even start. This is an environment blocker,
not a code failure. Fastlane release builds additionally require Play Store credentials
(PLAY_STORE_JSON_KEY_FILE) that are not present here.
```

### iOS — PASS (smoke build + boot)

```
Command: xcodebuild -workspace ios/ScanLearnEnglish.xcworkspace -scheme Development \
  -configuration DebugDev -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO build
Result: ** BUILD SUCCEEDED **  → DebugDev-iphonesimulator/ScanLearnEnglish.app
```

Boot smoke on iPhone 17 simulator (Metro serving `:8081`):

- `xcrun simctl install booted <ScanLearnEnglish.app>` → OK
- `xcrun simctl launch booted com.lingobites.dev` → launched (pid), process stayed alive
- Unified log shows JS loaded from Metro, `QuickSQLite` module installed, UIWindowScene
  activated; no red-box/crash entries.
- App created `Documents/lingobites.db` with all expected tables (`flashcards`,
  `review_schedule`, `review_sessions`, `sync_outbox`, `lessons`, …) → migrations ran on boot.

Notes / environment caveats:

- `pod`/`pod install` must be run through `bundle exec pod` (no system CocoaPods). Pods
  were already installed on `main` (Podfile.lock current).
- Simulator builds need no code signing; a physical-device/Release build still requires
  signing + provisioning not present here. Store/Release delivery was **not** run.

## 6. Manual offline QA checklist

Steps 1–5 reproduce the acceptance flow. The app-level airplane-mode toggle and physical
device restart cannot be executed in this headless environment (iOS Simulator has no
airplane-mode control; no scripted UI driver / no visual inspection available). Each step
is therefore reported either as **verified by automated replica** (repository layer,
real SQLite-backed quick-sqlite mock) or **blocked / manual-on-device** with the exact gap.

| #   | Step                                                              | Expected                                                                                                                                                                                                | Result                                                                                                                                                                                                                                                                                                                                   |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Save a flashcard from a saved lesson (local, offline entry point) | `saveFlashcard` creates one flashcard + a `review_schedule` row (interval 1d, due immediately) under the fixed two-rating scheduler; duplicate save is idempotent (no duplicate row, no schedule reset) | **PASS** — `FlashcardRepository.test.ts` (idempotency, list, unsave) + `offlineReviewQa.test.ts`; component path `SavedLessonDetailScreen`/`LessonResultScreen` covered by `SavedLessonDetailScreen.test.tsx` / `LessonResultScreen.flashcards.test.tsx`                                                                                 |
| 2   | Enable airplane mode (device)                                     | All writes local; no network required for save/review                                                                                                                                                   | **BLOCKED (device)** — cannot toggle airplane mode on simulator. Repository layer performs no network I/O on save/rate; rating only enqueues a local `sync_outbox` row (see §8 note)                                                                                                                                                     |
| 3   | Complete one review session (front-first active recall)           | Rating buttons disabled until card flip/reveal; exactly two ratings (`remembered                                                                                                                        | forgot`); `recordFlashcardRating` moves card out of today's due queue; summary shows reviewed/remembered/forgot counts; forgot resets interval to 1d; rating-write failure does **not** auto-advance the session and shows a translated error                                                                                            | **PASS (automated)** — `DailyReviewScreen.test.tsx` + `.a11y.test.tsx`, `feature-flag.test.tsx`, `FlashcardRepository.test.ts` (remembered chain, forgot reset, FLASHCARD_NOT_FOUND, outbox atomicity). UI tap-through on device: BLOCKED (no UI driver) |
| 4   | Restart app (device)                                              | Data survives restart; app boots into MVP config                                                                                                                                                        | **PASS (boot smoke)** — app relaunched/terminated cleanly on simulator; DB file persists in container. Full UI re-login walkthrough on device: BLOCKED                                                                                                                                                                                   |
| 5   | Confirm schedule / `review_sessions` persistence                  | After restart the card's `next_review_at` reflects the last rating and the `review_sessions` row remains                                                                                                | **PASS (automated replica)** — `offlineReviewQa.test.ts` performs save → offline rating → drop DB handle + reopen (restart) → asserts flashcard saved, `next_review_at = 2026-08-20T12:00:00Z` (remembered advances 1 → 3d), due queue empty until day 3, and the `review_sessions` row persisted with the rating. Device check: BLOCKED |
| 6   | Empty states distinct ("no flashcards" vs "all done today")       | Two distinct translated empty states driven by saved-card count                                                                                                                                         | **PASS (automated)** — `DailyReviewScreen.test.tsx`, `flashcard-edge-cases.test.tsx` (empty-state suites)                                                                                                                                                                                                                                |
| 7   | Home in MVP mode                                                  | Ingestion CTAs hidden; MVP no-content card explains saved-lesson flow; due-count widget only when `reviewSystem` on and a card is due; no route-not-found path                                          | **PASS (automated)** — `HomeScreenMvp.test.tsx`, `ingestionRouteGate.test.ts`, `HomeScreenDailyReview.test.tsx`. Visual confirmation on simulator: BLOCKED (no image review in this session)                                                                                                                                             |

### Offline QA evidence test

`src/shared/db/__tests__/offlineReviewQa.test.ts` replicates the acceptance flow at the
repository boundary (no network dependency):

1. save lesson + flashcard locally;
2. complete one review session (rate `remembered`) while "offline";
3. simulate restart (`resetDatabaseForTests(null)` + reopen);
4. assert schedule advanced (card due on day 3 per the fixed `[1,3,7,…]` chain, not today)
   and the `review_sessions` row persisted with the `remembered` rating.

Result: **PASS**. Supporting mock change: `test-utils/sqliteMock.js` gained a
`SELECT … FROM review_sessions` handler so the session row can be read back.

## 7. Final acceptance notes

- iOS simulator smoke build and boot pass; Android build is **blocked by the local
  environment** (no Java runtime, no Android SDK) — an Android build was **not** claimed
  as passed. Full Release/signing and physical-device runs were not performed.
- On-device manual steps (airplane mode toggle, UI tap-through, device restart
  walkthrough, visual confirmation) are **blocked in this environment** and are recorded
  as such; the underlying flow is verified by the automated replica above.
- **Scheduler/rating-model divergence — RESOLVED by SETE-102:** the shared `main` had
  carried the SETE-86 SM-2 four-rating scheduler (`forgot|hard|good|easy`,
  `review_schedule.rating_scale = 'v2'`), which the coordinator decision declined to
  accept for this MVP (no human approval existed; SETE-92 gates any rating-model
  expansion). Task 10 restored the accepted fixed two-rating contract on `main`: the
  review flow now schedules under the fixed `[1,3,7,14,30,60,120]` chain with exactly
  `remembered | forgot`. The SM-2 `v1/v2` scale columns, `v1 → v2` backfill, ease
  factor / repetition bookkeeping, and the four-rating UI were removed from the
  scheduler, persistence layer, Daily Review flow, and their tests. New cards save at
  interval 1d and `remembered` advances to the next fixed bucket; `forgot` resets to 1d.
- Related: rating also enqueues a local `sync_outbox` row and the shared `main` includes
  gamification/reminder code reached from the review session. These exist on the
  integration branch that the tasks built on; they are noted here as acceptance
  context, not newly added by this task.
- The MVP config defect (review path disabled) found during this gate was corrected so
  the MVP build can actually save and review; see §3.

## 8. Evidence / artifacts

- `src/shared/db/__tests__/offlineReviewQa.test.ts`
- `test-utils/sqliteMock.js` (review_sessions read support)
- `src/release/configs/lingobites-mvp.json`, `src/release/feature-dependencies.ts`,
  `src/release/release-manifest.ts`, `src/release/__tests__/validate-release-config.test.ts`
- SETE-102 restore of the fixed two-rating scheduler: `src/shared/db/reviewScheduler.ts`,
  `src/shared/db/types.ts`, `src/shared/db/FlashcardRepository.ts`,
  `src/shared/db/migrations.ts`, `src/components/RatingControl.tsx`,
  `src/modules/review/DailyReviewScreen.tsx`, `src/i18n/{vi,en}.json`, and the
  scheduler/persistence/Daily Review/release-config tests updated to match.
- Simulator boot screenshot captured during this run (attached to the issue comment).
