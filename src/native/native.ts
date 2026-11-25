// Everything that only exists inside the phone app (Capacitor). The web build never loads the plugins.
import { Capacitor } from '@capacitor/core';
import type { Haptics as HapticsPort } from '../feedback/feedback';

export const isNative = (): boolean => Capacitor.isNativePlatform();

const SAVE_KEYS = ['charm.save.v1', 'charm.packs.v1'];

/**
 * iOS may clear a web view's localStorage when the phone is low on space, so the app mirrors the save into
 * native Preferences (kept like normal app data) and restores it on start if localStorage came back empty.
 */
export async function restoreSave(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    for (const key of SAVE_KEYS) {
      if (localStorage.getItem(key)) continue;
      const { value } = await Preferences.get({ key });
      if (value) localStorage.setItem(key, value);
    }
  } catch { /* first launch or no plugin: nothing to restore */ }
}
/** Copy the current save to native Preferences (fire and forget). */
export function mirrorSave(): void {
  if (!isNative()) return;
  void import('@capacitor/preferences').then(({ Preferences }) => {
    for (const key of SAVE_KEYS) { const value = localStorage.getItem(key); if (value) void Preferences.set({ key, value }); }
  }).catch(() => {});
}

/** Real iPhone haptics (Taptic Engine). */
export async function nativeHaptics(): Promise<HapticsPort | null> {
  if (!isNative()) return null;
  const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
  const style = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy } as const;
  return {
    impact: s => void Haptics.impact({ style: style[s] }).catch(() => {}),
    notify: k => void Haptics.notification({ type: k === 'success' ? NotificationType.Success : NotificationType.Error }).catch(() => {}),
  };
}

/** Status bar over the game, splash hidden once the first frame is drawn. */
export async function nativeChrome(): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch { /* ignore */ }
  requestAnimationFrame(() => void import('@capacitor/splash-screen').then(m => m.SplashScreen.hide()).catch(() => {}));
}
