import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.buscoequipo.app',
  appName: 'BuscoEquipo',
  webDir: 'client/dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0f14',
      showSpinner: false,
    },
    StatusBar: {
      backgroundColor: '#0a0f14',
      style: 'DARK',
    },
  },
};

export default config;
