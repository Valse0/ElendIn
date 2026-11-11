import type { CapacitorConfig } from '@capacitor/cli';

// Android wrapper configuration. The web app is built to ./dist by Vite and
// copied into the native project by `cap sync`. No remote `server.url` is set:
// the APK ships the app locally so analysis works fully offline.
const config: CapacitorConfig = {
  appId: 'app.elendin.cv',
  appName: 'ElendIn',
  webDir: 'dist',
  backgroundColor: '#21232E',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
