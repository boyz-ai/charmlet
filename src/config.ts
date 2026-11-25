// Store / ad settings. Edit with `node tools/set-admob.cjs …` (also updates ios/App/App/Info.plist).
export const ADMOB = {
  /** true = test ads (keep true for TestFlight; switch to false only for the App Store release build). Never click real ads of your own game. */
  testing: true,
  rewarded: 'ca-app-pub-8149158472131789/9011561447',
  interstitial: 'ca-app-pub-8149158472131789/9163478370',
};

// Analytics (PostHog). Empty key = analytics off. The project key is public by design (it can only send events).
export const ANALYTICS = {
  key: '',
  host: 'https://eu.i.posthog.com', // EU servers
};
