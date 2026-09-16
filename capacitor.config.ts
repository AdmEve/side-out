import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'gg.sideout.pong',
  appName: 'SIDE OUT',
  webDir: 'dist',
  android: {
    // The game draws its own dark background; letting the WebView paint white
    // between frames causes a visible flash on launch and on resume.
    backgroundColor: '#05060f',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
