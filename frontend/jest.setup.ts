// The API client reads this at module load and refuses to run without it, so
// it has to be set before any test file imports lib/api/client.
process.env.EXPO_PUBLIC_API_URL = 'http://api.test';

// lib/firebase.ts reads these at module load. The values are fakes; the SDK
// itself is mocked below and never talks to Firebase.
process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
process.env.EXPO_PUBLIC_FIREBASE_APP_ID = '1:test:web:test';

/**
 * Stubs for the native modules that cannot run under Node.
 *
 * Each one is mocked because it reaches for a device API, not because the code
 * under test is awkward — so the mocks stay dumb on purpose. Anything with real
 * behaviour worth asserting (the token store's platform branching, the API
 * client's error mapping) is tested against these stubs rather than replaced.
 */

// The Firebase SDK reaches for the network and browser storage under Node, so
// auth is a tiny in-memory stand-in. Tests mutate `__auth.currentUser` (or
// call `__emitTokenChanged`) and configure `signInWithEmailAndPassword` per
// case; everything with behaviour worth asserting runs against this stub.
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
}));

// Typed only with keyword types and allowlisted globals: jest's out-of-scope
// guard for mock factories flags any other identifier, even in type positions.
jest.mock('firebase/auth', () => {
  const auth: { currentUser: unknown } = { currentUser: null };
  const listeners = new Set<Function>();
  return {
    getAuth: jest.fn(() => auth),
    onIdTokenChanged: jest.fn((_auth: unknown, cb: Function) => {
      listeners.add(cb);
      cb(auth.currentUser);
      return () => listeners.delete(cb);
    }),
    signInWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(async () => {
      auth.currentUser = null;
      listeners.forEach((cb) => cb(null));
    }),
    __auth: auth,
    __emitTokenChanged: (user: unknown) => {
      auth.currentUser = user;
      listeners.forEach((cb) => cb(user));
    },
  };
});

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

// CameraView renders as an identifiable host element so tests can assert on
// whether the camera is mounted — which is the whole point of the focus gating.
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    CameraView: (props: Record<string, unknown>) =>
      React.createElement(View, { testID: 'camera-view', ...props }),
    useCameraPermissions: jest.fn(() => [{ granted: true }, jest.fn()]),
  };
});

// Screens are rendered directly in tests, with no navigator above them.
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  useFocusEffect: jest.fn(),
  Link: 'Link',
  Stack: { Screen: 'Stack.Screen' },
  Tabs: { Screen: 'Tabs.Screen' },
}));

// Focus defaults to true; tests that care override it per case.
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: jest.fn(() => true),
}));

// Safe-area insets come from the OS, so there is nothing real to read under
// Node. Zeroed insets are the mock this library documents for tests.
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    ...jest.requireActual('react-native-safe-area-context'),
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

// react-native-qrcode-svg pulls in native SVG internals.
jest.mock('react-native-qrcode-svg', () => 'QRCode');
