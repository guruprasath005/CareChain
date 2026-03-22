/**
 * Environment configuration for the CareChain app
 *
 * Aligned with the working project layout (Documents/Care-Chain): simple Metro host
 * detection + optional EXPO_PUBLIC_API_URL. Ensures `/api/v1` suffix when missing.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

const PRODUCTION_API_BASE_URL = 'https://care-chain-backend.onrender.com';
export const API_V1_PREFIX = '/api/v1';

/** Expo Go cannot load http:// LAN URLs on iOS (ATS / cleartext). */
function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

function withApiV1Suffix(base: string): string {
  const normalized = base.replace(/\/+$/, '');
  return normalized.endsWith(API_V1_PREFIX) ? normalized : `${normalized}${API_V1_PREFIX}`;
}

const getApiUrl = (): string => {
  console.log('=== ENV CONFIGURATION START ===');
  console.log('[ENV] __DEV__:', __DEV__);
  console.log('[ENV] Platform.OS:', Platform.OS);
  console.log('[ENV] process.env.EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);

  const envOverride = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envOverride) {
    const url = withApiV1Suffix(envOverride);
    console.log('[ENV] Using EXPO_PUBLIC_API_URL →', url);
    console.log('=== ENV CONFIGURATION END ===');
    return url;
  }

  if (__DEV__) {
    const anyConstants = Constants as Record<string, unknown>;

    const hostUri: string | undefined =
      Constants.expoConfig?.hostUri ??
      (anyConstants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost ??
      (Constants.manifest as { debuggerHost?: string } | undefined)?.debuggerHost ??
      (
        anyConstants.manifest2 as
          | { extra?: { expoGo?: { debuggerHost?: string } } }
          | undefined
      )?.extra?.expoGo?.debuggerHost;

    const manifest = Constants.manifest ?? Constants.manifest2;
    const packagerHost =
      (manifest as { packagerOpts?: { hostType?: string }; hostUri?: string } | null)
        ?.packagerOpts?.hostType === 'lan'
        ? (manifest as { hostUri?: string }).hostUri
        : undefined;

    let scriptHost: string | undefined;
    try {
      const scriptURL = (global as unknown as { nativeModules?: { SourceCode?: { scriptURL?: string } } })
        .nativeModules?.SourceCode?.scriptURL;
      if (scriptURL && typeof scriptURL === 'string') {
        const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
        if (match) scriptHost = match[1];
      }
    } catch {
      /* ignore */
    }

    const detectedHost = hostUri || packagerHost || scriptHost;

    console.log('[ENV] hostUri:', hostUri);
    console.log('[ENV] packagerHost:', packagerHost);
    console.log('[ENV] scriptHost:', scriptHost);

    if (detectedHost) {
      if (Platform.OS === 'android' && detectedHost.includes('10.0.2.')) {
        const url = `http://10.0.2.2:5001${API_V1_PREFIX}`;
        console.log('[ENV] Android emulator →', url);
        console.log('=== ENV CONFIGURATION END ===');
        return url;
      }

      const hostIp = detectedHost.split(':')[0];
      if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
        const lanUrl = `http://${hostIp}:5001${API_V1_PREFIX}`;
        const allowLanOnIosExpoGo =
          process.env.EXPO_PUBLIC_ALLOW_LAN_HTTP === 'true' ||
          process.env.EXPO_PUBLIC_ALLOW_LAN_HTTP === '1';

        // iOS + Expo Go: fetch to http://192.168.x.x fails with "Network request failed"
        if (
          Platform.OS === 'ios' &&
          isExpoGo() &&
          !allowLanOnIosExpoGo
        ) {
          const prod = `${PRODUCTION_API_BASE_URL}${API_V1_PREFIX}`;
          console.warn(
            '[ENV] Expo Go on iOS blocks http:// LAN. Using hosted API. ' +
              'For a local backend use HTTPS (ngrok), set EXPO_PUBLIC_API_URL, or `expo run:ios`. →',
            prod
          );
          console.log('=== ENV CONFIGURATION END ===');
          return prod;
        }

        console.log('[ENV] LAN dev API →', lanUrl);
        console.log('=== ENV CONFIGURATION END ===');
        return lanUrl;
      }

      if (hostIp === 'localhost' || hostIp === '127.0.0.1') {
        const url = `http://localhost:5001${API_V1_PREFIX}`;
        console.log('[ENV] localhost →', url);
        console.log('=== ENV CONFIGURATION END ===');
        return url;
      }
    }

    const devFallbackUrl =
      Platform.OS === 'android'
        ? `http://10.0.2.2:5001${API_V1_PREFIX}`
        : `http://localhost:5001${API_V1_PREFIX}`;
    console.log('[ENV] Dev fallback →', devFallbackUrl);
    console.log('=== ENV CONFIGURATION END ===');
    return devFallbackUrl;
  }

  const prod = `${PRODUCTION_API_BASE_URL}${API_V1_PREFIX}`;
  console.log('[ENV] Production →', prod);
  console.log('=== ENV CONFIGURATION END ===');
  return prod;
};

export const ENV = {
  API_URL: getApiUrl(),

  ACCESS_TOKEN_EXPIRY: 15 * 60,
  REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60,

  ENABLE_BIOMETRIC_AUTH: false,
  ENABLE_PUSH_NOTIFICATIONS: false,

  APP_NAME: 'CareChain',
  APP_VERSION: '1.0.0',
} as const;

export default ENV;
