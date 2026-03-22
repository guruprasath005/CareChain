module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.polyfill-mock.js', '<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|expo|@expo|expo-linear-gradient|@react-navigation|@testing-library|react-test-renderer)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/care-chain-app/$1',
    '^@/constants/Colors$': '<rootDir>/care-chain-app/constants/Colors',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  testMatch: [
    '**/care-chain-app/**/__tests__/**/*.test.[jt]s?(x)',
    '**/care-chain-app/**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  collectCoverageFrom: [
    'care-chain-app/**/*.{js,jsx,ts,tsx}',
    '!care-chain-app/**/*.d.ts',
    '!care-chain-app/node_modules/**',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
