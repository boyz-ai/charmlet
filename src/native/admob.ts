// Real ads in the phone app: Google AdMob with the EU consent form (UMP) and Apple's tracking prompt (ATT).
import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob';
import { ADMOB } from '../config';
import type { AdService } from '../services/monetize';

export class AdMobAds implements AdService {
  private ready = { rewarded: false, interstitial: false };
  private canAds = false;
  private started: Promise<void> | null = null;

  /** Consent first (EU form if needed, then the iOS tracking prompt), then the SDK, then preload. */
  start(): Promise<void> {
    this.started ??= (async () => {
      try {
        let info = await AdMob.requestConsentInfo();
        if (info.status === AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) info = await AdMob.showConsentForm();
        this.canAds = info.canRequestAds;
        const att = await AdMob.trackingAuthorizationStatus();
        if (att.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
        await AdMob.initialize({ initializeForTesting: ADMOB.testing });
        if (this.canAds) { void this.load('rewarded'); void this.load('interstitial'); }
      } catch { this.canAds = false; }
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
    try {
      if (kind === 'rewarded') await AdMob.prepareRewardVideoAd({ adId: ADMOB.rewarded, isTesting: ADMOB.testing });
      else await AdMob.prepareInterstitial({ adId: ADMOB.interstitial, isTesting: ADMOB.testing });
      this.ready[kind] = true;
    } catch { this.ready[kind] = false; }
  }

  async showRewarded(): Promise<boolean> {
    await this.start();
    if (!this.ready.rewarded) await this.load('rewarded');
    if (!this.ready.rewarded) return false;
    this.ready.rewarded = false;
    try { return !!(await AdMob.showRewardVideoAd()); }
    catch { return false; }
    finally { void this.load('rewarded'); }
  }

  async showInterstitial(): Promise<void> {
    await this.start();
    if (!this.ready.interstitial) return; // never wait for an ad between levels
    this.ready.interstitial = false;
    try { await AdMob.showInterstitial(); } catch { /* ignore */ } finally { void this.load('interstitial'); }
  }
}
