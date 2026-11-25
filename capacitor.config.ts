import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mucahitkurkaya.charmunlock',
  appName: 'Charm Unlock',
  webDir: 'dist',
  ios: { contentInset: 'never', backgroundColor: '#2a0d24' },
  plugins: {
    SplashScreen: { launchShowDuration: 900, backgroundColor: '#2a0d24', showSpinner: false, launchAutoHide: true },
    StatusBar: { overlaysWebView: true, style: 'DARK' },
  },
};

export default config;
