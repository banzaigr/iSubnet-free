// --- Theme Mode Cache Recovery (Prevents Flash) ---
(function() {
  
// --- CRASHLYTICS GLOBAL ERROR HANDLERS ---
window.addEventListener('error', async (event) => {
  if (window.Capacitor && window.Capacitor.Plugins.FirebaseCrashlytics) {
    try {
      await window.Capacitor.Plugins.FirebaseCrashlytics.recordException({
        message: event.message || 'Unknown Error',
        stacktrace: event.error ? event.error.stack : ''
      });
    } catch(e) {}
  }
});
window.addEventListener('unhandledrejection', async (event) => {
  if (window.Capacitor && window.Capacitor.Plugins.FirebaseCrashlytics) {
    try {
      await window.Capacitor.Plugins.FirebaseCrashlytics.recordException({
        message: event.reason ? event.reason.toString() : 'Unhandled Rejection',
        stacktrace: event.reason && event.reason.stack ? event.reason.stack : ''
      });
    } catch(e) {}
  }
});

// --- PERMANENT DEBUG LOGGING FEATURE ---
window.APP_DEBUG_ENABLED = false; // Initialized after SafeStorage is defined
window.APP_DEBUG_START_TIME = 0;
window.APP_DEBUG_CURRENT_NOTE_ID = null;
window._debugSaveTimeout = null;
window._debugReminderInterval = null;
window._debugReminded10 = false;
window._debugRemindedIntervals = 0;
window._debugQueue = window._debugQueue || [];

function debugLog(message) {
  if (!window.APP_DEBUG_ENABLED) return;
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
  const entry = `[${timeStr}] ${message}\n`;
  console.log(entry.trim());
  
  window._debugQueue.push(entry);
  
  let notesAvailable = false;
  try {
    notesAvailable = !!notes; // Safely check for Temporal Dead Zone
  } catch(e) {
    return; // Wait in queue until notes array is initialized
  }
  if (!notesAvailable) return;
  
  let currentNote = window.APP_DEBUG_CURRENT_NOTE_ID ? notes.find(n => n.id === window.APP_DEBUG_CURRENT_NOTE_ID) : null;
  
  while (window._debugQueue.length > 0) {
    const qEntry = window._debugQueue.shift();
    if (!currentNote || currentNote.content.length > 25000) {
      window.APP_DEBUG_CURRENT_NOTE_ID = String(Date.now());
      SafeStorage.setItem('isubnet_debug_note_id', window.APP_DEBUG_CURRENT_NOTE_ID);
      currentNote = {
        id: window.APP_DEBUG_CURRENT_NOTE_ID,
        date: new Date().toLocaleString(),
        category: 'General',
        title: 'Debug Log ' + new Date().toLocaleString() + (currentNote ? ' (continued)' : ''),
        content: ''
      };
      notes.unshift(currentNote);
    }
    currentNote.content += qEntry;
  }
  
  if (window._debugSaveTimeout) clearTimeout(window._debugSaveTimeout);
  window._debugSaveTimeout = setTimeout(() => {
    window._debugSaveTimeout = null;
    try { if (typeof saveNotesToStorage === 'function') saveNotesToStorage(); } catch(e) {}
    try {
      const noteToSave = (window.APP_DEBUG_CURRENT_NOTE_ID && Array.isArray(notes))
        ? (notes.find(n => n && n.id === window.APP_DEBUG_CURRENT_NOTE_ID) || currentNote)
        : currentNote;
      if (typeof saveNoteToFirebase === 'function' && noteToSave) saveNoteToFirebase(noteToSave);
    } catch(e) {}
  }, 1000);
}

async function checkDebugReminder() {
  if (!window.APP_DEBUG_ENABLED) return;
  const now = Date.now();
  const elapsedMinutes = (now - window.APP_DEBUG_START_TIME) / 60000;
  
  let shouldRemind = false;
  if (elapsedMinutes >= 10 && !window._debugReminded10) {
    shouldRemind = true;
    window._debugReminded10 = true;
  } else if (elapsedMinutes >= 25) {
    const intervalsPassed = Math.floor((elapsedMinutes - 10) / 15);
    if (intervalsPassed > window._debugRemindedIntervals) {
      shouldRemind = true;
      window._debugRemindedIntervals = intervalsPassed;
    }
  }
  
  if (shouldRemind && document.visibilityState === 'visible') {
    const turnOff = await showConfirmDialog(`Debug logging has been on for ${Math.floor(elapsedMinutes)} minutes. Turn it off if you're done reproducing the issue?`, { confirmText: 'Turn Off', cancelText: 'Keep On' });
    if (turnOff) {
      const chk = document.getElementById('chk-debug-log');
      if (chk) chk.click();
    }
  }
}


window.debugLog = debugLog;
window.checkDebugReminder = checkDebugReminder;
// --- END DEBUG LOGGING FEATURE ---
  try {
    const isDark = localStorage.getItem('isubnet_dark_mode') === 'true';
    if (isDark) {
      document.body.classList.add('dark-mode');
    }
    const color = localStorage.getItem('isubnet_theme_color');
    if (color) {
      document.documentElement.style.setProperty('--accent-primary', color);
      // Also set the RGB version so rgba() CSS values update immediately
      const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
      if (r) {
        document.documentElement.style.setProperty('--accent-primary-rgb',
          `${parseInt(r[1],16)}, ${parseInt(r[2],16)}, ${parseInt(r[3],16)}`);
      }
      // Set contrasting bit-off color immediately to prevent flash
      try {
        const _h2h = (hex) => {
          const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          if (!m) return [0, 0, 50];
          let r = parseInt(m[1],16)/255, g = parseInt(m[2],16)/255, b = parseInt(m[3],16)/255;
          const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
          let h = 0, s = 0, l = (max + min) / 2;
          if (d) {
            s = d / (1 - Math.abs(2*l - 1));
            if (max===r) h = ((g-b)/d + 6) % 6;
            else if (max===g) h = (b-r)/d + 2;
            else h = (r-g)/d + 4;
            h = Math.round(h * 60);
          }
          return [h, Math.round(s*100), Math.round(l*100)];
        };
        const [h, s, l] = _h2h(color);
        const offH = (h + 165) % 360;
        const offS = Math.max(10, Math.min(s, 35));
        const offL = l > 55 ? 30 : 68;
        document.documentElement.style.setProperty('--bit-off-color', `hsl(${offH},${offS}%,${offL}%)`);
      } catch(e2) {}
    }
  } catch (e) {}
})();

// --- Firebase Config & Setup ---
const firebaseConfig = {
  apiKey: "AIzaSyAs78BDtw8AUPePSGzLXw9zvHTm_McffUc",
  authDomain: "isubnet-95655.firebaseapp.com",
  projectId: "isubnet-95655",
  storageBucket: "isubnet-95655.firebasestorage.app",
  messagingSenderId: "1207269615",
  appId: "1:1207269615:web:418cd094071db0bdcf031a",
  measurementId: "G-NH673KPHMS"
};

let db = null;
let useRealFirebase = false;

if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  useRealFirebase = true;
}

let currentUserId = 'local';

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
      let updatedDebugNote = null;
      notes.forEach(localNote => {
        const existingIdx = merged.findIndex(n => n.id === localNote.id);
        if (existingIdx === -1) {
          merged.push(localNote); // keep local-only notes not yet synced
        } else if (window.APP_DEBUG_CURRENT_NOTE_ID && localNote.id === window.APP_DEBUG_CURRENT_NOTE_ID &&
                   typeof localNote.content === 'string' &&
                   (!merged[existingIdx].content || localNote.content.length >= merged[existingIdx].content.length)) {
          if (!merged[existingIdx].content || localNote.content.length > merged[existingIdx].content.length) {
            updatedDebugNote = localNote;
          }
          merged[existingIdx] = localNote;
        }
      });
      merged.sort((a, b) => b.id.localeCompare(a.id));
      notes = merged;
      saveNotesToStorage();
      if (updatedDebugNote) saveNoteToFirebase(updatedDebugNote);
      renderNotes();
    }
  }).catch(err => console.error("Error loading notes:", err));
}

function saveNoteToFirebase(note) {
  if (!useRealFirebase) return;
  const user = firebase.auth().currentUser;
  if (!user) return;
  
  db.collection("users").doc(user.uid).collection("notes").doc(note.id).set(note)
    .catch(err => console.error("Error saving note:", err));
}

function deleteNoteFromFirebase(noteId) {
  if (!useRealFirebase) return;
  const user = firebase.auth().currentUser;
  if (!user) return;
  
  db.collection("users").doc(user.uid).collection("notes").doc(noteId).delete()
    .catch(err => console.error("Error deleting note:", err));
}

function syncHistoryToFirebase() {
  if (!useRealFirebase) return;
  const user = firebase.auth().currentUser;
  if (!user) return;
  
  db.collection("users").doc(user.uid).collection("history").get().then(snapshot => {
    const remoteHistory = [];
    snapshot.forEach(doc => {
      remoteHistory.push(doc.data());
    });
    if (remoteHistory.length > 0) {
      // Sort by ID descending (timestamp) to display latest first
      remoteHistory.sort((a, b) => b.id.localeCompare(a.id));
      historyItems = remoteHistory;
      saveHistoryToStorage();
      renderHistory();
    }
  }).catch(err => console.error("Error loading history:", err));
}

function saveHistoryToFirebase(item) {
  if (!useRealFirebase) return;
  const user = firebase.auth().currentUser;
  if (!user) return;
  
  const docId = String(item.timestamp || Date.now());
  db.collection("users").doc(user.uid).collection("history").doc(docId).set(item)
    .catch(err => console.error("Error saving history:", err));
}

function clearHistoryFromFirebase() {
  if (!useRealFirebase) return;
  const user = firebase.auth().currentUser;
  if (!user) return;
  
  db.collection("users").doc(user.uid).collection("history").get().then(snapshot => {
    snapshot.forEach(doc => doc.ref.delete());
  }).catch(err => console.error("Error clearing history:", err));
}

// --- RevenueCat SDK integration ---
let useRevenueCat = false;

let _calcV4LogTimeout = null;
function logCalcV4Debounced() {
  if (!window.APP_DEBUG_ENABLED) return;
  if (_calcV4LogTimeout) clearTimeout(_calcV4LogTimeout);
  _calcV4LogTimeout = setTimeout(() => {
    const errorEl = document.getElementById('ipv4-error');
    const errText = errorEl ? errorEl.textContent : '';
    const addr = document.getElementById('ipv4-address').value;
    const cidr = document.getElementById('ipv4-cidr').value;
    if (errText) {
      window.debugLog(`IPv4 Calculate: input="${addr}" ERROR: ${errText}`);
    } else {
      const resultsCard = document.getElementById('ipv4-results');
      if (resultsCard && !resultsCard.classList.contains('hidden')) {
        window.debugLog(`IPv4 Calculate: input="${addr}" cidr="${cidr}" -> success`);
      }
    }
  }, 800);
}

let _calcV6LogTimeout = null;
function logCalcV6Debounced() {
  if (!window.APP_DEBUG_ENABLED) return;
  if (_calcV6LogTimeout) clearTimeout(_calcV6LogTimeout);
  _calcV6LogTimeout = setTimeout(() => {
    const errorEl = document.getElementById('ipv6-error');
    const errText = errorEl ? errorEl.textContent : '';
    const addr = document.getElementById('ipv6-address').value;
    const cidr = document.getElementById('ipv6-cidr').value;
    if (errText) {
      window.debugLog(`IPv6 Calculate: input="${addr}" ERROR: ${errText}`);
    } else {
      const resultsCard = document.getElementById('ipv6-results');
      if (resultsCard && !resultsCard.classList.contains('hidden')) {
        window.debugLog(`IPv6 Calculate: input="${addr}" cidr="${cidr}" -> success`);
      }
    }
  }, 800);
}

let _splitterLogTimeout = null;
function logSplitterDebounced() {
  if (!window.APP_DEBUG_ENABLED) return;
  if (_splitterLogTimeout) clearTimeout(_splitterLogTimeout);
  _splitterLogTimeout = setTimeout(() => {
    const errorEl = document.getElementById('split-error');
    const errText = errorEl ? errorEl.textContent : '';
    const baseIp = document.getElementById('split-base-ip').value;
    const baseCidr = document.getElementById('split-base-cidr').value;
    if (errText) {
      window.debugLog(`Splitter: base="${baseIp}/${baseCidr}" ERROR: ${errText}`);
    } else {
      const resultsCard = document.getElementById('split-results');
      if (resultsCard && !resultsCard.classList.contains('hidden')) {
        window.debugLog(`Splitter: base="${baseIp}/${baseCidr}" -> success`);
      }
    }
  }, 800);
}

let _converterLogTimeout = null;
function logConverterDebounced() {
  if (!window.APP_DEBUG_ENABLED) return;
  if (_converterLogTimeout) clearTimeout(_converterLogTimeout);
  _converterLogTimeout = setTimeout(() => {
    const errorEl = document.getElementById('converter-error');
    const errText = errorEl ? errorEl.textContent : '';
    const input = document.getElementById('converter-input').value;
    if (errText) {
      window.debugLog(`Converter: input="${input}" ERROR: ${errText}`);
    } else {
      const resultsDiv = document.getElementById('converter-results');
      if (resultsDiv && !resultsDiv.classList.contains('hidden')) {
        window.debugLog(`Converter: input="${input}" -> success`);
      }
    }
  }, 800);
}

let _cachedRevenueCatAppUserId = null;
let _lastLoggedRcProState = null;
let _lastLoggedRcOfferingsSig = null;

function maskEmailForLog(email) {
  if (email === null || email === undefined) return '(empty)';
  const s = String(email).trim();
  if (!s) return '(empty)';
  const atIdx = s.indexOf('@');
  if (atIdx <= 0 || atIdx === s.length - 1 || s.indexOf('@', atIdx + 1) !== -1) {
    return '(invalid)';
  }
  const local = s.slice(0, atIdx);
  const domain = s.slice(atIdx + 1);
  if (local.length <= 2) {
    return `${local.charAt(0)}***@${domain}`;
  }
  return `${local.charAt(0)}***${local.charAt(local.length - 1)}@${domain}`;
}
window.maskEmailForLog = maskEmailForLog;

function maskUidForLog(uid) {
  if (uid === null || uid === undefined || uid === '') return 'null';
  const s = String(uid).trim();
  if (!s || s === 'null') return 'null';
  if (s.length <= 4) return `${s}...`;
  return `${s.slice(0, 4)}...`;
}
window.maskUidForLog = maskUidForLog;

function sanitizeErrorForLog(errOrMsg, knownEmail) {
  let msg = (errOrMsg && typeof errOrMsg === 'object' && 'message' in errOrMsg)
    ? String(errOrMsg.message)
    : String(errOrMsg || '');
  if (knownEmail && typeof knownEmail === 'string' && knownEmail.trim()) {
    const trimmed = knownEmail.trim();
    const masked = maskEmailForLog(trimmed);
    msg = msg.split(trimmed).join(masked);
  }
  msg = msg.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => maskEmailForLog(m));
  return msg;
}
window.sanitizeErrorForLog = sanitizeErrorForLog;

async function getRevenueCatAppUserId() {
  try {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Purchases) {
      const { Purchases } = window.Capacitor.Plugins;
      const result = await Purchases.getAppUserID();
      return result && result.appUserID ? result.appUserID : null;
    }
  } catch (e) {
    if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
      window.debugLog(`ERROR in getRevenueCatAppUserId: ${sanitizeErrorForLog(e)}`);
    }
  }
  return null;
}

// --- RevenueCat identity sync ---
// If a Firebase user is signed in but RevenueCat is still on a different (anonymous) ID,
// log in to RevenueCat with the Firebase UID. This covers a login that failed (for example no
// connection at sign-in) or was skipped because RevenueCat was not ready yet.
// Returns 'skip' (nothing to do), 'ok' (already correct), 'loggedIn' or 'failed'.
let _rcIdentityPromise = null;
let _rcIdentityRetryTimer = null;
let _rcIdentityRetryCount = 0;

function rcIdentityLog(msg) {
  if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
    window.debugLog(`RevenueCat identity: ${msg}`);
  }
}

async function ensureRevenueCatIdentity(reason) {
  if (!useRevenueCat || typeof useRealFirebase === 'undefined' || !useRealFirebase) return 'skip';
  if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.Purchases) return 'skip';
  if (typeof firebase === 'undefined' || !firebase.auth) return 'skip';
  const user = firebase.auth().currentUser;
  if (!user) return 'skip';
  if (_rcIdentityPromise) return _rcIdentityPromise;
  _rcIdentityPromise = (async () => {
    try {
      const { Purchases } = window.Capacitor.Plugins;
      const current = await getRevenueCatAppUserId();
      if (current === null) return 'skip';
      if (current === user.uid) {
        _rcIdentityRetryCount = 0;
        return 'ok';
      }
      if (window.APP_DEBUG_ENABLED) {
        rcIdentityLog(`signed in as ${maskUidForLog(user.uid)} but RevenueCat user is ${maskUidForLog(current)} (${reason}) - logging in`);
      }
      await Purchases.logIn({ appUserID: user.uid });
      try { await Purchases.setEmail({ email: user.email }); } catch (e) { /* ignore */ }
      try { await Purchases.setDisplayName({ displayName: user.displayName || (user.email ? user.email.split('@')[0] : '') }); } catch (e) { /* ignore */ }
      if (window.APP_DEBUG_ENABLED) {
        rcIdentityLog(`logIn succeeded (${reason})`);
      }
      _rcIdentityRetryCount = 0;
      return 'loggedIn';
    } catch (e) {
      if (window.APP_DEBUG_ENABLED) {
        rcIdentityLog(`logIn failed (${reason}): ${sanitizeErrorForLog(e, user && user.email)}`);
      }
      scheduleRevenueCatIdentityRetry(reason);
      return 'failed';
    } finally {
      _rcIdentityPromise = null;
    }
  })();
  return _rcIdentityPromise;
}

function scheduleRevenueCatIdentityRetry(reason) {
  if (_rcIdentityRetryTimer || _rcIdentityRetryCount >= 3) return;
  const delays = [15000, 60000, 180000];
  const delay = delays[_rcIdentityRetryCount];
  _rcIdentityRetryCount++;
  if (window.APP_DEBUG_ENABLED) {
    rcIdentityLog(`retry ${_rcIdentityRetryCount} of 3 in ${delay / 1000}s (${reason})`);
  }
  _rcIdentityRetryTimer = setTimeout(() => {
    _rcIdentityRetryTimer = null;
    syncRevenueCatIdentity('retry');
  }, delay);
}

async function syncRevenueCatIdentity(reason) {
  const result = await ensureRevenueCatIdentity(reason);
  if (result === 'loggedIn') updateRevenueCatSubscriptionState();
  return result;
}

window.addEventListener('online', () => { syncRevenueCatIdentity('network back'); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') syncRevenueCatIdentity('app visible');
});

async function refreshDebugUserIdDisplay() {
  const userIdRow = document.getElementById('debug-userid-row');
  const userIdStatus = document.getElementById('debug-userid-status');
  if (!userIdRow || !userIdStatus) return;

  if (!window.APP_DEBUG_ENABLED) {
    userIdRow.classList.add('hidden');
    _cachedRevenueCatAppUserId = null;
    return;
  }
  userIdRow.classList.remove('hidden');
  userIdStatus.textContent = 'Loading...';
  const appUserId = await getRevenueCatAppUserId();
  _cachedRevenueCatAppUserId = appUserId;
  userIdStatus.textContent = appUserId ? 'Tap to copy' : 'Unavailable';
  if (appUserId && window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
    window.debugLog(`RevenueCat App User ID: ${maskUidForLog(appUserId)}`);
  }
}
window.refreshDebugUserIdDisplay = refreshDebugUserIdDisplay;

const userIdRowEl = document.getElementById('debug-userid-row');
if (userIdRowEl) {
  userIdRowEl.addEventListener('click', async () => {
    if (!_cachedRevenueCatAppUserId) return;
    try {
      const { Clipboard } = window.Capacitor.Plugins;
      await Clipboard.write({ string: _cachedRevenueCatAppUserId });
      showToast('User ID copied to clipboard.');
    } catch (e) {
      showErrorDialog('Could not copy automatically. Long-press the ID above to select and copy it manually.');
      if (typeof window.debugLog === 'function') window.debugLog(`Clipboard copy failed: ${e.message}`);
    }
  });
}

async function initRevenueCat() {
  if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Purchases) {
    try {
      const { Purchases } = window.Capacitor.Plugins;
      
      const apiKeyAndroid = "goog_RVInjInoGNBFdIqhouvUjuchGMr";
      const apiKeyIOS = "appl_SUfiLPJdWqXeKDCpSWbiOIkTHcx";
      
      if (apiKeyAndroid === "goog_YOUR_API_KEY") {
        console.log("RevenueCat using mock mode");
        return;
      }
      
      const apiKey = window.Capacitor.getPlatform() === 'ios' ? apiKeyIOS : apiKeyAndroid;
      
      if (typeof window.debugLog === 'function') window.debugLog(`RevenueCat: configure() called`);
      Purchases.configure({ apiKey });
      
      useRevenueCat = true;
      console.log("RevenueCat initialized successfully!");
      syncRevenueCatIdentity('startup');
      updateRevenueCatSubscriptionState();
      fetchAndDisplayOfferings();

    } catch(err) {
      console.error("RevenueCat Init Error:", err);
      // Even on failure, we proceed so fallback UI can render
      useRevenueCat = true; 
      updateRevenueCatSubscriptionState();
      fetchAndDisplayOfferings(); 
    }
  } else {
    fetchAndDisplayOfferings();
  }
}

async function fetchAndDisplayOfferings() {
  const isNative = window.Capacitor && window.Capacitor.getPlatform && (window.Capacitor.getPlatform() === 'ios' || window.Capacitor.getPlatform() === 'android');
  const btnLifetime = document.getElementById('btn-pro-buy-lifetime');
  const btnYearly = document.getElementById('btn-pro-buy-yearly');
  const btnMonthly = document.getElementById('btn-pro-buy-monthly');

  const enableButtons = (lifetimeText, yearlyText, monthlyText) => {
    if (btnLifetime) { btnLifetime.textContent = lifetimeText; btnLifetime.disabled = false; btnLifetime.style.opacity = '1'; }
    if (btnYearly) { btnYearly.textContent = yearlyText; btnYearly.disabled = false; btnYearly.style.opacity = '1'; }
    if (btnMonthly) { btnMonthly.textContent = monthlyText; btnMonthly.disabled = false; btnMonthly.style.opacity = '1'; }
  };

  if (!isNative) {
    // Enable with mock prices for Browser Demo
    enableButtons('Lifetime Access — €4.99 (Demo)', '€2.49 / Year (Demo)', '€0.49 / Month (Demo)');
    return;
  }

  if (!useRevenueCat) {
    if (btnLifetime) { btnLifetime.textContent = 'Purchases Unavailable'; }
    if (btnYearly) { btnYearly.textContent = 'Offline'; }
    if (btnMonthly) { btnMonthly.textContent = 'Offline'; }
    return;
  }

  try {
    const { Purchases } = window.Capacitor.Plugins;
    
    // Add a 5-second timeout so the buttons never hang indefinitely on native
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("RevenueCat getOfferings timeout")), 5000);
    });
    
    const offerings = await Promise.race([Purchases.getOfferings(), timeoutPromise]);
    const offeringsCount = (offerings && offerings.all) ? Object.keys(offerings.all).length : (offerings && offerings.current ? 1 : 0);
    const packagesCount = (offerings && offerings.current && Array.isArray(offerings.current.availablePackages)) ? offerings.current.availablePackages.length : 0;
    const offeringsSig = `${offeringsCount}:${packagesCount}`;
    if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function' && _lastLoggedRcOfferingsSig !== offeringsSig) {
      _lastLoggedRcOfferingsSig = offeringsSig;
      window.debugLog(`RevenueCat: getOfferings ok | offerings=${offeringsCount} | packages=${packagesCount}`);
    }
    if (offerings.current !== null && offerings.current.availablePackages.length > 0) {
      const packages = offerings.current.availablePackages;
      
      const lifetimePkg = packages.find(p => p.packageType === 'LIFETIME');
      const yearlyPkg = packages.find(p => p.packageType === 'ANNUAL' || p.packageType === 'YEARLY');
      const monthlyPkg = packages.find(p => p.packageType === 'MONTHLY');
      
      enableButtons(
        lifetimePkg ? `Lifetime Access — ${lifetimePkg.product.priceString}` : 'Lifetime Access',
        yearlyPkg ? `${yearlyPkg.product.priceString} / Year` : 'Yearly',
        monthlyPkg ? `${monthlyPkg.product.priceString} / Month` : 'Monthly'
      );
      
      if (monthlyPkg) {
        // Also update the small price label on the initial Pro card
        const planPriceLabel = document.getElementById('plan-modal-price');
        if (planPriceLabel) {
          planPriceLabel.textContent = `${monthlyPkg.product.priceString}/mo`;
        }
      }
    }
  } catch(err) {
    console.error("Failed to fetch offerings for UI:", err);
    if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
      window.debugLog(`RevenueCat: getOfferings FAILED: ${sanitizeErrorForLog(err)}`);
    }
    // If fetching fails, let's keep them disabled or show an error
    if (btnLifetime) { btnLifetime.textContent = 'Purchases Unavailable'; }
    if (btnYearly) { btnYearly.textContent = 'Offline'; }
    if (btnMonthly) { btnMonthly.textContent = 'Offline'; }
  }
}

function isProEntitlementActive(entitlements) {
  if (!entitlements) return false;
  return !!(entitlements["pro_features"] || entitlements["iSubnet Pro"] || Object.keys(entitlements).length > 0);
}

async function updateRevenueCatSubscriptionState() {
  if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') window.debugLog(`updateRevenueCatSubscriptionState() called`);
  if (!useRevenueCat) return;
  try {
    const { Purchases } = window.Capacitor.Plugins;
    if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') window.debugLog(`RevenueCat: getCustomerInfo() called`);
    
    const customerInfoResult = await Purchases.getCustomerInfo();
    
    // FIX: Capacitor SDK returns { customerInfo: { ... } }, so we must extract it properly
    const customerInfo = customerInfoResult.customerInfo || customerInfoResult;
    
    const activeEntitlements = customerInfo.entitlements ? customerInfo.entitlements.active : null;
    const activeEntitlementCount = activeEntitlements ? Object.keys(activeEntitlements).length : 0;
    const isProResult = isProEntitlementActive(activeEntitlements);
    if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function' && (_lastLoggedRcProState === null || _lastLoggedRcProState !== isProResult)) {
      _lastLoggedRcProState = isProResult;
      window.debugLog(`RevenueCat: getCustomerInfo ok | pro=${isProResult} | activeEntitlements=${activeEntitlementCount}`);
    }
    
    if (isProResult) {
      let activeProductId = '';
      // Strict check for the exact entitlement name verified in dashboard
      const ent = activeEntitlements['iSubnet Pro'] || activeEntitlements['pro_features'];
      if (ent) {
        activeProductId = ent.productIdentifier || '';
      } else if (Object.keys(activeEntitlements).length > 0) {
        activeProductId = activeEntitlements[Object.keys(activeEntitlements)[0]].productIdentifier || '';
      }
      
      let planTier = 'unknown';
      const pid = activeProductId.toLowerCase();
      
      // Explicit exact matches based on dashboard identifiers
      if (pid.includes('monthly')) {
        planTier = 'monthly';
      } else if (pid.includes('yearly') || pid.includes('annual')) {
        planTier = 'yearly';
      } else if (pid.includes('lifetime') || pid === 'isubnet.lifetime.pro' || pid === 'isubnet_pro_lifetime') {
        planTier = 'lifetime';
      }
      
      const displayTier = planTier !== 'unknown' ? (planTier.charAt(0).toUpperCase() + planTier.slice(1)) : 'Lifetime';
      document.getElementById('settings-plan-status').innerHTML = `Current Plan: <strong>${displayTier} Pro</strong>`;
      updateUpgradeUI(planTier !== 'unknown' ? planTier : 'lifetime');
      
      const user = firebase.auth().currentUser;
      if (user && useRealFirebase) {
        db.collection("users").doc(user.uid).set({ is_pro: true }, { merge: true });
      }
    } else {
      if (typeof updateUpgradeUI === 'function') updateUpgradeUI('free');
    }
  } catch(err) {
    console.error("RevenueCat Check Error:", err);
    if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
      window.debugLog(`ERROR in updateRevenueCatSubscriptionState: ${sanitizeErrorForLog(err)}`);
    }
    if (window.Capacitor && window.Capacitor.Plugins.FirebaseCrashlytics) {
      window.Capacitor.Plugins.FirebaseCrashlytics.recordException({ message: err.message, stacktrace: err.stack }).catch(()=>{});
    }
    showErrorDialog("An error occurred while updating subscription state. Please try restarting the app.");
  }
}

  async function handlePurchaseSuccess(message) {
    await updateRevenueCatSubscriptionState();
    closeProModal();
    
    let userSignedIn = false;
    if (typeof firebase !== 'undefined' && firebase.auth) {
      userSignedIn = !!firebase.auth().currentUser;
    }
    
    if (typeof useRealFirebase !== 'undefined' && useRealFirebase && !userSignedIn) {
      const nudgeModal = document.getElementById('sync-nudge-modal');
      if (nudgeModal) {
        nudgeModal.classList.remove('hidden');
        return; // skip traditional alert
      }
    }
    showErrorDialog(message);
  }

async function purchaseProductByPlan(planType) {
  if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') window.debugLog(`Button Tap: Plan selected - ${planType}`);

  const isNative = window.Capacitor && window.Capacitor.getPlatform && (window.Capacitor.getPlatform() === 'ios' || window.Capacitor.getPlatform() === 'android');
  
  if (!isNative) {
    // Browser local test fallback
    PRO_UNLOCKED = true;
    SafeStorage.setItem('isubnet_pro', 'true');
    applyProState();
    showToast(`[Browser Demo] Purchased ${planType} plan! Pro features unlocked.`);
    closeProModal();
    return;
  }

  if (!useRevenueCat) {
    showErrorDialog("In-App Purchases are currently unavailable. Please check your connection and try again.");
    return;
  }

  let packageToBuy = null;
  try {
    const { Purchases } = window.Capacitor.Plugins;
    if (!Purchases) {
      showErrorDialog("Purchase plugin not found. Please try again later.");
      return;
    }
    const offerings = await Purchases.getOfferings();
    if (offerings.current !== null && offerings.current.availablePackages.length > 0) {
      const packages = offerings.current.availablePackages;
      
      if (planType === 'monthly') {
        packageToBuy = packages.find(p => p.packageType === 'MONTHLY');
      } else if (planType === 'yearly') {
        packageToBuy = packages.find(p => p.packageType === 'ANNUAL' || p.packageType === 'YEARLY');
      } else if (planType === 'lifetime') {
        packageToBuy = packages.find(p => p.packageType === 'LIFETIME');
      }
      
      if (!packageToBuy) {
        packageToBuy = packages[0];
      }
      
      if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') window.debugLog(`RevenueCat: purchasePackage() called`);
      const purchaseResult = await Purchases.purchasePackage({ aPackage: packageToBuy });
      if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
        const pCustInfo = (purchaseResult && purchaseResult.customerInfo) ? purchaseResult.customerInfo : purchaseResult;
        const pActiveEnts = (pCustInfo && pCustInfo.entitlements && pCustInfo.entitlements.active) ? pCustInfo.entitlements.active : null;
        const pPro = isProEntitlementActive(pActiveEnts);
        const pEntCount = pActiveEnts ? Object.keys(pActiveEnts).length : 0;
        window.debugLog(`RevenueCat: purchasePackage ok | pro=${pPro} | activeEntitlements=${pEntCount}`);
      }
      
        if (isProEntitlementActive(purchaseResult.customerInfo.entitlements.active)) {
          await handlePurchaseSuccess("Thank you for upgrading! iSubnet Pro unlocked.");
        }
    } else {
      showErrorDialog("Billing Error: No packages available in current offering.");
    }
  } catch(err) {
    if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
      window.debugLog(`RevenueCat: purchasePackage() FAILED: ${sanitizeErrorForLog(err)}${err && err.userCancelled ? ' (user cancelled)' : ''}`);
    }
    if (!err.userCancelled) {
      showErrorDialog("Purchase Error: " + err.message);
    }
  }
}

// --- iOS Status Bar Time Update ---
function updateTime() {
  const timeEl = document.getElementById('status-time');
  if (!timeEl) return;
  const now = new Date();
  let hours = now.getHours();
  let minutes = now.getMinutes();
  minutes = minutes < 10 ? '0' + minutes : minutes;
  timeEl.textContent = `${hours}:${minutes}`;
}
setInterval(updateTime, 1000);
updateTime();

// --- Freemium / Pro Tier ---
const FREE_NOTES_LIMIT = 3;
const FREE_HISTORY_LIMIT = 4;
let PRO_UNLOCKED = false; // will be set after SafeStorage is ready

const PRO_FEATURE_INFO = {
  dns: { title: '🌐 All DNS record types', text: 'The free DNS Lookup shows A records. Pro unlocks AAAA, MX, NS, TXT, CNAME, SOA, CAA, ALL, and reverse DNS (PTR) lookups for IP addresses.' },
  splitter: { title: '✂️ Subnet Splitter', text: 'Split a network into equal subnets, or into VLSM subnets sized by host count.' },
  ping: { title: '📶 Ping options', text: 'Choose how many probes to send (up to 100), or turn on -t to ping continuously until you stop it, with the newest result at the top.' },
  traceroute: { title: '🧭 Traceroute options', text: 'Set the maximum number of hops (up to 64), the probes per hop and the timeout, and turn on host name lookup to see a name for every hop.' },
  whois: { title: '🔎 Whois extras', text: 'Look up AS numbers, see the registrar’s own record with more contact detail, and view the raw registry data.' }
};

function showProModal(feature) {
  const ctxEl = document.getElementById('pro-context');
  if (ctxEl) {
    const info = feature && PRO_FEATURE_INFO[feature];
    if (info) {
      ctxEl.querySelector('.pro-context-title').textContent = info.title;
      ctxEl.querySelector('.pro-context-text').textContent = info.text;
      ctxEl.classList.remove('hidden');
    } else {
      ctxEl.classList.add('hidden');
    }
  }

  if (typeof updateRevenueCatSubscriptionState === 'function') {
    updateRevenueCatSubscriptionState().finally(() => {
      document.getElementById('pro-modal').classList.remove('hidden');
    });
  } else {
    document.getElementById('pro-modal').classList.remove('hidden');
  }
}

function closeProModal() {
  document.getElementById('pro-modal').classList.add('hidden');
}


// Global helpers for testing/debugging Pro features in the browser
if (typeof window !== 'undefined' && (!window.Capacitor || !window.Capacitor.isNativePlatform())) {
  window.unlockProDemo = function() {
    PRO_UNLOCKED = true;
    SafeStorage.setItem('isubnet_pro', 'true');
    applyProState();
    console.log("iSubnet Pro unlocked successfully for testing!");
    return "Pro unlocked!";
  };

  window.lockProDemo = function() {
    PRO_UNLOCKED = false;
    SafeStorage.setItem('isubnet_pro', 'false');
    location.reload();
    return "Pro locked!";
  };
}

function setProLabelInteractivity(containerEl, badgeEl, enabled) {
  [containerEl, badgeEl].forEach((el) => {
    if (!el) return;
    if (enabled) {
      el.classList.add('pro-label-tap');
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
    } else {
      el.classList.remove('pro-label-tap');
      el.removeAttribute('role');
      el.removeAttribute('tabindex');
    }
  });
}
window.setProLabelInteractivity = setProLabelInteractivity;

let lastToolsLocked = null;
function applyProState() {
  const badge = document.querySelector('.free-badge') || document.querySelector('.pro-badge');
  const allProBtns = document.querySelectorAll('.pro-feature-btn');
  const proTabs = [
    document.getElementById('tab-btn-splitter')
  ];
  
  if (PRO_UNLOCKED) {
    if (lastToolsLocked !== false) {
      if (typeof window.debugLog === 'function') window.debugLog('Pro state: unlocked (PRO_UNLOCKED=true)');
      lastToolsLocked = false;
    }
    // Swap FREE badge for PRO badge
    if (badge) {
      badge.textContent = 'PRO';
      badge.className = 'pro-badge';
    }
    // Unlock pro tabs
    proTabs.forEach(tab => {
      if (tab) {
        tab.classList.remove('tab-btn-locked');
        tab.setAttribute('data-target', tab.id.replace('tab-btn-', '') + '-tab');
        tab.removeAttribute('data-pro');
        const lockIcon = tab.querySelector('.tab-lock-icon');
        if (lockIcon) lockIcon.remove();
      }
    });
    // Unlock all generalized pro feature buttons
    allProBtns.forEach(btn => {
      const lockBadge = btn.querySelector('.pro-badge');
      if (lockBadge) lockBadge.remove();
      // Specifically handle the base converter hex input visual state
      if (btn.id === 'base-hex-input') {
        const label = document.querySelector('label[for="base-hex-input"], label[data-hex-label="true"]');
        if (label) { label.setAttribute('for', 'base-hex-input'); setProLabelInteractivity(label, null, false); }
        if (label) {
          const labelBadge = label.querySelector('.pro-badge');
          if (labelBadge) labelBadge.remove();
        }
        btn.disabled = false;
        btn.readOnly = false;
        if (btn.value === '🔒 Pro') {
          btn.value = ''; // Will be recomputed instantly
          if (typeof convertBase === 'function') {
            const decInput = document.getElementById('base-dec-input');
            if (decInput && decInput.value) convertBase('dec', 10);
          }
        }
      }
    });
    // Remove any limit banners
    document.querySelectorAll('.pro-limit-banner').forEach(el => el.remove());
  } else {
    if (lastToolsLocked !== true) {
      if (typeof window.debugLog === 'function') window.debugLog('Pro state: free (PRO_UNLOCKED=false)');
      lastToolsLocked = true;
    }
    // Lock FREE state back
    if (badge) {
      badge.textContent = 'FREE';
      badge.className = 'free-badge';
    }
    // Lock pro tabs
    proTabs.forEach(tab => {
      if (tab) {
        tab.classList.add('tab-btn-locked');
        tab.removeAttribute('data-target');
        tab.setAttribute('data-pro', 'true');
        if (!tab.querySelector('.tab-lock-icon')) {
          const lock = document.createElement('div');
          lock.className = 'tab-lock-icon';
          lock.textContent = '🔒';
          const iconWrap = tab.querySelector('.tab-icon-wrap');
          if (iconWrap) iconWrap.appendChild(lock);
          else tab.appendChild(lock);
        }
      }
    });
    
    // Lock all generalized pro feature buttons
    allProBtns.forEach(btn => {
      if (btn.id !== 'tab-btn-splitter' && !btn.querySelector('.pro-badge')) {
        // Create the pro badge
        const badgeEl = document.createElement('span');
        badgeEl.className = 'pro-badge';
        badgeEl.textContent = '🔒 Pro';
        badgeEl.style.marginLeft = '4px';
        
        // If it's a label with a specific layout or input, handle it
        if (btn.id === 'base-hex-input') {
          btn.disabled = false;
          btn.readOnly = true;
          btn.value = '🔒 Pro';
          
          // Also add badge to the label for visibility
          const label = document.querySelector('label[for="base-hex-input"], label[data-hex-label="true"]');
          if (label) { label.setAttribute('data-hex-label', 'true'); }
          if (label && !label.querySelector('.pro-badge')) {
            const labelBadge = document.createElement('span');
            labelBadge.className = 'pro-badge';
            labelBadge.textContent = '🔒 Pro';
            labelBadge.style.textTransform = 'none';
            labelBadge.style.letterSpacing = '0';
            label.appendChild(labelBadge);
            setProLabelInteractivity(label, labelBadge, true);
          }
        } else {
          btn.appendChild(badgeEl);
        }
      }
    });
    
    // Switch to another tab if currently on Splitter
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'splitter-tab') {
      const calcBtn = document.querySelector('.tab-btn[data-target="calculator-tab"]');
      if (calcBtn) calcBtn.click();
    }
    
    // Re-render list templates to show limits
    renderNotes();
    renderHistory();
  }
  if (typeof window.updateDnsControls === 'function') window.updateDnsControls();
  if (typeof window.updatePingControls === 'function') window.updatePingControls();
  if (typeof window.updateTraceControls === 'function') window.updateTraceControls();
  if (typeof window.updateWhoisControls === 'function') window.updateWhoisControls();
}

// --- Safe Storage Wrapper for Local file:// CORS constraints ---
const SafeStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage is disabled or blocked. Using memory fallback.', e);
      return this._fallback[key] || null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage is disabled or blocked. Using memory fallback.', e);
      this._fallback[key] = value;
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      delete this._fallback[key];
    }
  },
  _fallback: {}
};

// --- INITIALIZE DEBUG STATE NOW THAT SAFESTORAGE EXISTS ---
window.APP_DEBUG_ENABLED = SafeStorage.getItem('isubnet_debug') === 'true';
window.APP_DEBUG_START_TIME = parseInt(SafeStorage.getItem('isubnet_debug_start') || '0', 10);
window.APP_DEBUG_CURRENT_NOTE_ID = SafeStorage.getItem('isubnet_debug_note_id') || null;

if (window.APP_DEBUG_ENABLED) {
  window._debugReminderInterval = setInterval(window.checkDebugReminder, 60000);
  debugLog("=== APP LAUNCHED (Cold Start) ===");
}


PRO_UNLOCKED = SafeStorage.getItem('isubnet_pro') === 'true';

let lastCalculatedIP = SafeStorage.getItem('isubnet_last_ip') || '';

function updateSharedIP(ip) {
  if (!ip) return;
  lastCalculatedIP = ip.trim().replace(/^\[|\]$/g, '').split('/')[0];
  SafeStorage.setItem('isubnet_last_ip', lastCalculatedIP);
  renderQuickPastePills();
}

function renderQuickPastePills() {
  if (window._updateCopyPasteVisibility) {
    window._updateCopyPasteVisibility();
  }
}

// --- Tab Navigation Setup ---
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      if (!target) return;
      
      // Deactivate all buttons and contents
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Activate target
      btn.classList.add('active');
      const el = document.getElementById(target);
      if (el) el.classList.add('active');
    });
  });

  // Inner sub-tab switcher for Calculator Tab (IPv4 / IPv6 Modes)
  const subTabButtons = document.querySelectorAll('.calc-sub-tab-btn');
  const subPanels = document.querySelectorAll('.calc-sub-panel');

  subTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-sub-target');
      if (!target) return;

      // Deactivate all sub-tabs and hide sub-panels
      subTabButtons.forEach(b => {
        b.classList.remove('active');
        b.style.background = 'none';
        b.style.color = 'var(--text-secondary)';
        b.style.fontWeight = '500';
      });
      subPanels.forEach(p => {
        p.classList.remove('active-panel');
        p.style.display = 'none';
      });

      // Activate clicked sub-tab and show target panel
      btn.classList.add('active');
      btn.style.background = 'var(--bg-card)';
      btn.style.color = 'var(--text-primary)';
      btn.style.fontWeight = '600';

      const panel = document.getElementById(target);
      if (panel) {
        panel.classList.add('active-panel');
        panel.style.display = 'block';
      }
    });
  });
}



// Convert CIDR number to decimal subnet mask string (IPv4)
function cidrToSubnetMask(cidr) {
  if (cidr === 0) return '0.0.0.0';
  const mask = (~0 << (32 - cidr)) >>> 0;
  return [
    (mask >>> 24) & 255,
    (mask >>> 16) & 255,
    (mask >>> 8) & 255,
    mask & 255
  ].join('.');
}

// --- IPv4 CALCULATION LOGIC ---

// Convert IP Address string to 32-bit integer
function ipToUint32(ipStr) {
  const parts = ipStr.split('.').map(p => parseInt(p, 10));
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

// Convert 32-bit integer back to IP Address string
function uint32ToIp(val) {
  return [
    (val >>> 24) & 255,
    (val >>> 16) & 255,
    (val >>> 8) & 255,
    val & 255
  ].join('.');
}

// Convert number to 32-bit binary string (with dots separating octets)
function uint32ToBinaryStr(val) {
  const bin = val.toString(2).padStart(32, '0');
  return `${bin.substring(0, 8)}.${bin.substring(8, 16)}.${bin.substring(16, 24)}.${bin.substring(24, 32)}`;
}

// Returns HTML with colored bits: 1s in .bit-on, 0s in .bit-off, dots as plain text
function coloredBinaryStr(binaryDottedStr) {
  return binaryDottedStr.split('').map(ch => {
    if (ch === '1') return '<span class="bit-on">1</span>';
    if (ch === '0') return '<span class="bit-off">0</span>';
    return '<span class="bit-on">.</span>';
  }).join('');
}


// Validate IPv4 format
function validateIPv4(ipStr) {
  const reg = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (!reg.test(ipStr)) return false;
  const parts = ipStr.match(reg).slice(1).map(Number);
  return parts.every(p => p >= 0 && p <= 255);
}

// Perform calculations for IPv4
function calculateIPv4() {
  if (window.Capacitor && window.Capacitor.Plugins.FirebaseCrashlytics) {
    window.Capacitor.Plugins.FirebaseCrashlytics.setCustomKey({ key: 'last_calc_action', type: 'string', value: 'calculateIPv4' }).catch(() => {});
  }
  logCalcV4Debounced();
  let ipInput = document.getElementById('ipv4-address').value.trim();
  
  if (ipInput.includes('/')) {
    const parts = ipInput.split('/');
    const cleanIp = parts[0].trim();
    const maskStr = parts[1].trim();
    const mask = parseInt(maskStr, 10);
    if (!isNaN(mask) && mask >= 0 && mask <= 32) {
      document.getElementById('ipv4-address').value = cleanIp;
      document.getElementById('ipv4-cidr').value = mask;
      const cidrValEl = document.getElementById('ipv4-cidr-val');
      if (cidrValEl) cidrValEl.textContent = `/${mask} (${cidrToSubnetMask(mask)})`;
      const btnValEl = document.getElementById('ipv4-cidr-btn-val');
      if (btnValEl) btnValEl.textContent = `/${mask}`;
      ipInput = cleanIp;
    }
  }

  const hostsInput = document.getElementById('ipv4-hosts').value.trim();
  const errorEl = document.getElementById('ipv4-error');
  const resultsCard = document.getElementById('ipv4-results');

  // Reset states
  errorEl.textContent = '';
  resultsCard.classList.add('hidden');
  document.getElementById('ipv4-subnets-container').classList.add('hidden');

  const dotCount = (ipInput.match(/\./g) || []).length;
  if (ipInput === '' || dotCount < 3 || ipInput.endsWith('.')) {
    errorEl.textContent = '';
    resultsCard.classList.add('hidden');
    return;
  }

  if (!validateIPv4(ipInput)) {
    errorEl.textContent = 'Invalid IPv4 address format. Use format e.g. 192.168.1.1';
    return;
  }

  updateSharedIP(ipInput);

  let cidrInput = parseInt(document.getElementById('ipv4-cidr').value, 10);

  // If hostsInput is provided, override the CIDR input with the prefix needed to support that number of hosts
  let targetCidr = null;
  if (hostsInput !== '') {
    const requiredHosts = parseInt(hostsInput, 10);
    if (isNaN(requiredHosts) || requiredHosts < 1) {
      errorEl.textContent = 'Required hosts must be a positive number.';
      return;
    }

    if (requiredHosts === 1) {
      targetCidr = 32;
    } else if (requiredHosts === 2) {
      targetCidr = 31;
    } else {
      const hostBitsNeeded = Math.ceil(Math.log2(requiredHosts + 2));
      targetCidr = 32 - hostBitsNeeded;
    }

    if (targetCidr < 0 || targetCidr > 32) {
      errorEl.textContent = `Unable to accommodate ${requiredHosts} hosts. Max IPv4 capacity is 4,294,967,294 hosts.`;
      return;
    }

    cidrInput = targetCidr;
    // Visually update the slider value
    document.getElementById('ipv4-cidr').value = cidrInput;
  }

  // Update the visual CIDR label
  document.getElementById('ipv4-cidr-val').textContent = `/${cidrInput} (${cidrToSubnetMask(cidrInput)})`;
  const ipv4BtnVal = document.getElementById('ipv4-cidr-btn-val');
  if (ipv4BtnVal) ipv4BtnVal.textContent = `/${cidrInput}`;

  const ipVal = ipToUint32(ipInput);
  const maskVal = cidrInput === 0 ? 0 : (~0 << (32 - cidrInput)) >>> 0;
  const wildcardVal = ~maskVal >>> 0;
  const networkVal = (ipVal & maskVal) >>> 0;
  const broadcastVal = (ipVal | wildcardVal) >>> 0;

  // Class detection based on first octet
  const firstOctet = (ipVal >>> 24) & 255;
  let ipClass = 'Unknown';
  if (firstOctet >= 1 && firstOctet <= 126) ipClass = 'Class A';
  else if (firstOctet === 127) ipClass = 'Class A (Loopback)';
  else if (firstOctet >= 128 && firstOctet <= 191) ipClass = 'Class B';
  else if (firstOctet >= 192 && firstOctet <= 223) ipClass = 'Class C';
  else if (firstOctet >= 224 && firstOctet <= 239) ipClass = 'Class D (Multicast)';
  else if (firstOctet >= 240 && firstOctet <= 255) ipClass = 'Class E (Experimental)';

  // Private vs Public IP check
  let ipType = 'Public IP';
  if (firstOctet === 10) ipType = 'Private IP (Class A)';
  else if (firstOctet === 172 && ((ipVal >>> 16) & 255) >= 16 && ((ipVal >>> 16) & 255) <= 31) ipType = 'Private IP (Class B)';
  else if (firstOctet === 192 && ((ipVal >>> 16) & 255) === 168) ipType = 'Private IP (Class C)';
  else if (firstOctet === 127) ipType = 'Localhost (Loopback)';
  else if (firstOctet === 169 && ((ipVal >>> 16) & 255) === 254) ipType = 'Link-Local (APIPA)';

  // Usable hosts calculations
  let totalHosts = 0;
  let rangeStart = '';
  let rangeEnd = '';

  if (cidrInput === 32) {
    totalHosts = 1;
    rangeStart = uint32ToIp(networkVal);
    rangeEnd = uint32ToIp(networkVal);
  } else if (cidrInput === 31) {
    totalHosts = 2;
    rangeStart = uint32ToIp(networkVal);
    rangeEnd = uint32ToIp(broadcastVal);
  } else {
    totalHosts = (2 ** (32 - cidrInput)) - 2;
    rangeStart = uint32ToIp(networkVal + 1);
    rangeEnd = uint32ToIp(broadcastVal - 1);
  }

  // Populate basic results
  document.getElementById('ipv4-badge-class').textContent = ipClass;
  document.getElementById('res-cidr').textContent = `/${cidrInput}`;
  document.getElementById('res-mask').textContent = uint32ToIp(maskVal);
  document.getElementById('res-wildcard').textContent = uint32ToIp(wildcardVal);
  document.getElementById('res-network').textContent = uint32ToIp(networkVal);
  document.getElementById('res-broadcast').textContent = uint32ToIp(broadcastVal);
  document.getElementById('res-range').textContent = `${rangeStart} - ${rangeEnd}`;
  document.getElementById('res-hosts').textContent = totalHosts.toLocaleString();
  document.getElementById('res-type').textContent = ipType;

  // Populate binary
  document.getElementById('bin-ip').innerHTML = coloredBinaryStr(uint32ToBinaryStr(ipVal));
  document.getElementById('bin-mask').innerHTML = coloredBinaryStr(uint32ToBinaryStr(maskVal));

  // If the user specified Required Hosts but did NOT trigger partitioning of a larger block,
  // we can show a list of consecutive subnets of this calculated size within a classful boundary (/24 for C, /16 for B, /8 for A).
  // E.g., if they input 192.168.1.1 (Class C, default boundary /24) and 50 hosts (requires /26),
  // we show the subnets of size /26 that fit inside 192.168.1.0/24.
  if (hostsInput !== '') {
    let parentCidr = 24; // Default to Class C boundary
    if (ipClass.startsWith('Class A')) parentCidr = 8;
    else if (ipClass.startsWith('Class B')) parentCidr = 16;
    
    // Only show partitioning if our calculated size is smaller (higher CIDR) than the class boundary
    if (cidrInput > parentCidr) {
      const subnetsContainer = document.getElementById('ipv4-subnets-container');
      const subnetListEl = document.getElementById('res-subnet-list');
      subnetListEl.innerHTML = '';
      subnetsContainer.classList.remove('hidden');

      const classfulNetworkVal = (ipVal & (parentCidr === 8 ? 0xFF000000 : parentCidr === 16 ? 0xFFFF0000 : 0xFFFFFF00)) >>> 0;
      const subnetsCount = 2 ** (cidrInput - parentCidr);
      const subnetSize = 2 ** (32 - cidrInput);
      const maxRender = Math.min(subnetsCount, 64);

      for (let i = 0; i < maxRender; i++) {
        const subNetVal = (classfulNetworkVal + (i * subnetSize)) >>> 0;
        const subBroadVal = (subNetVal + subnetSize - 1) >>> 0;
        
        let subStart = '';
        let subEnd = '';
        if (cidrInput === 32) {
          subStart = uint32ToIp(subNetVal);
          subEnd = uint32ToIp(subNetVal);
        } else if (cidrInput === 31) {
          subStart = uint32ToIp(subNetVal);
          subEnd = uint32ToIp(subBroadVal);
        } else {
          subStart = uint32ToIp(subNetVal + 1);
          subEnd = uint32ToIp(subBroadVal - 1);
        }

        const item = document.createElement('div');
        item.className = 'subnet-row-item';
        // Add a class to highlight the specific subnet containing the user's IP
        const containsUserIp = (ipVal >= subNetVal && ipVal <= subBroadVal);
        if (containsUserIp) {
          item.style.borderColor = 'var(--accent-cyan)';
          item.style.background = 'rgba(6, 182, 212, 0.1)';
        }

        item.innerHTML = `
          <span class="subnet-idx">Subnet #${i + 1} (/${cidrInput} - ${cidrToSubnetMask(cidrInput)})${containsUserIp ? ' 📍' : ''}</span>
          <div class="subnet-details">
            <span class="subnet-ip">${uint32ToIp(subNetVal)}</span>
            <span class="subnet-range">${subStart} - ${subEnd}</span>
          </div>
        `;
        subnetListEl.appendChild(item);
      }

      if (subnetsCount > maxRender) {
        const extraRow = document.createElement('p');
        extraRow.className = 'helper-text';
        extraRow.style.textAlign = 'center';
        extraRow.textContent = `... and ${subnetsCount - maxRender} more subnets.`;
        subnetListEl.appendChild(extraRow);
      }
    }
  }

  // Show result panel with smooth fade-in
  resultsCard.classList.remove('hidden');

  // Record history
  const desc = `${ipInput}/${cidrInput} (${hostsInput ? hostsInput + ' hosts - ' : ''}${cidrToSubnetMask(cidrInput)})`;
  recordHistoryDebounced('IPv4', { ip: ipInput, cidr: cidrInput, hosts: hostsInput }, desc);
}

// --- IPv6 CALCULATION LOGIC ---

// Parse shorthand IPv6 to a 128-bit BigInt
function parseIPv6(ipStr) {
  ipStr = ipStr.trim().toLowerCase();
  
  if (ipStr.includes('.')) {
    const lastColon = ipStr.lastIndexOf(':');
    if (lastColon === -1) return null;
    const v4Tail = ipStr.slice(lastColon + 1);
    if (!validateIPv4(v4Tail)) return null;
    const v4Uint32 = ipToUint32(v4Tail);
    const hexGroup1 = ((v4Uint32 >>> 16) & 0xffff).toString(16);
    const hexGroup2 = (v4Uint32 & 0xffff).toString(16);
    ipStr = `${ipStr.slice(0, lastColon + 1)}${hexGroup1}:${hexGroup2}`;
  }

  // Basic sanity validation
  if (!/^[0-9a-f:]+$/i.test(ipStr)) return null;
  if (ipStr.includes(':::')) return null;

  let parts = [];
  if (ipStr.includes('::')) {
    const split = ipStr.split('::');
    if (split.length > 2) return null; // multiple double colons invalid
    const left = split[0] ? split[0].split(':') : [];
    const right = split[1] ? split[1].split(':') : [];
    const missing = 8 - (left.length + right.length);
    if (missing < 0) return null;
    parts = [...left, ...Array(missing).fill('0'), ...right];
  } else {
    parts = ipStr.split(':');
  }

  if (parts.length !== 8) return null;

  let bigIntVal = BigInt(0);
  for (let i = 0; i < 8; i++) {
    const val = parseInt(parts[i] === '' ? '0' : parts[i], 16);
    if (isNaN(val) || val < 0 || val > 0xffff) return null;
    bigIntVal = (bigIntVal << BigInt(16)) + BigInt(val);
  }
  return bigIntVal;
}

// Format 128-bit BigInt to compressed IPv6 string
function formatIPv6Compressed(bigIntVal) {
  const parts = [];
  let temp = bigIntVal;
  for (let i = 0; i < 8; i++) {
    const part = Number(temp & BigInt(0xffff));
    parts.unshift(part.toString(16));
    temp = temp >> BigInt(16);
  }

  // Find longest contiguous run of '0'
  let maxZeroStart = -1;
  let maxZeroLen = 0;
  let currentZeroStart = -1;
  let currentZeroLen = 0;

  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '0') {
      if (currentZeroStart === -1) {
        currentZeroStart = i;
      }
      currentZeroLen++;
      if (currentZeroLen > maxZeroLen) {
        maxZeroLen = currentZeroLen;
        maxZeroStart = currentZeroStart;
      }
    } else {
      currentZeroStart = -1;
      currentZeroLen = 0;
    }
  }

  if (maxZeroLen > 1) {
    const left = parts.slice(0, maxZeroStart).join(':');
    const right = parts.slice(maxZeroStart + maxZeroLen).join(':');
    return `${left}::${right}`;
  }
  return parts.join(':');
}

/**
 * Returns colored HTML for an IPv6 address.
 * Nibbles (4-bit hex digits) that belong to the network prefix get .bit-on,
 * host-part nibbles get .bit-off, colons and :: get .bit-dot.
 *
 * @param {BigInt} bigIntVal - The 128-bit IPv6 address
 * @param {number} prefixLength - The prefix length (0–128)
 * @param {'expanded'|'compressed'} format - Output format
 */
function coloredIPv6Html(bigIntVal, prefixLength, format = 'expanded') {
  // Build the 8 expanded groups (each is a 4-char hex string)
  const groups = [];
  let temp = bigIntVal;
  for (let i = 0; i < 8; i++) {
    const part = Number(temp & BigInt(0xffff));
    groups.unshift(part.toString(16).padStart(4, '0'));
    temp = temp >> BigInt(16);
  }

  // Determine active nibble count per group.
  // prefixLength nibbles-total = Math.ceil(prefixLength / 4)
  // Each group has 16 bits = 4 nibbles
  const fullyActiveGroups = Math.floor(prefixLength / 16);   // groups entirely in prefix
  const partialGroupIdx   = fullyActiveGroups;               // group that may be split
  const activeNibblesInPartial = Math.ceil((prefixLength % 16) / 4); // nibbles active in partial group

  // Wrap each nibble character: returns HTML for one 4-char group at groupIdx
  function colorGroup(hexGroup, groupIdx) {
    let activeCount;
    if (groupIdx < fullyActiveGroups) {
      activeCount = 4; // all 4 nibbles active
    } else if (groupIdx === partialGroupIdx && prefixLength % 16 !== 0) {
      activeCount = activeNibblesInPartial;
    } else {
      activeCount = 0; // all host bits
    }
    // For compressed output, hexGroup may be shorter (leading zeros stripped)
    // Work with the padded version and then reconstruct
    const padded = hexGroup.padStart(4, '0');
    let html = '';
    for (let n = 0; n < padded.length; n++) {
      const cls = n < activeCount ? 'bit-on' : 'bit-off';
      html += `<span class="${cls}">${padded[n]}</span>`;
    }
    // If compressed format, strip leading zero spans that are also .bit-off
    // (We keep them for visual alignment; compressed coloring still meaningful)
    return html;
  }

  const dot = '<span class="bit-on">:</span>';

  if (format === 'expanded') {
    return groups.map((g, i) => colorGroup(g, i)).join(dot);
  }

  // Compressed: find longest run of all-zero groups to collapse to ::
  const compressedParts = groups.map(g => g.replace(/^0+/, '') || '0');
  let maxZeroStart = -1, maxZeroLen = 0, curStart = -1, curLen = 0;
  for (let i = 0; i < compressedParts.length; i++) {
    if (compressedParts[i] === '0') {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > maxZeroLen) { maxZeroLen = curLen; maxZeroStart = curStart; }
    } else { curStart = -1; curLen = 0; }
  }

  if (maxZeroLen > 1) {
    // Left side
    const leftHtml = groups
      .slice(0, maxZeroStart)
      .map((g, i) => {
        const stripped = g.replace(/^0+/, '') || '0';
        // For compressed, only show non-leading-zero nibbles but color correctly
        return colorGroupCompressed(stripped, i, fullyActiveGroups, partialGroupIdx, activeNibblesInPartial, prefixLength);
      })
      .join(dot);

    // Right side — group indices are maxZeroStart + maxZeroLen onward
    const rightHtml = groups
      .slice(maxZeroStart + maxZeroLen)
      .map((g, i) => {
        const realIdx = maxZeroStart + maxZeroLen + i;
        const stripped = g.replace(/^0+/, '') || '0';
        return colorGroupCompressed(stripped, realIdx, fullyActiveGroups, partialGroupIdx, activeNibblesInPartial, prefixLength);
      })
      .join(dot);

    const dcDot = '<span class="bit-on">::</span>';
    if (!leftHtml && !rightHtml) return dcDot;
    if (!leftHtml) return `${dcDot}${rightHtml}`;
    if (!rightHtml) return `${leftHtml}${dcDot}`;
    return `${leftHtml}${dcDot}${rightHtml}`;
  }

  // No compression
  return compressedParts
    .map((g, i) => colorGroupCompressed(g, i, fullyActiveGroups, partialGroupIdx, activeNibblesInPartial, prefixLength))
    .join(dot);
}

/** Color a compressed (leading-zeros-stripped) hex group */
function colorGroupCompressed(stripped, groupIdx, fullyActiveGroups, partialGroupIdx, activeNibblesInPartial, prefixLength) {
  let activeCount;
  if (groupIdx < fullyActiveGroups) {
    activeCount = 4;
  } else if (groupIdx === partialGroupIdx && prefixLength % 16 !== 0) {
    activeCount = activeNibblesInPartial;
  } else {
    activeCount = 0;
  }
  // Pad to 4 nibbles to correctly assign active/host role per position
  const padded = stripped.padStart(4, '0');
  let html = '';
  for (let n = 0; n < padded.length; n++) {
    const cls = n < activeCount ? 'bit-on' : 'bit-off';
    html += `<span class="${cls}">${padded[n]}</span>`;
  }
  // Strip leading bit-off zero spans that were only present for padding
  // For compressed display: remove leading '0' spans that aren't in original
  const leadingZerosToStrip = 4 - stripped.length;
  if (leadingZerosToStrip > 0) {
    // Remove the first `leadingZerosToStrip` span elements
    let remaining = html;
    for (let k = 0; k < leadingZerosToStrip; k++) {
      remaining = remaining.replace(/^<span class="[^"]+">0<\/span>/, '');
    }
    return remaining;
  }
  return html;
}


/**
 * Renders the "Boundary View" of an IPv6 address:
 * - All groups that are fully in the prefix or fully in the host are shown as
 *   normal 4-hex-char groups with bit-on / bit-off coloring.
 * - The one group where the prefix boundary falls mid-group is expanded to
 *   16 binary digits, each colored at the bit level (bit-on for prefix bits,
 *   bit-off for host bits).
 * Only call this when prefixLength % 16 !== 0.
 */
function coloredIPv6Binary(bigIntVal, prefixLength) {
  const groups = [];
  let temp = bigIntVal;
  for (let i = 0; i < 8; i++) {
    const part = Number(temp & BigInt(0xffff));
    groups.unshift(part.toString(2).padStart(16, '0'));
    temp = temp >> BigInt(16);
  }

  const fullyActiveGroups = Math.floor(prefixLength / 16);
  const partialGroupIdx   = fullyActiveGroups;
  const activeBitsInPartial = prefixLength % 16;

  const dot = '<span class="bit-on">:</span>';

  const parts = groups.map((binStr, groupIdx) => {
    return binStr.split('').map((bit, n) => {
      let cls = 'bit-off';
      if (groupIdx < fullyActiveGroups) {
        cls = 'bit-on';
      } else if (groupIdx === partialGroupIdx && prefixLength % 16 !== 0) {
        cls = n < activeBitsInPartial ? 'bit-level-on' : 'bit-level-off';
      }
      return `<span class="${cls}">${bit}</span>`;
    }).join('');
  });

  return parts.join(dot);
}

function coloredIPv6BitExpanded(bigIntVal, prefixLength) {
  const groups = [];
  let temp = bigIntVal;
  for (let i = 0; i < 8; i++) {
    const part = Number(temp & BigInt(0xffff));
    groups.unshift(part.toString(16).padStart(4, '0'));
    temp = temp >> BigInt(16);
  }

  const fullyActiveGroups = Math.floor(prefixLength / 16);
  const partialGroupIdx   = fullyActiveGroups;
  const activeBitsInPartial = prefixLength % 16;

  const dot = '<span class="bit-on">:</span>';

  const parts = groups.map((g, i) => {
    if (i === partialGroupIdx) {
      const val = parseInt(g, 16);
      const binStr = val.toString(2).padStart(16, '0');
      return binStr.split('').map((bit, n) => {
        const cls = n < activeBitsInPartial ? 'bit-level-on' : 'bit-level-off';
        return `<span class="${cls}">${bit}</span>`;
      }).join('');
    } else {
      const activeCount = i < fullyActiveGroups ? 4 : 0;
      return g.split('').map((ch, n) => {
        const cls = n < activeCount ? 'bit-on' : 'bit-off';
        return `<span class="${cls}">${ch}</span>`;
      }).join('');
    }
  });

  return parts.join(dot);
}

function calculateIPv6() {
  if (window.Capacitor && window.Capacitor.Plugins.FirebaseCrashlytics) {
    window.Capacitor.Plugins.FirebaseCrashlytics.setCustomKey({ key: 'last_calc_action', type: 'string', value: 'calculateIPv6' }).catch(() => {});
  }
  logCalcV6Debounced();
  let ipInput = document.getElementById('ipv6-address').value.trim();
  
  if (ipInput.includes('/')) {
    const parts = ipInput.split('/');
    const cleanIp = parts[0].trim();
    const maskStr = parts[1].trim();
    const mask = parseInt(maskStr, 10);
    if (!isNaN(mask) && mask >= 0 && mask <= 128) {
      document.getElementById('ipv6-address').value = cleanIp;
      document.getElementById('ipv6-cidr').value = mask;
      const cidrValEl = document.getElementById('ipv6-cidr-val');
      if (cidrValEl) cidrValEl.textContent = `/${mask}`;
      const btnValEl = document.getElementById('ipv6-cidr-btn-val');
      if (btnValEl) btnValEl.textContent = `/${mask}`;
      ipInput = cleanIp;
    }
  }

  const hostsInput = document.getElementById('ipv6-hosts').value.trim();
  const errorEl = document.getElementById('ipv6-error');
  const resultsCard = document.getElementById('ipv6-results');

  // Reset
  errorEl.textContent = '';
  resultsCard.classList.add('hidden');

  const colonCount = (ipInput.match(/:/g) || []).length;
  // If user is typing and ends with a single colon (but NOT double colon ::), hide results silently.
  if (ipInput === '' || colonCount < 2 || (ipInput.endsWith(':') && !ipInput.endsWith('::'))) {
    errorEl.textContent = '';
    resultsCard.classList.add('hidden');
    return;
  }

  const ipBigInt = parseIPv6(ipInput);
  if (ipBigInt === null) {
    errorEl.textContent = 'Invalid IPv6 address. Enter valid hexadecimal blocks separated by colons.';
    return;
  }

  updateSharedIP(ipInput);

  let prefixLength = parseInt(document.getElementById('ipv6-cidr').value, 10);

  // If hostsInput is provided, override the prefix length with the CIDR required
  if (hostsInput !== '') {
    if (!/^\d+$/.test(hostsInput)) {
      errorEl.textContent = 'Required hosts must be a valid positive integer.';
      return;
    }
    try {
      const requiredHosts = BigInt(hostsInput);
      if (requiredHosts < BigInt(1)) {
        errorEl.textContent = 'Required hosts must be at least 1.';
        return;
      }

      let bitsNeeded = 0;
      if (requiredHosts > BigInt(1)) {
        bitsNeeded = (requiredHosts - BigInt(1)).toString(2).length;
      }

      const targetPrefix = 128 - bitsNeeded;
      if (targetPrefix < 0 || targetPrefix > 128) {
        errorEl.textContent = 'Unable to accommodate host size in IPv6.';
        return;
      }

      prefixLength = targetPrefix;
      // Visually update the slider
      document.getElementById('ipv6-cidr').value = prefixLength;
    } catch (err) {
      errorEl.textContent = 'Invalid hosts input.';
      return;
    }
  }

  // Update the visual Prefix label
  document.getElementById('ipv6-cidr-val').textContent = `/${prefixLength}`;
  const ipv6BtnVal = document.getElementById('ipv6-cidr-btn-val');
  if (ipv6BtnVal) ipv6BtnVal.textContent = `/${prefixLength}`;

  // Calculate 128-bit mask ranges
  const hostMask = (BigInt(1) << BigInt(128 - prefixLength)) - BigInt(1);
  const netMask = ~hostMask & ((BigInt(1) << BigInt(128)) - BigInt(1));
  const networkPrefixVal = ipBigInt & netMask;
  const broadcastVal = networkPrefixVal | hostMask;

  // Address Type Identification
  let addrType = 'Global Unicast';
  const top8 = Number(ipBigInt >> BigInt(120)) & 255;
  const top10 = Number(ipBigInt >> BigInt(118)) & 1023;
  const top7 = Number(ipBigInt >> BigInt(121)) & 127;

  if (ipBigInt === BigInt(0)) {
    addrType = 'Unspecified Address (::)';
  } else if (ipBigInt === BigInt(1)) {
    addrType = 'Loopback Address (::1)';
  } else if (top8 === 255) {
    addrType = 'Multicast Range';
  } else if (top10 === 1008) { // fe80
    addrType = 'Link-Local Unicast';
  } else if (top7 === 124 || top7 === 125) { // fc00 or fd00
    addrType = 'Unique Local (Private LAN)';
  }

  // Calculate Total Addresses
  const totalAddresses = BigInt(2) ** BigInt(128 - prefixLength);

  // Populate fields
  document.getElementById('ipv6-badge-type').textContent = addrType;
  document.getElementById('res6-compressed').innerHTML = coloredIPv6Html(ipBigInt, prefixLength, 'compressed');
  document.getElementById('res6-expanded').innerHTML = coloredIPv6Html(ipBigInt, prefixLength, 'expanded');
  document.getElementById('res6-prefix').textContent = `/${prefixLength}`;
  document.getElementById('res6-net-prefix').innerHTML =
    coloredIPv6Html(networkPrefixVal, prefixLength, 'compressed') +
    `<span class="bit-on">/</span><span class="bit-on">${prefixLength}</span>`;
  document.getElementById('res6-start').innerHTML = coloredIPv6Html(networkPrefixVal, prefixLength, 'compressed');
  document.getElementById('res6-end').innerHTML = coloredIPv6Html(broadcastVal, prefixLength, 'compressed');
  document.getElementById('res6-total').textContent = totalAddresses.toLocaleString();

  // Boundary View: show only when the prefix cuts through a group (not a multiple of 16)
  const bitExpandedRow = document.getElementById('res6-bitexpanded-row');
  if (prefixLength % 16 !== 0) {
    document.getElementById('res6-bitexpanded').innerHTML = coloredIPv6BitExpanded(ipBigInt, prefixLength);
    bitExpandedRow.classList.remove('hidden');
  } else {
    bitExpandedRow.classList.add('hidden');
  }

  // Full Binary Address View (Shows always)
  document.getElementById('res6-binary').innerHTML = coloredIPv6Binary(ipBigInt, prefixLength);


  resultsCard.classList.remove('hidden');

  // Record history
  recordHistoryDebounced('IPv6', { ip: ipInput, cidr: prefixLength, hosts: hostsInput }, `${formatIPv6Compressed(ipBigInt)}/${prefixLength}${hostsInput ? ` (${hostsInput} hosts)` : ''}`);
}

// --- NOTES MANAGEMENT LOGIC ---

let notes = [];

function loadNotes() {
  const activeDebugNote = (window.APP_DEBUG_ENABLED && window.APP_DEBUG_CURRENT_NOTE_ID && Array.isArray(notes))
    ? notes.find(n => n && n.id === window.APP_DEBUG_CURRENT_NOTE_ID)
    : null;
  const stored = SafeStorage.getItem('isubnet_notes_' + currentUserId);
  if (stored) {
    try {
      notes = JSON.parse(stored);
      if (!Array.isArray(notes)) notes = [];
    } catch (e) {
      notes = [];
    }
  } else {
    if (currentUserId === 'local') {
      const legacy = SafeStorage.getItem('isubnet_notes');
      if (legacy) {
        try {
          notes = JSON.parse(legacy);
          if (!Array.isArray(notes)) notes = [];
          SafeStorage.setItem('isubnet_notes_local', legacy);
          SafeStorage.removeItem('isubnet_notes');
        } catch (e) {
          notes = [];
        }
      } else {
        notes = [];
      }
    } else {
      notes = [];
    }
  }
  if (activeDebugNote) {
    const loadedIdx = notes.findIndex(n => n && n.id === activeDebugNote.id);
    if (loadedIdx === -1) {
      notes.unshift(activeDebugNote);
    } else if (typeof activeDebugNote.content === 'string' &&
               (!notes[loadedIdx].content || activeDebugNote.content.length >= notes[loadedIdx].content.length)) {
      notes[loadedIdx] = activeDebugNote;
    }
  }
  renderNotes();
}

function saveNotesToStorage() {
  SafeStorage.setItem('isubnet_notes_' + currentUserId, JSON.stringify(notes));
  if (currentUserId !== 'local') {
    SafeStorage.setItem('isubnet_notes_local', JSON.stringify(notes)); // Save all, do not slice
  }
  renderNotes();
}

function addNote(title, content, category = 'Manual') {
  const newNote = {
    id: String(Date.now()),
    date: new Date().toLocaleString(),
    category: category,
    title: title,
    content: content
  };
  notes.unshift(newNote);
  saveNotesToStorage();
  saveNoteToFirebase(newNote);
}

let autoSaveFullSplitTimeout = null;
function triggerFullSplitAutoSave(title, content, category) {
  if (autoSaveFullSplitTimeout) clearTimeout(autoSaveFullSplitTimeout);
  autoSaveFullSplitTimeout = setTimeout(() => {
    // Upsert logic
    const existingIndex = notes.findIndex(n => n.title === title);
    if (existingIndex !== -1) {
      notes[existingIndex].content = content;
      notes[existingIndex].date = new Date().toLocaleString();
      // Move to top
      const updatedNote = notes.splice(existingIndex, 1)[0];
      notes.unshift(updatedNote);
      saveNotesToStorage();
      saveNoteToFirebase(updatedNote);
    } else {
      addNote(title, content, category);
    }
  }, 800);
}

function deleteNote(id) {
  notes = notes.filter(n => n.id !== id);
  saveNotesToStorage();
  deleteNoteFromFirebase(id);
}

function renderNotes() {
  const emptyEl = document.getElementById('notes-list-empty');
  const listEl = document.getElementById('notes-list');
  if (!listEl || !emptyEl) return;

  listEl.innerHTML = '';
  
  const notesToRender = PRO_UNLOCKED ? notes : notes.slice(0, FREE_NOTES_LIMIT);
  
  if (notesToRender.length === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }
  
  emptyEl.classList.add('hidden');

  notesToRender.forEach(note => {
    const item = document.createElement('div');
    item.className = 'note-item';
    
    // Set colored border depending on category
    if (note.category === 'IPv4') {
      item.style.borderLeftColor = 'var(--accent-primary)';
    } else if (note.category === 'IPv6') {
      item.style.borderLeftColor = 'var(--accent-cyan)';
    } else {
      item.style.borderLeftColor = 'var(--accent-success)';
    }

    item.innerHTML = `
      <div class="note-meta">
        <span class="note-category badge" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-primary);">${note.category}</span>
        <span class="note-date">${note.date}</span>
      </div>
      <h3 class="note-title">${escapeHTML(note.title || 'Untitled Note')}</h3>
      <div class="note-content">${escapeHTML(note.content)}</div>
      <div class="note-actions">
        <button class="btn-action edit-btn">
          <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          <span>Edit</span>
        </button>
        <button class="btn-action copy-btn">
          <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          <span>Copy</span>
        </button>
        <button class="btn-action share-btn">
          <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg>
          <span>Share</span>
        </button>
        <button class="btn-action delete delete-btn">
          <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          <span>Delete</span>
        </button>
      </div>
    `;

    // Copy action
    item.querySelector('.copy-btn').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      navigator.clipboard.writeText(note.content).then(() => {
        const label = btn.querySelector('span');
        const origText = label.textContent;
        label.textContent = 'Copied!';
        setTimeout(() => {
          label.textContent = origText;
        }, 1500);
      });
    });

    // Share action
    item.querySelector('.share-btn').addEventListener('click', () => {
      shareText(note.title || 'Note', note.content);
    });

    // Edit action
    item.querySelector('.edit-btn').addEventListener('click', () => {
      const contentEl = item.querySelector('.note-content');
      const actionsEl = item.querySelector('.note-actions');
      const titleEl = item.querySelector('.note-title');
      
      // If already editing, exit
      if (item.classList.contains('editing')) return;
      item.classList.add('editing');

      const originalTitle = note.title || 'Untitled Note';
      const originalText = note.content;

      // Replace title element with an input box
      titleEl.outerHTML = `<input type="text" class="note-edit-title" value="${escapeHTML(originalTitle)}">`;
      const titleInput = item.querySelector('.note-edit-title');

      // Replace content element with a textarea
      contentEl.innerHTML = `<textarea class="note-edit-textarea"></textarea>`;
      const textarea = contentEl.querySelector('textarea');
      textarea.value = originalText;
      textarea.focus();

      // Change action buttons to Save and Cancel
      actionsEl.innerHTML = `
        <button class="btn-action save-btn" style="color: var(--accent-cyan);">
          <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          <span>Save</span>
        </button>
        <button class="btn-action cancel-btn">
          <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          <span>Cancel</span>
        </button>
      `;

      // Save listener
      actionsEl.querySelector('.save-btn').addEventListener('click', () => {
        const newTitle = titleInput.value.trim() || 'Untitled Note';
        const newText = textarea.value.trim();
        if (newText !== '') {
          note.title = newTitle;
          note.content = newText;
          note.date = new Date().toLocaleString() + ' (Edited)';
          saveNotesToStorage();
        } else {
          deleteNote(note.id);
        }
      });

      // Cancel listener
      actionsEl.querySelector('.cancel-btn').addEventListener('click', () => {
        item.classList.remove('editing');
        renderNotes();
      });
    });

    // Delete action
    item.querySelector('.delete-btn').addEventListener('click', () => {
      deleteNote(note.id);
    });

    listEl.appendChild(item);
  });

  if (!PRO_UNLOCKED && notes.length >= FREE_NOTES_LIMIT) {
    showNotesLimitBanner();
  }
}

// --- HISTORY ENGINE ---

let historyItems = [];
let historyTimer = null;

function loadHistory() {
  const stored = SafeStorage.getItem('isubnet_history_' + currentUserId);
  if (stored) {
    try {
      historyItems = JSON.parse(stored);
      if (!Array.isArray(historyItems)) historyItems = [];
    } catch (e) {
      historyItems = [];
    }
  } else {
    if (currentUserId === 'local') {
      const legacy = SafeStorage.getItem('isubnet_history');
      if (legacy) {
        try {
          historyItems = JSON.parse(legacy);
          if (!Array.isArray(historyItems)) historyItems = [];
          SafeStorage.setItem('isubnet_history_local', legacy);
          SafeStorage.removeItem('isubnet_history');
        } catch (e) {
          historyItems = [];
        }
      } else {
        historyItems = [];
      }
    } else {
      historyItems = [];
    }
  }
  renderHistory();
}

function saveHistoryToStorage() {
  SafeStorage.setItem('isubnet_history_' + currentUserId, JSON.stringify(historyItems));
  if (currentUserId !== 'local') {
    SafeStorage.setItem('isubnet_history_local', JSON.stringify(historyItems)); // Save all, do not slice
  }
  renderHistory();
}

function recordHistoryDebounced(type, data, details) {
  if (historyTimer) clearTimeout(historyTimer);
  historyTimer = setTimeout(() => {
    // Avoid duplicate records
    if (historyItems.length > 0) {
       const last = historyItems[0];
       if (last.type === type && JSON.stringify(last.data) === JSON.stringify(data)) {
         return;
       }
    }

    const newItem = {
      id: Date.now().toString(),
      type: type,
      data: data,
      details: details,
      date: (function() {
        const now = new Date();
        const d = now.getDate();
        const m = now.getMonth() + 1;
        const y = now.getFullYear();
        const dd = d < 10 ? '0' + d : d;
        const mm = m < 10 ? '0' + m : m;
        const hh = now.getHours();
        const min = now.getMinutes();
        const hoursFormatted = hh < 10 ? '0' + hh : hh;
        const minsFormatted = min < 10 ? '0' + min : min;
        return `${dd}/${mm}/${y} ${hoursFormatted}:${minsFormatted}`;
      })()
    };

    historyItems.unshift(newItem);
    // Keep max 50 items total in local array/storage to avoid massive files
    if (historyItems.length > 50) {
      historyItems = historyItems.slice(0, 50);
    }
    saveHistoryToStorage();
    saveHistoryToFirebase(newItem);

    let cCount = parseInt(SafeStorage.getItem('isubnet_review_calc_count') || '0', 10);
    SafeStorage.setItem('isubnet_review_calc_count', (cCount + 1).toString());
    
    let reason = '';
    if (type === 'Split' && typeof currentSplitMethod !== 'undefined' && currentSplitMethod === 'vlsm') {
      reason = 'vlsm';
    }
    maybeRequestReview(reason);
  }, 1200);
}

function deleteHistoryItem(id) {
  historyItems = historyItems.filter(item => item.id !== id);
  saveHistoryToStorage();
  // Optional: delete individual document in Firebase if real Firebase enabled
  if (useRealFirebase) {
    const user = firebase.auth().currentUser;
    if (user) {
      db.collection("users").doc(user.uid).collection("history").doc(id).delete()
        .catch(err => console.error("Error deleting history:", err));
    }
  }
}

async function clearHistory() {
  if (await showConfirmDialog("Are you sure you want to clear all history?", { confirmText: "Clear All", cancelText: "Cancel" })) {
    historyItems = [];
    saveHistoryToStorage();
    clearHistoryFromFirebase();
  }
}

function restoreHistoryItem(id) {
  const item = historyItems.find(x => x.id === id);
  if (!item) return;

  if (item.type === 'IPv4') {
    document.getElementById('ipv4-address').value = item.data.ip;
    document.getElementById('ipv4-address').dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('ipv4-cidr').value = item.data.cidr;
    document.getElementById('ipv4-hosts').value = item.data.hosts;
    calculateIPv4();
    // Navigate tab
    // Navigate tab
    const tabBtn = document.querySelector('.tab-btn[data-target="calculator-tab"]');
    if (tabBtn) tabBtn.click();
    const subBtn = document.querySelector('.calc-sub-tab-btn[data-sub-target="ipv4-panel"]');
    if (subBtn) subBtn.click();
  } else if (item.type === 'IPv6') {
    document.getElementById('ipv6-address').value = item.data.ip;
    document.getElementById('ipv6-address').dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('ipv6-cidr').value = item.data.cidr;
    document.getElementById('ipv6-hosts').value = item.data.hosts;
    calculateIPv6();
    // Navigate tab
    const tabBtn = document.querySelector('.tab-btn[data-target="calculator-tab"]');
    if (tabBtn) tabBtn.click();
    const subBtn = document.querySelector('.calc-sub-tab-btn[data-sub-target="ipv6-panel"]');
    if (subBtn) subBtn.click();
  } else if (item.type === 'Converter') {
    document.getElementById('converter-input').value = item.data.input;
    document.getElementById('converter-input').dispatchEvent(new Event('input', { bubbles: true }));
    runConverter();
    // Navigate tab
    const tabBtn = document.querySelector('.tab-btn[data-target="converter-tab"]');
    if (tabBtn) tabBtn.click();
  } else if (item.type === 'Splitter') {
    document.getElementById('split-base-ip').value = item.data.baseIp;
    document.getElementById('split-base-ip').dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('split-base-cidr').value = item.data.baseCidr;
    
    const methodBtns = document.querySelectorAll('.method-btn');
    methodBtns.forEach(btn => {
      if (btn.getAttribute('data-method') === item.data.method) {
        btn.click();
      }
    });
    
    runSplitter();
    
    const tabBtn = document.querySelector('.tab-btn[data-target="splitter-tab"]');
    if (tabBtn) tabBtn.click();
  }
}

function renderHistory() {
  const emptyEl = document.getElementById('history-list-empty');
  const listEl = document.getElementById('history-list');
  if (!listEl || !emptyEl) return;

  listEl.innerHTML = '';
  
  const historyToRender = PRO_UNLOCKED ? historyItems : historyItems.slice(0, FREE_HISTORY_LIMIT);
  
  if (historyToRender.length === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }
  
  emptyEl.classList.add('hidden');

  historyToRender.forEach(item => {
    const row = document.createElement('div');
    row.className = 'history-item';
    
    // Add colored borders based on item type
    if (item.type === 'IPv4') {
      row.style.borderLeft = '3px solid var(--accent-primary)';
    } else if (item.type === 'IPv6') {
      row.style.borderLeft = '3px solid var(--accent-cyan)';
    } else {
      row.style.borderLeft = '3px solid var(--accent-success)';
    }

    const typeLower = item.type.toLowerCase();

    row.innerHTML = `
      <div class="history-item-left">
        <span class="history-item-type ${typeLower}">${item.type}</span>
        <span class="history-item-details">${escapeHTML(item.details)}</span>
        <span class="history-item-date">${item.date}</span>
      </div>
      <div class="history-item-right">
        <button class="btn-action restore-btn">
          <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24"><path fill="currentColor" d="M19 12h-2c0-2.76-2.24-5-5-5s-5 2.24-5 5H5l4 4 4-4h-3c0-1.66 1.34-3 3-3s3 1.34 3 3h2c0-3.87-3.13-7-7-7s-7 3.13-7 7H2l4 4 4-4H7c0-2.76 2.24-5 5-5s5 2.24 5 5z"/></svg>
          <span>Restore</span>
        </button>
        <button class="btn-action delete-btn" style="color: #EF4444;">
          <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          <span>Delete</span>
        </button>
      </div>
    `;

    // Make clicking the row body trigger restore, except if clicking buttons
    row.addEventListener('click', (e) => {
      if (e.target.closest('.btn-action')) return;
      restoreHistoryItem(item.id);
    });

    row.querySelector('.restore-btn').addEventListener('click', () => {
      restoreHistoryItem(item.id);
    });

    row.querySelector('.delete-btn').addEventListener('click', () => {
      deleteHistoryItem(item.id);
    });

    listEl.appendChild(row);
  });

  if (!PRO_UNLOCKED && historyItems.length >= FREE_HISTORY_LIMIT) {
    showHistoryLimitBanner();
  }
}

// --- Native-Feeling UI Primitives ---
let _toastTimeout = null;
function showToast(message, options = {}) {
  const toast = document.getElementById('global-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  // force reflow
  void toast.offsetWidth;
  toast.style.opacity = '1';
  
  if (_toastTimeout) clearTimeout(_toastTimeout);
  _toastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.classList.add('hidden'), 300); // Wait for transition
  }, options.duration || 3000);
}

function showConfirmDialog(message, options = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('global-confirm-modal');
    if (!modal) return resolve(window.confirm(message)); // Fallback
    
    document.getElementById('global-confirm-msg').textContent = message;
    const btnCancel = document.getElementById('global-confirm-cancel');
    const btnOk = document.getElementById('global-confirm-ok');
    
    btnCancel.textContent = options.cancelText || 'Cancel';
    btnOk.textContent = options.confirmText || 'OK';
    
    const cleanup = () => {
      modal.classList.add('hidden');
      btnCancel.removeEventListener('click', onCancel);
      btnOk.removeEventListener('click', onOk);
    };
    
    const onCancel = () => { cleanup(); resolve(false); };
    const onOk = () => { cleanup(); resolve(true); };
    
    btnCancel.addEventListener('click', onCancel);
    btnOk.addEventListener('click', onOk);
    
    modal.classList.remove('hidden');
  });
}

function showErrorDialog(message, options = {}) {
  const modal = document.getElementById('global-error-modal');
  if (!modal) return window.alert(message); // Fallback
  
  const iconEl = document.getElementById('global-error-icon');
  const msgEl = document.getElementById('global-error-msg');
  const isInfo = Boolean(options && options.variant === 'info');
  if (iconEl) {
    if (isInfo) {
      iconEl.innerHTML = '<svg style="width: 34px; height: 34px; color: var(--accent-primary); display: inline-block; vertical-align: middle;" viewBox="0 0 24 24" aria-label="Info"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';
    } else {
      iconEl.textContent = '⚠️';
    }
  }
  if (msgEl) {
    msgEl.style.textAlign = isInfo ? 'left' : '';
    msgEl.style.whiteSpace = isInfo ? 'pre-line' : '';
    msgEl.textContent = message;
  }
  const btnOk = document.getElementById('global-error-ok');
  
  const cleanup = () => {
    modal.classList.add('hidden');
    if (iconEl) iconEl.textContent = '⚠️';
    if (msgEl) {
      msgEl.style.textAlign = '';
      msgEl.style.whiteSpace = '';
    }
    btnOk.removeEventListener('click', onOk);
  };
  const onOk = () => { cleanup(); };
  
  btnOk.addEventListener('click', onOk);
  modal.classList.remove('hidden');
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Format IPv4 data to string
function saveIpv4Note() {
  const ip = document.getElementById('ipv4-address').value.trim();
  const cidr = document.getElementById('res-cidr').textContent;
  const mask = document.getElementById('res-mask').textContent;
  const wildcard = document.getElementById('res-wildcard').textContent;
  const network = document.getElementById('res-network').textContent;
  const broadcast = document.getElementById('res-broadcast').textContent;
  const range = document.getElementById('res-range').textContent;
  const hosts = document.getElementById('res-hosts').textContent;
  const classText = document.getElementById('ipv4-badge-class').textContent;
  const typeText = document.getElementById('res-type').textContent;

  const noteTitle = `IPv4 Subnet: ${ip}${cidr}`;
  const noteContent = `• Subnet Mask: ${mask}
• Wildcard Mask: ${wildcard}
• Network Address: ${network}
• Broadcast Address: ${broadcast}
• Usable IP Range: ${range}
• Total Usable Hosts: ${hosts}
• Network Class & Type: ${classText}, ${typeText}`;

  addNote(noteTitle, noteContent, 'IPv4');
  maybeRequestReview('save_note');
  switchToNotesTab();
}

// Format IPv6 data to string
function saveIpv6Note() {
  const compressed = document.getElementById('res6-compressed').innerText;
  const prefix = document.getElementById('res6-prefix').textContent;
  const netPrefix = document.getElementById('res6-net-prefix').innerText;
  const start = document.getElementById('res6-start').innerText;
  const end = document.getElementById('res6-end').innerText;
  const total = document.getElementById('res6-total').textContent;
  const typeText = document.getElementById('ipv6-badge-type').textContent;

  const noteTitle = `IPv6 Prefix: ${compressed}${prefix}`;
  const noteContent = `• Network Prefix: ${netPrefix}
• IP Range Start: ${start}
• IP Range End: ${end}
• Total Addresses: ${total}
• Address Type: ${typeText}`;

  addNote(noteTitle, noteContent, 'IPv6');
  maybeRequestReview('save_note');
  switchToNotesTab();
}

// Format Converter data to string
function saveConvNote() {
  const type = document.getElementById('conv-type').textContent;
  const prefix = document.getElementById('conv-prefix').textContent;
  const mask = document.getElementById('conv-mask').textContent;
  const wildcard = document.getElementById('conv-wildcard').textContent;
  const isIpv6 = (type.indexOf('IPv6') !== -1);
  
  let noteTitle = `Converter: ${type} (${prefix})`;
  let noteContent = '';
  
  if (isIpv6) {
    const ipv6Mask = document.getElementById('conv-mask').textContent;
    noteContent = `• Prefix Length: ${prefix}
• Host Wildcard: ${wildcard}
• Routing Prefix Mask: ${ipv6Mask}`;
  } else {
    const binary = document.getElementById('conv-binary').innerText;
    noteContent = `• Prefix Length: ${prefix}
• Subnet Mask: ${mask}
• Wildcard Mask: ${wildcard}
• Binary Representation: ${binary}`;
  }
  
  addNote(noteTitle, noteContent, isIpv6 ? 'IPv6' : 'IPv4');
  maybeRequestReview('save_note');
  switchToNotesTab();
}

function saveConvSubnetNote() {
  const inputVal = document.getElementById('converter-input').value.trim();
  const subnetResults = document.getElementById('converter-subnet-results');
  if (!subnetResults) return;

  const items = subnetResults.querySelectorAll('.result-item');
  let noteContent = '';
  items.forEach(item => {
    const label = item.querySelector('.label').textContent.trim();
    const val = item.querySelector('.val').textContent.trim();
    noteContent += `• ${label}: ${val}\n`;
  });

  const noteTitle = `Subnet Calc: ${inputVal}`;
  // Detect if IPv6 for note category sorting
  const isIpv6 = (inputVal.includes(':'));
  addNote(noteTitle, noteContent.trim(), isIpv6 ? 'IPv6' : 'IPv4');
  maybeRequestReview('save_note');
  switchToNotesTab();
}

function switchToNotesTab() {
  const noteTabBtn = document.querySelector('.tab-btn[data-target="notes-tab"]');
  if (noteTabBtn) noteTabBtn.click();
}

// --- SHARING UTILITIES ---

const SHARE_DOUBLE_TAP_MS = 1500;
const _lastShareTapByKey = Object.create(null);

function isShareTapDuplicate(key) {
  const k = String(key || 'default');
  const now = Date.now();
  const prev = _lastShareTapByKey[k] || 0;
  if (prev > 0 && (now - prev) >= 0 && (now - prev) < SHARE_DOUBLE_TAP_MS) {
    return true;
  }
  _lastShareTapByKey[k] = now;
  return false;
}

async function shareText(title, text, skipDuplicateGuard = false) {
  if (!skipDuplicateGuard && isShareTapDuplicate('shareText:' + String(title || 'default'))) {
    if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
      window.debugLog('[Share] ui: share tap ignored | reason=double-tap');
    }
    return;
  }
  if (!PRO_UNLOCKED) {
    text = text + "\n\n— Calculated with iSubnet";
  }

  const isNative = window.Capacitor && window.Capacitor.isNativePlatform();
  if (isNative) {
    try {
      const { Share } = window.Capacitor.Plugins;
      await Share.share({
        title: title,
        text: text
      });
    } catch (e) {
      // Android's Capacitor Share plugin can reject this promise even when the
      // OS share sheet was already shown and the user genuinely completed the
      // share - the chooser intent doesn't always report its result back to the
      // calling activity reliably. Falling through to the clipboard-copy
      // fallback below (meant only for platforms with no native share at all)
      // would overwrite the user's clipboard and show a misleading "copied to
      // clipboard" toast right after a real share, so on native platforms we
      // just log this and stop either way.
      console.error("Capacitor Share failed:", e);
    }
    return;
  }

  if (navigator.share) {
    navigator.share({
      title: title,
      text: text
    }).catch(err => {
      console.log('Share failed:', err);
    });
  } else {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${title} copied to clipboard!`);
    }).catch(err => {
      console.error("Clipboard write failed:", err);
      showErrorDialog("Failed to copy to clipboard.");
    });
  }
}

function shareIpv4Result() {
  const ip = document.getElementById('ipv4-address').value.trim();
  const cidr = document.getElementById('res-cidr').textContent;
  const mask = document.getElementById('res-mask').textContent;
  const wildcard = document.getElementById('res-wildcard').textContent;
  const network = document.getElementById('res-network').textContent;
  const broadcast = document.getElementById('res-broadcast').textContent;
  const range = document.getElementById('res-range').textContent;
  const hosts = document.getElementById('res-hosts').textContent;
  const classText = document.getElementById('ipv4-badge-class').textContent;
  const typeText = document.getElementById('res-type').textContent;

  const title = `IPv4 Subnet: ${ip}${cidr}`;
  const text = `IPv4 Subnet Calculation:
• IP Address: ${ip}
• Subnet CIDR: ${cidr}
• Subnet Mask: ${mask}
• Wildcard Mask: ${wildcard}
• Network Address: ${network}
• Broadcast Address: ${broadcast}
• Usable IP Range: ${range}
• Total Usable Hosts: ${hosts}
• Network Class & Type: ${classText}, ${typeText}`;

  shareText(title, text);
}

function shareIpv6Result() {
  const input = document.getElementById('ipv6-address').value.trim();
  const compressed = document.getElementById('res6-compressed').innerText;
  const prefix = document.getElementById('res6-prefix').textContent;
  const netPrefix = document.getElementById('res6-net-prefix').innerText;
  const start = document.getElementById('res6-start').innerText;
  const end = document.getElementById('res6-end').innerText;
  const total = document.getElementById('res6-total').textContent;
  const typeText = document.getElementById('ipv6-badge-type').textContent;

  const title = `IPv6 Prefix: ${compressed}${prefix}`;
  const text = `IPv6 Subnet Calculation:
• Input Address: ${input}
• Compressed: ${compressed}
• Prefix Length: ${prefix}
• Network Prefix: ${netPrefix}
• IP Range Start: ${start}
• IP Range End: ${end}
• Total Addresses: ${total}
• Address Type: ${typeText}`;

  shareText(title, text);
}

function shareConvResult() {
  const type = document.getElementById('conv-type').textContent;
  const prefix = document.getElementById('conv-prefix').textContent;
  const mask = document.getElementById('conv-mask').textContent;
  const wildcard = document.getElementById('conv-wildcard').textContent;
  const isIpv6 = (type.indexOf('IPv6') !== -1);
  
  const title = `Converter: ${type} (${prefix})`;
  let text = '';
  
  if (isIpv6) {
    const ipv6Mask = document.getElementById('conv-mask').textContent;
    text = `Converter Results (${type}):
• Prefix Length: ${prefix}
• Host Wildcard: ${wildcard}
• Routing Prefix Mask: ${ipv6Mask}`;
  } else {
    const binary = document.getElementById('conv-binary').innerText;
    text = `Converter Results (${type}):
• Prefix Length: ${prefix}
• Subnet Mask: ${mask}
• Wildcard Mask: ${wildcard}
• Binary Representation: ${binary}`;
  }
  
  shareText(title, text);
}

function shareConvSubnetResult() {
  const inputVal = document.getElementById('converter-input').value.trim();
  const subnetResults = document.getElementById('converter-subnet-results');
  if (!subnetResults) return;

  const items = subnetResults.querySelectorAll('.result-item');
  let text = `Subnet Calculation Results (${inputVal}):\n`;
  items.forEach(item => {
    const label = item.querySelector('.label').textContent.trim();
    const val = item.querySelector('.val').textContent.trim();
    text += `• ${label}: ${val}\n`;
  });

  shareText(`iSubnet Calc - ${inputVal}`, text.trim());
}

// --- REFERENCE GUIDE COPY & SHARE UTILITIES ---

const refClassesText = `IPv4 Address Classes Reference:
• Class A: 1.0.0.0 - 126.255.255.255 (Mask: 255.0.0.0 /8)
• Class B: 128.0.0.0 - 191.255.255.255 (Mask: 255.255.0.0 /16)
• Class C: 192.0.0.0 - 223.255.255.255 (Mask: 255.255.255.0 /24)
• Class D (Multicast): 224.0.0.0 - 239.255.255.255 (Mask: N/A)
• Class E (Research): 240.0.0.0 - 255.255.255.255 (Mask: N/A)`;

const refPrivateText = `Private IP Ranges Reference (RFC 1918):
• Class A Private: 10.0.0.0 - 10.255.255.255 (/8)
• Class B Private: 172.16.0.0 - 172.31.255.255 (/12)
• Class C Private: 192.168.0.0 - 192.168.255.255 (/16)
• Loopback Localhost: 127.0.0.0 - 127.255.255.255 (/8)
• Link-Local (APIPA): 169.254.0.0 - 169.254.255.255 (/16)`;
const refPublicText = `Public IP Ranges Reference:
• Class A Public: 1.0.0.0 - 9.255.255.255 (150,994,944 addresses)
• Class A Public: 11.0.0.0 - 100.63.255.255 (1,497,366,528 addresses)
• Class A Public: 100.128.0.0 - 126.255.255.255 (444,596,224 addresses)
• Class B Public: 128.0.0.0 - 169.253.255.255 (704,512,000 addresses)
• Class B Public: 169.255.0.0 - 172.15.255.255 (34,668,544 addresses)
• Class B Public: 172.32.0.0 - 191.255.255.255 (333,447,168 addresses)
• Class C Public: 192.0.1.0 - 192.0.1.255 (256 addresses)
• Class C Public: 192.0.3.0 - 192.88.98.255 (5,791,744 addresses)
• Class C Public: 192.88.100.0 - 192.167.255.255 (5,217,280 addresses)
• Class C Public: 192.169.0.0 - 198.17.255.255 (90,767,360 addresses)
• Class C Public: 198.20.0.0 - 198.51.99.255 (2,057,216 addresses)
• Class C Public: 198.51.101.0 - 203.0.112.255 (80,546,816 addresses)
• Class C Public: 203.0.114.0 - 223.255.255.255 (352,292,352 addresses)`;


const refIpv6Text = `IPv6 Common Address Types Reference:
• Global Unicast (Public): 2000::/3
• Link-Local (Auto-configured): fe80::/10
• Unique Local (Private LAN): fc00::/7
• Loopback Address: ::1/128
• Multicast Range: ff00::/8`;

const refCompressionText = `IPv6 Compression Rules (RFC 5952) Reference:
• Rule 1 (Omit Leading Zeros): Omit leading zeros in each 16-bit field (e.g. 0db8 -> db8, 0000 -> 0).
• Rule 2 (Compress Zero Runs): Replace consecutive all-zero fields with a single "::" (can only be done once per address).
• Rule 3 (RFC 5952 Canonical Rules):
  - Longest Run: Compress the longest run of consecutive all-zero fields.
  - Leftmost First: If zero runs are equal in length, compress the leftmost (first) run.
  - No Single Zeros: Do not shorten a single all-zero field to "::".
  - Lowercase: Always write hex characters in lowercase.
• Example:
  - Uncompressed: 2001:0db8:0000:0000:0001:0000:0000:0000
  - RFC 5952 Canonical: 2001:db8:0:0:1::`;

const refPortsText = `Common Ports Reference:
- 20: FTP (Data) - TCP
- 21: FTP (Control) - TCP
- 22: SSH - TCP
- 23: Telnet - TCP
- 25: SMTP - TCP
- 43: WHOIS - TCP
- 53: DNS - TCP/UDP
- 67: DHCP (Server) - UDP
- 68: DHCP (Client) - UDP
- 69: TFTP - UDP
- 80: HTTP - TCP
- 110: POP3 - TCP
- 119: NNTP - TCP
- 123: NTP - UDP
- 143: IMAP - TCP
- 161: SNMP - UDP
- 162: SNMP Trap - UDP
- 179: BGP - TCP
- 389: LDAP - TCP
- 443: HTTPS - TCP
- 445: SMB - TCP
- 465: SMTPS - TCP
- 514: Syslog - UDP
- 587: SMTP (Submission) - TCP
- 636: LDAPS - TCP
- 993: IMAPS - TCP
- 995: POP3S - TCP
- 1433: Microsoft SQL Server - TCP
- 1521: Oracle DB - TCP
- 3306: MySQL - TCP
- 3389: RDP - TCP
- 5060: SIP - UDP
- 5061: SIP (TLS) - TCP
- 5432: PostgreSQL - TCP
- 5900: VNC - TCP
- 6379: Redis - TCP
- 8080: HTTP Proxy / Alt - TCP
- 8443: HTTPS Alt - TCP`;

function shareRefCompression() {
  shareText('IPv6 Compression Rules', refCompressionText);
}

function copyTextWithToast(btnId, text) {
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById(btnId);
    const label = btn.querySelector('span');
    const origText = label.textContent;
    label.textContent = 'Copied!';
    setTimeout(() => {
      label.textContent = origText;
    }, 1500);
  });
}

function shareRefClasses() {
  shareText('IPv4 Address Classes', refClassesText);
}
function shareRefPrivate() {
  shareText('Private IP Ranges', refPrivateText);
}
function shareRefPublic() {
  shareText('Public IP Ranges', refPublicText);
}

function shareRefIpv6() {
  shareText('IPv6 Address Types', refIpv6Text);
}
function shareRefPorts() {
  shareText('Common Ports', refPortsText);
}

// --- SETUP EVENT LISTENERS ---

function setupEventListeners() {
  document.getElementById('btn-calc-ipv4').addEventListener('click', calculateIPv4);
  document.getElementById('btn-calc-ipv6').addEventListener('click', calculateIPv6);
  
  // Real-time calculation triggers
  document.getElementById('ipv4-address').addEventListener('input', (e) => {
    if (e.target.value.includes(',')) {
      const pos = e.target.selectionStart;
      e.target.value = e.target.value.replace(/,/g, '.');
      e.target.selectionStart = e.target.selectionEnd = pos;
    }
    stripDisallowedChars(e.target, /[0-9./]/);
    collapseDuplicateDots(e.target);
  });
  document.getElementById('ipv4-address').addEventListener('input', calculateIPv4);
  document.getElementById('ipv4-cidr').addEventListener('input', calculateIPv4);
  document.getElementById('ipv4-hosts').addEventListener('input', calculateIPv4);
  
  document.getElementById('ipv6-address').addEventListener('input', calculateIPv6);
  document.getElementById('ipv6-cidr').addEventListener('input', calculateIPv6);
  document.getElementById('ipv6-hosts').addEventListener('input', calculateIPv6);
  
  // Save to notes event bindings
  document.getElementById('btn-save-notes-ipv4').addEventListener('click', saveIpv4Note);
  document.getElementById('btn-save-notes-ipv6').addEventListener('click', saveIpv6Note);
  document.getElementById('btn-save-notes-conv').addEventListener('click', saveConvNote);
  
  // Share event bindings
  document.getElementById('btn-share-ipv4').addEventListener('click', shareIpv4Result);
  document.getElementById('btn-share-ipv6').addEventListener('click', shareIpv6Result);
  document.getElementById('btn-share-conv').addEventListener('click', shareConvResult);
  document.getElementById('btn-save-notes-conv-subnet').addEventListener('click', saveConvSubnetNote);
  document.getElementById('btn-share-conv-subnet').addEventListener('click', shareConvSubnetResult);

  // Base converter save / share buttons
  const btnSaveBase = document.getElementById('btn-save-notes-base');
  if (btnSaveBase) {
    btnSaveBase.addEventListener('click', () => {
      const bin = document.getElementById('base-bin-input').value.trim();
      const dec = document.getElementById('base-dec-input').value.trim();
      const oct = document.getElementById('base-oct-input').value.trim();
      const hex = document.getElementById('base-hex-input').value.trim();
      if (!dec && !bin) return;
      const label = dec ? `Base Converter: ${dec} (DEC)` : `Base Converter: ${bin} (BIN)`;
      const body = `BIN: ${bin}\nOCT: ${oct}\nDEC: ${dec}\nHEX: ${hex}`;
      addNote(label, body, 'Converter');
      maybeRequestReview('save_note');
      switchToNotesTab();
      flashConfirm(btnSaveBase, btnSaveBase.innerHTML);
    });
  }
  const btnShareBase = document.getElementById('btn-share-base');
  if (btnShareBase) {
    btnShareBase.addEventListener('click', () => {
      const bin = document.getElementById('base-bin-input').value.trim();
      const dec = document.getElementById('base-dec-input').value.trim();
      const oct = document.getElementById('base-oct-input').value.trim();
      const hex = document.getElementById('base-hex-input').value.trim();
      if (!dec && !bin) return;
      const text = `iSubnet – Number Base Converter\nBIN: ${bin}\nOCT: ${oct}\nDEC: ${dec}\nHEX: ${hex}`;
      shareText('iSubnet Base Conversion', text);
    });
  }
  
  // Reference guide copy & share bindings
  document.getElementById('btn-copy-ref-classes').addEventListener('click', () => {
    copyTextWithToast('btn-copy-ref-classes', refClassesText);
  });
  document.getElementById('btn-share-ref-classes').addEventListener('click', shareRefClasses);
  
  document.getElementById('btn-copy-ref-private').addEventListener('click', () => {
    copyTextWithToast('btn-copy-ref-private', refPrivateText);
  });
  document.getElementById('btn-share-ref-private').addEventListener('click', shareRefPrivate);
  document.getElementById('btn-copy-ref-public').addEventListener('click', () => {
    copyTextWithToast('btn-copy-ref-public', refPublicText);
  });
  document.getElementById('btn-share-ref-public').addEventListener('click', shareRefPublic);

  
  document.getElementById('btn-copy-ref-ipv6').addEventListener('click', () => {
    copyTextWithToast('btn-copy-ref-ipv6', refIpv6Text);
  });
  document.getElementById('btn-share-ref-ipv6').addEventListener('click', shareRefIpv6);

  document.getElementById('btn-copy-ref-compression').addEventListener('click', () => {
    copyTextWithToast('btn-copy-ref-compression', refCompressionText);
  });
  document.getElementById('btn-share-ref-compression').addEventListener('click', shareRefCompression);
  const btnCopyRefPorts = document.getElementById('btn-copy-ref-ports');
  if (btnCopyRefPorts) {
    btnCopyRefPorts.addEventListener('click', () => copyTextWithToast('btn-copy-ref-ports', refPortsText));
  }
  const btnShareRefPorts = document.getElementById('btn-share-ref-ports');
  if (btnShareRefPorts) btnShareRefPorts.addEventListener('click', shareRefPorts);
  
  document.getElementById('btn-save-note-manual').addEventListener('click', () => {
    const titleInput = document.getElementById('note-title');
    const txtInput = document.getElementById('note-text');
    
    const titleVal = titleInput.value.trim() || 'Manual Note';
    const txtVal = txtInput.value.trim();
    
    if (txtVal === '') return;
    
    addNote(titleVal, txtVal, 'Manual');
    
    titleInput.value = '';
    txtInput.value = '';
  });
  
  // Enter key event binding for inputs
  document.getElementById('ipv4-address').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') calculateIPv4();
  });
  document.getElementById('ipv4-hosts').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') calculateIPv4();
  });
  document.getElementById('ipv6-address').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') calculateIPv6();
  });
  document.getElementById('ipv6-hosts').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') calculateIPv6();
  });
}

// --- NUMBER BASE CONVERTER LOGIC ---

/**
 * Converts a number between base 2, 8, 10 and 16.
 * Uses BigInt to handle arbitrarily large numbers without precision loss.
 * @param {string} value  - The string representation of the number.
 * @param {number} fromBase - The source base (2, 8, 10, or 16).
 * @returns {{ bin: string, oct: string, dec: string, hex: string } | null}
 */
function convertBase(value, fromBase) {
  if (!value || value.trim() === '') return null;
  const v = value.trim().toUpperCase();
  // Validate characters per base
  const validators = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^[0-9]+$/, 16: /^[0-9A-F]+$/ };
  if (!validators[fromBase] || !validators[fromBase].test(v)) return null;
  try {
    // Parse digit-by-digit using BigInt for unlimited precision
    const base = BigInt(fromBase);
    let decimal = BigInt(0);
    const digits = '0123456789ABCDEF';
    for (const ch of v) {
      decimal = decimal * base + BigInt(digits.indexOf(ch));
    }
    return {
      bin: decimal.toString(2),
      oct: decimal.toString(8),
      dec: decimal.toString(10),
      hex: decimal.toString(16).toUpperCase()
    };
  } catch (e) {
    return null;
  }
}

let _baseConverting = false; // guard against re-entrant updates

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

// IP address support for the Number Base Converter: an IPv4 address typed in Decimal (or as dotted groups in
// any base) and an IPv6 address typed in Hex (colon notation, or dotted groups) are converted group by group.
// Returns { status: 'plain' | 'incomplete' | 'invalid' | 'v4' | 'v6', groups }.
function parseBaseGroups(raw, base) {
  const v = String(raw).trim();
  const hasDot = v.indexOf('.') !== -1;
  const hasColon = v.indexOf(':') !== -1;
  if (!hasDot && !hasColon) return { status: 'plain' };
  const digitRe = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^[0-9]+$/, 16: /^[0-9a-fA-F]+$/ }[base];
  if (hasColon) {
    if (base !== 16) return { status: 'invalid' };
    if (!/^[0-9a-fA-F:.]+$/.test(v) || v.indexOf(':::') !== -1) return { status: 'invalid' };
    const big = parseIPv6(v);
    if (big !== null) {
      const groups = [];
      for (let i = 7; i >= 0; i--) groups.push(Number((big >> BigInt(i * 16)) & BigInt(0xffff)));
      return { status: 'v6', groups: groups };
    }
    const parts = v.split(':');
    const last = parts[parts.length - 1];
    const tailV4 = last.indexOf('.') !== -1;
    const tailOk = /^[0-9]{0,3}(\.[0-9]{0,3}){0,3}$/.test(last);
    const body = tailV4 ? parts.slice(0, -1) : parts;
    if (body.some((p) => p.length > 4)) return { status: 'invalid' };
    if (tailV4 && !tailOk) return { status: 'invalid' };
    if (v.indexOf('::') !== -1) return tailV4 ? { status: 'incomplete' } : { status: 'invalid' };
    if (parts.length > 8) return { status: 'invalid' };
    return { status: 'incomplete' };
  }
  const parts = v.split('.');
  if (parts.length > 8) return { status: 'invalid' };
  const vals = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p === '') {
      if (i === parts.length - 1) continue;
      return { status: 'invalid' };
    }
    if (p.length > 20 || !digitRe.test(p)) return { status: 'invalid' };
    const n = parseInt(p, base);
    if (n > 0xffff) return { status: 'invalid' };
    vals.push(n);
  }
  const endsOpen = parts[parts.length - 1] === '';
  if (!endsOpen && parts.length === 4) {
    return vals.every((n) => n <= 255) ? { status: 'v4', groups: vals } : { status: 'invalid' };
  }
  if (!endsOpen && parts.length === 8) return { status: 'v6', groups: vals };
  return { status: 'incomplete' };
}

function formatBaseGroups(info) {
  const v4 = info.status === 'v4';
  const binW = v4 ? 8 : 16;
  const octW = v4 ? 3 : 6;
  const hexW = v4 ? 2 : 4;
  const g = info.groups;
  return {
    bin: g.map((n) => n.toString(2).padStart(binW, '0')).join('.'),
    oct: g.map((n) => n.toString(8).padStart(octW, '0')).join('.'),
    dec: g.map((n) => String(n)).join('.'),
    hex: g.map((n) => n.toString(16).toUpperCase().padStart(hexW, '0')).join('.')
  };
}

function runBaseConverter(sourceId, fromBase) {
  logBaseConverterDebounced(sourceId);
  if (_baseConverting) return;
  _baseConverting = true;

  const inputs = {
    bin: document.getElementById('base-bin-input'),
    oct: document.getElementById('base-oct-input'),
    dec: document.getElementById('base-dec-input'),
    hex: document.getElementById('base-hex-input')
  };
  const errors = {
    bin: document.getElementById('base-bin-error'),
    oct: document.getElementById('base-oct-error'),
    dec: document.getElementById('base-dec-error'),
    hex: document.getElementById('base-hex-error')
  };

  // Clear all error states first
  Object.values(errors).forEach(el => { if (el) el.textContent = ''; });
  Object.values(inputs).forEach(el => { if (el) el.classList.remove('error'); });

  const sourceEl = inputs[sourceId];
  const rawValue = sourceEl ? sourceEl.value.trim() : '';

  if (!rawValue) {
    // If source is cleared, clear all others too
    Object.entries(inputs).forEach(([key, el]) => {
      if (el && key !== sourceId) el.value = '';
    });
    _baseConverting = false;
    return;
  }

  const grouped = parseBaseGroups(rawValue, fromBase);
  if (grouped.status === 'incomplete') {
    // Still typing an IP address: no error yet, and the other fields stay empty until it is complete.
    Object.entries(inputs).forEach(([key, el]) => {
      if (el && key !== sourceId) el.value = '';
    });
    _baseConverting = false;
    return;
  }
  let result;
  if (grouped.status === 'plain') result = convertBase(rawValue, fromBase);
  else if (grouped.status === 'invalid') result = null;
  else result = formatBaseGroups(grouped);

  if (!result) {
    // Show error on the active field
    const errorEl = errors[sourceId];
    if (errorEl) {
      const baseNames = { bin: 'binary (0–1)', oct: 'octal (0–7)', dec: 'decimal (0–9)', hex: 'hex (0–9, A–F)' };
      errorEl.textContent = (grouped.status === 'invalid' && /[.:]/.test(rawValue)) ? `Invalid ${baseNames[sourceId]} value or IP address` : `Invalid ${baseNames[sourceId]} value`;
      sourceEl.classList.add('error');
    }
    _baseConverting = false;
    return;
  }

  // Fill in all other fields
  if (inputs.bin && sourceId !== 'bin') inputs.bin.value = result.bin;
  if (inputs.oct && sourceId !== 'oct') inputs.oct.value = result.oct;
  if (inputs.dec && sourceId !== 'dec') inputs.dec.value = result.dec;
  if (inputs.hex && sourceId !== 'hex') {
    if (PRO_UNLOCKED) {
      inputs.hex.value = result.hex;
    } else {
      inputs.hex.value = '🔒 Pro';
    }
  }

  _baseConverting = false;
}

function setupBaseConverter() {
  const fields = [
    { id: 'base-bin-input', key: 'bin', base: 2 },
    { id: 'base-oct-input', key: 'oct', base: 8 },
    { id: 'base-dec-input', key: 'dec', base: 10 },
    { id: 'base-hex-input', key: 'hex', base: 16 }
  ];

  fields.forEach(({ id, key, base }) => {
    const el = document.getElementById(id);
    if (!el) return;
    
    if (id === 'base-hex-input') {
      el.addEventListener('pointerdown', (e) => { if (!PRO_UNLOCKED) { if (e.cancelable) e.preventDefault(); el.blur(); showProModal(); } });
      el.addEventListener('click', () => { if (!PRO_UNLOCKED) showProModal(); });
      const hexLabel = document.querySelector('label[for="base-hex-input"], label[data-hex-label="true"]');
      if (hexLabel) {
        const onHexLabelActivate = (e) => {
          if (PRO_UNLOCKED) return;
          if (e && e.type === 'keydown') {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
          } else if (e && e.cancelable) {
            e.preventDefault();
          }
          showProModal();
        };
        hexLabel.addEventListener('click', onHexLabelActivate);
        hexLabel.addEventListener('keydown', onHexLabelActivate);
      }
      el.addEventListener('focus', () => { if (!PRO_UNLOCKED) { el.blur(); showProModal(); } });
    }
    
    el.addEventListener('input', () => runBaseConverter(key, base));
    // Force uppercase display for hex
    if (key === 'hex') {
      el.addEventListener('keyup', () => { el.value = el.value.toUpperCase(); });
    }
  });

  // Copy buttons
  const copyDefs = [
    { btnId: 'btn-copy-base-bin', inputId: 'base-bin-input' },
    { btnId: 'btn-copy-base-oct', inputId: 'base-oct-input' },
    { btnId: 'btn-copy-base-dec', inputId: 'base-dec-input' },
    { btnId: 'btn-copy-base-hex', inputId: 'base-hex-input' }
  ];
  copyDefs.forEach(({ btnId, inputId }) => {
    const btn = document.getElementById(btnId);
    const inp = document.getElementById(inputId);
    if (!btn || !inp) return;
    btn.addEventListener('click', () => {
      if (inputId === 'base-hex-input' && !PRO_UNLOCKED) {
        showProModal();
        return;
      }
      const val = inp.value.trim();
      if (!val || val === '🔒 Pro') return;
      navigator.clipboard.writeText(val).then(() => {
        const orig = btn.innerHTML;
        btn.innerHTML = '<svg style="width:11px;height:11px;" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Copied!';
        setTimeout(() => { btn.innerHTML = orig; }, 1500);
      }).catch(() => {});
    });
  });

  // Clear all button
  const clearBtn = document.getElementById('btn-clear-base-converter');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      _baseConverting = false;
      ['base-bin-input', 'base-oct-input', 'base-dec-input', 'base-hex-input'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.value = ''; el.classList.remove('error'); }
      });
      ['base-bin-error', 'base-oct-error', 'base-dec-error', 'base-hex-error'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '';
      });
    });
  }
}

// --- WILDCARD & PREFIX CONVERTER LOGIC ---


function runSubnetCalculationIPv4(ipInput, cidrInput) {
  const ipVal = ipToUint32(ipInput);
  const maskVal = cidrInput === 0 ? 0 : (~0 << (32 - cidrInput)) >>> 0;
  const wildcardVal = ~maskVal >>> 0;
  const networkVal = (ipVal & maskVal) >>> 0;
  const broadcastVal = (ipVal | wildcardVal) >>> 0;

  const firstOctet = (ipVal >>> 24) & 255;
  let ipClass = 'Unknown';
  if (firstOctet >= 1 && firstOctet <= 126) ipClass = 'Class A';
  else if (firstOctet === 127) ipClass = 'Class A (Loopback)';
  else if (firstOctet >= 128 && firstOctet <= 191) ipClass = 'Class B';
  else if (firstOctet >= 192 && firstOctet <= 223) ipClass = 'Class C';
  else if (firstOctet >= 224 && firstOctet <= 239) ipClass = 'Class D (Multicast)';
  else if (firstOctet >= 240 && firstOctet <= 255) ipClass = 'Class E (Experimental)';

  let ipType = 'Public IP';
  if (firstOctet === 10) ipType = 'Private IP (Class A)';
  else if (firstOctet === 172 && ((ipVal >>> 16) & 255) >= 16 && ((ipVal >>> 16) & 255) <= 31) ipType = 'Private IP (Class B)';
  else if (firstOctet === 192 && ((ipVal >>> 16) & 255) === 168) ipType = 'Private IP (Class C)';
  else if (firstOctet === 169 && ((ipVal >>> 16) & 255) === 254) ipType = 'Link-Local Address';

  let usableHosts = 0;
  let usableRange = '';
  if (cidrInput === 32) {
    usableHosts = 1;
    usableRange = `${uint32ToIp(networkVal)} (Single Host)`;
  } else if (cidrInput === 31) {
    usableHosts = 2;
    usableRange = `${uint32ToIp(networkVal)} - ${uint32ToIp(broadcastVal)}`;
  } else {
    usableHosts = (broadcastVal - networkVal - 1);
    usableRange = `${uint32ToIp(networkVal + 1)} - ${uint32ToIp(broadcastVal - 1)}`;
  }

  return {
    cidr: cidrInput,
    mask: uint32ToIp(maskVal),
    wildcard: uint32ToIp(wildcardVal),
    network: uint32ToIp(networkVal),
    broadcast: uint32ToIp(broadcastVal),
    usableRange: usableRange,
    hosts: usableHosts.toLocaleString(),
    ipClass: `${ipClass} / ${ipType}`,
    binary: uint32ToBinaryStr(maskVal)
  };
}

function updateConvHosts(cidr, isV6) {
  const hostsEl = document.getElementById('conv-hosts');
  if (!hostsEl) return;
  
  if (isV6) {
    if (cidr === 128) {
      hostsEl.textContent = '1 host (1 total)';
    } else {
      const hostBits = 128 - cidr;
      const total = BigInt(1) << BigInt(hostBits);
      const usable = total - BigInt(1);
      
      if (hostBits >= 80) {
        hostsEl.textContent = `2^${hostBits} - 1 = ${usable.toLocaleString()} hosts (2^${hostBits} total)`;
      } else {
        hostsEl.textContent = `${total.toLocaleString()} - 1 = ${usable.toLocaleString()} hosts`;
      }
    }
  } else {
    if (cidr === 32) {
      hostsEl.textContent = '1 host (1 total)';
    } else if (cidr === 31) {
      hostsEl.textContent = '2 hosts (2 total)';
    } else {
      const total = Math.pow(2, 32 - cidr);
      const usable = total - 2;
      hostsEl.textContent = `${total.toLocaleString()} - 2 = ${usable.toLocaleString()} hosts`;
    }
  }
}

function runConverter() {
  logConverterDebounced();
  const inputEl = document.getElementById('converter-input');
  if (!inputEl) return;
  const input = inputEl.value.trim();
  const errorEl = document.getElementById('converter-error');
  const resultsDiv = document.getElementById('converter-results');
  const subnetCard = document.getElementById('converter-subnet-card');
  const subnetResults = document.getElementById('converter-subnet-results');
  
  errorEl.textContent = '';
  if (subnetCard) {
    subnetCard.classList.add('hidden');
    subnetResults.innerHTML = '';
  }

  if (input === '') {
    resultsDiv.classList.add('hidden');
    return;
  }

  // Check if matches combined IP + Mask or Prefix e.g. "83.235.0.0 0.0.7.255" or "192.168.1.1/24"
  let parts = [];
  if (input.includes('/')) {
    const idx = input.lastIndexOf('/');
    parts = [input.substring(0, idx).trim(), input.substring(idx + 1).trim()];
  } else {
    const normalized = input.replace(/\s+/g, ' ');
    parts = normalized.split(' ');
  }

  if (parts.length === 2) {
    const ipPart = parts[0];
    const maskPart = parts[1];

    if (validateIPv4(ipPart)) {
      let cidr = null;
      const prefixReg = /^\/?(\d{1,2})$/;
      if (prefixReg.test(maskPart)) {
        cidr = parseInt(maskPart.match(prefixReg)[1], 10);
      } else if (validateIPv4(maskPart)) {
        const maskVal = ipToUint32(maskPart);
        const isWildcard = (maskVal & 0x80000000) === 0;
        let actualMaskVal = 0;
        if (isWildcard) {
          actualMaskVal = ~maskVal >>> 0;
        } else {
          actualMaskVal = maskVal;
        }
        cidr = Math.clz32(~actualMaskVal);
      }

      if (cidr !== null && cidr >= 0 && cidr <= 32) {
        const calc = runSubnetCalculationIPv4(ipPart, cidr);
        
        document.getElementById('conv-type').textContent = 'IPv4 Subnet Input';
        document.getElementById('conv-prefix').textContent = `/${cidr}`;
        document.getElementById('conv-mask').textContent = calc.mask;
        document.getElementById('conv-wildcard').textContent = calc.wildcard;
        document.getElementById('conv-binary').innerHTML = coloredBinaryStr(calc.binary);

        document.getElementById('conv-binary-row').style.display = 'flex';
        updateConvHosts(cidr, false);
        resultsDiv.classList.remove('hidden');

        if (subnetResults && subnetCard) {
          subnetResults.innerHTML = `
            <div class="result-item">
              <span class="label">CIDR Notation</span>
              <span class="val highlight" style="color: var(--accent-primary);">${ipPart}/${cidr}</span>
            </div>
            <div class="result-item">
              <span class="label">Subnet Mask</span>
              <span class="val">${calc.mask}</span>
            </div>
            <div class="result-item">
              <span class="label">Wildcard Mask</span>
              <span class="val">${calc.wildcard}</span>
            </div>
            <div class="result-item">
              <span class="label">Network Address</span>
              <span class="val">${calc.network}</span>
            </div>
            <div class="result-item">
              <span class="label">Broadcast Address</span>
              <span class="val">${calc.broadcast}</span>
            </div>
            <div class="result-item">
              <span class="label">Usable IP Range</span>
              <span class="val" style="font-size: 13px; font-weight: 600; color: #10B981;">${calc.usableRange}</span>
            </div>
            <div class="result-item">
              <span class="label">Total Usable Hosts</span>
              <span class="val" style="font-weight: 700;">${calc.hosts}</span>
            </div>
            <div class="result-item">
              <span class="label">IP Class / Type</span>
              <span class="val">${calc.ipClass}</span>
            </div>
          `;
          subnetCard.classList.remove('hidden');
        }
        recordHistoryDebounced('Converter', { input: input }, `Calculated Subnet: ${ipPart}/${cidr}`);
        return;
      }
    }
  }

  // Fallback to old behavior: Check if matches CIDR prefix pattern: e.g. "/22" or "22"
  const cidrReg = /^\/?(\d{1,2})$/;
  if (cidrReg.test(input)) {
    const cidrNum = parseInt(input.match(cidrReg)[1], 10);
    
    if (cidrNum >= 0 && cidrNum <= 32) {
      const maskVal = cidrNum === 0 ? 0 : (~0 << (32 - cidrNum)) >>> 0;
      const wildcardVal = ~maskVal >>> 0;
      
      document.getElementById('conv-type').textContent = 'IPv4 Prefix';
      document.getElementById('conv-prefix').textContent = `/${cidrNum}`;
      document.getElementById('conv-mask').textContent = uint32ToIp(maskVal);
      document.getElementById('conv-wildcard').textContent = uint32ToIp(wildcardVal);
      document.getElementById('conv-binary').innerHTML = coloredBinaryStr(uint32ToBinaryStr(maskVal));
      
      document.getElementById('conv-binary-row').style.display = 'flex';
      updateConvHosts(cidrNum, false);
      resultsDiv.classList.remove('hidden');
      recordHistoryDebounced('Converter', { input: input }, `Converted: ${input}`);
      return;
    }
    
    errorEl.textContent = 'Prefix length must be between 0 and 32.';
    resultsDiv.classList.add('hidden');
    return;
  }

  // Fallback to old behavior: Check if matches IPv4 mask: e.g. "255.255.252.0"
  if (validateIPv4(input)) {
    const ipVal = ipToUint32(input);
    const isWildcard = (ipVal & 0x80000000) === 0;
    
    let maskVal = 0;
    let wildcardVal = 0;
    
    if (isWildcard) {
      wildcardVal = ipVal;
      maskVal = ~wildcardVal >>> 0;
    } else {
      maskVal = ipVal;
      wildcardVal = ~maskVal >>> 0;
    }
    
    const inverted = ~maskVal >>> 0;
    const isCanonical = ((inverted + 1) & inverted) === 0;
    
    if (!isCanonical) {
      errorEl.textContent = 'Warning: This is a non-canonical mask (non-contiguous bits).';
    }
    
    const calculatedCidr = Math.clz32(~maskVal);
    const standardMask = calculatedCidr === 0 ? 0 : (~0 << (32 - calculatedCidr)) >>> 0;
    
    document.getElementById('conv-type').textContent = isWildcard ? 'IPv4 Wildcard' : 'IPv4 Subnet Mask';
    document.getElementById('conv-prefix').textContent = (isCanonical && maskVal === standardMask) ? `/${calculatedCidr}` : 'Non-canonical';
    document.getElementById('conv-mask').textContent = uint32ToIp(maskVal);
    document.getElementById('conv-wildcard').textContent = uint32ToIp(wildcardVal);
    document.getElementById('conv-binary').innerHTML = coloredBinaryStr(uint32ToBinaryStr(maskVal));
    
    document.getElementById('conv-binary-row').style.display = 'flex';
    updateConvHosts(calculatedCidr, false);
    resultsDiv.classList.remove('hidden');
    recordHistoryDebounced('Converter', { input: input }, `Converted: ${input}`);
    return;
  }

  errorEl.textContent = 'Invalid format. Input a prefix (e.g. /22 or 22), IPv4 mask, or IP + mask (e.g. 83.235.0.0 0.0.7.255 or 192.168.1.1/24).';
  resultsDiv.classList.add('hidden');
}

// --- SUBNET SPLITTER LOGIC ---

let currentSplitMethod = 'equal'; // 'equal' or 'vlsm'

// Inserts `text` at the current cursor position of the given input, then
// fires its 'input' listener so dependent calculations re-run.
// Helper: briefly flash button text to confirm copy
function flashConfirm(btn, originalHTML) {
  btn.innerHTML = '<svg style="width:11px;height:11px;" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Copied!';
  btn.style.color = 'var(--accent-success)';
  setTimeout(() => {
    btn.innerHTML = originalHTML;
    btn.style.color = '';
  }, 1500);
}

// Called from inline onclick= attributes in index.html — not referenced elsewhere in this file, which is why eslint flags it as unused.
// eslint-disable-next-line no-unused-vars
function insertAtCursor(inputId, text) {
  const el = document.getElementById(inputId);
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  el.value = el.value.slice(0, start) + text + el.value.slice(end);
  const newPos = start + text.length;
  el.focus();
  el.setSelectionRange(newPos, newPos);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

// Splitter's runSplitter() rebuilds up to 128 <tr> rows via createElement/
// appendChild on EVERY call - much heavier than the other calculators' fixed,
// few-field result panels. Firing that synchronously on every keystroke (the
// 'input' listeners below used to call runSplitter()/handleAppSplitIpChange()
// directly) forces a full layout recompute of a large table on every
// character typed. On iOS that collided with the keyboard-avoidance
// transition in setupKeyboardAvoidance() (app.js) / the "padding-bottom 0.2s
// ease" in .app-content (styles.css): that transition is what turns the
// keyboard-open padding jump into a smooth settle on the other tabs, but a
// big synchronous table rebuild mid-transition forces the browser to
// recompute layout right as the transition is animating, visibly stalling/
// interrupting it - which is why the splitter tab kept flickering noticeably
// after the other tabs' flicker was fixed. Debouncing the actual render
// (validation/normalization above it still runs immediately) keeps typing
// from repeatedly fighting that transition.
//
// iOS-only: Android relies on native "adjustResize" (see the isIOS check in
// setupKeyboardAvoidance()) and never runs the manual padding-bottom
// transition this is working around, so Android's Splitter tab never had
// this flicker and should keep updating the results table instantly on
// every keystroke, same as before.
function isIOSNative() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'ios');
}

let _splitterRenderTimeout = null;
function runSplitterDebounced() {
  if (!isIOSNative()) {
    runSplitter();
    return;
  }
  if (_splitterRenderTimeout) clearTimeout(_splitterRenderTimeout);
  _splitterRenderTimeout = setTimeout(() => {
    _splitterRenderTimeout = null;
    runSplitter();
  }, 150);
}

function initSplitterListeners() {
  // Split Method Selection (Equal vs VLSM)
  const methodBtns = document.querySelectorAll('.method-btn');
  const equalPanel = document.getElementById('split-equal-panel');
  const vlsmPanel = document.getElementById('split-vlsm-panel');

  methodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      methodBtns.forEach(b => {
        b.classList.remove('active');
        b.style.background = 'none';
        b.style.color = 'var(--text-secondary)';
        b.style.fontWeight = '500';
      });
      btn.classList.add('active');
      btn.style.background = 'var(--bg-card)';
      btn.style.color = 'var(--accent-primary)';
      btn.style.fontWeight = '700';
      
      currentSplitMethod = btn.getAttribute('data-method');
      if (currentSplitMethod === 'equal') {
        equalPanel.classList.remove('hidden');
        vlsmPanel.classList.add('hidden');
      } else {
        equalPanel.classList.add('hidden');
        vlsmPanel.classList.remove('hidden');
      }
      runSplitter();
    });
  });

  // Inputs change triggers with null checks
  const splitBaseIp = document.getElementById('split-base-ip');
  if (splitBaseIp) splitBaseIp.addEventListener('input', handleAppSplitIpChange);
  
  const splitBaseCidr = document.getElementById('split-base-cidr');
  if (splitBaseCidr) splitBaseCidr.addEventListener('input', handleAppSplitBaseCidrChange);
  
  const splitEqualRange = document.getElementById('split-equal-range');
  if (splitEqualRange) {
    splitEqualRange.addEventListener('input', () => {
      updateEqualSplitSliderVal();
      runSplitter();
    });
  }
  
  const splitVlsmHosts = document.getElementById('split-vlsm-hosts');
  if (splitVlsmHosts) splitVlsmHosts.addEventListener('input', runSplitterDebounced);

  // Notes and Share bindings for Split results
  const btnSaveSplit = document.getElementById('btn-save-notes-split');
  if (btnSaveSplit) btnSaveSplit.addEventListener('click', saveSplitNote);
  
  const btnShareSplit = document.getElementById('btn-share-split');
  if (btnShareSplit) btnShareSplit.addEventListener('click', shareSplitResult);
  
  handleAppSplitIpChange();
}

let appSplitIpType = 'v4';

function handleAppSplitIpChange() {
  const ipEl = document.getElementById('split-base-ip');
  if (!ipEl) return;
  let ip = ipEl.value.trim();
  const cidrEl = document.getElementById('split-base-cidr');

  if (ip.includes('/')) {
    const parts = ip.split('/');
    const cleanIp = parts[0].trim();
    const maskStr = parts[1].trim();
    const mask = parseInt(maskStr, 10);
    if (!isNaN(mask)) {
      ipEl.value = cleanIp;
      ip = cleanIp;
      if (cidrEl) {
        const isV6 = ip.indexOf(':') !== -1;
        const maxVal = isV6 ? 127 : 30;
        if (mask >= 0 && mask <= maxVal) {
          cidrEl.value = mask;
        }
      }
    }
  }

  const isV6 = ip.indexOf(':') !== -1;
  const currentType = isV6 ? 'v6' : 'v4';
  
  if (cidrEl) {
    if (currentType !== appSplitIpType) {
      appSplitIpType = currentType;
      if (isV6) {
        cidrEl.setAttribute('min', '0');
        cidrEl.setAttribute('max', '127');
        cidrEl.value = '64';
      } else {
        cidrEl.setAttribute('min', '0');
        cidrEl.setAttribute('max', '30');
        cidrEl.value = '24';
      }
    }
  }
  resetAppSplitTargetSlider();
  runSplitterDebounced();
}

function handleAppSplitBaseCidrChange() {
  resetAppSplitTargetSlider();
  runSplitterDebounced();
}

function resetAppSplitTargetSlider() {
  const baseCidrEl = document.getElementById('split-base-cidr');
  const range = document.getElementById('split-equal-range');
  if (!baseCidrEl || !range) return;
  
  const baseCidr = parseInt(baseCidrEl.value, 10) || (appSplitIpType === 'v6' ? 64 : 24);
  const isV6 = appSplitIpType === 'v6';
  const maxCidr = isV6 ? Math.min(128, baseCidr + 16) : Math.min(32, baseCidr + 8);
  const minCidr = baseCidr + 1;
  
  range.setAttribute('min', minCidr.toString());
  range.setAttribute('max', maxCidr.toString());
  range.value = minCidr.toString();
  
  updateEqualSplitSliderVal();
}

function updateEqualSplitSliderVal() {
  const baseCidrEl = document.getElementById('split-base-cidr');
  const range = document.getElementById('split-equal-range');
  const valSpan = document.getElementById('split-equal-val');
  if (!baseCidrEl || !range || !valSpan) return;
  
  const baseCidr = parseInt(baseCidrEl.value, 10) || (appSplitIpType === 'v6' ? 64 : 24);
  const targetCidr = parseInt(range.value, 10);
  const isV6 = appSplitIpType === 'v6';
  
  let subnetCountStr = '';
  const diff = targetCidr - baseCidr;
  if (isV6) {
    if (diff >= 48) {
      subnetCountStr = '2^' + diff;
    } else {
      subnetCountStr = Math.pow(2, diff).toLocaleString();
    }
  } else {
    subnetCountStr = Math.pow(2, diff).toLocaleString();
  }
  
  let hostCapacity = '';
  if (isV6) {
    const hostBits = 128 - targetCidr;
    hostCapacity = hostBits >= 48 ? '2^' + hostBits : Math.pow(2, hostBits).toLocaleString();
  } else {
    hostCapacity = targetCidr === 32 ? '1' : targetCidr === 31 ? '2' : (Math.pow(2, 32 - targetCidr) - 2).toLocaleString();
  }
  
  valSpan.textContent = '/' + targetCidr + ' (' + subnetCountStr + ' subnets of ' + hostCapacity + ' hosts)';
  const splitBtnVal = document.getElementById('split-equal-btn-val');
  if (splitBtnVal) splitBtnVal.textContent = '/' + targetCidr;
}

function blocksToIpStr(blocks) {
  return blocks.map(b => b.toString(16)).join(':').replace(/:(0:)+/, '::');
}

function runSplitter() {
  if (window.Capacitor && window.Capacitor.Plugins.FirebaseCrashlytics) {
    window.Capacitor.Plugins.FirebaseCrashlytics.setCustomKey({ key: 'last_calc_action', type: 'string', value: 'runSplitter' }).catch(() => {});
  }
  logSplitterDebounced();
  const baseIpEl = document.getElementById('split-base-ip');
  const baseCidrEl = document.getElementById('split-base-cidr');
  const errorEl = document.getElementById('split-error');
  const resultsCard = document.getElementById('split-results');
  const tbody = document.getElementById('split-results-tbody');

  if (!baseIpEl || !baseCidrEl || !errorEl || !resultsCard || !tbody) return;

  const baseIp = baseIpEl.value.trim();
  const baseCidr = parseInt(baseCidrEl.value, 10);

  errorEl.textContent = '';
  resultsCard.classList.add('hidden');
  tbody.innerHTML = '';

  const isV6 = appSplitIpType === 'v6';
  
  if (isV6) {
    if (baseIp === '' || baseIp.indexOf(':') === -1) return;
    const parsed = parseIPv6(baseIp);
    if (!parsed) {
      errorEl.textContent = 'Invalid Base IPv6 Address format.';
      return;
    }
    
    updateSharedIP(baseIp);
    if (isNaN(baseCidr) || baseCidr < 0 || baseCidr > 127) {
      errorEl.textContent = 'Base prefix must be between 0 and 127.';
      return;
    }
    
    // Unpack BigInt parsed to standard block array
    const parsedBlocks = [];
    let temp = parsed;
    for (let k = 0; k < 8; k++) {
      parsedBlocks.unshift(Number(temp & BigInt(0xffff)));
      temp = temp >> BigInt(16);
    }
    
    let subnets = [];
    
    if (currentSplitMethod === 'equal') {
      const range = document.getElementById('split-equal-range');
      if (!range) return;
      const targetCidr = parseInt(range.value, 10);
      if (isNaN(targetCidr) || targetCidr <= baseCidr) return;
      
      const subnetsCount = Math.pow(2, targetCidr - baseCidr);
      const maxRender = Math.min(subnetsCount, 128);
      
      const baseNetworkBlocks = [];
      for (let i = 0; i < 8; i++) {
        const startBit = i * 16;
        if (baseCidr <= startBit) {
          baseNetworkBlocks.push(0);
        } else if (baseCidr >= startBit + 16) {
          baseNetworkBlocks.push(parsedBlocks[i]);
        } else {
          const divisor = Math.pow(2, 16 - (baseCidr - startBit));
          baseNetworkBlocks.push(Math.floor(parsedBlocks[i] / divisor) * divisor);
        }
      }
      
      const blockIdx = Math.floor((targetCidr - 1) / 16);
      const targetBitInBlock = targetCidr - (blockIdx * 16);
      const increment = Math.pow(2, 16 - targetBitInBlock);
      
      const FULL_SPLIT_SAVE_CAP = 20000;
      const generateLimit = subnetsCount <= FULL_SPLIT_SAVE_CAP ? subnetsCount : maxRender;
      
      for (let i = 0; i < generateLimit; i++) {
        const subnetNetBlocks = [];
        for (let k = 0; k < 8; k++) {
          subnetNetBlocks.push(baseNetworkBlocks[k]);
        }
        subnetNetBlocks[blockIdx] = baseNetworkBlocks[blockIdx] + (i * increment);
        
        const subnetLastBlocks = [];
        for (let k = 0; k < 8; k++) {
          if (k < blockIdx) {
            subnetLastBlocks.push(subnetNetBlocks[k]);
          } else if (k === blockIdx) {
            subnetLastBlocks.push(subnetNetBlocks[k] + (increment - 1));
          } else {
            subnetLastBlocks.push(65535);
          }
        }
        
        // Compute host counts with BigInt for IPv6 precision
        const hostBits6 = 128 - targetCidr;
        const totalAddr6 = BigInt(1) << BigInt(hostBits6);
        const usable6 = totalAddr6 > BigInt(1) ? totalAddr6 - BigInt(1) : totalAddr6;
        const hostsDisplay6 = hostBits6 >= 48
          ? `${usable6.toLocaleString()} / 2^${hostBits6}`
          : `${usable6.toLocaleString()} / ${totalAddr6.toLocaleString()}`;

        subnets.push({
          name: `Subnet #${i + 1}`,
          cidr: targetCidr,
          network: blocksToIpStr(subnetNetBlocks),
          mask: 'N/A',
          range: blocksToIpStr(subnetNetBlocks) + ' -\n' + blocksToIpStr(subnetLastBlocks),
          hosts: hostsDisplay6,
          required: 'Equal size'
        });
      }
      
      if (subnetsCount > maxRender) {
        let warningMsg = `Warning: Only first ${maxRender} subnets rendered (out of ${subnetsCount} total).`;
        if (subnetsCount <= FULL_SPLIT_SAVE_CAP) {
          warningMsg = `Showing first ${maxRender} of ${subnetsCount} subnets — full list saved to Notes.`;
          const title = `Full Split: ${baseIp}/${baseCidr} → /${targetCidr}`;
          const content = formatFullSplitResults(subnets, baseIp, baseCidr, targetCidr, true);
          triggerFullSplitAutoSave(title, content, 'IPv6');
        } else {
          warningMsg += " (too many to save in full — narrow the target prefix to save the complete list)";
        }
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 12px 0;">${warningMsg}</td></tr>`;
      }
      
      // Trim subnets for UI rendering
      const subnetsToRender = subnets.slice(0, maxRender);
      subnets = subnetsToRender;
    } else {
      const hostsText = document.getElementById('split-vlsm-hosts').value.trim();
      if (hostsText === '') return;
      
      const reqSizes = hostsText.split(/[,.\s]+/)
                               .map(s => parseInt(s.trim(), 10))
                               .filter(n => !isNaN(n) && n > 0);
      if (reqSizes.length === 0) return;
      
      const sortedHosts = [...reqSizes].map((hosts, origIndex) => ({ hosts: BigInt(hosts), origIndex }));
      sortedHosts.sort((a, b) => (b.hosts > a.hosts ? 1 : -1));
      
      const baseBigInt = parseIPv6(baseIp);
      let currentIpVal = baseBigInt;
      const baseCapacity = BigInt(1) << BigInt(128 - baseCidr);
      
      for (let i = 0; i < sortedHosts.length; i++) {
        const hostsCount = sortedHosts[i].hosts;
        let needed = hostsCount + BigInt(2);
        let power = 0;
        while ((BigInt(1) << BigInt(power)) < needed) {
          power++;
        }
        const blockSize = BigInt(1) << BigInt(power);
        const targetCidr = 128 - power;
        
        if (currentIpVal % blockSize !== BigInt(0)) {
          currentIpVal = currentIpVal + (blockSize - (currentIpVal % blockSize));
        }
        
        const netVal = currentIpVal;
        const endVal = netVal + blockSize - BigInt(1);
        
        if (endVal > (baseBigInt + baseCapacity - BigInt(1))) {
          errorEl.textContent = 'Allocated subnets exceed the base network boundary!';
          return;
        }
        
        const subNetBlocks = [];
        let tempNet = netVal;
        for (let k = 0; k < 8; k++) {
          subNetBlocks.unshift(Number(tempNet & BigInt(0xffff)));
          tempNet = tempNet >> BigInt(16);
        }
        
        const subEndBlocks = [];
        let tempEnd = endVal;
        for (let k = 0; k < 8; k++) {
          subEndBlocks.unshift(Number(tempEnd & BigInt(0xffff)));
          tempEnd = tempEnd >> BigInt(16);
        }
        
        // Usable = blockSize - 1 (no broadcast in IPv6; only network/anycast address reserved)
        const usableV6 = blockSize - BigInt(1);

        subnets.push({
          name: `Subnet #${sortedHosts[i].origIndex + 1}`,
          cidr: targetCidr,
          network: blocksToIpStr(subNetBlocks),
          mask: 'N/A',
          range: blocksToIpStr(subNetBlocks) + ' -\n' + blocksToIpStr(subEndBlocks),
          hosts: `${usableV6.toLocaleString()} / ${blockSize.toLocaleString()} (req. ${hostsCount})`,
          required: hostsCount.toString()
        });
        
        currentIpVal += blockSize;
      }
    }
    
    subnets.forEach((sub, index) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
      tr.innerHTML = `
        <td style="padding: 8px 4px; font-weight: bold; color: var(--text-secondary);">${sub.name}</td>
        <td style="padding: 8px 4px; font-family: monospace;">${sub.network}</td>
        <td style="padding: 8px 4px;">/${sub.cidr}<br><span style="font-size: 10px; color: var(--text-secondary);">${sub.mask}</span></td>
        <td style="padding: 8px 4px; font-size: 11px; font-family: monospace;">${sub.range}</td>
        <td style="padding: 8px 4px; font-weight: bold; color: var(--accent-primary);">${sub.hosts}</td>
      `;
      tbody.appendChild(tr);
    });
    
    resultsCard.classList.remove('hidden');
    
  } else {
    const dotCount = (baseIp.match(/\./g) || []).length;
    if (baseIp === '' || dotCount < 3 || baseIp.endsWith('.')) return;
    
    if (!validateIPv4(baseIp)) {
      errorEl.textContent = 'Invalid Base IP Address format.';
      return;
    }
    
    updateSharedIP(baseIp);
    
    if (isNaN(baseCidr) || baseCidr < 0 || baseCidr > 30) {
      errorEl.textContent = 'Base prefix must be between 0 and 30.';
      return;
    }
    
    const baseIpVal = ipToUint32(baseIp);
    const divisor = Math.pow(2, 32 - baseCidr);
    const baseNetworkVal = baseCidr === 0 ? 0 : (baseIpVal - (baseIpVal % divisor)) >>> 0;
    const baseCapacity = Math.pow(2, 32 - baseCidr);
    
    let subnets = [];
    
    if (currentSplitMethod === 'equal') {
      const range = document.getElementById('split-equal-range');
      if (!range) return;
      const targetCidr = parseInt(range.value, 10);
      if (isNaN(targetCidr) || targetCidr <= baseCidr) return;
      
      const subnetsCount = Math.pow(2, targetCidr - baseCidr);
      const subnetsSize = Math.pow(2, 32 - targetCidr);
      const maxRender = Math.min(subnetsCount, 128);
      
      const FULL_SPLIT_SAVE_CAP = 20000;
      const generateLimit = subnetsCount <= FULL_SPLIT_SAVE_CAP ? subnetsCount : maxRender;
      
      for (let i = 0; i < generateLimit; i++) {
        const netVal = (baseNetworkVal + (i * subnetsSize)) >>> 0;
        const broadVal = (netVal + subnetsSize - 1) >>> 0;
        const rangeText = targetCidr === 32 ? uint32ToIp(netVal) : 
                          targetCidr === 31 ? uint32ToIp(netVal) + ' - ' + uint32ToIp(broadVal) :
                          uint32ToIp(netVal + 1) + ' - ' + uint32ToIp(broadVal - 1);
        const usableHosts = targetCidr === 32 ? 1 : targetCidr === 31 ? 2 : subnetsSize - 2;
        
        subnets.push({
          name: `Subnet #${i + 1}`,
          cidr: targetCidr,
          network: uint32ToIp(netVal),
          mask: cidrToSubnetMask(targetCidr),
          range: rangeText,
          hosts: usableHosts.toLocaleString(),
          required: 'Equal size'
        });
      }
      
      if (subnetsCount > maxRender) {
        let warningMsg = `Warning: Only first ${maxRender} subnets rendered (out of ${subnetsCount} total).`;
        if (subnetsCount <= FULL_SPLIT_SAVE_CAP) {
          warningMsg = `Showing first ${maxRender} of ${subnetsCount} subnets — full list saved to Notes.`;
          const title = `Full Split: ${baseIp}/${baseCidr} → /${targetCidr}`;
          const content = formatFullSplitResults(subnets, baseIp, baseCidr, targetCidr, false);
          triggerFullSplitAutoSave(title, content, 'IPv4');
        } else {
          warningMsg += " (too many to save in full — narrow the target prefix to save the complete list)";
        }
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 12px 0;">${warningMsg}</td></tr>`;
      }
      
      // Trim subnets for UI rendering
      const subnetsToRender = subnets.slice(0, maxRender);
      subnets = subnetsToRender;
    } else {
      const hostsText = document.getElementById('split-vlsm-hosts').value.trim();
      if (hostsText === '') return;
      
      const reqSizes = hostsText.split(/[,.\s]+/)
                               .map(s => parseInt(s.trim(), 10))
                               .filter(n => !isNaN(n) && n > 0);
      if (reqSizes.length === 0) return;
      
      const sortedHosts = [...reqSizes].map((hosts, origIndex) => ({ hosts, origIndex }));
      sortedHosts.sort((a, b) => b.hosts - a.hosts);
      
      let currentIpVal = baseNetworkVal;
      
      for (let i = 0; i < sortedHosts.length; i++) {
        const hostsCount = sortedHosts[i].hosts;
        const blockSize = Math.pow(2, Math.ceil(Math.log2(hostsCount + 2)));
        const targetCidr = 32 - Math.log2(blockSize);
        
        if (currentIpVal % blockSize !== 0) {
          currentIpVal = currentIpVal + (blockSize - (currentIpVal % blockSize));
        }
        
        const netVal = currentIpVal;
        const broadVal = (netVal + blockSize - 1) >>> 0;
        
        if (broadVal > (baseNetworkVal + baseCapacity - 1)) {
          errorEl.textContent = 'Allocated subnets exceed the base network boundary!';
          return;
        }
        
        const rangeText = targetCidr === 32 ? uint32ToIp(netVal) : 
                          targetCidr === 31 ? uint32ToIp(netVal) + ' - ' + uint32ToIp(broadVal) :
                          uint32ToIp(netVal + 1) + ' - ' + uint32ToIp(broadVal - 1);
        const usableCapacity = targetCidr === 32 ? 1 : targetCidr === 31 ? 2 : blockSize - 2;
        
        subnets.push({
          name: `Subnet #${sortedHosts[i].origIndex + 1}`,
          cidr: targetCidr,
          network: uint32ToIp(netVal),
          mask: cidrToSubnetMask(targetCidr),
          range: rangeText,
          hosts: usableCapacity.toLocaleString() + ' (req. ' + hostsCount + ')',
          required: hostsCount
        });
        
        currentIpVal += blockSize;
      }
    }
    
    subnets.forEach((sub, index) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
      tr.innerHTML = `
        <td style="padding: 8px 4px; font-weight: bold; color: var(--text-secondary);">${sub.name}</td>
        <td style="padding: 8px 4px; font-family: monospace;">${sub.network}</td>
        <td style="padding: 8px 4px;">/${sub.cidr}<br><span style="font-size: 10px; color: var(--text-secondary);">${sub.mask}</span></td>
        <td style="padding: 8px 4px; font-size: 11px; font-family: monospace;">${sub.range}</td>
        <td style="padding: 8px 4px; font-weight: bold; color: var(--accent-primary);">${sub.hosts}</td>
      `;
      tbody.appendChild(tr);
    });
    
    resultsCard.classList.remove('hidden');
  }
  
  const methodLabel = currentSplitMethod === 'equal' ? 'Equal Split (FLSM)' : 'VLSM';
  recordHistoryDebounced('Splitter', { baseIp, baseCidr, method: currentSplitMethod }, 'Splitter: ' + baseIp + '/' + baseCidr + ' (' + methodLabel + ')');
}



function formatFullSplitResults(subnetsArray, baseIp, baseCidr, targetCidr, isV6) {
  const method = 'Equal Split (FLSM)';
  let content = `Subnet Split Results (${method}) — FULL LIST:\nBase Network: ${baseIp}/${baseCidr}\nTarget Prefix: /${targetCidr}\nTotal Subnets: ${subnetsArray.length}\n\nAllocated Subnets:\n`;
  subnetsArray.forEach(sub => {
    content += `• ${sub.name}: ${sub.network} /${sub.cidr} | Range: ${sub.range.replace('\n', ' ')} | Usable Hosts: ${sub.hosts}\n`;
  });
  return content;
}

function getFormattedSplitOutput() {
  const baseIp = document.getElementById('split-base-ip').value.trim();
  const baseCidr = document.getElementById('split-base-cidr').value;
  const method = currentSplitMethod === 'equal' ? 'Equal Split (FLSM)' : 'VLSM (by Host Count)';
  
  let content = `Subnet Split Results (${method}):\nBase Network: ${baseIp}/${baseCidr}\n\nAllocated Subnets:\n`;
  
  const rows = document.querySelectorAll('#split-results-tbody tr');
  rows.forEach((row, i) => {
    const tds = row.querySelectorAll('td');
    if (tds.length >= 5) {
      const name = tds[0].textContent;
      const net = tds[1].textContent;
      const maskInfo = tds[2].textContent.replace('\n', ' ');
      const range = tds[3].textContent;
      const hosts = tds[4].textContent;
      content += `• ${name}: ${net} ${maskInfo} | Range: ${range} | Usable Hosts: ${hosts}\n`;
    }
  });
  return content;
}

function saveSplitNote() {
  const baseIp = document.getElementById('split-base-ip').value.trim();
  const baseCidr = document.getElementById('split-base-cidr').value;
  const title = `Split: ${baseIp}/${baseCidr}`;
  const content = getFormattedSplitOutput();
  addNote(title, content, 'IPv4');
  maybeRequestReview('save_note');
  switchToNotesTab();
}

function shareSplitResult() {
  const baseIp = document.getElementById('split-base-ip').value.trim();
  const baseCidr = document.getElementById('split-base-cidr').value;
  const title = `Subnet Splitter: ${baseIp}/${baseCidr}`;
  const content = getFormattedSplitOutput();
  shareText(title, content);
}

// --- Settings & Customization Engine ---
let activeThemeColor = SafeStorage.getItem('isubnet_theme_color') || '#4f46e5';

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '79, 70, 229';
}

// Convert hex color to [H (0-360), S (0-100), L (0-100)]
function hexToHsl(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [240, 68, 59]; // default indigo
  let r = parseInt(m[1], 16) / 255;
  let g = parseInt(m[2], 16) / 255;
  let b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r)      h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else                h = (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

// Convert HSL to Hex
function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Automatically lighten dark theme colors in Dark Mode to preserve contrast
function getAdjustedThemeColor(hex) {
  if (!document.body.classList.contains('dark-mode')) return hex;
  const [h, s, l] = hexToHsl(hex);
  // Boost lightness for dark colors (L < 45%) to ensure visibility
  if (l < 45) {
    return hslToHex(h, s, Math.min(l + 25, 55));
  }
  return hex;
}

/**
 * Given the accent (active) hex color, returns a high-contrast CSS color
 * for the inactive bits (0s). Rotates hue by 165° and inverts lightness
 * so it always reads as clearly distinct from the active color.
 */
function computeBitOffColor(hex) {
  const [h, s, l] = hexToHsl(hex);
  const offH = (h + 165) % 360;          // rotate hue for clear distinction
  const offS = Math.max(10, Math.min(s, 35)); // desaturate so it feels muted
  const offL = l > 55 ? 30 : 68;         // invert brightness for contrast
  return `hsl(${offH}, ${offS}%, ${offL}%)`;
}

function loadThemeColor() {
  const displayColor = getAdjustedThemeColor(activeThemeColor);
  
  document.documentElement.style.setProperty('--accent-primary', displayColor);
  document.documentElement.style.setProperty('--accent-primary-rgb', hexToRgb(displayColor));
  // Update the inactive-bit contrast color whenever the theme changes
  document.documentElement.style.setProperty('--bit-off-color', computeBitOffColor(displayColor));

  // Update swatch active outline states
  const swatches = document.querySelectorAll('.theme-swatch');
  swatches.forEach(swatch => {
    const color = swatch.getAttribute('data-color');
    if (color === activeThemeColor) {
      swatch.style.borderColor = 'var(--text-primary)';
      swatch.classList.add('active');
    } else {
      swatch.style.borderColor = 'transparent';
      swatch.classList.remove('active');
    }
  });
}

function setThemeColor(color) {
  activeThemeColor = color;
  SafeStorage.setItem('isubnet_theme_color', color);
  loadThemeColor();
}

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

function initSettings() {
  const btnSettings = document.getElementById('btn-settings');
  const modalSettings = document.getElementById('settings-modal');
  const btnSettingsClose = document.getElementById('btn-settings-close');
  
  const swatches = document.querySelectorAll('.theme-swatch');
  const btnAccount = document.getElementById('btn-settings-account');
  const modalAccount = document.getElementById('account-modal');
  const btnAccountClose = document.getElementById('btn-account-close');
  const formSignup = document.getElementById('form-signup');
  const signupError = document.getElementById('signup-error');
  const accountInfo = document.getElementById('settings-account-info');
  const btnDeleteAccount = document.getElementById('btn-settings-delete-account');

  const btnPlan = document.getElementById('btn-settings-plan');
  const modalPlan = document.getElementById('plan-modal');
  const btnPlanClose = document.getElementById('btn-plan-close');
  const toggles = document.querySelectorAll('.billing-toggle');
  const planPrice = document.getElementById('plan-modal-price');
  const btnPlanSelectPro = document.getElementById('btn-plan-select-pro');

  // Password visibility toggle
  const btnTogglePassword = document.getElementById('btn-toggle-password');
  const signupPassword = document.getElementById('signup-password');
  const iconEyeOpen = document.getElementById('icon-eye-open');
  const iconEyeClosed = document.getElementById('icon-eye-closed');
  if (btnTogglePassword && signupPassword && iconEyeOpen && iconEyeClosed) {
    btnTogglePassword.addEventListener('click', () => {
      if (signupPassword.type === 'password') {
        signupPassword.type = 'text';
        iconEyeOpen.style.display = 'block';
        iconEyeClosed.style.display = 'none';
      } else {
        signupPassword.type = 'password';
        iconEyeOpen.style.display = 'none';
        iconEyeClosed.style.display = 'block';
      }
    });
  }

  // Toggle settings panel
  if (btnSettings && modalSettings && btnSettingsClose) {
    btnSettings.addEventListener('click', () => modalSettings.classList.remove('hidden'));
    btnSettingsClose.addEventListener('click', () => modalSettings.classList.add('hidden'));
  }

  // Load color picker handlers
  swatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      const color = swatch.getAttribute('data-color');
      setThemeColor(color);
    });
  });
  
  loadThemeColor();

  // Set initial status bar theme
  const isDarkInitial = document.body.classList.contains('dark-mode');
  updateNativeStatusBar(isDarkInitial);

  // Dark Mode Switch Handler
  const chkDarkMode = document.getElementById('chk-dark-mode');
  if (chkDarkMode) {
    chkDarkMode.checked = isDarkInitial;
    chkDarkMode.addEventListener('change', () => {
      const isDark = chkDarkMode.checked;
      if (isDark) {
        document.body.classList.add('dark-mode');
        SafeStorage.setItem('isubnet_dark_mode', 'true');
      } else {
        document.body.classList.remove('dark-mode');
        SafeStorage.setItem('isubnet_dark_mode', 'false');
      }

      loadThemeColor(); // Re-compute and paint the theme color to adjust for contrast
      updateNativeStatusBar(isDark);

      // Save theme preference natively using Capacitor Preferences
      try {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences) {
          window.Capacitor.Plugins.Preferences.set({
            key: 'isubnet_dark_mode',
            value: isDark ? 'true' : 'false'
          });
        }
      } catch (e) {
        console.error('Failed to save native theme preference', e);
      }
    });
  }

  // Create Account / Sign In logic
  const linkToggleAuth = document.getElementById('link-toggle-auth');
  const accountModalTitle = document.getElementById('account-modal-title');
  const signupNameGroup = document.getElementById('signup-name-group');
  const signupNameInput = document.getElementById('signup-name');
  const btnAccountSubmit = document.getElementById('btn-account-submit');
  let isSignUpMode = true;

  if (linkToggleAuth) {
    linkToggleAuth.addEventListener('click', (e) => {
      e.preventDefault();
      isSignUpMode = !isSignUpMode;
      signupError.textContent = '';
      if (isSignUpMode) {
        accountModalTitle.textContent = window._pendingPurchasePlan ? 'Create an account to unlock Pro' : 'Create Account';
        signupNameGroup.style.display = 'block';
        signupNameInput.setAttribute('required', 'true');
        btnAccountSubmit.textContent = 'Sign Up';
        linkToggleAuth.textContent = 'Already have an account? Sign In';
      } else {
        accountModalTitle.textContent = window._pendingPurchasePlan ? 'Sign in to unlock Pro' : 'Sign In';
        signupNameGroup.style.display = 'none';
        signupNameInput.removeAttribute('required');
        btnAccountSubmit.textContent = 'Sign In';
        linkToggleAuth.textContent = "Don't have an account? Sign Up";
      }
    });
  }

  if (btnAccount && modalAccount && btnAccountClose) {
    btnAccount.addEventListener('click', () => {
      if (typeof window.debugLog === 'function') window.debugLog(`Button Tap: Sign In / Sign Out main button`);
      // Toggle sign in/out
      if (btnAccount.textContent === 'Sign Out') {
        if (useRealFirebase) {
          if(typeof window.debugLog==='function') window.debugLog(`Firebase Auth: signOut attempt`);
          firebase.auth().signOut().catch(err => console.error("Sign out error:", err));
        } else {
          accountInfo.textContent = 'Not signed in';
          btnAccount.textContent = 'Sign In / Register';
          if (btnDeleteAccount) btnDeleteAccount.classList.add('hidden');
          btnAccount.style.background = 'var(--accent-primary)';
          btnAccount.style.color = '#FFF';
          btnAccount.style.border = 'none';
          btnAccount.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.15)';
          
          // Reset trial plan on sign out
          PRO_UNLOCKED = false;
          SafeStorage.setItem('isubnet_pro', 'false');
          applyProState();
          document.getElementById('settings-plan-status').innerHTML = `Current Plan: <strong>Free Plan</strong>`;
        if (typeof updateUpgradeUI === 'function') updateUpgradeUI('free');
        }
      } else {
        signupError.textContent = '';
        modalSettings.classList.add('hidden'); // Hide settings panel to prevent overlap unresponsive clicks
        modalAccount.classList.remove('hidden');
      }
    });
    btnAccountClose.addEventListener('click', () => {
      modalAccount.classList.add('hidden');
      if (window._pendingPurchasePlan) {
        const accountTitle = document.getElementById('account-modal-title');
        if (accountTitle) accountTitle.textContent = isSignUpMode ? 'Create Account' : 'Sign In';
        window._pendingPurchasePlan = null;
        showProModal();
      } else {
        modalSettings.classList.remove('hidden'); // Restore settings panel
      }
    });
  }

    const btnNudgeDismiss = document.getElementById('btn-nudge-dismiss');
    if (btnNudgeDismiss) {
      btnNudgeDismiss.addEventListener('click', () => {
        const nudgeModal = document.getElementById('sync-nudge-modal');
        if (nudgeModal) nudgeModal.classList.add('hidden');
      });
    }

    const btnNudgeCreate = document.getElementById('btn-nudge-create');
    if (btnNudgeCreate) {
      btnNudgeCreate.addEventListener('click', () => {
        const nudgeModal = document.getElementById('sync-nudge-modal');
        if (nudgeModal) nudgeModal.classList.add('hidden');
        
        if (modalAccount) {
          isSignUpMode = true; // Force sign up mode for the nudge
          const accountModalTitle = document.getElementById('account-modal-title');
          if (accountModalTitle) accountModalTitle.textContent = 'Create Account';
          
          const nameGroup = document.getElementById('signup-name-group');
          const nameInput = document.getElementById('signup-name');
          const submitBtn = document.getElementById('btn-account-submit');
          const toggleAuth = document.getElementById('link-toggle-auth');
          
          if (nameGroup) nameGroup.style.display = 'block';
          if (nameInput) nameInput.setAttribute('required', 'true');
          if (submitBtn) submitBtn.textContent = 'Sign Up';
          if (toggleAuth) toggleAuth.textContent = 'Already have an account? Sign In';
          
          modalAccount.classList.remove('hidden');
        }
      });
    }

  if (formSignup) {
    formSignup.addEventListener('submit', (e) => {
      e.preventDefault();
      if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') window.debugLog(`Button Tap: Account Submit`);
      const name = signupNameInput.value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      
      if (isSignUpMode && !name) {
        if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
          window.debugLog(`Firebase Auth: signUp attempt for ${maskEmailForLog(email)}`);
        }
        signupError.textContent = 'Please fill out all fields.';
        return;
      }
      if (!email || !password) {
        if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
          window.debugLog(`Firebase Auth: ${isSignUpMode ? 'signUp' : 'signIn'} attempt for ${maskEmailForLog(email)}`);
        }
        signupError.textContent = 'Please fill out all fields.';
        return;
      }
      
      if (useRealFirebase) {
        btnAccountSubmit.textContent = 'Processing...';
        btnAccountSubmit.disabled = true;
        
        let promise;
        if (isSignUpMode) {
          if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
            window.debugLog(`Firebase Auth: signUp attempt for ${maskEmailForLog(email)}`);
          }
          promise = firebase.auth().createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
              return userCredential.user.updateProfile({ displayName: name });
            });
        } else {
          if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
            window.debugLog(`Firebase Auth: signIn attempt for ${maskEmailForLog(email)}`);
          }
          promise = firebase.auth().signInWithEmailAndPassword(email, password);
        }
        
        promise.then(async () => {
          if (useRevenueCat && window.Capacitor && window.Capacitor.Plugins.Purchases) {
            btnAccountSubmit.textContent = 'Syncing account...';
            try {
              const user = firebase.auth().currentUser;
              if (user) {
                if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
                  window.debugLog(`RevenueCat: Awaiting logIn({ appUserID: ${maskUidForLog(user.uid)} }) in modal flow`);
                }
                const { Purchases } = window.Capacitor.Plugins;
                const logInResult = await Purchases.logIn({ appUserID: user.uid });
                if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
                  window.debugLog(`RevenueCat: logIn() resolved in modal flow. Created: ${logInResult && logInResult.created ? 'true' : 'false'}`);
                }
                const displayName = user.displayName || user.email.split('@')[0];
                try { await Purchases.setEmail({ email: user.email }); } catch(e) {}
                try { await Purchases.setDisplayName({ displayName: displayName }); } catch(e) {}
                updateRevenueCatSubscriptionState();
              }
            } catch (err) {
              if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
                window.debugLog(`RevenueCat: logIn() error in modal flow: ${sanitizeErrorForLog(err, email)}`);
              }
              scheduleRevenueCatIdentityRetry('sign-in login failed');
            }
          }
          btnAccountSubmit.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
          btnAccountSubmit.disabled = false;
          modalAccount.classList.add('hidden');
          
          if (window._pendingPurchasePlan) {
            const accountTitle = document.getElementById('account-modal-title');
            if (accountTitle) accountTitle.textContent = isSignUpMode ? 'Create Account' : 'Sign In';
            window._pendingPurchasePlan = null;
            showProModal();
          } else {
            modalSettings.classList.remove('hidden');
          }
        }).catch((error) => {
          if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
            window.debugLog(`Firebase Auth: ${isSignUpMode ? 'signUp' : 'signIn'} error: ${sanitizeErrorForLog(error, email)}`);
          }
          btnAccountSubmit.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
          btnAccountSubmit.disabled = false;
          if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            signupError.textContent = "Incorrect email or password. Please try again.";
          } else {
            signupError.textContent = error.message;
          }
        });
      } else {
        if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
          window.debugLog(`Firebase Auth: ${isSignUpMode ? 'signUp' : 'signIn'} attempt for ${maskEmailForLog(email)}`);
        }
        signupError.textContent = '';
        const displayName = isSignUpMode ? name : email.split('@')[0];
        accountInfo.innerHTML = `Signed in as <strong>${escapeHTML(displayName)}</strong><br><span style="font-size:11px; opacity:0.7;">${escapeHTML(email)}</span>`;
        btnAccount.textContent = 'Sign Out';
        btnAccount.style.background = 'rgba(239, 68, 68, 0.1)';
        btnAccount.style.color = 'var(--accent-danger)';
        btnAccount.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        btnAccount.style.boxShadow = 'none';

        // Default to Free Plan on login in mock mode
        PRO_UNLOCKED = false;
        SafeStorage.setItem('isubnet_pro', 'false');
        applyProState();
        document.getElementById('settings-plan-status').innerHTML = `Current Plan: <strong>Free Plan</strong>`;
        if (typeof updateUpgradeUI === 'function') updateUpgradeUI('free');

        modalAccount.classList.add('hidden');
        modalSettings.classList.remove('hidden');
      }
    });
  }

  // Firebase Auth State Observer
  if (useRealFirebase) {
    firebase.auth().onAuthStateChanged((user) => {
      if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
        window.debugLog(`Firebase Auth: onAuthStateChanged fired. User UID: ${user ? maskUidForLog(user.uid) : 'null'}`);
      }
      if (user) {
        if (window.Capacitor && window.Capacitor.Plugins.FirebaseCrashlytics) {
          try {
            window.Capacitor.Plugins.FirebaseCrashlytics.setUserId({ userId: user.uid }).catch(() => {});
            if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
              window.debugLog(`Crashlytics: setUserId(${maskUidForLog(user.uid)})`);
            }
          } catch (e) {}
        }
        // Migrate local data to account
        if (currentUserId === 'local') {
          if (window.APP_DEBUG_ENABLED && window.APP_DEBUG_CURRENT_NOTE_ID && typeof saveNotesToStorage === 'function') {
            try { saveNotesToStorage(); } catch (e) {}
          }
          const localNotesRaw = SafeStorage.getItem('isubnet_notes_local');
          const localHistoryRaw = SafeStorage.getItem('isubnet_history_local');
          
          currentUserId = user.uid;
          
          // Write user metadata to Firestore for administration readability
          db.collection("users").doc(user.uid).set({
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            lastActive: new Date().toISOString()
          }, { merge: true }).catch(err => console.error("Error setting user profile:", err));
          
          if (localNotesRaw) {
            try {
              const localNotes = JSON.parse(localNotesRaw);
              localNotes.forEach(note => saveNoteToFirebase(note));
              SafeStorage.setItem('isubnet_notes_' + user.uid, localNotesRaw);
            } catch(e) {}
          }
          if (localHistoryRaw) {
            try {
              const localHistory = JSON.parse(localHistoryRaw);
              localHistory.forEach(item => saveHistoryToFirebase(item));
              SafeStorage.setItem('isubnet_history_' + user.uid, localHistoryRaw);
            } catch(e) {}
          }
        } else {
          currentUserId = user.uid;
          db.collection("users").doc(user.uid).set({
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            lastActive: new Date().toISOString()
          }, { merge: true }).catch(err => console.error("Error updating user profile:", err));
        }

        loadNotes();
        loadHistory();

        // Check real subscription status from RevenueCat
        if (useRevenueCat) {
          try {
            const { Purchases } = window.Capacitor.Plugins;
            if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
              window.debugLog(`RevenueCat: logIn({ appUserID: ${maskUidForLog(user.uid)} }) called`);
            }
            Purchases.logIn({ appUserID: user.uid })
              .then(async (logInResult) => {
                if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
                  window.debugLog(`RevenueCat: logIn() resolved for UID: ${maskUidForLog(user.uid)}. Created: ${logInResult && logInResult.created ? 'true' : 'false'}`);
                }
                const displayName = user.displayName || user.email.split('@')[0];
                try { await Purchases.setEmail({ email: user.email }); } catch(e) { if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') window.debugLog(`RevenueCat: setEmail failed (ignored) - ` + sanitizeErrorForLog(e, user.email)); }
                try { await Purchases.setDisplayName({ displayName: displayName }); } catch(e) { if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') window.debugLog(`RevenueCat: setDisplayName failed (ignored) - ` + sanitizeErrorForLog(e, user.email)); }
                updateRevenueCatSubscriptionState();
              })
              .catch(err => {
                console.error("RevenueCat login error:", err);
                scheduleRevenueCatIdentityRetry('auth state login failed');
                if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
                  window.debugLog(`ERROR in logIn: ${sanitizeErrorForLog(err, user.email)}`);
                }
                updateRevenueCatSubscriptionState();
              });
          } catch(e) {
            updateRevenueCatSubscriptionState();
          }
        } else {
          // Default to Free Plan if RevenueCat is not active
          PRO_UNLOCKED = false;
          SafeStorage.setItem('isubnet_pro', 'false');
          applyProState();
          document.getElementById('settings-plan-status').innerHTML = `Current Plan: <strong>Free Plan</strong>`;
        if (typeof updateUpgradeUI === 'function') updateUpgradeUI('free');
        }
        
        const displayName = user.displayName || user.email.split('@')[0];
        accountInfo.innerHTML = `Signed in as <strong>${escapeHTML(displayName)}</strong><br><span style="font-size:11px; opacity:0.7;">${escapeHTML(user.email)}</span>`;
        btnAccount.textContent = 'Sign Out';
        if (btnDeleteAccount) btnDeleteAccount.classList.remove('hidden');
        btnAccount.style.background = 'rgba(239, 68, 68, 0.1)';
        btnAccount.style.color = 'var(--accent-danger)';
        btnAccount.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        btnAccount.style.boxShadow = 'none';
        
        syncNotesToFirebase();
        syncHistoryToFirebase();
      } else {
        if (window.Capacitor && window.Capacitor.Plugins.FirebaseCrashlytics) {
          try {
            window.Capacitor.Plugins.FirebaseCrashlytics.setUserId({ userId: '' }).catch(() => {});
            if (typeof window.debugLog === 'function') window.debugLog(`Crashlytics: setUserId(cleared)`);
          } catch (e) {}
        }
        currentUserId = 'local';
        loadNotes();
        loadHistory();

        accountInfo.textContent = 'Not signed in';
        btnAccount.textContent = 'Sign In / Register';
        if (btnDeleteAccount) btnDeleteAccount.classList.add('hidden');
        btnAccount.style.background = 'var(--accent-primary)';
        btnAccount.style.color = '#FFF';
        btnAccount.style.border = 'none';
        btnAccount.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.15)';
        
        PRO_UNLOCKED = false;
        SafeStorage.setItem('isubnet_pro', 'false');
        applyProState();
        document.getElementById('settings-plan-status').innerHTML = `Current Plan: <strong>Free Plan</strong>`;
        if (typeof updateUpgradeUI === 'function') updateUpgradeUI('free');
      }
    });
  }

  function clearLocalUserData(userId) {
    [
      'isubnet_notes', 'isubnet_history',
      'isubnet_notes_local', 'isubnet_history_local',
      'isubnet_notes_' + userId, 'isubnet_history_' + userId
    ].forEach(k => SafeStorage.removeItem(k));
  }

  // Handle account deletion and data erasure (GDPR compliance)
  if (btnDeleteAccount) {
    btnDeleteAccount.addEventListener('click', async () => {
      if (typeof window.debugLog === 'function') window.debugLog(`Button Tap: Delete Account`);
      const confirmDelete = await showConfirmDialog("WARNING: Are you sure you want to permanently delete your account? This will erase your account, your synced notes and calculator history from our servers, and the copies stored on this device. Purchase records held by Apple, Google Play and RevenueCat are not erased by this. This action is irreversible.", { confirmText: "Delete Permanently", cancelText: "Cancel" });
      if (!confirmDelete) return;

      const user = firebase.auth().currentUser;
      if (!user) return;
      const userId = user.uid;

      // Verify identity BEFORE deleting anything, so cancelling or failing here loses no data.
      if (useRealFirebase) {
        const pwd = prompt("To confirm account deletion, please enter your password:");
        if (!pwd) return;
        try {
          const credential = firebase.auth.EmailAuthProvider.credential(user.email, pwd);
          await user.reauthenticateWithCredential(credential);
        } catch (reauthErr) {
          if (typeof window.debugLog === 'function') window.debugLog(`ERROR in reauthenticate: code=${reauthErr && reauthErr.code ? reauthErr.code : 'unknown'}`);
          showErrorDialog("Could not verify your password. Your account was not deleted.");
          return;
        }
      }

      btnDeleteAccount.disabled = true;
      btnDeleteAccount.textContent = 'Deleting Account...';

      try {
        if (useRealFirebase) {
          const batch = db.batch();
          const notesSnapshot = await db.collection("users").doc(userId).collection("notes").get();
          notesSnapshot.forEach(doc => batch.delete(doc.ref));
          const historySnapshot = await db.collection("users").doc(userId).collection("history").get();
          historySnapshot.forEach(doc => batch.delete(doc.ref));
          batch.delete(db.collection("users").doc(userId));
          await batch.commit();
          await user.delete();
        } else {
          console.log("Mock Mode: User data deleted from servers for ID: " + userId);
        }
        showToast("Your account and synced data have been permanently deleted.");
        modalSettings.classList.add('hidden');
        clearLocalUserData(userId);
        window.location.reload();
      } catch (err) {
        if (typeof window.debugLog === 'function') window.debugLog(`ERROR in deleteAccount: code=${err && err.code ? err.code : 'unknown'}`);
        // If the user object is now null, the deletion actually succeeded on the backend
        if (typeof firebase !== 'undefined' && !firebase.auth().currentUser) {
          showToast("Your account and synced data have been permanently deleted.");
          clearLocalUserData(userId);
          window.location.reload();
          return;
        }
        btnDeleteAccount.disabled = false;
        btnDeleteAccount.textContent = 'Delete Account';
        showErrorDialog("Failed to delete account. Please try again or contact support.");
      }
    });
  }

  // Manage Plan logic
  if (btnPlan && modalPlan && btnPlanClose) {
    btnPlan.addEventListener('click', () => {
      modalSettings.classList.add('hidden'); // Hide settings panel to prevent overlap unresponsive clicks
      modalPlan.classList.remove('hidden');
    });
    btnPlanClose.addEventListener('click', () => {
      modalPlan.classList.add('hidden');
      modalSettings.classList.remove('hidden'); // Restore settings panel
    });
  }

  // Billing cycles toggles
  toggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      toggles.forEach(t => {
        t.classList.remove('active');
        t.style.background = 'none';
        t.style.color = 'var(--text-secondary)';
      });
      toggle.classList.add('active');
      toggle.style.background = 'var(--bg-card)';
      toggle.style.color = 'var(--text-primary)';
      
      const cycle = toggle.getAttribute('data-cycle');
      if (cycle === 'monthly') {
        planPrice.textContent = '€0.49/mo';
      } else if (cycle === 'annual') {
        planPrice.textContent = '€2.49/yr';
      } else {
        planPrice.textContent = '€4.99 one-time';
      }
    });
  });

  if (btnPlanSelectPro) {
    btnPlanSelectPro.addEventListener('click', () => {
      let cycle = 'monthly';
      const activeToggle = document.querySelector('.billing-toggle.active');
      if (activeToggle) {
        const dataCycle = activeToggle.getAttribute('data-cycle');
        if (dataCycle === 'annual') {
          cycle = 'yearly';
        } else {
          cycle = dataCycle;
        }
      }
      modalPlan.classList.add('hidden');
      modalSettings.classList.add('hidden');
      purchaseProductByPlan(cycle);
    });
  }

  // Feedback Modal Interaction Handlers
  const btnFeedback = document.getElementById('btn-settings-feedback');
  const modalFeedback = document.getElementById('feedback-modal');
  const btnFeedbackClose = document.getElementById('btn-feedback-close');
  const formAppFeedback = document.getElementById('form-app-feedback');

  if (btnFeedback && modalFeedback && btnFeedbackClose) {
    btnFeedback.addEventListener('click', () => {
      modalSettings.classList.add('hidden');
      modalFeedback.classList.remove('hidden');
    });
    btnFeedbackClose.addEventListener('click', () => {
      modalFeedback.classList.add('hidden');
      modalSettings.classList.remove('hidden');
    });
  }

  if (formAppFeedback) {
    formAppFeedback.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const submitBtn = formAppFeedback.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;
      }
      
      const nameVal = document.getElementById('fb-app-name').value.trim();
      const emailVal = document.getElementById('fb-app-email').value.trim();
      const categoryVal = document.getElementById('fb-app-type').value;
      const messageVal = document.getElementById('fb-app-message').value.trim();
      
      fetch("https://formsubmit.co/ajax/info@isubnet.net", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: nameVal,
          email: emailVal,
          category: categoryVal,
          message: messageVal
        })
      })
      .then(response => {
        if (response.ok) return response.json();
        throw new Error('Network response was not ok.');
      })
      .then(data => {
        if (submitBtn) {
          submitBtn.textContent = 'Submit Feedback';
          submitBtn.disabled = false;
        }
        showToast("Thank you! Your feedback has been sent successfully.");
        formAppFeedback.reset();
        if (modalFeedback) {
          modalFeedback.classList.add('hidden');
        }
      })
      .catch(error => {
        if (submitBtn) {
          submitBtn.textContent = 'Submit Feedback';
          submitBtn.disabled = false;
        }
        showErrorDialog("Oops! There was an issue sending your feedback. Please check your connection and try again.");
      });
    });
  }
}

function initQuickPaste() {
  // Always show the copy+paste button pairs so they are always available
  function updateCopyPasteVisibility() {
    const pairs = ['copy-paste-ipv4', 'copy-paste-ipv6', 'copy-paste-split', 'copy-paste-converter'];
    pairs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('hidden');
        el.style.display = 'flex';
      }
    });
  }

  // Keep a local storage backup of the last copied text in case system clipboard reads are blocked
  function saveToLocalClipboard(text) {
    if (!text) return;
    try {
      window._isubnetLastCopied = text;
      localStorage.setItem('isubnet_last_copied', text);
    } catch(e) {}
  }

  function getLocalClipboardBackup() {
    try {
      return window._isubnetLastCopied || localStorage.getItem('isubnet_last_copied') || '';
    } catch(e) {
      return window._isubnetLastCopied || '';
    }
  }

  // Helper to read clipboard and paste
  function pasteFromClipboard(targetInputId, callback) {
    const inputEl = document.getElementById(targetInputId);
    if (!inputEl) return;

    function doPaste(text) {
      if (text) {
        inputEl.value = text.trim();
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        if (callback) callback();
        inputEl.focus();
        return true;
      }
      return false;
    }

    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText()
        .then(text => {
          if (!doPaste(text)) {
            // try backup
            const backup = getLocalClipboardBackup();
            if (!doPaste(backup)) {
              const fallback = prompt("Clipboard is empty. Enter text to paste:");
              if (fallback) doPaste(fallback);
            }
          }
        })
        .catch(() => {
          // If browser blocked clipboard read, try local backup first
          const backup = getLocalClipboardBackup();
          if (!doPaste(backup)) {
            const fallback = prompt("Enter text to paste (Clipboard permission blocked):");
            if (fallback) doPaste(fallback);
          }
        });
    } else {
      const backup = getLocalClipboardBackup();
      if (!doPaste(backup)) {
        const fallback = prompt("Enter text to paste:");
        if (fallback) doPaste(fallback);
      }
    }
  }

  // IPv4
  const copyIpv4 = document.getElementById('btn-copy-ipv4');
  if (copyIpv4) {
    copyIpv4.addEventListener('click', () => {
      const inputEl = document.getElementById('ipv4-address');
      const val = inputEl.value.trim();
      if (val) {
        saveToLocalClipboard(val);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(val)
            .then(() => flashConfirm(copyIpv4, copyIpv4.innerHTML))
            .catch(() => {
              inputEl.select();
              document.execCommand('copy');
              flashConfirm(copyIpv4, copyIpv4.innerHTML);
            });
        } else {
          inputEl.select();
          document.execCommand('copy');
          flashConfirm(copyIpv4, copyIpv4.innerHTML);
        }
      }
    });
  }
  const pasteIpv4 = document.getElementById('btn-paste-ipv4');
  if (pasteIpv4) {
    pasteIpv4.addEventListener('click', () => {
      pasteFromClipboard('ipv4-address', calculateIPv4);
    });
  }

  // IPv6
  const copyIpv6 = document.getElementById('btn-copy-ipv6');
  if (copyIpv6) {
    copyIpv6.addEventListener('click', () => {
      const inputEl = document.getElementById('ipv6-address');
      const val = inputEl.value.trim();
      if (val) {
        saveToLocalClipboard(val);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(val)
            .then(() => flashConfirm(copyIpv6, copyIpv6.innerHTML))
            .catch(() => {
              inputEl.select();
              document.execCommand('copy');
              flashConfirm(copyIpv6, copyIpv6.innerHTML);
            });
        } else {
          inputEl.select();
          document.execCommand('copy');
          flashConfirm(copyIpv6, copyIpv6.innerHTML);
        }
      }
    });
  }
  const pasteIpv6 = document.getElementById('btn-paste-ipv6');
  if (pasteIpv6) {
    pasteIpv6.addEventListener('click', () => {
      pasteFromClipboard('ipv6-address', calculateIPv6);
    });
  }

  // Splitter
  const copySplit = document.getElementById('btn-copy-split');
  if (copySplit) {
    copySplit.addEventListener('click', () => {
      const inputEl = document.getElementById('split-base-ip');
      const val = inputEl.value.trim();
      if (val) {
        saveToLocalClipboard(val);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(val)
            .then(() => flashConfirm(copySplit, copySplit.innerHTML))
            .catch(() => {
              inputEl.select();
              document.execCommand('copy');
              flashConfirm(copySplit, copySplit.innerHTML);
            });
        } else {
          inputEl.select();
          document.execCommand('copy');
          flashConfirm(copySplit, copySplit.innerHTML);
        }
      }
    });
  }
  const pasteSplit = document.getElementById('btn-paste-split');
  if (pasteSplit) {
    pasteSplit.addEventListener('click', () => {
      pasteFromClipboard('split-base-ip', handleAppSplitIpChange);
    });
  }

  // Converter
  const copyConverter = document.getElementById('btn-copy-converter');
  if (copyConverter) {
    copyConverter.addEventListener('click', () => {
      const inputEl = document.getElementById('converter-input');
      const val = inputEl.value.trim();
      if (val) {
        saveToLocalClipboard(val);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(val)
            .then(() => {
              flashConfirm(copyConverter, copyConverter.innerHTML);
            })
            .catch(() => {
              // Fallback selection copy
              inputEl.select();
              document.execCommand('copy');
              flashConfirm(copyConverter, copyConverter.innerHTML);
            });
        } else {
          // Fallback selection copy
          inputEl.select();
          document.execCommand('copy');
          flashConfirm(copyConverter, copyConverter.innerHTML);
        }
      }
    });
  }
  const pasteConverter = document.getElementById('btn-paste-converter');
  if (pasteConverter) {
    pasteConverter.addEventListener('click', () => {
      pasteFromClipboard('converter-input', () => {
        const event = new Event('input', { bubbles: true });
        document.getElementById('converter-input').dispatchEvent(event);
      });
    });
  }

  // Expose so updateLastCalculatedIP can call it
  window._updateCopyPasteVisibility = updateCopyPasteVisibility;
  updateCopyPasteVisibility();
  
  // Custom Note Box Paste Button (Pastes last copied clipboard item at cursor)
  const pasteNoteClipboardBtn = document.getElementById('btn-paste-note-clipboard');
  if (pasteNoteClipboardBtn) {
    pasteNoteClipboardBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      const noteTextarea = document.getElementById('note-text');
      if (!noteTextarea) return;

      function insertText(clipText) {
        if (!clipText) return;
        const startPos = noteTextarea.selectionStart;
        const endPos = noteTextarea.selectionEnd;
        const text = noteTextarea.value;
        noteTextarea.value = text.substring(0, startPos) + clipText + text.substring(endPos, text.length);
        noteTextarea.focus();
        noteTextarea.selectionStart = startPos + clipText.length;
        noteTextarea.selectionEnd = startPos + clipText.length;
      }

      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText()
          .then(text => {
            if (text) {
              insertText(text);
            } else {
              const backup = getLocalClipboardBackup();
              if (backup) {
                insertText(backup);
              } else {
                const fallback = prompt("Clipboard is empty. Enter text to paste:");
                if (fallback) insertText(fallback);
              }
            }
          })
          .catch(() => {
            const backup = getLocalClipboardBackup();
            if (backup) {
              insertText(backup);
            } else {
              const fallback = prompt("Enter text to paste (Clipboard permission blocked):");
              if (fallback) insertText(fallback);
            }
          });
      } else {
        const backup = getLocalClipboardBackup();
        if (backup) {
          insertText(backup);
        } else {
          const fallback = prompt("Enter text to paste:");
          if (fallback) insertText(fallback);
        }
      }
    });
  }
  
  renderQuickPastePills();
}

// --- Run Setup on page load ---
const REVIEW_PROMPT_CALC_THRESHOLD = 6;
async function maybeRequestReview(triggerReason = '') {
  try {
    const isRequested = SafeStorage.getItem('isubnet_review_requested') === 'true';
    if (isRequested) return;

    const calcCount = parseInt(SafeStorage.getItem('isubnet_review_calc_count') || '0', 10);
    const sessionCount = parseInt(SafeStorage.getItem('isubnet_review_session_count') || '0', 10);

    const isVlsm = triggerReason === 'vlsm';
    const isExplicitSave = triggerReason === 'save_note';

    const meetsThresholds = (calcCount >= REVIEW_PROMPT_CALC_THRESHOLD && sessionCount >= 2) || (sessionCount >= 3);
    
    if (meetsThresholds || isVlsm || isExplicitSave) {
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        const { InAppReview } = window.Capacitor.Plugins;
        if (InAppReview) {
          await InAppReview.requestReview();
        }
      }
      SafeStorage.setItem('isubnet_review_requested', 'true');
      SafeStorage.setItem('isubnet_review_requested_date', new Date().toISOString());
    }
  } catch (e) {
    console.error('Review request failed', e);
  }
}

function stripDisallowedChars(el, allowedCharRegex) {
  const original = el.value;
  let cursorPos = el.selectionStart;
  if (cursorPos === null || cursorPos === undefined) cursorPos = original.length;
  let filtered = '';
  let removedBeforeCursor = 0;
  for (let i = 0; i < original.length; i++) {
    const ch = original[i];
    if (allowedCharRegex.test(ch)) {
      filtered += ch;
    } else if (i < cursorPos) {
      removedBeforeCursor++;
    }
  }
  if (filtered !== original) {
    el.value = filtered;
    const newPos = Math.max(0, cursorPos - removedBeforeCursor);
    if (typeof el.setSelectionRange === 'function') {
      el.setSelectionRange(newPos, newPos);
    }
  }
}

function collapseDuplicateDots(el) {
  const original = el.value;
  let cursorPos = el.selectionStart;
  if (cursorPos === null || cursorPos === undefined) cursorPos = original.length;

  let filtered = '';
  let removedBeforeCursor = 0;
  let lastWasDot = false;

  for (let i = 0; i < original.length; i++) {
    const ch = original[i];
    const isDuplicateDot = ch === '.' && lastWasDot;
    if (isDuplicateDot) {
      if (i < cursorPos) removedBeforeCursor++;
    } else {
      filtered += ch;
    }
    lastWasDot = (ch === '.');
  }

  if (filtered !== original) {
    el.value = filtered;
    const newPos = Math.max(0, cursorPos - removedBeforeCursor);
    if (typeof el.setSelectionRange === 'function') {
      el.setSelectionRange(newPos, newPos);
    }
  }
}

function normalizeDnsInput(el) {
  const original = el.value;
  let pos = el.selectionStart;
  if (pos === null || pos === undefined) pos = original.length;
  // commas become dots (same length, so the cursor stays put)
  let v = original.replace(/,/g, '.');
  // a DNS query only needs the host: drop ?query / #fragment, and any user@ prefix
  let t = v.replace(/[?#][\s\S]*$/, '');
  t = t.replace(/^((?:[a-z][a-z0-9+.\-]*:\/\/)?)[^\/]*@/i, '$1');
  const trimmed = (t !== v);
  v = t;
  if (v !== original) {
    el.value = v;
    const newPos = trimmed ? v.length : pos;
    if (typeof el.setSelectionRange === 'function') el.setSelectionRange(newPos, newPos);
  }
}

function collapseDuplicateColons(el) {
  const original = el.value;
  let cursorPos = el.selectionStart;
  if (cursorPos === null || cursorPos === undefined) cursorPos = original.length;

  let filtered = '';
  let removedBeforeCursor = 0;
  let consecutiveColons = 0;

  for (let i = 0; i < original.length; i++) {
    const ch = original[i];
    if (ch === ':') {
      consecutiveColons++;
      if (consecutiveColons > 2) {
        if (i < cursorPos) removedBeforeCursor++;
        continue;
      }
    } else {
      consecutiveColons = 0;
    }
    filtered += ch;
  }

  if (filtered !== original) {
    el.value = filtered;
    const newPos = Math.max(0, cursorPos - removedBeforeCursor);
    if (typeof el.setSelectionRange === 'function') {
      el.setSelectionRange(newPos, newPos);
    }
  }
}

function setupInputSanitizers() {
  const rules = [
    { id: 'ipv4-hosts',       allowed: /[0-9]/ },
    { id: 'ipv6-hosts',       allowed: /[0-9]/ },
    { id: 'ipv6-address',     allowed: /[0-9a-fA-F:./]/ },
    { id: 'ipv4-bulk-input',  allowed: /[0-9a-fA-F.:/\n]/ },
    { id: 'ipv6-bulk-input',  allowed: /[0-9a-fA-F.:/\n]/ },
    { id: 'split-base-ip',    allowed: /[0-9a-fA-F.:/]/ },
    { id: 'split-vlsm-hosts', allowed: /[0-9., ]/ },
    { id: 'dns-input', allowed: /[\p{L}\p{N}._\-:\/]/u },
    { id: 'ping-input', allowed: /[\p{L}\p{N}._\-:\/]/u },
    { id: 'trace-input', allowed: /[\p{L}\p{N}._\-:\/]/u },
    { id: 'whois-input', allowed: /[\p{L}\p{N}._\-:\/]/u }
  ];
  rules.forEach(({ id, allowed }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      if (id === 'dns-input' || id === 'ping-input' || id === 'trace-input' || id === 'whois-input') normalizeDnsInput(el);
      stripDisallowedChars(el, allowed);
      if (id === 'ipv6-address' || id === 'split-base-ip' || id === 'ipv4-bulk-input' || id === 'ipv6-bulk-input' || id === 'dns-input' || id === 'ping-input' || id === 'trace-input' || id === 'whois-input') {
        collapseDuplicateDots(el);
        collapseDuplicateColons(el);
      }
    });
  });
}

// ===== TAB-BAR-HIDE EXPERIMENT: START =====
// EXPERIMENT (build 113): hide the bottom tab bar while the keyboard is open. Set to false to get exactly the build 112 behaviour. To remove: delete everything between the two "TAB-BAR-HIDE EXPERIMENT" markers.
const HIDE_TAB_BAR_WHEN_KEYBOARD_OPEN = true;
const TAB_BAR_GRACE_MS = 420;
const TAB_BAR_VIEWPORT_FULL_MS = 500;
const TAB_BAR_VIEWPORT_SHRINK_MS = 300;

let isTabBarHiddenByExperiment = false;
let tabBarShowDebounceTimer = null;
let tabBarPendingShowReason = null;
let tabBarVisibilityTimer = null;
let tabBarGraceTimer = null;
let tabBarViewportFullTimer = null;
let tabBarViewportShrinkTimer = null;
let tabBarShrinkCandidateHeight = 0;
let tabBarShrinkCandidateElement = null;
let keyboardShownByEvents = false;
let lastKeyboardWillShowTs = 0;
let lastKeyboardHideTs = 0;
let maxExperimentViewportHeight = 0;
let lastExperimentViewportWidth = 0;
let needsViewportBaselineResetAfterKbd = false;
let viewportShrunkWhileHidden = false;
let tabBarExperimentInitialized = false;

function isTabBarHideExperimentActive() {
  if (typeof window._HIDE_TAB_BAR_WHEN_KEYBOARD_OPEN_OVERRIDE === 'boolean') {
    return window._HIDE_TAB_BAR_WHEN_KEYBOARD_OPEN_OVERRIDE;
  }
  return HIDE_TAB_BAR_WHEN_KEYBOARD_OPEN;
}

function getExperimentViewportHeight() {
  const vv = window.visualViewport;
  if (vv && typeof vv.height === 'number') {
    return vv.height;
  }
  return window.innerHeight || 0;
}

function getExperimentViewportWidth() {
  return window.innerWidth || (window.visualViewport && typeof window.visualViewport.width === 'number' ? window.visualViewport.width : 0) || 0;
}

function updateMaxExperimentViewportHeight() {
  const vh = getExperimentViewportHeight();
  const vw = getExperimentViewportWidth();
  if (vw > 0) {
    if (lastExperimentViewportWidth === 0) {
      lastExperimentViewportWidth = vw;
    } else if (Math.abs(vw - lastExperimentViewportWidth) > 50) {
      lastExperimentViewportWidth = vw;
      cancelTabBarViewportShrinkTimer();
      cancelTabBarViewportFullTimer();
      if (!keyboardShownByEvents) {
        maxExperimentViewportHeight = vh > 0 ? vh : 0;
        needsViewportBaselineResetAfterKbd = false;
      } else {
        maxExperimentViewportHeight = 0;
        needsViewportBaselineResetAfterKbd = true;
      }
      if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
        window.debugLog('[KBD] tabbar: viewport baseline reset | reason=resize');
      }
      return vh;
    }
  }
  if (needsViewportBaselineResetAfterKbd && !keyboardShownByEvents && vh > 0) {
    maxExperimentViewportHeight = vh;
    needsViewportBaselineResetAfterKbd = false;
  }
  if (!keyboardShownByEvents && vh > maxExperimentViewportHeight) {
    maxExperimentViewportHeight = vh;
  } else if (maxExperimentViewportHeight === 0 && !needsViewportBaselineResetAfterKbd && vh > 0) {
    maxExperimentViewportHeight = vh;
  }
  return vh;
}

function isExperimentTextEntry(el) {
  if (!el || !el.tagName) return false;
  if (el.disabled || el.readOnly) return false;
  const tag = el.tagName.toUpperCase();
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    return !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(type);
  }
  return Boolean(el.isContentEditable);
}

function getEffectiveTabBarHeight(tabBarEl) {
  const el = tabBarEl || document.querySelector('.app-tab-bar');
  if (!el) return 0;
  if (isTabBarHideExperimentActive() && (isTabBarHiddenByExperiment || el.classList.contains('kbd-tabbar-hidden'))) {
    return 0;
  }
  return el.getBoundingClientRect().height || el.offsetHeight || 0;
}

function getEffectiveTabBarTop(tabBarEl) {
  const el = tabBarEl || document.querySelector('.app-tab-bar');
  if (getEffectiveTabBarHeight(el) === 0) {
    const vv = window.visualViewport;
    return (vv && vv.height > 0) ? (vv.offsetTop + vv.height) : window.innerHeight;
  }
  return el ? el.getBoundingClientRect().top : window.innerHeight;
}

function cancelTabBarGraceTimer(logCancelReason) {
  if (tabBarGraceTimer) {
    clearTimeout(tabBarGraceTimer);
    tabBarGraceTimer = null;
    if (logCancelReason && window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
      window.debugLog(`[KBD] tabbar: grace timer cancelled | reason=${logCancelReason}`);
    }
  }
}

function cancelTabBarViewportFullTimer() {
  if (tabBarViewportFullTimer) {
    clearTimeout(tabBarViewportFullTimer);
    tabBarViewportFullTimer = null;
  }
}

function cancelTabBarViewportShrinkTimer() {
  if (tabBarViewportShrinkTimer) {
    clearTimeout(tabBarViewportShrinkTimer);
    tabBarViewportShrinkTimer = null;
  }
  tabBarShrinkCandidateHeight = 0;
  tabBarShrinkCandidateElement = null;
}

function hideTabBarForKeyboard(reason) {
  if (!isTabBarHideExperimentActive()) return;
  updateMaxExperimentViewportHeight();
  const tabBar = document.querySelector('.app-tab-bar');
  const content = document.querySelector('.app-content');
  if (!tabBar) return;
  if (tabBarShowDebounceTimer) {
    clearTimeout(tabBarShowDebounceTimer);
    tabBarShowDebounceTimer = null;
    tabBarPendingShowReason = null;
  }
  cancelTabBarViewportFullTimer();
  cancelTabBarViewportShrinkTimer();
  if (!isTabBarHiddenByExperiment) {
    if (tabBarVisibilityTimer) {
      clearTimeout(tabBarVisibilityTimer);
      tabBarVisibilityTimer = null;
    }
    isTabBarHiddenByExperiment = true;
    viewportShrunkWhileHidden = (reason === 'viewport-shrink');
    if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
      window.debugLog(`[KBD] tabbar: hide | reason=${reason}`);
    }
    tabBar.classList.add('kbd-tabbar-anim', 'kbd-tabbar-hidden');
    if (content) content.classList.add('kbd-content-expanded');
    const reducedMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reducedMotion) {
      tabBar.classList.add('kbd-tabbar-invisible');
    } else {
      tabBarVisibilityTimer = setTimeout(() => {
        tabBarVisibilityTimer = null;
        if (isTabBarHiddenByExperiment) {
          tabBar.classList.add('kbd-tabbar-invisible');
        }
      }, 185);
    }
  }
}

function performShowTabBarForKeyboard(reason) {
  if (tabBarShowDebounceTimer) {
    clearTimeout(tabBarShowDebounceTimer);
    tabBarShowDebounceTimer = null;
    tabBarPendingShowReason = null;
  }
  if (tabBarVisibilityTimer) {
    clearTimeout(tabBarVisibilityTimer);
    tabBarVisibilityTimer = null;
  }
  cancelTabBarGraceTimer(null);
  cancelTabBarViewportFullTimer();
  cancelTabBarViewportShrinkTimer();
  viewportShrunkWhileHidden = false;
  if (!isTabBarHiddenByExperiment) return;
  isTabBarHiddenByExperiment = false;
  const tabBar = document.querySelector('.app-tab-bar');
  const content = document.querySelector('.app-content');
  if (tabBar) {
    tabBar.classList.remove('kbd-tabbar-invisible', 'kbd-tabbar-hidden');
    if (reason === 'keyboard-gone' || reason === 'viewport-full') {
      tabBar.style.bottom = '';
    }
  }
  if (content) {
    content.classList.remove('kbd-content-expanded');
    if (reason === 'keyboard-gone' || reason === 'viewport-full') {
      content.style.paddingBottom = '';
    }
  }
  if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
    window.debugLog(`[KBD] tabbar: show | reason=${reason}`);
  }
}

function startTabBarGraceTimer() {
  if (!isTabBarHideExperimentActive()) return;
  if (!isTabBarHiddenByExperiment) return;
  if (tabBarGraceTimer) {
    clearTimeout(tabBarGraceTimer);
    tabBarGraceTimer = null;
  }
  const willShowTsAtStart = lastKeyboardWillShowTs;
  if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
    window.debugLog('[KBD] tabbar: grace timer start');
  }
  tabBarGraceTimer = setTimeout(() => {
    tabBarGraceTimer = null;
    if (!isTabBarHideExperimentActive() || !isTabBarHiddenByExperiment) return;
    if (keyboardShownByEvents || lastKeyboardWillShowTs > willShowTsAtStart) return;
    performShowTabBarForKeyboard('keyboard-gone');
  }, TAB_BAR_GRACE_MS);
}

function scheduleShowTabBarForKeyboard(reason, immediate = false) {
  if (!isTabBarHideExperimentActive()) return;
  if (!isTabBarHiddenByExperiment && !tabBarShowDebounceTimer) return;
  if (immediate) {
    if (isExperimentTextEntry(document.activeElement)) return;
    performShowTabBarForKeyboard(reason);
    return;
  }
  if (tabBarShowDebounceTimer) {
    clearTimeout(tabBarShowDebounceTimer);
  }
  if (tabBarPendingShowReason !== 'focus-lost' || reason === 'focus-lost') {
    tabBarPendingShowReason = reason;
  }
  const effectiveReason = tabBarPendingShowReason || reason;
  tabBarShowDebounceTimer = setTimeout(() => {
    tabBarShowDebounceTimer = null;
    tabBarPendingShowReason = null;
    if (!isTabBarHideExperimentActive() || !isTabBarHiddenByExperiment) return;
    if (isExperimentTextEntry(document.activeElement)) {
      if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
        window.debugLog('[KBD] tabbar: show deferred | reason=field-still-focused');
      }
      return;
    }
    performShowTabBarForKeyboard(effectiveReason);
  }, 160);
}

function onTabBarExperimentKeyboardShow() {
  if (!isTabBarHideExperimentActive()) return;
  keyboardShownByEvents = true;
  lastKeyboardWillShowTs = Date.now();
  cancelTabBarGraceTimer('keyboard-show');
  cancelTabBarViewportFullTimer();
  cancelTabBarViewportShrinkTimer();
  hideTabBarForKeyboard('keyboard-show');
}

function onTabBarExperimentKeyboardDidShow() {
  if (!isTabBarHideExperimentActive()) return;
  keyboardShownByEvents = true;
  cancelTabBarGraceTimer('keyboard-show');
  cancelTabBarViewportFullTimer();
  cancelTabBarViewportShrinkTimer();
  if (!isTabBarHiddenByExperiment) {
    hideTabBarForKeyboard('keyboard-show');
  }
}

function onTabBarExperimentKeyboardHide() {
  if (!isTabBarHideExperimentActive()) return;
  keyboardShownByEvents = false;
  lastKeyboardHideTs = Date.now();
  cancelTabBarViewportShrinkTimer();
  startTabBarGraceTimer();
  scheduleShowTabBarForKeyboard('keyboard-hide', false);
}

function onTabBarExperimentViewportResize() {
  if (!isTabBarHideExperimentActive()) return;
  const vh = updateMaxExperimentViewportHeight();
  if (!isTabBarHiddenByExperiment) {
    cancelTabBarViewportFullTimer();
    const activeEl = document.activeElement;
    if (vh <= 0 || maxExperimentViewportHeight <= 0 || !isExperimentTextEntry(activeEl) || (maxExperimentViewportHeight - vh) <= 150) {
      cancelTabBarViewportShrinkTimer();
      return;
    }
    if (tabBarViewportShrinkTimer && tabBarShrinkCandidateElement === activeEl && Math.abs(vh - tabBarShrinkCandidateHeight) <= 3) {
      return;
    }
    if (tabBarViewportShrinkTimer) {
      clearTimeout(tabBarViewportShrinkTimer);
      tabBarViewportShrinkTimer = null;
    }
    tabBarShrinkCandidateHeight = vh;
    tabBarShrinkCandidateElement = activeEl;
    const candidateVh = vh;
    const candidateEl = activeEl;
    const hideTsAtStart = lastKeyboardHideTs;
    tabBarViewportShrinkTimer = setTimeout(() => {
      tabBarViewportShrinkTimer = null;
      if (!isTabBarHideExperimentActive() || isTabBarHiddenByExperiment) return;
      if (lastKeyboardHideTs > hideTsAtStart) return;
      const currentEl = document.activeElement;
      if (!currentEl || currentEl !== candidateEl || !isExperimentTextEntry(currentEl)) return;
      const currentVh = updateMaxExperimentViewportHeight();
      if (currentVh <= 0 || maxExperimentViewportHeight <= 0) return;
      if ((maxExperimentViewportHeight - currentVh) <= 150) return;
      if (Math.abs(currentVh - candidateVh) > 3) return;
      hideTabBarForKeyboard('viewport-shrink');
    }, TAB_BAR_VIEWPORT_SHRINK_MS);
    return;
  }
  cancelTabBarViewportShrinkTimer();
  if (vh <= 0 || maxExperimentViewportHeight <= 0) {
    cancelTabBarViewportFullTimer();
    return;
  }
  const isAtFullHeight = (maxExperimentViewportHeight - vh) <= 2;
  if (!isAtFullHeight) {
    viewportShrunkWhileHidden = true;
    cancelTabBarViewportFullTimer();
    return;
  }
  // Viewport is back within 2px of full height while the bar is hidden.
  if (!viewportShrunkWhileHidden && !keyboardShownByEvents) {
    return;
  }
  if (tabBarViewportFullTimer) return;
  const willShowTsAtResize = lastKeyboardWillShowTs;
  tabBarViewportFullTimer = setTimeout(() => {
    tabBarViewportFullTimer = null;
    if (!isTabBarHideExperimentActive() || !isTabBarHiddenByExperiment) return;
    if (lastKeyboardWillShowTs > willShowTsAtResize) return;
    const currentVh = updateMaxExperimentViewportHeight();
    if (currentVh <= 0 || (maxExperimentViewportHeight - currentVh) > 2) return;
    keyboardShownByEvents = false;
    performShowTabBarForKeyboard('viewport-full');
  }, TAB_BAR_VIEWPORT_FULL_MS);
}

function setupTabBarHideExperiment() {
  window.getEffectiveTabBarHeight = getEffectiveTabBarHeight;
  window.getEffectiveTabBarTop = getEffectiveTabBarTop;
  updateMaxExperimentViewportHeight();
  if (tabBarExperimentInitialized) return;
  tabBarExperimentInitialized = true;

  document.addEventListener('focusin', (e) => {
    if (!isTabBarHideExperimentActive()) return;
    if (isExperimentTextEntry(e.target)) {
      hideTabBarForKeyboard('focus');
    }
  });

  document.addEventListener('focusout', (e) => {
    if (!isTabBarHideExperimentActive()) return;
    cancelTabBarViewportShrinkTimer();
    if (isExperimentTextEntry(e.target)) {
      scheduleShowTabBarForKeyboard('focus-lost', false);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!isTabBarHideExperimentActive()) return;
    if (document.visibilityState === 'visible' && isTabBarHiddenByExperiment && !isExperimentTextEntry(document.activeElement)) {
      scheduleShowTabBarForKeyboard('resume', true);
    }
  });

  window.addEventListener('focus', () => {
    if (!isTabBarHideExperimentActive()) return;
    if (isTabBarHiddenByExperiment && !isExperimentTextEntry(document.activeElement)) {
      scheduleShowTabBarForKeyboard('safety', true);
    }
  });

  window.addEventListener('blur', () => {
    if (!isTabBarHideExperimentActive()) return;
    if (isTabBarHiddenByExperiment && !isExperimentTextEntry(document.activeElement)) {
      scheduleShowTabBarForKeyboard('safety', true);
    }
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      onTabBarExperimentViewportResize();
    });
  }
  window.addEventListener('resize', () => {
    onTabBarExperimentViewportResize();
  });
  window.addEventListener('orientationchange', () => {
    if (!isTabBarHideExperimentActive()) return;
    cancelTabBarViewportShrinkTimer();
    cancelTabBarViewportFullTimer();
    onTabBarExperimentViewportResize();
  });

  if (typeof MutationObserver !== 'undefined') {
    const modalObserver = new MutationObserver(() => {
      if (!isTabBarHideExperimentActive()) return;
      if (isTabBarHiddenByExperiment && !isExperimentTextEntry(document.activeElement)) {
        scheduleShowTabBarForKeyboard('safety', true);
      }
    });
    document.querySelectorAll('.pro-modal-overlay').forEach((el) => {
      modalObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  }
}
// ===== TAB-BAR-HIDE EXPERIMENT: END =====

function setupKeyboardAvoidance() {
  setupTabBarHideExperiment(); // TAB-BAR-HIDE EXPERIMENT hook
  const dlog = (msg) => { if (typeof window.debugLog === 'function') window.debugLog(`[KBD] ${msg}`); };

  if (!(window.Capacitor && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins.Keyboard)) {
    dlog(`setupKeyboardAvoidance() ABORTED - not native or Keyboard plugin missing. isNativePlatform=${!!(window.Capacitor && window.Capacitor.isNativePlatform())} hasKeyboardPlugin=${!!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Keyboard)}`);
    return;
  }
  // Android uses the native "adjustResize" behavior (Keyboard resize:"native" in
  // capacitor.config.json + windowSoftInputMode="adjustResize" in AndroidManifest.xml),
  // so the OS already resizes the WebView and tabBar/content reposition themselves via
  // the existing CSS (position:absolute; bottom:0 inside a shrinking 100vh wrapper) -
  // no manual style manipulation needed there, and doing it anyway double-compensates
  // and breaks the layout (tab bar gets shoved off-screen). iOS uses resize:"none"
  // (see capacitor.config.json's "ios" override), so the WebView never resizes and
  // applyKeyboardHeight() below is the only thing moving tabBar/content on iOS.
  //
  // BUT: on both platforms, .app-tab-bar is position:absolute and layered on top of
  // .app-content (z-index:100) rather than pushed out of the document flow, so even
  // when Android correctly repositions the tab bar via native resize, nothing tells
  // the browser's own focus-scroll behavior that the tab bar band is occupied - a
  // focused input can still end up rendered underneath it. That's what
  // scrollFocusedIntoView() below fixes, by reading the tab bar's actual current
  // position (however it got there) and nudging content.scrollTop so the focused
  // field clears it. So scrollFocusedIntoView() must run on BOTH platforms; only
  // applyKeyboardHeight()'s manual style writes are iOS-only.
  const isIOS = window.Capacitor.getPlatform() === 'ios';
  dlog(`setupKeyboardAvoidance() platform="${window.Capacitor.getPlatform()}" isIOS=${isIOS} - manual tabBar/content styling ${isIOS ? 'ENABLED' : 'DISABLED (native resize handles it)'}, scroll-clear-of-tabbar ENABLED either way`);
  const { Keyboard } = window.Capacitor.Plugins;
  const content = document.querySelector('.app-content');
  const tabBar = document.querySelector('.app-tab-bar');
  if (!content || !tabBar) {
    dlog(`setupKeyboardAvoidance() ABORTED - missing element. content=${!!content} tabBar=${!!tabBar}`);
    return;
  }

  dlog(`setupKeyboardAvoidance() initialized. innerHeight=${window.innerHeight} visualViewport.height=${window.visualViewport ? window.visualViewport.height : 'n/a'} tabBar.rect=${JSON.stringify(tabBar.getBoundingClientRect())} content.rect=${JSON.stringify(content.getBoundingClientRect())}`);

  let baseContentPaddingBottom = null;

  // Baseline "keyboard fully hidden" viewport height. In theory resize:"none" keeps
  // window.innerHeight constant on iOS the whole time, but in practice a debug log
  // caught a case (hopping focus between two fields with different keyboard types via
  // the "Next" accessory button) where WKWebView briefly resized its own viewport out
  // from under us anyway - innerHeight/visualViewport.height genuinely dropped from
  // 874 to 566 (exactly keyboardHeight's 308px) even with resize:"none" configured.
  // When that happens, applying the full keyboardHeight as an ADDITIONAL tabBar/content
  // offset on top of a viewport that's already shrunk by that same amount double-
  // compensates and shoves the tab bar way up near the top of the screen. So instead of
  // blindly trusting info.keyboardHeight, we track the tallest innerHeight we've ever
  // observed as the "true" full-viewport baseline, and only ever apply the REMAINING
  // gap the OS hasn't already closed for us.
  //
  // Deliberately NOT "reset the baseline whenever keyboardDidHide fires": that same log
  // showed keyboardDidHide firing mid-transition (during a field-to-field "Next" hop)
  // while innerHeight was STILL shrunk to 566 - the keyboard hadn't actually gone away,
  // it was about to reshow for the next field. Resetting the baseline to that stale
  // shrunk value there would recreate the exact bug this is fixing. A max-tracking
  // baseline can only grow, so a momentarily-shrunk reading can never corrupt it - the
  // real full height (874) simply gets kept until an even taller reading appears.
  let fullViewportHeight = window.innerHeight;
  const trackFullViewportHeight = () => {
    if (window.innerHeight > fullViewportHeight) {
      dlog(`  fullViewportHeight updated ${fullViewportHeight} -> ${window.innerHeight}`);
      fullViewportHeight = window.innerHeight;
    }
  };

  const snapshot = (label) => {
    const tbRect = tabBar.getBoundingClientRect();
    const cRect = content.getBoundingClientRect();
    dlog(`${label} :: innerHeight=${window.innerHeight} vv.height=${window.visualViewport ? window.visualViewport.height : 'n/a'} vv.offsetTop=${window.visualViewport ? window.visualViewport.offsetTop : 'n/a'} tabBar.style.bottom="${tabBar.style.bottom}" tabBar.rect.bottom=${tbRect.bottom} tabBar.rect.top=${tbRect.top} content.style.paddingBottom="${content.style.paddingBottom}" content.rect.bottom=${cRect.bottom} activeElement=${document.activeElement ? document.activeElement.tagName + '#' + document.activeElement.id : 'none'}`);
  };

  // Tracks the last known keyboard height so the visualViewport resize listener
  // (below) can re-run applyKeyboardHeight() if the WebView resizes AFTER we've
  // already applied an offset - see that listener for why this matters.
  let currentKeyboardHeight = 0;

  // Field-testing (debug logs) showed the visualViewport resize listener below
  // fires reliably ~580-630ms after keyboardWillShow on this app's target devices,
  // and ALWAYS fully closes the gap (alreadyResizedBy consistently equals the
  // reported keyboardHeight, landing neededOffset at exactly 0) - meaning the
  // WKWebView DOES resize itself here despite resize:"none", every time observed.
  // Applying the full manual offset immediately in that case, only to correct it
  // back down once the resize confirms it wasn't needed, produces a visible
  // overshoot-then-correct flicker: the tab bar jumps past its final resting spot,
  // holds for ~600ms, then jumps back. The "padding-bottom 0.2s ease" transition on
  // .app-content only smooths the two edges of that motion - it can't remove the
  // overshoot itself. So on iOS we now default to trusting the native resize (one
  // clean move to the correct final position, no overshoot) and only apply the
  // manual offset as a fallback if that resize doesn't arrive in time - preserving
  // the original "Greek IPv6 keyboard" case (see the visualViewport listener below)
  // this logic exists for, on devices/keyboards where the WebView never resizes.
  const KEYBOARD_SHOW_FALLBACK_MS = 700;
  let keyboardShowFallbackTimeout = null;
  const clearKeyboardShowFallback = () => {
    if (keyboardShowFallbackTimeout) {
      clearTimeout(keyboardShowFallbackTimeout);
      keyboardShowFallbackTimeout = null;
    }
  };

  const applyKeyboardHeight = (height) => {
    dlog(`applyKeyboardHeight(${height}) called`);
    currentKeyboardHeight = height;
    if (!isIOS) {
      dlog(`  SKIPPED - non-iOS platform relies on native adjustResize, no manual tabBar/content styling`);
      return;
    }
    trackFullViewportHeight();
    if (height > 0) {
      if (baseContentPaddingBottom === null) {
        baseContentPaddingBottom = parseFloat(getComputedStyle(content).paddingBottom) || 0;
        dlog(`  baseContentPaddingBottom captured = ${baseContentPaddingBottom}`);
      }
      const alreadyResizedBy = Math.max(0, fullViewportHeight - window.innerHeight);
      const neededOffset = Math.max(0, height - alreadyResizedBy);
      dlog(`  fullViewportHeight=${fullViewportHeight} innerHeight=${window.innerHeight} alreadyResizedBy=${alreadyResizedBy} -> neededOffset=${neededOffset} (raw height=${height})`);
      tabBar.style.bottom = `${neededOffset}px`;
      content.style.paddingBottom = `${(getEffectiveTabBarHeight(tabBar) === 0 ? 12 : baseContentPaddingBottom) + neededOffset}px`; // TAB-BAR-HIDE EXPERIMENT hook
    } else {
      tabBar.style.bottom = '';
      content.style.paddingBottom = '';
    }
    snapshot(`  after applyKeyboardHeight(${height})`);
  };

  const scrollFocusedIntoView = () => {
    const active = document.activeElement;
    if (!(active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA'))) {
      dlog(`scrollFocusedIntoView() no focused input/textarea (activeElement=${active ? active.tagName : 'none'})`);
      return;
    }
    const tabBarTop = getEffectiveTabBarTop(tabBar); // TAB-BAR-HIDE EXPERIMENT hook
    const margin = 12;
    const rect = active.getBoundingClientRect();
    dlog(`scrollFocusedIntoView() active=${active.tagName}#${active.id} rect.top=${rect.top} rect.bottom=${rect.bottom} tabBarTop=${tabBarTop} content.scrollTop(before)=${content.scrollTop}`);
    // Optional: a field can name a button that should also stay above the tab bar
    // (data-kbd-keep-visible="<button id>"), e.g. the Ping button under the Ping fields.
    const keepId = active.getAttribute('data-kbd-keep-visible');
    const keepEl = keepId ? document.getElementById(keepId) : null;
    const bottomEdge = keepEl ? Math.max(rect.bottom, keepEl.getBoundingClientRect().bottom) : rect.bottom;
    if (bottomEdge > tabBarTop - margin) {
      let delta = bottomEdge - (tabBarTop - margin);
      if (keepEl) {
        // Never scroll the focused field itself off the top of the content area.
        const fieldMin = Math.max(0, rect.bottom - (tabBarTop - margin));
        const fieldMax = Math.max(fieldMin, rect.top - content.getBoundingClientRect().top - margin);
        delta = Math.max(fieldMin, Math.min(delta, fieldMax));
      }
      content.scrollTop += delta;
      dlog(`  input bottom (${rect.bottom}) was below safe boundary (${tabBarTop - margin}) -> scrolled by ${delta}px, content.scrollTop(after)=${content.scrollTop}`);
    } else if (rect.top < content.getBoundingClientRect().top) {
      const delta = rect.top - content.getBoundingClientRect().top - margin;
      content.scrollTop += delta;
      dlog(`  input top (${rect.top}) was above content top -> scrolled by ${delta}px, content.scrollTop(after)=${content.scrollTop}`);
    } else {
      dlog(`  input already clear of tab bar, no scroll needed`);
    }
  };

  // Fields with different `inputmode` values (e.g. numeric vs. default/full-QWERTY)
  // trigger different native keyboard heights, so hopping via "Next" between them
  // can leave window.visualViewport briefly offset from the layout viewport
  // (observed: offsetTop=27 mid-transition on a split-base-ip -> split-vlsm-hosts
  // hop, same root cause as the base-bin/oct/dec (numeric) -> base-hex (no
  // inputmode) hop on the Base Converter tab). Running scrollFocusedIntoView()
  // against that transient, about-to-change geometry produces a faint visible
  // glitch. This wrapper defers up to 5 animation frames for offsetTop to settle
  // back to 0 before measuring, and gives up and runs anyway if it never does, so
  // this can never hang indefinitely.
  const scrollFocusedIntoViewWhenSettled = (retriesLeft = 5) => {
    if (isIOS && window.visualViewport && window.visualViewport.offsetTop !== 0 && retriesLeft > 0) {
      dlog(`scrollFocusedIntoViewWhenSettled() offsetTop=${window.visualViewport.offsetTop} not settled, retriesLeft=${retriesLeft} -> deferring one more rAF`);
      requestAnimationFrame(() => scrollFocusedIntoViewWhenSettled(retriesLeft - 1));
      return;
    }
    if (isIOS && window.visualViewport && window.visualViewport.offsetTop !== 0) {
      dlog(`scrollFocusedIntoViewWhenSettled() gave up waiting for offsetTop to settle (still ${window.visualViewport.offsetTop}) - running scrollFocusedIntoView() anyway`);
    }
    scrollFocusedIntoView();
  };

  Keyboard.addListener('keyboardWillShow', (info) => {
    dlog(`EVENT keyboardWillShow fired, info=${JSON.stringify(info)}`);
    onTabBarExperimentKeyboardShow(); // TAB-BAR-HIDE EXPERIMENT hook
    const height = (info && info.keyboardHeight) || 0;
    if (!isIOS) {
      applyKeyboardHeight(height);
      return;
    }
    currentKeyboardHeight = height;
    clearKeyboardShowFallback();
    keyboardShowFallbackTimeout = setTimeout(() => {
      keyboardShowFallbackTimeout = null;
      dlog(`  keyboardShowFallback(${KEYBOARD_SHOW_FALLBACK_MS}ms) fired - no visualViewport resize arrived in time, applying manual offset(${currentKeyboardHeight}) as fallback`);
      applyKeyboardHeight(currentKeyboardHeight);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        scrollFocusedIntoViewWhenSettled();
        snapshot('  after scrollFocusedIntoViewWhenSettled (fallback rAF x2)');
      }));
    }, KEYBOARD_SHOW_FALLBACK_MS);
  });
  Keyboard.addListener('keyboardDidShow', (info) => {
    dlog(`EVENT keyboardDidShow fired, info=${JSON.stringify(info)}`);
    onTabBarExperimentKeyboardDidShow(); // TAB-BAR-HIDE EXPERIMENT hook
    if (!isIOS) {
      applyKeyboardHeight((info && info.keyboardHeight) || 0);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        scrollFocusedIntoView();
        snapshot('  after scrollFocusedIntoView rAF x2');
      }));
      return;
    }
    currentKeyboardHeight = (info && info.keyboardHeight) || currentKeyboardHeight;
    // No scrollFocusedIntoView() here: tabBar/content haven't moved yet (the offset
    // is deferred until the visualViewport resize below), so tabBar.getBoundingClientRect()
    // would still read its full, pre-keyboard resting position. Checking against that
    // stale geometry can't detect fields that actually need to scroll clear once the
    // keyboard settles, and for a field positioned lower in a tab it could even trigger
    // an incorrect premature scroll that the post-resize call then has to correct on
    // top of - trading the padding-bottom flicker we just fixed for a scroll-position
    // one. The visualViewport resize listener below is the only call site that runs
    // scrollFocusedIntoView() against confirmed-correct geometry, so it's the only one
    // that should.
    snapshot('  after keyboardDidShow (iOS - offset deferred, native resize pending)');
  });
  Keyboard.addListener('keyboardWillHide', () => {
    dlog(`EVENT keyboardWillHide fired`);
    onTabBarExperimentKeyboardHide(); // TAB-BAR-HIDE EXPERIMENT hook
    clearKeyboardShowFallback();
    applyKeyboardHeight(0);
  });
  Keyboard.addListener('keyboardDidHide', () => {
    dlog(`EVENT keyboardDidHide fired`);
    onTabBarExperimentKeyboardHide(); // TAB-BAR-HIDE EXPERIMENT hook
    if (isIOS) trackFullViewportHeight();
    snapshot('  after keyboardDidHide');
  });

  // On iOS this used to be diagnostic-only, on the assumption resize:"none" keeps the
  // WebView fixed and only our own applyKeyboardHeight() calls (from Keyboard events)
  // ever need to move the tab bar. A debug log proved that assumption wrong: WKWebView
  // can resize itself AFTER a keyboardDidShow has already fired and we've already
  // applied a JS offset (e.g. the Greek IPv6 keyboard case - keyboardDidShow(335)
  // applies fine at innerHeight=874, then ~180ms later the view actually shrinks to
  // 539, but nothing re-ran applyKeyboardHeight() to account for that, so the stale
  // "335px" offset was now being measured against the new 539-tall view instead of the
  // original 874-tall one, landing the tab bar way up near the header). So on iOS, a
  // live resize while the keyboard is showing now re-runs applyKeyboardHeight() with
  // the current keyboard height (harmless no-op if nothing actually needs to change -
  // applyKeyboardHeight()'s own alreadyResizedBy/neededOffset math handles that), and
  // re-clears the focused input afterward in case the tab bar's position moved.
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      dlog(`EVENT visualViewport resize -> height=${window.visualViewport.height} offsetTop=${window.visualViewport.offsetTop} (window.innerHeight=${window.innerHeight})`);
      if (isIOS && currentKeyboardHeight > 0) {
        clearKeyboardShowFallback();
        dlog(`  re-applying applyKeyboardHeight(${currentKeyboardHeight}) after live resize`);
        applyKeyboardHeight(currentKeyboardHeight);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          scrollFocusedIntoViewWhenSettled();
          snapshot('  after scrollFocusedIntoViewWhenSettled (post-resize rAF x2)');
        }));
      }
    });
  }
}


function init() {
  const sessionCount = parseInt(SafeStorage.getItem('isubnet_review_session_count') || '0', 10);
  SafeStorage.setItem('isubnet_review_session_count', (sessionCount + 1).toString());

  const chkDebugLog = document.getElementById('chk-debug-log');
  const btnDebugInfo = document.getElementById('btn-debug-info');
  const btnDebugClear = document.getElementById('btn-debug-clear');
  
  // --- Hidden Debug Logging reveal gesture ---
  let debugRevealTapCount = 0;
  let debugRevealTapTimer = null;
  const versionFooter = document.getElementById('settings-version-footer');
  const debugRow = document.getElementById('debug-logging-row');
  const debugControls = document.getElementById('debug-logging-controls') || debugRow;
  if (debugRow) debugRow.classList.remove('hidden');
  const ensureDebugControlsIfLoggingOn = () => {
    if (window.APP_DEBUG_ENABLED) {
      if (chkDebugLog) chkDebugLog.checked = true;
      if (debugControls) debugControls.classList.remove('hidden');
    }
  };
  const btnSettingsOpen = document.getElementById('btn-settings');
  if (btnSettingsOpen) btnSettingsOpen.addEventListener('click', ensureDebugControlsIfLoggingOn);

  // Show the real app version/build (iOS: marketing version + build number; Android: versionName + versionCode).
  if (versionFooter) {
    try {
      const capApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
      if (capApp && typeof capApp.getInfo === 'function') {
        capApp.getInfo().then((info) => {
          if (info && info.version) {
            versionFooter.textContent = `iSubnet v${info.version}` + (info.build ? ` (Build ${info.build})` : '');
          }
        }).catch(() => {});
      }
    } catch (e) { /* keep the default text */ }
  }

  if (versionFooter && debugRow) {
    versionFooter.addEventListener('click', () => {
      debugRevealTapCount++;
      if (debugRevealTapTimer) clearTimeout(debugRevealTapTimer);
      debugRevealTapTimer = setTimeout(() => { debugRevealTapCount = 0; }, 3000);
      if (debugRevealTapCount >= 7) {
        debugRevealTapCount = 0;
        clearTimeout(debugRevealTapTimer);
        if (window.APP_DEBUG_ENABLED) {
          debugControls.classList.remove('hidden');
        } else {
          debugControls.classList.toggle('hidden');
        }
        if (typeof window.debugLog === 'function') {
          window.debugLog(debugControls.classList.contains('hidden') ? 'Debug Logging row hidden via gesture' : 'Debug Logging row revealed via gesture');
        }
      }
    });
  }

  if (chkDebugLog) {
    chkDebugLog.checked = window.APP_DEBUG_ENABLED;
    if (window.APP_DEBUG_ENABLED && debugRow) {
      debugControls.classList.remove('hidden');
    }
    chkDebugLog.addEventListener('change', (e) => {
      window.APP_DEBUG_ENABLED = e.target.checked;
      SafeStorage.setItem('isubnet_debug', window.APP_DEBUG_ENABLED ? 'true' : 'false');

      if (window.APP_DEBUG_ENABLED) {
        _lastLoggedRcProState = null;
        _lastLoggedRcOfferingsSig = null;
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
        if (debugControls && !window.APP_DEBUG_ENABLED) debugControls.classList.add('hidden');
      }
      refreshDebugUserIdDisplay();
    });
  }
  
  if (btnDebugInfo) {
    btnDebugInfo.addEventListener('click', () => {
      const liveFooterEl = document.getElementById('settings-version-footer');
      const liveFooterText = liveFooterEl && typeof liveFooterEl.textContent === 'string'
        ? liveFooterEl.textContent.replace(/\s+/g, ' ').trim()
        : '';
      const step2Target = liveFooterText
        ? `the version line ("${liveFooterText}")`
        : 'the version line at the bottom of this screen';
      const infoMsg =
        "Turn this on if you're having a problem and want to help us fix it. While it's on, the app records technical details about what you do and any errors, and saves them as a note in your Notes tab. You can copy that note and send it to support. Turn it off when you're done.\n\n" +
        "To turn it on:\n" +
        "1. Scroll to the bottom of this Settings screen.\n" +
        `2. Tap ${step2Target} 7 times in a row.\n` +
        "3. The Debug Logging switch appears. Switch it on.\n\n" +
        "After you switch logging off, the switch is hidden again.";
      showErrorDialog(infoMsg, { variant: 'info' });
    });
  }
  
  if (btnDebugClear) {
    btnDebugClear.addEventListener('click', () => {
      window.APP_DEBUG_CURRENT_NOTE_ID = null;
      SafeStorage.removeItem('isubnet_debug_note_id');
      if (window.APP_DEBUG_ENABLED) window.debugLog("=== DEBUG BUFFER CLEARED (Starting new note) ===");
      showToast("In-memory debug buffer cleared. Next log will create a new note.");
    });
  }

  initSettings();
  setTimeout(initRevenueCat, 800);
  setTimeout(refreshDebugUserIdDisplay, 1200);
  setupTabNavigation();
  initQuickPaste();
  setupEventListeners();
  setupKeyboardAvoidance();
  setupInputSanitizers();
  calculateIPv4();
  calculateIPv6();
  loadNotes();
  loadHistory();
  initSplitterListeners();
  initBulkCalculator();
  setupExporterListeners();
  
  // Setup clear history binding
  const clearHistBtn = document.getElementById('btn-clear-history');
  if (clearHistBtn) {
    clearHistBtn.addEventListener('click', clearHistory);
  }

  // Setup converter listener and init
  const convInput = document.getElementById('converter-input');
  if (convInput) {
    const randomCidr = Math.floor(Math.random() * (30 - 8 + 1)) + 8; // Random CIDR from 8 to 30
    const maskVal = (~0 << (32 - randomCidr)) >>> 0;
    const wildcardVal = ~maskVal >>> 0;
    convInput.value = uint32ToIp(wildcardVal);
    convInput.addEventListener('input', () => {
      // Some locales' numeric keypad emits a decimal comma instead of a dot;
      // normalize so "192,168,1,1" / "0,0,3,255" style entry still parses.
      const start = convInput.selectionStart;
      const end = convInput.selectionEnd;
      if (convInput.value.indexOf(',') !== -1) {
        convInput.value = convInput.value.replace(/,/g, '.');
        if (start !== null && end !== null) {
          convInput.setSelectionRange(start, end);
        }
      }
      stripDisallowedChars(convInput, /[0-9./]/);
      collapseDuplicateDots(convInput);
      runConverter();
    });
    runConverter(); // run initial converter on default load
  }

  // Setup number base converter
  setupBaseConverter();

  // --- Pro modal bindings ---
  const buyLifetimeBtn = document.getElementById('btn-pro-buy-lifetime');
  if (buyLifetimeBtn) buyLifetimeBtn.addEventListener('click', () => purchaseProductByPlan('lifetime'));

  const buyYearlyBtn = document.getElementById('btn-pro-buy-yearly');
  if (buyYearlyBtn) buyYearlyBtn.addEventListener('click', () => purchaseProductByPlan('yearly'));

  const buyMonthlyBtn = document.getElementById('btn-pro-buy-monthly');
  if (buyMonthlyBtn) buyMonthlyBtn.addEventListener('click', () => purchaseProductByPlan('monthly'));

  const dismissBtn = document.getElementById('btn-pro-dismiss');
  if (dismissBtn) dismissBtn.addEventListener('click', closeProModal);

  async function restorePurchasesFlow(btnElement) {
    if (!btnElement) return;
    const originalText = btnElement.textContent;
    btnElement.textContent = 'Restoring...';
    btnElement.disabled = true;
    try {
      if (!window.Capacitor || !window.Capacitor.getPlatform || (window.Capacitor.getPlatform() !== 'ios' && window.Capacitor.getPlatform() !== 'android')) {
        showErrorDialog('Restore is only available in the native app.');
        return;
      }
      const { Purchases } = window.Capacitor.Plugins;
      if (!Purchases) {
        showErrorDialog('Purchases plugin not loaded.');
        return;
      }
      
      const identity = await ensureRevenueCatIdentity('restore');
      if (identity === 'failed') {
        showErrorDialog('Could not connect to your account. Please check your internet connection and try again.');
        return;
      }
      const result = await Purchases.restorePurchases();
      const customerInfo = result.customerInfo || result;
      const activeEntitlements = customerInfo?.entitlements?.active || {};
      const rEntCount = Object.keys(activeEntitlements).length;
      const rPro = rEntCount > 0;
      if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
        if (_lastLoggedRcProState !== rPro) {
          _lastLoggedRcProState = rPro;
          window.debugLog(`RevenueCat: restorePurchases ok | pro=${rPro} | activeEntitlements=${rEntCount}`);
        }
      }
      if (rPro) {
        if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') window.debugLog('Purchases restored successfully.');
        await handlePurchaseSuccess('Your purchases have been successfully restored!');
      } else {
        showToast('No active purchases found to restore.');
      }
    } catch (err) {
      if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
        window.debugLog(`Restore failed: ${sanitizeErrorForLog(err && err.message ? err.message : err)}`);
      }
      showErrorDialog('Failed to restore purchases. Please try again.');
    } finally {
      btnElement.textContent = originalText;
      btnElement.disabled = false;
    }
  }

  const restoreBtn = document.getElementById('btn-pro-restore');
  if (restoreBtn) restoreBtn.addEventListener('click', () => restorePurchasesFlow(restoreBtn));

  const settingsRestoreBtn = document.getElementById('btn-settings-restore');
  if (settingsRestoreBtn) settingsRestoreBtn.addEventListener('click', () => restorePurchasesFlow(settingsRestoreBtn));

  // Legal links bindings (Paywall)
  const linkTerms = document.getElementById('link-terms');
  if (linkTerms) {
    linkTerms.addEventListener('click', async (e) => {
      e.preventDefault();
      const url = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
        await window.Capacitor.Plugins.Browser.open({ url: url });
      } else {
        window.open(url, '_blank');
      }
    });
  }

  const linkPrivacy = document.getElementById('link-privacy');
  if (linkPrivacy) {
    linkPrivacy.addEventListener('click', async (e) => {
      e.preventDefault();
      const url = 'https://isubnet.net/privacy-policy/';
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
        await window.Capacitor.Plugins.Browser.open({ url: url });
      } else {
        window.open(url, '_blank');
      }
    });
  }

  // Legal links bindings (Settings)
  const btnSettingsTerms = document.getElementById('btn-settings-terms');
  if (btnSettingsTerms) {
    btnSettingsTerms.addEventListener('click', async (e) => {
      e.preventDefault();
      const url = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
        await window.Capacitor.Plugins.Browser.open({ url: url });
      } else {
        window.open(url, '_blank');
      }
    });
  }

  const btnSettingsPrivacy = document.getElementById('btn-settings-privacy');
  if (btnSettingsPrivacy) {
    btnSettingsPrivacy.addEventListener('click', async (e) => {
      e.preventDefault();
      const url = 'https://isubnet.net/privacy-policy/';
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
        await window.Capacitor.Plugins.Browser.open({ url: url });
      } else {
        window.open(url, '_blank');
      }
    });
  }

  // --- Locked Splitter tab click ---
  const splitterBtn = document.getElementById('tab-btn-splitter');
  if (splitterBtn) {
    splitterBtn.addEventListener('click', () => {
      if (splitterBtn.getAttribute('data-pro') === 'true') showProModal('splitter');
    });
  }
  const toolsBtn = document.getElementById('tab-btn-tools');
  if (toolsBtn) {
    toolsBtn.addEventListener('click', () => {
      if (typeof window.debugLog === 'function') window.debugLog(`Tools tab tapped: opening picker (pro=${PRO_UNLOCKED})`);
      openToolsPicker();
    });
  }
  const toolsSwitchChip = document.getElementById('btn-tools-switch');
  if (toolsSwitchChip) toolsSwitchChip.addEventListener('click', openToolsPicker);
  const pingSwitchChip = document.getElementById('btn-ping-switch');
  if (pingSwitchChip) pingSwitchChip.addEventListener('click', openToolsPicker);
  const traceSwitchChip = document.getElementById('btn-trace-switch');
  if (traceSwitchChip) traceSwitchChip.addEventListener('click', openToolsPicker);
  const whoisSwitchChip = document.getElementById('btn-whois-switch');
  if (whoisSwitchChip) whoisSwitchChip.addEventListener('click', openToolsPicker);
  const toolsPickerModal = document.getElementById('tools-picker-modal');
  const toolsPickerClose = document.getElementById('btn-tools-picker-close');
  if (toolsPickerClose) toolsPickerClose.addEventListener('click', closeToolsPicker);
  if (toolsPickerModal) toolsPickerModal.addEventListener('click', (e) => { if (e.target === toolsPickerModal) closeToolsPicker(); });

  // Apply pro state on load (restores PRO badge + unlocked tabs if already purchased)
  applyProState();
}

// --- Tools Picker ---
const TOOLS_LIST = [
  { id: 'dns', icon: '🌐', title: 'DNS Lookup', desc: 'A, MX, NS, TXT, reverse DNS and more', freeDesc: 'A records free · more types with Pro', screen: 'tools-tab', feature: 'dns', pro: false },
  { id: 'ping', icon: '📶', title: 'Ping', desc: 'Test reachability and round-trip time', screen: 'ping-tab', pro: false },
  { id: 'traceroute', icon: '🧭', title: 'Traceroute', desc: 'See the path your packets take, hop by hop', screen: 'traceroute-tab', feature: 'traceroute', pro: false },
  { id: 'whois', icon: '🔎', title: 'Whois', desc: 'Who owns a domain, IP address or network', screen: 'whois-tab', feature: 'whois', pro: false }
];

function openToolsPicker() {
  const modal = document.getElementById('tools-picker-modal');
  const list = document.getElementById('tools-picker-list');
  if (!modal || !list) return;
  list.textContent = '';
  TOOLS_LIST.forEach(tool => {
    const row = document.createElement('button');
    row.className = 'tools-picker-row';
    row.setAttribute('data-tool', tool.id);
    const icon = document.createElement('div');
    icon.className = 'tools-picker-icon';
    if (tool.id === 'ping') {
      icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 28" width="32" height="26" aria-hidden="true" focusable="false"><rect x="0.5" y="0.5" width="33" height="27" rx="5" fill="#0f172a" stroke="#334155"/><g transform="translate(3.5,1.5) scale(.9)"><circle cx="3" cy="21" r="1.7" fill="#64748b"/><rect x="6.85" y="3" width="2.8" height="13" rx="1.4" fill="#34d399"/><circle cx="8.25" cy="21" r="1.7" fill="#34d399"/><rect x="12.1" y="3" width="2.8" height="13" rx="1.4" fill="#34d399"/><circle cx="13.5" cy="21" r="1.7" fill="#34d399"/><rect x="17.35" y="3" width="2.8" height="13" rx="1.4" fill="#34d399"/><circle cx="18.75" cy="21" r="1.7" fill="#34d399"/><rect x="22.6" y="3" width="2.8" height="13" rx="1.4" fill="#34d399"/><circle cx="24" cy="21" r="1.7" fill="#34d399"/></g></svg>';
    } else {
      icon.textContent = tool.icon;
    }
    const text = document.createElement('div');
    text.className = 'tools-picker-text';
    const title = document.createElement('div');
    title.className = 'tools-picker-title';
    title.textContent = tool.title;
    const desc = document.createElement('div');
    desc.className = 'tools-picker-desc';
    desc.textContent = (!PRO_UNLOCKED && tool.freeDesc) ? tool.freeDesc : tool.desc;
    text.appendChild(title);
    text.appendChild(desc);
    const right = document.createElement('span');
    const isLocked = tool.pro && !PRO_UNLOCKED;
    if (isLocked) {
      right.className = 'pro-badge';
      right.textContent = '🔒 Pro';
    } else {
      right.className = 'tools-picker-chevron';
      right.textContent = '›';
    }
    row.appendChild(icon);
    row.appendChild(text);
    row.appendChild(right);
    row.addEventListener('click', () => openTool(tool));
    list.appendChild(row);
  });
  modal.classList.remove('hidden');
}

function closeToolsPicker() {
  const modal = document.getElementById('tools-picker-modal');
  if (modal) modal.classList.add('hidden');
}

function openTool(tool) {
  closeToolsPicker();
  const isLocked = tool.pro && !PRO_UNLOCKED;
  if (typeof window.debugLog === 'function') window.debugLog(`Tools picker: selected ${tool.id} (locked=${isLocked})`);
  if (isLocked) {
    showProModal(tool.feature || 'dns');
    return;
  }
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const toolsBtn = document.getElementById('tab-btn-tools');
  if (toolsBtn) toolsBtn.classList.add('active');
  const screen = document.getElementById(tool.screen);
  if (screen) screen.classList.add('active');
}

// --- Limit Banner Helpers ---
function showNotesLimitBanner() {
  const list = document.getElementById('notes-list');
  if (!list) return;
  
  // Remove existing banner if present to refresh the counts
  const old = list.querySelector('.pro-limit-banner');
  if (old) old.remove();

  const hiddenCount = notes.length - FREE_NOTES_LIMIT;
  if (hiddenCount <= 0) return;

  const isUserLoggedIn = currentUserId !== 'local';
  const actionText = isUserLoggedIn 
    ? 'Upgrade to Pro to view them.' 
    : 'Upgrade to Pro or Sign In to view and sync them.';

  const banner = document.createElement('div');
  banner.className = 'pro-limit-banner';
  banner.innerHTML = `
    <p>You have <strong>${hiddenCount} more note${hiddenCount > 1 ? 's' : ''}</strong> hidden. ${actionText}</p>
    <button class="btn-upgrade-inline" onclick="showProModal()">Upgrade</button>
  `;
  list.appendChild(banner); // Append at the bottom of the visible list
}

function showHistoryLimitBanner() {
  const list = document.getElementById('history-list');
  if (!list) return;
  
  const old = list.querySelector('.pro-limit-banner');
  if (old) old.remove();

  const hiddenCount = historyItems.length - FREE_HISTORY_LIMIT;
  if (hiddenCount <= 0) return;

  const banner = document.createElement('div');
  banner.className = 'pro-limit-banner';
  banner.innerHTML = `
    <p>You have <strong>${hiddenCount} more calculation${hiddenCount > 1 ? 's' : ''}</strong> hidden. Upgrade to Pro to view full history.</p>
    <button class="btn-upgrade-inline" onclick="showProModal()">Upgrade</button>
  `;
  list.appendChild(banner);
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Global outside-tap keyboard dismiss (iOS & Android)
(function setupTapOutsideKeyboardDismiss() {
  const MOVE_THRESHOLD_PX = 10;
  const LONG_PRESS_MS = 500;
  let lastProgrammaticFocusTime = 0;
  let lastTouchEventTime = 0;
  let suppressLabelRefocusUntil = 0;

  function isTapOutsideTextEntry(el) {
    if (!el || !el.tagName) return false;
    if (el.disabled || el.readOnly) return false;
    const tag = el.tagName.toUpperCase();
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      return !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(type);
    }
    return Boolean(el.isContentEditable);
  }

  try {
    const origFocus = HTMLElement.prototype.focus;
    if (typeof origFocus === 'function' && !origFocus._isubnetWrapped) {
      const wrappedFocus = function (...args) {
        if (isTapOutsideTextEntry(this)) {
          lastProgrammaticFocusTime = performance.now();
        }
        return origFocus.apply(this, args);
      };
      wrappedFocus._isubnetWrapped = true;
      HTMLElement.prototype.focus = wrappedFocus;
    }
  } catch (err) { /* ignore */ }

  function dismissFocusedField(fieldEl) {
    if (!fieldEl) return;
    if (document.activeElement === fieldEl && typeof fieldEl.blur === 'function') {
      fieldEl.blur();
    }
    try {
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Keyboard) {
        window.Capacitor.Plugins.Keyboard.hide().catch(() => {});
      }
    } catch (err) { /* ignore */ }
  }

  document.addEventListener('mousedown', (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('[data-keep-keyboard="true"], .btn-clear-field')) {
      e.preventDefault();
      return;
    }
    if (isTapOutsideTextEntry(document.activeElement) && t.closest('button, a, [role="button"]')) {
      e.preventDefault();
    }
  });

  document.addEventListener('click', (e) => {
    if (Date.now() < suppressLabelRefocusUntil) {
      const t = e.target;
      if (t && t.closest && t.closest('label') && !t.closest('.switch-container')) {
        e.preventDefault();
        if (isTapOutsideTextEntry(document.activeElement)) {
          dismissFocusedField(document.activeElement);
        }
      }
    }
  }, true);

  let gesture = null;

  function startGesture(x, y, isMulti, source) {
    gesture = {
      startX: x,
      startY: y,
      startTime: Date.now(),
      perfStartTime: performance.now(),
      maxDist: 0,
      multiTouch: Boolean(isMulti),
      activeAtStart: document.activeElement,
      source
    };
  }

  function moveGesture(x, y, isMulti) {
    if (!gesture) return;
    if (isMulti) gesture.multiTouch = true;
    const dist = Math.hypot(x - gesture.startX, y - gesture.startY);
    if (dist > gesture.maxDist) gesture.maxDist = dist;
  }

  function endGesture(endX, endY, target, endTimeOverride) {
    const g = gesture;
    gesture = null;
    const now = typeof endTimeOverride === 'number' ? endTimeOverride : Date.now();
    const startX = g ? g.startX : endX;
    const startY = g ? g.startY : endY;
    const startTime = g ? g.startTime : now;
    const perfStartTime = g ? g.perfStartTime : performance.now();
    const endDist = (typeof endX === 'number' && typeof startX === 'number')
      ? Math.hypot(endX - startX, endY - startY)
      : 0;
    const maxDist = Math.max(g ? g.maxDist : 0, endDist);
    const multiTouch = Boolean(g && g.multiTouch);
    const duration = Math.max(0, now - startTime);

    const currentActive = document.activeElement;
    const active = isTapOutsideTextEntry(currentActive)
      ? currentActive
      : (g && isTapOutsideTextEntry(g.activeAtStart) ? g.activeAtStart : null);

    if (!active) {
      return;
    }

    if (multiTouch || maxDist > MOVE_THRESHOLD_PX) {
      if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
        window.debugLog('[KBD] tap-outside: ignored | reason=moved');
      }
      return;
    }

    if (duration >= LONG_PRESS_MS) {
      if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
        window.debugLog('[KBD] tap-outside: ignored | reason=long-press');
      }
      return;
    }

    if (target && target.closest && target.closest('[data-keep-keyboard="true"], .btn-clear-field')) {
      if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
        window.debugLog('[KBD] tap-outside: ignored | reason=keep-keyboard');
      }
      return;
    }

    if (target === active || (active.contains && active.contains(target))) {
      if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
        window.debugLog('[KBD] tap-outside: ignored | reason=focused-field');
      }
      return;
    }

    const otherField = (target && target.closest) ? target.closest('input, textarea, [contenteditable="true"]') : null;
    if (otherField && isTapOutsideTextEntry(otherField) && otherField !== active) {
      if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
        window.debugLog('[KBD] tap-outside: ignored | reason=other-field');
      }
      return;
    }

    if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
      const tag = (target && target.tagName) ? String(target.tagName).toUpperCase() : 'UNKNOWN';
      window.debugLog(`[KBD] tap-outside: dismissed | target=${tag}`);
    }

    const isLabelTap = Boolean(target && target.closest && target.closest('label') && !target.closest('.switch-container, [role="button"]'));
    if (isLabelTap) {
      suppressLabelRefocusUntil = Date.now() + 300;
      dismissFocusedField(active);
      return;
    }

    const isInteractiveControl = Boolean(
      target && target.closest && target.closest('button, a, select, [role="button"], .switch-container, input[type="checkbox"], input[type="radio"], input[type="range"]')
    );

    if (isInteractiveControl) {
      let finished = false;
      const runDeferredDismiss = () => {
        if (finished) return;
        finished = true;
        window.removeEventListener('click', onControlClick, false);
        if (lastProgrammaticFocusTime >= perfStartTime && isTapOutsideTextEntry(document.activeElement)) {
          return;
        }
        if (document.activeElement && document.activeElement !== active && isTapOutsideTextEntry(document.activeElement)) {
          return;
        }
        dismissFocusedField(active);
      };
      const onControlClick = () => {
        setTimeout(runDeferredDismiss, 0);
      };
      window.addEventListener('click', onControlClick, false);
      setTimeout(runDeferredDismiss, 80);
    } else {
      dismissFocusedField(active);
    }
  }

  document.addEventListener('touchstart', (e) => {
    lastTouchEventTime = Date.now();
    const t = e.touches && e.touches[0];
    const x = t ? t.clientX : 0;
    const y = t ? t.clientY : 0;
    startGesture(x, y, Boolean(e.touches && e.touches.length > 1), 'touch');
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    lastTouchEventTime = Date.now();
    const t = e.touches && e.touches[0];
    const x = t ? t.clientX : 0;
    const y = t ? t.clientY : 0;
    moveGesture(x, y, Boolean(e.touches && e.touches.length > 1));
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    lastTouchEventTime = Date.now();
    const t = e.changedTouches && e.changedTouches[0];
    const x = t ? t.clientX : (gesture ? gesture.startX : 0);
    const y = t ? t.clientY : (gesture ? gesture.startY : 0);
    const endTime = (typeof e._mockTouchDurationMs === 'number' && gesture)
      ? (gesture.startTime + e._mockTouchDurationMs)
      : Date.now();
    endGesture(x, y, e.target, endTime);
  }, { passive: true });

  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || Date.now() - lastTouchEventTime < 500) return;
    startGesture(e.clientX, e.clientY, false, 'pointer');
  }, { passive: true });

  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || Date.now() - lastTouchEventTime < 500) return;
    if (!gesture || gesture.source !== 'pointer') return;
    moveGesture(e.clientX, e.clientY, false);
  }, { passive: true });

  document.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch' || Date.now() - lastTouchEventTime < 500) return;
    if (!gesture || gesture.source !== 'pointer') return;
    endGesture(e.clientX, e.clientY, e.target, Date.now());
  }, { passive: true });
})();

// --- BULK CALCULATOR ENGINE ---
function initBulkCalculator() {
  const modeBtnsV4 = document.querySelectorAll('.calc-mode-btn-v4');
  const singlePanelV4 = document.getElementById('ipv4-single-panel');
  const bulkPanelV4 = document.getElementById('ipv4-bulk-panel');
  const resultsCardV4 = document.getElementById('ipv4-results');
  const bulkResultsCardV4 = document.getElementById('ipv4-bulk-results');

  modeBtnsV4.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      if (mode === 'bulk' && !PRO_UNLOCKED) {
        showProModal();
        return;
      }
      modeBtnsV4.forEach(b => {
        b.classList.remove('active');
        b.style.background = 'none';
        b.style.color = 'var(--text-secondary)';
      });
      btn.classList.add('active');
      btn.style.background = 'var(--bg-card)';
      btn.style.color = 'var(--text-primary)';

      if (mode === 'single') {
        singlePanelV4.classList.remove('hidden');
        bulkPanelV4.classList.add('hidden');
        bulkResultsCardV4.classList.add('hidden');
        calculateIPv4();
      } else {
        singlePanelV4.classList.add('hidden');
        bulkPanelV4.classList.remove('hidden');
        resultsCardV4.classList.add('hidden');
        calculateBulkIPv4();
      }
    });
  });

  const modeBtnsV6 = document.querySelectorAll('.calc-mode-btn-v6');
  const singlePanelV6 = document.getElementById('ipv6-single-panel');
  const bulkPanelV6 = document.getElementById('ipv6-bulk-panel');
  const resultsCardV6 = document.getElementById('ipv6-results');
  const bulkResultsCardV6 = document.getElementById('ipv6-bulk-results');

  modeBtnsV6.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      if (mode === 'bulk' && !PRO_UNLOCKED) {
        showProModal();
        return;
      }
      modeBtnsV6.forEach(b => {
        b.classList.remove('active');
        b.style.background = 'none';
        b.style.color = 'var(--text-secondary)';
      });
      btn.classList.add('active');
      btn.style.background = 'var(--bg-card)';
      btn.style.color = 'var(--text-primary)';

      if (mode === 'single') {
        singlePanelV6.classList.remove('hidden');
        bulkPanelV6.classList.add('hidden');
        bulkResultsCardV6.classList.add('hidden');
        calculateIPv6();
      } else {
        singlePanelV6.classList.add('hidden');
        bulkPanelV6.classList.remove('hidden');
        resultsCardV6.classList.add('hidden');
        calculateBulkIPv6();
      }
    });
  });

  document.getElementById('btn-calc-bulk-ipv4').addEventListener('click', calculateBulkIPv4);
  document.getElementById('btn-calc-bulk-ipv6').addEventListener('click', calculateBulkIPv6);
}
function calculateBulkIPv4() {
  if (window.Capacitor && window.Capacitor.Plugins.FirebaseCrashlytics) {
    window.Capacitor.Plugins.FirebaseCrashlytics.setCustomKey({ key: 'last_calc_action', type: 'string', value: 'calculateBulkIPv4' }).catch(() => {});
  }
  const input = document.getElementById('ipv4-bulk-input').value.trim();
  const errorEl = document.getElementById('ipv4-bulk-error');
  const tbody = document.getElementById('ipv4-bulk-results-tbody');
  const card = document.getElementById('ipv4-bulk-results');

  errorEl.textContent = '';
  tbody.innerHTML = '';

  if (!input) {
    card.classList.add('hidden');
    return;
  }

  const lines = input.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  

  lines.forEach(line => {
    let ip = line;
    let cidr = null;

    if (line.includes('/')) {
      const parts = line.split('/');
      ip = parts[0].trim();
      cidr = parseInt(parts[1], 10);
    } else if (line.includes(' ')) {
      const parts = line.split(/\s+/);
      ip = parts[0].trim();
      const mask = parts[1].trim();
      if (validateIPv4(mask)) {
        const maskVal = ipToUint32(mask);
        cidr = 32 - Math.log2(~maskVal + 1);
      }
    }

    const isV6 = ip.includes(':');
    if (isV6) {
      if (cidr === null) cidr = 64;
      const ipBigInt = parseIPv6(ip);
      if (ipBigInt === null || isNaN(cidr) || cidr < 1 || cidr > 128) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="color:#ef4444; padding:8px 4px;">${escapeHTML(line)}</td><td colspan="3" style="color:#ef4444; padding:8px 4px;">Invalid IPv6/Prefix format</td>`;
        tbody.appendChild(tr);
        return;
      }
      
      const hostMask = (BigInt(1) << BigInt(128 - cidr)) - BigInt(1);
      const netMask = ~hostMask & ((BigInt(1) << BigInt(128)) - BigInt(1));
      const networkPrefixVal = ipBigInt & netMask;
      const broadcastVal = networkPrefixVal | hostMask;
      const totalAddresses = BigInt(2) ** BigInt(128 - cidr);
      // First usable host = network address + 1 (skip network identifier)
      const firstUsable = networkPrefixVal + BigInt(1);
      // Usable = total - 1 (only network/anycast address is reserved; IPv6 has no broadcast)
      const usableV6 = totalAddresses > BigInt(1) ? totalAddresses - BigInt(1) : totalAddresses;

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
      tr.innerHTML = `
        <td style="padding: 8px 4px; font-weight: 500; color: var(--accent-primary);">${formatIPv6Compressed(ipBigInt)}/${cidr}</td>
        <td style="padding: 8px 4px; font-family: monospace; font-size: 11px;">
          Network: ${formatIPv6Compressed(networkPrefixVal)}<br>
          Start: ${formatIPv6Compressed(firstUsable)}<br>
          End: ${formatIPv6Compressed(broadcastVal)}
        </td>
        <td style="padding: 8px 4px; font-weight: bold;">
          <span style="color: var(--accent-primary);">${usableV6.toLocaleString()}</span><br>
          <span style="color: var(--bit-off-color); font-size: 10px;">${totalAddresses.toLocaleString()}</span>
        </td>
      `;
      tbody.appendChild(tr);
    } else {
      if (cidr === null) cidr = 24;
      if (!validateIPv4(ip) || isNaN(cidr) || cidr < 0 || cidr > 32) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="color:#ef4444; padding:8px 4px;">${escapeHTML(line)}</td><td colspan="3" style="color:#ef4444; padding:8px 4px;">Invalid IP/Prefix format</td>`;
        tbody.appendChild(tr);
        return;
      }
      
      const ipVal = ipToUint32(ip);
      const maskVal = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
      const wildcardVal = ~maskVal >>> 0;
      const networkVal = (ipVal & maskVal) >>> 0;
      const broadcastVal = (ipVal | wildcardVal) >>> 0;

      let rangeStart = '', rangeEnd = '', usableHosts = 0;
      if (cidr === 32) {
        usableHosts = 1; rangeStart = uint32ToIp(networkVal); rangeEnd = uint32ToIp(networkVal);
      } else if (cidr === 31) {
        usableHosts = 2; rangeStart = uint32ToIp(networkVal); rangeEnd = uint32ToIp(broadcastVal);
      } else {
        usableHosts = (2 ** (32 - cidr)) - 2;
        rangeStart = uint32ToIp(networkVal + 1);
        rangeEnd = uint32ToIp(broadcastVal - 1);
      }

      const totalAddr = 2 ** (32 - cidr);

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
      tr.innerHTML = `
        <td style="padding: 8px 4px; font-weight: 500; color: var(--accent-primary);">${escapeHTML(ip)}/${cidr}</td>
        <td style="padding: 8px 4px; font-family: monospace; font-size: 11px;">
          Network: ${uint32ToIp(networkVal)}<br>
          Range: ${rangeStart} - ${rangeEnd}
        </td>
        <td style="padding: 8px 4px; font-weight: bold;">
          <span style="color: var(--accent-primary);">${usableHosts.toLocaleString()}</span><br>
          <span style="color: var(--bit-off-color); font-size: 10px;">${totalAddr.toLocaleString()}</span>
        </td>
      `;
      tbody.appendChild(tr);
    }
  });

  if (lines.length > 0) {
    card.classList.remove('hidden');
  }
}
function calculateBulkIPv6() {
  if (window.Capacitor && window.Capacitor.Plugins.FirebaseCrashlytics) {
    window.Capacitor.Plugins.FirebaseCrashlytics.setCustomKey({ key: 'last_calc_action', type: 'string', value: 'calculateBulkIPv6' }).catch(() => {});
  }
  const input = document.getElementById('ipv6-bulk-input').value.trim();
  const errorEl = document.getElementById('ipv6-bulk-error');
  const tbody = document.getElementById('ipv6-bulk-results-tbody');
  const card = document.getElementById('ipv6-bulk-results');

  errorEl.textContent = '';
  tbody.innerHTML = '';

  if (!input) {
    card.classList.add('hidden');
    return;
  }

  const lines = input.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  

  lines.forEach(line => {
    let ip = line;
    let cidr = null;

    if (line.includes('/')) {
      const parts = line.split('/');
      ip = parts[0].trim();
      cidr = parseInt(parts[1], 10);
    }

    const isV6 = ip.includes(':');
    if (isV6) {
      if (cidr === null) cidr = 64;
      const ipBigInt = parseIPv6(ip);
      if (ipBigInt === null || isNaN(cidr) || cidr < 1 || cidr > 128) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="color:#ef4444; padding:8px 4px;">${escapeHTML(line)}</td><td colspan="2" style="color:#ef4444; padding:8px 4px;">Invalid IPv6/Prefix format</td>`;
        tbody.appendChild(tr);
        return;
      }

      
      const hostMask = (BigInt(1) << BigInt(128 - cidr)) - BigInt(1);
      const netMask = ~hostMask & ((BigInt(1) << BigInt(128)) - BigInt(1));
      const networkPrefixVal = ipBigInt & netMask;
      const broadcastVal = networkPrefixVal | hostMask;
      const totalAddresses = BigInt(2) ** BigInt(128 - cidr);
      // First usable host = network address + 1 (skip network identifier)
      const firstUsable = networkPrefixVal + BigInt(1);

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
      tr.innerHTML = `
        <td style="padding: 8px 4px; font-weight: 500; color: var(--accent-primary);">${formatIPv6Compressed(ipBigInt)}/${cidr}</td>
        <td style="padding: 8px 4px; font-family: monospace; font-size: 11px;">
          Network: ${formatIPv6Compressed(networkPrefixVal)}<br>
          Start: ${formatIPv6Compressed(firstUsable)}<br>
          End: ${formatIPv6Compressed(broadcastVal)}
        </td>
        <td style="padding: 8px 4px; font-weight: bold;">
          <span style="color: var(--accent-primary);">${(totalAddresses > BigInt(1) ? totalAddresses - BigInt(1) : totalAddresses).toLocaleString()}</span><br>
          <span style="color: var(--bit-off-color); font-size: 10px;">${totalAddresses.toLocaleString()}</span>
        </td>
      `;
      tbody.appendChild(tr);
    } else {
      if (cidr === null) cidr = 24;
      if (!validateIPv4(ip) || isNaN(cidr) || cidr < 0 || cidr > 32) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="color:#ef4444; padding:8px 4px;">${escapeHTML(line)}</td><td colspan="2" style="color:#ef4444; padding:8px 4px;">Invalid IP/Prefix format</td>`;
        tbody.appendChild(tr);
        return;
      }

      
      const ipVal = ipToUint32(ip);
      const maskVal = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
      const wildcardVal = ~maskVal >>> 0;
      const networkVal = (ipVal & maskVal) >>> 0;
      const broadcastVal = (ipVal | wildcardVal) >>> 0;

      let rangeStart = '', rangeEnd = '', usableHosts = 0;
      if (cidr === 32) {
        usableHosts = 1; rangeStart = uint32ToIp(networkVal); rangeEnd = uint32ToIp(networkVal);
      } else if (cidr === 31) {
        usableHosts = 2; rangeStart = uint32ToIp(networkVal); rangeEnd = uint32ToIp(broadcastVal);
      } else {
        usableHosts = (2 ** (32 - cidr)) - 2;
        rangeStart = uint32ToIp(networkVal + 1);
        rangeEnd = uint32ToIp(broadcastVal - 1);
      }

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
      tr.innerHTML = `
        <td style="padding: 8px 4px; font-weight: 500; color: var(--accent-primary);">${escapeHTML(ip)}/${cidr}</td>
        <td style="padding: 8px 4px; font-family: monospace; font-size: 11px;">
          Network: ${uint32ToIp(networkVal)}<br>
          Start: ${rangeStart}<br>
          End: ${rangeEnd}
        </td>
        <td style="padding: 8px 4px; font-weight: bold;">
          <span style="color: var(--accent-primary);">${usableHosts.toLocaleString()}</span><br>
          <span style="color: var(--bit-off-color); font-size: 10px;">${(2 ** (32 - cidr)).toLocaleString()}</span>
        </td>
      `;
      tbody.appendChild(tr);
    }
  });

  if (lines.length > 0) {
    card.classList.remove('hidden');
  }
}

// --- CSV/PDF REPORT EXPORTER ---
function setupExporterListeners() {
  const getCSVData = (type) => {
    let csv = '';
    if (type === 'ipv4') {
      const ip = document.getElementById('ipv4-address').value.trim();
      const cidr = document.getElementById('res-cidr').textContent;
      const mask = document.getElementById('res-mask').textContent;
      const wildcard = document.getElementById('res-wildcard').textContent;
      const network = document.getElementById('res-network').textContent;
      const broadcast = document.getElementById('res-broadcast').textContent;
      const range = document.getElementById('res-range').textContent;
      const hosts = document.getElementById('res-hosts').textContent;
      const ipClass = document.getElementById('ipv4-badge-class').textContent;
      const ipType = document.getElementById('res-type').textContent;

      csv = `Parameter,Value\n`;
      csv += `IP Address,${ip}\n`;
      csv += `CIDR Prefix,${cidr}\n`;
      csv += `Subnet Mask,${mask}\n`;
      csv += `Wildcard Mask,${wildcard}\n`;
      csv += `Network Address,${network}\n`;
      csv += `Broadcast Address,${broadcast}\n`;
      csv += `Usable IP Range,${range}\n`;
      csv += `Total Usable Hosts,${hosts}\n`;
      csv += `Network Class,${ipClass}\n`;
      csv += `IP Address Type,${ipType}\n`;
    } else if (type === 'ipv6') {
      const ip = document.getElementById('ipv6-address').value.trim();
      const compressed = document.getElementById('res6-compressed').innerText;
      const expanded = document.getElementById('res6-expanded').innerText;
      const prefix = document.getElementById('res6-prefix').textContent;
      const netPrefix = document.getElementById('res6-net-prefix').innerText;
      const start = document.getElementById('res6-start').innerText;
      const end = document.getElementById('res6-end').innerText;
      const total = document.getElementById('res6-total').textContent;
      const typeText = document.getElementById('ipv6-badge-type').textContent;

      csv = `Parameter,Value\n`;
      csv += `IP Address,${ip}\n`;
      csv += `Compressed Address,${compressed}\n`;
      csv += `Expanded Address,${expanded}\n`;
      csv += `Prefix,${prefix}\n`;
      csv += `Network Prefix,${netPrefix}\n`;
      csv += `Range Start,${start}\n`;
      csv += `Range End,${end}\n`;
      csv += `Total Addresses,${total}\n`;
      csv += `Address Type,${typeText}\n`;
    } else if (type === 'split') {
      csv = `Subnet Name,Network Address,Prefix / Mask,Usable Range,Hosts\n`;
      const rows = document.querySelectorAll('#split-results-tbody tr');
      rows.forEach(row => {
        const tds = row.querySelectorAll('td');
        if (tds.length >= 5) {
          csv += `"${tds[0].textContent}","${tds[1].textContent}","${tds[2].textContent.replace('\n', ' ')}","${tds[3].textContent.replace('\n', ' ')}","${tds[4].textContent}"\n`;
        }
      });
    } else if (type === 'conv') {
      const convType = document.getElementById('conv-type').textContent;
      const prefix = document.getElementById('conv-prefix').textContent;
      const mask = document.getElementById('conv-mask').textContent;
      const wildcard = document.getElementById('conv-wildcard').textContent;
      csv = `Parameter,Value\n`;
      csv += `Type,${convType}\n`;
      csv += `Prefix,${prefix}\n`;
      csv += `Subnet Mask,${mask}\n`;
      csv += `Wildcard Mask,${wildcard}\n`;
    } else if (type === 'conv-subnet') {
      csv = `Parameter,Value\n`;
      const items = document.querySelectorAll('#converter-subnet-results .result-item');
      items.forEach(item => {
        const label = item.querySelector('.label').textContent.trim();
        const val = item.querySelector('.val').textContent.trim();
        csv += `"${label}","${val}"\n`;
      });
    } else if (type === 'bulk-ipv4') {
      csv = `Input IP,Network / Range,Hosts / Addresses\n`;
      const rows = document.querySelectorAll('#ipv4-bulk-results-tbody tr');
      rows.forEach(row => {
        const tds = row.querySelectorAll('td');
        if (tds.length >= 3) {
          csv += `"${tds[0].textContent.trim()}","${tds[1].textContent.replace(/\s+/g, ' ').trim()}","${tds[2].textContent.trim()}"\n`;
        }
      });
    } else if (type === 'bulk-ipv6') {
      csv = `Input IP,Prefix / Range,Hosts / Addresses\n`;
      const rows = document.querySelectorAll('#ipv6-bulk-results-tbody tr');
      rows.forEach(row => {
        const tds = row.querySelectorAll('td');
        if (tds.length >= 3) {
          csv += `"${tds[0].textContent}","${tds[1].textContent.replace('\n', ' ')}","${tds[2].textContent}"\n`;
        }
      });
    } else if (type === 'base') {
      const bin = document.getElementById('base-bin-input')?.value.trim() || '';
      const oct = document.getElementById('base-oct-input')?.value.trim() || '';
      const dec = document.getElementById('base-dec-input')?.value.trim() || '';
      const hex = document.getElementById('base-hex-input')?.value.trim() || '';

      csv = `Parameter,Value\n`;
      csv += `Binary (Base 2),${bin}\n`;
      csv += `Octal (Base 8),${oct}\n`;
      csv += `Decimal (Base 10),${dec}\n`;
      csv += `Hexadecimal (Base 16),${hex}\n`;
    }
    return csv;
  };

  const triggerCSVDownload = (type) => {
    if (!PRO_UNLOCKED) {
      showProModal();
      return;
    }
    const csvContent = getCSVData(type);
    if (!csvContent || !csvContent.trim()) {
      console.error(`getCSVData returned empty content for type "${type}"`);
      showErrorDialog("Export failed: no data available to export.");
      return;
    }
    downloadCSV(`isubnet_export_${type}.csv`, csvContent);
  };

  const triggerPDFExport = async (type) => {
    if (!PRO_UNLOCKED) {
      showProModal();
      return;
    }
    if (isShareTapDuplicate('report:' + String(type || 'default'))) {
      if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
        window.debugLog('[Share] ui: share tap ignored | reason=double-tap');
      }
      return;
    }

    const isNative = window.Capacitor && window.Capacitor.isNativePlatform();
    if (isNative) {
      const reportText = getReportText(type);
      const { Filesystem, Share } = window.Capacitor.Plugins;
      const filename = `isubnet_report_${type}.txt`;
      let writeResult;
      try {
        writeResult = await Filesystem.writeFile({
          path: filename,
          data: reportText,
          directory: 'CACHE',
          encoding: 'utf8'
        });
      } catch (err) {
        console.error("Capacitor Report Export failed (file write):", err);
        showErrorDialog("Export failed: " + err.message);
        return;
      }
      try {
        await Share.share({
          title: 'Export Report',
          url: writeResult.uri
        });
      } catch (err) {
        // Android's Capacitor Share plugin can reject this promise even when the
        // OS share sheet was already shown and the user genuinely shared or saved
        // the file - the chooser intent doesn't always report its result back to
        // the calling activity reliably (same quirk fixed in shareText()). The
        // file itself was already written successfully at this point, so we just
        // log this and don't show a misleading "Export failed" dialog after a
        // real export.
        console.error("Capacitor Report Export share step failed/rejected:", err);
      }
    } else {
      window.print();
    }
  };

  function getReportText(type) {
    const csvData = getCSVData(type);
    const lines = csvData.trim().split('\n');
    let report = `iSubnet - Subnetting Calculation Report (${type.toUpperCase()})\n`;
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += `========================================\n\n`;
    
    lines.forEach((line, index) => {
      if (index === 0) return; // Skip header
      const parts = line.split(',');
      if (parts.length >= 2) {
        const param = parts[0].replace(/"/g, '');
        const val = parts.slice(1).join(',').replace(/"/g, '');
        report += `${param.padEnd(24)}: ${val}\n`;
      } else {
        report += `${line}\n`;
      }
    });
    
    report += `\n========================================\n`;
    report += `iSubnet - https://isubnet.net\n`;
    return report;
  }

  const pdfIds = [
    { id: 'btn-export-pdf-ipv4', type: 'ipv4' },
    { id: 'btn-export-pdf-ipv6', type: 'ipv6' },
    { id: 'btn-export-pdf-split', type: 'split' },
    { id: 'btn-export-pdf-conv', type: 'conv' },
    { id: 'btn-export-pdf-conv-subnet', type: 'conv-subnet' },
    { id: 'btn-export-pdf-bulk-ipv4', type: 'bulk-ipv4' },
    { id: 'btn-export-pdf-bulk-ipv6', type: 'bulk-ipv6' },
    { id: 'btn-export-pdf-base', type: 'base' }
  ];
  pdfIds.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        triggerPDFExport(item.type);
      });
    }
  });

  const csvIds = [
    { id: 'btn-export-csv-ipv4', type: 'ipv4' },
    { id: 'btn-export-csv-ipv6', type: 'ipv6' },
    { id: 'btn-export-csv-split', type: 'split' },
    { id: 'btn-export-csv-conv', type: 'conv' },
    { id: 'btn-export-csv-conv-subnet', type: 'conv-subnet' },
    { id: 'btn-export-csv-bulk-ipv4', type: 'bulk-ipv4' },
    { id: 'btn-export-csv-bulk-ipv6', type: 'bulk-ipv6' },
    { id: 'btn-export-csv-base', type: 'base' }
  ];
  csvIds.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        triggerCSVDownload(item.type);
      });
    }
  });

  // Bulk IPv4/IPv6 results don't have their own note/share text builders - they
  // reuse getReportText(), the same formatted-text helper the Report export
  // above already uses for these same 'bulk-ipv4'/'bulk-ipv6' types, so Save
  // and Share always show exactly what Report/CSV show.
  const btnSaveNotesBulkIpv4 = document.getElementById('btn-save-notes-bulk-ipv4');
  if (btnSaveNotesBulkIpv4) {
    btnSaveNotesBulkIpv4.addEventListener('click', () => {
      const content = getReportText('bulk-ipv4');
      addNote('Bulk IPv4 Subnet Results', content, 'IPv4');
      maybeRequestReview('save_note');
      switchToNotesTab();
    });
  }
  const btnShareBulkIpv4 = document.getElementById('btn-share-bulk-ipv4');
  if (btnShareBulkIpv4) {
    btnShareBulkIpv4.addEventListener('click', () => {
      shareText('Bulk IPv4 Subnet Results', getReportText('bulk-ipv4'));
    });
  }

  const btnSaveNotesBulkIpv6 = document.getElementById('btn-save-notes-bulk-ipv6');
  if (btnSaveNotesBulkIpv6) {
    btnSaveNotesBulkIpv6.addEventListener('click', () => {
      const content = getReportText('bulk-ipv6');
      addNote('Bulk IPv6 Subnet Results', content, 'IPv6');
      maybeRequestReview('save_note');
      switchToNotesTab();
    });
  }
  const btnShareBulkIpv6 = document.getElementById('btn-share-bulk-ipv6');
  if (btnShareBulkIpv6) {
    btnShareBulkIpv6.addEventListener('click', () => {
      shareText('Bulk IPv6 Subnet Results', getReportText('bulk-ipv6'));
    });
  }
}

async function downloadCSV(filename, content) {
  if (isShareTapDuplicate('csv:' + String(filename || 'default'))) {
    if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') {
      window.debugLog('[Share] ui: share tap ignored | reason=double-tap');
    }
    return;
  }
  const isNative = window.Capacitor && window.Capacitor.isNativePlatform();
  if (isNative) {
    const { Filesystem, Share } = window.Capacitor.Plugins;
    let writeResult;
    try {
      writeResult = await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: 'CACHE',
        encoding: 'utf8'
      });
    } catch (err) {
      console.error("Capacitor CSV Export failed (file write):", err);
      showErrorDialog("Export failed: " + err.message);
      return;
    }
    try {
      await Share.share({
        title: 'Export CSV',
        url: writeResult.uri
      });
    } catch (err) {
      // Same Android Share-plugin quirk as triggerPDFExport()/shareText(): the
      // promise can reject even after a successful share/save, so don't show a
      // misleading "Export failed" dialog once the file itself has already been
      // written successfully.
      console.error("Capacitor CSV Export share step failed/rejected:", err);
    }
    return;
  }

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Global helper function to adjust range slider inputs by a delta unit
window.adjustCidr = function(id, delta) {
  const slider = document.getElementById(id);
  if (!slider) return;
  const newValue = parseInt(slider.value, 10) + delta;
  if (newValue >= parseInt(slider.min, 10) && newValue <= parseInt(slider.max, 10)) {
    slider.value = newValue;
    slider.dispatchEvent(new Event('input'));
  }
};

function updateUpgradeUI(planTier) {
  if(typeof window.debugLog==='function') window.debugLog(`updateUpgradeUI() called with planTier: ${planTier}`);
  
  // SINGLE SOURCE OF TRUTH FOR UNLOCK STATE
  if (planTier !== 'free' && planTier !== 'unknown') {
    PRO_UNLOCKED = true;
    SafeStorage.setItem('isubnet_pro', 'true');
    if (typeof applyProState === 'function') applyProState();
  } else {
    PRO_UNLOCKED = false;
    SafeStorage.setItem('isubnet_pro', 'false');
    if (typeof applyProState === 'function') applyProState();
  }

  const btnLifetime = document.getElementById('btn-pro-buy-lifetime');
  const btnYearly = document.getElementById('btn-pro-buy-yearly');
  const btnMonthly = document.getElementById('btn-pro-buy-monthly');
  
  const planManageLifetimeBtn = document.querySelector('.billing-toggle[data-cycle="lifetime"]');
  const planManageAnnualBtn = document.querySelector('.billing-toggle[data-cycle="annual"]');
  const planManageMonthlyBtn = document.querySelector('.billing-toggle[data-cycle="monthly"]');
  const upgradeToProCard = document.getElementById('btn-plan-select-pro') ? document.getElementById('btn-plan-select-pro').parentElement : null;
  const proModalContainer = document.querySelector('.pro-price');
  const currentPlanName = document.getElementById('current-plan-name');
  const currentPlanDesc = document.getElementById('current-plan-desc');
  
  if (currentPlanName) {
    if (planTier === 'lifetime') {
      currentPlanName.textContent = 'Lifetime Pro';
      if (currentPlanDesc) currentPlanDesc.textContent = 'Lifetime access to all Pro features.';
    } else if (planTier === 'yearly') {
      currentPlanName.textContent = 'Yearly Pro';
      if (currentPlanDesc) currentPlanDesc.textContent = 'Annual subscription to all Pro features.';
    } else if (planTier === 'monthly') {
      currentPlanName.textContent = 'Monthly Pro';
      if (currentPlanDesc) currentPlanDesc.textContent = 'Monthly subscription to all Pro features.';
    } else {
      currentPlanName.textContent = 'Free Plan';
      if (currentPlanDesc) currentPlanDesc.textContent = 'Basic parameters, limited to 2 notes and 2 history items.';
    }
  }


  if (planTier === 'lifetime') {
    if (btnLifetime) btnLifetime.style.display = 'none';
    if (btnYearly) btnYearly.style.display = 'none';
    if (btnMonthly) btnMonthly.style.display = 'none';
    if (upgradeToProCard) upgradeToProCard.style.display = 'none';
    
    if (proModalContainer) {
      let msgEl = document.getElementById('pro-access-msg');
      if (!msgEl) {
        msgEl = document.createElement('div');
        msgEl.id = 'pro-access-msg';
        msgEl.style.cssText = 'text-align:center;color:var(--accent-primary);font-weight:bold;margin:20px 0;font-size:16px;';
        proModalContainer.appendChild(msgEl);
      }
      msgEl.textContent = 'You have Lifetime Pro Access!';
      msgEl.style.display = 'block';
    }
  } else if (planTier === 'yearly') {
    if (btnLifetime) btnLifetime.style.display = 'block';
    if (btnYearly) btnYearly.style.display = 'none';
    if (btnMonthly) btnMonthly.style.display = 'none';
    if (planManageAnnualBtn) planManageAnnualBtn.style.display = 'none';
    if (planManageMonthlyBtn) planManageMonthlyBtn.style.display = 'none';
    if (upgradeToProCard) upgradeToProCard.style.display = 'block';
    if (planManageLifetimeBtn) planManageLifetimeBtn.click();
    const msgEl = document.getElementById('pro-access-msg');
    if (msgEl) msgEl.style.display = 'none';
  } else if (planTier === 'monthly') {
    if (btnLifetime) btnLifetime.style.display = 'block';
    if (btnYearly) btnYearly.style.display = 'block';
    if (btnMonthly) btnMonthly.style.display = 'none';
    if (planManageMonthlyBtn) planManageMonthlyBtn.style.display = 'none';
    if (planManageAnnualBtn) { planManageAnnualBtn.style.display = 'block'; planManageAnnualBtn.click(); }
    if (upgradeToProCard) upgradeToProCard.style.display = 'block';
    const msgEl = document.getElementById('pro-access-msg');
    if (msgEl) msgEl.style.display = 'none';
  } else {
    if (btnLifetime) btnLifetime.style.display = 'block';
    if (btnYearly) btnYearly.style.display = 'block';
    if (btnMonthly) btnMonthly.style.display = 'block';
    if (planManageMonthlyBtn) { planManageMonthlyBtn.style.display = 'block'; planManageMonthlyBtn.click(); }
    if (planManageAnnualBtn) planManageAnnualBtn.style.display = 'block';
    if (planManageLifetimeBtn) planManageLifetimeBtn.style.display = 'block';
    if (upgradeToProCard) upgradeToProCard.style.display = 'block';
    const msgEl = document.getElementById('pro-access-msg');
    if (msgEl) msgEl.style.display = 'none';
  }
}



// --- DNS LOOKUP TOOL ---
(function() {
  const input = document.getElementById('dns-input');
  const typeSelect = document.getElementById('dns-type-select');
  const serverSelect = document.getElementById('dns-server-select');
  const btnLookup = document.getElementById('btn-dns-lookup');
  const btnClear = document.getElementById('btn-dns-clear');
  const resultsCard = document.getElementById('dns-results-card');
  const statusLine = document.getElementById('dns-status-line');
  const tbody = document.getElementById('dns-results-tbody');
  const errorMsg = document.getElementById('dns-error-msg');
  const btnCopy = document.getElementById('btn-dns-copy');
  const btnShare = document.getElementById('btn-dns-share');
  const typeHint = document.getElementById('dns-type-hint');
  const typeLabel = document.getElementById('dns-type-label');
  const proBadge = document.getElementById('dns-pro-badge');

  // Gate for Free DNS lookups: only 'A' is free; all other record types and reverse DNS (PTR) require Pro.
  // To make reverse DNS (PTR) or another record type free later, update this single gate.
  const FREE_DNS_RECORD_TYPES = ['A'];
  const FREE_DNS_ALLOW_REVERSE_PTR = false;

  function isDnsProNow() {
    return typeof PRO_UNLOCKED !== 'undefined' && PRO_UNLOCKED === true;
  }

  function isFreeDnsAllowed(effectiveType, isReverseIp) {
    if (isReverseIp) return FREE_DNS_ALLOW_REVERSE_PTR;
    return FREE_DNS_RECORD_TYPES.indexOf(effectiveType) !== -1;
  }

  const DNS_TYPE_OPTIONS = [
    { value: 'A', proLabel: 'A', freeLabel: 'A' },
    { value: 'AAAA', proLabel: 'AAAA', freeLabel: 'AAAA 🔒 Pro' },
    { value: 'MX', proLabel: 'MX', freeLabel: 'MX 🔒 Pro' },
    { value: 'NS', proLabel: 'NS', freeLabel: 'NS 🔒 Pro' },
    { value: 'TXT', proLabel: 'TXT', freeLabel: 'TXT 🔒 Pro' },
    { value: 'CNAME', proLabel: 'CNAME', freeLabel: 'CNAME 🔒 Pro' },
    { value: 'SOA', proLabel: 'SOA', freeLabel: 'SOA 🔒 Pro' },
    { value: 'PTR', proLabel: 'PTR', freeLabel: 'PTR 🔒 Pro' },
    { value: 'CAA', proLabel: 'CAA', freeLabel: 'CAA 🔒 Pro' },
    { value: 'ALL', proLabel: 'ALL (A, AAAA, MX, NS, TXT, CNAME)', freeLabel: 'ALL 🔒 Pro' }
  ];

  let currentDnsCount = 0;
  let dnsLookupCount = 0;
  let currentLookupName = '';
  let currentReverseName = '';
  
  function dnsLog(msg) {
    if (!window.APP_DEBUG_ENABLED) return;
    if (typeof window.debugLog === 'function') {
      try {
        const prefix = msg.startsWith('init:') || msg.startsWith('ui:') ? 'DNS ' : `DNS #${currentDnsCount}: `;
        window.debugLog(prefix + msg);
      } catch (e) {
        // ignore
      }
    }
  }


  function dnsErrInfo(err) {
    const name = (err && err.name) || 'Error';
    const m = String((err && err.message) || err || '');
    let kind = 'other';
    if (name === 'AbortError') kind = 'abort';
    else if (name === 'SyntaxError') kind = 'parse';
    else if (/failed to fetch|networkerror|load failed|network request failed/i.test(m)) kind = 'network';
    const frames = String((err && err.stack) || '')
      .split('\n')
      .filter(l => /^\s*at\s/.test(l) || l.includes('@'))
      .slice(0, 3)
      .map(l => l.trim())
      .join(' <- ');
    return { name, kind, frames };
  }
  function redactErr(err) {
    if (!err) return { name: 'Unknown', msg: 'Unknown error', stack: '' };
    const name = err.name || 'Error';
    let msg = err.message || String(err);
    let stack = err.stack || '';

    function redactStr(str) {
      if (!str) return '';
      str = str.replace(/https?:\/\/[^\s"']+/g, '[URL redacted]');
      
      const escapeRegExp = (s) => s.split('').map(c => /[.*+?^${}()|[\]\\]/.test(c) ? '\\' + c : c).join('');
      
      if (currentReverseName && currentReverseName.length > 2) {
        const safeRev = escapeRegExp(currentReverseName);
        str = str.replace(new RegExp(safeRev + '\\.?', 'gi'), '[redacted]');
      }
      if (currentLookupName && currentLookupName.length > 2) {
        const safeName = escapeRegExp(currentLookupName);
        str = str.replace(new RegExp(safeName + '\\.?', 'gi'), '[redacted]');
      }
      return str;
    }

    msg = redactStr(msg);
    stack = redactStr(stack).split('\n').slice(0, 3).join('\n');
    return { name, msg, stack };
  }

  const btnSave = document.getElementById('btn-dns-save');
  if (!input || !typeSelect || !btnLookup || !btnClear || !resultsCard || !statusLine || !tbody || !errorMsg || !btnCopy || !btnShare || !btnSave) {
    const missing = [];
    if (!input) missing.push('dns-input');
    if (!typeSelect) missing.push('dns-type-select');
    if (!btnLookup) missing.push('btn-dns-lookup');
    if (!btnClear) missing.push('btn-dns-clear');
    if (!resultsCard) missing.push('dns-results-card');
    if (!statusLine) missing.push('dns-status-line');
    if (!tbody) missing.push('dns-results-tbody');
    if (!errorMsg) missing.push('dns-error-msg');
    if (!btnCopy) missing.push('btn-dns-copy');
    if (!btnShare) missing.push('btn-dns-share');
    dnsLog('init: ABORTED, missing elements: ' + missing.join(', '));
    return;
  }

  const cap = window.Capacitor;
  const platform = cap && cap.getPlatform ? cap.getPlatform() : 'web';
  const isNative = cap && cap.isNativePlatform ? cap.isNativePlatform() : false;
  const hasCapHttp = !!(cap && cap.Plugins && cap.Plugins.CapacitorHttp);
  const hasCrashlytics = !!(cap && cap.Plugins && cap.Plugins.FirebaseCrashlytics);
  const hasClip = !!(navigator.clipboard && navigator.clipboard.writeText);
  const typeAbort = typeof window.AbortController;
  dnsLog(`init: ok | platform=${platform} | isNative=${isNative} | hasCapHttp=${hasCapHttp} | hasCrash=${hasCrashlytics} | hasClip=${hasClip} | typeAbort=${typeAbort}`);

  let currentAbortController = null;
  let lastLookupResultText = '';
  let lastLookupNoteTitle = '';

  const DNS_TYPE_HINTS = {
    A: 'Enter a hostname (example.com). Shows the IPv4 addresses it points to.',
    AAAA: 'Enter a hostname (example.com). Shows the IPv6 addresses it points to. No result means no IPv6 address is published.',
    MX: 'Enter a domain (example.com). Shows the mail servers that receive its email. The lowest priority number is tried first.',
    NS: 'Enter a domain (example.com). Shows the name servers responsible for it. Subdomains usually have none of their own.',
    TXT: 'Enter a domain (example.com). Shows text records such as SPF and site verification. For DMARC enter _dmarc.example.com.',
    CNAME: 'Enter a subdomain (www.example.com). Shows the name it is an alias of. A main domain normally has no CNAME.',
    SOA: 'Enter a domain (example.com). Shows the zone\'s primary name server, admin contact and refresh timers.',
    PTR: 'Enter an IP address (8.8.8.8). Shows the hostname its owner registered for it, often a server name and not a website. Many addresses have none.',
    CAA: 'Enter a domain (example.com). Shows which certificate authorities may issue certificates for it. None listed means no restriction at this name.',
    ALL: 'Enter a domain (example.com). Runs A, AAAA, MX, NS, TXT and CNAME together. Types with no records are left out.',
    IP: 'IP address detected: reverse DNS (PTR) lookup. Shows the hostname its owner registered for it, often a server name and not a website. The record type above is ignored.'
  };

  function updateDnsHint() {
    if (!typeHint) return;
    let val = (input.value || '').trim().replace(/\.+$/, '');

    // Detect IP using the same normalization as runLookup
    // (strip protocol/path if typed, then test IPv4 and IPv6). Never throws.
    let isIp = false;
    try {
      if (val) {
        let host = val;
        const wasUrl = host.startsWith('http://') || host.startsWith('https://');
        const hadPath = host.includes('/');
        try {
          if (wasUrl) {
            host = new URL(host).hostname;
          } else if (hadPath) {
            host = new URL('http://' + host).hostname;
          } else {
            try {
              host = new URL('http://' + host).hostname;
            } catch (e) {
              host = host.toLowerCase();
            }
          }
        } catch (e) {
          host = host.toLowerCase();
        }
        host = host.replace(/\.+$/, '');
        if (validateIPv4(host) || parseIPv6(host) !== null) {
          isIp = true;
        }
      }
    } catch (e) {
      isIp = false;
    }

    if (typeSelect) {
      typeSelect.disabled = isIp;
    }

    const selectedType = typeSelect.value;
    if (!isDnsProNow()) {
      if (isIp && !isFreeDnsAllowed('PTR', true)) {
        typeHint.textContent = 'Reverse DNS (PTR) lookups for IP addresses are a Pro feature.';
        typeHint.style.color = 'var(--accent-primary)';
        typeHint.style.whiteSpace = '';
        return;
      }
      const baseText = DNS_TYPE_HINTS[selectedType] || '';
      const freeExtra = 'Free: A records. Pro unlocks AAAA, MX, NS, TXT, CNAME, SOA, CAA, ALL and reverse DNS.';
      typeHint.textContent = baseText ? `${baseText}\n${freeExtra}` : freeExtra;
      typeHint.style.color = '';
      typeHint.style.whiteSpace = 'pre-line';
      return;
    }
    typeHint.style.whiteSpace = '';
    const text = isIp ? DNS_TYPE_HINTS.IP : (DNS_TYPE_HINTS[selectedType] || '');
    typeHint.textContent = text;
    typeHint.style.color = isIp ? 'var(--accent-primary)' : '';
  }

  function updateDnsControls() {
    const isPro = isDnsProNow();
    if (proBadge) {
      proBadge.style.display = isPro ? 'none' : 'inline-block';
    }
    if (typeof setProLabelInteractivity === 'function') {
      setProLabelInteractivity(typeLabel, proBadge, !isPro);
    }
    if (typeSelect) {
      const prevVal = typeSelect.value || 'A';
      Array.from(typeSelect.options).forEach((opt) => {
        const def = DNS_TYPE_OPTIONS.find((d) => d.value === opt.value);
        if (!def) return;
        const unlocked = isPro || isFreeDnsAllowed(def.value, false);
        opt.textContent = unlocked ? def.proLabel : def.freeLabel;
      });
      if (!isPro && !isFreeDnsAllowed(prevVal, false)) {
        typeSelect.value = 'A';
      }
    }
    updateDnsHint();
  }
  window.updateDnsControls = updateDnsControls;

  const RECORD_TYPES = {
    1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR', 15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 257: 'CAA'
  };

  const DNS_SERVERS = {
    'cf-1': { label: 'Cloudflare 1.1.1.1', url: 'https://1.1.1.1/dns-query' },
    'cf-2': { label: 'Cloudflare 1.0.0.1', url: 'https://1.0.0.1/dns-query' },
    'g-1':  { label: 'Google 8.8.8.8',     url: 'https://8.8.8.8/resolve' },
    'g-2':  { label: 'Google 8.8.4.4',     url: 'https://8.8.4.4/resolve' }
  };
  const DNS_SERVER_DEFAULT = 'cf-1';
  const DNS_SERVER_KEY = 'isubnet_dns_server';

  function getDnsServerId() {
    const id = serverSelect ? serverSelect.value : DNS_SERVER_DEFAULT;
    return DNS_SERVERS[id] ? id : DNS_SERVER_DEFAULT;
  }

  if (serverSelect) {
    let saved = null;
    try { saved = SafeStorage.getItem(DNS_SERVER_KEY); } catch (e) { saved = null; }
    serverSelect.value = DNS_SERVERS[saved] ? saved : DNS_SERVER_DEFAULT;
    serverSelect.addEventListener('change', () => {
      const id = getDnsServerId();
      try { SafeStorage.setItem(DNS_SERVER_KEY, id); } catch (e) { /* ignore */ }
      dnsLog(`ui: server changed | server=${id}`);
    });
  }

  const RCODE_NAMES = {
    0: 'NOERROR', 1: 'FORMERR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 4: 'NOTIMP', 5: 'REFUSED'
  };

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
    resultsCard.style.display = 'none';
  }

  function hideError() {
    errorMsg.style.display = 'none';
  }

  async function fetchDns(name, type, serverId) {
    const isNat = window.Capacitor && window.Capacitor.isNativePlatform();
    const hasCap = !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp);
    const server = DNS_SERVERS[serverId] || DNS_SERVERS[DNS_SERVER_DEFAULT];
    const url = `${server.url}?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;
    
    let useNative = isNat && hasCap;
    if (isNat && !hasCap) {
      dnsLog(`type=${type} | native but CapacitorHttp missing, falling back to fetch`);
    }

    const t0 = performance.now();
    let rStatus = 0;
    let rCType = '';
    let dType = '';
    let parsedObj = null;
    let parseFailed = false;

    try {
      if (useNative) {
        dnsLog(`type=${type} | path=CapacitorHttp`);
        const options = {
          url: url,
          headers: { 'Accept': 'application/dns-json' },
          connectTimeout: 8000,
          readTimeout: 8000
        };
        const response = await window.Capacitor.Plugins.CapacitorHttp.get(options);
        rStatus = response.status;
        if (response.headers) {
          // Headers could be varied case
          for (const [k, v] of Object.entries(response.headers)) {
            if (k.toLowerCase() === 'content-type') rCType = v;
          }
        }
        
        if (rStatus === 429) dnsLog(`type=${type} | HTTP 429 (rate limited)`);
        else if (rStatus !== 200) throw new Error('HTTP ' + rStatus);
        
        let data = response.data;
        dType = typeof data;
        if (dType === 'string') {
          try {
            data = JSON.parse(data);
            parsedObj = data;
          } catch (e) {
            parseFailed = true;
            throw new Error('Invalid JSON response');
          }
        } else {
          parsedObj = data;
        }

        if (!parsedObj || typeof parsedObj.Status !== 'number') {
          throw new Error('Unexpected response from DNS service');
        }
      } else {
        dnsLog(`type=${type} | path=fetch`);
        const response = await fetch(url, {
          headers: { 'Accept': 'application/dns-json' },
          signal: currentAbortController.signal
        });
        rStatus = response.status;
        rCType = response.headers.get('content-type') || '';
        
        if (rStatus === 429) dnsLog(`type=${type} | HTTP 429 (rate limited)`);
        else if (!response.ok) throw new Error('HTTP ' + rStatus);
        
        dType = 'stream';
        try {
          parsedObj = await response.json();
        } catch(e) {
          parseFailed = true;
          throw new Error('Invalid JSON response');
        }
        if (!parsedObj || typeof parsedObj.Status !== 'number') {
          throw new Error('Unexpected response from DNS service');
        }
      }
      
      const t1 = performance.now();
      const ansCount = parsedObj.Answer ? parsedObj.Answer.length : 0;
      const authCount = parsedObj.Authority ? parsedObj.Authority.length : 0;
      const tc = !!parsedObj.TC;
      const cCount = parsedObj.Comment ? (Array.isArray(parsedObj.Comment) ? parsedObj.Comment.length : 1) : 0;
      const elapsed = Math.round(t1 - t0);

      dnsLog(`type=${type} | status=${rStatus} | cType=${rCType} | dataType=${dType} | jsonNeed=${useNative && dType==='string'} | parseFail=${parseFailed} | statusIsNum=true | RCODE=${parsedObj.Status} | Ans=${ansCount} | Auth=${authCount} | TC=${tc} | Comments=${cCount} | ms=${elapsed}`);
      return parsedObj;
      
    } catch (e) {
      const i = dnsErrInfo(e);
      dnsLog(`type=${type} | error=${i.name} | kind=${i.kind}` + (i.name === 'AbortError' ? '' : ` | frames=${i.frames}`));
      throw e;
    }
  }

  async function runLookup() {
    if (btnLookup.disabled) {
      dnsLog('ui: ignored, lookup already running');
      return;
    }

    dnsLookupCount++;
    currentDnsCount = dnsLookupCount;
    hideError();
    
    let rawVal = input.value;
    let val = rawVal.trim().replace(/\.+$/, '');
    if (!val) {
      if (!isDnsProNow() && !isFreeDnsAllowed(typeSelect.value, false)) {
        dnsLog('ui: lookup gated (free) | reason=type');
        typeSelect.value = 'A';
        updateDnsHint();
        showProModal('dns');
        return;
      }
      dnsLog('rejected: empty input');
      showError('Please enter a hostname or IP address.');
      return;
    }

    let wasUrl = false;
    let hadPath = false;
    let urlParseFailed = false;
    
    if (val.startsWith('http://') || val.startsWith('https://')) wasUrl = true;
    if (val.includes('/')) hadPath = true;

    try {
      if (wasUrl) {
        val = new URL(val).hostname;
      } else if (hadPath) {
        val = new URL('http://' + val).hostname;
      } else {
        try {
          const urlObj = new URL('http://' + val);
          val = urlObj.hostname;
        } catch(e) {
          val = val.toLowerCase();
          urlParseFailed = true;
        }
      }
    } catch (e) {
      val = val.toLowerCase();
      urlParseFailed = true;
    }
    
    val = val.replace(/\.+$/, '');
    const changed = (rawVal !== val);
    input.value = val;
    updateDnsHint();
    currentLookupName = val;
    currentReverseName = '';
    
    let type = typeSelect.value;
    const serverId = getDnsServerId();
    let kind = 'hostname';
    let reverse = false;
    let effectiveType = type;
    
    if (typeof validateIPv4 === 'function' && validateIPv4(val)) {
      kind = 'ipv4';
      reverse = true;
      currentReverseName = val.split('.').reverse().join('.') + '.in-addr.arpa';
      val = currentReverseName;
      effectiveType = 'PTR';
    } else if (typeof parseIPv6 === 'function') {
      const bigInt = parseIPv6(val);
      if (bigInt !== null) {
        kind = 'ipv6';
        reverse = true;
        currentReverseName = bigInt.toString(16).padStart(32, '0').split('').reverse().join('.') + '.ip6.arpa';
        val = currentReverseName;
        effectiveType = 'PTR';
      }
    }
    
    if (!isDnsProNow() && !isFreeDnsAllowed(effectiveType, reverse)) {
      const reason = reverse ? 'reverse' : 'type';
      dnsLog(`ui: lookup gated (free) | reason=${reason}`);
      currentLookupName = '';
      currentReverseName = '';
      if (!reverse && typeSelect && !isFreeDnsAllowed(typeSelect.value, false)) {
        typeSelect.value = 'A';
        updateDnsHint();
      }
      showProModal('dns');
      return;
    }

    dnsLog(`start | selectedType=${type} | server=${serverId} | inputLength=${rawVal.length} | online=${navigator.onLine}`);
    dnsLog(`input | wasUrl=${wasUrl} | hadPath=${hadPath} | changed=${changed} | urlParseFailed=${urlParseFailed} | kind=${kind} | effectiveType=${effectiveType} | reverse=${reverse}`);

    if (navigator.onLine === false) {
      dnsLog('rejected: offline');
      showError('Device is offline. Please check your connection.');
      return;
    }

    btnLookup.disabled = true;
    btnLookup.textContent = 'Looking up...';
    tbody.innerHTML = '';
    statusLine.style.color = 'var(--text-secondary)';
    
    if (window.Capacitor && window.Capacitor.Plugins.FirebaseCrashlytics) {
      window.Capacitor.Plugins.FirebaseCrashlytics.setCustomKey({ key: 'last_calc_action', value: 'dnsLookup', type: 'string' }).catch(() => {});
    }

    if (currentAbortController) {
      dnsLog('abort reason=superseded');
      currentAbortController.abort();
    }
    currentAbortController = new window.AbortController();
    const abortTimer = setTimeout(() => {
      if (currentAbortController) {
        dnsLog('abort reason=timeout');
        currentAbortController.abort();
      }
    }, 8000);

    const startTime = performance.now();
    let outcome = 'ok';
    
    try {
      let results = [];
      let maxStatus = 0;
      let failedQueries = 0;
      let totalQueries = 1;
      
      if (effectiveType === 'ALL') {
        const types = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME'];
        totalQueries = types.length;
        const promises = types.map(t => fetchDns(val, t, serverId));
        const responses = await Promise.allSettled(promises);
        
        const rejected = responses.filter(r => r.status === 'rejected');
        failedQueries = rejected.length;
        
        if (failedQueries === totalQueries) {
          throw rejected[0].reason;
        }
        
        if (failedQueries > 0) {
          const failedTypes = [];
          responses.forEach((r, i) => { if (r.status === 'rejected') failedTypes.push(types[i]); });
          dnsLog(`ALL: ${failedQueries} of ${totalQueries} failed (failed types: ${failedTypes.join(',')})`);
        }
        
        for (const res of responses) {
          if (res.status === 'fulfilled' && res.value) {
            const data = res.value;
            if (data.Status > maxStatus) maxStatus = data.Status;
            if (data.Answer) results.push(...data.Answer);
          }
        }
      } else {
        const data = await fetchDns(val, effectiveType, serverId);
        maxStatus = data.Status;
        if (data.Answer) results = data.Answer;
      }

      // Deduplicate
      let dupesRemoved = 0;
      const seen = new Set();
      results = results.filter(r => {
        const key = r.name + '|' + r.type + '|' + r.data;
        if (seen.has(key)) {
          dupesRemoved++;
          return false;
        }
        seen.add(key);
        return true;
      });

      const elapsed = Math.round(performance.now() - startTime);
      const rcodeName = RCODE_NAMES[maxStatus] || ('RCODE' + maxStatus);
      
      let statusText = `${rcodeName} - ${elapsed}ms via ${DNS_SERVERS[serverId].label} (DNS over HTTPS)`;
      if (failedQueries > 0) statusText += ` (${failedQueries} of ${totalQueries} queries failed)`;
      statusLine.textContent = statusText;
      statusLine.style.color = (maxStatus === 0) ? 'var(--accent-success)' : 'var(--accent-danger)';
      
      const activeName = (currentLookupName || currentReverseName || 'Unknown');
      const activeType = (effectiveType === 'ALL' ? 'A, AAAA, MX, NS, TXT, CNAME' : effectiveType);
      lastLookupNoteTitle = `DNS Lookup: ${activeName} (${activeType})`;
      lastLookupResultText = `DNS Lookup for ${activeName} (${activeType})\nStatus: ${rcodeName} (${elapsed}ms)\nServer: ${DNS_SERVERS[serverId].label}\n\n`;

      let maxDataLen = 0;

      if (results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:16px;">No records found</td></tr>';
        lastLookupResultText += "No records found.\n";
      } else {
        let i = 0;
        for (const rec of results) {
          try {
            const rawName = String(rec.name || '').replace(/(.)\.$/, '$1');
            const recTypeNum = rec.type;
            const rawType = RECORD_TYPES[recTypeNum] || ('TYPE' + recTypeNum);
            const rawTtl = String(rec.TTL || '');
            const rawData = rec.data || '';
            
            if (rawData.length > maxDataLen) maxDataLen = rawData.length;

            lastLookupResultText += `${rawName}\t${rawType}\t${rawTtl}\t${rawData}\n`;
            
            const safeName = typeof escapeHTML === 'function' ? escapeHTML(String(rawName)) : String(rawName);
            const safeType = typeof escapeHTML === 'function' ? escapeHTML(String(rawType)) : String(rawType);
            const safeTtl = typeof escapeHTML === 'function' ? escapeHTML(String(rawTtl)) : String(rawTtl);
            const safeData = typeof escapeHTML === 'function' ? escapeHTML(String(rawData)) : String(rawData);
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td style="word-break: break-all;">${safeName}</td>
              <td>${safeType}</td>
              <td style="color: var(--text-muted);">${safeTtl}</td>
              <td style="word-break: break-word; max-width: 250px; color: var(--accent-primary); font-weight: 500;">${safeData}</td>
            `;
            tbody.appendChild(tr);
          } catch (renderErr) {
            const info = dnsErrInfo(renderErr);
            dnsLog(`render FAILED at row ${i} | error=${info.name} | kind=${info.kind} | frames=${info.frames}`);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:16px; color:var(--accent-danger);">An error occurred displaying the results.</td></tr>';
            lastLookupResultText = '';
            lastLookupNoteTitle = '';
            outcome = 'error';
            break;
          }
          i++;
        }
      }
      
      resultsCard.style.display = 'block';
      dnsLog(`result | elapsed=${elapsed} | RCODE=${rcodeName} | results=${results.length} | dupesRemoved=${dupesRemoved} | maxDataLen=${maxDataLen}`);

    } catch (err) {
      const red = redactErr(err);
      if (err.name === 'AbortError') {
        outcome = 'timeout';
        showError('Request timed out (8 seconds).');
        dnsLog(`abort reason=timeout`);
      } else {
        outcome = 'error';
        showError('Failed to lookup DNS: ' + red.msg);
      }
    } finally {
      clearTimeout(abortTimer);
      btnLookup.disabled = false;
      btnLookup.textContent = 'Lookup';
      currentAbortController = null;
      currentLookupName = '';
      currentReverseName = '';
      dnsLog(`finished | outcome=${outcome} | totalMs=${Math.round(performance.now() - startTime)}`);
    }
  }

  btnLookup.addEventListener('click', runLookup);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runLookup();
  });
  input.addEventListener('input', updateDnsHint);
  typeSelect.addEventListener('change', () => {
    const chosen = typeSelect.value;
    if (!isDnsProNow() && !isFreeDnsAllowed(chosen, false)) {
      dnsLog(`ui: record type locked tap | type=${chosen}`);
      typeSelect.value = 'A';
      if (typeof typeSelect.blur === 'function') typeSelect.blur();
      updateDnsHint();
      showProModal('dns');
      return;
    }
    updateDnsHint();
  });

  if (typeLabel) {
    const onDnsProLabelActivate = (e) => {
      if (isDnsProNow()) return;
      if (e && e.type === 'keydown') {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
      } else if (e && e.cancelable) {
        e.preventDefault();
      }
      dnsLog('ui: pro label tap');
      showProModal('dns');
    };
    typeLabel.addEventListener('click', onDnsProLabelActivate);
    typeLabel.addEventListener('keydown', onDnsProLabelActivate);
  }
  
  btnClear.addEventListener('click', () => {
    dnsLog('ui: cleared');
    input.value = '';
    updateDnsHint();
    hideError();
    resultsCard.style.display = 'none';
    lastLookupResultText = '';
  });

  btnCopy.addEventListener('click', () => {
    const hasText = !!lastLookupResultText;
    dnsLog(`ui: copy tap | hasText=${hasText} | len=${lastLookupResultText.length} | hasClip=${hasClip}`);
    if (hasText && hasClip) {
      navigator.clipboard.writeText(lastLookupResultText)
        .then(() => {
          dnsLog('ui: copy success');
          if (typeof showToast === 'function') showToast('DNS results copied!');
        })
        .catch(err => {
          const info = dnsErrInfo(err);
          dnsLog(`ui: copy FAILED | error=${info.name} | kind=${info.kind}`);
          if (typeof showToast === 'function') showToast('Copy failed');
        });
    }
  });

  btnShare.addEventListener('click', () => {
    if (isShareTapDuplicate('dns')) {
      dnsLog('ui: share tap ignored | reason=double-tap');
      return;
    }
    const hasText = !!lastLookupResultText;
    dnsLog(`ui: share tap | hasText=${hasText} | len=${lastLookupResultText.length}`);
    if (hasText && typeof shareText === 'function') {
      shareText('DNS Lookup Results', lastLookupResultText, true);
    }
  });

  btnSave.addEventListener('click', () => {
    const hasText = !!lastLookupResultText;
    dnsLog(`ui: save tap | hasText=${hasText} | len=${lastLookupResultText ? lastLookupResultText.length : 0}`);
    if (!hasText || typeof addNote !== 'function') return;
    addNote(lastLookupNoteTitle || 'DNS Lookup', lastLookupResultText, 'DNS');
    if (typeof maybeRequestReview === 'function') maybeRequestReview('save_note');
    if (typeof switchToNotesTab === 'function') switchToNotesTab();
  });

  updateDnsControls();
})();


// --- PING TOOL ---
(function initPingTool() {
  const input = document.getElementById('ping-input');
  const btnRun = document.getElementById('btn-ping-run');
  const btnClear = document.getElementById('btn-ping-clear');
  const resultsCard = document.getElementById('ping-results-card');
  const statusLine = document.getElementById('ping-status-line');
  const tbody = document.getElementById('ping-results-tbody');
  const errorMsg = document.getElementById('ping-error-msg');
  const platformNote = document.getElementById('ping-platform-note');
  const btnCopy = document.getElementById('btn-ping-copy');
  const btnSave = document.getElementById('btn-ping-save');
  const btnShare = document.getElementById('btn-ping-share');
  const countInput = document.getElementById('ping-count-input');
  const continuousBtn = document.getElementById('btn-ping-continuous');
  const proBadge = document.getElementById('ping-pro-badge');
  const tableContainer = document.getElementById('ping-table-container');
  const graphWrap = document.getElementById('ping-graph-wrap');
  const graphSvg = document.getElementById('ping-graph-svg');
  const graphScroll = document.getElementById('ping-graph-scroll');
  const graphYAxis = document.getElementById('ping-graph-yaxis');
  const graphLegend = document.getElementById('ping-graph-legend');
  const btnViewList = document.getElementById('btn-ping-view-list');
  const btnViewGraph = document.getElementById('btn-ping-view-graph');

  if (!input || !btnRun || !btnClear || !resultsCard || !statusLine || !tbody || !errorMsg) {
    return;
  }

  function pingLog(msg) {
    if (!window.APP_DEBUG_ENABLED || typeof window.debugLog !== 'function') return;
    window.debugLog(`[Ping] ${msg}`);
  }

  const cap = window.Capacitor;
  const platform = cap && cap.getPlatform ? cap.getPlatform() : 'web';
  const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());

  let lookupPath = 'none';
  let P = null;
  if (cap && cap.Plugins && cap.Plugins.Ping) {
    P = cap.Plugins.Ping;
    lookupPath = 'Plugins.Ping';
  } else if (cap && typeof cap.registerPlugin === 'function') {
    try {
      P = cap.registerPlugin('Ping');
      if (P) lookupPath = 'registerPlugin';
    } catch (e) {
      lookupPath = 'registerPlugin_failed';
    }
  }

  if (window.APP_DEBUG_ENABLED) {
    pingLog(`init: platform=${platform} | isNative=${isNative} | pluginFound=${!!P} | path=${lookupPath}`);
  }

  if (!isNative) {
    btnRun.disabled = true;
    if (platformNote) platformNote.style.display = 'block';
  }

  let isRunning = false;
  let stopReason = null;
  let probeListener = null;
  let lastPingResultText = '';
  let lastPingNoteTitle = '';
  let rowsData = [];

  let continuousOn = false;
  let liveSent = 0;
  let liveReceived = 0;
  let liveTimeouts = 0;
  let liveSum = 0;
  let liveMin = null;
  let liveMax = null;
  let droppedRows = 0;
  let runContinuous = false;
  let newestFirst = false;

  // --- Latency graph (List | Graph view) ---
  // The graph keeps every probe of the run (up to 1500). When the run is long the plot is wider
  // than the screen and scrolls sideways; the y-axis stays fixed. While a run is live the view
  // follows the newest probe unless the user scrolls back. Tapping the plot shows one probe.
  const GRAPH_MAX_POINTS = 1500;
  const GRAPH_STEP_MIN = 8;
  const GRAPH_H = 170;
  const GRAPH_T = 16;
  const GRAPH_B = 22;
  const GRAPH_PADL = 8;
  const GRAPH_PADR = 8;
  let graphData = [];
  let viewMode = 'list';
  let graphTimer = null;
  let graphFollow = true;
  let graphSelectedSeq = null;
  let lastPingHeader = '';
  let lastPingSummary = '';

  function graphNiceMax(v) {
    if (!(v > 10)) return 10;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const steps = [1, 1.5, 2, 3, 5, 7.5, 10];
    let m = 10;
    for (let i = 0; i < steps.length; i++) {
      if (n <= steps[i]) { m = steps[i]; break; }
    }
    return m * p;
  }

  function graphFmt(v) {
    return String(Math.round(v * 10) / 10);
  }

  function graphStats(data) {
    let maxMs = 0;
    let sum = 0;
    let okCount = 0;
    data.forEach((p) => {
      if (p.ms !== null) {
        okCount++;
        sum += p.ms;
        if (p.ms > maxMs) maxMs = p.ms;
      }
    });
    return { maxMs: maxMs, okCount: okCount, lost: data.length - okCount, avg: okCount > 0 ? sum / okCount : null };
  }

  // Colour of the reply line. If the theme colour is red-ish it would look the same as the red
  // "no reply" markers, so the line switches to the success green in that case.
  function graphReplyColor() {
    let c = '';
    try { c = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim(); } catch (e) { c = ''; }
    let r, g, b;
    const hx = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(c);
    if (hx) {
      r = parseInt(hx[1], 16); g = parseInt(hx[2], 16); b = parseInt(hx[3], 16);
    } else {
      const q = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(c);
      if (!q) return 'var(--accent-primary)';
      r = +q[1]; g = +q[2]; b = +q[3];
    }
    const mx = Math.max(r, g, b);
    const d = mx - Math.min(r, g, b);
    if (d === 0 || mx === 0) return 'var(--accent-primary)';
    let h;
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    const sat = d / mx;
    const nearRed = (h <= 40 || h >= 330) && sat > 0.3 && mx > 90;
    return nearRed ? 'var(--accent-success)' : 'var(--accent-primary)';
  }

  let lastLoggedPingGraphKey = '';

  function resetPingGraph() {
    graphData = [];
    graphSelectedSeq = null;
    graphFollow = true;
    lastPingHeader = '';
    lastPingSummary = '';
    lastLoggedPingGraphKey = '';
    renderGraph();
  }

  function renderGraph(isSelectUpdate) {
    if (!graphSvg || !graphLegend || !graphScroll || !graphYAxis) return;
    if (viewMode !== 'graph') return;
    const plotH = GRAPH_H - GRAPH_T - GRAPH_B;
    const baseY = GRAPH_T + plotH;
    const pts = graphData;
    const n = pts.length;
    const viewportW = graphScroll.clientWidth || 250;
    const f = (v) => (Math.round(v * 10) / 10).toString();
    const okColor = graphReplyColor();

    if (n === 0) {
      graphYAxis.innerHTML = '';
      graphSvg.setAttribute('width', String(viewportW));
      graphSvg.innerHTML = `<text x="${viewportW / 2}" y="${GRAPH_H / 2}" text-anchor="middle" font-size="11" fill="var(--text-muted)">Waiting for replies...</text>`;
      graphSvg.setAttribute('aria-label', 'Ping latency graph, no data yet');
      graphLegend.innerHTML = '';
      return;
    }

    const wasAtEnd = graphScroll.scrollWidth - graphScroll.scrollLeft - graphScroll.clientWidth < 12;
    const stats = graphStats(pts);
    if (!isRunning && !isSelectUpdate) {
      const renderKey = `${viewMode}:${n}:${stats.lost}`;
      if (renderKey !== lastLoggedPingGraphKey) {
        lastLoggedPingGraphKey = renderKey;
        if (window.APP_DEBUG_ENABLED && stats.lost > 0) {
          pingLog(`ping: graph lost=${stats.lost} of ${n}`);
        }
      }
    }
    const maxY = graphNiceMax(stats.maxMs);
    const innerW = viewportW - GRAPH_PADL - GRAPH_PADR;
    const step = n > 1 ? Math.max(GRAPH_STEP_MIN, innerW / (n - 1)) : 0;
    const contentW = n > 1 ? Math.round(GRAPH_PADL + step * (n - 1) + GRAPH_PADR) : viewportW;
    const scrollable = contentW > viewportW + 1;
    const xAt = (i) => (n <= 1 ? contentW / 2 : GRAPH_PADL + i * step);
    const yAt = (ms) => GRAPH_T + plotH - (ms / maxY) * plotH;
    const ptY = (p) => (p.ms === null ? baseY : yAt(p.ms));

    let axis = '';
    [0, 0.5, 1].forEach((frac) => {
      const gy = GRAPH_T + plotH - frac * plotH;
      axis += `<text x="32" y="${f(gy + 3)}" text-anchor="end" font-size="9" fill="var(--text-muted)">${graphFmt(maxY * frac)}</text>`;
    });
    axis += `<text x="32" y="${GRAPH_T - 6}" text-anchor="end" font-size="8" fill="var(--text-muted)">ms</text>`;
    graphYAxis.innerHTML = axis;

    let svg = '';
    [0, 0.5, 1].forEach((frac) => {
      const gy = GRAPH_T + plotH - frac * plotH;
      svg += `<line x1="0" y1="${f(gy)}" x2="${contentW}" y2="${f(gy)}" stroke="var(--border-color)" stroke-width="1"/>`;
    });

    if (stats.avg !== null && stats.okCount > 1) {
      svg += `<line x1="0" y1="${f(yAt(stats.avg))}" x2="${contentW}" y2="${f(yAt(stats.avg))}" stroke="var(--accent-cyan)" stroke-width="1" stroke-dasharray="3 3" opacity="0.8"/>`;
    }

    let okPath = '';
    let badPath = '';
    for (let i = 0; i < n - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const segCmd = `M${f(xAt(i))} ${f(ptY(p1))}L${f(xAt(i + 1))} ${f(ptY(p2))}`;
      if (p1.ms === null || p2.ms === null) {
        badPath += segCmd;
      } else {
        okPath += segCmd;
      }
    }
    if (okPath) {
      svg += `<path class="ping-seg-ok" d="${okPath}" fill="none" stroke="${okColor}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    if (badPath) {
      svg += `<path class="ping-seg-bad" d="${badPath}" fill="none" stroke="var(--accent-danger)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`;
    }

    pts.forEach((p, i) => {
      if (p.ms === null) {
        const prevBad = i > 0 && pts[i - 1].ms === null;
        const nextBad = i < n - 1 && pts[i + 1].ms === null;
        if (n <= 40 || (!prevBad && !nextBad)) {
          svg += `<circle class="ping-dot-bad" cx="${f(xAt(i))}" cy="${f(baseY)}" r="2.5" fill="var(--accent-danger)"/>`;
        }
      } else {
        const prevOk = i > 0 && pts[i - 1].ms !== null;
        const nextOk = i < n - 1 && pts[i + 1].ms !== null;
        if (n <= 40 || (!prevOk && !nextOk)) {
          svg += `<circle class="ping-dot-ok" cx="${f(xAt(i))}" cy="${f(yAt(p.ms))}" r="2.5" fill="${okColor}"/>`;
        }
      }
    });

    if (stats.lost > 0) {
      const lastNearBase = n > 0 && ptY(pts[n - 1]) > baseY - 20;
      const lblX = lastNearBase ? Math.min(contentW - GRAPH_PADR - 6, xAt(n - 1) - 8) : contentW - GRAPH_PADR - 2;
      svg += `<text class="ping-no-reply-label" x="${f(lblX)}" y="${f(baseY - 6)}" text-anchor="end" font-size="9" font-weight="600" fill="var(--accent-danger)">no reply</text>`;
    }

    const labelSteps = [1, 2, 5, 10, 20, 50, 100, 200, 500];
    let every = 500;
    for (let k = 0; k < labelSteps.length; k++) {
      if (labelSteps[k] * step >= 56) { every = labelSteps[k]; break; }
    }
    if (n === 1) every = 1;
    pts.forEach((p, i) => {
      if (p.seq % every !== 0 && i !== 0) return;
      if (i === 0 && n > 1 && p.seq % every !== 0 && step * every < 120) {
        // skip an odd first label when it would crowd the next one
        const nextLabelled = pts.findIndex((q, j) => j > 0 && q.seq % every === 0);
        if (nextLabelled !== -1 && (nextLabelled * step) < 40) return;
      }
      const x = xAt(i);
      const anchor = x < 14 ? 'start' : 'middle';
      svg += `<text x="${f(x)}" y="${GRAPH_H - 6}" text-anchor="${anchor}" font-size="9" fill="var(--text-muted)">#${p.seq}</text>`;
    });

    let selIdx = -1;
    if (graphSelectedSeq !== null) selIdx = pts.findIndex((p) => p.seq === graphSelectedSeq);
    if (selIdx >= 0) {
      const sx = f(xAt(selIdx));
      const sy = f(ptY(pts[selIdx]));
      const sColor = pts[selIdx].ms !== null ? okColor : 'var(--accent-danger)';
      svg += `<line x1="${sx}" y1="${GRAPH_T}" x2="${sx}" y2="${GRAPH_T + plotH}" stroke="var(--text-secondary)" stroke-width="1" stroke-dasharray="2 2"/>`;
      svg += `<circle class="ping-sel-highlight" cx="${sx}" cy="${sy}" r="4.5" fill="none" stroke="${sColor}" stroke-width="2"/>`;
    }

    graphSvg.setAttribute('width', String(contentW));
    graphSvg.innerHTML = svg;
    graphSvg.setAttribute('aria-label', `Ping latency graph, ${n} probes, ${stats.lost} without reply`);

    let legend = `<span><span class="lg-dot" style="background:${okColor}"></span>Reply</span><span><span class="lg-dot" style="background:var(--accent-danger)"></span>Red = no reply</span>`;
    if (stats.avg !== null) legend += `<span>Avg ${graphFmt(stats.avg)} ms</span>`;
    if (selIdx >= 0) {
      legend += `<span class="rd">#${pts[selIdx].seq} · ${pts[selIdx].ms !== null ? graphFmt(pts[selIdx].ms) + ' ms' : 'no reply'}</span>`;
    } else if (scrollable) {
      legend += '<span>Swipe sideways for earlier probes, tap a point for its value</span>';
    } else if (n > 1) {
      legend += '<span>Tap a point for its value</span>';
    }
    graphLegend.innerHTML = legend;

    if (graphFollow || wasAtEnd) {
      graphScroll.scrollLeft = graphScroll.scrollWidth;
    }
  }

  function scheduleGraph() {
    if (viewMode !== 'graph' || graphTimer) return;
    graphTimer = setTimeout(() => {
      graphTimer = null;
      renderGraph();
    }, 60);
  }

  function setPingView(mode) {
    viewMode = mode === 'graph' ? 'graph' : 'list';
    const isGraph = viewMode === 'graph';
    if (tableContainer) tableContainer.style.display = isGraph ? 'none' : '';
    if (graphWrap) graphWrap.style.display = isGraph ? 'block' : 'none';
    if (btnViewList) {
      btnViewList.classList.toggle('active', !isGraph);
      btnViewList.setAttribute('aria-pressed', isGraph ? 'false' : 'true');
    }
    if (btnViewGraph) {
      btnViewGraph.classList.toggle('active', isGraph);
      btnViewGraph.setAttribute('aria-pressed', isGraph ? 'true' : 'false');
    }
    if (isGraph) {
      graphFollow = true;
      renderGraph();
    } else {
      lastLoggedPingGraphKey = 'list';
    }
  }

  if (graphScroll) {
    graphScroll.addEventListener('scroll', () => {
      graphFollow = graphScroll.scrollWidth - graphScroll.scrollLeft - graphScroll.clientWidth < 12;
    });
  }
  if (graphSvg) {
    graphSvg.addEventListener('click', (e) => {
      const n = graphData.length;
      if (n === 0) return;
      const rect = graphSvg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const innerW = (graphScroll.clientWidth || 250) - GRAPH_PADL - GRAPH_PADR;
      const step = n > 1 ? Math.max(GRAPH_STEP_MIN, innerW / (n - 1)) : 0;
      let idx = n > 1 ? Math.round((x - GRAPH_PADL) / step) : 0;
      if (idx < 0) idx = 0;
      if (idx > n - 1) idx = n - 1;
      const seq = graphData[idx].seq;
      graphSelectedSeq = (graphSelectedSeq === seq) ? null : seq;
      if (window.APP_DEBUG_ENABLED && graphSelectedSeq !== null) {
        pingLog(`graph: select seq=${graphSelectedSeq}`);
      }
      renderGraph(true);
    });
  }

  // --- Share the graph as an image (used by Share while the Graph view is selected) ---
  function buildGraphShareSvg() {
    const W = 1080, H = 720;
    const padL = 80, padR = 40, top = 220, bottom = 100;
    const plotW = W - padL - padR;
    const plotH = H - top - bottom;
    const baseY = top + plotH;
    const pts = graphData;
    const n = pts.length;
    const stats = graphStats(pts);
    const maxY = graphNiceMax(stats.maxMs);
    const f = (v) => (Math.round(v * 10) / 10).toString();
    const xAt = (i) => padL + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
    const yAt = (ms) => top + plotH - (ms / maxY) * plotH;
    const ptY = (p) => (p.ms === null ? baseY : yAt(p.ms));
    const INK = '#1e293b', MUTED = '#64748b', GRID = '#e2e8f0', ACC = '#4f46e5', BAD = '#ef4444', AVG = '#0ea5e9';

    let header = lastPingHeader || `Ping ${input.value.trim()}`.trim();
    if (header.length > 40) header = header.slice(0, 39) + '…';
    const sum = lastPingSummary || (statusLine ? statusLine.textContent : '') || '';
    const cut = sum.indexOf(' · min ');
    const line1 = cut >= 0 ? sum.slice(0, cut) : sum;
    const line2 = cut >= 0 ? 'min ' + sum.slice(cut + 7) : '';

    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system, Roboto, Helvetica, Arial, sans-serif">`;
    s += `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
    s += `<text x="${W - padR}" y="40" text-anchor="end" font-size="30" font-weight="700" fill="${ACC}">iSubnet</text>`;
    s += `<text x="${padL}" y="76" font-size="40" font-weight="700" fill="${INK}">${escapeHTML(header)}</text>`;
    s += `<text x="${padL}" y="124" font-size="27" fill="${MUTED}">${escapeHTML(line1)}</text>`;
    if (line2) s += `<text x="${padL}" y="164" font-size="27" fill="${MUTED}">${escapeHTML(line2)}</text>`;

    [0, 0.5, 1].forEach((frac) => {
      const gy = top + plotH - frac * plotH;
      s += `<line x1="${padL}" y1="${f(gy)}" x2="${W - padR}" y2="${f(gy)}" stroke="${GRID}" stroke-width="2"/>`;
      s += `<text x="${padL - 10}" y="${f(gy + 8)}" text-anchor="end" font-size="22" fill="${MUTED}">${graphFmt(maxY * frac)}</text>`;
    });
    s += `<text x="${padL - 10}" y="${top - 18}" text-anchor="end" font-size="20" fill="${MUTED}">ms</text>`;

    if (stats.avg !== null && stats.okCount > 1) {
      s += `<line x1="${padL}" y1="${f(yAt(stats.avg))}" x2="${W - padR}" y2="${f(yAt(stats.avg))}" stroke="${AVG}" stroke-width="2.5" stroke-dasharray="10 8"/>`;
    }

    const strokeW = n > 200 ? 2.5 : 4.5;
    let okPath = '';
    let badPath = '';
    for (let i = 0; i < n - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const segCmd = `M${f(xAt(i))} ${f(ptY(p1))}L${f(xAt(i + 1))} ${f(ptY(p2))}`;
      if (p1.ms === null || p2.ms === null) {
        badPath += segCmd;
      } else {
        okPath += segCmd;
      }
    }
    if (okPath) {
      s += `<path class="ping-seg-ok" d="${okPath}" fill="none" stroke="${ACC}" stroke-width="${strokeW}" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    if (badPath) {
      s += `<path class="ping-seg-bad" d="${badPath}" fill="none" stroke="${BAD}" stroke-width="${strokeW}" stroke-linejoin="round" stroke-linecap="round"/>`;
    }

    pts.forEach((p, i) => {
      if (p.ms === null) {
        const prevBad = i > 0 && pts[i - 1].ms === null;
        const nextBad = i < n - 1 && pts[i + 1].ms === null;
        if (n <= 40 || (!prevBad && !nextBad && n <= 300)) {
          s += `<circle class="ping-dot-bad" cx="${f(xAt(i))}" cy="${f(baseY)}" r="7" fill="${BAD}"/>`;
        }
      } else {
        const prevOk = i > 0 && pts[i - 1].ms !== null;
        const nextOk = i < n - 1 && pts[i + 1].ms !== null;
        if (n <= 40 || (!prevOk && !nextOk && n <= 300)) {
          s += `<circle class="ping-dot-ok" cx="${f(xAt(i))}" cy="${f(yAt(p.ms))}" r="7" fill="${ACC}"/>`;
        }
      }
    });

    if (stats.lost > 0) {
      const lastNearBase = n > 0 && ptY(pts[n - 1]) > baseY - 40;
      const lblX = lastNearBase ? Math.min(W - padR - 14, xAt(n - 1) - 18) : W - padR - 4;
      s += `<text class="ping-no-reply-label" x="${f(lblX)}" y="${f(baseY - 14)}" text-anchor="end" font-size="22" font-weight="600" fill="${BAD}">no reply</text>`;
    }

    s += `<text x="${padL}" y="${top + plotH + 44}" text-anchor="start" font-size="22" fill="${MUTED}">#${pts[0].seq}</text>`;
    if (n > 1) s += `<text x="${W - padR}" y="${top + plotH + 44}" text-anchor="end" font-size="22" fill="${MUTED}">#${pts[n - 1].seq}</text>`;
    if (!isProNow()) s += `<text x="${padL}" y="${H - 22}" font-size="22" fill="${MUTED}">Calculated with iSubnet</text>`;
    s += '</svg>';
    return s;
  }

  function svgToPngBase64(svgStr, w, h) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png').split(',')[1]);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('graph image render failed'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    });
  }

  async function sharePingGraph() {
    if (graphData.length === 0) return false;
    const hasSharePlugins = !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem && window.Capacitor.Plugins.Share);
    const isNativeShare = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    if (!isNativeShare && !hasSharePlugins) return false;
    if (window.APP_DEBUG_ENABLED) pingLog('graph: share start');
    try {
      const png = await svgToPngBase64(buildGraphShareSvg(), 1080, 720);
      const { Filesystem, Share } = window.Capacitor.Plugins;
      const written = await Filesystem.writeFile({ path: 'isubnet_ping_graph.png', data: png, directory: 'CACHE' });
      try {
        await Share.share({ title: 'Ping Graph', url: written.uri });
      } catch (e) {
        // Same Android Share-plugin quirk as shareText(): the promise can reject even after a real share.
        console.error('Capacitor Share (graph) failed/rejected:', e);
      }
      if (window.APP_DEBUG_ENABLED) pingLog('graph: share ok');
      return true;
    } catch (e) {
      if (window.APP_DEBUG_ENABLED) pingLog(`share graph failed: ${e && e.message ? e.message : e}`);
      return false;
    }
  }

  function isProNow() {
    return typeof PRO_UNLOCKED !== 'undefined' && PRO_UNLOCKED === true;
  }

  const optionsLabel = proBadge ? proBadge.closest('.ping-options-label') : document.querySelector('.ping-options-label');

  function updatePingControls() {
    const isPro = isProNow();
    const showBadge = !isPro && isNative;
    if (proBadge) {
      proBadge.style.display = showBadge ? 'inline-block' : 'none';
    }
    if (optionsLabel) {
      if (isPro) {
        optionsLabel.setAttribute('for', 'ping-count-input');
      } else {
        optionsLabel.removeAttribute('for');
      }
    }
    setProLabelInteractivity(optionsLabel, proBadge, showBadge);
    if (!isPro) {
      if (countInput) {
        countInput.value = '5';
        countInput.readOnly = true;
      }
      continuousOn = false;
    } else {
      if (countInput) {
        countInput.readOnly = false;
      }
    }
    if (continuousBtn) {
      continuousBtn.classList.toggle('active', continuousOn);
      continuousBtn.setAttribute('aria-pressed', continuousOn ? 'true' : 'false');
      continuousBtn.disabled = (!isNative) || isRunning;
    }
    if (countInput) {
      countInput.disabled = (!isNative) || isRunning || continuousOn;
    }
  }
  window.updatePingControls = updatePingControls;
  updatePingControls();

  if (optionsLabel) {
    const onPingProLabelActivate = (e) => {
      if (isProNow() || !isNative) return;
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if (e.cancelable) e.preventDefault();
      if (window.APP_DEBUG_ENABLED) pingLog('ui: pro label tap');
      showProModal('ping');
    };
    optionsLabel.addEventListener('click', onPingProLabelActivate);
    optionsLabel.addEventListener('keydown', onPingProLabelActivate);
  }

  if (countInput) {
    const onCountInteract = (e) => {
      if (!isProNow() && isNative) {
        if (e.cancelable) e.preventDefault();
        countInput.blur();
        showProModal('ping');
      }
    };
    countInput.addEventListener('pointerdown', onCountInteract);
    countInput.addEventListener('focus', onCountInteract);
    countInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runPing();
    });
  }

  if (continuousBtn) {
    continuousBtn.addEventListener('click', () => {
      if (!isNative || isRunning) return;
      if (!isProNow()) {
        showProModal('ping');
        return;
      }
      continuousOn = !continuousOn;
      updatePingControls();
    });
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
    resultsCard.style.display = 'none';
  }

  function hideError() {
    errorMsg.style.display = 'none';
  }

  async function runPing() {
    if (isRunning) {
      stopReason = 'user';
      if (window.APP_DEBUG_ENABLED) pingLog('ui: stop tap');
      if (P && typeof P.stop === 'function') {
        try { await P.stop(); } catch (e) { /* ignore */ }
      }
      return;
    }

    hideError();

    let rawVal = input.value;
    let val = rawVal.trim().replace(/\.+$/, '');
    if (!val) {
      showError('Please enter a hostname or IP address.');
      return;
    }
    if (val.startsWith('-') || /\s/.test(val)) {
      showError('Invalid hostname or IP address.');
      return;
    }

    let wasUrl = false;
    let hadPath = false;
    if (val.startsWith('http://') || val.startsWith('https://')) wasUrl = true;
    if (val.includes('/')) hadPath = true;

    try {
      if (wasUrl) {
        val = new URL(val).hostname;
      } else if (hadPath) {
        val = new URL('http://' + val).hostname;
      } else {
        try {
          const urlObj = new URL('http://' + val);
          val = urlObj.hostname;
        } catch (e) {
          val = val.toLowerCase();
        }
      }
    } catch (e) {
      val = val.toLowerCase();
    }

    val = val.replace(/^\[|\]$/g, '');
    if (!val || val.startsWith('-') || /\s/.test(val)) {
      showError('Invalid hostname or IP address.');
      return;
    }

    let countToSend = 5;
    if (isProNow() && continuousOn) {
      runContinuous = true;
      countToSend = 4;
    } else if (isProNow() && !continuousOn) {
      const trimmedCount = (countInput ? countInput.value : '').trim();
      if (!/^\d{1,3}$/.test(trimmedCount)) {
        showError('Probe count must be a whole number from 1 to 100.');
        return;
      }
      const num = parseInt(trimmedCount, 10);
      if (num < 1 || num > 100) {
        showError('Probe count must be a whole number from 1 to 100.');
        return;
      }
      runContinuous = false;
      countToSend = num;
    } else {
      runContinuous = false;
      countToSend = 5;
      if (countInput) countInput.value = '5';
    }
    newestFirst = runContinuous || countToSend > 10;

    if (!P) {
      if (cap && cap.Plugins && cap.Plugins.Ping) {
        P = cap.Plugins.Ping;
        lookupPath = 'Plugins.Ping';
      } else if (cap && typeof cap.registerPlugin === 'function') {
        try {
          P = cap.registerPlugin('Ping');
          if (P) lookupPath = 'registerPlugin';
        } catch (e) {
          lookupPath = 'registerPlugin_failed';
        }
      }
    }

    if (!P) {
      showError("Ping isn't available on this device yet.");
      return;
    }

    if (window.APP_DEBUG_ENABLED) {
      pingLog(`ui: start | online=${navigator.onLine} | inputLength=${rawVal.length}`);
    }

    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.FirebaseCrashlytics) {
      window.Capacitor.Plugins.FirebaseCrashlytics.setCustomKey({ key: 'last_calc_action', value: 'pingRun', type: 'string' }).catch(() => {});
    }

    // Close the keyboard when a run starts (the number pad has no Return/Done key).
    try {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl === input || activeEl === countInput)) activeEl.blur();
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Keyboard && typeof window.Capacitor.Plugins.Keyboard.hide === 'function') {
        Promise.resolve(window.Capacitor.Plugins.Keyboard.hide()).catch(() => {});
      }
    } catch (e) { /* ignore */ }

    isRunning = true;
    stopReason = null;
    const runStartMs = performance.now();
    let prevProbeIsReply = null;
    updatePingControls();
    btnRun.textContent = 'Stop';
    resultsCard.style.display = 'block';
    statusLine.textContent = 'Pinging...';
    tbody.innerHTML = '';
    rowsData = [];
    lastPingResultText = '';
    lastPingNoteTitle = '';
    liveSent = 0;
    liveReceived = 0;
    liveTimeouts = 0;
    liveSum = 0;
    liveMin = null;
    liveMax = null;
    droppedRows = 0;
    resetPingGraph();

    let outcome = 'ok';
    if (window.APP_DEBUG_ENABLED) {
      pingLog(`ui: params | count=${countToSend} | continuous=${runContinuous} | newestFirst=${newestFirst} | pro=${isProNow()}`);
    }

    try {
      if (typeof P.addListener === 'function') {
        probeListener = await P.addListener('probe', (probe) => {
          liveSent++;
          const isReply = (probe.outcome === 'REPLY' && typeof probe.timeMs === 'number');
          if (isReply) {
            liveReceived++;
            liveSum += probe.timeMs;
            if (liveMin === null || probe.timeMs < liveMin) liveMin = probe.timeMs;
            if (liveMax === null || probe.timeMs > liveMax) liveMax = probe.timeMs;
          } else {
            liveTimeouts++;
          }

          if (window.APP_DEBUG_ENABLED) {
            const stateChanged = (prevProbeIsReply !== null && isReply !== prevProbeIsReply);
            if (!runContinuous || liveSent <= 20 || stateChanged) {
              const outVal = probe.outcome || 'ERROR';
              const msVal = (probe.timeMs !== null && probe.timeMs !== undefined) ? probe.timeMs : '-';
              const ttlVal = (probe.ttl !== null && probe.ttl !== undefined) ? probe.ttl : '-';
              pingLog(`probe: seq=${probe.seq} | outcome=${outVal} | ms=${msVal} | ttl=${ttlVal}`);
            }
            if (runContinuous && liveSent > 20 && liveSent % 25 === 0) {
              pingLog(`probes so far: ${liveSent} | replies=${liveReceived} | timeouts=${liveTimeouts}`);
            }
          }
          prevProbeIsReply = isReply;

          const loss = Math.round(((liveSent - liveReceived) / liveSent) * 100);
          let liveText = `Pinging... · ${liveSent} sent · ${liveReceived} received · ${loss}% loss`;
          if (liveReceived > 0) {
            const avg = Math.round((liveSum / liveReceived) * 10) / 10;
            liveText += ` · min ${liveMin} / avg ${avg} / max ${liveMax} ms`;
          }
          statusLine.textContent = liveText;

          let replyText = '';
          if (probe.outcome === 'REPLY') {
            const addr = probe.resolvedAddress || val;
            replyText = `Reply from ${addr}`;
          } else if (probe.outcome === 'TIMEOUT') {
            replyText = 'Request timed out';
          } else if (probe.outcome === 'UNREACHABLE') {
            replyText = 'Destination unreachable';
          } else if (probe.outcome === 'UNKNOWN_HOST') {
            replyText = 'Unknown host';
          } else {
            replyText = `Error: ${probe.message || 'Ping failed'}`;
          }

          const timeText = (probe.timeMs !== null && probe.timeMs !== undefined) ? `${probe.timeMs} ms` : '—';
          const ttlText = (probe.ttl !== null && probe.ttl !== undefined) ? String(probe.ttl) : '—';

          graphData.push({ seq: probe.seq, ms: isReply ? probe.timeMs : null });
          if (graphData.length > GRAPH_MAX_POINTS) graphData.shift();
          scheduleGraph();

          const rowObj = { seq: probe.seq, reply: replyText, time: timeText, ttl: ttlText };
          // rowsData is always kept in probe order (probe 1 first); screen order in tbody is separate.
          rowsData.push(rowObj);

          const replyColor = (probe.outcome === 'REPLY') ? 'var(--accent-success)' : 'var(--accent-danger)';
          const timeColor = (timeText !== '—') ? 'var(--accent-primary)' : 'var(--text-muted)';

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${escapeHTML(String(probe.seq))}</td>
            <td style="word-break: break-all; color: ${replyColor};">${escapeHTML(replyText)}</td>
            <td style="color: ${timeColor};">${escapeHTML(timeText)}</td>
            <td style="color: var(--text-muted);">${escapeHTML(ttlText)}</td>
          `;

          if (newestFirst) {
            tbody.insertBefore(tr, tbody.firstChild);
          } else {
            tbody.appendChild(tr);
          }

          if (runContinuous && tbody.children.length > 1500) {
            tbody.removeChild(tbody.lastChild);
            rowsData.shift();
            if (droppedRows === 0 && window.APP_DEBUG_ENABLED) {
              pingLog('rows: cap reached, dropping oldest');
            }
            droppedRows++;
          }
        });
      }

      const res = await P.ping({ host: val, count: countToSend, timeoutMs: 3000, continuous: runContinuous });
      outcome = res.cancelled ? 'cancelled' : 'ok';

      const sent = res.sent || 0;
      const received = res.received || 0;
      const loss = (res.lossPercent !== null && res.lossPercent !== undefined) ? res.lossPercent : (sent > 0 ? Math.round(((sent - received) / sent) * 100) : 0);

      let summary = `${sent} sent · ${received} received · ${loss}% loss`;
      if (received > 0 && res.minMs !== null && res.minMs !== undefined && res.avgMs !== null && res.avgMs !== undefined && res.maxMs !== null && res.maxMs !== undefined) {
        summary += ` · min ${res.minMs} / avg ${res.avgMs} / max ${res.maxMs} ms`;
      }
      statusLine.textContent = summary;

      const hostHdr = `Ping ${val}${res.resolvedAddress ? ` (${res.resolvedAddress})` : ''}`;
      let extraHdr = '';
      if (newestFirst) {
        extraHdr = runContinuous ? '\nContinuous (-t)' : '';
      }
      if (droppedRows > 0) {
        extraHdr += `\nShowing the latest 1500 of ${liveSent} probes`;
      }
      lastPingResultText = `${hostHdr}${extraHdr}\n${summary}\n\n#\tReply\tTime\tTTL\n` + rowsData.map(r => `${r.seq}\t${r.reply}\t${r.time}\t${r.ttl}`).join('\n') + '\n';
      lastPingNoteTitle = `Ping: ${val}`;
      lastPingHeader = hostHdr;
      lastPingSummary = summary;

      if (window.APP_DEBUG_ENABLED) {
        const elapsedMs = Math.round(performance.now() - runStartMs);
        const stoppedBy = stopReason || (res.cancelled ? 'user' : 'normal');
        pingLog(`result: sent=${sent} | received=${received} | loss=${loss}% | cancelled=${!!res.cancelled} | stopped=${stoppedBy} | ms=${elapsedMs}`);
      }

    } catch (err) {
      outcome = 'error';
      showError(err.message || 'Ping failed');
    } finally {
      if (probeListener && typeof probeListener.remove === 'function') {
        try { await probeListener.remove(); } catch (e) { /* ignore */ }
        probeListener = null;
      }
      isRunning = false;
      btnRun.textContent = 'Ping';
      updatePingControls();
      if (window.APP_DEBUG_ENABLED) {
        const finalStoppedBy = stopReason || (outcome === 'cancelled' ? 'user' : (outcome === 'ok' ? 'normal' : 'error'));
        pingLog(`outcome: ${outcome} | stopped=${finalStoppedBy} | ms=${Math.round(performance.now() - runStartMs)}`);
      }
      if (viewMode === 'graph') renderGraph();
    }
  }

  btnRun.addEventListener('click', runPing);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runPing();
  });

  btnClear.addEventListener('click', async () => {
    if (window.APP_DEBUG_ENABLED) pingLog('ui: clear tap');
    if (isRunning && P && typeof P.stop === 'function') {
      stopReason = 'user';
      try { await P.stop(); } catch (e) { /* ignore */ }
    }
    input.value = '';
    hideError();
    resultsCard.style.display = 'none';
    lastPingResultText = '';
    lastPingNoteTitle = '';
    tbody.innerHTML = '';
    rowsData = [];
    resetPingGraph();
  });

  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      if (window.APP_DEBUG_ENABLED) pingLog('ui: copy tap');
      if (lastPingResultText && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(lastPingResultText)
          .then(() => {
            if (window.APP_DEBUG_ENABLED) pingLog('ui: copy success');
            if (typeof showToast === 'function') showToast('Ping results copied!');
          })
          .catch(() => {
            if (typeof showToast === 'function') showToast('Copy failed');
          });
      }
    });
  }

  if (btnShare) {
    btnShare.addEventListener('click', async () => {
      if (isShareTapDuplicate('ping')) {
        if (window.APP_DEBUG_ENABLED) pingLog('ui: share tap ignored | reason=double-tap');
        return;
      }
      if (window.APP_DEBUG_ENABLED) pingLog('ui: share tap');
      if (viewMode === 'graph' && graphData.length > 0) {
        const sharedGraph = await sharePingGraph();
        if (sharedGraph) return;
      }
      if (lastPingResultText && typeof shareText === 'function') {
        shareText('Ping Results', lastPingResultText, true);
      }
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      if (window.APP_DEBUG_ENABLED) pingLog('ui: save tap');
      if (!lastPingResultText || typeof addNote !== 'function') return;
      addNote(lastPingNoteTitle || 'Ping', lastPingResultText, 'Ping');
      if (typeof maybeRequestReview === 'function') maybeRequestReview('save_note');
      if (typeof switchToNotesTab === 'function') switchToNotesTab();
    });
  }

  if (btnViewList) {
    btnViewList.addEventListener('click', () => {
      if (window.APP_DEBUG_ENABLED) pingLog('ui: view list');
      setPingView('list');
    });
  }
  if (btnViewGraph) {
    btnViewGraph.addEventListener('click', () => {
      if (window.APP_DEBUG_ENABLED) pingLog('ui: view graph');
      setPingView('graph');
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && viewMode === 'graph') renderGraph();
  });

  // On iOS the app is suspended in the background, so a running ping is stopped there.
  // On Android a foreground service keeps it running (see PingForegroundService.java).
  const stopOnBackground = !!(window.Capacitor && typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() === 'ios');

  document.addEventListener('visibilitychange', () => {
    if (stopOnBackground && document.visibilityState === 'hidden' && isRunning && P && typeof P.stop === 'function') {
      stopReason = 'background';
      if (window.APP_DEBUG_ENABLED) pingLog('stop: app hidden');
      try { Promise.resolve(P.stop()).catch(() => {}); } catch (e) { /* ignore */ }
    }
  });

  try {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App && typeof window.Capacitor.Plugins.App.addListener === 'function') {
      window.Capacitor.Plugins.App.addListener('appStateChange', (state) => {
        try {
          if (stopOnBackground && state && state.isActive === false && isRunning && P && typeof P.stop === 'function') {
            stopReason = 'background';
            if (window.APP_DEBUG_ENABLED) pingLog('stop: app hidden');
            try { Promise.resolve(P.stop()).catch(() => {}); } catch (e) { /* ignore */ }
          }
        } catch (e) { /* ignore */ }
      });
    }
  } catch (e) { /* ignore */ }
})();

// --- FIELD CLEAR BUTTONS ---
// Every button with class "btn-clear-field" and data-clear-for="<input id>" erases that field and lets the
// normal input handlers recalculate (the same as deleting the text by hand).
(function initClearButtons() {
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('.btn-clear-field') : null;
    if (!btn) return;
    const id = btn.getAttribute('data-clear-for');
    const el = id ? document.getElementById(id) : null;
    if (!el) return;
    el.value = '';
    el.classList.remove('error');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    const locked = el.getAttribute('data-pro') === 'true' && typeof PRO_UNLOCKED !== 'undefined' && !PRO_UNLOCKED;
    if (!locked) {
      try { el.focus(); } catch (err) { /* ignore */ }
    }
  });
})();

// --- TRACEROUTE TOOL ---
(function initTracerouteTool() {
  const input = document.getElementById('trace-input');
  const btnRun = document.getElementById('btn-trace-run');
  const btnClear = document.getElementById('btn-trace-clear');
  const resultsCard = document.getElementById('trace-results-card');
  const statusLine = document.getElementById('trace-status-line');
  const tbody = document.getElementById('trace-results-tbody');
  const errorMsg = document.getElementById('trace-error-msg');
  const platformNote = document.getElementById('trace-platform-note');
  const btnCopy = document.getElementById('btn-trace-copy');
  const btnSave = document.getElementById('btn-trace-save');
  const btnShare = document.getElementById('btn-trace-share');
  const hopsInput = document.getElementById('trace-hops-input');
  const probesInput = document.getElementById('trace-probes-input');
  const timeoutInput = document.getElementById('trace-timeout-input');
  const resolveBtn = document.getElementById('btn-trace-resolve');
  const proBadge = document.getElementById('trace-pro-badge');
  const btnViewList = document.getElementById('btn-trace-view-list');
  const btnViewGraph = document.getElementById('btn-trace-view-graph');
  const graphWrap = document.getElementById('trace-graph-wrap');
  const graphYAxis = document.getElementById('trace-graph-yaxis');
  const graphScroll = document.getElementById('trace-graph-scroll');
  const graphSvg = document.getElementById('trace-graph-svg');
  const graphDetail = document.getElementById('trace-graph-detail');
  const graphLegend = document.getElementById('trace-graph-legend');
  const graphHint = document.getElementById('trace-graph-hint');
  const tableContainer = resultsCard ? resultsCard.querySelector('.table-container') : null;

  if (!input || !btnRun || !btnClear || !resultsCard || !statusLine || !tbody || !errorMsg) {
    return;
  }

  const DEFAULT_HOPS = 30;
  const DEFAULT_PROBES = 3;
  const DEFAULT_TIMEOUT_S = 2;
  const MAX_HOPS = 64;
  const MAX_PROBES = 5;
  const MAX_TIMEOUT_S = 5;
  const GRAPH_H = 130;
  const GRAPH_T = 14;
  const GRAPH_B = 20;
  const GRAPH_PADL = 16;
  const GRAPH_PADR = 16;
  const GRAPH_STEP_MIN = 28;

  function traceLog(msg) {
    if (window.APP_DEBUG_ENABLED && typeof window.debugLog === 'function') window.debugLog(`[Traceroute] ${msg}`);
  }

  const cap = window.Capacitor;
  const platform = cap && cap.getPlatform ? cap.getPlatform() : 'web';
  const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());

  function findPlugin() {
    if (cap && cap.Plugins && cap.Plugins.Traceroute) return { plugin: cap.Plugins.Traceroute, path: 'Plugins.Traceroute' };
    if (cap && typeof cap.registerPlugin === 'function') {
      try {
        const p = cap.registerPlugin('Traceroute');
        if (p) return { plugin: p, path: 'registerPlugin' };
      } catch (e) {
        return { plugin: null, path: 'registerPlugin_failed' };
      }
    }
    return { plugin: null, path: 'none' };
  }

  let P = null;
  {
    const found = findPlugin();
    P = found.plugin;
    if (window.APP_DEBUG_ENABLED) traceLog(`init: platform=${platform} | isNative=${isNative} | pluginFound=${!!P} | path=${found.path}`);
  }

  if (!isNative) {
    btnRun.disabled = true;
    if (platformNote) platformNote.style.display = 'block';
  }

  let isRunning = false;
  let listeners = [];
  let hops = [];            // [{ ttl, probes: [{outcome, address, timeMs}], tr }]
  let names = {};           // address -> host name
  let runHost = '';
  let runResolved = '';
  let runMaxHops = DEFAULT_HOPS;
  let runProbes = DEFAULT_PROBES;
  let lastSummary = '';
  let lastTraceText = '';
  let lastTraceTitle = '';
  let resolveOn = false;
  let wasPro = false;
  let newestFirst = false;
  let runReached = false;
  let viewMode = 'list';
  let graphTimer = null;
  let graphFollow = true;
  let selectedTtl = null;
  let lastLoggedTraceGraphKey = '';
  let dnsTimers = [];

  function isProNow() {
    return typeof PRO_UNLOCKED !== 'undefined' && PRO_UNLOCKED === true;
  }

  function updateTraceControls() {
    const isPro = isProNow();
    const optionsHead = proBadge ? proBadge.closest('.trace-options-head') : document.querySelector('.trace-options-head');
    const showBadge = !isPro && isNative;
    if (proBadge) proBadge.style.display = showBadge ? 'inline-block' : 'none';
    setProLabelInteractivity(optionsHead, proBadge, showBadge);
    if (!isPro) {
      if (hopsInput) { hopsInput.value = String(DEFAULT_HOPS); hopsInput.readOnly = true; }
      if (probesInput) { probesInput.value = String(DEFAULT_PROBES); probesInput.readOnly = true; }
      if (timeoutInput) { timeoutInput.value = String(DEFAULT_TIMEOUT_S); timeoutInput.readOnly = true; }
      resolveOn = false;
    } else {
      if (hopsInput) hopsInput.readOnly = false;
      if (probesInput) probesInput.readOnly = false;
      if (timeoutInput) timeoutInput.readOnly = false;
      if (!wasPro) resolveOn = true;
    }
    wasPro = isPro;
    if (resolveBtn) {
      resolveBtn.textContent = resolveOn ? 'On' : 'Off';
      resolveBtn.classList.toggle('active', resolveOn);
      resolveBtn.setAttribute('aria-pressed', resolveOn ? 'true' : 'false');
      resolveBtn.disabled = (!isNative) || isRunning;
    }
    [hopsInput, probesInput, timeoutInput].forEach((el) => {
      if (el) el.disabled = (!isNative) || isRunning;
    });
  }
  window.updateTraceControls = updateTraceControls;
  updateTraceControls();

  const traceOptionsHead = proBadge ? proBadge.closest('.trace-options-head') : document.querySelector('.trace-options-head');
  if (traceOptionsHead) {
    const onTraceProLabelActivate = (e) => {
      if (isProNow() || !isNative) return;
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if (e.cancelable) e.preventDefault();
      if (window.APP_DEBUG_ENABLED) traceLog('ui: pro label tap');
      showProModal('traceroute');
    };
    traceOptionsHead.addEventListener('click', onTraceProLabelActivate);
    traceOptionsHead.addEventListener('keydown', onTraceProLabelActivate);
  }

  function onOptionInteract(e) {
    if (!isProNow() && isNative) {
      if (e.cancelable) e.preventDefault();
      if (e.target && typeof e.target.blur === 'function') e.target.blur();
      showProModal('traceroute');
    }
  }
  [hopsInput, probesInput, timeoutInput].forEach((el) => {
    if (!el) return;
    el.addEventListener('pointerdown', onOptionInteract);
    el.addEventListener('focus', onOptionInteract);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runTrace();
    });
    el.addEventListener('input', () => {
      el.value = el.value.replace(/\D/g, '');
    });
  });

  if (resolveBtn) {
    resolveBtn.addEventListener('click', () => {
      if (!isNative || isRunning) return;
      if (!isProNow()) {
        showProModal('traceroute');
        return;
      }
      resolveOn = !resolveOn;
      updateTraceControls();
    });
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
    resultsCard.style.display = 'none';
  }

  function hideError() {
    errorMsg.style.display = 'none';
  }

  function fmtMs(v) {
    return String(Math.round(v * 10) / 10);
  }

  function removeListeners() {
    const old = listeners;
    listeners = [];
    const oldTimers = dnsTimers;
    dnsTimers = [];
    oldTimers.forEach((t) => clearTimeout(t));
    old.forEach((h) => {
      try {
        if (h && typeof h.remove === 'function') Promise.resolve(h.remove()).catch(() => {});
      } catch (e) { /* ignore */ }
    });
  }

  function hopAddresses(h) {
    const out = [];
    h.probes.forEach((p) => {
      if (p && p.address && out.indexOf(p.address) === -1) out.push(p.address);
    });
    return out;
  }

  function hopTimes(h) {
    const out = [];
    for (let i = 0; i < runProbes; i++) {
      const p = h.probes[i];
      if (!p) { out.push('…'); continue; }
      out.push((typeof p.timeMs === 'number') ? fmtMs(p.timeMs) : '*');
    }
    return out;
  }

  function hopAvg(h) {
    let sum = 0;
    let n = 0;
    h.probes.forEach((p) => {
      if (p && typeof p.timeMs === 'number') { sum += p.timeMs; n++; }
    });
    return n > 0 ? sum / n : null;
  }

  function hopDone(h) {
    return h.probes.filter(Boolean).length >= runProbes;
  }

  function hopHasOutcome(h, outcome) {
    return h.probes.some((p) => p && p.outcome === outcome);
  }

  function hopHostText(h) {
    const addrs = hopAddresses(h);
    if (addrs.length === 0) return hopDone(h) ? '*' : '…';
    return addrs.map((a) => (names[a] ? `${names[a]} (${a})` : a)).join(', ');
  }

  function hopStats(h) {
    const sent = h.probes.filter(Boolean).length;
    const times = [];
    h.probes.forEach((p) => {
      if (p && typeof p.timeMs === 'number') times.push(p.timeMs);
    });
    const ok = times.length;
    const lost = Math.max(0, sent - ok);
    const min = ok > 0 ? Math.min.apply(null, times) : null;
    const max = ok > 0 ? Math.max.apply(null, times) : null;
    const avg = ok > 0 ? times.reduce((a, b) => a + b, 0) / ok : null;
    const isDest = hopHasOutcome(h, 'REPLY') || (runReached && hops.length > 0 && h.ttl === hops[hops.length - 1].ttl && ok > 0);
    const isBad = hopHasOutcome(h, 'UNREACHABLE');
    return { sent: sent, ok: ok, lost: lost, min: min, max: max, avg: avg, isDest: isDest, isBad: isBad };
  }

  function traceGraphReplyColor() {
    let c = '';
    try { c = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim(); } catch (e) { c = ''; }
    let r, g, b;
    const hx = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(c);
    if (hx) {
      r = parseInt(hx[1], 16); g = parseInt(hx[2], 16); b = parseInt(hx[3], 16);
    } else {
      const q = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(c);
      if (!q) return 'var(--accent-primary)';
      r = +q[1]; g = +q[2]; b = +q[3];
    }
    const mx = Math.max(r, g, b);
    const d = mx - Math.min(r, g, b);
    if (d === 0 || mx === 0) return 'var(--accent-primary)';
    let h;
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    const sat = d / mx;
    const nearRed = (h <= 40 || h >= 330) && sat > 0.3 && mx > 90;
    return nearRed ? 'var(--accent-success)' : 'var(--accent-primary)';
  }

  function traceGraphNiceMax(maxMs) {
    const m = Math.max(1, maxMs || 1);
    const steps = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    for (let i = 0; i < steps.length; i++) {
      if (m <= steps[i] * 0.92) return steps[i];
    }
    return Math.ceil(m / 1000) * 1000;
  }

  function computeTraceJumpHintInfo() {
    if (isRunning) return null;
    const answered = [];
    for (let i = 0; i < hops.length; i++) {
      const s = hopStats(hops[i]);
      if (s.avg !== null) answered.push({ ttl: hops[i].ttl, avg: s.avg });
    }
    if (answered.length < 3) return null;
    let best = null;
    for (let k = 1; k < answered.length - 1; k++) {
      const prev = answered[k - 1];
      const curr = answered[k];
      const jump = curr.avg - prev.avg;
      if (jump < 30) continue;
      const threshold = prev.avg + 0.7 * jump;
      const later = answered.slice(k + 1);
      if (later.length >= 1 && later.every((x) => x.avg >= threshold)) {
        if (!best || jump > best.jump) {
          best = { ttl: curr.ttl, jump: jump };
        }
      }
    }
    if (!best) return null;
    const jumpMs = Math.max(30, Math.round(best.jump));
    return {
      ttl: best.ttl,
      jumpMs: jumpMs,
      text: `Latency jumps by about ${jumpMs} ms at hop ${best.ttl} and stays high on every later hop, so the extra delay starts there (a long link, tunnel or peering point).`
    };
  }

  function computeTraceJumpHint() {
    const info = computeTraceJumpHintInfo();
    return info ? info.text : null;
  }

  function resetTraceGraph() {
    if (graphTimer) {
      clearTimeout(graphTimer);
      graphTimer = null;
    }
    graphFollow = true;
    selectedTtl = null;
    lastLoggedTraceGraphKey = '';
    if (graphYAxis) graphYAxis.innerHTML = '';
    if (graphSvg) {
      graphSvg.innerHTML = '';
      graphSvg.removeAttribute('width');
    }
    if (graphDetail) {
      graphDetail.textContent = '';
      graphDetail.style.display = 'none';
    }
    if (graphLegend) graphLegend.textContent = '';
    if (graphHint) {
      graphHint.textContent = '';
      graphHint.style.display = 'none';
    }
  }

  function renderTraceHopDetail(h) {
    if (!graphDetail) return;
    graphDetail.textContent = '';
    if (!h) {
      graphDetail.style.display = 'none';
      return;
    }
    const s = hopStats(h);
    const totalProbes = Math.max(s.sent, hopDone(h) ? runProbes : s.sent, 1);
    const lossPct = Math.round((s.lost / totalProbes) * 100);

    const titleEl = document.createElement('div');
    titleEl.className = 'trace-graph-detail-title';
    const addrs = hopAddresses(h);
    const hostStr = addrs.length === 0
      ? (hopDone(h) ? '* (No reply)' : 'Probing…')
      : addrs.map((a) => (names[a] ? `${names[a]} (${a})` : a)).join(', ');
    titleEl.textContent = `Hop #${h.ttl} — ${hostStr}${s.isDest ? ' (Destination)' : ''}`;

    const metaEl = document.createElement('div');
    metaEl.className = 'trace-graph-detail-meta';
    if (s.ok > 0) {
      metaEl.textContent = `min ${fmtMs(s.min)} / avg ${fmtMs(s.avg)} / max ${fmtMs(s.max)} ms · ${lossPct}% loss (${s.lost}/${totalProbes} lost) · probes: ${hopTimes(h).join(' / ')}`;
    } else {
      metaEl.textContent = `${lossPct}% loss (${s.lost}/${totalProbes} lost) · no probes answered`;
    }

    graphDetail.appendChild(titleEl);
    graphDetail.appendChild(metaEl);
    graphDetail.style.display = 'block';
  }

  function renderTraceLegend(hasData, scrollable) {
    if (!graphLegend) return;
    graphLegend.textContent = '';
    if (!hasData) return;

    function addItem(dotClass, symbolText, symbolColor, labelText) {
      const span = document.createElement('span');
      if (dotClass) {
        const dot = document.createElement('span');
        dot.className = `lg-dot ${dotClass}`;
        span.appendChild(dot);
      } else if (symbolText) {
        const sym = document.createElement('span');
        sym.style.color = symbolColor || 'var(--accent-danger)';
        sym.style.fontWeight = '700';
        sym.style.marginRight = '4px';
        sym.textContent = symbolText;
        span.appendChild(sym);
      }
      span.appendChild(document.createTextNode(labelText));
      graphLegend.appendChild(span);
    }

    addItem('ok', null, null, 'Hop avg (min–max)');
    addItem('dest', null, null, 'Destination');
    addItem(null, '•', 'var(--accent-danger)', 'Partial loss');
    addItem(null, '✕', 'var(--accent-danger)', 'No reply');

    const tip = document.createElement('span');
    tip.textContent = scrollable ? 'Swipe sideways for more hops, tap a hop for details' : 'Tap a hop for details';
    graphLegend.appendChild(tip);
  }

  function renderTraceGraph(isSelectUpdate) {
    if (!graphSvg || !graphScroll || !graphYAxis) return;
    const n = hops.length;
    if (n === 0) {
      resetTraceGraph();
      return;
    }

    const wasAtEnd = graphScroll.scrollWidth - graphScroll.scrollLeft - graphScroll.clientWidth < 12;
    const pts = hops.map((h) => ({ h: h, ttl: h.ttl, s: hopStats(h) }));
    let maxMs = 0;
    pts.forEach((p) => {
      if (p.s.max !== null && p.s.max > maxMs) maxMs = p.s.max;
    });
    const maxY = traceGraphNiceMax(maxMs);
    const plotH = GRAPH_H - GRAPH_T - GRAPH_B;
    const f = (v) => (Math.round(v * 10) / 10).toString();
    const okColor = traceGraphReplyColor();

    const viewportW = Math.max(200, graphScroll.clientWidth || 260);
    const innerW = Math.max(40, viewportW - GRAPH_PADL - GRAPH_PADR);
    const slots = isRunning ? Math.max(n, 10) : n;
    const step = slots > 1 ? Math.max(GRAPH_STEP_MIN, innerW / (slots - 1)) : 0;
    const contentW = n > 1 || slots > 1 ? Math.max(viewportW, Math.round(GRAPH_PADL + step * (Math.max(n, 2) - 1) + GRAPH_PADR)) : viewportW;
    const scrollable = contentW > viewportW + 1;
    const xAt = (i) => (n <= 1 && slots <= 1 ? contentW / 2 : GRAPH_PADL + i * step);
    const yAt = (ms) => GRAPH_T + plotH - (ms / maxY) * plotH;

    let axis = '';
    [0, 0.5, 1].forEach((frac) => {
      const gy = GRAPH_T + plotH - frac * plotH;
      axis += `<text x="32" y="${f(gy + 3)}" text-anchor="end" font-size="9" fill="var(--text-muted)">${fmtMs(maxY * frac)}</text>`;
    });
    axis += `<text x="32" y="${GRAPH_T - 6}" text-anchor="end" font-size="8" fill="var(--text-muted)">ms</text>`;
    graphYAxis.innerHTML = axis;

    let svg = '';
    [0, 0.5, 1].forEach((frac) => {
      const gy = GRAPH_T + plotH - frac * plotH;
      svg += `<line x1="0" y1="${f(gy)}" x2="${contentW}" y2="${f(gy)}" stroke="var(--border-color)" stroke-width="1"/>`;
    });

    let bandRun = [];
    const flushBand = () => {
      if (bandRun.length >= 2) {
        const upper = bandRun.map((b) => `${f(b.x)},${f(b.yMax)}`);
        const lower = bandRun.slice().reverse().map((b) => `${f(b.x)},${f(b.yMin)}`);
        svg += `<polygon points="${upper.concat(lower).join(' ')}" fill="${okColor}" opacity="0.18"/>`;
      }
      bandRun = [];
    };
    pts.forEach((p, i) => {
      if (p.s.avg === null) {
        flushBand();
      } else {
        const x = xAt(i);
        const yMin = yAt(p.s.min);
        const yMax = yAt(p.s.max);
        bandRun.push({ x: x, yMin: yMin, yMax: yMax });
        if (p.s.max > p.s.min) {
          svg += `<line x1="${f(x)}" y1="${f(yMax)}" x2="${f(x)}" y2="${f(yMin)}" stroke="${okColor}" stroke-width="5" stroke-linecap="round" opacity="0.22"/>`;
        }
      }
    });
    flushBand();

    let prevAnsIdx = -1;
    pts.forEach((p, i) => {
      if (p.s.avg !== null) {
        if (prevAnsIdx >= 0 && i > prevAnsIdx + 1) {
          svg += `<line x1="${f(xAt(prevAnsIdx))}" y1="${f(yAt(pts[prevAnsIdx].s.avg))}" x2="${f(xAt(i))}" y2="${f(yAt(p.s.avg))}" stroke="${okColor}" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.65"/>`;
        }
        prevAnsIdx = i;
      }
    });

    let seg = [];
    const flushSeg = () => {
      if (seg.length >= 2) {
        svg += `<polyline points="${seg.join(' ')}" fill="none" stroke="${okColor}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      seg = [];
    };
    pts.forEach((p, i) => {
      if (p.s.avg === null) {
        flushSeg();
      } else {
        seg.push(`${f(xAt(i))},${f(yAt(p.s.avg))}`);
      }
    });
    flushSeg();

    pts.forEach((p, i) => {
      const bx = xAt(i);
      const x = f(bx);
      if (p.s.avg === null) {
        const by = GRAPH_T + plotH;
        svg += `<line x1="${x}" y1="${GRAPH_T}" x2="${x}" y2="${by}" stroke="var(--accent-danger)" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.45"/>`;
        svg += `<path d="M${f(bx - 3.5)} ${f(by - 3.5)}L${f(bx + 3.5)} ${f(by + 3.5)}M${f(bx + 3.5)} ${f(by - 3.5)}L${f(bx - 3.5)} ${f(by + 3.5)}" stroke="var(--accent-danger)" stroke-width="2" stroke-linecap="round" fill="none"/>`;
      } else {
        const cy = f(yAt(p.s.avg));
        if (p.s.isBad) {
          svg += `<circle cx="${x}" cy="${cy}" r="4" fill="var(--accent-danger)"/>`;
        } else if (p.s.isDest) {
          svg += `<circle cx="${x}" cy="${cy}" r="5.5" fill="none" stroke="var(--accent-success)" stroke-width="1.8"/>`;
          svg += `<circle cx="${x}" cy="${cy}" r="3.2" fill="var(--accent-success)"/>`;
        } else {
          svg += `<circle cx="${x}" cy="${cy}" r="3" fill="${okColor}"/>`;
        }
        if (p.s.lost > 0) {
          const lossY = Math.max(GRAPH_T + 3, yAt(p.s.max) - 6);
          svg += `<circle cx="${x}" cy="${f(lossY)}" r="2.4" fill="var(--accent-danger)"/>`;
        }
      }
    });

    const labelSteps = [1, 2, 5, 10, 20];
    let every = 20;
    for (let k = 0; k < labelSteps.length; k++) {
      if (labelSteps[k] * step >= 34) { every = labelSteps[k]; break; }
    }
    if (n === 1) every = 1;
    pts.forEach((p, i) => {
      if (p.ttl % every !== 0 && i !== 0 && i !== n - 1) return;
      const x = xAt(i);
      const anchor = x < 12 ? 'start' : (x > contentW - 12 ? 'end' : 'middle');
      svg += `<text class="tg-xlbl" data-x="${f(x)}" x="${f(x)}" y="${GRAPH_H - 5}" text-anchor="${anchor}" font-size="9" fill="var(--text-muted)">#${p.ttl}</text>`;
    });

    let selIdx = -1;
    if (selectedTtl !== null) selIdx = pts.findIndex((p) => p.ttl === selectedTtl);
    if (selIdx >= 0) {
      const sx = f(xAt(selIdx));
      svg += `<line x1="${sx}" y1="${GRAPH_T}" x2="${sx}" y2="${GRAPH_T + plotH}" stroke="var(--text-secondary)" stroke-width="1" stroke-dasharray="2 2"/>`;
      if (pts[selIdx].s.avg !== null) {
        const ringColor = pts[selIdx].s.isBad ? 'var(--accent-danger)' : (pts[selIdx].s.isDest ? 'var(--accent-success)' : okColor);
        svg += `<circle cx="${sx}" cy="${f(yAt(pts[selIdx].s.avg))}" r="6.5" fill="none" stroke="${ringColor}" stroke-width="2"/>`;
      }
    }

    graphSvg.setAttribute('width', String(contentW));
    graphSvg.innerHTML = svg;
    const silentCount = pts.filter((p) => p.s.avg === null).length;
    graphSvg.setAttribute('aria-label', `Traceroute latency graph, ${n} hops, ${silentCount} without reply`);

    renderTraceHopDetail(selIdx >= 0 ? pts[selIdx].h : null);
    renderTraceLegend(true, scrollable);

    const hintInfo = computeTraceJumpHintInfo();
    if (graphHint) {
      if (hintInfo) {
        graphHint.textContent = hintInfo.text;
        graphHint.style.display = 'block';
      } else {
        graphHint.textContent = '';
        graphHint.style.display = 'none';
      }
    }

    if (!isRunning && !isSelectUpdate && window.APP_DEBUG_ENABLED) {
      const renderKey = `${viewMode}:${n}`;
      if (renderKey !== lastLoggedTraceGraphKey) {
        lastLoggedTraceGraphKey = renderKey;
        traceLog(`graph: render hops=${n}`);
        if (hintInfo) {
          traceLog(`graph: jump hint shown at hop ${hintInfo.ttl}`);
        } else {
          traceLog('graph: no jump hint');
        }
      }
    }

    if (graphFollow || wasAtEnd) {
      graphScroll.scrollLeft = graphScroll.scrollWidth;
    }
    syncTraceXAxisLabels();
  }

  // Ensures x-axis hop labels near the left or right edge of the scroll viewport are never clipped.
  function syncTraceXAxisLabels() {
    if (!graphSvg || !graphScroll) return;
    const labels = graphSvg.querySelectorAll('.tg-xlbl');
    if (!labels || labels.length === 0) return;
    const vw = graphScroll.clientWidth || 0;
    const sw = graphScroll.scrollWidth || 0;
    if (vw <= 0 || sw <= vw + 1) return;
    const visLeft = graphScroll.scrollLeft;
    const visRight = visLeft + vw;
    const f = (v) => (Math.round(v * 10) / 10).toString();
    for (let i = 0; i < labels.length; i++) {
      const el = labels[i];
      const origX = parseFloat(el.getAttribute('data-x'));
      if (isNaN(origX)) continue;
      if (origX < visLeft + 2 || origX > visRight - 2) {
        el.style.display = 'none';
      } else if (origX < visLeft + 14) {
        el.style.display = '';
        el.setAttribute('text-anchor', 'start');
        el.setAttribute('x', f(Math.max(origX, visLeft + 2)));
      } else if (origX > visRight - 14) {
        el.style.display = '';
        el.setAttribute('text-anchor', 'end');
        el.setAttribute('x', f(Math.min(origX, visRight - 2)));
      } else {
        el.style.display = '';
        el.setAttribute('text-anchor', 'middle');
        el.setAttribute('x', f(origX));
      }
    }
  }

  function scheduleTraceGraph() {
    if (viewMode !== 'graph' || graphTimer) return;
    graphTimer = setTimeout(() => {
      graphTimer = null;
      renderTraceGraph();
    }, 60);
  }

  function setTraceView(mode) {
    viewMode = mode === 'graph' ? 'graph' : 'list';
    const isGraph = viewMode === 'graph';
    if (tableContainer) tableContainer.style.display = isGraph ? 'none' : '';
    if (graphWrap) graphWrap.style.display = isGraph ? 'block' : 'none';
    if (btnViewList) {
      btnViewList.classList.toggle('active', !isGraph);
      btnViewList.setAttribute('aria-pressed', isGraph ? 'false' : 'true');
    }
    if (btnViewGraph) {
      btnViewGraph.classList.toggle('active', isGraph);
      btnViewGraph.setAttribute('aria-pressed', isGraph ? 'true' : 'false');
    }
    if (isGraph) {
      graphFollow = true;
      renderTraceGraph();
    } else {
      lastLoggedTraceGraphKey = 'list';
    }
  }

  if (graphScroll) {
    graphScroll.addEventListener('scroll', () => {
      graphFollow = graphScroll.scrollWidth - graphScroll.scrollLeft - graphScroll.clientWidth < 12;
      syncTraceXAxisLabels();
    });
  }

  if (graphSvg) {
    graphSvg.addEventListener('click', (e) => {
      const n = hops.length;
      if (n === 0) return;
      const rect = graphSvg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const viewportW = Math.max(200, graphScroll.clientWidth || 260);
      const innerW = Math.max(40, viewportW - GRAPH_PADL - GRAPH_PADR);
      const slots = isRunning ? Math.max(n, 10) : n;
      const step = slots > 1 ? Math.max(GRAPH_STEP_MIN, innerW / (slots - 1)) : 0;
      let idx = step > 0 ? Math.round((x - GRAPH_PADL) / step) : 0;
      if (idx < 0) idx = 0;
      if (idx > n - 1) idx = n - 1;
      const ttl = hops[idx].ttl;
      selectedTtl = (selectedTtl === ttl) ? null : ttl;
      if (window.APP_DEBUG_ENABLED) traceLog(`graph: select ttl=${selectedTtl !== null ? selectedTtl : 'none'}`);
      renderTraceGraph(true);
    });
  }

  if (btnViewList) {
    btnViewList.addEventListener('click', () => {
      if (window.APP_DEBUG_ENABLED) traceLog('ui: view list');
      setTraceView('list');
    });
  }
  if (btnViewGraph) {
    btnViewGraph.addEventListener('click', () => {
      if (window.APP_DEBUG_ENABLED) traceLog('ui: view graph');
      setTraceView('graph');
    });
  }

  function wrapShareHintLines(text, maxWidthPx, maxChars) {
    if (!text) return [];
    let ctx = null;
    try {
      const c = document.createElement('canvas');
      ctx = c.getContext('2d');
      if (ctx) ctx.font = '20px -apple-system, Roboto, Helvetica, Arial, sans-serif';
    } catch (e) { ctx = null; }
    const fits = (str) => {
      if (str.length > maxChars) return false;
      if (ctx) {
        try { return ctx.measureText(str).width <= maxWidthPx; } catch (e) { /* ignore */ }
      }
      return true;
    };
    const words = String(text).trim().split(/\s+/);
    const lines = [];
    let cur = '';
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const next = cur ? `${cur} ${w}` : w;
      if (cur && !fits(next)) {
        lines.push(cur);
        cur = w;
      } else {
        cur = next;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function buildTraceGraphShareSvg() {
    const W = 1080, H = 720;
    const padL = 80, padR = 40, top = 210;
    const plotW = W - padL - padR;
    const hintText = computeTraceJumpHint();
    const hintLines = wrapShareHintLines(hintText, plotW - 20, 68);
    const hasHint = hintLines.length > 0;
    const isFree = !isProNow();
    const bottom = hasHint ? (isFree ? 190 : 155) : (isFree ? 110 : 80);
    const plotH = H - top - bottom;
    const pts = hops.map((h) => ({ h: h, ttl: h.ttl, s: hopStats(h) }));
    const n = pts.length;
    let maxMs = 0;
    pts.forEach((p) => {
      if (p.s.max !== null && p.s.max > maxMs) maxMs = p.s.max;
    });
    const maxY = traceGraphNiceMax(maxMs);
    const f = (v) => (Math.round(v * 10) / 10).toString();
    const xAt = (i) => padL + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
    const yAt = (ms) => top + plotH - (ms / maxY) * plotH;
    const INK = '#1e293b', MUTED = '#64748b', GRID = '#e2e8f0', ACC = '#4f46e5', BAD = '#ef4444', DEST = '#10b981';

    const targetStr = runHost || input.value.trim();
    const resolvedPart = (runResolved && runResolved !== targetStr) ? ` (${runResolved})` : '';
    let header = `Traceroute to ${targetStr}${resolvedPart}`;
    if (header.length > 48) header = header.slice(0, 47) + '…';
    const hopWord = n === 1 ? 'hop' : 'hops';
    const line1 = lastSummary || `${n} ${hopWord}`;
    const line2 = new Date().toLocaleString();

    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system, Roboto, Helvetica, Arial, sans-serif">`;
    s += `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
    s += `<text x="${W - padR}" y="40" text-anchor="end" font-size="30" font-weight="700" fill="${ACC}">iSubnet</text>`;
    s += `<text x="${padL}" y="76" font-size="38" font-weight="700" fill="${INK}">${escapeHTML(header)}</text>`;
    s += `<text x="${padL}" y="122" font-size="25" fill="${MUTED}">${escapeHTML(line1)}</text>`;
    s += `<text x="${padL}" y="160" font-size="22" fill="${MUTED}">${escapeHTML(line2)}</text>`;

    [0, 0.5, 1].forEach((frac) => {
      const gy = top + plotH - frac * plotH;
      s += `<line x1="${padL}" y1="${f(gy)}" x2="${W - padR}" y2="${f(gy)}" stroke="${GRID}" stroke-width="2"/>`;
      s += `<text x="${padL - 10}" y="${f(gy + 8)}" text-anchor="end" font-size="22" fill="${MUTED}">${fmtMs(maxY * frac)}</text>`;
    });
    s += `<text x="${padL - 10}" y="${top - 18}" text-anchor="end" font-size="20" fill="${MUTED}">ms</text>`;

    let bandRun = [];
    const flushBand = () => {
      if (bandRun.length >= 2) {
        const upper = bandRun.map((b) => `${f(b.x)},${f(b.yMax)}`);
        const lower = bandRun.slice().reverse().map((b) => `${f(b.x)},${f(b.yMin)}`);
        s += `<polygon points="${upper.concat(lower).join(' ')}" fill="${ACC}" opacity="0.18"/>`;
      }
      bandRun = [];
    };
    pts.forEach((p, i) => {
      if (p.s.avg === null) {
        flushBand();
      } else {
        const x = xAt(i);
        const yMin = yAt(p.s.min);
        const yMax = yAt(p.s.max);
        bandRun.push({ x: x, yMin: yMin, yMax: yMax });
        if (p.s.max > p.s.min) {
          s += `<line x1="${f(x)}" y1="${f(yMax)}" x2="${f(x)}" y2="${f(yMin)}" stroke="${ACC}" stroke-width="10" stroke-linecap="round" opacity="0.22"/>`;
        }
      }
    });
    flushBand();

    let prevAnsIdx = -1;
    pts.forEach((p, i) => {
      if (p.s.avg !== null) {
        if (prevAnsIdx >= 0 && i > prevAnsIdx + 1) {
          s += `<line x1="${f(xAt(prevAnsIdx))}" y1="${f(yAt(pts[prevAnsIdx].s.avg))}" x2="${f(xAt(i))}" y2="${f(yAt(p.s.avg))}" stroke="${ACC}" stroke-width="3.5" stroke-dasharray="10 8" opacity="0.65"/>`;
        }
        prevAnsIdx = i;
      }
    });

    let seg = [];
    const flushSeg = () => {
      if (seg.length >= 2) {
        s += `<polyline points="${seg.join(' ')}" fill="none" stroke="${ACC}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      seg = [];
    };
    pts.forEach((p, i) => {
      if (p.s.avg === null) flushSeg(); else seg.push(`${f(xAt(i))},${f(yAt(p.s.avg))}`);
    });
    flushSeg();

    pts.forEach((p, i) => {
      const bx = xAt(i);
      const x = f(bx);
      if (p.s.avg === null) {
        const by = top + plotH;
        s += `<line x1="${x}" y1="${top}" x2="${x}" y2="${by}" stroke="${BAD}" stroke-width="3" stroke-dasharray="8 6" opacity="0.35"/>`;
        s += `<path d="M${f(bx - 7)} ${f(by - 7)}L${f(bx + 7)} ${f(by + 7)}M${f(bx + 7)} ${f(by - 7)}L${f(bx - 7)} ${f(by + 7)}" stroke="${BAD}" stroke-width="4" stroke-linecap="round" fill="none"/>`;
      } else {
        const cy = f(yAt(p.s.avg));
        if (p.s.isDest) {
          s += `<circle cx="${x}" cy="${cy}" r="12" fill="none" stroke="${DEST}" stroke-width="4"/>`;
          s += `<circle cx="${x}" cy="${cy}" r="7" fill="${DEST}"/>`;
        } else {
          s += `<circle cx="${x}" cy="${cy}" r="7" fill="${ACC}"/>`;
        }
        if (p.s.lost > 0) {
          const lossY = Math.max(top + 6, yAt(p.s.max) - 14);
          s += `<circle cx="${x}" cy="${f(lossY)}" r="5" fill="${BAD}"/>`;
        }
      }
    });

    if (n > 0) {
      s += `<text x="${padL}" y="${top + plotH + 38}" text-anchor="start" font-size="22" fill="${MUTED}">#${pts[0].ttl}</text>`;
      if (n > 1) s += `<text x="${W - padR}" y="${top + plotH + 38}" text-anchor="end" font-size="22" fill="${MUTED}">#${pts[n - 1].ttl}</text>`;
    }

    if (hasHint) {
      const baseHintY = top + plotH + 76;
      hintLines.forEach((hl, idx) => {
        s += `<text class="share-hint-line" x="${padL}" y="${baseHintY + idx * 26}" font-size="20" fill="${INK}">${escapeHTML(hl)}</text>`;
      });
    }
    if (isFree) {
      s += `<text class="share-watermark" x="${padL}" y="${H - 22}" font-size="22" fill="${MUTED}">Calculated with iSubnet</text>`;
    }
    s += '</svg>';
    return s;
  }

  function traceSvgToPngBase64(svgStr, w, h) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png').split(',')[1]);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('traceroute graph image render failed'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    });
  }

  async function shareTraceGraph() {
    if (hops.length === 0) return false;
    const hasSharePlugins = !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem && window.Capacitor.Plugins.Share);
    const isNativeShare = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    if (!isNativeShare && !hasSharePlugins) return false;
    if (window.APP_DEBUG_ENABLED) traceLog('graph: share start');
    try {
      const svgStr = buildTraceGraphShareSvg();
      const png = await traceSvgToPngBase64(svgStr, 1080, 720);
      const { Filesystem, Share } = window.Capacitor.Plugins;
      const written = await Filesystem.writeFile({ path: 'isubnet_traceroute_graph.png', data: png, directory: 'CACHE' });
      try {
        await Share.share({ title: 'Traceroute Graph', url: written.uri });
      } catch (e) {
        console.error('Capacitor Share (traceroute graph) failed/rejected:', e);
      }
      if (window.APP_DEBUG_ENABLED) traceLog('graph: share ok');
      return true;
    } catch (e) {
      if (window.APP_DEBUG_ENABLED) traceLog(`share graph failed: ${e && e.message ? e.message : e}`);
      return false;
    }
  }

  function renderHop(h) {
    if (!h.tr) return;
    const addrs = hopAddresses(h);
    let hostHtml = '';
    if (addrs.length === 0) {
      const anyError = hopHasOutcome(h, 'ERROR');
      const label = !hopDone(h) ? '…' : (anyError ? 'Error' : 'No reply');
      hostHtml = `<span class="trace-host-muted">${escapeHTML(label)}</span>`;
    } else {
      let cls = '';
      if (hopHasOutcome(h, 'REPLY')) cls = ' trace-host-dest';
      else if (hopHasOutcome(h, 'UNREACHABLE')) cls = ' trace-host-bad';
      hostHtml = addrs.map((a) => {
        if (names[a]) {
          return `<span class="${cls.trim()}"><span class="trace-host-name">${escapeHTML(names[a])}</span><span class="trace-host-ip">${escapeHTML(a)}</span></span>`;
        }
        return `<span class="${cls.trim()}"><span class="trace-host-ip">${escapeHTML(a)}</span></span>`;
      }).join('');
    }
    const avg = hopAvg(h);
    const timeHtml = (avg !== null)
      ? `<span class="trace-time">${escapeHTML(fmtMs(avg))} ms</span>`
      : `<span class="trace-time none">${hopDone(h) ? '—' : '…'}</span>`;
    const probesHtml = `<span class="trace-probes">${escapeHTML(hopTimes(h).join(' · '))}</span>`;
    h.tr.innerHTML = `<td class="trace-hop">${escapeHTML(String(h.ttl))}</td><td>${hostHtml}</td><td>${timeHtml}${probesHtml}</td>`;
  }

  function getHop(ttl) {
    let h = hops.find((x) => x.ttl === ttl);
    if (h) return h;
    h = { ttl: ttl, probes: [], tr: document.createElement('tr') };
    hops.push(h);
    hops.sort((a, b) => a.ttl - b.ttl);
    const idx = hops.indexOf(h);
    const nextHop = newestFirst ? (idx > 0 ? hops[idx - 1] : null) : hops[idx + 1];
    if (nextHop && nextHop.tr && nextHop.tr.parentNode === tbody) {
      tbody.insertBefore(h.tr, nextHop.tr);
    } else {
      tbody.appendChild(h.tr);
    }
    return h;
  }

  function lastTtl() {
    return hops.length > 0 ? hops[hops.length - 1].ttl : 0;
  }

  function buildText(summary) {
    const target = `${runHost}${runResolved && runResolved !== runHost ? ` (${runResolved})` : ''}`;
    let t = `Traceroute to ${target}, ${runMaxHops} hops max\n${summary}\n\n#\tHost\tTime (ms)\n`;
    t += hops.map((h) => `${h.ttl}\t${hopHostText(h)}\t${hopTimes(h).join(' / ')}`).join('\n') + '\n';
    return t;
  }

  function refreshText() {
    if (!lastSummary) return;
    lastTraceText = buildText(lastSummary);
  }

  function parseIntIn(el, lo, hi, label) {
    const s = (el ? el.value : '').trim();
    if (!/^\d{1,3}$/.test(s)) return { err: `${label} must be a whole number from ${lo} to ${hi}.` };
    const n = parseInt(s, 10);
    if (n < lo || n > hi) return { err: `${label} must be a whole number from ${lo} to ${hi}.` };
    return { n: n };
  }

  async function runTrace() {
    if (isRunning) {
      if (window.APP_DEBUG_ENABLED) traceLog('ui: stop tap');
      if (P && typeof P.stop === 'function') {
        try { await P.stop(); } catch (e) { /* ignore */ }
      }
      return;
    }

    hideError();

    const rawVal = input.value;
    let val = rawVal.trim().replace(/\.+$/, '');
    if (!val) {
      showError('Please enter a hostname or IPv4 address.');
      return;
    }
    if (val.startsWith('-') || /\s/.test(val)) {
      showError('Invalid hostname or IP address.');
      return;
    }

    const wasUrl = val.startsWith('http://') || val.startsWith('https://');
    const hadPath = val.includes('/');
    try {
      if (wasUrl) {
        val = new URL(val).hostname;
      } else if (hadPath) {
        val = new URL('http://' + val).hostname;
      } else {
        try {
          val = new URL('http://' + val).hostname;
        } catch (e) {
          val = val.toLowerCase();
        }
      }
    } catch (e) {
      val = val.toLowerCase();
    }

    val = val.replace(/^\[|\]$/g, '');
    if (!val || val.startsWith('-') || /\s/.test(val)) {
      showError('Invalid hostname or IP address.');
      return;
    }
    if (val.indexOf(':') !== -1) {
      showError("IPv6 traceroute isn't supported yet. Enter a hostname or an IPv4 address.");
      return;
    }

    let hopsToSend = DEFAULT_HOPS;
    let probesToSend = DEFAULT_PROBES;
    let timeoutS = DEFAULT_TIMEOUT_S;
    let resolveNames = false;
    if (isProNow()) {
      const h = parseIntIn(hopsInput, 1, MAX_HOPS, 'Max hops');
      if (h.err) { showError(h.err); return; }
      const p = parseIntIn(probesInput, 1, MAX_PROBES, 'Probes per hop');
      if (p.err) { showError(p.err); return; }
      const t = parseIntIn(timeoutInput, 1, MAX_TIMEOUT_S, 'Timeout');
      if (t.err) { showError(t.err); return; }
      hopsToSend = h.n;
      probesToSend = p.n;
      timeoutS = t.n;
      resolveNames = resolveOn;
    } else {
      if (hopsInput) hopsInput.value = String(DEFAULT_HOPS);
      if (probesInput) probesInput.value = String(DEFAULT_PROBES);
      if (timeoutInput) timeoutInput.value = String(DEFAULT_TIMEOUT_S);
    }

    if (!P) {
      P = findPlugin().plugin;
    }
    if (!P) {
      showError("Traceroute isn't available on this device yet.");
      return;
    }

    if (window.APP_DEBUG_ENABLED) traceLog(`ui: start | online=${navigator.onLine} | inputLength=${rawVal.length}`);

    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.FirebaseCrashlytics) {
      window.Capacitor.Plugins.FirebaseCrashlytics.setCustomKey({ key: 'last_calc_action', value: 'tracerouteRun', type: 'string' }).catch(() => {});
    }

    try {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl === input || activeEl === hopsInput || activeEl === probesInput || activeEl === timeoutInput)) activeEl.blur();
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Keyboard && typeof window.Capacitor.Plugins.Keyboard.hide === 'function') {
        Promise.resolve(window.Capacitor.Plugins.Keyboard.hide()).catch(() => {});
      }
    } catch (e) { /* ignore */ }

    removeListeners();
    hops = [];
    names = {};
    runHost = val;
    runResolved = '';
    runMaxHops = hopsToSend;
    runProbes = probesToSend;
    newestFirst = hopsToSend > 10;
    runReached = false;
    resetTraceGraph();
    lastSummary = '';
    lastTraceText = '';
    lastTraceTitle = '';

    isRunning = true;
    updateTraceControls();
    btnRun.textContent = 'Stop';
    resultsCard.style.display = 'block';
    statusLine.textContent = 'Resolving...';
    tbody.innerHTML = '';

    let outcome = 'ok';
    const runStartMs = performance.now();
    let loggedResolved = false;
    let loggedNamesStart = false;
    let loggedNamesDone = false;
    let traceRunFinished = false;
    const uniqueHopAddrs = new Set();
    const pendingNameAddrs = new Set();
    const settledNameAddrs = new Set();
    const addrToTtl = {};
    const addrTimerMap = {};
    let hostnameListenerHandle = null;

    function checkNamesAllSettled() {
      if (!resolveNames || !traceRunFinished || loggedNamesDone) return;
      if (pendingNameAddrs.size === 0) {
        loggedNamesDone = true;
        if (window.APP_DEBUG_ENABLED) {
          traceLog(`names: done ${Object.keys(names).length} of ${uniqueHopAddrs.size} answered`);
        }
        if (hostnameListenerHandle) {
          const h = hostnameListenerHandle;
          hostnameListenerHandle = null;
          const idx = listeners.indexOf(h);
          if (idx !== -1) listeners.splice(idx, 1);
          try { if (typeof h.remove === 'function') Promise.resolve(h.remove()).catch(() => {}); } catch (e) { /* ignore */ }
        }
      }
    }

    function settleNameLookup(addr, hostStr, failReason) {
      if (!addr || settledNameAddrs.has(addr)) return;
      settledNameAddrs.add(addr);
      pendingNameAddrs.delete(addr);
      if (addrTimerMap[addr]) {
        clearTimeout(addrTimerMap[addr]);
        delete addrTimerMap[addr];
      }
      const ansTtl = addrToTtl[addr] !== undefined ? addrToTtl[addr] : '-';
      if (hostStr) {
        names[addr] = hostStr;
        if (window.APP_DEBUG_ENABLED) {
          traceLog(`names: answered ttl=${ansTtl}`);
        }
        hops.forEach((h) => {
          if (hopAddresses(h).indexOf(addr) !== -1) renderHop(h);
        });
        refreshText();
        if (viewMode === 'graph') scheduleTraceGraph();
      } else if (window.APP_DEBUG_ENABLED) {
        const r = (failReason === 'none' || failReason === 'timeout' || failReason === 'error') ? failReason : 'none';
        traceLog(`names: no name ttl=${ansTtl} | reason=${r}`);
      }
      checkNamesAllSettled();
    }
    if (window.APP_DEBUG_ENABLED) {
      traceLog(`ui: params | maxHops=${hopsToSend} | probes=${probesToSend} | timeoutS=${timeoutS} | resolveNames=${resolveNames} | pro=${isProNow()}`);
      traceLog(`order: ${newestFirst ? 'newest-first' : 'hop 1 first'}`);
    }

    try {
      if (typeof P.addListener === 'function') {
        listeners.push(await P.addListener('resolved', (ev) => {
          if (!ev || !ev.address) return;
          runResolved = ev.address;
          statusLine.textContent = `Tracing to ${ev.address}...`;
          if (!loggedResolved) {
            loggedResolved = true;
            if (window.APP_DEBUG_ENABLED) traceLog('resolved: ok');
          }
        }));
        listeners.push(await P.addListener('hop', (ev) => {
          if (!ev || typeof ev.ttl !== 'number') return;
          const h = getHop(ev.ttl);
          const idx = (typeof ev.probe === 'number' && ev.probe >= 1) ? ev.probe - 1 : h.probes.length;
          const probeNum = (typeof ev.probe === 'number' && ev.probe >= 1) ? ev.probe : idx + 1;
          h.probes[idx] = { outcome: ev.outcome, address: ev.address || null, timeMs: (typeof ev.timeMs === 'number') ? ev.timeMs : null };
          if (ev.address) {
            const isNewAddr = !uniqueHopAddrs.has(ev.address);
            uniqueHopAddrs.add(ev.address);
            if (addrToTtl[ev.address] === undefined) addrToTtl[ev.address] = ev.ttl;
            if (resolveNames && isNewAddr && !settledNameAddrs.has(ev.address)) {
              if (!loggedNamesStart) {
                loggedNamesStart = true;
                if (window.APP_DEBUG_ENABLED) traceLog('names: lookup start');
              }
              pendingNameAddrs.add(ev.address);
              const dnsWaitMs = (typeof window._TRACE_DNS_TIMEOUT_MS === 'number' && window._TRACE_DNS_TIMEOUT_MS > 0) ? window._TRACE_DNS_TIMEOUT_MS : 3100;
              const targetAddr = ev.address;
              const tid = setTimeout(() => {
                settleNameLookup(targetAddr, null, 'timeout');
              }, dnsWaitMs);
              dnsTimers.push(tid);
              addrTimerMap[targetAddr] = tid;
            }
          }
          if (window.APP_DEBUG_ENABLED) {
            const msPart = (typeof ev.timeMs === 'number') ? fmtMs(ev.timeMs) : '-';
            traceLog(`hop: ttl=${ev.ttl} | probe=${probeNum} | outcome=${ev.outcome || 'UNKNOWN'} | ms=${msPart}`);
          }
          renderHop(h);
          statusLine.textContent = `Tracing to ${runResolved || runHost} · hop ${ev.ttl}`;
          scheduleTraceGraph();
        }));
        hostnameListenerHandle = await P.addListener('hostname', (ev) => {
          if (!ev || !ev.address || !resolveNames) return;
          if (!loggedNamesStart) {
            loggedNamesStart = true;
            if (window.APP_DEBUG_ENABLED) traceLog('names: lookup start');
          }
          if (ev.hostname) {
            settleNameLookup(ev.address, ev.hostname, null);
          } else {
            settleNameLookup(ev.address, null, ev.reason || 'none');
          }
        });
        listeners.push(hostnameListenerHandle);
      }

      const res = await P.trace({ host: val, maxHops: hopsToSend, probes: probesToSend, timeoutMs: timeoutS * 1000, resolveNames: resolveNames });
      outcome = res.cancelled ? 'cancelled' : 'ok';
      if (res.resolvedAddress) runResolved = res.resolvedAddress;
      runReached = !!res.reached;
      if (runResolved && !loggedResolved) {
        loggedResolved = true;
        if (window.APP_DEBUG_ENABLED) traceLog('resolved: ok');
      }
      traceRunFinished = true;
      if (resolveNames) {
        if (!loggedNamesStart && window.APP_DEBUG_ENABLED) {
          loggedNamesStart = true;
          traceLog('names: lookup start');
        }
        if (pendingNameAddrs.size > 0) {
          if (window.APP_DEBUG_ENABLED) {
            traceLog(`names: pending ${pendingNameAddrs.size} after run`);
          }
        } else {
          checkNamesAllSettled();
        }
      }

      const hopCount = (typeof res.hops === 'number' && res.hops > 0) ? res.hops : lastTtl();
      const hopWord = hopCount === 1 ? 'hop' : 'hops';
      let summary;
      if (res.cancelled) {
        summary = `Stopped at hop ${lastTtl()}`;
      } else if (res.reached) {
        summary = `Reached ${runResolved || runHost} in ${hopCount} ${hopWord}`;
      } else if (res.unreachable) {
        summary = `Destination unreachable at hop ${hopCount}`;
      } else {
        summary = `Destination not reached within ${runMaxHops} hops`;
      }
      statusLine.textContent = summary;
      hops.forEach((h) => renderHop(h));

      lastSummary = summary;
      lastTraceText = buildText(summary);
      lastTraceTitle = `Traceroute: ${val}`;
      if (window.APP_DEBUG_ENABLED) traceLog(`result: hops=${hopCount} | reached=${!!res.reached} | unreachable=${!!res.unreachable} | cancelled=${!!res.cancelled}`);
    } catch (err) {
      outcome = 'error';
      if (!loggedResolved && !runResolved && hops.length === 0) {
        if (window.APP_DEBUG_ENABLED) traceLog('resolved: failed');
      }
      removeListeners();
      showError(err.message || 'Traceroute failed');
    } finally {
      isRunning = false;
      btnRun.textContent = 'Trace';
      updateTraceControls();
      if (window.APP_DEBUG_ENABLED) {
        const elapsedMs = Math.max(0, Math.round(performance.now() - runStartMs));
        traceLog(`outcome: ${outcome} | ms=${elapsedMs}`);
      }
      if (viewMode === 'graph') renderTraceGraph();
    }
  }

  btnRun.addEventListener('click', runTrace);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runTrace();
  });

  btnClear.addEventListener('click', async () => {
    if (window.APP_DEBUG_ENABLED) traceLog('ui: clear tap');
    if (isRunning && P && typeof P.stop === 'function') {
      try { await P.stop(); } catch (e) { /* ignore */ }
    }
    removeListeners();
    input.value = '';
    hideError();
    resultsCard.style.display = 'none';
    lastSummary = '';
    lastTraceText = '';
    lastTraceTitle = '';
    tbody.innerHTML = '';
    hops = [];
    names = {};
    runReached = false;
    resetTraceGraph();
  });

  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      if (window.APP_DEBUG_ENABLED) traceLog('ui: copy tap');
      if (lastTraceText && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(lastTraceText)
          .then(() => {
            if (window.APP_DEBUG_ENABLED) traceLog('ui: copy success');
            if (typeof showToast === 'function') showToast('Traceroute results copied!');
          })
          .catch(() => {
            if (typeof showToast === 'function') showToast('Copy failed');
          });
      }
    });
  }

  if (btnShare) {
    btnShare.addEventListener('click', async () => {
      if (isShareTapDuplicate('traceroute')) {
        if (window.APP_DEBUG_ENABLED) traceLog('ui: share tap ignored | reason=double-tap');
        return;
      }
      if (window.APP_DEBUG_ENABLED) traceLog('ui: share tap');
      if (viewMode === 'graph' && hops.length > 0) {
        const sharedGraph = await shareTraceGraph();
        if (sharedGraph) return;
      }
      if (lastTraceText && typeof shareText === 'function') {
        shareText('Traceroute Results', lastTraceText, true);
      }
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      if (window.APP_DEBUG_ENABLED) traceLog('ui: save tap');
      if (!lastTraceText || typeof addNote !== 'function') return;
      addNote(lastTraceTitle || 'Traceroute', lastTraceText, 'Traceroute');
      if (typeof maybeRequestReview === 'function') maybeRequestReview('save_note');
      if (typeof switchToNotesTab === 'function') switchToNotesTab();
    });
  }

  // Traceroute is short and has no foreground service, so a running trace is stopped when the app goes to the background.
  function stopIfRunning(why) {
    if (isRunning && P && typeof P.stop === 'function') {
      if (window.APP_DEBUG_ENABLED) traceLog(`stop: ${why}`);
      try { Promise.resolve(P.stop()).catch(() => {}); } catch (e) { /* ignore */ }
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stopIfRunning('app hidden');
  });

  try {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App && typeof window.Capacitor.Plugins.App.addListener === 'function') {
      window.Capacitor.Plugins.App.addListener('appStateChange', (state) => {
        try {
          if (state && state.isActive === false) stopIfRunning('app inactive');
        } catch (e) { /* ignore */ }
      });
    }
  } catch (e) { /* ignore */ }
})();

// --- WHOIS TOOL (RDAP) ---
(function initWhoisTool() {
  const input = document.getElementById('whois-input');
  const btnLookup = document.getElementById('btn-whois-lookup');
  const btnClear = document.getElementById('btn-whois-clear');
  const errorMsg = document.getElementById('whois-error-msg');
  const resultsCard = document.getElementById('whois-results-card');
  const resultTitle = document.getElementById('whois-result-title');
  const btnRaw = document.getElementById('btn-whois-raw');
  const parentNote = document.getElementById('whois-parent-note');
  const chipsRow = document.getElementById('whois-chips-row');
  const bodyEl = document.getElementById('whois-body');
  const registrarBox = document.getElementById('whois-registrar-box');
  const sourceLine = document.getElementById('whois-source-line');
  const rawPre = document.getElementById('whois-raw-pre');
  const openInBox = document.getElementById('whois-open-in');
  const btnCopy = document.getElementById('btn-whois-copy');
  const btnSave = document.getElementById('btn-whois-save');
  const btnShare = document.getElementById('btn-whois-share');

  if (!input || !btnLookup || !btnClear || !errorMsg || !resultsCard || !bodyEl) {
    return;
  }

  const BOOTSTRAP_URLS = {
    dns: 'https://data.iana.org/rdap/dns.json',
    ipv4: 'https://data.iana.org/rdap/ipv4.json',
    ipv6: 'https://data.iana.org/rdap/ipv6.json',
    asn: 'https://data.iana.org/rdap/asn.json'
  };
  const BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000;
  const RDAP_FALLBACK_BASE = 'https://rdap.org/';
  const REQUEST_TIMEOUT_MS = 12000;

  const EPP_STATUS_INFO = {
    clienttransferprohibited: { code: 'clientTransferProhibited', desc: 'Registrar lock: the domain cannot be transferred away.' },
    servertransferprohibited: { code: 'serverTransferProhibited', desc: 'Registry lock: the domain cannot be transferred between registrars.' },
    clientupdateprohibited: { code: 'clientUpdateProhibited', desc: 'Registrar lock: the domain record cannot be modified without unlocking.' },
    serverupdateprohibited: { code: 'serverUpdateProhibited', desc: 'Registry lock: the domain record cannot be modified.' },
    clientdeleteprohibited: { code: 'clientDeleteProhibited', desc: 'Registrar lock: the domain cannot be deleted.' },
    serverdeleteprohibited: { code: 'serverDeleteProhibited', desc: 'Registry lock: the domain cannot be deleted.' },
    clienthold: { code: 'clientHold', desc: 'On hold by registrar: the domain is not published in DNS.' },
    serverhold: { code: 'serverHold', desc: 'On hold by registry: the domain is not published in DNS.' },
    clientrenewprohibited: { code: 'clientRenewProhibited', desc: 'Registrar lock: renewal is blocked by the registrar.' },
    serverrenewprohibited: { code: 'serverRenewProhibited', desc: 'Registry lock: renewal is blocked by the registry.' },
    active: { code: 'active', desc: 'Normal active status with no pending restrictions.' },
    ok: { code: 'ok', desc: 'Normal active status with no pending operations or restrictions.' },
    inactive: { code: 'inactive', desc: 'No name servers are delegated; the domain is not active in DNS.' },
    autorenewperiod: { code: 'autoRenewPeriod', desc: 'Grace period after automatic renewal by the registry.' },
    renewperiod: { code: 'renewPeriod', desc: 'Domain was recently renewed with the registry.' },
    addperiod: { code: 'addPeriod', desc: 'Initial grace period right after domain registration.' },
    transferperiod: { code: 'transferPeriod', desc: 'Domain was recently transferred to a new registrar.' },
    redemptionperiod: { code: 'redemptionPeriod', desc: 'Expired and pending deletion; can still be restored by the registrar.' },
    pendingdelete: { code: 'pendingDelete', desc: 'Scheduled for deletion and release by the registry.' },
    pendingtransfer: { code: 'pendingTransfer', desc: 'Transfer between registrars is currently in progress.' },
    pendingupdate: { code: 'pendingUpdate', desc: 'An update to the record is currently in progress.' },
    pendingcreate: { code: 'pendingCreate', desc: 'Domain creation is currently being processed.' },
    pendingrenew: { code: 'pendingRenew', desc: 'Domain renewal is currently being processed.' },
    pendingrestore: { code: 'pendingRestore', desc: 'Domain restoration is currently being processed.' },
    associated: { code: 'associated', desc: 'Record is associated with other objects in the registry.' },
    locked: { code: 'locked', desc: 'Record is locked against changes or deletion.' },
    validated: { code: 'validated', desc: 'Contact or registration details have been validated.' },
    obscured: { code: 'obscured', desc: 'Some registration details are masked for privacy.' }
  };

  function whoisLog(msg) {
    if (!window.APP_DEBUG_ENABLED || typeof window.debugLog !== 'function') return;
    window.debugLog(`[Whois] ${msg}`);
  }

  function safeHostOf(url) {
    try {
      return new URL(url).hostname || 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }

  function isProNow() {
    return typeof PRO_UNLOCKED !== 'undefined' && PRO_UNLOCKED === true;
  }

  let lookupSeq = 0;
  let currentAbort = null;
  let rawOpen = false;
  let lastRawJson = null;
  let lastRegistrarRawJson = null;
  let lastPlainText = '';
  let lastNoteTitle = '';
  let lastRelatedUrl = null;
  let lastRegistrarLoaded = false;
  let _lastParsedQuery = null;

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
    resultsCard.style.display = 'none';
  }

  function hideError() {
    errorMsg.style.display = 'none';
  }

  function updateRawButtonUI() {
    if (!btnRaw) return;
    if (!lastRawJson) {
      btnRaw.style.display = 'none';
      return;
    }
    btnRaw.style.display = '';
    if (isProNow()) {
      btnRaw.textContent = rawOpen ? 'Hide raw data' : 'Raw data';
      btnRaw.classList.toggle('active', rawOpen);
    } else {
      btnRaw.textContent = 'Raw data 🔒';
      btnRaw.classList.remove('active');
      rawOpen = false;
      if (rawPre) rawPre.style.display = 'none';
    }
  }

  function updateWhoisControls() {
    updateRawButtonUI();
    if (isProNow() && lastRelatedUrl && !lastRegistrarLoaded && resultsCard.style.display !== 'none') {
      loadRegistrarRecordForPro(lastRelatedUrl, lookupSeq);
    } else if (!isProNow() && lastRelatedUrl && resultsCard.style.display !== 'none') {
      lastRegistrarLoaded = false;
      renderRegistrarTeaser();
    }
  }
  window.updateWhoisControls = updateWhoisControls;

  // --- RFC 3492 Punycode encode/decode for IDN domain labels ---
  function punycodeEncode(ucs2) {
    const BASE = 36, TMIN = 1, TMAX = 26, SKEW = 38, DAMP = 700, INITIAL_BIAS = 72, INITIAL_N = 128;
    const cps = Array.from(ucs2).map((ch) => ch.codePointAt(0));
    let n = INITIAL_N;
    let delta = 0;
    let bias = INITIAL_BIAS;
    let out = '';
    for (let i = 0; i < cps.length; i++) {
      if (cps[i] < 0x80) out += String.fromCharCode(cps[i]);
    }
    const basicLen = out.length;
    let h = basicLen;
    if (basicLen > 0) out += '-';

    function adapt(d, numPoints, firstTime) {
      let k = 0;
      d = firstTime ? Math.floor(d / DAMP) : (d >> 1);
      d += Math.floor(d / numPoints);
      while (d > (((BASE - TMIN) * TMAX) >> 1)) {
        d = Math.floor(d / (BASE - TMIN));
        k += BASE;
      }
      return Math.floor(k + (((BASE - TMIN + 1) * d) / (d + SKEW)));
    }

    function digitToChar(d) {
      return String.fromCharCode(d + 22 + 75 * (d < 26 ? 1 : 0));
    }

    while (h < cps.length) {
      let m = 0x10ffff + 1;
      for (let i = 0; i < cps.length; i++) {
        if (cps[i] >= n && cps[i] < m) m = cps[i];
      }
      delta += (m - n) * (h + 1);
      n = m;
      for (let i = 0; i < cps.length; i++) {
        const c = cps[i];
        if (c < n) delta++;
        if (c === n) {
          let q = delta;
          for (let k = BASE; ; k += BASE) {
            const t = k <= bias ? TMIN : (k >= bias + TMAX ? TMAX : k - bias);
            if (q < t) break;
            out += digitToChar(t + ((q - t) % (BASE - t)));
            q = Math.floor((q - t) / (BASE - t));
          }
          out += digitToChar(q);
          bias = adapt(delta, h + 1, h === basicLen);
          delta = 0;
          h++;
        }
      }
      delta++;
      n++;
    }
    return 'xn--' + out;
  }

  function punycodeDecode(inputStr) {
    const BASE = 36, TMIN = 1, TMAX = 26, SKEW = 38, DAMP = 700, INITIAL_BIAS = 72, INITIAL_N = 128;
    const str = inputStr.slice(4).toLowerCase();
    let n = INITIAL_N;
    let i = 0;
    let bias = INITIAL_BIAS;
    const output = [];
    const delim = str.lastIndexOf('-');
    const startIdx = delim > -1 ? delim + 1 : 0;
    for (let j = 0; j < (delim > -1 ? delim : 0); j++) {
      output.push(str.charCodeAt(j));
    }

    function adapt(d, numPoints, firstTime) {
      let k = 0;
      d = firstTime ? Math.floor(d / DAMP) : (d >> 1);
      d += Math.floor(d / numPoints);
      while (d > (((BASE - TMIN) * TMAX) >> 1)) {
        d = Math.floor(d / (BASE - TMIN));
        k += BASE;
      }
      return Math.floor(k + (((BASE - TMIN + 1) * d) / (d + SKEW)));
    }

    let pos = startIdx;
    while (pos < str.length) {
      const oldi = i;
      let w = 1;
      for (let k = BASE; ; k += BASE) {
        if (pos >= str.length) return inputStr;
        const cp = str.charCodeAt(pos++);
        const digit = (cp - 48 < 10) ? cp - 22 : (cp - 65 < 26 ? cp - 65 : (cp - 97 < 26 ? cp - 97 : BASE));
        if (digit >= BASE) return inputStr;
        i += digit * w;
        const t = k <= bias ? TMIN : (k >= bias + TMAX ? TMAX : k - bias);
        if (digit < t) break;
        w *= (BASE - t);
      }
      const outLen = output.length + 1;
      bias = adapt(i - oldi, outLen, oldi === 0);
      n += Math.floor(i / outLen);
      i %= outLen;
      output.splice(i++, 0, n);
    }
    try {
      return String.fromCodePoint.apply(null, output);
    } catch (e) {
      return inputStr;
    }
  }

  function labelToAscii(label) {
    const clean = label.toLowerCase();
    if (/^[\x00-\x7f]*$/.test(clean)) return clean;
    try {
      return punycodeEncode(clean);
    } catch (e) {
      return clean;
    }
  }

  function labelToUnicode(label) {
    const clean = label.toLowerCase();
    if (clean.startsWith('xn--')) {
      return punycodeDecode(clean);
    }
    return clean;
  }

  // --- Input Parsing & Validation ---
  function parseWhoisQuery(raw) {
    let s = (raw || '').trim();
    if (!s) {
      return { error: 'Please enter a domain name, IP address or CIDR block.' };
    }

    const hadScheme = /^[a-z][a-z0-9+.\-]*:\/\//i.test(s);
    if (hadScheme) {
      s = s.replace(/^[a-z][a-z0-9+.\-]*:\/\//i, '');
    }
    // Strip ?query and #fragment
    s = s.replace(/[?#][\s\S]*$/, '');
    // Strip user@ before first /
    s = s.replace(/^[^/]*@/, '');

    if (hadScheme && s.indexOf('/') !== -1) {
      s = s.slice(0, s.indexOf('/'));
    } else if (!hadScheme && s.indexOf('/') !== -1) {
      const firstSlash = s.indexOf('/');
      const beforeSlash = s.slice(0, firstSlash);
      const looksLikeIp = beforeSlash.indexOf(':') !== -1 || /^\d+(\.\d+)*$/.test(beforeSlash);
      if (!looksLikeIp) {
        s = beforeSlash;
      }
    }

    // Handle bracketed IPv6 with optional port: [2001:db8::1]:8080
    const bracketMatch = s.match(/^\[([^\]]+)\](?::\d+)?(\/.*)?$/);
    if (bracketMatch) {
      s = bracketMatch[1] + (bracketMatch[2] || '');
    } else {
      // Strip :port when there is only a single colon (host:port or ipv4:port)
      const colonCount = (s.match(/:/g) || []).length;
      if (colonCount === 1 && /:\d+$/.test(s)) {
        s = s.replace(/:\d+$/, '');
      }
    }

    s = s.trim().replace(/\.+$/, '');
    if (!s) {
      return { error: 'Please enter a domain name, IP address or CIDR block.' };
    }

    // 1. AS Number check (AS15169, AS 15169, ASN15169, or bare 15169)
    const asnMatch = s.match(/^(?:asn?\s*)?(\d+)$/i);
    if (asnMatch) {
      const num = Number(asnMatch[1]);
      if (!Number.isInteger(num) || num < 1 || num > 4294967295) {
        return { error: 'Enter a valid AS number from AS1 to AS4294967295 (for example AS15169).' };
      }
      return {
        kind: 'asn',
        asn: num,
        query: String(num),
        display: `AS${num}`,
        normalizedInput: `AS${num}`
      };
    }
    if (/\s/.test(s)) {
      return { error: 'Invalid input: spaces are not allowed.' };
    }
    if (!s.includes('.') && !s.includes(':') && /^asn?[-0-9]*$/i.test(s)) {
      return { error: 'Enter a valid AS number (for example AS15169).' };
    }

    // Separate optional CIDR /prefix
    let addrPart = s;
    let prefixPart = null;
    if (s.indexOf('/') !== -1) {
      const parts = s.split('/');
      if (parts.length !== 2) {
        return { error: 'Invalid CIDR notation. Use a single slash, for example 192.0.2.0/24.' };
      }
      addrPart = parts[0].trim().replace(/\.+$/, '');
      prefixPart = parts[1].trim();
    }

    // 2. IPv6 or IPv6 CIDR
    if (addrPart.indexOf(':') !== -1) {
      const v6Big = parseIPv6(addrPart);
      if (v6Big === null) {
        return { error: 'Invalid IPv6 address. Enter valid hexadecimal blocks separated by colons.' };
      }
      const normIp = formatIPv6Compressed(v6Big);
      let pLen = null;
      if (prefixPart !== null) {
        if (!/^\d{1,3}$/.test(prefixPart)) {
          return { error: 'IPv6 prefix length must be a whole number from 0 to 128.' };
        }
        pLen = parseInt(prefixPart, 10);
        if (pLen < 0 || pLen > 128) {
          return { error: 'IPv6 prefix length must be from 0 to 128.' };
        }
      }
      const fullStr = pLen !== null ? `${normIp}/${pLen}` : normIp;
      return {
        kind: 'ipv6',
        ip: normIp,
        bigInt: v6Big,
        prefix: pLen,
        query: fullStr,
        display: fullStr,
        normalizedInput: fullStr
      };
    }

    // 3. IPv4 or IPv4 CIDR
    const looksNumericDots = /^\d+(\.\d+)*$/.test(addrPart);
    if (prefixPart !== null || looksNumericDots) {
      if (!validateIPv4(addrPart)) {
        return { error: 'Invalid IPv4 address. Enter four octets from 0 to 255 (for example 8.8.8.8).' };
      }
      let pLen = null;
      if (prefixPart !== null) {
        if (!/^\d{1,2}$/.test(prefixPart)) {
          return { error: 'IPv4 prefix length must be a whole number from 0 to 32.' };
        }
        pLen = parseInt(prefixPart, 10);
        if (pLen < 0 || pLen > 32) {
          return { error: 'IPv4 prefix length must be from 0 to 32.' };
        }
      }
      const fullStr = pLen !== null ? `${addrPart}/${pLen}` : addrPart;
      return {
        kind: 'ipv4',
        ip: addrPart,
        uint32: ipToUint32(addrPart),
        prefix: pLen,
        query: fullStr,
        display: fullStr,
        normalizedInput: fullStr
      };
    }

    // 4. Domain name
    if (!addrPart.includes('.')) {
      return { error: 'Enter a full domain name, for example example.com.' };
    }
    if (addrPart.includes('_')) {
      return { error: 'Invalid domain name: underscores (_) are not allowed in domain names.' };
    }
    const rawLabels = addrPart.toLowerCase().split('.');
    if (rawLabels.some((l) => !l)) {
      return { error: 'Invalid domain name.' };
    }
    const asciiLabels = [];
    for (let i = 0; i < rawLabels.length; i++) {
      const al = labelToAscii(rawLabels[i]);
      if (al.length < 1 || al.length > 63 || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(al)) {
        return { error: 'Invalid domain name: each label must be 1 to 63 letters, digits or hyphens, and cannot start or end with a hyphen.' };
      }
      asciiLabels.push(al);
    }
    const tld = asciiLabels[asciiLabels.length - 1];
    if (/^\d+$/.test(tld) || tld.length < 2) {
      return { error: 'Invalid domain name: the top-level domain cannot be all numbers.' };
    }
    const asciiDomain = asciiLabels.join('.');
    if (asciiDomain.length > 253) {
      return { error: 'Invalid domain name: domain exceeds 253 characters.' };
    }
    const unicodeDomain = asciiLabels.map(labelToUnicode).join('.');
    return {
      kind: 'domain',
      ascii: asciiDomain,
      unicode: unicodeDomain,
      query: asciiDomain,
      display: unicodeDomain !== asciiDomain ? `${unicodeDomain} (${asciiDomain})` : asciiDomain,
      normalizedInput: unicodeDomain
    };
  }

  // --- Reserved IPv4 / IPv6 Detection ---
  const RESERVED_IPV4 = [
    { cidr: '0.0.0.0/8', name: 'Current network ("This network")', rfc: 'RFC 1122' },
    { cidr: '10.0.0.0/8', name: 'Private-Use network', rfc: 'RFC 1918' },
    { cidr: '100.64.0.0/10', name: 'Shared Address Space (CGNAT)', rfc: 'RFC 6598' },
    { cidr: '127.0.0.0/8', name: 'Loopback address block', rfc: 'RFC 1122' },
    { cidr: '169.254.0.0/16', name: 'Link-Local address block (APIPA)', rfc: 'RFC 3927' },
    { cidr: '172.16.0.0/12', name: 'Private-Use network', rfc: 'RFC 1918' },
    { cidr: '192.0.0.0/24', name: 'IETF Protocol Assignments', rfc: 'RFC 6890' },
    { cidr: '192.0.2.0/24', name: 'Documentation (TEST-NET-1)', rfc: 'RFC 5737' },
    { cidr: '192.168.0.0/16', name: 'Private-Use network', rfc: 'RFC 1918' },
    { cidr: '198.18.0.0/15', name: 'Network Benchmarking', rfc: 'RFC 2544' },
    { cidr: '198.51.100.0/24', name: 'Documentation (TEST-NET-2)', rfc: 'RFC 5737' },
    { cidr: '203.0.113.0/24', name: 'Documentation (TEST-NET-3)', rfc: 'RFC 5737' },
    { cidr: '224.0.0.0/4', name: 'IPv4 Multicast', rfc: 'RFC 5771' },
    { cidr: '240.0.0.0/4', name: 'Reserved for Future Use / Broadcast', rfc: 'RFC 1112' }
  ];

  const RESERVED_IPV6 = [
    { cidr: '::/128', name: 'Unspecified Address', rfc: 'RFC 4291' },
    { cidr: '::1/128', name: 'Loopback Address', rfc: 'RFC 4291' },
    { cidr: '::ffff:0:0/96', name: 'IPv4-Mapped Address block', rfc: 'RFC 4291' },
    { cidr: '64:ff9b::/96', name: 'IPv4-IPv6 Translation (NAT64)', rfc: 'RFC 6052' },
    { cidr: '100::/64', name: 'Discard-Only Address Block', rfc: 'RFC 6666' },
    { cidr: '2001:db8::/32', name: 'Documentation Address Block', rfc: 'RFC 3849' },
    { cidr: 'fc00::/7', name: 'Unique Local Address (ULA)', rfc: 'RFC 4193' },
    { cidr: 'fe80::/10', name: 'Link-Local Unicast', rfc: 'RFC 4291' },
    { cidr: 'ff00::/8', name: 'IPv6 Multicast', rfc: 'RFC 4291' }
  ];

  function v4MatchesCidr(ipUint32, cidrStr) {
    const [baseIp, pStr] = cidrStr.split('/');
    const pLen = parseInt(pStr, 10);
    if (pLen === 0) return { match: true, pLen: 0 };
    const mask = (~0 << (32 - pLen)) >>> 0;
    const baseUint = ipToUint32(baseIp);
    return { match: ((ipUint32 & mask) >>> 0) === ((baseUint & mask) >>> 0), pLen: pLen };
  }

  function v6MatchesCidr(ipBig, cidrStr) {
    const [baseIp, pStr] = cidrStr.split('/');
    const pLen = parseInt(pStr, 10);
    const baseBig = parseIPv6(baseIp);
    if (baseBig === null) return { match: false, pLen: 0 };
    if (pLen === 0) return { match: true, pLen: 0 };
    const shift = window.BigInt(128 - pLen);
    return { match: (ipBig >> shift) === (baseBig >> shift), pLen: pLen };
  }

  function checkReservedIp(parsed) {
    if (parsed.kind === 'ipv4') {
      for (let i = 0; i < RESERVED_IPV4.length; i++) {
        const entry = RESERVED_IPV4[i];
        const m = v4MatchesCidr(parsed.uint32, entry.cidr);
        if (m.match && (parsed.prefix === null || parsed.prefix >= m.pLen)) {
          return entry;
        }
      }
    } else if (parsed.kind === 'ipv6') {
      for (let i = 0; i < RESERVED_IPV6.length; i++) {
        const entry = RESERVED_IPV6[i];
        const m = v6MatchesCidr(parsed.bigInt, entry.cidr);
        if (m.match && (parsed.prefix === null || parsed.prefix >= m.pLen)) {
          return entry;
        }
      }
    }
    return null;
  }

  // --- Range to Minimal CIDR List ---
  function rangeToCidrs(startBig, endBig, totalBits, fmtFn) {
    const BI = window.BigInt;
    const out = [];
    let cur = startBig;
    while (cur <= endBig && out.length < 64) {
      let maxBits = 0;
      while (maxBits < totalBits) {
        const nextBits = maxBits + 1;
        const blockSize = BI(1) << BI(nextBits);
        if ((cur & (blockSize - BI(1))) !== BI(0)) break;
        if (cur + blockSize - BI(1) > endBig) break;
        maxBits = nextBits;
      }
      const prefixLen = totalBits - maxBits;
      out.push(`${fmtFn(cur)}/${prefixLen}`);
      cur += BI(1) << BI(maxBits);
    }
    return out;
  }

  function computeMinimalCidrs(startAddr, endAddr) {
    if (!startAddr || !endAddr) return [];
    const sTrim = String(startAddr).trim();
    const eTrim = String(endAddr).trim();
    const BI = window.BigInt;
    if (validateIPv4(sTrim) && validateIPv4(eTrim)) {
      const sBig = BI(ipToUint32(sTrim));
      const eBig = BI(ipToUint32(eTrim));
      if (sBig > eBig) return [];
      return rangeToCidrs(sBig, eBig, 32, (b) => uint32ToIp(Number(b)));
    }
    if (sTrim.indexOf(':') !== -1 && eTrim.indexOf(':') !== -1) {
      const sBig = parseIPv6(sTrim);
      const eBig = parseIPv6(eTrim);
      if (sBig === null || eBig === null || sBig > eBig) return [];
      return rangeToCidrs(sBig, eBig, 128, (b) => formatIPv6Compressed(b));
    }
    return [];
  }

  // --- HTTP & IANA Bootstrap ---
  async function httpGetJson(url, signal, logRequest) {
    const reqStart = performance.now();
    const logReqOutcome = (statusOrKind) => {
      if (logRequest && window.APP_DEBUG_ENABLED) {
        const ms = Math.max(0, Math.round(performance.now() - reqStart));
        whoisLog(`request: host=${safeHostOf(url)} | status=${statusOrKind} | ms=${ms}`);
      }
    };

    const hasCapHttp = !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp && typeof window.Capacitor.Plugins.CapacitorHttp.get === 'function');
    if (hasCapHttp) {
      let timeoutId = null;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          const err = new Error('Timeout');
          err.kind = 'timeout';
          reject(err);
        }, REQUEST_TIMEOUT_MS);
      });
      try {
        const res = await Promise.race([
          window.Capacitor.Plugins.CapacitorHttp.get({
            url: url,
            headers: { Accept: 'application/rdap+json, application/json' },
            responseType: 'text',
            connectTimeout: REQUEST_TIMEOUT_MS,
            readTimeout: REQUEST_TIMEOUT_MS
          }),
          timeoutPromise
        ]);
        if (timeoutId) clearTimeout(timeoutId);
        const status = res && typeof res.status === 'number' ? res.status : 0;
        if (status < 200 || status >= 300) {
          const err = new Error(`HTTP ${status}`);
          err.status = status;
          throw err;
        }
        let body = res.data;
        if (typeof body === 'string') {
          try {
            body = JSON.parse(body);
          } catch (e) {
            const jErr = new Error('Invalid JSON');
            jErr.kind = 'json';
            throw jErr;
          }
        }
        if (!body || typeof body !== 'object') {
          const jErr = new Error('Invalid JSON');
          jErr.kind = 'json';
          throw jErr;
        }
        logReqOutcome(status);
        return body;
      } catch (e) {
        if (timeoutId) clearTimeout(timeoutId);
        if (e && (e.kind === 'timeout' || /timeout|timed out/i.test(e.message || ''))) {
          logReqOutcome('timeout');
          const tErr = new Error('Timeout');
          tErr.kind = 'timeout';
          throw tErr;
        }
        const statusOrKind = (e && typeof e.status === 'number' && e.status > 0)
          ? String(e.status)
          : (e && e.kind ? e.kind : 'network');
        logReqOutcome(statusOrKind);
        throw e;
      }
    }

    // Plain browser fetch with timeout
    const ctrl = new window.AbortController();
    const onAbort = () => ctrl.abort();
    if (signal) {
      if (signal.aborted) ctrl.abort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/rdap+json, application/json' },
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (!response.ok) {
        const err = new Error(`HTTP ${response.status}`);
        err.status = response.status;
        throw err;
      }
      const text = await response.text();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        const jErr = new Error('Invalid JSON');
        jErr.kind = 'json';
        throw jErr;
      }
      if (!parsed || typeof parsed !== 'object') {
        const jErr = new Error('Invalid JSON');
        jErr.kind = 'json';
        throw jErr;
      }
      logReqOutcome(response.status);
      return parsed;
    } catch (e) {
      clearTimeout(timer);
      if (timedOut) {
        logReqOutcome('timeout');
        const tErr = new Error('Timeout');
        tErr.kind = 'timeout';
        throw tErr;
      }
      const statusOrKind = (e && typeof e.status === 'number' && e.status > 0)
        ? String(e.status)
        : (e && e.kind ? e.kind : (e && e.name === 'AbortError' ? 'aborted' : 'network'));
      logReqOutcome(statusOrKind);
      throw e;
    } finally {
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  }

  function ensureTrailingSlash(url) {
    if (!url) return RDAP_FALLBACK_BASE;
    return url.endsWith('/') ? url : url + '/';
  }

  function pickBaseUrl(urls) {
    if (!Array.isArray(urls) || urls.length === 0) return null;
    const https = urls.find((u) => typeof u === 'string' && u.toLowerCase().startsWith('https://'));
    return ensureTrailingSlash(https || urls[0]);
  }

  async function getBootstrapServices(kind, signal) {
    const t0 = performance.now();
    const cacheKey = `isubnet_rdap_boot_${kind}`;
    let cacheState = 'miss';
    try {
      const rawCache = localStorage.getItem(cacheKey);
      if (rawCache) {
        const cached = JSON.parse(rawCache);
        if (cached && typeof cached.ts === 'number' && Array.isArray(cached.services)) {
          if ((Date.now() - cached.ts) < BOOTSTRAP_TTL_MS) {
            if (window.APP_DEBUG_ENABLED) {
              const ms = Math.max(0, Math.round(performance.now() - t0));
              whoisLog(`bootstrap: kind=${kind} | cache=hit | ms=${ms}`);
            }
            return cached.services;
          }
          cacheState = 'expired';
        }
      }
    } catch (e) { /* ignore localStorage errors */ }

    const url = BOOTSTRAP_URLS[kind];
    if (!url) return null;
    try {
      const data = await httpGetJson(url, signal, false);
      if (window.APP_DEBUG_ENABLED) {
        const ms = Math.max(0, Math.round(performance.now() - t0));
        whoisLog(`bootstrap: kind=${kind} | cache=${cacheState} | ms=${ms}`);
      }
      if (data && Array.isArray(data.services)) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), services: data.services }));
        } catch (e) { /* ignore localStorage quota/disabled */ }
        return data.services;
      }
    } catch (e) {
      if (window.APP_DEBUG_ENABLED) {
        const ms = Math.max(0, Math.round(performance.now() - t0));
        whoisLog(`bootstrap: kind=${kind} | cache=${cacheState} | ms=${ms}`);
      }
    }
    return null;
  }

  async function resolveRdapBase(parsed, domainOverride, signal) {
    if (parsed.kind === 'domain') {
      const services = await getBootstrapServices('dns', signal);
      if (!services) {
        if (window.APP_DEBUG_ENABLED) whoisLog('bootstrap: no match -> rdap.org');
        return RDAP_FALLBACK_BASE;
      }
      const dom = (domainOverride || parsed.ascii).toLowerCase();
      let bestKeyLen = -1;
      let bestUrl = null;
      for (let i = 0; i < services.length; i++) {
        const entry = services[i];
        if (!Array.isArray(entry) || entry.length < 2) continue;
        const keys = entry[0] || [];
        const urls = entry[1] || [];
        for (let j = 0; j < keys.length; j++) {
          const k = String(keys[j]).toLowerCase().replace(/^\.+|\.+$/g, '');
          if (!k) continue;
          if (dom === k || dom.endsWith('.' + k)) {
            if (k.length > bestKeyLen) {
              bestKeyLen = k.length;
              bestUrl = pickBaseUrl(urls);
            }
          }
        }
      }
      if (!bestUrl) {
        if (window.APP_DEBUG_ENABLED) whoisLog('bootstrap: no match -> rdap.org');
        return RDAP_FALLBACK_BASE;
      }
      return bestUrl;
    }

    if (parsed.kind === 'ipv4') {
      const services = await getBootstrapServices('ipv4', signal);
      if (!services) {
        if (window.APP_DEBUG_ENABLED) whoisLog('bootstrap: no match -> rdap.org');
        return RDAP_FALLBACK_BASE;
      }
      let bestPLen = -1;
      let bestUrl = null;
      for (let i = 0; i < services.length; i++) {
        const entry = services[i];
        if (!Array.isArray(entry) || entry.length < 2) continue;
        const keys = entry[0] || [];
        const urls = entry[1] || [];
        for (let j = 0; j < keys.length; j++) {
          const m = v4MatchesCidr(parsed.uint32, String(keys[j]));
          if (m.match && m.pLen > bestPLen) {
            bestPLen = m.pLen;
            bestUrl = pickBaseUrl(urls);
          }
        }
      }
      if (!bestUrl) {
        if (window.APP_DEBUG_ENABLED) whoisLog('bootstrap: no match -> rdap.org');
        return RDAP_FALLBACK_BASE;
      }
      return bestUrl;
    }

    if (parsed.kind === 'ipv6') {
      const services = await getBootstrapServices('ipv6', signal);
      if (!services) {
        if (window.APP_DEBUG_ENABLED) whoisLog('bootstrap: no match -> rdap.org');
        return RDAP_FALLBACK_BASE;
      }
      let bestPLen = -1;
      let bestUrl = null;
      for (let i = 0; i < services.length; i++) {
        const entry = services[i];
        if (!Array.isArray(entry) || entry.length < 2) continue;
        const keys = entry[0] || [];
        const urls = entry[1] || [];
        for (let j = 0; j < keys.length; j++) {
          const m = v6MatchesCidr(parsed.bigInt, String(keys[j]));
          if (m.match && m.pLen > bestPLen) {
            bestPLen = m.pLen;
            bestUrl = pickBaseUrl(urls);
          }
        }
      }
      if (!bestUrl) {
        if (window.APP_DEBUG_ENABLED) whoisLog('bootstrap: no match -> rdap.org');
        return RDAP_FALLBACK_BASE;
      }
      return bestUrl;
    }

    if (parsed.kind === 'asn') {
      const services = await getBootstrapServices('asn', signal);
      if (!services) {
        if (window.APP_DEBUG_ENABLED) whoisLog('bootstrap: no match -> rdap.org');
        return RDAP_FALLBACK_BASE;
      }
      let bestSpan = Infinity;
      let bestUrl = null;
      for (let i = 0; i < services.length; i++) {
        const entry = services[i];
        if (!Array.isArray(entry) || entry.length < 2) continue;
        const keys = entry[0] || [];
        const urls = entry[1] || [];
        for (let j = 0; j < keys.length; j++) {
          const k = String(keys[j]).trim();
          const rangeParts = k.split('-');
          const lo = parseInt(rangeParts[0], 10);
          const hi = rangeParts.length > 1 ? parseInt(rangeParts[1], 10) : lo;
          if (!isNaN(lo) && !isNaN(hi) && parsed.asn >= lo && parsed.asn <= hi) {
            const span = hi - lo;
            if (span < bestSpan) {
              bestSpan = span;
              bestUrl = pickBaseUrl(urls);
            }
          }
        }
      }
      if (!bestUrl) {
        if (window.APP_DEBUG_ENABLED) whoisLog('bootstrap: no match -> rdap.org');
        return RDAP_FALLBACK_BASE;
      }
      return bestUrl;
    }

    return RDAP_FALLBACK_BASE;
  }

  // --- RDAP Data Extraction & Formatting Helpers ---
  function formatIsoDate(isoStr) {
    if (!isoStr || typeof isoStr !== 'string') return null;
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function describeAge(isoStr) {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return '';
    if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} old`;
    if (diffDays < 365) {
      const m = Math.round(diffDays / 30.44);
      return `${m} ${m === 1 ? 'month' : 'months'} old`;
    }
    const y = Math.floor(diffDays / 365.25);
    return `${y} ${y === 1 ? 'year' : 'years'} old`;
  }

  function describeExpiry(isoStr) {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;
    const diffDays = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      const ago = Math.abs(diffDays);
      return {
        chipText: ago === 0 ? 'Expired today' : `Expired ${ago} ${ago === 1 ? 'day' : 'days'} ago`,
        detailText: 'expired',
        level: 'bad'
      };
    }
    if (diffDays <= 30) {
      return {
        chipText: diffDays === 0 ? 'Expires today' : `Expires in ${diffDays} ${diffDays === 1 ? 'day' : 'days'}`,
        detailText: `in ${diffDays} ${diffDays === 1 ? 'day' : 'days'}`,
        level: 'warn'
      };
    }
    if (diffDays < 60) {
      return {
        chipText: `Expires in ${diffDays} days`,
        detailText: `in ${diffDays} days`,
        level: 'good'
      };
    }
    const months = Math.round(diffDays / 30.44);
    return {
      chipText: `Expires in ${months} months`,
      detailText: `in ${months} months`,
      level: 'good'
    };
  }

  function extractEvents(eventsArr) {
    const out = { registered: null, updated: null, expires: null };
    if (!Array.isArray(eventsArr)) return out;
    eventsArr.forEach((ev) => {
      if (!ev || !ev.eventAction || !ev.eventDate) return;
      const act = String(ev.eventAction).toLowerCase();
      if (act === 'registration' && !out.registered) out.registered = ev.eventDate;
      else if ((act === 'last changed' || act === 'last update of rdap database') && !out.updated) out.updated = ev.eventDate;
      else if (act === 'expiration' && !out.expires) out.expires = ev.eventDate;
    });
    return out;
  }

  function isRedactedValue(str) {
    if (!str) return false;
    return /redacted|privacy|data protected|not disclosed|gdpr|withheld for privacy|statutory masking|select contact domain holder/i.test(String(str));
  }

  function parseVcard(vcardArray, remarksArr) {
    const info = { fn: '', org: '', email: '', tel: '', adr: '', redacted: false };
    if (Array.isArray(remarksArr)) {
      remarksArr.forEach((r) => {
        const title = r && r.title ? r.title : '';
        const desc = r && Array.isArray(r.description) ? r.description.join(' ') : '';
        if (isRedactedValue(title) || isRedactedValue(desc)) info.redacted = true;
      });
    }
    if (!Array.isArray(vcardArray) || vcardArray.length < 2 || !Array.isArray(vcardArray[1])) {
      return info;
    }
    const props = vcardArray[1];
    props.forEach((prop) => {
      if (!Array.isArray(prop) || prop.length < 4) return;
      const name = String(prop[0] || '').toLowerCase();
      const params = prop[1] && typeof prop[1] === 'object' ? prop[1] : {};
      const val = prop[3];
      if (name === 'fn' && typeof val === 'string' && val.trim()) {
        if (isRedactedValue(val)) info.redacted = true;
        else if (!info.fn) info.fn = val.trim();
      } else if (name === 'org') {
        const orgStr = Array.isArray(val) ? val.filter(Boolean).join(', ').trim() : (typeof val === 'string' ? val.trim() : '');
        if (orgStr) {
          if (isRedactedValue(orgStr)) info.redacted = true;
          else if (!info.org) info.org = orgStr;
        }
      } else if (name === 'email' && typeof val === 'string' && val.trim()) {
        const em = val.replace(/^mailto:/i, '').trim();
        if (isRedactedValue(em)) info.redacted = true;
        else if (!info.email) info.email = em;
      } else if (name === 'tel' && typeof val === 'string' && val.trim()) {
        const tel = val.replace(/^tel:/i, '').trim();
        if (isRedactedValue(tel)) info.redacted = true;
        else if (!info.tel) info.tel = tel;
      } else if (name === 'adr') {
        let adrStr = '';
        if (typeof params.label === 'string' && params.label.trim()) {
          adrStr = params.label.replace(/\r?\n/g, ', ').trim();
        } else if (Array.isArray(val)) {
          adrStr = val.map((x) => (Array.isArray(x) ? x.join(' ') : String(x || '')).trim()).filter(Boolean).join(', ');
        } else if (typeof val === 'string') {
          adrStr = val.trim();
        }
        if (adrStr) {
          if (isRedactedValue(adrStr)) info.redacted = true;
          else if (!info.adr) info.adr = adrStr;
        }
      }
    });
    return info;
  }

  function flattenEntities(entitiesArr, out) {
    if (!Array.isArray(entitiesArr)) return out;
    entitiesArr.forEach((ent) => {
      if (!ent || typeof ent !== 'object') return;
      out.push(ent);
      if (Array.isArray(ent.entities)) {
        flattenEntities(ent.entities, out);
      }
    });
    return out;
  }

  function extractRegistrarInfo(data) {
    const reg = { name: '', ianaId: '', abuseEmail: '', abusePhone: '' };
    const all = flattenEntities(data && data.entities, []);
    all.forEach((ent) => {
      const roles = Array.isArray(ent.roles) ? ent.roles.map((r) => String(r).toLowerCase()) : [];
      const vc = parseVcard(ent.vcardArray, ent.remarks);
      if (roles.indexOf('registrar') !== -1) {
        if (!reg.name) reg.name = vc.fn || vc.org || (typeof ent.handle === 'string' ? ent.handle : '');
        if (Array.isArray(ent.publicIds)) {
          ent.publicIds.forEach((pid) => {
            if (pid && pid.identifier && !reg.ianaId) reg.ianaId = String(pid.identifier);
          });
        }
        if (!reg.ianaId && typeof ent.handle === 'string' && /^\d+$/.test(ent.handle)) {
          reg.ianaId = ent.handle;
        }
      }
      if (roles.indexOf('abuse') !== -1) {
        if (!reg.abuseEmail && vc.email) reg.abuseEmail = vc.email;
        if (!reg.abusePhone && vc.tel) reg.abusePhone = vc.tel;
      }
    });
    return reg;
  }

  function extractContacts(data, includeOrgAndAbuse) {
    const all = flattenEntities(data && data.entities, []);
    const wantedRoles = includeOrgAndAbuse
      ? ['registrant', 'organization', 'administrative', 'technical', 'abuse', 'noc']
      : ['registrant', 'administrative', 'technical'];
    const roleLabels = {
      registrant: 'Registrant',
      organization: 'Organisation',
      administrative: 'Administrative',
      technical: 'Technical',
      abuse: 'Abuse',
      noc: 'NOC'
    };
    const contacts = [];
    const seenRoleKey = {};

    all.forEach((ent) => {
      const roles = Array.isArray(ent.roles) ? ent.roles.map((r) => String(r).toLowerCase()) : [];
      const vc = parseVcard(ent.vcardArray, ent.remarks);
      const entRedacted = Array.isArray(ent.redacted) && ent.redacted.length > 0;
      roles.forEach((r) => {
        if (wantedRoles.indexOf(r) === -1) return;
        const hasFields = !!(vc.fn || vc.org || vc.email || vc.tel || vc.adr);
        const isRed = vc.redacted || entRedacted;
        const dedupKey = `${r}|${vc.fn}|${vc.org}|${vc.email}|${vc.tel}|${isRed ? 'red' : ''}`;
        if (seenRoleKey[dedupKey]) return;
        seenRoleKey[dedupKey] = true;
        if (!hasFields && !isRed && !(includeOrgAndAbuse && ent.handle)) return;
        contacts.push({
          role: roleLabels[r] || r,
          fn: vc.fn,
          org: vc.org,
          email: vc.email,
          tel: vc.tel,
          adr: vc.adr,
          handle: typeof ent.handle === 'string' ? ent.handle : '',
          redacted: isRed && !hasFields
        });
      });
    });

    // Only synthesize a redacted Registrant card if the record explicitly has a non-empty RFC 9537 redacted array
    if (!includeOrgAndAbuse && contacts.length === 0 && data && Array.isArray(data.redacted) && data.redacted.length > 0) {
      contacts.push({
        role: 'Registrant',
        fn: '',
        org: '',
        email: '',
        tel: '',
        adr: '',
        handle: '',
        redacted: true
      });
    }
    return contacts;
  }

  function detectRirName(data, sourceHost) {
    const hay = `${data && data.port43 ? data.port43 : ''} ${sourceHost || ''}`.toLowerCase();
    if (hay.indexOf('arin') !== -1) return 'ARIN';
    if (hay.indexOf('ripe') !== -1) return 'RIPE NCC';
    if (hay.indexOf('apnic') !== -1) return 'APNIC';
    if (hay.indexOf('lacnic') !== -1) return 'LACNIC';
    if (hay.indexOf('afrinic') !== -1) return 'AFRINIC';
    return '';
  }

  function findRelatedRegistrarUrl(data, primaryUrl) {
    if (!data || !Array.isArray(data.links)) return null;
    let primaryHost = '';
    try { primaryHost = new URL(primaryUrl).hostname.toLowerCase(); } catch (e) { /* ignore */ }
    for (let i = 0; i < data.links.length; i++) {
      const lnk = data.links[i];
      if (!lnk || typeof lnk.href !== 'string') continue;
      const rel = String(lnk.rel || '').toLowerCase();
      if (rel !== 'related') continue;
      const href = lnk.href.trim();
      if (!/^https?:\/\//i.test(href)) continue;
      try {
        const u = new URL(href);
        if (u.hostname.toLowerCase() === primaryHost) continue;
        if (/\/domain\//i.test(u.pathname) || String(lnk.type || '').toLowerCase().indexOf('rdap') !== -1) {
          return href;
        }
      } catch (e) { /* ignore */ }
    }
    return null;
  }

  // --- Safe DOM Builders (strictly textContent, never innerHTML) ---
  function createSection(titleText) {
    const sec = document.createElement('div');
    sec.className = 'whois-section';
    if (titleText) {
      const h = document.createElement('div');
      h.className = 'whois-section-title';
      h.textContent = titleText;
      sec.appendChild(h);
    }
    return sec;
  }

  function appendKvRow(parent, label, val, plainLines) {
    if (val === null || val === undefined) return;
    const str = String(val).trim();
    if (!str || str === 'undefined' || str === 'null') return;
    const row = document.createElement('div');
    row.className = 'whois-kv-row';
    const lEl = document.createElement('span');
    lEl.className = 'whois-kv-label';
    lEl.textContent = label;
    const vEl = document.createElement('span');
    vEl.className = 'whois-kv-val';
    vEl.textContent = str;
    row.appendChild(lEl);
    row.appendChild(vEl);
    parent.appendChild(row);
    if (plainLines) plainLines.push(`${label}: ${str}`);
  }

  function addChip(text, levelClass) {
    if (!chipsRow || !text) return;
    const chip = document.createElement('span');
    chip.className = `whois-chip${levelClass ? ' ' + levelClass : ''}`;
    chip.textContent = text;
    chipsRow.appendChild(chip);
  }

  function explainEppStatus(rawCode) {
    const clean = String(rawCode || '').trim();
    const key = clean.toLowerCase().replace(/[\s_\-]/g, '');
    if (EPP_STATUS_INFO[key]) return EPP_STATUS_INFO[key];
    return { code: clean, desc: 'Registry status flag.' };
  }

  function renderContactsSection(container, contacts, plainLines, sectionTitle) {
    if (!contacts || contacts.length === 0) return;
    const sec = createSection(sectionTitle || 'Contacts');
    if (plainLines) plainLines.push(`\n[${sectionTitle || 'Contacts'}]`);
    contacts.forEach((c) => {
      const card = document.createElement('div');
      card.className = 'whois-contact-card';
      const roleEl = document.createElement('div');
      roleEl.className = 'whois-contact-role';
      roleEl.textContent = c.role;
      card.appendChild(roleEl);

      if (c.redacted) {
        const red = document.createElement('div');
        red.className = 'whois-contact-redacted';
        red.textContent = 'Redacted for privacy';
        card.appendChild(red);
        if (plainLines) plainLines.push(`${c.role}: Redacted for privacy`);
      } else {
        if (plainLines) plainLines.push(`${c.role}:`);
        if (c.fn) appendKvRow(card, 'Name', c.fn, plainLines);
        if (c.org && c.org !== c.fn) appendKvRow(card, 'Organisation', c.org, plainLines);
        if (c.handle && !c.fn && !c.org) appendKvRow(card, 'Handle', c.handle, plainLines);
        if (c.email) appendKvRow(card, 'Email', c.email, plainLines);
        if (c.tel) appendKvRow(card, 'Phone', c.tel, plainLines);
        if (c.adr) appendKvRow(card, 'Address', c.adr, plainLines);
      }
      sec.appendChild(card);
    });
    container.appendChild(sec);
  }

  function renderRemarksSection(container, remarksArr, plainLines) {
    if (!Array.isArray(remarksArr) || remarksArr.length === 0) return;
    const texts = [];
    remarksArr.forEach((r) => {
      if (!r) return;
      const title = typeof r.title === 'string' ? r.title.trim() : '';
      const desc = Array.isArray(r.description) ? r.description.map((d) => String(d || '').trim()).filter(Boolean).join('\n') : '';
      const combined = [title, desc].filter(Boolean).join(': ');
      if (combined && texts.indexOf(combined) === -1) texts.push(combined);
    });
    if (texts.length === 0) return;
    const sec = createSection('Remarks');
    const p = document.createElement('div');
    p.className = 'whois-remarks';
    p.textContent = texts.slice(0, 4).join('\n\n');
    sec.appendChild(p);
    container.appendChild(sec);
    if (plainLines) {
      plainLines.push('\n[Remarks]');
      plainLines.push(texts.slice(0, 4).join('\n'));
    }
  }

  // --- Open In Buttons ---
  function openInTool(toolId, targetVal) {
    if (window.APP_DEBUG_ENABLED) whoisLog(`ui: open-in tap target=${toolId}`);
    const tool = TOOLS_LIST.find((t) => t.id === toolId);
    if (!tool) return;
    const isLocked = tool.pro && !isProNow();
    if (isLocked) {
      showProModal(tool.feature || 'dns');
      return;
    }
    openTool(tool);
    if (toolId === 'dns') {
      const el = document.getElementById('dns-input');
      if (el) {
        el.value = targetVal;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else if (toolId === 'ping') {
      const el = document.getElementById('ping-input');
      if (el) {
        el.value = targetVal;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else if (toolId === 'traceroute') {
      const el = document.getElementById('trace-input');
      if (el) {
        el.value = targetVal;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  function openInSubnetCalculator(parsed, fallbackCidr) {
    if (window.APP_DEBUG_ENABLED) whoisLog('ui: open-in tap target=subnet-calculator');
    const calcTabBtn = document.querySelector('.tab-btn[data-target="calculator-tab"]');
    if (calcTabBtn) calcTabBtn.click();
    const isV6 = parsed.kind === 'ipv6';
    const subBtn = document.querySelector(`.calc-sub-tab-btn[data-sub-target="${isV6 ? 'calc-ipv6-panel' : 'calc-ipv4-panel'}"]`);
    if (subBtn) subBtn.click();
    const singleBtn = document.querySelector(`${isV6 ? '.calc-mode-btn-v6' : '.calc-mode-btn-v4'}[data-mode="single"]`);
    if (singleBtn) singleBtn.click();

    const valueToFill = fallbackCidr || parsed.query || parsed.ip;
    if (isV6) {
      const hostsEl = document.getElementById('ipv6-hosts');
      if (hostsEl) hostsEl.value = '';
      const addrEl = document.getElementById('ipv6-address');
      if (addrEl) {
        addrEl.value = valueToFill;
        if (typeof calculateIPv6 === 'function') calculateIPv6();
      }
    } else {
      const hostsEl = document.getElementById('ipv4-hosts');
      if (hostsEl) hostsEl.value = '';
      const addrEl = document.getElementById('ipv4-address');
      if (addrEl) {
        addrEl.value = valueToFill;
        if (typeof calculateIPv4 === 'function') calculateIPv4();
      }
    }
  }

  function renderOpenInButtons(parsed, firstNetworkCidr) {
    if (!openInBox) return;
    openInBox.textContent = '';
    if (!parsed || parsed.kind === 'asn') {
      openInBox.style.display = 'none';
      return;
    }

    const label = document.createElement('div');
    label.className = 'whois-open-label';
    label.textContent = 'Open in';
    const row = document.createElement('div');
    row.className = 'whois-open-btns';

    const hostTarget = parsed.kind === 'domain' ? parsed.ascii : parsed.ip;

    function addBtn(text, onClick) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn-action whois-open-btn';
      b.textContent = text;
      b.addEventListener('click', onClick);
      row.appendChild(b);
    }

    addBtn('DNS Lookup', () => openInTool('dns', hostTarget));
    addBtn('Ping', () => openInTool('ping', hostTarget));
    addBtn('Traceroute', () => openInTool('traceroute', hostTarget));

    if (parsed.kind === 'ipv4' || parsed.kind === 'ipv6') {
      const calcValue = parsed.prefix !== null ? parsed.query : (firstNetworkCidr || parsed.ip);
      addBtn('Subnet Calculator', () => openInSubnetCalculator(parsed, calcValue));
    }

    openInBox.appendChild(label);
    openInBox.appendChild(row);
    openInBox.style.display = 'block';
  }

  // --- Registrar Related Record (Pro / Free Teaser) ---
  function renderRegistrarTeaser() {
    if (!registrarBox) return;
    registrarBox.textContent = '';
    if (!lastRelatedUrl) {
      registrarBox.style.display = 'none';
      return;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'whois-teaser-btn';
    const left = document.createElement('span');
    left.textContent = 'See the registrar’s own record';
    const badge = document.createElement('span');
    badge.className = 'pro-badge';
    badge.textContent = '🔒 Pro';
    btn.appendChild(left);
    btn.appendChild(badge);
    btn.addEventListener('click', () => showProModal('whois'));
    registrarBox.appendChild(btn);
    registrarBox.style.display = 'block';
  }

  async function loadRegistrarRecordForPro(relUrl, seqAtStart) {
    if (!registrarBox || !relUrl) return;
    registrarBox.textContent = '';
    registrarBox.style.display = 'block';
    const loadingSec = createSection('Registrar record');
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'whois-source-line';
    loadingMsg.textContent = 'Loading registrar record…';
    loadingSec.appendChild(loadingMsg);
    registrarBox.appendChild(loadingSec);

    const t0 = Date.now();
    const regHost = safeHostOf(relUrl);
    try {
      const regData = await httpGetJson(relUrl, currentAbort ? currentAbort.signal : null, true);
      if (seqAtStart !== lookupSeq) {
        if (window.APP_DEBUG_ENABLED) whoisLog('lookup: stale response discarded');
        return;
      }
      if (window.APP_DEBUG_ENABLED) {
        whoisLog(`registrar record: fetched host=${regHost} status=200 ms=${Date.now() - t0}`);
      }
      lastRegistrarLoaded = true;
      lastRegistrarRawJson = regData;
      registrarBox.textContent = '';
      const sec = createSection('Registrar record');
      const plainExtra = [];
      let hostLabel = relUrl;
      try { hostLabel = new URL(relUrl).hostname; } catch (e) { /* ignore */ }
      appendKvRow(sec, 'Registrar server', hostLabel, plainExtra);

      const evs = extractEvents(regData.events);
      if (evs.registered) appendKvRow(sec, 'Registered', formatIsoDate(evs.registered), plainExtra);
      if (evs.updated) appendKvRow(sec, 'Updated', formatIsoDate(evs.updated), plainExtra);
      if (evs.expires) appendKvRow(sec, 'Expires', formatIsoDate(evs.expires), plainExtra);

      const regInfo = extractRegistrarInfo(regData);
      if (regInfo.abuseEmail) appendKvRow(sec, 'Abuse email', regInfo.abuseEmail, plainExtra);
      if (regInfo.abusePhone) appendKvRow(sec, 'Abuse phone', regInfo.abusePhone, plainExtra);

      registrarBox.appendChild(sec);
      const regContacts = extractContacts(regData, false);
      renderContactsSection(registrarBox, regContacts, plainExtra, 'Registrar contacts');

      if (plainExtra.length > 0 && lastPlainText) {
        lastPlainText = lastPlainText.replace(/\nSource: /, `\n\n[Registrar record]\n${plainExtra.join('\n')}\n\nSource: `);
      }
      if (rawOpen && rawPre && lastRawJson) {
        rawPre.textContent = formatRawJsonForDisplay();
      }
    } catch (e) {
      if (seqAtStart !== lookupSeq) {
        if (window.APP_DEBUG_ENABLED) whoisLog('lookup: stale response discarded');
        return;
      }
      if (window.APP_DEBUG_ENABLED) {
        const st = e && typeof e.status === 'number' ? e.status : (e && e.kind ? e.kind : 'error');
        whoisLog(`registrar record: fetched host=${regHost} status=${st} ms=${Date.now() - t0}`);
      }
      registrarBox.textContent = '';
      registrarBox.style.display = 'none';
    }
  }

  function formatRawJsonForDisplay() {
    if (!lastRawJson) return '';
    let out = '';
    if (lastRegistrarRawJson) {
      out = `// Registry record\n${JSON.stringify(lastRawJson, null, 2)}\n\n// Registrar record\n${JSON.stringify(lastRegistrarRawJson, null, 2)}`;
    } else {
      out = JSON.stringify(lastRawJson, null, 2);
    }
    if (out.length > 120000) {
      out = out.slice(0, 120000) + '\n... (truncated)';
    }
    return out;
  }

  function logWhoisResultShape(data, contacts, cidrsCount) {
    if (!window.APP_DEBUG_ENABLED) return;
    const cCount = Array.isArray(contacts) ? contacts.length : 0;
    const rCount = Array.isArray(contacts) ? contacts.filter((c) => c && c.redacted).length : 0;
    const nsCount = Array.isArray(data && data.nameservers)
      ? data.nameservers.filter((ns) => ns && (ns.ldhName || ns.unicodeName)).length
      : 0;
    const stCount = Array.isArray(data && data.status) ? data.status.filter(Boolean).length : 0;
    const entCount = flattenEntities(data && data.entities, []).length;
    whoisLog(`result: contacts=${cCount} redacted=${rCount} | nameservers=${nsCount} | status codes=${stCount} | entities=${entCount}`);
    if (typeof cidrsCount === 'number') {
      whoisLog(`result: cidrs=${cidrsCount}`);
    }
  }

  // --- Result Renderers ---
  function resetResultContainers() {
    chipsRow.textContent = '';
    bodyEl.textContent = '';
    if (parentNote) {
      parentNote.textContent = '';
      parentNote.style.display = 'none';
    }
    if (registrarBox) {
      registrarBox.textContent = '';
      registrarBox.style.display = 'none';
    }
    if (rawPre) {
      rawPre.textContent = '';
      rawPre.style.display = 'none';
    }
    if (openInBox) {
      openInBox.textContent = '';
      openInBox.style.display = 'none';
    }
    rawOpen = false;
    lastRawJson = null;
    lastRegistrarRawJson = null;
    lastRelatedUrl = null;
    lastRegistrarLoaded = false;
  }

  function renderReservedResult(parsed, reservedEntry) {
    resetResultContainers();
    _lastParsedQuery = parsed;
    const titleStr = `Whois: ${parsed.display}`;
    if (resultTitle) resultTitle.textContent = titleStr;
    updateRawButtonUI();

    addChip('Reserved range', 'whois-chip-warn');
    addChip(reservedEntry.rfc, 'whois-chip-muted');

    const plainLines = [titleStr, ''];
    const sec = createSection('Reserved Address Block');
    appendKvRow(sec, 'Query', parsed.display, plainLines);
    appendKvRow(sec, 'Reserved block', reservedEntry.cidr, plainLines);
    appendKvRow(sec, 'Designation', `${reservedEntry.name} (${reservedEntry.rfc})`, plainLines);
    appendKvRow(sec, 'Status', 'Reserved — not allocated in public Whois/RDAP registries', plainLines);

    const noteEl = document.createElement('div');
    noteEl.className = 'whois-remarks';
    noteEl.style.marginTop = '6px';
    noteEl.textContent = `This address belongs to ${reservedEntry.cidr} (${reservedEntry.name}, ${reservedEntry.rfc}). It is reserved for special or private use, so no public Whois record exists for it.`;
    sec.appendChild(noteEl);
    plainLines.push(`Note: ${noteEl.textContent}`);

    bodyEl.appendChild(sec);

    const srcText = 'Source: IANA Special-Purpose Address Registry (local)';
    if (sourceLine) sourceLine.textContent = srcText;
    plainLines.push('', srcText);

    lastPlainText = plainLines.join('\n') + '\n';
    lastNoteTitle = titleStr;
    renderOpenInButtons(parsed, reservedEntry.cidr);
    resultsCard.style.display = 'block';
  }

  function renderDomainResult(parsed, queriedDomain, steppedFrom, data, sourceUrl, seqAtStart) {
    resetResultContainers();
    _lastParsedQuery = parsed;
    lastRawJson = data;

    const ldh = (data.ldhName ? String(data.ldhName) : queriedDomain).toLowerCase();
    const uni = data.unicodeName ? String(data.unicodeName).toLowerCase() : ldh.split('.').map(labelToUnicode).join('.');
    const displayDomain = (uni && uni !== ldh) ? `${uni} (${ldh})` : ldh;

    const titleStr = `Whois: ${displayDomain}`;
    if (resultTitle) resultTitle.textContent = titleStr;
    updateRawButtonUI();

    const plainLines = [titleStr];

    if (steppedFrom && steppedFrom !== ldh && parentNote) {
      const noteMsg = `No separate Whois record for ${steppedFrom} — showing the registered parent domain ${ldh}.`;
      parentNote.textContent = noteMsg;
      parentNote.style.display = 'block';
      plainLines.push(noteMsg);
    }
    plainLines.push('');

    // Chips row: Registered, Expiry, DNSSEC
    addChip('Registered', 'whois-chip-good');
    const events = extractEvents(data.events);
    if (events.expires) {
      const exp = describeExpiry(events.expires);
      if (exp) {
        const cls = exp.level === 'bad' ? 'whois-chip-bad' : (exp.level === 'warn' ? 'whois-chip-warn' : 'whois-chip-good');
        addChip(exp.chipText, cls);
      }
    }
    if (data.secureDNS && typeof data.secureDNS.delegationSigned === 'boolean') {
      if (data.secureDNS.delegationSigned) {
        addChip('DNSSEC signed', 'whois-chip-good');
      } else {
        addChip('DNSSEC not signed', 'whois-chip-muted');
      }
    }

    // Overview & Registrar section
    const regSec = createSection('Registration');
    appendKvRow(regSec, 'Domain', ldh, plainLines);
    if (uni && uni !== ldh) {
      appendKvRow(regSec, 'Unicode name', uni, plainLines);
    }
    if (data.handle) {
      appendKvRow(regSec, 'Registry ID', String(data.handle), plainLines);
    }
    const regInfo = extractRegistrarInfo(data);
    if (regInfo.name) appendKvRow(regSec, 'Registrar', regInfo.name, plainLines);
    if (regInfo.ianaId) appendKvRow(regSec, 'IANA ID', regInfo.ianaId, plainLines);
    if (regInfo.abuseEmail) appendKvRow(regSec, 'Abuse email', regInfo.abuseEmail, plainLines);
    if (regInfo.abusePhone) appendKvRow(regSec, 'Abuse phone', regInfo.abusePhone, plainLines);

    if (events.registered) {
      const dStr = formatIsoDate(events.registered);
      const age = describeAge(events.registered);
      appendKvRow(regSec, 'Registered', age ? `${dStr} (${age})` : dStr, plainLines);
    }
    if (events.updated) {
      appendKvRow(regSec, 'Updated', formatIsoDate(events.updated), plainLines);
    }
    if (events.expires) {
      const dStr = formatIsoDate(events.expires);
      const exp = describeExpiry(events.expires);
      appendKvRow(regSec, 'Expires', exp && exp.detailText ? `${dStr} (${exp.detailText})` : dStr, plainLines);
    }
    if (data.secureDNS && typeof data.secureDNS.delegationSigned === 'boolean') {
      appendKvRow(regSec, 'DNSSEC', data.secureDNS.delegationSigned ? 'Signed' : 'Not signed', plainLines);
    }
    bodyEl.appendChild(regSec);

    // EPP Statuses
    if (Array.isArray(data.status) && data.status.length > 0) {
      const statusSec = createSection('Domain Status (EPP)');
      const listEl = document.createElement('div');
      listEl.className = 'whois-status-list';
      plainLines.push('\n[Status]');
      data.status.forEach((st) => {
        if (!st) return;
        const info = explainEppStatus(st);
        const item = document.createElement('div');
        item.className = 'whois-status-item';
        const codeEl = document.createElement('span');
        codeEl.className = 'whois-status-code';
        codeEl.textContent = info.code;
        const descEl = document.createElement('span');
        descEl.className = 'whois-status-desc';
        descEl.textContent = info.desc;
        item.appendChild(codeEl);
        item.appendChild(descEl);
        listEl.appendChild(item);
        plainLines.push(`${info.code} — ${info.desc}`);
      });
      statusSec.appendChild(listEl);
      bodyEl.appendChild(statusSec);
    }

    // Name servers
    if (Array.isArray(data.nameservers) && data.nameservers.length > 0) {
      const nsSec = createSection('Name Servers');
      const nsList = document.createElement('div');
      nsList.className = 'whois-ns-list';
      plainLines.push('\n[Name Servers]');
      data.nameservers.forEach((ns) => {
        if (!ns) return;
        const name = (ns.ldhName || ns.unicodeName || '').toLowerCase();
        if (!name) return;
        const ips = [];
        if (ns.ipAddresses) {
          if (Array.isArray(ns.ipAddresses.v4)) ips.push.apply(ips, ns.ipAddresses.v4.filter(Boolean));
          if (Array.isArray(ns.ipAddresses.v6)) ips.push.apply(ips, ns.ipAddresses.v6.filter(Boolean));
        }
        const item = document.createElement('div');
        item.className = 'whois-ns-item';
        const nSpan = document.createElement('span');
        nSpan.className = 'whois-ns-name';
        nSpan.textContent = name;
        item.appendChild(nSpan);
        if (ips.length > 0) {
          const ipSpan = document.createElement('span');
          ipSpan.className = 'whois-ns-ips';
          ipSpan.textContent = ips.join(', ');
          item.appendChild(ipSpan);
        }
        nsList.appendChild(item);
        plainLines.push(ips.length > 0 ? `${name} (${ips.join(', ')})` : name);
      });
      nsSec.appendChild(nsList);
      bodyEl.appendChild(nsSec);
    }

    // Contacts
    const contacts = extractContacts(data, false);
    if (contacts.length > 0) {
      renderContactsSection(bodyEl, contacts, plainLines, 'Contacts');
    } else {
      const noContactMsg = 'The registry does not publish contact details for this domain.';
      const sec = createSection('Contacts');
      const noteEl = document.createElement('div');
      noteEl.className = 'whois-remarks';
      noteEl.textContent = noContactMsg;
      sec.appendChild(noteEl);
      bodyEl.appendChild(sec);
      plainLines.push('\n[Contacts]');
      plainLines.push(noContactMsg);
    }

    // Remarks
    renderRemarksSection(bodyEl, data.remarks, plainLines);

    logWhoisResultShape(data, contacts, null);

    // Related registrar RDAP link
    lastRelatedUrl = findRelatedRegistrarUrl(data, sourceUrl);
    if (lastRelatedUrl) {
      if (isProNow()) {
        loadRegistrarRecordForPro(lastRelatedUrl, seqAtStart);
      } else {
        if (window.APP_DEBUG_ENABLED) whoisLog('registrar record: teaser shown (free)');
        renderRegistrarTeaser();
      }
    } else if (window.APP_DEBUG_ENABLED) {
      whoisLog('registrar record: none linked');
    }

    let serverHost = sourceUrl;
    try { serverHost = new URL(sourceUrl).hostname; } catch (e) { /* ignore */ }
    const srcText = `Source: ${serverHost}`;
    if (sourceLine) sourceLine.textContent = srcText;
    plainLines.push('', srcText);

    lastPlainText = plainLines.join('\n') + '\n';
    lastNoteTitle = `Whois: ${ldh}`;
    renderOpenInButtons({ kind: 'domain', ascii: ldh }, null);
    resultsCard.style.display = 'block';
  }

  function renderIpResult(parsed, data, sourceUrl) {
    resetResultContainers();
    _lastParsedQuery = parsed;
    lastRawJson = data;

    let serverHost = sourceUrl;
    try { serverHost = new URL(sourceUrl).hostname; } catch (e) { /* ignore */ }
    const rir = detectRirName(data, serverHost);

    const titleStr = `Whois: ${parsed.display}`;
    if (resultTitle) resultTitle.textContent = titleStr;
    updateRawButtonUI();

    if (rir) addChip(rir, 'whois-chip-good');
    if (data.type) addChip(String(data.type), 'whois-chip-muted');
    if (data.country) addChip(String(data.country).toUpperCase(), 'whois-chip-muted');

    const plainLines = [titleStr, ''];
    const netSec = createSection('Network Block');

    if (data.name) appendKvRow(netSec, 'Network name', String(data.name), plainLines);
    if (data.handle) appendKvRow(netSec, 'Handle', String(data.handle), plainLines);

    const startAddr = data.startAddress ? String(data.startAddress).trim() : '';
    const endAddr = data.endAddress ? String(data.endAddress).trim() : '';
    if (startAddr && endAddr) {
      appendKvRow(netSec, 'Address range', `${startAddr} – ${endAddr}`, plainLines);
    } else if (startAddr) {
      appendKvRow(netSec, 'Start address', startAddr, plainLines);
    }

    let cidrs = [];
    if (Array.isArray(data.cidr0_cidrs) && data.cidr0_cidrs.length > 0) {
      data.cidr0_cidrs.forEach((c) => {
        if (!c || typeof c.length !== 'number') return;
        const pfx = c.v4prefix || c.v6prefix;
        if (pfx) cidrs.push(`${pfx}/${c.length}`);
      });
    }
    if (cidrs.length === 0 && startAddr && endAddr) {
      cidrs = computeMinimalCidrs(startAddr, endAddr);
    }
    if (cidrs.length > 0) {
      appendKvRow(netSec, cidrs.length === 1 ? 'CIDR' : 'CIDRs', cidrs.join(', '), plainLines);
    }

    if (data.type) appendKvRow(netSec, 'Allocation type', String(data.type), plainLines);
    if (data.country) appendKvRow(netSec, 'Country', String(data.country).toUpperCase(), plainLines);
    if (data.parentHandle) appendKvRow(netSec, 'Parent handle', String(data.parentHandle), plainLines);
    if (rir) appendKvRow(netSec, 'Registry', rir, plainLines);

    const events = extractEvents(data.events);
    if (events.registered) appendKvRow(netSec, 'Registered', formatIsoDate(events.registered), plainLines);
    if (events.updated) appendKvRow(netSec, 'Updated', formatIsoDate(events.updated), plainLines);

    bodyEl.appendChild(netSec);

    const contacts = extractContacts(data, true);
    renderContactsSection(bodyEl, contacts, plainLines, 'Organisation & Abuse Contacts');
    renderRemarksSection(bodyEl, data.remarks, plainLines);

    logWhoisResultShape(data, contacts, cidrs.length);

    const srcText = `Source: ${rir ? rir + ' (' + serverHost + ')' : serverHost}`;
    if (sourceLine) sourceLine.textContent = srcText;
    plainLines.push('', srcText);

    lastPlainText = plainLines.join('\n') + '\n';
    lastNoteTitle = titleStr;
    renderOpenInButtons(parsed, cidrs[0] || null);
    resultsCard.style.display = 'block';
  }

  function renderAsnResult(parsed, data, sourceUrl) {
    resetResultContainers();
    _lastParsedQuery = parsed;
    lastRawJson = data;

    let serverHost = sourceUrl;
    try { serverHost = new URL(sourceUrl).hostname; } catch (e) { /* ignore */ }
    const rir = detectRirName(data, serverHost);

    const titleStr = `Whois: ${parsed.display}`;
    if (resultTitle) resultTitle.textContent = titleStr;
    updateRawButtonUI();

    addChip(parsed.display, 'whois-chip-good');
    if (rir) addChip(rir, 'whois-chip-muted');
    if (data.country) addChip(String(data.country).toUpperCase(), 'whois-chip-muted');

    const plainLines = [titleStr, ''];
    const asnSec = createSection('Autonomous System');
    const sAut = typeof data.startAutnum === 'number' ? data.startAutnum : parsed.asn;
    const eAut = typeof data.endAutnum === 'number' ? data.endAutnum : sAut;
    appendKvRow(asnSec, 'AS Number', sAut === eAut ? `AS${sAut}` : `AS${sAut} – AS${eAut}`, plainLines);
    if (data.name) appendKvRow(asnSec, 'AS Name', String(data.name), plainLines);
    if (data.handle) appendKvRow(asnSec, 'Handle', String(data.handle), plainLines);
    if (data.type) appendKvRow(asnSec, 'Type', String(data.type), plainLines);
    if (data.country) appendKvRow(asnSec, 'Country', String(data.country).toUpperCase(), plainLines);
    if (rir) appendKvRow(asnSec, 'Registry', rir, plainLines);

    const events = extractEvents(data.events);
    if (events.registered) appendKvRow(asnSec, 'Registered', formatIsoDate(events.registered), plainLines);
    if (events.updated) appendKvRow(asnSec, 'Updated', formatIsoDate(events.updated), plainLines);

    bodyEl.appendChild(asnSec);

    const contacts = extractContacts(data, true);
    renderContactsSection(bodyEl, contacts, plainLines, 'Organisation & Abuse Contacts');
    renderRemarksSection(bodyEl, data.remarks, plainLines);

    const asnCidrsCount = Array.isArray(data && data.cidr0_cidrs) ? data.cidr0_cidrs.length : 0;
    logWhoisResultShape(data, contacts, asnCidrsCount);

    const srcText = `Source: ${rir ? rir + ' (' + serverHost + ')' : serverHost}`;
    if (sourceLine) sourceLine.textContent = srcText;
    plainLines.push('', srcText);

    lastPlainText = plainLines.join('\n') + '\n';
    lastNoteTitle = titleStr;
    renderOpenInButtons(parsed, null);
    resultsCard.style.display = 'block';
  }

  function friendlyWhoisError(err, queryStr) {
    if (!err) return 'Whois lookup failed. Please try again.';
    const status = typeof err.status === 'number' ? err.status : 0;
    if (status === 404) {
      return `No Whois record was found for ${queryStr}.`;
    }
    if (status === 400) {
      return 'The registry rejected this query format.';
    }
    if (status === 429) {
      return 'The registry is limiting requests right now. Wait a minute and try again.';
    }
    if (status >= 500) {
      return 'The registry server is temporarily unavailable. Please try again in a moment.';
    }
    if (err.kind === 'timeout' || /timeout|timed out/i.test(err.message || '')) {
      return 'The registry took too long to respond. Please try again.';
    }
    if (err.kind === 'json') {
      return 'The registry returned an unreadable response. Please try again later.';
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'Device is offline. Please check your internet connection.';
    }
    return 'Could not reach the Whois registry. Please check your connection and try again.';
  }

  // --- Main Lookup Flow ---
  async function runWhoisLookup() {
    if (btnLookup.disabled) return;
    if (window.APP_DEBUG_ENABLED) {
      const rawLen = (input.value || '').trim().length;
      whoisLog(`ui: lookup tap | inputLength=${rawLen} | pro=${isProNow()}`);
    }
    hideError();
    rawOpen = false;
    if (rawPre) {
      rawPre.textContent = '';
      rawPre.style.display = 'none';
    }
    updateRawButtonUI();

    const parsed = parseWhoisQuery(input.value);
    if (parsed.error) {
      showError(parsed.error);
      return;
    }

    const parseKind = (parsed.kind === 'ipv4' || parsed.kind === 'ipv6') && parsed.prefix !== null ? 'cidr' : parsed.kind;
    if (window.APP_DEBUG_ENABLED) {
      whoisLog(`parse: kind=${parseKind}`);
    }

    if (parsed.normalizedInput && input.value !== parsed.normalizedInput) {
      input.value = parsed.normalizedInput;
    }

    // Pro gate for AS number lookups (no network request for Free)
    if (parsed.kind === 'asn' && !isProNow()) {
      if (window.APP_DEBUG_ENABLED) whoisLog('ui: asn gated for free user');
      showProModal('whois');
      return;
    }

    // Reserved IP / CIDR check (no network request)
    if (parsed.kind === 'ipv4' || parsed.kind === 'ipv6') {
      const reserved = checkReservedIp(parsed);
      if (reserved) {
        if (window.APP_DEBUG_ENABLED) whoisLog(`lookup: reserved ${parsed.kind} (${reserved.rfc})`);
        renderReservedResult(parsed, reserved);
        return;
      }
    }

    // Close keyboard on mobile
    try {
      if (document.activeElement === input) input.blur();
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Keyboard && typeof window.Capacitor.Plugins.Keyboard.hide === 'function') {
        Promise.resolve(window.Capacitor.Plugins.Keyboard.hide()).catch(() => {});
      }
    } catch (e) { /* ignore */ }

    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.FirebaseCrashlytics) {
      window.Capacitor.Plugins.FirebaseCrashlytics.setCustomKey({ key: 'last_calc_action', value: 'whoisLookup', type: 'string' }).catch(() => {});
    }

    if (currentAbort) {
      try { currentAbort.abort(); } catch (e) { /* ignore */ }
    }
    currentAbort = new window.AbortController();
    const mySeq = ++lookupSeq;
    let staleLogged = false;
    function isStaleAndLog() {
      if (mySeq !== lookupSeq) {
        if (!staleLogged && window.APP_DEBUG_ENABLED) {
          staleLogged = true;
          whoisLog('lookup: stale response discarded');
        }
        return true;
      }
      return false;
    }

    btnLookup.disabled = true;
    btnLookup.textContent = 'Looking up...';
    if (window.APP_DEBUG_ENABLED) whoisLog(`lookup: start kind=${parsed.kind}`);

    try {
      if (parsed.kind === 'domain') {
        const labels = parsed.ascii.split('.');
        const steppedFrom = parsed.ascii;
        let curLabels = labels.slice();
        let foundData = null;
        let foundDomain = '';
        let usedUrl = '';
        let lastErr = null;
        const maxParentSteps = Math.min(3, Math.max(0, labels.length - 2));
        let parentSteps = 0;

        let stepAttempts = 0;
        while (curLabels.length >= 2 && stepAttempts < 4) {
          stepAttempts++;
          const candidate = curLabels.join('.');
          const base = await resolveRdapBase(parsed, candidate, currentAbort.signal);
          if (isStaleAndLog()) return;
          const url = `${ensureTrailingSlash(base)}domain/${encodeURIComponent(candidate)}`;
          try {
            const data = await httpGetJson(url, currentAbort.signal, true);
            if (isStaleAndLog()) return;
            if (parentSteps > 0 && window.APP_DEBUG_ENABLED) {
              whoisLog(`parent step: found after ${parentSteps} steps`);
            }
            foundData = data;
            foundDomain = candidate;
            usedUrl = url;
            break;
          } catch (err) {
            if (isStaleAndLog()) return;
            lastErr = err;
            if (err && err.status === 404 && curLabels.length > 2 && stepAttempts < 4) {
              curLabels.shift();
              parentSteps++;
              if (window.APP_DEBUG_ENABLED) {
                whoisLog(`parent step: attempt ${parentSteps} of ${maxParentSteps}`);
              }
              continue;
            }
            if (parentSteps > 0 && window.APP_DEBUG_ENABLED) {
              whoisLog('parent step: gave up');
            }
            throw err;
          }
        }

        if (!foundData) {
          if (parentSteps > 0 && window.APP_DEBUG_ENABLED) {
            whoisLog('parent step: gave up');
          }
          throw lastErr || Object.assign(new Error('HTTP 404'), { status: 404 });
        }

        renderDomainResult(
          parsed,
          foundDomain,
          foundDomain !== steppedFrom ? steppedFrom : null,
          foundData,
          usedUrl,
          mySeq
        );
        if (window.APP_DEBUG_ENABLED) whoisLog('lookup: domain ok');
      } else if (parsed.kind === 'ipv4' || parsed.kind === 'ipv6') {
        const base = await resolveRdapBase(parsed, null, currentAbort.signal);
        if (isStaleAndLog()) return;
        const pathSuffix = parsed.prefix !== null ? `${parsed.ip}/${parsed.prefix}` : parsed.ip;
        const url = `${ensureTrailingSlash(base)}ip/${pathSuffix}`;
        const data = await httpGetJson(url, currentAbort.signal, true);
        if (isStaleAndLog()) return;
        renderIpResult(parsed, data, url);
        if (window.APP_DEBUG_ENABLED) whoisLog(`lookup: ${parsed.kind} ok`);
      } else if (parsed.kind === 'asn') {
        const base = await resolveRdapBase(parsed, null, currentAbort.signal);
        if (isStaleAndLog()) return;
        const url = `${ensureTrailingSlash(base)}autnum/${parsed.asn}`;
        const data = await httpGetJson(url, currentAbort.signal, true);
        if (isStaleAndLog()) return;
        renderAsnResult(parsed, data, url);
        if (window.APP_DEBUG_ENABLED) whoisLog('lookup: asn ok');
      }
    } catch (err) {
      if (isStaleAndLog()) return;
      if (window.APP_DEBUG_ENABLED) {
        whoisLog(`lookup: error (${err && err.status ? 'HTTP ' + err.status : (err && err.kind ? err.kind : 'err')})`);
      }
      showError(friendlyWhoisError(err, parsed.display));
    } finally {
      if (mySeq === lookupSeq) {
        btnLookup.disabled = false;
        btnLookup.textContent = 'Lookup';
      }
    }
  }

  btnLookup.addEventListener('click', runWhoisLookup);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runWhoisLookup();
  });

  const btnWhoisSwitch = document.getElementById('btn-whois-switch');
  if (btnWhoisSwitch) {
    btnWhoisSwitch.addEventListener('click', () => {
      if (window.APP_DEBUG_ENABLED) whoisLog('ui: tools chip tap');
    });
  }

  btnClear.addEventListener('click', () => {
    if (window.APP_DEBUG_ENABLED) whoisLog('ui: clear tap');
    lookupSeq++;
    if (currentAbort) {
      try { currentAbort.abort(); } catch (e) { /* ignore */ }
      currentAbort = null;
    }
    btnLookup.disabled = false;
    btnLookup.textContent = 'Lookup';
    input.value = '';
    hideError();
    resetResultContainers();
    lastPlainText = '';
    lastNoteTitle = '';
    _lastParsedQuery = null;
    resultsCard.style.display = 'none';
  });

  if (btnRaw) {
    btnRaw.addEventListener('click', () => {
      if (!isProNow()) {
        if (window.APP_DEBUG_ENABLED) whoisLog('ui: raw toggle on | gated=true');
        showProModal('whois');
        return;
      }
      if (!lastRawJson || !rawPre) return;
      rawOpen = !rawOpen;
      if (window.APP_DEBUG_ENABLED) whoisLog(`ui: raw toggle ${rawOpen ? 'on' : 'off'} | gated=false`);
      if (rawOpen) {
        rawPre.textContent = formatRawJsonForDisplay();
        rawPre.style.display = 'block';
      } else {
        rawPre.style.display = 'none';
      }
      updateRawButtonUI();
    });
  }

  function getWhoisOutputText() {
    if (!lastPlainText) return '';
    if (rawOpen && isProNow() && rawPre && rawPre.textContent) {
      const rawScreenText = rawPre.textContent;
      if (window.APP_DEBUG_ENABLED) {
        whoisLog(`whois: raw included in output | chars=${rawScreenText.length}`);
      }
      return `${lastPlainText}\n\nRaw data\n${rawScreenText}`;
    }
    return lastPlainText;
  }

  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      if (window.APP_DEBUG_ENABLED) whoisLog('ui: copy tap');
      const outText = getWhoisOutputText();
      if (!outText || !navigator.clipboard || !navigator.clipboard.writeText) return;
      navigator.clipboard.writeText(outText)
        .then(() => {
          if (typeof showToast === 'function') showToast('Whois results copied!');
        })
        .catch(() => {
          if (typeof showToast === 'function') showToast('Copy failed');
        });
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      if (window.APP_DEBUG_ENABLED) whoisLog('ui: save tap');
      const outText = getWhoisOutputText();
      if (!outText || typeof addNote !== 'function') return;
      addNote(lastNoteTitle || 'Whois', outText, 'Whois');
      if (typeof maybeRequestReview === 'function') maybeRequestReview('save_note');
      if (typeof switchToNotesTab === 'function') switchToNotesTab();
    });
  }

  if (btnShare) {
    btnShare.addEventListener('click', () => {
      if (isShareTapDuplicate('whois')) {
        if (window.APP_DEBUG_ENABLED) whoisLog('ui: share tap ignored | reason=double-tap');
        return;
      }
      if (window.APP_DEBUG_ENABLED) whoisLog('ui: share tap');
      const outText = getWhoisOutputText();
      if (outText && typeof shareText === 'function') {
        shareText(lastNoteTitle || 'Whois Results', outText, true);
      }
    });
  }
})();

// --- ANDROID BACK BUTTON ---
(function initAndroidBackButton() {
  if (typeof window === 'undefined' || !window.Capacitor) return;
  if (typeof window.Capacitor.getPlatform !== 'function' || window.Capacitor.getPlatform() !== 'android') return;
  const App = window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (!App || typeof App.addListener !== 'function') return;

  try {
    App.addListener('backButton', function handleBackButton() {
      try {
        // 1. Popups in priority / z-index order
        const popups = [
          { id: 'global-error-modal', btnId: 'global-error-ok' },
          { id: 'global-confirm-modal', btnId: 'global-confirm-cancel' },
          { id: 'sync-nudge-modal', btnId: 'btn-nudge-dismiss' },
          { id: 'tools-picker-modal', btnId: 'btn-tools-picker-close', fn: typeof closeToolsPicker === 'function' ? closeToolsPicker : null },
          { id: 'pro-modal', btnId: 'btn-pro-dismiss', fn: typeof closeProModal === 'function' ? closeProModal : null },
          { id: 'account-modal', btnId: 'btn-account-close' },
          { id: 'plan-modal', btnId: 'btn-plan-close' },
          { id: 'feedback-modal', btnId: 'btn-feedback-close' },
          { id: 'settings-modal', btnId: 'btn-settings-close' }
        ];

        for (const popup of popups) {
          const el = document.getElementById(popup.id);
          if (el && !el.classList.contains('hidden')) {
            if (typeof debugLog === 'function') {
              debugLog('[Back] close popup ' + popup.id);
            }
            const btn = popup.btnId ? document.getElementById(popup.btnId) : null;
            if (btn) {
              btn.click();
            } else if (typeof popup.fn === 'function') {
              popup.fn();
            }
            return;
          }
        }

        // 2. Tab check: return to calculator tab if not on it
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab && activeTab.id !== 'calculator-tab') {
          if (typeof debugLog === 'function') {
            debugLog('[Back] to calculator tab');
          }
          const calcBtn = document.querySelector('.tab-btn[data-target="calculator-tab"]');
          if (calcBtn) calcBtn.click();
          return;
        }

        // 3. Exit app
        if (typeof debugLog === 'function') {
          debugLog('[Back] exit');
        }
        try {
          if (typeof App.exitApp === 'function') {
            App.exitApp();
          } else if (typeof App.minimizeApp === 'function') {
            App.minimizeApp();
          }
        } catch (e1) {
          try {
            if (typeof App.minimizeApp === 'function') {
              App.minimizeApp();
            }
          } catch (e2) {}
        }
      } catch (err) {
        // Never let an exception escape
      }
    });
  } catch (err) {
    // Never let an exception escape
  }
})();
