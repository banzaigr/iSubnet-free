const fs = require('fs');

let appjs = fs.readFileSync('app.js', 'utf8');

// Edit 1
const edit1Target = `  // Tracks the last known keyboard height so the visualViewport resize listener
  // (below) can re-run applyKeyboardHeight() if the WebView resizes AFTER we've
  // already applied an offset - see that listener for why this matters.
  let currentKeyboardHeight = 0;`;

const edit1Replacement = `  // Tracks the last known keyboard height so the visualViewport resize listener
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
  };`;

appjs = appjs.replace(edit1Target, edit1Replacement);

// Edit 2
const edit2Target = `  Keyboard.addListener('keyboardWillShow', (info) => {
    dlog(\`EVENT keyboardWillShow fired, info=\${JSON.stringify(info)}\`);
    applyKeyboardHeight((info && info.keyboardHeight) || 0);
  });
  Keyboard.addListener('keyboardDidShow', (info) => {
    dlog(\`EVENT keyboardDidShow fired, info=\${JSON.stringify(info)}\`);
    applyKeyboardHeight((info && info.keyboardHeight) || 0);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrollFocusedIntoView();
      snapshot('  after scrollFocusedIntoView rAF x2');
    }));
  });
  Keyboard.addListener('keyboardWillHide', () => {
    dlog(\`EVENT keyboardWillHide fired\`);
    applyKeyboardHeight(0);
  });
  Keyboard.addListener('keyboardDidHide', () => {
    dlog(\`EVENT keyboardDidHide fired\`);
    if (isIOS) trackFullViewportHeight();
    snapshot('  after keyboardDidHide');
  });`;

const edit2Replacement = `  Keyboard.addListener('keyboardWillShow', (info) => {
    dlog(\`EVENT keyboardWillShow fired, info=\${JSON.stringify(info)}\`);
    const height = (info && info.keyboardHeight) || 0;
    if (!isIOS) {
      applyKeyboardHeight(height);
      return;
    }
    currentKeyboardHeight = height;
    clearKeyboardShowFallback();
    keyboardShowFallbackTimeout = setTimeout(() => {
      keyboardShowFallbackTimeout = null;
      dlog(\`  keyboardShowFallback(\${KEYBOARD_SHOW_FALLBACK_MS}ms) fired - no visualViewport resize arrived in time, applying manual offset(\${currentKeyboardHeight}) as fallback\`);
      applyKeyboardHeight(currentKeyboardHeight);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        scrollFocusedIntoView();
        snapshot('  after scrollFocusedIntoView (fallback rAF x2)');
      }));
    }, KEYBOARD_SHOW_FALLBACK_MS);
  });
  Keyboard.addListener('keyboardDidShow', (info) => {
    dlog(\`EVENT keyboardDidShow fired, info=\${JSON.stringify(info)}\`);
    if (!isIOS) {
      applyKeyboardHeight((info && info.keyboardHeight) || 0);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        scrollFocusedIntoView();
        snapshot('  after scrollFocusedIntoView rAF x2');
      }));
      return;
    }
    currentKeyboardHeight = (info && info.keyboardHeight) || currentKeyboardHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrollFocusedIntoView();
      snapshot('  after scrollFocusedIntoView rAF x2 (iOS - offset deferred, native resize pending)');
    }));
  });
  Keyboard.addListener('keyboardWillHide', () => {
    dlog(\`EVENT keyboardWillHide fired\`);
    clearKeyboardShowFallback();
    applyKeyboardHeight(0);
  });
  Keyboard.addListener('keyboardDidHide', () => {
    dlog(\`EVENT keyboardDidHide fired\`);
    if (isIOS) trackFullViewportHeight();
    snapshot('  after keyboardDidHide');
  });`;

appjs = appjs.replace(edit2Target, edit2Replacement);

// Edit 3
const edit3Target = `  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      dlog(\`EVENT visualViewport resize -> height=\${window.visualViewport.height} offsetTop=\${window.visualViewport.offsetTop} (window.innerHeight=\${window.innerHeight})\`);
      if (isIOS && currentKeyboardHeight > 0) {
        dlog(\`  re-applying applyKeyboardHeight(\${currentKeyboardHeight}) after live resize\`);
        applyKeyboardHeight(currentKeyboardHeight);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          scrollFocusedIntoView();
          snapshot('  after scrollFocusedIntoView (post-resize rAF x2)');
        }));
      }
    });
  }`;

const edit3Replacement = `  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      dlog(\`EVENT visualViewport resize -> height=\${window.visualViewport.height} offsetTop=\${window.visualViewport.offsetTop} (window.innerHeight=\${window.innerHeight})\`);
      if (isIOS && currentKeyboardHeight > 0) {
        clearKeyboardShowFallback();
        dlog(\`  re-applying applyKeyboardHeight(\${currentKeyboardHeight}) after live resize\`);
        applyKeyboardHeight(currentKeyboardHeight);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          scrollFocusedIntoView();
          snapshot('  after scrollFocusedIntoView (post-resize rAF x2)');
        }));
      }
    });
  }`;

appjs = appjs.replace(edit3Target, edit3Replacement);
fs.writeFileSync('app.js', appjs);
console.log('Patched app.js successfully.');

// Revert build to 94
let indexHtml = fs.readFileSync('index.html', 'utf8');
indexHtml = indexHtml.replace('Build 95', 'Build 94');
fs.writeFileSync('index.html', indexHtml);

let gradle = fs.readFileSync('android/app/build.gradle', 'utf8');
gradle = gradle.replace('versionCode 95', 'versionCode 94');
fs.writeFileSync('android/app/build.gradle', gradle);

let pbxproj = fs.readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8');
pbxproj = pbxproj.split('CURRENT_PROJECT_VERSION = 95;').join('CURRENT_PROJECT_VERSION = 94;');
fs.writeFileSync('ios/App/App.xcodeproj/project.pbxproj', pbxproj);
console.log('Reverted build from 95 to 94.');
