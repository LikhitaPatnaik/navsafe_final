import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.navsafe.app',
  appName: 'NavSafe',
  webDir: 'dist',
  server: {
    // REPLACE THIS URL WITH YOUR ACTUAL VERCEL URL
    url: 'https://navsafe-final-ynff.vercel.app', 
    cleartext: true
  }
};

export default config;
