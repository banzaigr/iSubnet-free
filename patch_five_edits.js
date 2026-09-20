const fs = require('fs');

let appjs = fs.readFileSync('app.js', 'utf8');

// Edit 1
const e1Find = `    } else {
      dlog(\`  input already clear of tab bar, no scroll needed\`);
    }
  };

  Keyboard.addListener('keyboardWillShow', (info) => {`;
const e1Rep = `    } else {
      dlog(\`  input already clear of tab bar, no scroll needed\`);
    }
  };

  // Fields with different \`inputmode\` values (e.g. numeric vs. default/full-QWERTY)
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
      dlog(\`scrollFocusedIntoViewWhenSettled() offsetTop=\${window.visualViewport.offsetTop} not settled, retriesLeft=\${retriesLeft} -> deferring one more rAF\`);
      requestAnimationFrame(() => scrollFocusedIntoViewWhenSettled(retriesLeft - 1));
      return;
    }
    if (isIOS && window.visualViewport && window.visualViewport.offsetTop !== 0) {
      dlog(\`scrollFocusedIntoViewWhenSettled() gave up waiting for offsetTop to settle (still \${window.visualViewport.offsetTop}) - running scrollFocusedIntoView() anyway\`);
    }
    scrollFocusedIntoView();
  };

  Keyboard.addListener('keyboardWillShow', (info) => {`;

// Edit 2
const e2Find = `      requestAnimationFrame(() => requestAnimationFrame(() => {
        scrollFocusedIntoView();
        snapshot('  after scrollFocusedIntoView (fallback rAF x2)');
      }));
    }, KEYBOARD_SHOW_FALLBACK_MS);`;
const e2Rep = `      requestAnimationFrame(() => requestAnimationFrame(() => {
        scrollFocusedIntoViewWhenSettled();
        snapshot('  after scrollFocusedIntoViewWhenSettled (fallback rAF x2)');
      }));
    }, KEYBOARD_SHOW_FALLBACK_MS);`;

// Edit 3
const e3Find = `        requestAnimationFrame(() => requestAnimationFrame(() => {
          scrollFocusedIntoView();
          snapshot('  after scrollFocusedIntoView (post-resize rAF x2)');
        }));
      }
    });
  }
}`;
const e3Rep = `        requestAnimationFrame(() => requestAnimationFrame(() => {
          scrollFocusedIntoViewWhenSettled();
          snapshot('  after scrollFocusedIntoViewWhenSettled (post-resize rAF x2)');
        }));
      }
    });
  }
}`;

// Edit 4
const e4Find = `  const btnShareBase = document.getElementById('btn-share-base');
  if (btnShareBase) {
    btnShareBase.addEventListener('click', () => {
      const bin = document.getElementById('base-bin-input').value.trim();
      const dec = document.getElementById('base-dec-input').value.trim();
      const oct = document.getElementById('base-oct-input').value.trim();
      const hex = document.getElementById('base-hex-input').value.trim();
      if (!dec && !bin) return;
      const text = \`iSubnet – Number Base Converter\\nBIN: \${bin}\\nOCT: \${oct}\\nDEC: \${dec}\\nHEX: \${hex}\`;
      if (navigator.share) {
        navigator.share({ title: 'iSubnet Base Conversion', text });
      } else {
        navigator.clipboard.writeText(text).then(() => flashConfirm(btnShareBase, btnShareBase.innerHTML));
      }
    });
  }`;
const e4Rep = `  const btnShareBase = document.getElementById('btn-share-base');
  if (btnShareBase) {
    btnShareBase.addEventListener('click', () => {
      const bin = document.getElementById('base-bin-input').value.trim();
      const dec = document.getElementById('base-dec-input').value.trim();
      const oct = document.getElementById('base-oct-input').value.trim();
      const hex = document.getElementById('base-hex-input').value.trim();
      if (!dec && !bin) return;
      const text = \`iSubnet – Number Base Converter\\nBIN: \${bin}\\nOCT: \${oct}\\nDEC: \${dec}\\nHEX: \${hex}\`;
      shareText('iSubnet Base Conversion', text);
    });
  }`;

// Edit 5
const e5Find = `async function shareText(title, text) {
  if (!PRO_UNLOCKED) {
    text = text + "\\n\\n— Calculated with iSubnet · isubnet.net";
  }

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

  if (navigator.share) {`;
const e5Rep = `async function shareText(title, text) {
  if (!PRO_UNLOCKED) {
    text = text + "\\n\\n— Calculated with iSubnet · isubnet.net";
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

  if (navigator.share) {`;

appjs = appjs.split('\\r\\n').join('\\n'); // Normalize for reliable matching on Windows

if (appjs.includes(e1Find)) { appjs = appjs.replace(e1Find, e1Rep); console.log("Applied Edit 1"); } else console.log("Failed Edit 1");
if (appjs.includes(e2Find)) { appjs = appjs.replace(e2Find, e2Rep); console.log("Applied Edit 2"); } else console.log("Failed Edit 2");
if (appjs.includes(e3Find)) { appjs = appjs.replace(e3Find, e3Rep); console.log("Applied Edit 3"); } else console.log("Failed Edit 3");
if (appjs.includes(e4Find)) { appjs = appjs.replace(e4Find, e4Rep); console.log("Applied Edit 4"); } else console.log("Failed Edit 4");
if (appjs.includes(e5Find)) { appjs = appjs.replace(e5Find, e5Rep); console.log("Applied Edit 5"); } else console.log("Failed Edit 5");

fs.writeFileSync('app.js', appjs);
