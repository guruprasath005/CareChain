// Mock the problematic polyfills before React Native loads them
jest.mock('@react-native/js-polyfills/error-guard', () => ({
  setGlobalHandler: jest.fn(),
  getGlobalHandler: jest.fn(() => null),
  __esModule: true,
  default: {},
}), { virtual: true });

// Mock the entire polyfills package
jest.mock('@react-native/js-polyfills', () => ({}), { virtual: true });
