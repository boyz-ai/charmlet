// Real ads in the phone app: Google AdMob with the EU consent form (UMP) and Apple's tracking prompt (ATT).
import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob';
import { ADMOB } from '../config';
import type { AdService } from '../services/monetize';

export class AdMobAds implements AdService {
  private ready = { rewarded: false, interstitial: false };
  private canAds = false;
  private started: Promise<void> | null = null;
  /** Last reason an ad could not be shown (shown on screen while test ads are on, to diagnose). */
  lastError = '';

  /** Consent first (EU form if needed, then the iOS tracking prompt), then the SDK, then preload. */
  start(): Promise<void> {
    this.started ??= (async () => {
      // Each step may fail on its own (e.g. no EU message set up in AdMob yet); a failure must never stop the ads.
      let canAds = true;
      try {
        let info = await AdMob.requestConsentInfo();
        if (info.status === AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) info = await AdMob.showConsentForm();
        canAds = info.canRequestAds !== false;
      } catch (e) { this.note('consent', e); /* Google then serves limited, non-personalised ads */ }
      try {
        const att = await AdMob.trackingAuthorizationStatus();
        if (att.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      } catch { /* not iOS 14+ or prompt unavailable */ }
      try { await AdMob.initialize({ initializeForTesting: ADMOB.testing }); } catch (e) { this.note('init', e); }
      this.canAds = canAds;
      if (this.canAds) { void this.load('rewarded'); void this.load('interstitial'); }
    })();
    return this.started;
  }

  /** Whether the EU "privacy options" button must be offered in Settings. */
  async privacyOptionsRequired(): Promise<boolean> {
    try { return (await AdMob.requestConsentInfo()).privacyOptionsRequirementStatus === 'REQUIRED'; } catch { return false; }
  }
  async showPrivacyOptions(): Promise<void> { try { await AdMob.showPrivacyOptionsForm(); } catch { /* ignore */ } }

  private async load(kind: 'rewarded' | 'interstitial'): Promise<void> {
    if (!this.canAds || this.ready[kind]) return;
    this.lastTry[kind] = Date.now();
    try {
      if (kind === 'rewarded') await AdMob.prepareRewardVideoAd({ adId: ADMOB.rewarded, isTesting: ADMOB.testing });
      else await AdMob.prepareInterstitial({ adId: ADMOB.interstitial, isTesting: ADMOB.testing });
      this.ready[kind] = true;
    } catch (e) { this.ready[kind] = false; this.note('load ' + kind, e); }
  }

  private note(step: string, e: unknown): void {
    const m = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
    this.lastError = `${step}: ${m}`.slice(0, 140);
  }

  private lastTry = { rewarded: 0, interstitial: 0 };
  /** Loaded and showable now. If not, quietly try loading again (at most every 30 s) so the next offer has one. */
  rewardedReady(): boolean {
    if (!this.ready.rewarded && this.canAds && Date.now() - this.lastTry.rewarded > 30_000) void this.load('rewarded');
    return this.ready.rewarded;
  }

  async showRewarded(): Promise<boolean> {
    await this.start();
    if (!this.ready.rewarded) await this.load('rewarded');
    if (!this.ready.rewarded) { if (!this.canAds && !this.lastError) this.lastError = 'consent: ads not allowed'; return false; }
    this.ready.rewarded = false;
    try { return !!(await AdMob.showRewardVideoAd()); }
    catch (e) { this.note('show', e); return false; }
    finally { void this.load('rewarded'); }
  }

  async showInterstitial(): Promise<void> {
    await this.start();
    if (!this.ready.interstitial) { if (Date.now() - this.lastTry.interstitial > 30_000) void this.load('interstitial'); return; } // never wait for an ad between levels
    this.ready.interstitial = false;
    try { await AdMob.showInterstitial(); } catch { /* ignore */ } finally { void this.load('interstitial'); }
  }
}
