# iSubnet — Combined Round: Freemium Tier Changes + Native UI Polish + Smart Review Request + Crash Analytics + Build Bump

**Target build: versionCode/CURRENT_PROJECT_VERSION 74, versionName/MARKETING_VERSION 1.1.17.** This supersedes the version numbers in the round as originally drafted — see "Corrections made" below.

**Build 73 has since shipped, separately, and is now the confirmed baseline — and 1.1.16 is now live on both stores.** Build 73 was a standalone out-of-band release (full detail in `iSubnet_build73_implementation_prompt.md`) covering the mobile keyboard `inputmode` fixes — the Wildcard & Prefix Converter field, the IPv4 Calculator field, and the VLSM hosts field's dot/comma/space separator handling — plus two more bugs found during that same testing pass: the Splitter Equal/VLSM highlight not rendering, and a matching CSS-variable bug on the History tab. Directly verified against the live project: Android reads `versionCode 73` / `versionName "1.1.16"`, and iOS reads `CURRENT_PROJECT_VERSION 73` / `MARKETING_VERSION 1.1.16` (both build configs). **1.1.16 has since been confirmed live on both the App Store and Google Play** — which triggers the exact condition this document already anticipated for 1.1.15: a marketing version that's already live can't be reused for a further submission. So this round now bumps versionName/MARKETING_VERSION from **1.1.16 to 1.1.17**, in addition to the versionCode/CURRENT_PROJECT_VERSION 73→74 build bump. This round starts from the build-73 baseline and produces **build 74, version 1.1.17**. None of build 73's fixes are part of this round — do not redo any of them here, and do not reference them as a lettered Part of this document; they already shipped separately.

Do all of the following as one implementation pass. Read each part fully before starting — later tasks build on functions touched earlier (e.g. Part E's error handling should call the `showErrorDialog()`/`showToast()` primitives built in Part B, not raw `alert()`).

**NOTE ON LINE NUMBERS — READ THIS BEFORE TRUSTING ANY LINE NUMBER BELOW:** every line number in this document was verified against a build-70 snapshot. Build 73 has since made real, substantial edits to these same files — `app.js` alone is now about 74 lines shorter net (an ~88-line IPv6-handling branch was removed from `runConverter()`, while a few small helper functions were added elsewhere), and `index.html`/`styles.css` were also touched (a VLSM-panel markup block, a Splitter button's inline style, a History-tab CSS rule). This is not the usual "a few unrelated fixes landed" drift the previous version of this note warned about — it's a confirmed, nontrivial shift. Treat every line citation below as a starting search hint only, never as ground truth: locate each target by searching for the named function/variable/id, confirm the surrounding code actually matches the description, and only then edit. Re-verifying every line number against the current build-73 source before starting implementation would be time well spent.

**NOTE:** Task A4 (hiding Debug Logging behind a 7-tap gesture) was already handled in a separate round (build 67) — do not redo it here.

**NOTE:** Android R8/ProGuard obfuscation was already handled in a separate round — do not redo it here.

---

## Corrections made to this round before implementation

1. **Version numbers corrected again — this round now targets build 74 / version 1.1.17, not build 73 / 1.1.16.** The round as originally drafted said to bump versionCode 67→68. The project moved on (build 70 uploaded), so this was corrected to 70→71, then to a planned 72→73 bump once an earlier keyboard-fix pass was expected to land as "build 72." In practice, the keyboard/UX fixes and two additional bugs found during live testing (VLSM separator handling, the Splitter highlight, and a matching History-tab bug) shipped together as one out-of-band release, and the live project is now directly confirmed at Android `versionCode 73` / iOS `CURRENT_PROJECT_VERSION 73`. **Separately, 1.1.16 has now been confirmed live on both stores**, so per the same "can't resubmit a live version" rule as the earlier 1.1.15→1.1.16 correction, versionName/MARKETING_VERSION also moves. So this round now bumps **Android versionCode 73→74 and versionName "1.1.16"→"1.1.17"** (and the matching iOS pair — see #2 and #3 below).

2. **iOS was further behind than Android historically — the build-73 release closed that gap.** `ios/App/App.xcodeproj/project.pbxproj` was originally found at `CURRENT_PROJECT_VERSION = 67` and `MARKETING_VERSION = 1.1.14` (both occurrences), never bumped to match Android's earlier rounds. The build-73 release is confirmed to have brought iOS all the way up to `CURRENT_PROJECT_VERSION = 73` / `MARKETING_VERSION = 1.1.16` (both build configs), matching Android exactly. This round's Task E1 is therefore a normal, single-step 73→74 bump on both platforms, not a catch-up jump.

3. **versionName/MARKETING_VERSION now moves to 1.1.17 — the same rule has fired twice in a row.** Apple approved/released marketing version 1.1.15 before build 73 shipped, and a marketing version that's already live on the App Store cannot be reused for a further submission — so the build-73 release bumped versionName (Android) and MARKETING_VERSION (iOS) from 1.1.15 to 1.1.16 on both platforms, confirmed directly in the live project. **1.1.16 has now itself been confirmed live on both the App Store and Google Play**, so the identical rule applies again: this round bumps versionName/MARKETING_VERSION from **1.1.16 to 1.1.17** on both platforms (see Task E1). If 1.1.17 itself gets approved/released before this round ships, apply the same logic once more and move to 1.1.18 instead — check live store status right before starting Task E1, don't assume this document's snapshot still holds.

8. **All line numbers in Parts A–F below need re-verification against the current build-73 source, not build 70.** See the "NOTE ON LINE NUMBERS" at the top — build 73 made real edits to `app.js`, `index.html`, and `styles.css` that this document's line citations do not reflect. None of build 73's changes overlap in *content* with Parts A–F (different features entirely), so the tasks themselves are unaffected — but their line numbers likely are, and should be treated as approximate until re-checked.

4. **Part D's blocker is resolved — both Firebase config files are now present.** `android/app/google-services.json` and `ios/App/App/GoogleService-Info.plist` were both missing when this round was originally drafted; both now exist and were confirmed directly against the live project. Their bundle/package IDs (`com.banzaigr.isubnet`) match the app's `applicationId`/`PRODUCT_BUNDLE_IDENTIFIER` on both platforms — no mismatch to fix first. Task D0 should still be run as a quick confirmation (files exist, IDs match), but it's expected to pass immediately rather than block the round.

5. **Task B2's alert()/confirm() count is now 28, not 26.** Recount against the live file: 25 `alert(` + 3 `confirm(` = 28. The two new ones are the RevenueCat User ID tap-to-copy handler added since this round was originally drafted (`app.js` lines 358 and 360): `alert('User ID copied to clipboard.')` and `alert('Could not copy automatically.')`. Grep will find these automatically, but they're called out explicitly below since they postdate the original "26 total sites" count.

6. **`shareText()` is touched by both Task A2 and Task B2.** Its non-native/non-`navigator.share` fallback path ends in `alert(\`${title} copied to clipboard!\`)` (one of the 28 sites). Land Task A2's watermark logic and Task B2's alert-to-toast migration on this function together, in the same pass, so they don't conflict.

7. **New Part F added**, merging two follow-up fixes requested after build 70 shipped: the "tap to copy" label still reads as a duplicate (confirmed still present, unfixed, at `index.html` line 233), and the Number Base Converter (Binary/Octal/Decimal/Hex tab) has no debug-log instrumentation. Part F's logger call and Task A6's Hex-gating **both edit `runBaseConverter()`** — they must land together in the same edit, with the logger call as the literal first line of the function, before Task A6's gating logic and before the existing `_baseConverting` guard.

---

## PART A — FREE VS. PRO TIER CHANGES

### TASK A1 — Raise free tier caps
File: `app.js` (verified: line 627–628)
```diff
- const FREE_NOTES_LIMIT = 2;
+ const FREE_NOTES_LIMIT = 3;
- const FREE_HISTORY_LIMIT = 2;
+ const FREE_HISTORY_LIMIT = 4;
```

File: `index.html` (verified: line 383)
- Update `<p id="current-plan-desc">` copy from "Basic parameters, limited to 2 notes and 2 history items." to reflect the new caps (3 notes, 4 history items).

### TASK A2 — Make Share a free feature with a watermark (not a hard paywall gate)
File: `app.js`, function `shareText(title, text)` (verified: line 2125)
- When `PRO_UNLOCKED` is false, append this watermark to the shared text: `"\n\n— Calculated with iSubnet · isubnet.net"`. When `PRO_UNLOCKED` is true, share text unchanged, no watermark.
- This function is called from ~10 sites — do not touch call sites, only the shared function.
- Do NOT hard-gate Share behind `showProModal()`. It must remain tappable/functional for free users; only the shared output changes.
- See "Corrections made" #5 above — land this alongside Task B2's edit to this same function's `alert()` fallback.

### TASK A3 — Reorder and rewrite Pro paywall messaging
File: `index.html`
- Plan-modal Pro card blurb (verified: line 392): replace the current line ("Unlimited notes/history, subnet splitter engine, and export functions.") with copy that leads with the strongest benefits first, matching the order below.
- Pro features list (verified: `<ul class="pro-features-list">` at line 407): reorder/rewrite to:
  1. VLSM & FLSM Subnet Designer
  2. Bulk IPv4 & IPv6 Calculations
  3. Export CSV & Professional Reports
  4. Share Without the Watermark
  5. Unlimited History
  6. Unlimited Notes
- Notes/History should read as minor conveniences, not headline sellers.

### TASK A5 — Fix inconsistent Pro-indicator markup on Export buttons + add a visible "before tap" indicator
- The Bulk export buttons are missing `class="btn-action pro-feature-btn" data-pro="true"` that the other export buttons already have. Verified current ids/lines:
  - `btn-export-pdf-bulk-ipv4` (line 507), `btn-export-csv-bulk-ipv4` (line 508)
  - `btn-export-pdf-bulk-ipv6` (line 671), `btn-export-csv-bulk-ipv6` (line 672)
  - Confirmed: all four currently lack `pro-feature-btn`/`data-pro`. Add it for consistency.
- Add a small, clear visual Pro indicator (e.g. a 👑 icon or "Pro" badge) that shows on ALL `.pro-feature-btn` elements when the user is not Pro, visible BEFORE tap, not just as a paywall popup after. Add CSS near existing pro-related styles. (Currently 12 elements carry `pro-feature-btn` — that count will rise to 16 after this task.)
- Generalize `applyProState()` (verified: `app.js` line 690) to use `document.querySelectorAll('.pro-feature-btn')` so the lock indicator/styling applies consistently across all Pro-gated buttons, instead of hardcoding just the Splitter tab button. Preserve any Splitter-tab-specific extra behavior (`tab-btn-locked`, `tab-lock-icon`) as a special case if needed.
- Do NOT change the actual gating logic in `triggerCSVDownload`/`triggerPDFExport` (`pdfIds`/`csvIds` arrays) — already correct. This task is visual/markup only.

### TASK A6 — Lock the Base Converter's Hexadecimal output behind Pro
File: `index.html` (Hexadecimal field group: label ~line 1028, copy button `btn-copy-base-hex` line 1032, input `base-hex-input` line 1037) and `app.js` (`runBaseConverter(sourceId, fromBase)` — verified line 2456; `setupBaseConverter()` — verified line 2516).

Context: The Base Converter is a live, bidirectional 4-way sync — typing into Binary (`base-bin-input`), Octal (`base-oct-input`), Decimal (`base-dec-input`), or Hex (`base-hex-input`) instantly recalculates the other three via `convertBase()`. Free users should keep full access to Binary, Octal, and Decimal, both as input and as computed output — only Hex should be paywalled.

**Behavior for non-Pro users:**
- `base-hex-input` must never display an actual computed hex value — whether from someone typing into it directly, or as the live-synced output when Bin/Oct/Dec are entered elsewhere. Show a locked placeholder instead (e.g. "🔒 Pro"), consistent with the visual language used for other Pro-gated elements.
- Disable typing into `base-hex-input` for non-Pro users, and add a click/focus handler on the field that opens `showProModal()` instead.
- Add a small Pro badge/lock icon next to the "Hexadecimal (Base 16)" label so the restriction is visible before the user tries to use it, matching the badge styling from Task A5.
- The Copy button for Hex (`btn-copy-base-hex`) should also be disabled/gated for non-Pro users — clicking it should open `showProModal()` rather than copying a locked value.
- Binary, Octal, and Decimal fields and their copy buttons are NOT affected.

**Behavior for Pro users:** `base-hex-input` behaves exactly as it does today.

**Implementation notes — verified against the live function body:**
- The exact write site to gate is this line near the end of `runBaseConverter()`, just before `_baseConverting = false;`:
  ```js
  if (inputs.hex && sourceId !== 'hex') inputs.hex.value = result.hex;
  ```
  Wrap this specific write in a `PRO_UNLOCKED` check — when false, set the locked placeholder instead of `result.hex`. Keep this separate from the field's disabled/locked visual state.
- Wire the locked/unlocked state of this field into the same `applyProState()` function being generalized in Task A5, so upgrading to Pro immediately unlocks and correctly populates the Hex field without requiring a page reload.
- `setupBaseConverter()` (line 2516) registers each field's `input` listener via a `fields` array (`{ id, key, base }`) and the copy buttons via a `copyDefs` array — add the click/focus-to-paywall handler for `base-hex-input` and gate `btn-copy-base-hex`'s existing click handler here.
- **This function is also edited by Part F below (debug logging). Both edits land in the same pass** — Part F's logger call goes in as the literal first line of `runBaseConverter()`, before the existing `if (_baseConverting) return;` guard; this task's Pro-gating goes in further down at the hex-write line quoted above. Do not let one edit clobber the other.

---

## PART B — REPLACE BROWSER-STYLE alert()/confirm() WITH NATIVE-FEELING UI

### TASK B1 — Build three reusable UI primitives
Reuse the existing `.pro-modal-overlay`/`.pro-modal` styling already used by `#pro-modal`/`#sync-nudge-modal`/account modal as the visual basis.
1. `showToast(message, options?)` — small, auto-dismissing, non-blocking toast.
2. `showConfirmDialog(message, { confirmText, cancelText })` — returns `Promise<boolean>`. Replaces `confirm()`.
3. `showErrorDialog(message, options?)` — modal for error/failure states. Replaces failure `alert()`s. Also used by Part D's crash-handling code — keep its signature simple (a message string is enough).

### TASK B2 — Migrate all alert()/confirm() call sites in app.js
**28 total sites as of this writing (25 `alert(` + 3 `confirm(`), re-verified directly against the live file — grep `app.js` for `"alert("` and `"confirm("` before starting to get the current full list and locate each by content, not by these approximate line numbers.**

- The debug-logging reminder (verified: line 75 — "Debug logging has been on for X minutes. Turn it off...?") is a CONFIRM DIALOG, not a toast/error — a yes/no question. Convert to `await showConfirmDialog(...)`, refactoring the calling function to async/await.
- General status/info `alert()`s → `showToast()` or `showErrorDialog()` per message meaning.
- The `updateRevenueCatSubscriptionState()` error handler (verified: function at line 470, the offending log call at line 526) currently exposes raw `err.stack` to the user via its debug log message — search for `"ERROR in updateRevenueCatSubscriptionState"`. CRITICAL: strip the stack trace from anything user-facing; log the full error (with stack) only to the internal debug log AND to Crashlytics (Part D); show the user a generic, friendly message via `showErrorDialog()`.
- **NEW — RevenueCat User ID copy handler** (verified: `app.js` lines 358 and 360, inside the `debug-userid-row` click listener):
  ```diff
  - alert('User ID copied to clipboard.');
  ...
  - alert('Could not copy automatically.');
  ```
  Migrate to `showToast('User ID copied to clipboard.')` (success) and `showErrorDialog('Could not copy automatically. Long-press the ID above to select and copy it manually.')` (failure) respectively. This pair postdates the original 26-site count for this round — don't miss it just because it's new.
- "Clear all history?" `confirm()` (verified: line 1883) → `await showConfirmDialog(...)`, async-refactor the calling function (`clearHistory()`, line 1882).
- "Copied to clipboard!" `alert()` (inside `shareText()`'s fallback path — see "Corrections made" #5) → `showToast()`. Land together with Task A2's watermark edit to the same function.
- Account deletion warning `confirm()` (verified: line 4030) → `await showConfirmDialog(...)`, same async-refactor care (the enclosing click handler at line 4028 is already `async`).
- Restore purchases `alert()`s → `showToast()` (success) / `showErrorDialog()` (failure).
- Export failure `alert()`s → `showErrorDialog()`.
- The debug logging info explainer (reached only via the hidden debug menu) may remain a blocking dialog — `showErrorDialog()` or a plain info variant is fine.
- All other `alert()`/`confirm()` sites: migrate per message meaning (toast for success/info, error dialog for failure, confirm dialog for yes/no questions).

After migration, grep `app.js` for `"alert("` and `"confirm("` to confirm none remain except any intentionally-kept one (the debug info explainer, if kept as a dialog).

### TASK B3 — Optional: subtle haptic feedback
- `@capacitor/haptics` is not installed (confirmed: absent from `package.json`). If time permits, add it and trigger a light haptic on toast appearance, confirm-dialog buttons, and successful purchase/restore. Non-blocking — skip if it risks destabilizing this round.

---

## PART C — SMART NATIVE REVIEW REQUEST

### TASK C1 — Install the native review plugin
- `npm install @capacitor-community/in-app-review` (confirmed: not currently installed)
- `npx cap sync ios android`
- Follow the plugin's own README for any required native setup steps.

### TASK C2 — Track meaningful usage signals
Use the existing `SafeStorage` wrapper, consistent with `isubnet_debug`/`isubnet_dark_mode`. New keys, prefixed `isubnet_review_`:
- `isubnet_review_calc_count` — integer, total genuine successful calculations.
- `isubnet_review_session_count` — integer, distinct app launches.
- `isubnet_review_requested` — boolean, true once the OS review flow has been triggered.
- `isubnet_review_requested_date` — ISO timestamp, for a possible future "re-ask after major update" feature (not built in this round).

Increment `isubnet_review_calc_count` inside `recordHistoryDebounced()` (verified: line 1828) — it already fires exactly once per genuine calculation across IPv4/IPv6/Converter/Splitter, with dedup already handled there.
Increment `isubnet_review_session_count` inside `init()` (verified: line 4514), once per cold start.

### TASK C3 — Eligibility check + trigger points
Create `maybeRequestReview()` that:
1. No-ops immediately if `isubnet_review_requested` is already true.
2. Otherwise checks if ANY of:
   a. `isubnet_review_calc_count >= 6` AND `isubnet_review_session_count >= 2` (named constant `REVIEW_PROMPT_CALC_THRESHOLD = 6`).
   b. `isubnet_review_session_count >= 3` (independent of calc count).
   c. The calculation that just completed was a VLSM split — inside the Splitter success path, check `currentSplitMethod` for the VLSM value — trigger immediately regardless of thresholds, even in session 1.
   d. The user explicitly tapped a "Save to Notes" button — hook `maybeRequestReview()` into the specific button handlers (`saveSplitNote()`, verified at line 3494, and the equivalent explicit save-note handlers for IPv4/IPv6/Converter results), NOT generically into `addNote()` itself (verified: line 1601). `addNote()` is also called automatically by the Splitter's background full-results auto-save (`triggerFullSplitAutoSave()`, verified: line 1615) — that path must NOT trigger a review request, since it isn't a deliberate user action.
3. If eligible, call the plugin's request method, then immediately persist `isubnet_review_requested = true` and `isubnet_review_requested_date`, regardless of whether the plugin confirms UI was shown (OS-side throttling is expected).

Wire `maybeRequestReview()` to run at the end of `recordHistoryDebounced()` (covers threshold checks and the VLSM immediate trigger) and from the explicit save-note button handlers per (d) above. Do NOT call it from `init()`/app launch directly.

### TASK C4 — Don't ask again
- Once `isubnet_review_requested` is true, `maybeRequestReview()` must no-op permanently for this install.
- Do NOT build version-based re-asking in this round.

---

## PART D — FIREBASE CRASHLYTICS (CRASH ANALYTICS)

> ✅ **Unblocked — see "Corrections made" #4.** Both `android/app/google-services.json` and `ios/App/App/GoogleService-Info.plist` were missing when this round was drafted; both are now present and confirmed directly against the live project, with bundle/package IDs matching the app (`com.banzaigr.isubnet`) on both platforms. Task D0 below should still be run, but only as a quick confirmation before D1–D3 — it's expected to pass.

### TASK D0 — PREREQUISITE CHECK (do this first)
- Check for `android/app/google-services.json` and `ios/App/App/GoogleService-Info.plist`. **Confirmed present as of this writing**, with package/bundle ID `com.banzaigr.isubnet` matching the app on both platforms — this should pass immediately. If either file is missing or the ID doesn't match when you actually start, STOP Part D here and report back rather than proceeding; don't assume this document's confirmation still holds indefinitely.

### TASK D1 — Install native Firebase + Crashlytics plugins
- `npm install @capacitor-firebase/app @capacitor-firebase/crashlytics` (confirmed: neither currently installed)
- Follow the official `@capacitor-firebase/crashlytics` README precisely for the current required native setup on both platforms (Android: Google services Gradle plugin + Crashlytics Gradle plugin; iOS: CocoaPods entries via `npx cap sync ios`). Do not guess at Gradle/CocoaPods syntax from memory if it conflicts with what the plugin's own docs currently specify.
- For iOS: `GoogleService-Info.plist` must be referenced as a bundled resource in `project.pbxproj`, not just present in the folder. No local Xcode access (builds go through Ionic Appflow) — be extra careful editing `project.pbxproj` by hand; mirror the existing pattern used for another bundled resource file in the same pbxproj if one exists.
- Verify whether Firebase needs explicit initialization on iOS: check if the plugin's README requires a `FirebaseApp.configure()` call added to `ios/App/App/AppDelegate.swift`. This project uses the standard Capacitor UIKit AppDelegate lifecycle (a plain Swift class conforming to `UIApplicationDelegate`, with its own `didFinishLaunchingWithOptions` method) — there is no SwiftUI `App` struct anywhere in this project. If required, add it inside that existing `didFinishLaunchingWithOptions` method.

### TASK D2 — Also install @capacitor/app
- `npm install @capacitor/app` (confirmed: not currently installed); `npx cap sync ios android`.
- Use `App.getInfo()` to read the running native app version/build at runtime where needed below.

### TASK D3 — Wire up crash/error capture
- Global JS error capture: add `window.addEventListener('error', ...)` and `window.addEventListener('unhandledrejection', ...)` handlers that call `Crashlytics.recordException()` with the error's message/stack. Native crashes are captured automatically by the native SDK — no JS needed for those.
- Breadcrumb context: before/around the main calculation operations (`calculateIPv4` — verified line 912, `calculateIPv6` — verified line 1416, `runSplitter` — verified line 3111), call `Crashlytics.setCustomKey()` or `Crashlytics.log()` with structural context only, e.g. `screen: "vlsm"`, `operation: "calculate"`, `app_version:` (from Task D2's `App.getInfo()`). Also log a lightweight breadcrumb on tab switches.
- PRIVACY RULE: never send actual user input values to Crashlytics. No IP addresses, subnet values, CIDR blocks, note contents, or account emails in any breadcrumb, custom key, or exception message. Only structural/contextual info.
- At each catch block you touch in Task B2 (especially the `updateRevenueCatSubscriptionState()` site at line 526), call `Crashlytics.recordException()` (or `.log()` with the sanitized error) alongside the existing `debugLog()` call and the new `showErrorDialog()` call.

---

## PART E — VERSION / BUILD BUMP

### TASK E1 — Bump version AND build number (corrected — see "Corrections made" #1–3)
- **Before starting this task, confirm the build-73 baseline is actually in place, and check current live-store status before assuming 1.1.17 is still the right target.** `android/app/build.gradle` should read `versionCode 73` / `versionName "1.1.16"`, and `ios/App/App.xcodeproj/project.pbxproj` should read `CURRENT_PROJECT_VERSION = 73` / `MARKETING_VERSION = 1.1.16` (both occurrences on iOS) — this was directly verified against the live project, and 1.1.16 was confirmed live on both the App Store and Google Play at that time. If the baseline numbers don't match when you start, or if a version newer than 1.1.16 has since gone live (e.g. this round shipped once already, or something else did), stop and confirm the correct target with the team rather than assuming this document's snapshot still holds.
- **Android:** `android/app/build.gradle` — bump `versionCode` from **73 to 74** and `versionName` from `"1.1.16"` to `"1.1.17"`.
- **iOS:** `ios/App/App.xcodeproj/project.pbxproj` — bump `CURRENT_PROJECT_VERSION` from **73 to 74** and `MARKETING_VERSION` from `1.1.16` to `1.1.17` (both occurrences on both build configs).
- Do NOT touch `package.json`'s `"version"` field beyond keeping it in sync — cosmetic, unused by either store, but update it to `"1.1.17"` to match.
- Update the version footer text in `index.html` (confirmed to currently read `iSubnet v1.1.16 (Build 73)`) to **`iSubnet v1.1.17 (Build 74)`**.

---

## PART F — TWO FOLLOW-UP FIXES (NEW, POST-BUILD-70)

### TASK F1 — Remove duplicate "tap to copy" text
This was requested once already but didn't make it into build 70 — confirmed still present, unfixed, at `index.html` line 233:
```diff
- <span>RevenueCat User ID (tap to copy)</span>
+ <span>RevenueCat User ID</span>
```
The status span next to it already dynamically shows "Tap to copy" / "Loading..." / "Unavailable", so the label doesn't need to repeat it. No other changes needed.

### TASK F2 — Instrument the Number Base Converter for debug logging
The Converter tab has two separate features: the Wildcard & Prefix Converter (`#converter-input`, routes through `runConverter()`, already logged via `logConverterDebounced()`) and, below it, the Number Base Converter (Binary/Octal/Decimal/Hex fields), which routes through `runBaseConverter(sourceId, fromBase)` (verified line 2456) and currently has **no** debug logging — confirmed `logBaseConverterDebounced` does not exist anywhere in `app.js` yet.

Add this logger near the other debounced loggers (`logCalcV4Debounced` line 237, `logCalcV6Debounced` line 257, `logSplitterDebounced` line 277, `logConverterDebounced` line 297 — put this one alongside them):
```js
let _baseConverterLogTimeout = null;
function logBaseConverterDebounced(sourceId) {
  if (!window.APP_DEBUG_ENABLED) return;
  if (_baseConverterLogTimeout) clearTimeout(_baseConverterLogTimeout);
  _baseConverterLogTimeout = setTimeout(() => {
    const errorEl = document.getElementById(`base-${sourceId}-error`);
    const errText = errorEl ? errorEl.textContent : '';
    const sourceEl = document.getElementById(`base-${sourceId}-input`);
    const value = sourceEl ? sourceEl.value : '';
    if (errText) {
      window.debugLog(`Base Converter: source=${sourceId} value="${value}" ERROR: ${errText}`);
    } else if (value) {
      const bin = document.getElementById('base-bin-input')?.value || '';
      const dec = document.getElementById('base-dec-input')?.value || '';
      const hex = document.getElementById('base-hex-input')?.value || '';
      window.debugLog(`Base Converter: source=${sourceId} value="${value}" -> bin=${bin} dec=${dec} hex=${hex}`);
    }
  }, 800);
}
```

Then call it as the very first line inside `runBaseConverter(sourceId, fromBase)` (verified line 2456), **before** the existing guard:
```diff
  function runBaseConverter(sourceId, fromBase) {
+   logBaseConverterDebounced(sourceId);
    if (_baseConverting) return;
    _baseConverting = true;
    ...
```

**Landing order with Task A6:** both this task and Task A6 edit `runBaseConverter()`. Put F2's logger call in first (literal first line, ahead of the `_baseConverting` guard) so debug logs capture every attempt including ones a non-Pro user makes against the locked Hex field; then apply A6's Pro-gating further down at the `inputs.hex.value = result.hex` write. Do this as one combined edit to the function, not two separate passes that might overwrite each other.

After both fixes: the "tap to copy" label appears once, and typing in any of the four Number Base Converter fields (Binary/Octal/Decimal/Hex), pausing ~1 second, produces a log entry the same way the other calculator features do — including for a non-Pro user typing into the now-locked Hex field.

---

## DO NOT TOUCH (already correct / verified working)
- Tablet layout CSS fix.
- Auth-gate removal in `purchaseProductByPlan()` — purchases stay account-optional.
- Restore Purchases logic (both entry points — Pro modal and Settings) and its RevenueCat result-unwrapping (`result.customerInfo || result`).
- Post-purchase sync-nudge modal (`#sync-nudge-modal`).
- CSV/PDF export hard-gating logic itself — only visual/markup changes per Task A5.
- `recordHistoryDebounced()`'s and `addNote()`'s existing dedup/persist logic.
- Binary/Octal/Decimal fields in the Base Converter — only Hex is affected by Task A6.
- Settings modal scroll/sticky-header fix, Splitter IPv6 paste-detection fix, Splitter full-results-to-notes auto-save feature, Android R8/ProGuard obfuscation, and the hidden Debug Logging gesture — all already implemented in earlier rounds.
- Everything covered by build 73 (`iSubnet_build73_implementation_prompt.md`): the Converter/IPv4/VLSM keyboard `inputmode` fixes, the Splitter Equal/VLSM highlight, and the History-tab CSS-variable fix. Already shipped, already verified against the live project — do not redo, re-check, or re-verify any of it here.

---

## VERIFICATION STEPS (report back on each, grouped by part)

**Part A:** `FREE_NOTES_LIMIT=3`/`FREE_HISTORY_LIMIT=4` confirmed; `current-plan-desc` updated; Share watermark applies only when `!PRO_UNLOCKED` and Share stays functional for free users; Pro features list/blurb match the new order/copy; all four Bulk export buttons now carry `pro-feature-btn`/`data-pro`, Pro badge visible before tap on all such buttons, `applyProState()` generalized via `querySelectorAll`; Base Converter's Hex field is locked/masked for non-Pro users while Bin/Oct/Dec stay fully functional, and Hex unlocks immediately on upgrade without a reload.

**Part B:** grep confirms no remaining `alert()`/`confirm()` except any intentionally-kept one (28 sites migrated, including the 2 new RevenueCat-copy ones); the debug-logging reminder is now an interactive confirm dialog; the former stack-trace-exposing alert no longer shows `err.stack` to the user (full error still in debug log + Crashlytics); `confirm()`-derived flows still correctly gate on the resolved Promise boolean with no regression.

**Part C:** plugin installs and syncs cleanly; calc/session counters persist across restarts; a VLSM split triggers review request immediately regardless of thresholds; tapping an explicit Save-to-Notes button triggers the eligibility check, but the Splitter's automatic background full-results auto-save does NOT; once `isubnet_review_requested` is true, no further calls to the native API happen.

**Part D:** confirmed both Firebase config files are present and ID-matched (Task D0 passed); confirm `FirebaseApp.configure()` (or equivalent) was added to `AppDelegate.swift` if required; confirm the app still builds on both platforms; confirm no user-entered data appears in any Crashlytics breadcrumb/custom key/exception message; confirm global JS error handlers are wired.

**Part E:** confirmed the build-73 baseline (versionCode/CURRENT_PROJECT_VERSION 73, versionName/MARKETING_VERSION 1.1.16 on both platforms) was in place before bumping, and confirmed 1.1.16's live-store status before committing to 1.1.17 as the target; Android `versionCode` = 74, `versionName` = "1.1.17"; iOS `CURRENT_PROJECT_VERSION` = 74, `MARKETING_VERSION` = 1.1.17 (both occurrences on both platforms); version footer reads "iSubnet v1.1.17 (Build 74)"; `package.json` version reads "1.1.17" for consistency.

**Part F:** `index.html` line 233 area now reads just "RevenueCat User ID" with no duplicate "tap to copy"; typing in any of the four Number Base Converter fields and pausing ~1s produces a debug log entry, including when a non-Pro user types into the (now-locked) Hex field.

## FINAL SANITY CHECK
- `node -c app.js`
- `npx cap sync ios` and `npx cap sync android`
- Provide a full list of every file changed and line ranges touched, so each part can be verified directly against source before device testing.
