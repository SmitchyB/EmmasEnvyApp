/**
 * Expo config. For testing on a physical device (Expo Go on Android/iPad),
 * set EXPO_PUBLIC_API_URL to your computer's LAN IP so the device can reach the backend.
 * Example: EXPO_PUBLIC_API_URL=http://192.168.1.5:3002
 */
const base = require('./app.json');

module.exports = {
  ...base,
  expo: {
    ...base.expo,
    plugins: [...(base.expo.plugins ?? [])],
    extra: {
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL ?? null,
      /** Public Square application id (sandbox or prod) — Web Payments SDK in the POS card modal. */
      EXPO_PUBLIC_SQUARE_APPLICATION_ID: process.env.EXPO_PUBLIC_SQUARE_APPLICATION_ID ?? null,
      /** Same location as backend SQUARE_LOCATION_ID — required by Web Payments SDK. */
      EXPO_PUBLIC_SQUARE_LOCATION_ID: process.env.EXPO_PUBLIC_SQUARE_LOCATION_ID ?? null,
    },
  },
};
