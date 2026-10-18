import {jest} from '@jest/globals';
import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import vi from './src/core/i18n/vi.json';
import en from './src/core/i18n/en.json';

// Initialise a real i18next instance so that useTranslation() in components
// resolves to the actual Vietnamese strings that existing tests assert on.
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      vi: {translation: vi},
      en: {translation: en},
    },
    lng: 'vi',
    fallbackLng: 'en',
    interpolation: {escapeValue: false},
    compatibilityJSON: 'v4',
  });
}

// Polyfill for global.fetch if not present (e.g., in some Jest environments)
if (typeof global !== 'undefined' && !global.fetch) {
  global.fetch = jest.fn();
}

// Mock the global.crypto for tests that might use it
if (typeof global !== 'undefined' && !global.crypto) {
  global.crypto = {
    randomUUID: () => 'mock-uuid',
  };
}

// React 19 reportGlobalError relies on window.dispatchEvent when window is present
if (
  typeof window !== 'undefined' &&
  typeof window.dispatchEvent !== 'function'
) {
  // No listener cancels the event; let React report errors to console.error.
  window.dispatchEvent = () => true;
}

jest.mock('react-native-youtube-iframe', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {
    __esModule: true,
    default: React.forwardRef(() => <View testID="mock-youtube-iframe" />),
    PLAYER_ERRORS: {},
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-device-info', () =>
  require('react-native-device-info/jest/react-native-device-info-mock'),
);

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: {
    getString: jest.fn().mockResolvedValue(''),
    setString: jest.fn(),
  },
}));

jest.mock('react-native-keychain', () => ({
  STORAGE_TYPE: {AES_GCM_NO_AUTH: 'KeystoreAESGCM_NoAuth'},
  setGenericPassword: jest.fn().mockResolvedValue({service: 'mock'}),
  getGenericPassword: jest.fn().mockResolvedValue(false),
  resetGenericPassword: jest.fn().mockResolvedValue(true),
  getAllGenericPasswordServices: jest.fn().mockResolvedValue([]),
}));

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    APP_ENV: 'local',
    API_BASE_URL: 'http://localhost:3000',
    AI_SCHEMA_VERSION: 'ai-output-v1',
    SUPPORT_EMAIL: 'support@lingobites.app',
    IOS_APP_VERSION_NAME: '1.0.1',
    ANDROID_APP_VERSION_NAME: '1.0.1',
  },
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('@op-engineering/op-sqlite', () =>
  require('./test-utils/opSqliteMock'),
);

// Native device-integration modules (SETE-90). Each adapter injects its own
// fake in its unit tests; these global mocks only keep imports safe under Jest
// (the real modules touch native bindings that do not exist in the JS runtime).
jest.mock('@notifee/react-native', () => {
  const AuthorizationStatus = {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  };
  return {
    __esModule: true,
    default: {
      getNotificationSettings: jest.fn(),
      requestPermission: jest.fn(),
      createChannel: jest.fn(),
      getTriggerNotifications: jest.fn(),
      createTriggerNotification: jest.fn(),
      cancelTriggerNotification: jest.fn(),
    },
    AuthorizationStatus,
    AndroidImportance: {DEFAULT: 3, HIGH: 4},
    TriggerType: {TIMESTAMP: 0},
    RepeatFrequency: {NONE: -1, HOURLY: 0, DAILY: 1, WEEKLY: 2},
  };
});

jest.mock('react-native-permissions', () => ({
  check: jest.fn().mockResolvedValue('granted'),
  request: jest.fn().mockResolvedValue('granted'),
  PERMISSIONS: {
    IOS: {MICROPHONE: 'ios.permission.MICROPHONE'},
    ANDROID: {RECORD_AUDIO: 'android.permission.RECORD_AUDIO'},
  },
  RESULTS: {UNAVAILABLE: 'unavailable', GRANTED: 'granted', DENIED: 'denied'},
}));

jest.mock('@dr.pogodin/react-native-fs', () => ({
  __esModule: true,
  DocumentDirectoryPath: '/mock/Documents',
  exists: jest.fn(),
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
  readDir: jest.fn().mockResolvedValue([]),
}));

jest.mock('react-native-sound', () => {
  class MockSound {
    static setActive() {}
    static setCategory() {}
    constructor(filename, _basePath, cb) {
      this.filename = filename;
      this.cb = cb;
    }
    play() {
      return this;
    }
    stop() {
      return this;
    }
    release() {
      return this;
    }
  }
  return MockSound;
});

jest.mock('react-native-nitro-sound', () => {
  const createSound = () => ({
    startRecorder: jest.fn(async uri => uri ?? '/mock/recording.m4a'),
    stopRecorder: jest.fn(async () => '/mock/recording.m4a'),
    startPlayer: jest.fn(async () => '/mock/recording.m4a'),
    stopPlayer: jest.fn(async () => '/mock/recording.m4a'),
    addRecordBackListener: jest.fn(),
    removeRecordBackListener: jest.fn(),
    addPlayBackListener: jest.fn(),
    removePlayBackListener: jest.fn(),
  });
  return {
    __esModule: true,
    createSound,
    AudioEncoderAndroidType: {AAC: 3},
    OutputFormatAndroidType: {MPEG_4: 2},
  };
});

jest.mock('@react-native-vector-icons/common', () => ({
  createIconSet: () => 'MaterialIcons',
}));

// `react-native-tts` ships untranspiled ESM. The audio feature barrel
// (`@features/audio`) re-exports `TtsSpikeScreen`, which imports it eagerly,
// so any module that touches the barrel needs the native adapter stubbed out
// under Jest. Adapters that exercise TTS behaviour inject their own fake.
jest.mock('react-native-tts', () => ({
  __esModule: true,
  default: {
    getInitStatus: jest.fn().mockResolvedValue('success'),
    voices: jest.fn().mockResolvedValue([]),
    setIgnoreSilentSwitch: jest.fn(),
    setDefaultLanguage: jest.fn(),
    setDefaultRate: jest.fn(),
    speak: jest.fn(),
    stop: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
}));

// Reanimated runs animations on the UI thread, which does not exist under
// Jest. The official `react-native-reanimated/mock` points at the library's
// untranspiled TS sources, so this repo uses a small synchronous mock with
// the same semantics (see test-utils/reanimatedMock.js).
jest.mock('react-native-reanimated', () =>
  require('./test-utils/reanimatedMock'),
);

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: callback => {
      React.useEffect(() => callback(), [callback]);
    },
    useNavigation: () => ({
      goBack: jest.fn(),
      navigate: jest.fn(),
    }),
  };
});

// App navigation intents (@core/navigation): outside an
// <AppNavigationProvider>, `useAppNavigation()` returns the shared
// `mockAppNavigation` double so screens render in isolation and tests can
// assert on intents (src/test/support/appNavigationMock.ts).
jest.mock('@core/navigation', () => {
  const actual = jest.requireActual('@core/navigation');
  const {mockAppNavigation} = require('./src/test/support/appNavigationMock');
  return {
    ...actual,
    useAppNavigation: () =>
      actual.useOptionalAppNavigation() ?? mockAppNavigation,
  };
});

// react-native-svg: render SVG elements as plain RN Views/Text in Jest so
// that component trees render without the native SVG module (AD-001, RISK-002).
jest.mock('react-native-svg', () => {
  const React = require('react');
  const {View, Text} = require('react-native');
  const stub = props => React.createElement(View, props);
  const TextStub = props => React.createElement(Text, props);
  return {
    __esModule: true,
    default: stub,
    Svg: stub,
    Circle: stub,
    Ellipse: stub,
    G: stub,
    Text: TextStub,
    TSpan: TextStub,
    TextPath: stub,
    Path: stub,
    Polygon: stub,
    Polyline: stub,
    Line: stub,
    Rect: stub,
    Use: stub,
    Image: stub,
    Symbol: stub,
    Defs: stub,
    LinearGradient: stub,
    RadialGradient: stub,
    Stop: stub,
    ClipPath: stub,
    Pattern: stub,
    Mask: stub,
  };
});

// expo-updates is native-only; disabled by default so the launch update is a
// no-op in tests. Tests that exercise it override these per case.
jest.mock('expo-blur', () => {
  const {View} = require('react-native');
  return {BlurTargetView: View, BlurView: View};
});

jest.mock('expo-updates', () => ({
  isEnabled: false,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
  useUpdates: jest.fn(() => ({downloadProgress: undefined})),
}));
