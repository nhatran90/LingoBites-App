import type {ReleaseConfig} from '../types';

const dev: ReleaseConfig = {
  releaseName: 'dev',
  description:
    'Development preset — all implemented features (ready + beta) on. Flags without implementation stay off.',
  features: {
    pasteTextInput: true,
    imageInput: true,
    ocrScanner: true,
    ocrReviewEdit: true,
    shortPractice: true,
    pronunciationSupport: true,
    themeSystem: true,
    themeSwitcher: true,
    darkTheme: true,
    pastelKidsTheme: true,
    coreTheme: true,
    neoTheme: true,
    comicTheme: true,
    cartoonTheme: true,
    stickerSoftTheme: true,
    reviewSystem: true,
    youtubeLearning: true,
  },
};

export default dev;
