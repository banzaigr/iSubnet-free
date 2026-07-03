// --- Theme Mode Cache Recovery (Prevents Flash) ---
(function() {
  try {
    const isDark = localStorage.getItem('isubnet_dark_mode') === 'true';
    if (isDark) {
      document.body.classList.add('dark-mode');
    }
    const color = localStorage.getItem('isubnet_theme_color');
    if (color) {
      document.documentElement.style.setProperty('--accent-primary', color);
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
      // Sort by ID descending (timestamp) to display latest first
      remoteNotes.sort((a, b) => b.id.localeCompare(a.id));
      notes = remoteNotes;
      saveNotesToStorage();
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

async function initRevenueCat() {
  if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Purchases) {
    try {
      const { Purchases } = window.Capacitor.Plugins;
      
      const apiKeyAndroid = "goog_RVInjInoGNBFdIqhouvUjuchGMr";
      const apiKeyIOS = "test_HSrMVMPumumdDfciLiQfOSmszgC";
      
      if (apiKeyAndroid === "goog_YOUR_API_KEY") {
        console.log("RevenueCat using mock mode (Configure credentials in app.js for store release)");
        return;
      }
      
      const apiKey = window.Capacitor.getPlatform() === 'ios' ? apiKeyIOS : apiKeyAndroid;
      await Purchases.configure({ apiKey });
      useRevenueCat = true;
      console.log("RevenueCat initialized successfully!");
      
      updateRevenueCatSubscriptionState();
    } catch(err) {
      console.error("RevenueCat Init Error:", err);
    }
  }
}

function isProEntitlementActive(entitlements) {
  if (!entitlements) return false;
  return !!(entitlements["pro_features"] || entitlements["iSubnet Pro"] || Object.keys(entitlements).length > 0);
}

async function updateRevenueCatSubscriptionState() {
  if (!useRevenueCat) return;
  try {
    const { Purchases } = window.Capacitor.Plugins;
    const customerInfo = await Purchases.getCustomerInfo();
    const activeEntitlements = customerInfo.entitlements.active;
    
    if (isProEntitlementActive(activeEntitlements)) {
      PRO_UNLOCKED = true;
      SafeStorage.setItem('isubnet_pro', 'true');
      applyProState();
      document.getElementById('settings-plan-status').innerHTML = `Current Plan: <strong>Pro Subscriber</strong>`;
      
      const user = firebase.auth().currentUser;
      if (user && useRealFirebase) {
        db.collection("users").doc(user.uid).set({ is_pro: true }, { merge: true });
      }
    } else {
      PRO_UNLOCKED = false;
      SafeStorage.setItem('isubnet_pro', 'false');
      applyProState();
    }
  } catch(err) {
    console.error("RevenueCat Check Error:", err);
  }
}

async function purchaseProductByPlan(planType) {
  const isNative = window.Capacitor && window.Capacitor.isNativePlatform();
  if (!isNative || !useRevenueCat) {
    // Browser local test fallback
    PRO_UNLOCKED = true;
    SafeStorage.setItem('isubnet_pro', 'true');
    applyProState();
    alert(`[Browser Demo] Purchased ${planType} plan! Pro features unlocked.`);
    closeProModal();
    return;
  }

  try {
    const { Purchases } = window.Capacitor.Plugins;
    const offerings = await Purchases.getOfferings();
    if (offerings.current !== null && offerings.current.availablePackages.length > 0) {
      let packageToBuy = null;
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
      
      const purchaseResult = await Purchases.purchasePackage({ aPackage: packageToBuy });
      
      if (isProEntitlementActive(purchaseResult.customerInfo.entitlements.active)) {
        PRO_UNLOCKED = true;
        SafeStorage.setItem('isubnet_pro', 'true');
        applyProState();
        alert("Thank you for upgrading! iSubnet Pro unlocked.");
        closeProModal();
      }
    } else {
      alert("Billing Error: No packages available in current offering.");
    }
  } catch(err) {
    if (!err.userCancelled) {
      alert("Purchase Error: " + err.message);
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
const FREE_NOTES_LIMIT = 2;
const FREE_HISTORY_LIMIT = 2;
let PRO_UNLOCKED = false; // will be set after SafeStorage is ready

function showProModal() {
  document.getElementById('pro-modal').classList.remove('hidden');
}

function closeProModal() {
  document.getElementById('pro-modal').classList.add('hidden');
}

function unlockPro() {
  const modal = document.querySelector('#pro-modal .pro-modal');
  if (!modal) return;
  
  if (!modal.dataset.originalHtml) {
    modal.dataset.originalHtml = modal.innerHTML;
  }
  
  modal.innerHTML = `
    <div class="pro-modal-header">
      <span class="pro-crown" style="font-size: 40px; display: block; margin-bottom: 10px;">📱</span>
      <h2 style="color: var(--accent-primary); margin: 0 0 10px;">Mobile App Required</h2>
      <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 20px;">
        This web version is a demonstration. Security and payment processing for iSubnet Pro is handled securely via the <strong>Apple App Store</strong> and <strong>Google Play Store</strong> in the mobile app.
      </p>
    </div>
    <button class="btn-primary pro-unlock-btn" id="btn-pro-ok" style="margin-bottom: 10px;">OK</button>
  `;
  
  document.getElementById('btn-pro-ok').addEventListener('click', () => {
    modal.innerHTML = modal.dataset.originalHtml;
    document.getElementById('btn-pro-unlock').addEventListener('click', unlockPro);
    document.getElementById('btn-pro-dismiss').addEventListener('click', closeProModal);
    closeProModal();
  });
}

// Global helpers for testing/debugging Pro features in the browser
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

function applyProState() {
  const badge = document.querySelector('.free-badge') || document.querySelector('.pro-badge');
  const splitterBtn = document.getElementById('tab-btn-splitter');
  
  if (PRO_UNLOCKED) {
    // Swap FREE badge for PRO badge
    if (badge) {
      badge.textContent = 'PRO';
      badge.className = 'pro-badge';
    }
    // Unlock splitter tab
    if (splitterBtn) {
      splitterBtn.classList.remove('tab-btn-locked');
      splitterBtn.setAttribute('data-target', 'splitter-tab');
      splitterBtn.removeAttribute('data-pro');
      const lockIcon = splitterBtn.querySelector('.tab-lock-icon');
      if (lockIcon) lockIcon.remove();
    }
    // Remove any limit banners
    document.querySelectorAll('.pro-limit-banner').forEach(el => el.remove());
  } else {
    // Lock FREE state back
    if (badge) {
      badge.textContent = 'FREE';
      badge.className = 'free-badge';
    }
    // Lock splitter tab
    if (splitterBtn) {
      splitterBtn.classList.add('tab-btn-locked');
      splitterBtn.removeAttribute('data-target');
      splitterBtn.setAttribute('data-pro', 'true');
      if (!splitterBtn.querySelector('.tab-lock-icon')) {
        const lock = document.createElement('div');
        lock.className = 'tab-lock-icon';
        lock.textContent = '🔒';
        splitterBtn.appendChild(lock);
      }
    }
    
    // Switch to another tab if currently on Splitter
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'splitter-tab') {
      const ipv4Btn = document.querySelector('.tab-btn[data-target="ipv4-tab"]');
      if (ipv4Btn) ipv4Btn.click();
    }
    
    // Re-render list templates to show limits
    renderNotes();
    renderHistory();
  }
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
  _fallback: {}
};

PRO_UNLOCKED = SafeStorage.getItem('isubnet_pro') === 'true';

let lastCalculatedIP = SafeStorage.getItem('isubnet_last_ip') || '';

function updateSharedIP(ip) {
  if (!ip) return;
  lastCalculatedIP = ip.trim().replace(/^\[|\]$/g, '').split('/')[0];
  SafeStorage.setItem('isubnet_last_ip', lastCalculatedIP);
  renderQuickPastePills();
}

function renderQuickPastePills() {
  const pills = document.querySelectorAll('.quick-paste-pill');
  const insertIpBtn = document.getElementById('btn-insert-note-ip');
  
  if (!lastCalculatedIP) {
    pills.forEach(p => p.classList.add('hidden'));
    if (insertIpBtn) insertIpBtn.classList.add('hidden');
    return;
  }
  
  pills.forEach(pill => {
    pill.classList.remove('hidden');
    const valSpan = pill.querySelector('.paste-val');
    if (valSpan) {
      const dispText = lastCalculatedIP.length > 15 ? lastCalculatedIP.slice(0, 12) + '...' : lastCalculatedIP;
      valSpan.textContent = dispText;
    }
  });
  
  if (insertIpBtn) {
    insertIpBtn.classList.remove('hidden');
    insertIpBtn.title = `Insert ${lastCalculatedIP} into note`;
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
      document.getElementById(target).classList.add('active');
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

// Validate IPv4 format
function validateIPv4(ipStr) {
  const reg = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (!reg.test(ipStr)) return false;
  const parts = ipStr.match(reg).slice(1).map(Number);
  return parts.every(p => p >= 0 && p <= 255);
}

// Perform calculations for IPv4
function calculateIPv4() {
  const ipInput = document.getElementById('ipv4-address').value.trim();
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
  document.getElementById('bin-ip').textContent = uint32ToBinaryStr(ipVal);
  document.getElementById('bin-mask').textContent = uint32ToBinaryStr(maskVal);

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

// Format 128-bit BigInt to fully-expanded IPv6 string
function formatIPv6Expanded(bigIntVal) {
  const parts = [];
  let temp = bigIntVal;
  for (let i = 0; i < 8; i++) {
    const part = Number(temp & BigInt(0xffff));
    parts.unshift(part.toString(16).padStart(4, '0'));
    temp = temp >> BigInt(16);
  }
  return parts.join(':');
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

// Calculate IPv6 Subnetting
function calculateIPv6() {
  const ipInput = document.getElementById('ipv6-address').value.trim();
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
      if (targetPrefix < 1 || targetPrefix > 128) {
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
  document.getElementById('res6-compressed').textContent = formatIPv6Compressed(ipBigInt);
  document.getElementById('res6-expanded').textContent = formatIPv6Expanded(ipBigInt);
  document.getElementById('res6-prefix').textContent = `/${prefixLength}`;
  document.getElementById('res6-net-prefix').textContent = `${formatIPv6Compressed(networkPrefixVal)}/${prefixLength}`;
  document.getElementById('res6-start').textContent = formatIPv6Compressed(networkPrefixVal);
  document.getElementById('res6-end').textContent = formatIPv6Compressed(broadcastVal);
  document.getElementById('res6-total').textContent = totalAddresses.toLocaleString();

  resultsCard.classList.remove('hidden');

  // Record history
  recordHistoryDebounced('IPv6', { ip: ipInput, cidr: prefixLength, hosts: hostsInput }, `${formatIPv6Compressed(ipBigInt)}/${prefixLength}${hostsInput ? ` (${hostsInput} hosts)` : ''}`);
}

// --- NOTES MANAGEMENT LOGIC ---

let notes = [];

function loadNotes() {
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
  renderNotes();
}

function saveNotesToStorage() {
  SafeStorage.setItem('isubnet_notes_' + currentUserId, JSON.stringify(notes));
  if (currentUserId !== 'local') {
    SafeStorage.setItem('isubnet_notes_local', JSON.stringify(notes.slice(0, 2)));
  }
  renderNotes();
}

function addNote(title, content, category = 'Manual') {
  if (!PRO_UNLOCKED && notes.length >= FREE_NOTES_LIMIT) {
    showNotesLimitBanner();
    return;
  }
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
    item.querySelector('.edit-btn').addEventListener('click', (e) => {
      const btn = e.currentTarget;
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
    SafeStorage.setItem('isubnet_history_local', JSON.stringify(historyItems.slice(0, 2)));
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
    const limit = PRO_UNLOCKED ? 50 : FREE_HISTORY_LIMIT;
    if (historyItems.length > limit) {
      historyItems = historyItems.slice(0, limit);
      if (!PRO_UNLOCKED) showHistoryLimitBanner();
    }
    saveHistoryToStorage();
    saveHistoryToFirebase(newItem);
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

function clearHistory() {
  if (confirm('Are you sure you want to clear all history?')) {
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
    document.getElementById('ipv4-cidr').value = item.data.cidr;
    document.getElementById('ipv4-hosts').value = item.data.hosts;
    calculateIPv4();
    // Navigate tab
    const tabBtn = document.querySelector('.tab-btn[data-target="ipv4-tab"]');
    if (tabBtn) tabBtn.click();
  } else if (item.type === 'IPv6') {
    document.getElementById('ipv6-address').value = item.data.ip;
    document.getElementById('ipv6-cidr').value = item.data.cidr;
    document.getElementById('ipv6-hosts').value = item.data.hosts;
    calculateIPv6();
    // Navigate tab
    const tabBtn = document.querySelector('.tab-btn[data-target="ipv6-tab"]');
    if (tabBtn) tabBtn.click();
  } else if (item.type === 'Converter') {
    document.getElementById('converter-input').value = item.data.input;
    runConverter();
    // Navigate tab
    const tabBtn = document.querySelector('.tab-btn[data-target="converter-tab"]');
    if (tabBtn) tabBtn.click();
  } else if (item.type === 'Splitter') {
    document.getElementById('split-base-ip').value = item.data.baseIp;
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
  switchToNotesTab();
}

// Format IPv6 data to string
function saveIpv6Note() {
  const input = document.getElementById('ipv6-address').value.trim();
  const compressed = document.getElementById('res6-compressed').textContent;
  const prefix = document.getElementById('res6-prefix').textContent;
  const netPrefix = document.getElementById('res6-net-prefix').textContent;
  const start = document.getElementById('res6-start').textContent;
  const end = document.getElementById('res6-end').textContent;
  const total = document.getElementById('res6-total').textContent;
  const typeText = document.getElementById('ipv6-badge-type').textContent;

  const noteTitle = `IPv6 Prefix: ${compressed}${prefix}`;
  const noteContent = `• Network Prefix: ${netPrefix}
• IP Range Start: ${start}
• IP Range End: ${end}
• Total Addresses: ${total}
• Address Type: ${typeText}`;

  addNote(noteTitle, noteContent, 'IPv6');
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
    const ipv6Mask = document.getElementById('conv-ipv6-mask').textContent;
    noteContent = `• Prefix Length: ${prefix}
• Host Wildcard: ${wildcard}
• Routing Prefix Mask: ${ipv6Mask}`;
  } else {
    const binary = document.getElementById('conv-binary').textContent;
    noteContent = `• Prefix Length: ${prefix}
• Subnet Mask: ${mask}
• Wildcard Mask: ${wildcard}
• Binary Representation: ${binary}`;
  }
  
  addNote(noteTitle, noteContent, isIpv6 ? 'IPv6' : 'IPv4');
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
  switchToNotesTab();
}

function switchToNotesTab() {
  const noteTabBtn = document.querySelector('.tab-btn[data-target="notes-tab"]');
  if (noteTabBtn) noteTabBtn.click();
}

// --- SHARING UTILITIES ---

async function shareText(title, text) {
  const isNative = window.Capacitor && window.Capacitor.isNativePlatform();
  if (isNative) {
    try {
      const { Share } = window.Capacitor.Plugins;
      await Share.share({
        title: title,
        text: text
      });
      return;
    } catch (e) {
      console.error("Capacitor Share failed:", e);
    }
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
      alert(`${title} copied to clipboard!`);
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
  const compressed = document.getElementById('res6-compressed').textContent;
  const prefix = document.getElementById('res6-prefix').textContent;
  const netPrefix = document.getElementById('res6-net-prefix').textContent;
  const start = document.getElementById('res6-start').textContent;
  const end = document.getElementById('res6-end').textContent;
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
    const ipv6Mask = document.getElementById('conv-ipv6-mask').textContent;
    text = `Converter Results (${type}):
• Prefix Length: ${prefix}
• Host Wildcard: ${wildcard}
• Routing Prefix Mask: ${ipv6Mask}`;
  } else {
    const binary = document.getElementById('conv-binary').textContent;
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

const refIpv6Text = `IPv6 Common Address Types Reference:
• Global Unicast (Public): 2000::/3
• Link-Local (Auto-configured): fe80::/10
• Unique Local (Private LAN): fc00::/7
• Loopback Address: ::1/128
• Multicast Range: ff00::/8`;

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
function shareRefIpv6() {
  shareText('IPv6 Address Types', refIpv6Text);
}

// --- SETUP EVENT LISTENERS ---

function setupEventListeners() {
  document.getElementById('btn-calc-ipv4').addEventListener('click', calculateIPv4);
  document.getElementById('btn-calc-ipv6').addEventListener('click', calculateIPv6);
  
  // Real-time calculation triggers
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
  
  // Reference guide copy & share bindings
  document.getElementById('btn-copy-ref-classes').addEventListener('click', () => {
    copyTextWithToast('btn-copy-ref-classes', refClassesText);
  });
  document.getElementById('btn-share-ref-classes').addEventListener('click', shareRefClasses);
  
  document.getElementById('btn-copy-ref-private').addEventListener('click', () => {
    copyTextWithToast('btn-copy-ref-private', refPrivateText);
  });
  document.getElementById('btn-share-ref-private').addEventListener('click', shareRefPrivate);
  
  document.getElementById('btn-copy-ref-ipv6').addEventListener('click', () => {
    copyTextWithToast('btn-copy-ref-ipv6', refIpv6Text);
  });
  document.getElementById('btn-share-ref-ipv6').addEventListener('click', shareRefIpv6);
  
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

function runConverter() {
  const input = document.getElementById('converter-input').value.trim();
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
        document.getElementById('conv-binary').textContent = calc.binary;
        document.getElementById('conv-ipv6-row').style.display = 'none';
        document.getElementById('conv-binary-row').style.display = 'flex';
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
    } else if (parseIPv6(ipPart) !== null) {
      let cidr = null;
      const prefixReg = /^\/?(\d{1,3})$/;
      if (prefixReg.test(maskPart)) {
        cidr = parseInt(maskPart.match(prefixReg)[1], 10);
      }

      if (cidr !== null && cidr >= 0 && cidr <= 128) {
        const ipFields = parseIPv6(ipPart);
        if (ipFields) {
          const hostMask = (BigInt(1) << BigInt(128 - cidr)) - BigInt(1);
          const netMask = ~hostMask & ((BigInt(1) << BigInt(128)) - BigInt(1));
          
          const ipVal = ipFieldsToBigInt(ipFields);
          const networkVal = ipVal & netMask;
          const broadcastVal = ipVal | hostMask;

          document.getElementById('conv-type').textContent = 'IPv6 Subnet Input';
          document.getElementById('conv-prefix').textContent = `/${cidr}`;
          document.getElementById('conv-mask').textContent = 'N/A (IPv6)';
          document.getElementById('conv-wildcard').textContent = `::${formatIPv6Compressed(hostMask)}`;
          document.getElementById('conv-ipv6-mask').textContent = `${formatIPv6Compressed(netMask)}`;
          document.getElementById('conv-ipv6-row').style.display = 'flex';
          document.getElementById('conv-binary-row').style.display = 'none';
          resultsDiv.classList.remove('hidden');

          let usableRange = '';
          if (cidr === 128) {
            usableRange = `${formatIPv6Compressed(networkVal)} (Single Host)`;
          } else {
            usableRange = `${formatIPv6Compressed(networkVal + BigInt(1))} - ${formatIPv6Compressed(broadcastVal)}`;
          }

          let totalHosts = '';
          if (128 - cidr >= 120) {
            totalHosts = `2^${128 - cidr}`;
          } else {
            totalHosts = (BigInt(1) << BigInt(128 - cidr)).toLocaleString();
          }

          let ipType = 'Global Unicast (Public)';
          const firstWord = ipFields[0];
          if ((firstWord & 0xe000) === 0x2000) ipType = 'Global Unicast (Public)';
          else if (firstWord === 0xfe80) ipType = 'Link-Local Address';
          else if ((firstWord & 0xfe00) === 0xfc00) ipType = 'Unique Local Address (Private)';
          else if (firstWord === 0 && ipFields[1] === 0 && ipFields[2] === 0 && ipFields[3] === 0 && ipFields[4] === 0 && ipFields[5] === 0 && ipFields[6] === 0 && ipFields[7] === 1) ipType = 'Loopback Address';
          else if (firstWord === 0xff00) ipType = 'Multicast Address';

          if (subnetResults && subnetCard) {
            subnetResults.innerHTML = `
              <div class="result-item">
                <span class="label">CIDR Notation</span>
                <span class="val highlight" style="color: var(--accent-primary);">${formatIPv6Compressed(ipVal)}/${cidr}</span>
              </div>
              <div class="result-item">
                <span class="label">Subnet Routing Prefix</span>
                <span class="val">${formatIPv6Compressed(netMask)}</span>
              </div>
              <div class="result-item">
                <span class="label">Network Range</span>
                <span class="val" style="font-size: 13px; font-weight: 600; color: #10B981;">${usableRange}</span>
              </div>
              <div class="result-item">
                <span class="label">Total IPs</span>
                <span class="val" style="font-weight: 700;">${totalHosts}</span>
              </div>
              <div class="result-item">
                <span class="label">Address Type</span>
                <span class="val">${ipType}</span>
              </div>
            `;
            subnetCard.classList.remove('hidden');
          }
          recordHistoryDebounced('Converter', { input: input }, `Calculated Subnet: ${ipPart}/${cidr}`);
          return;
        }
      }
    }
  }

  // Fallback to old behavior: Check if matches CIDR prefix pattern: e.g. "/22" or "22"
  const cidrReg = /^\/?(\d{1,3})$/;
  if (cidrReg.test(input)) {
    const cidrNum = parseInt(input.match(cidrReg)[1], 10);
    
    if (cidrNum >= 0 && cidrNum <= 32) {
      const maskVal = cidrNum === 0 ? 0 : (~0 << (32 - cidrNum)) >>> 0;
      const wildcardVal = ~maskVal >>> 0;
      
      document.getElementById('conv-type').textContent = 'IPv4 Prefix';
      document.getElementById('conv-prefix').textContent = `/${cidrNum}`;
      document.getElementById('conv-mask').textContent = uint32ToIp(maskVal);
      document.getElementById('conv-wildcard').textContent = uint32ToIp(wildcardVal);
      document.getElementById('conv-binary').textContent = uint32ToBinaryStr(maskVal);
      
      document.getElementById('conv-ipv6-row').style.display = 'none';
      document.getElementById('conv-binary-row').style.display = 'flex';
      resultsDiv.classList.remove('hidden');
      recordHistoryDebounced('Converter', { input: input }, `Converted: ${input}`);
      return;
    }
    
    if (cidrNum > 32 && cidrNum <= 128) {
      const hostMask = (BigInt(1) << BigInt(128 - cidrNum)) - BigInt(1);
      const netMask = ~hostMask & ((BigInt(1) << BigInt(128)) - BigInt(1));
      
      document.getElementById('conv-type').textContent = 'IPv6 Prefix';
      document.getElementById('conv-prefix').textContent = `/${cidrNum}`;
      document.getElementById('conv-mask').textContent = 'N/A (IPv6)';
      document.getElementById('conv-wildcard').textContent = `::${formatIPv6Compressed(hostMask)}`;
      document.getElementById('conv-ipv6-mask').textContent = `${formatIPv6Compressed(netMask)}`;
      
      document.getElementById('conv-ipv6-row').style.display = 'flex';
      document.getElementById('conv-binary-row').style.display = 'none';
      resultsDiv.classList.remove('hidden');
      recordHistoryDebounced('Converter', { input: input }, `Converted: ${input}`);
      return;
    }
    
    errorEl.textContent = 'Prefix length must be between 0 and 32 (IPv4) or 33 and 128 (IPv6).';
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
    document.getElementById('conv-binary').textContent = uint32ToBinaryStr(maskVal);
    
    document.getElementById('conv-ipv6-row').style.display = 'none';
    document.getElementById('conv-binary-row').style.display = 'flex';
    resultsDiv.classList.remove('hidden');
    recordHistoryDebounced('Converter', { input: input }, `Converted: ${input}`);
    return;
  }

  errorEl.textContent = 'Invalid format. Input a prefix (e.g. /22 or 22), IPv4 mask, or IP + mask (e.g. 83.235.0.0 0.0.7.255 or 192.168.1.1/24).';
  resultsDiv.classList.add('hidden');
}

// --- SUBNET SPLITTER LOGIC ---

let currentSplitMethod = 'equal'; // 'equal' or 'vlsm'

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
      btn.style.background = 'var(--card-bg)';
      btn.style.color = 'var(--text-primary)';
      btn.style.fontWeight = '600';
      
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
  if (splitVlsmHosts) splitVlsmHosts.addEventListener('input', runSplitter);

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
  const ip = ipEl.value.trim();
  const isV6 = ip.indexOf(':') !== -1;
  const currentType = isV6 ? 'v6' : 'v4';
  
  const cidrEl = document.getElementById('split-base-cidr');
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
  runSplitter();
}

function handleAppSplitBaseCidrChange() {
  resetAppSplitTargetSlider();
  runSplitter();
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
}

function blocksToIpStr(blocks) {
  return blocks.map(b => b.toString(16)).join(':').replace(/:(0:)+/, '::');
}

function runSplitter() {
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
      
      for (let i = 0; i < maxRender; i++) {
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
        
        subnets.push({
          name: `Subnet #${i + 1}`,
          cidr: targetCidr,
          network: blocksToIpStr(subnetNetBlocks),
          mask: 'N/A',
          range: blocksToIpStr(subnetNetBlocks) + ' -\n' + blocksToIpStr(subnetLastBlocks),
          hosts: 'N/A',
          required: 'Equal size'
        });
      }
      
      if (subnetsCount > maxRender) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 12px 0;">Warning: Only first ${maxRender} subnets rendered (out of ${subnetsCount} total).</td></tr>`;
      }
    } else {
      const hostsText = document.getElementById('split-vlsm-hosts').value.trim();
      if (hostsText === '') return;
      
      const reqSizes = hostsText.split(',')
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
        
        subnets.push({
          name: `Subnet #${sortedHosts[i].origIndex + 1}`,
          cidr: targetCidr,
          network: blocksToIpStr(subNetBlocks),
          mask: 'N/A',
          range: blocksToIpStr(subNetBlocks) + ' -\n' + blocksToIpStr(subEndBlocks),
          hosts: (BigInt(1) << BigInt(power)).toLocaleString() + ' (req. ' + hostsCount + ')',
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
      
      for (let i = 0; i < maxRender; i++) {
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
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 12px 0;">Warning: Only first ${maxRender} subnets rendered (out of ${subnetsCount} total).</td></tr>`;
      }
    } else {
      const hostsText = document.getElementById('split-vlsm-hosts').value.trim();
      if (hostsText === '') return;
      
      const reqSizes = hostsText.split(',')
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
  
  const methodLabel = currentSplitMethod === 'equal' ? 'Equal Split' : 'VLSM';
  recordHistoryDebounced('Splitter', { baseIp, baseCidr, method: currentSplitMethod }, 'Splitter: ' + baseIp + '/' + baseCidr + ' (' + methodLabel + ')');
}



function getFormattedSplitOutput() {
  const baseIp = document.getElementById('split-base-ip').value.trim();
  const baseCidr = document.getElementById('split-base-cidr').value;
  const method = currentSplitMethod === 'equal' ? 'Equal Split' : 'VLSM (by Host Count)';
  
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

function loadThemeColor() {
  document.documentElement.style.setProperty('--accent-primary', activeThemeColor);
  
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

  // Dark Mode Switch Handler
  const chkDarkMode = document.getElementById('chk-dark-mode');
  if (chkDarkMode) {
    chkDarkMode.checked = document.body.classList.contains('dark-mode');
    chkDarkMode.addEventListener('change', () => {
      if (chkDarkMode.checked) {
        document.body.classList.add('dark-mode');
        SafeStorage.setItem('isubnet_dark_mode', 'true');
      } else {
        document.body.classList.remove('dark-mode');
        SafeStorage.setItem('isubnet_dark_mode', 'false');
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
        accountModalTitle.textContent = 'Create Account';
        signupNameGroup.style.display = 'block';
        signupNameInput.setAttribute('required', 'true');
        btnAccountSubmit.textContent = 'Sign Up';
        linkToggleAuth.textContent = 'Already have an account? Sign In';
      } else {
        accountModalTitle.textContent = 'Sign In';
        signupNameGroup.style.display = 'none';
        signupNameInput.removeAttribute('required');
        btnAccountSubmit.textContent = 'Sign In';
        linkToggleAuth.textContent = "Don't have an account? Sign Up";
      }
    });
  }

  if (btnAccount && modalAccount && btnAccountClose) {
    btnAccount.addEventListener('click', () => {
      // Toggle sign in/out
      if (btnAccount.textContent === 'Sign Out') {
        if (useRealFirebase) {
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
        }
      } else {
        signupError.textContent = '';
        modalSettings.classList.add('hidden'); // Hide settings panel to prevent overlap unresponsive clicks
        modalAccount.classList.remove('hidden');
      }
    });
    btnAccountClose.addEventListener('click', () => {
      modalAccount.classList.add('hidden');
      modalSettings.classList.remove('hidden'); // Restore settings panel
    });
  }

  if (formSignup) {
    formSignup.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = signupNameInput.value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      
      if (isSignUpMode && !name) {
        signupError.textContent = 'Please fill out all fields.';
        return;
      }
      if (!email || !password) {
        signupError.textContent = 'Please fill out all fields.';
        return;
      }
      
      if (useRealFirebase) {
        btnAccountSubmit.textContent = 'Processing...';
        btnAccountSubmit.disabled = true;
        
        let promise;
        if (isSignUpMode) {
          promise = firebase.auth().createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
              return userCredential.user.updateProfile({ displayName: name });
            });
        } else {
          promise = firebase.auth().signInWithEmailAndPassword(email, password);
        }
        
        promise.then(() => {
          btnAccountSubmit.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
          btnAccountSubmit.disabled = false;
          modalAccount.classList.add('hidden');
          modalSettings.classList.remove('hidden');
        }).catch((error) => {
          btnAccountSubmit.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
          btnAccountSubmit.disabled = false;
          signupError.textContent = error.message;
        });
      } else {
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

        modalAccount.classList.add('hidden');
        modalSettings.classList.remove('hidden');
      }
    });
  }

  // Firebase Auth State Observer
  if (useRealFirebase) {
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        // Migrate local data to account
        if (currentUserId === 'local') {
          const localNotesRaw = SafeStorage.getItem('isubnet_notes_local');
          const localHistoryRaw = SafeStorage.getItem('isubnet_history_local');
          
          currentUserId = user.uid;
          
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
        }

        loadNotes();
        loadHistory();

        // Check real subscription status from RevenueCat
        if (useRevenueCat) {
          updateRevenueCatSubscriptionState();
        } else {
          // Default to Free Plan if RevenueCat is not active
          PRO_UNLOCKED = false;
          SafeStorage.setItem('isubnet_pro', 'false');
          applyProState();
          document.getElementById('settings-plan-status').innerHTML = `Current Plan: <strong>Free Plan</strong>`;
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
      }
    });
  }

  // Handle account deletion and data erasure (GDPR compliance)
  if (btnDeleteAccount) {
    btnDeleteAccount.addEventListener('click', async () => {
      const confirmDelete = confirm("WARNING: Are you sure you want to permanently delete your account? This will erase all your synced configurations, calculator history, and custom notes from Banzai GR servers. This action is irreversible.");
      if (!confirmDelete) return;

      const user = firebase.auth().currentUser;
      if (!user) return;

      const userId = user.uid;

      // Show loader state
      btnDeleteAccount.disabled = true;
      btnDeleteAccount.textContent = 'Deleting Account...';

      try {
        if (useRealFirebase) {
          // 1. Delete all Firestore data for this user ID in batches
          const batch = db.batch();
          
          const notesSnapshot = await db.collection("users").doc(userId).collection("notes").get();
          notesSnapshot.forEach(doc => batch.delete(doc.ref));
          
          const historySnapshot = await db.collection("users").doc(userId).collection("history").get();
          historySnapshot.forEach(doc => batch.delete(doc.ref));
          
          batch.delete(db.collection("users").doc(userId));
          await batch.commit();

          // 2. Delete the user authentication record in Firebase
          await user.delete();
        } else {
          // Mock mode local logs
          console.log("Mock Mode: User data deleted from servers for ID: " + userId);
        }

        alert("Your account and all associated data have been permanently deleted from our servers.");
        
        // Hide modal and refresh
        modalSettings.classList.add('hidden');
        
        // Clear local storage notes and history so they don't linger
        SafeStorage.removeItem('isubnet_notes');
        SafeStorage.removeItem('isubnet_history');
        
        // Reload page to reset state
        window.location.reload();
      } catch (err) {
        console.error("Account deletion failed:", err);
        btnDeleteAccount.disabled = false;
        btnDeleteAccount.textContent = 'Delete Account';
        
        if (err.code === 'auth/requires-recent-login') {
          alert("For security reasons, you must sign out and sign in again before you can delete your account.");
        } else {
          alert("Failed to delete account. Please try again or contact support.");
        }
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
      modalPlan.classList.add('hidden');
      modalSettings.classList.add('hidden');
      upgradeWithRevenueCat();
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
      
      fetch("https://formsubmit.co/ajax/info@banzai.gr", {
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
        alert("Thank you! Your feedback has been sent successfully.");
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
        alert("Oops! There was an issue sending your feedback. Please check your connection and try again.");
      });
    });
  }
}

function initQuickPaste() {
  const pasteIpv4 = document.getElementById('paste-ipv4');
  if (pasteIpv4) {
    pasteIpv4.addEventListener('click', () => {
      if (lastCalculatedIP) {
        document.getElementById('ipv4-address').value = lastCalculatedIP;
        calculateIPv4();
      }
    });
  }
  
  const pasteIpv6 = document.getElementById('paste-ipv6');
  if (pasteIpv6) {
    pasteIpv6.addEventListener('click', () => {
      if (lastCalculatedIP) {
        document.getElementById('ipv6-address').value = lastCalculatedIP;
        calculateIPv6();
      }
    });
  }
  
  const pasteSplit = document.getElementById('paste-split');
  if (pasteSplit) {
    pasteSplit.addEventListener('click', () => {
      if (lastCalculatedIP) {
        document.getElementById('split-base-ip').value = lastCalculatedIP;
        runSplitter();
      }
    });
  }
  
  const insertNoteIpBtn = document.getElementById('btn-insert-note-ip');
  if (insertNoteIpBtn) {
    insertNoteIpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!lastCalculatedIP) return;
      
      const noteTextarea = document.getElementById('note-text');
      if (noteTextarea) {
        const startPos = noteTextarea.selectionStart;
        const endPos = noteTextarea.selectionEnd;
        const text = noteTextarea.value;
        noteTextarea.value = text.substring(0, startPos) + lastCalculatedIP + text.substring(endPos, text.length);
        noteTextarea.focus();
        noteTextarea.selectionStart = startPos + lastCalculatedIP.length;
        noteTextarea.selectionEnd = startPos + lastCalculatedIP.length;
      }
    });
  }
  
  renderQuickPastePills();
}

// --- Run Setup on page load ---
function init() {
  initSettings();
  initRevenueCat();
  setupTabNavigation();
  initQuickPaste();
  setupEventListeners();
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
    convInput.addEventListener('input', runConverter);
    runConverter(); // run initial converter on default load
  }

  // --- Pro modal bindings ---
  const buyLifetimeBtn = document.getElementById('btn-pro-buy-lifetime');
  if (buyLifetimeBtn) buyLifetimeBtn.addEventListener('click', () => purchaseProductByPlan('lifetime'));

  const buyYearlyBtn = document.getElementById('btn-pro-buy-yearly');
  if (buyYearlyBtn) buyYearlyBtn.addEventListener('click', () => purchaseProductByPlan('yearly'));

  const buyMonthlyBtn = document.getElementById('btn-pro-buy-monthly');
  if (buyMonthlyBtn) buyMonthlyBtn.addEventListener('click', () => purchaseProductByPlan('monthly'));

  const dismissBtn = document.getElementById('btn-pro-dismiss');
  if (dismissBtn) dismissBtn.addEventListener('click', closeProModal);

  // --- Locked Splitter tab click ---
  const splitterBtn = document.getElementById('tab-btn-splitter');
  if (splitterBtn) {
    splitterBtn.addEventListener('click', () => {
      if (splitterBtn.getAttribute('data-pro') === 'true') {
        showProModal();
      }
    });
  }

  // Apply pro state on load (restores PRO badge + unlocked tabs if already purchased)
  applyProState();
}

// --- Limit Banner Helpers ---
function showNotesLimitBanner() {
  const list = document.getElementById('notes-list');
  if (!list) return;
  if (list.querySelector('.pro-limit-banner')) return; // already shown
  const banner = document.createElement('div');
  banner.className = 'pro-limit-banner';
  banner.innerHTML = `
    <p>You've reached the <strong>free limit of ${FREE_NOTES_LIMIT} notes</strong>. Upgrade to Pro for unlimited notes.</p>
    <button class="btn-upgrade-inline" onclick="showProModal()">Upgrade</button>
  `;
  list.prepend(banner);
}

function showHistoryLimitBanner() {
  const list = document.getElementById('history-list');
  if (!list) return;
  if (list.querySelector('.pro-limit-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'pro-limit-banner';
  banner.innerHTML = `
    <p>History is limited to <strong>${FREE_HISTORY_LIMIT} entries</strong> on the free plan.</p>
    <button class="btn-upgrade-inline" onclick="showProModal()">Upgrade</button>
  `;
  list.prepend(banner);
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

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
  let hasValid = false;

  lines.forEach(line => {
    let ip = line;
    let cidr = 24;

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

    if (!validateIPv4(ip) || isNaN(cidr) || cidr < 0 || cidr > 32) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td style="color:#ef4444; padding:8px 4px;">${escapeHTML(line)}</td><td colspan="3" style="color:#ef4444; padding:8px 4px;">Invalid IP/Prefix format</td>`;
      tbody.appendChild(tr);
      return;
    }

    hasValid = true;
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
      <td style="padding: 8px 4px; font-weight: 500;">${escapeHTML(ip)}/${cidr}</td>
      <td style="padding: 8px 4px; font-family: monospace;">${uint32ToIp(networkVal)}</td>
      <td style="padding: 8px 4px; font-family: monospace; font-size: 11px;">${rangeStart} - ${rangeEnd}</td>
      <td style="padding: 8px 4px; font-weight: bold; color: var(--accent-primary);">${usableHosts.toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });

  if (hasValid) {
    card.classList.remove('hidden');
  }
}

function calculateBulkIPv6() {
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
  let hasValid = false;

  lines.forEach(line => {
    let ip = line;
    let cidr = 64;

    if (line.includes('/')) {
      const parts = line.split('/');
      ip = parts[0].trim();
      cidr = parseInt(parts[1], 10);
    }

    const ipBigInt = parseIPv6(ip);
    if (ipBigInt === null || isNaN(cidr) || cidr < 1 || cidr > 128) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td style="color:#ef4444; padding:8px 4px;">${escapeHTML(line)}</td><td colspan="2" style="color:#ef4444; padding:8px 4px;">Invalid IPv6/Prefix format</td>`;
      tbody.appendChild(tr);
      return;
    }

    hasValid = true;
    const hostMask = (BigInt(1) << BigInt(128 - cidr)) - BigInt(1);
    const netMask = ~hostMask & ((BigInt(1) << BigInt(128)) - BigInt(1));
    const networkPrefixVal = ipBigInt & netMask;
    const broadcastVal = networkPrefixVal | hostMask;
    const totalAddresses = BigInt(2) ** BigInt(128 - cidr);

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
    tr.innerHTML = `
      <td style="padding: 8px 4px; font-weight: 500;">${formatIPv6Compressed(ipBigInt)}/${cidr}</td>
      <td style="padding: 8px 4px; font-family: monospace; font-size: 11px;">
        Start: ${formatIPv6Compressed(networkPrefixVal)}<br>
        End: ${formatIPv6Compressed(broadcastVal)}
      </td>
      <td style="padding: 8px 4px; font-weight: bold; color: var(--accent-cyan);">${totalAddresses.toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });

  if (hasValid) {
    card.classList.remove('hidden');
  }
}

// --- CSV/PDF REPORT EXPORTER ---
function setupExporterListeners() {
  const exportPDF = () => {
    window.print();
  };

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
      const compressed = document.getElementById('res6-compressed').textContent;
      const expanded = document.getElementById('res6-expanded').textContent;
      const prefix = document.getElementById('res6-prefix').textContent;
      const netPrefix = document.getElementById('res6-net-prefix').textContent;
      const start = document.getElementById('res6-start').textContent;
      const end = document.getElementById('res6-end').textContent;
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
      csv = `Input IP,Network,Range,Usable Hosts\n`;
      const rows = document.querySelectorAll('#ipv4-bulk-results-tbody tr');
      rows.forEach(row => {
        const tds = row.querySelectorAll('td');
        if (tds.length >= 4) {
          csv += `"${tds[0].textContent}","${tds[1].textContent}","${tds[2].textContent}","${tds[3].textContent}"\n`;
        }
      });
    } else if (type === 'bulk-ipv6') {
      csv = `Input IP,Prefix / Range,Total Addresses\n`;
      const rows = document.querySelectorAll('#ipv6-bulk-results-tbody tr');
      rows.forEach(row => {
        const tds = row.querySelectorAll('td');
        if (tds.length >= 3) {
          csv += `"${tds[0].textContent}","${tds[1].textContent.replace('\n', ' ')}","${tds[2].textContent}"\n`;
        }
      });
    }
    return csv;
  };

  const triggerCSVDownload = (type) => {
    if (!PRO_UNLOCKED) {
      showProModal();
      return;
    }
    const csvContent = getCSVData(type);
    downloadCSV(`isubnet_export_${type}.csv`, csvContent);
  };

  const triggerPDFExport = async (type) => {
    if (!PRO_UNLOCKED) {
      showProModal();
      return;
    }

    const isNative = window.Capacitor && window.Capacitor.isNativePlatform();
    if (isNative) {
      try {
        const reportText = getReportText(type);
        const { Filesystem, Share } = window.Capacitor.Plugins;
        const filename = `isubnet_report_${type}.txt`;
        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: reportText,
          directory: 'CACHE',
          encoding: 'utf8'
        });
        await Share.share({
          title: 'Export Report',
          url: writeResult.uri
        });
      } catch (err) {
        console.error("Capacitor Report Export failed:", err);
        alert("Export failed: " + err.message);
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
    report += `Banzai GR - https://banzai.gr\n`;
    return report;
  }

  const pdfIds = [
    { id: 'btn-export-pdf-ipv4', type: 'ipv4' },
    { id: 'btn-export-pdf-ipv6', type: 'ipv6' },
    { id: 'btn-export-pdf-split', type: 'split' },
    { id: 'btn-export-pdf-conv', type: 'conv' },
    { id: 'btn-export-pdf-conv-subnet', type: 'conv-subnet' },
    { id: 'btn-export-pdf-bulk-ipv4', type: 'bulk-ipv4' },
    { id: 'btn-export-pdf-bulk-ipv6', type: 'bulk-ipv6' }
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
    { id: 'btn-export-csv-bulk-ipv6', type: 'bulk-ipv6' }
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
}

async function downloadCSV(filename, content) {
  const isNative = window.Capacitor && window.Capacitor.isNativePlatform();
  if (isNative) {
    try {
      const { Filesystem, Share } = window.Capacitor.Plugins;
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: 'CACHE',
        encoding: 'utf8'
      });
      await Share.share({
        title: 'Export CSV',
        url: writeResult.uri
      });
      return;
    } catch (err) {
      console.error("Capacitor CSV Export failed:", err);
      alert("Export failed: " + err.message);
      return;
    }
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

