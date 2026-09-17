# iSubnet — Build 73: Keyboard Fixes + Splitter Method Highlight + History Tab Fix

**Target build: versionCode/CURRENT_PROJECT_VERSION 73.** Verified directly against the uploaded project as of build 70 (uploaded 2026-09-16); do not re-derive line numbers from an older copy of this prompt.

This is a standalone, out-of-band fix — same pattern as the earlier build-71/72 keyboard work referenced in the combined-round prompt (`iSubnet_combined_round_build71_implementation_prompt.md`). It ships ahead of that larger round, on its own. **Once this lands, the combined-round prompt's version math needs a fresh correction pass** (it currently assumes a "build-72" baseline and produces build 73 itself — that numbering will need to shift once this actually ships). Do not attempt that reconciliation as part of this prompt; noted here only so it isn't forgotten.

**Why this build exists:** build 72 shipped a first attempt at the keyboard fixes, but live device testing found it incomplete — Parts A and B below were still broken, and two more issues (C, D) surfaced during that same test pass. Part E (History tab) was found as a side effect while investigating Part D — same root-cause bug, different screen, never separately reported but trivial to fold in alongside it. This prompt covers all five together.

---

## PART A — `#converter-input`: numeric keypad + reject IPv6 entirely

### Background
The Wildcard & Prefix Converter (`#converter-input`) is meant to accept a CIDR prefix (`/22`), an IPv4 subnet mask (`255.255.255.0`), an IPv4 wildcard mask (`0.0.3.255`), or an IPv4 address + mask/prefix pair — never an IPv6 address or prefix. It currently has no `inputmode` set, so mobile browsers show a full alphanumeric keyboard for a field that only ever needs digits and a dot. It also currently *does* accept and parse IPv6 input (prefixes `/33`–`/128`, and `<ipv6> <cidr>` pairs) via a `parseIPv6()` branch — that's being removed as part of this fix, not just hidden, since a wildcard/prefix mask has no real IPv6 equivalent (wildcard masks are a legacy IPv4/Cisco-ACL construct with no inverse-subnet-mask analog in IPv6) and the field was never meant to support it.

### TASK A1 — Add the numeric keypad
File: `index.html` (verified: line 886)
```diff
- <input type="text" id="converter-input" placeholder="e.g. /22 or 0.0.3.255" value="/24">
+ <input type="text" id="converter-input" inputmode="decimal" placeholder="e.g. /22 or 0.0.3.255" value="/24">
```
`inputmode="decimal"` is the correct choice over `"numeric"` — it keeps a decimal-point key on the keypad, which this field needs for dotted-decimal masks (`0.0.3.255`) and doesn't need anything else for (no minus sign, no IPv6 hex/colons once Task A3 lands). The `/` prefix syntax (`/22`) is the one case that still requires manually switching to the alphabet keyboard — expected, already accepted as fine.

**Platform note (read before assuming this alone is sufficient):** on some Android WebView/keyboard combinations, `inputmode="decimal"` renders its decimal key as a **comma**, not a dot, depending on device region settings — this is a real platform behavior, not a code bug on its own. That's exactly what Task A2 (and Part B below) compensates for. If build 72's attempt at this field's keypad was tested only on a device/region where the decimal key happens to render as a dot, it would have looked fixed there and still be broken elsewhere — test on more than one region setting where possible.

### TASK A2 — Comma-to-dot normalizer
File: `app.js`, converter setup block (verified: lines 4604–4611)
```diff
  const convInput = document.getElementById('converter-input');
  if (convInput) {
    const randomCidr = Math.floor(Math.random() * (30 - 8 + 1)) + 8; // Random CIDR from 8 to 30
    const maskVal = (~0 << (32 - randomCidr)) >>> 0;
    const wildcardVal = ~maskVal >>> 0;
    convInput.value = uint32ToIp(wildcardVal);
-   convInput.addEventListener('input', runConverter);
+   convInput.addEventListener('input', () => {
+     // Some locales' numeric keypad emits a decimal comma instead of a dot;
+     // normalize so "192,168,1,1" / "0,0,3,255" style entry still parses.
+     const start = convInput.selectionStart;
+     const end = convInput.selectionEnd;
+     if (convInput.value.indexOf(',') !== -1) {
+       convInput.value = convInput.value.replace(/,/g, '.');
+       if (start !== null && end !== null) {
+         convInput.setSelectionRange(start, end);
+       }
+     }
+     runConverter();
+   });
    runConverter(); // run initial converter on default load
  }
```
This also covers the field's Paste button (`btn-paste-converter`, line ~4443) for free — it dispatches a synthetic `input` event after setting the value, which this same listener catches.

### TASK A3 — Remove IPv6 parsing from `runConverter()`
File: `app.js`, function `runConverter()` (verified: lines 2655–2938)

**Do NOT delete the `parseIPv6()` function itself** — it's shared with the IPv6 Subnet Calculator tab and other features (verified additional call sites at lines 1452, 3132, 3248, 4905, 5017). Only remove its use *inside this one function*.

**A3a — Remove the combined `<ipv6> <cidr>` branch** (verified: lines 2760–2847, the `else if (parseIPv6(ipPart) !== null) { ... }` block immediately following the IPv4 combined-input branch):
```diff
        recordHistoryDebounced('Converter', { input: input }, `Calculated Subnet: ${ipPart}/${cidr}`);
        return;
      }
-   } else if (parseIPv6(ipPart) !== null) {
-     let cidr = null;
-     const prefixReg = /^\/?(\d{1,3})$/;
-     if (prefixReg.test(maskPart)) {
-       cidr = parseInt(maskPart.match(prefixReg)[1], 10);
-     }
-
-     if (cidr !== null && cidr >= 0 && cidr <= 128) {
-       ... (full IPv6 subnet-input rendering block — CIDR notation, routing
-           prefix, network range, total IPs, address type, subnetResults.innerHTML)
-       recordHistoryDebounced('Converter', { input: input }, `Calculated Subnet: ${ipPart}/${cidr}`);
-       return;
-     }
    }
  }
```
(Full removed block is ~88 lines — the entire `else if` body through its matching closing brace. Grep for `parseIPv6(ipPart)` to find it precisely rather than trusting the line count if other edits have landed since this prompt was written.)

**A3b — Remove the standalone `/33`–`/128` IPv6 prefix branch** (verified: lines 2873–2889, inside the CIDR-prefix fallback):
```diff
      document.getElementById('conv-ipv6-row').style.display = 'none';
      document.getElementById('conv-binary-row').style.display = 'flex';
      updateConvHosts(cidrNum, false);
      resultsDiv.classList.remove('hidden');
      recordHistoryDebounced('Converter', { input: input }, `Converted: ${input}`);
      return;
    }
    
-   if (cidrNum > 32 && cidrNum <= 128) {
-     const hostMask = (BigInt(1) << BigInt(128 - cidrNum)) - BigInt(1);
-     const netMask = ~hostMask & ((BigInt(1) << BigInt(128)) - BigInt(1));
-     
-     document.getElementById('conv-type').textContent = 'IPv6 Prefix';
-     document.getElementById('conv-prefix').textContent = `/${cidrNum}`;
-     document.getElementById('conv-mask').textContent = 'N/A (IPv6)';
-     document.getElementById('conv-wildcard').textContent = formatIPv6Compressed(hostMask);
-     document.getElementById('conv-ipv6-mask').textContent = formatIPv6Compressed(netMask);
-     
-     document.getElementById('conv-ipv6-row').style.display = 'flex';
-     document.getElementById('conv-binary-row').style.display = 'none';
-     updateConvHosts(cidrNum, true);
-     resultsDiv.classList.remove('hidden');
-     recordHistoryDebounced('Converter', { input: input }, `Converted: ${input}`);
-     return;
-   }
-   
-   errorEl.textContent = 'Prefix length must be between 0 and 32 (IPv4) or 33 and 128 (IPv6).';
+   errorEl.textContent = 'Prefix length must be between 0 and 32.';
    resultsDiv.classList.add('hidden');
    return;
  }
```

**A3c — Remove the now-dangling `conv-ipv6-row` display toggles** in the three IPv4-only branches that remain (they'd throw `TypeError: Cannot set properties of null` once Task A4 removes the element from the DOM — this must land together with Task A4, not separately):
- Line 2715 (IPv4 combined-input branch): delete `document.getElementById('conv-ipv6-row').style.display = 'none';`
- Line 2865 (IPv4 CIDR-prefix branch): delete the same line
- Line 2928 (IPv4 mask/wildcard branch): delete the same line

**A3d — Tighten the CIDR-prefix regex** (verified: line 2851). With IPv6's 3-digit prefix range (33–128) gone, allowing a 3-digit match here is vestigial:
```diff
- const cidrReg = /^\/?(\d{1,3})$/;
+ const cidrReg = /^\/?(\d{1,2})$/;
```

### TASK A4 — Remove the IPv6 output row markup
File: `index.html` (verified: lines 907–910)
```diff
-           <div class="conv-result-row" id="conv-ipv6-row" style="display: none;">
-             <span class="conv-result-label">IPv6 Canonical Mask</span>
-             <span class="conv-result-val" id="conv-ipv6-mask">ffff:ffff:ffff:ffff::</span>
-           </div>
            <div class="conv-result-row" id="conv-hosts-row">
```
Must land in the same pass as Task A3c — the two are one change split across files.

### Optional cleanup (not required, safe to skip)
`saveConvNote()` (line 2071) and `shareConvResult()` (line 2205) both derive `isIpv6` from whether `#conv-type`'s text contains `"IPv6"` and, when true, read `#conv-ipv6-mask`. After Part A, `runConverter()` can never set `conv-type` to an IPv6 value, so `isIpv6` is always `false` in both functions and the `conv-ipv6-mask` reads are dead code — unreachable, not a crash risk. Remove only if doing a broader cleanup pass.

---

## PART B — `#ipv4-address`: fix the missing dot key

### Background — root cause, verified against the source
This field (`index.html` line 466) **already has** `inputmode="decimal"` set in the current source. That part isn't the bug. The bug is that `calculateIPv4()` (verified: line 912, listener bound at line 2317) does **no comma-to-dot normalization**, and `validateIPv4()`'s regex (line 905: `/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/`) requires literal dots. Confirmed no `pattern` attribute or character filter exists on the field beyond a harmless Enter-key handler (line 2406) — so this isn't a character-blocking bug either.

Put together: on a device/region where `inputmode="decimal"`'s decimal key renders as a comma (see the platform note in Part A), the user can only ever produce something like `192,168,1,1`, which fails IPv4 validation outright — and from the user's side, that looks exactly like "the dot key is missing," because functionally it is unreachable from that keypad. This is the same underlying issue as Part A's Task A2, just on a different field that was never given the same fix.

### TASK B1 — Comma-to-dot normalizer for `#ipv4-address`
File: `app.js`, `setupEventListeners()` (verified: line 2317)
```diff
  // Real-time calculation triggers
- document.getElementById('ipv4-address').addEventListener('input', calculateIPv4);
+ document.getElementById('ipv4-address').addEventListener('input', () => {
+   // Same locale issue as the Converter field: some numeric keypads emit
+   // a decimal comma instead of a dot.
+   const ipv4El = document.getElementById('ipv4-address');
+   const start = ipv4El.selectionStart;
+   const end = ipv4El.selectionEnd;
+   if (ipv4El.value.indexOf(',') !== -1) {
+     ipv4El.value = ipv4El.value.replace(/,/g, '.');
+     if (start !== null && end !== null) {
+       ipv4El.setSelectionRange(start, end);
+     }
+   }
+   calculateIPv4();
+ });
  document.getElementById('ipv4-cidr').addEventListener('input', calculateIPv4);
```
The field's Paste button (`btn-paste-ipv4`, uses `pasteFromClipboard('ipv4-address', calculateIPv4)` at line 4346) dispatches a synthetic `input` event, so it's covered by this same listener — no separate change needed there.

**Do not change `#ipv4-address`'s `inputmode` attribute** — it's already correct as `"decimal"`. Only the missing normalizer is being added.

---

## PART C — `#split-vlsm-hosts` (Splitter → Host Count/VLSM): dot/comma/space as separators + insert buttons

### Background
File: `index.html` (verified: line 818) — `inputmode="numeric"`, placeholder `"e.g. 50 30 10 2"`. This field takes a comma-and/or-space-separated list of host counts, not a single number. `inputmode="numeric"` gives digits only — no comma, no space — so on a device that honors it strictly, the user cannot type more than one number.

**No single HTML `inputmode` value gives digits + comma + space together.** The approach landed on: use `inputmode="decimal"` instead of `"numeric"` (adds a dot key to the native keypad), extend the parsing regex to accept the dot as a third separator alongside comma and space, and add two small buttons next to the field that insert a comma or a space at the cursor position for the two separator characters the keypad still can't produce. This gives three ways to separate numbers — comma, space, or dot — with the native keypad covering digits + dot, and the two buttons covering the rest. Same visual language as the existing `.btn-adjust` circular buttons (used for the CIDR +/- controls elsewhere in this same tab), so the buttons don't introduce a new UI pattern.

### TASK C0 — Widen the separator regex to include the dot
File: `app.js`, `runSplitter()`'s VLSM branch — this exact parsing line appears **twice** in the file (verified: lines 3154 and 3309; both must be updated identically, they're duplicated logic, not a typo):
```diff
- const reqSizes = hostsText.split(/[,\s]+/)
+ const reqSizes = hostsText.split(/[,.\s]+/)
                            .map(s => parseInt(s.trim(), 10))
                            .filter(n => !isNaN(n) && n > 0);
```
The label/helper text and `inputmode` change together are covered in Task C2 below.

### TASK C1 — Add the insert-at-cursor helper
File: `app.js`, immediately before `initSplitterListeners()` (verified: line 2944)
```diff
  // --- SUBNET SPLITTER LOGIC ---

  let currentSplitMethod = 'equal'; // 'equal' or 'vlsm'

+ // Inserts `text` at the current cursor position of the given input, then
+ // fires its 'input' listener so dependent calculations re-run.
+ function insertAtCursor(inputId, text) {
+   const el = document.getElementById(inputId);
+   if (!el) return;
+   const start = el.selectionStart ?? el.value.length;
+   const end = el.selectionEnd ?? el.value.length;
+   el.value = el.value.slice(0, start) + text + el.value.slice(end);
+   const newPos = start + text.length;
+   el.focus();
+   el.setSelectionRange(newPos, newPos);
+   el.dispatchEvent(new Event('input', { bubbles: true }));
+ }
+
  function initSplitterListeners() {
    // Split Method Selection (Equal vs VLSM)
    const methodBtns = document.querySelectorAll('.method-btn');
```
This is a generic helper (not VLSM-specific) in case another field wants the same treatment later.

### TASK C2 — Switch to a decimal keypad, add the two buttons, and update the copy
File: `index.html` (verified: lines 815–821, the VLSM panel)
```diff
  <!-- Panel for VLSM Method -->
  <div id="split-vlsm-panel" class="hidden" style="margin-top: 15px;">
    <div class="input-group">
-     <label for="split-vlsm-hosts">Required Host Sizes (comma or space-separated):</label>
+     <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
+       <label for="split-vlsm-hosts" style="margin: 0;">Required Host Sizes (comma, space, or dot-separated):</label>
+       <div style="display: flex; gap: 6px; flex-shrink: 0;">
+         <button type="button" class="btn-adjust" style="width: 26px; height: 26px; font-size: 14px;" onclick="insertAtCursor('split-vlsm-hosts', ',')" title="Insert comma">,</button>
+         <button type="button" class="btn-adjust" style="width: 26px; height: 26px; font-size: 11px;" onclick="insertAtCursor('split-vlsm-hosts', ' ')" title="Insert space">␣</button>
+       </div>
+     </div>
-     <input type="text" id="split-vlsm-hosts" inputmode="numeric" placeholder="e.g. 50 30 10 2" value="50, 30, 10, 2">
-     <p class="helper-text" style="margin-top: 5px;">Enter hosts needed for each subnet, separated by commas.</p>
+     <input type="text" id="split-vlsm-hosts" inputmode="decimal" placeholder="e.g. 50 30 10 2" value="50, 30, 10, 2">
+     <p class="helper-text" style="margin-top: 5px;">Enter hosts needed for each subnet, separated by commas, spaces, or dots.</p>
    </div>
  </div>
```
`inputmode` changes from `"numeric"` to `"decimal"` here — a deliberate pairing with Task C0's regex change, not an oversight: the decimal keypad's dot key is now a real, working separator (Task C0 made the parser accept it), so it's pulling its weight instead of sitting on the keypad unused. The two buttons still cover comma and space, which no `inputmode` value provides.

---

## PART D — Splitter: fix the Equal/VLSM method highlight

### Background — root cause, verified against the source
This is a genuine CSS bug, not a subtlety-of-design issue. Both the initial markup and the click handler set the active button's background to `var(--card-bg)` — but `--card-bg` **is never defined anywhere** in `styles.css` (confirmed by grepping for its declaration — no match). The actual defined variable is `--bg-card` (declared at `styles.css` lines 5 and 1148). Because `--card-bg` doesn't exist, `background: var(--card-bg)` resolves to nothing (CSS's guaranteed-invalid-value behavior), so the "highlighted pill" background never actually renders — only the font-weight (600 vs 500) and text color (`--text-primary` vs `--text-secondary`) differences survive, and that gap alone is too subtle to read as "selected" at a glance. This matches the report exactly: the selection state is technically being set, it just isn't visible.

The same typo has a second occurrence — see Part E below, same root cause, different screen.

### TASK D1 — Fix the variable name and strengthen the highlight
Per the request, the selected method should read as bold **and** highlighted in the app's accent color, not just a background-color swap. `--accent-primary` (`styles.css` line 13, `#4f46e5`) is the color already used elsewhere in the app for "this is the emphasized value" (e.g. `.highlight { color: var(--accent-primary); }`).

File: `index.html` (verified: line 793 — the default-selected "Equal Split" button)
```diff
- <button class="method-btn active" data-method="equal" style="flex: 1; background: var(--card-bg); border: none; border-radius: 6px; padding: 6px; color: var(--text-primary); font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;">Equal Split (FLSM)</button>
+ <button class="method-btn active" data-method="equal" style="flex: 1; background: var(--bg-card); border: none; border-radius: 6px; padding: 6px; color: var(--accent-primary); font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease;">Equal Split (FLSM)</button>
```

File: `app.js`, `initSplitterListeners()` click handler (verified: lines 2950–2961)
```diff
    btn.addEventListener('click', () => {
      methodBtns.forEach(b => {
        b.classList.remove('active');
        b.style.background = 'none';
        b.style.color = 'var(--text-secondary)';
        b.style.fontWeight = '500';
      });
      btn.classList.add('active');
-     btn.style.background = 'var(--card-bg)';
-     btn.style.color = 'var(--text-primary)';
-     btn.style.fontWeight = '600';
+     btn.style.background = 'var(--bg-card)';
+     btn.style.color = 'var(--accent-primary)';
+     btn.style.fontWeight = '700';
```
The history-restore path (`app.js` line 1925–1930, inside the history-item-click handler) already re-triggers this same click handler programmatically (`btn.click()`), so it picks up this fix automatically — no separate change needed there.

---

## PART E — History tab: fix invisible card background/border

### Background — root cause, verified against the source
Same bug family as Part D, different screen. `.history-item` (`styles.css`, verified: line 871) sets `background: var(--card-bg)` and `border: 1px solid var(--card-border)`. Neither `--card-bg` nor `--card-border` is defined anywhere in `styles.css` (confirmed by grepping for their declarations — no match for either). The app's actual card-styling variables, used consistently everywhere else (e.g. `.card` at line 164), are `--bg-card` and `--border-color`. Because the two variables `.history-item` references don't exist, both its background and its border have been silently rendering as nothing — every row in the History tab list has likely had no visible card background or border this whole time, just text sitting directly on the page background.

### TASK E1 — Fix the variable names
File: `styles.css` (verified: lines 870–880)
```diff
  .history-item {
-   background: var(--card-bg);
-   border: 1px solid var(--card-border);
+   background: var(--bg-card);
+   border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: var(--transition-smooth);
  }
```
No JS changes needed — this is a pure CSS fix, and no other selector references `--card-bg` or `--card-border` (both grepped with zero remaining matches after this change).

---

## DO NOT TOUCH (already correct / verified working)
- `parseIPv6()` itself, and every other call site of it outside `runConverter()` (IPv6 Subnet Calculator tab, IPv6 hosts field, etc.).
- `#split-base-ip` and `handleAppSplitIpChange()` — dual-stack by design (accepts IPv4 or IPv6 for the Splitter's base network), out of scope for this build. Do not give it a decimal-only keypad.
- `#ipv4-address`'s `inputmode="decimal"` attribute — already correct, only its missing normalizer (Part B) was the gap.
- `runSplitter()`'s VLSM host-list parsing (line 3240) — already tolerant of stray characters, no change needed.
- The Number Base Converter (Binary/Octal/Decimal/Hex) fields — unrelated feature, unaffected.
- `updateConvHosts(cidr, isV6)` — the function itself keeps its `isV6` branch (harmless, used nowhere else that would break); only its call sites inside `runConverter()` that passed `true` are removed along with the branches that called them.

---

## VERIFICATION STEPS

**Part A — Converter field**
1. Tap `#converter-input` — confirm a numeric keypad with a decimal-point key appears (no letters), and that `/` still requires switching to the alphabet keyboard (expected, unchanged).
2. On a device/region set to use comma as the decimal separator, type `0,0,3,255` — confirm it normalizes to `0.0.3.255` and parses correctly, cursor position preserved.
3. Paste `2001:db8::/32` and `2001:db8:: /64` — confirm both produce "Invalid format..." and `#conv-ipv6-row` never appears (it no longer exists in the DOM).
4. `/24`, `255.255.255.0`, `0.0.0.255`, `192.168.1.1 255.255.255.0`, `192.168.1.1/24` all still produce correct results, unchanged from before.
5. `/33` through `/128` now fail with "Prefix length must be between 0 and 32." `/0`–`/32` still succeed.
6. No `TypeError` from a missing `conv-ipv6-row` element across all four IPv4 result paths.

**Part B — IPv4 Calculator field**
7. On the same comma-decimal region/device used in step 2, type `192,168,1,1` into `#ipv4-address` — confirm it normalizes to `192.168.1.1` and calculates correctly.
8. Confirm `#ipv4-address`'s keypad is otherwise unchanged (still `inputmode="decimal"`, still shows a numeric pad).

**Part C — VLSM hosts field**
9. Tap `#split-vlsm-hosts` — confirm a decimal keypad now appears (digits + a working dot key, no letters).
9a. Type `50.30.10.2` using only the dot key on the native keypad — confirm it splits into four subnets (50, 30, 10, 2), same as the comma/space-separated form.
9b. Type `50`, tap the new comma button, type `30`, tap the new space button, type `10` — confirm the field reads `50,30 10` (or similar) and that focus returns to the field after each tap so typing can continue without re-tapping the input.
9c. Confirm the list still splits correctly as each character is inserted (the buttons dispatch a real `input` event, so `runSplitter()` re-runs live, same as typing).
9d. Confirm the two buttons are reachable/tappable target size (26×26px, matching `.btn-adjust` elsewhere) and don't overlap the label on the smallest supported screen width.
9e. Confirm the label reads "comma, space, or dot-separated" and the helper text mentions all three.

**Part D — Method highlight**
10. Open the Splitter tab fresh — confirm "Equal Split (FLSM)" is visibly bold and in the accent color (indigo) by default, with a visible background pill, and "Host Count (VLSM)" is visibly muted/secondary.
11. Tap "Host Count (VLSM)" — confirm the highlight (background pill + accent color + bold) moves to it and "Equal Split (FLSM)" becomes muted. Tap back — confirm it reverses correctly.
12. Restore a saved Splitter history item that used VLSM — confirm the VLSM button shows as selected after the restore (exercises the `btn.click()` path at line 1925–1930).

**Part E — History tab**
13. Open the History tab with at least one saved item — confirm each row now shows a visible card background and a visible border, in both light and dark mode, instead of text sitting directly on the page background.
14. Confirm the existing hover state (`.history-item:hover`, line 882) still looks correct against the newly-visible base background — it wasn't changed, but it was previously being seen against an invisible base, so double-check the contrast still reads well now that the base card is visible.
