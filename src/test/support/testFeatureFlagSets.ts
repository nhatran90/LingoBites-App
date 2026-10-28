import type {FeatureKey} from '@core/release/feature-registry';

/** Paste / OCR pipeline plus short practice. */
export const MT_CORE_INGESTION: Partial<Record<FeatureKey, boolean>> = {
  pasteTextInput: true,
  imageInput: true,
  ocrScanner: true,
  ocrReviewEdit: true,
  shortPractice: true,
};

/** Full theme stack used when UI tests need every shipped theme variant. */
export const FULL_THEME_STACK: Partial<Record<FeatureKey, boolean>> = {
  themeSystem: true,
  themeSwitcher: true,
  darkTheme: true,
  pastelKidsTheme: true,
  coreTheme: true,
  neoTheme: true,
  comicTheme: true,
  cartoonTheme: true,
  stickerSoftTheme: true,
};

/** Core ingestion + themes; review and expansion flags off (legacy closed-beta shape). */
export const CORE_BETA_WITHOUT_REVIEW: Partial<Record<FeatureKey, boolean>> = {
  ...MT_CORE_INGESTION,
  ...FULL_THEME_STACK,
  darkTheme: false,
  reviewSystem: false,
  youtubeLearning: false,
};

/** Core ingestion, full themes, and spaced-repetition review enabled. */
export const CORE_WITH_REVIEW: Partial<Record<FeatureKey, boolean>> = {
  ...MT_CORE_INGESTION,
  ...FULL_THEME_STACK,
  reviewSystem: true,
  youtubeLearning: false,
};

/** Offline review MVP: review only, no ingestion inputs. */
export const OFFLINE_REVIEW_MVP: Partial<Record<FeatureKey, boolean>> = {
  pasteTextInput: false,
  imageInput: false,
  ocrScanner: false,
  ocrReviewEdit: false,
  shortPractice: false,
  themeSystem: true,
  themeSwitcher: false,
  darkTheme: false,
  pastelKidsTheme: false,
  coreTheme: true,
  neoTheme: false,
  comicTheme: false,
  cartoonTheme: false,
  stickerSoftTheme: true,
  reviewSystem: true,
  youtubeLearning: false,
};

/** Core ingestion + themes for theme/UI tests (review off, dark theme on). */
export const THEME_UI_FLAGS: Partial<Record<FeatureKey, boolean>> = {
  ...CORE_BETA_WITHOUT_REVIEW,
  darkTheme: true,
};

/** Dev showcase: core + themes + review; expansion betas stay off. */
export const FULL_FEATURE_SHOWCASE_FLAGS: Partial<Record<FeatureKey, boolean>> =
  {
    ...MT_CORE_INGESTION,
    ...FULL_THEME_STACK,
    reviewSystem: true,
    youtubeLearning: false,
  };

/** Every implemented feature flag on (matches dev/production presets). */
export const ALL_IMPLEMENTED_FEATURES: Partial<Record<FeatureKey, boolean>> = {
  ...MT_CORE_INGESTION,
  ...FULL_THEME_STACK,
  reviewSystem: true,
  situationLearning: true,
  youtubeLearning: true,
};
