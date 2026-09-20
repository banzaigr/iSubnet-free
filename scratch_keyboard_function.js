function setupKeyboardAvoidance() {
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
      content.style.paddingBottom = `${baseContentPaddingBottom + neededOffset}px`;
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
    const tabBarTop = tabBar.getBoundingClientRect().top;
    const margin = 12;
    const rect = active.getBoundingClientRect();
    dlog(`scrollFocusedIntoView() active=${active.tagName}#${active.id} rect.top=${rect.top} rect.bottom=${rect.bottom} tabBarTop=${tabBarTop} content.scrollTop(before)=${content.scrollTop}`);
    if (rect.bottom > tabBarTop - margin) {
      const delta = rect.bottom - (tabBarTop - margin);
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

  Keyboard.addListener('keyboardWillShow', (info) => {
    dlog(`EVENT keyboardWillShow fired, info=${JSON.stringify(info)}`);
    applyKeyboardHeight((info && info.keyboardHeight) || 0);
  });
  Keyboard.addListener('keyboardDidShow', (info) => {
    dlog(`EVENT keyboardDidShow fired, info=${JSON.stringify(info)}`);
    applyKeyboardHeight((info && info.keyboardHeight) || 0);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrollFocusedIntoView();
      snapshot('  after scrollFocusedIntoView rAF x2');
    }));
  });
  Keyboard.addListener('keyboardWillHide', () => {
    dlog(`EVENT keyboardWillHide fired`);
    applyKeyboardHeight(0);
  });
  Keyboard.addListener('keyboardDidHide', () => {
    dlog(`EVENT keyboardDidHide fired`);
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
        dlog(`  re-applying applyKeyboardHeight(${currentKeyboardHeight}) after live resize`);
        applyKeyboardHeight(currentKeyboardHeight);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          scrollFocusedIntoView();
          snapshot('  after scrollFocusedIntoView (post-resize rAF x2)');
        }));
      }
    });
  }
}
