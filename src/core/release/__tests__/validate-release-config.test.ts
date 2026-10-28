import {CORE_BETA_WITHOUT_REVIEW, makeTestReleaseConfig} from '@test/support';

import {featureDependencies} from '../feature-dependencies';
import {featureRegistry} from '../feature-registry';
import {
  DEFAULT_RELEASE_NAME,
  getReleaseConfig,
  listReleaseConfigNames,
} from '../release-manifest';
import type {FeatureRegistryEntry} from '../types';
import {validateReleaseConfig} from '../validate-release-config';

describe('validateReleaseConfig', () => {
  it('exposes exactly dev and production presets', () => {
    expect(listReleaseConfigNames()).toEqual(['dev', 'production']);
  });

  it('accepts dev preset with every implemented feature enabled', () => {
    const config = getReleaseConfig('dev');
    const result = validateReleaseConfig(
      config,
      featureRegistry,
      featureDependencies,
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);

    for (const entry of featureRegistry as readonly FeatureRegistryEntry[]) {
      if (entry.status === 'not_implemented') {
        expect(Boolean(config.features[entry.key])).toBe(false);
      } else {
        expect(config.features[entry.key]).toBe(true);
      }
    }
    expect(config.features.stickerSoftTheme).toBe(true);
    expect(config.features.youtubeLearning).toBe(true);
  });

  it('accepts production preset with every implemented feature enabled', () => {
    const config = getReleaseConfig('production');
    const result = validateReleaseConfig(
      config,
      featureRegistry,
      featureDependencies,
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);

    for (const entry of featureRegistry as readonly FeatureRegistryEntry[]) {
      if (entry.status === 'not_implemented') {
        expect(Boolean(config.features[entry.key])).toBe(false);
      } else {
        expect(config.features[entry.key]).toBe(true);
      }
    }
    expect(config.features.stickerSoftTheme).toBe(true);
    expect(config.features.youtubeLearning).toBe(true);
  });

  it('keeps dev and production feature maps identical', () => {
    const dev = getReleaseConfig('dev');
    const production = getReleaseConfig('production');
    expect(production.features).toEqual(dev.features);
  });

  it('rejects ocrScanner when imageInput is disabled', () => {
    const config = makeTestReleaseConfig(CORE_BETA_WITHOUT_REVIEW);
    const result = validateReleaseConfig(
      {
        ...config,
        features: {
          ...config.features,
          ocrScanner: true,
          imageInput: false,
        },
      },
      featureRegistry,
      featureDependencies,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes('ocrScanner'))).toBe(
      true,
    );
  });

  it('rejects unknown feature keys', () => {
    const config = makeTestReleaseConfig(CORE_BETA_WITHOUT_REVIEW);
    const result = validateReleaseConfig(
      {
        ...config,
        features: {
          ...config.features,
          unknownFeature: true,
        },
      },
      featureRegistry,
      featureDependencies,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes('unknownFeature'))).toBe(
      true,
    );
  });
});

describe('DEFAULT_RELEASE_NAME', () => {
  it('remains production', () => {
    expect(DEFAULT_RELEASE_NAME).toBe('production');
  });
});

describe('stickerSoftTheme rollout (SETE-268)', () => {
  it('is enabled in every release preset', () => {
    for (const name of listReleaseConfigNames()) {
      expect(getReleaseConfig(name).features.stickerSoftTheme).toBe(true);
    }
  });
});
