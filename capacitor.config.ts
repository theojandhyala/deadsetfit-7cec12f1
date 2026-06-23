import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.deadsetfit.app',
  appName: 'DEADSET',
  webDir: 'dist/client',
  server: {
    url: 'https://deadsetfit.org',
    cleartext: false
  }
};

export default config;
