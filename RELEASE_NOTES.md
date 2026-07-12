# Release Notes: iSubnet v1.1.4 (Build 23)

### 📐 Landscape Orientation Support
* **Full landscape adaptation**: The app now correctly stretches and adapts when the phone is rotated to landscape orientation without breaking any feature.
* **Phone frame removed in landscape**: The decorative phone border, rounded corners, and shadows are hidden in landscape mode — the app fills the screen edge-to-edge for maximum usable space.
* **Status bar hidden in landscape**: The simulated status bar is hidden in landscape to preserve vertical space.
* **Compact header**: The app header collapses to a single tight row (subtitle hidden) in landscape.
* **Compact bottom nav**: The navigation bar shrinks to 52px with smaller icons and labels.
* **Content scrolls properly**: The content area fills all remaining vertical space and scrolls smoothly with native `-webkit-overflow-scrolling: touch`.
* **Tablet landscape**: Tablets in landscape also get a full-width borderless layout.
* **Safe area support**: Added `viewport-fit=cover` to properly handle iPhone notch and home indicator safe areas in landscape.

---

### 🧮 Bulk IPs — Calculation Improvements
* **IPv4 Bulk Tab**: Merged the Network and Range columns into a single "Network / Range" column (matching the IPv6 tab layout), showing `Network: x.x.x.x` and `Range: x.x.x.x - x.x.x.x` on separate lines.
* **Hosts / Addresses column**: Both IPv4 and IPv6 bulk result tabs now show usable hosts (palette color) and total addresses (contrast color) on separate lines for visual clarity.
* **IPv6 usable host fix**: Corrected the IPv6 usable host count from `total − 2` (incorrect IPv4 broadcast convention) to `total − 1` (correct: only the network/anycast address is reserved in IPv6 — there is no broadcast).
* **Start IP fix**: IPv6 bulk results now correctly show the first usable host (`network + 1`) as the Start address, not the network address itself.
* **Network address added**: IPv6 bulk results now display the network address above the Start/End range.
* **Mixed IPv4/IPv6 bulk**: Both tabs correctly handle mixed input (IPv4 subnets in the IPv6 tab and vice versa).

---

### 🔀 Splitter Tab — IPv6 Hosts
* **Equal split**: IPv6 equal-split subnets now display the correct host count (`usable / total`) instead of `N/A`.
* **VLSM split**: IPv6 VLSM subnets now show `usable / total (req. N)` with the corrected `total − 1` formula.

---

# Release Notes: iSubnet v1.1.3 (Build 22)

### 🚀 Mobile App Updates (`iSubnet-free`)
* **Dynamic Splash Screen Theme Loading**: Added integration with Capacitor Preferences. The app's startup splash screen now queries the last-used theme settings natively upon cold boot:
  * Users starting the app in Light theme will see a **white splash background**.
  * Users starting the app in Dark theme will see a **dark navy splash background**.
  * Resolves flash-on-startup design issues completely.
* **Smoother Splash Fade Transition**: Reconfigured the HTML5 splash screen removal sequence to perform an elegant **0.8-second opacity fade-out** rather than abruptly closing.
* **Splash Timing Tweaks**: Reduced the holding duration of the custom splash screen to exactly **1.4 seconds** before starting the fade-out.
* **Polished Tagline**: Replaced the generic *"Connecting Professionals"* tagline with a more targeted and professional phrase: **`The Pro Network Engineer's Toolset`**.
* **Vector Graphic Rendering**: Resolved distortion and pixelation errors by binding the splash screen logo to the original scalable vector SVG drawable asset (`@drawable/ic_logo_nodes_vector`) rather than using static PNG layouts.
