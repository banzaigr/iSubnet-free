const fs = require('fs');

// 1. app.js edits
let code = fs.readFileSync('app.js', 'utf8');

const splitterLogic = `// Splitter's runSplitter() rebuilds up to 128 <tr> rows via createElement/
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

function initSplitterListeners() {`;

code = code.replace('function initSplitterListeners() {', splitterLogic);

code = code.replace(
  'resetAppSplitTargetSlider();\n  runSplitter();\n}\n\nfunction handleAppSplitBaseCidrChange',
  'resetAppSplitTargetSlider();\n  runSplitterDebounced();\n}\n\nfunction handleAppSplitBaseCidrChange'
);

code = code.replace(
  'resetAppSplitTargetSlider();\n  runSplitter();\n}',
  'resetAppSplitTargetSlider();\n  runSplitterDebounced();\n}'
);

code = code.replace(
  "if (splitVlsmHosts) splitVlsmHosts.addEventListener('input', runSplitter);",
  "if (splitVlsmHosts) splitVlsmHosts.addEventListener('input', runSplitterDebounced);"
);

fs.writeFileSync('app.js', code);
console.log('Updated app.js');

// 2. styles.css edits
let css = fs.readFileSync('styles.css', 'utf8');

const cssLogic = `.card:hover {
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 12px 36px 0 rgba(0, 0, 0, 0.3), 0 0 15px rgba(59, 130, 246, 0.05);
}

/* Splitter's result table can hold up to 128 rendered rows (runSplitter() in
   app.js), far more DOM than the other tabs' small fixed-field result cards.
   Without containment, every rebuild of this table forces the browser to
   recompute layout for the whole .app-content scroll area - including while
   its own padding-bottom is mid-transition during the iOS keyboard-avoidance
   settle (see the "padding-bottom 0.2s ease" comment on .app-content above).
   \`contain: content\` scopes this card's layout/paint to itself so rebuilding
   it doesn't fight that transition. */
#split-results {
  contain: content;
}`;

css = css.replace(
  `.card:hover {\n  border-color: rgba(255, 255, 255, 0.12);\n  box-shadow: 0 12px 36px 0 rgba(0, 0, 0, 0.3), 0 0 15px rgba(59, 130, 246, 0.05);\n}`,
  cssLogic
);

fs.writeFileSync('styles.css', css);
console.log('Updated styles.css');
