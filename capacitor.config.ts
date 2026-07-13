import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.deadsetfit.app",
  appName: "DEADSET",
  webDir: "dist/client",
  // App Store archives must run the bundled web build instead of depending on
  // the live website for core functionality.
  // server: {
  //   url: 'https://deadsetfit.org',
  //   cleartext: false
  // }
};

export default config;
