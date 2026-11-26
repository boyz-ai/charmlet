// Store / ad settings. Edit with `node tools/set-admob.cjs …` (also updates ios/App/App/Info.plist).
export const ADMOB = {
  /** false = real ads (App Store release). Set true again only to debug ads. Never tap real ads of your own game: AdMob closes accounts for that. */
  testing: false,
  rewarded: 'ca-app-pub-8149158472131789/9011561447',
  interstitial: 'ca-app-pub-8149158472131789/9163478370',
};

// Analytics (PostHog). Empty key = analytics off. The project key is public by design (it can only send events).
export const ANALYTICS = {
  key: '',
  host: 'https://eu.i.posthog.com', // EU servers
};
