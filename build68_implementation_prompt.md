# iSubnet — Build 68 Implementation Prompt

Context: this is a Capacitor 8 app (`com.banzaigr.isubnet`), currently at versionCode 67 / versionName 1.1.14 in production. The changes below should ship together as **versionCode 68**. Apply all changes, then run `npx cap sync android` (and `npx cap sync ios` if iOS is being rebuilt too) before building.

---

## 1. Fix Android 15+ edge-to-edge Play Console warnings

**Problem:** Play Console flags "Edge-to-edge may not display for all users" and "Your app uses deprecated APIs or parameters for edge-to-edge" on the production release (build 67, targetSdk 36). Root cause: `app.js`'s `updateNativeStatusBar()` calls `StatusBar.setBackgroundColor()`, which internally invokes Android's deprecated `Window.setStatusBarColor()`. Ionic's own team confirms there is no fix version of `@capacitor/status-bar` coming — the supported path forward is Capacitor 8's `SystemBars` API (bundled in `@capacitor/core`), which only exposes `setStyle()` (icon color), not background coloring.

**Changes:**

1. Remove the dependency in `package.json`:
   ```diff
   - "@capacitor/status-bar": "^8.0.2",
   ```

2. In `app.js`, replace the body of `updateNativeStatusBar()` (currently ~line 3467) to use `SystemBars` instead of `StatusBar`:
   ```js
   function updateNativeStatusBar(isDark) {
     try {
       if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SystemBars) {
         const SystemBars = window.Capacitor.Plugins.SystemBars;
         SystemBars.setStyle({ style: isDark ? 'DARK' : 'LIGHT' });
       }
     } catch (e) {
       console.error('Failed to update native SystemBars', e);
     }
   }
   ```

3. In `styles.css`, add safe-area padding to whatever element sits at the very top of the page (header/top container) and, if there's a bottom nav/tab bar, the bottom equivalent — since content now draws behind the system bars instead of being pushed down by them:
   ```css
   /* adjust selector to match the actual top-level header/container */
   .app-header {
     padding-top: env(safe-area-inset-top);
   }
   /* only if there's a bottom bar */
   .bottom-nav {
     padding-bottom: env(safe-area-inset-bottom);
   }
   ```
   Keep the existing background colors on these elements (`#0f1524` dark / `#f8fafc` light, matching the old `setBackgroundColor` values) so the status bar area still reads as "colored" — it'll show through since the webview now extends behind it.

4. Verify visually on an Android 15+ emulator/device in both light and dark theme: nothing should be clipped or overlapped by the status bar or navigation bar.

---

## 2. Fix debug log notes not appearing until app restart

**Problem:** For signed-in users, `syncNotesToFirebase()` (in `app.js`, ~line 150-168) does a Firestore `.get()` and then **replaces** the entire in-memory `notes` array with the result (`notes = remoteNotes;`). If this resolves before a freshly created debug-log note has finished syncing up to Firestore (via `saveNoteToFirebase()`, called from `debugLog()`'s debounce), the new note gets silently wiped from both memory and local storage. It only reappears after an app restart because by then the note has had time to actually land in Firestore.

**Change:** in `syncNotesToFirebase()`, merge remote and local notes instead of overwriting:
```js
function syncNotesToFirebase() {
  if (!useRealFirebase) return;
  const user = firebase.auth().currentUser;
  if (!user) return;

  db.collection("users").doc(user.uid).collection("notes").get().then(snapshot => {
    const remoteNotes = [];
    snapshot.forEach(doc => {
      remoteNotes.push({ id: doc.id, ...doc.data() });
    });
    if (remoteNotes.length > 0) {
      const merged = [...remoteNotes];
      notes.forEach(localNote => {
        if (!merged.find(n => n.id === localNote.id)) {
          merged.push(localNote); // keep local-only notes not yet synced to Firestore
        }
      });
      merged.sort((a, b) => b.id.localeCompare(a.id));
      notes = merged;
      saveNotesToStorage();
      renderNotes();
    }
  }).catch(err => console.error("Error loading notes:", err));
}
```

---

## 3. Show the RevenueCat App User ID under Debug Logging

**Goal:** when debug logging is enabled, display the ID that's searchable in the RevenueCat dashboard (Customers → search by App User ID → Grant entitlement), so support/account issues can be resolved without asking the user to dig for it.

**Important:** use `Purchases.getAppUserID()`, not `currentUserId` (the Firebase UID variable). For signed-in users they're the same value, but for anonymous/not-signed-in users `currentUserId` is just the string `'local'`, which isn't searchable in RevenueCat — `getAppUserID()` always returns RevenueCat's actual ID (its own generated anonymous ID, or the logged-in UID), matching what's in the dashboard either way.

**`index.html`** — add right after the existing `debug-logging-row` div:
```html
<!-- RevenueCat App User ID (for support lookups) -->
<div id="debug-userid-row" class="hidden" style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; font-size: 11px; color: var(--text-secondary);">
  <span>RevenueCat User ID (tap to copy)</span>
  <code id="debug-userid-value" style="font-size: 10px; word-break: break-all; text-align: right; max-width: 60%; cursor: pointer; text-decoration: underline dotted;">—</code>
</div>
```

**`app.js`** — add near `initRevenueCat()` (~line 227):
```js
async function getRevenueCatAppUserId() {
  try {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Purchases) {
      const { Purchases } = window.Capacitor.Plugins;
      const result = await Purchases.getAppUserID();
      return result && result.appUserID ? result.appUserID : null;
    }
  } catch (e) {
    if (typeof window.debugLog === 'function') window.debugLog(`ERROR in getRevenueCatAppUserId: ${e.message}`);
  }
  return null;
}

async function refreshDebugUserIdDisplay() {
  const userIdRow = document.getElementById('debug-userid-row');
  const userIdValue = document.getElementById('debug-userid-value');
  if (!userIdRow || !userIdValue) return;

  if (!window.APP_DEBUG_ENABLED) {
    userIdRow.classList.add('hidden');
    return;
  }
  userIdRow.classList.remove('hidden');
  userIdValue.textContent = 'Loading…';
  const appUserId = await getRevenueCatAppUserId();
  userIdValue.textContent = appUserId || 'Unavailable (RevenueCat not ready yet)';
  if (appUserId && typeof window.debugLog === 'function') {
    window.debugLog(`RevenueCat App User ID: ${appUserId}`);
  }
}
window.refreshDebugUserIdDisplay = refreshDebugUserIdDisplay;
```

Hook it into the existing checkbox handler (replace the current `chkDebugLog.addEventListener('change', ...)` block, ~line 4410-4430):
```js
if (chkDebugLog) {
  chkDebugLog.checked = window.APP_DEBUG_ENABLED;
  chkDebugLog.addEventListener('change', (e) => {
    window.APP_DEBUG_ENABLED = e.target.checked;
    SafeStorage.setItem('isubnet_debug', window.APP_DEBUG_ENABLED ? 'true' : 'false');

    if (window.APP_DEBUG_ENABLED) {
      window.APP_DEBUG_START_TIME = Date.now();
      SafeStorage.setItem('isubnet_debug_start', window.APP_DEBUG_START_TIME.toString());
      window._debugReminderInterval = setInterval(window.checkDebugReminder, 60000);
      window._debugReminded10 = false;
      window._debugRemindedIntervals = 0;
      debugLog("=== DEBUG LOGGING ENABLED ===");
    } else {
      if (window._debugReminderInterval) clearInterval(window._debugReminderInterval);
      debugLog("=== DEBUG LOGGING DISABLED ===");
      window.APP_DEBUG_CURRENT_NOTE_ID = null;
      SafeStorage.removeItem('isubnet_debug_note_id');
    }
    refreshDebugUserIdDisplay();
  });
}
```

And populate it on cold start too, for users who already had debug logging on from a previous session (near the existing `setTimeout(initRevenueCat, 800);`, ~line 4448):
```js
setTimeout(initRevenueCat, 800);
setTimeout(refreshDebugUserIdDisplay, 1200); // after RevenueCat has had time to configure()
```

---

## 4. Tap-to-copy the User ID (Option B: `@capacitor/clipboard`)

**Install:**
```
npm install @capacitor/clipboard
npx cap sync
```

**`app.js`** — add a click handler on the ID element (place alongside the code from Section 3):
```js
const userIdValueEl = document.getElementById('debug-userid-value');
if (userIdValueEl) {
  userIdValueEl.addEventListener('click', async () => {
    const text = userIdValueEl.textContent;
    if (!text || text === 'Loading…' || text.startsWith('Unavailable')) return;
    try {
      const { Clipboard } = window.Capacitor.Plugins;
      await Clipboard.write({ string: text });
      alert('User ID copied to clipboard.');
    } catch (e) {
      alert('Could not copy automatically. Long-press the ID above to select and copy it manually.');
      if (typeof window.debugLog === 'function') window.debugLog(`Clipboard copy failed: ${e.message}`);
    }
  });
}
```

No native project changes needed beyond the standard `npx cap sync` — this is a small, standard Capacitor core-team plugin (CocoaPods on iOS, Gradle on Android).

---

## 5. R8 optimisation (already applied — verify it's included)

`android/gradle.properties` has already been updated for this build:
```diff
- android.r8.strictFullModeForKeepRules=false
- android.r8.optimizedResourceShrinking=false
+ android.r8.strictFullModeForKeepRules=true
+ android.r8.optimizedResourceShrinking=true
```
No further action needed — just confirm this is present when building 68.

---

## 6. Version bump

In `android/app/build.gradle`:
```diff
- versionCode 67
- versionName "1.1.14"
+ versionCode 68
+ versionName "1.1.15"
```
(Bump `versionName` since this build includes user-visible/behavioral fixes, not just internal changes — adjust if you'd rather keep it at 1.1.14 and only bump the build number.)

---

## Testing checklist before shipping build 68

- [ ] Android 15+ device/emulator: status bar and nav bar render correctly (colored area still looks colored, no content clipped) in both light and dark theme.
- [ ] Play Console pre-launch report / bundle explorer no longer flags the edge-to-edge or R8 warnings for the new build.
- [ ] Sign in with a test account, enable debug logging, trigger some actions, confirm the debug log note appears in the Notes tab **without restarting the app**.
- [ ] With debug logging on, confirm the RevenueCat User ID row appears and shows a real ID (not "Unavailable"), for both a signed-in account and (separately) a fresh anonymous install.
- [ ] Tap the User ID, confirm a "copied to clipboard" confirmation appears, and paste it somewhere to verify the value is correct and matches what's searchable in the RevenueCat dashboard.
- [ ] Toggle debug logging off and back on; confirm the User ID row hides/reappears correctly and doesn't error.
