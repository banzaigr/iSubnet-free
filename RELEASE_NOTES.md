# Release Notes: iSubnet v1.1.2 (Build 21)

### 🚀 Mobile App Updates (`iSubnet-free`)
* **Dynamic Splash Screen Theme Loading**: Added integration with Capacitor Preferences. The app's startup splash screen now queries the last-used theme settings natively upon cold boot:
  * Users starting the app in Light theme will see a **white splash background**.
  * Users starting the app in Dark theme will see a **dark navy splash background**.
  * Resolves flash-on-startup design issues completely.
* **Smoother Splash Fade Transition**: Reconfigured the HTML5 splash screen removal sequence to perform an elegant **0.8-second opacity fade-out** rather than abruptly closing.
* **Splash Timing Tweaks**: Reduced the holding duration of the custom splash screen to exactly **1.4 seconds** before starting the fade-out.
* **Polished Tagline**: Replaced the generic *"Connecting Professionals"* tagline with a more targeted and professional phrase: **`The Pro Network Engineer's Toolset`**.
* **Vector Graphic Rendering**: Resolved distortion and pixelation errors by binding the splash screen logo to the original scalable vector SVG drawable asset (`@drawable/ic_logo_nodes_vector`) rather than using static PNG layouts.
