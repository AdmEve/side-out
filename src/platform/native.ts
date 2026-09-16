import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * The thin layer between the game and the Android shell.
 *
 * Everything here degrades to a no-op in a browser, so the same bundle ships to
 * the web and into the APK — there is no "native build" of the game logic.
 */

export const isNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

type BackHandler = () => 'handled' | 'exit';

let backHandler: BackHandler | null = null;

/**
 * Android's back button. A game that silently quits on back is the single most
 * common complaint about web-wrapped games, so the active scene decides: pause,
 * step back to the menu, or genuinely leave.
 */
export function setBackHandler(handler: BackHandler | null): void {
  backHandler = handler;
}

export function initNative(): void {
  if (!isNative()) return;

  void App.addListener('backButton', () => {
    const result = backHandler ? backHandler() : 'exit';
    if (result === 'exit') void App.exitApp();
  });

  // Losing focus mid-rally shouldn't cost you the match: the game pauses itself
  // when Android backgrounds the WebView.
  void App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) window.dispatchEvent(new CustomEvent('sideout:background'));
  });
}

/** Short haptic tick. Silently absent on iOS Safari and most desktops. */
export function buzz(ms: number | number[]): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* vibration is a nicety, never a requirement */
  }
}

/** Keep the screen awake in a browser; the Android shell does this natively. */
export async function keepAwake(): Promise<void> {
  if (isNative()) return;
  try {
    await (navigator as Navigator & { wakeLock?: { request(t: string): Promise<unknown> } })
      .wakeLock?.request('screen');
  } catch {
    /* not supported, or the tab isn't visible — harmless either way */
  }
}
