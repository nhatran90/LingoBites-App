import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {FeatureFlagProvider} from '@core/release';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {
  isEvaluationConsentOn,
  isPronunciationConsentOn,
  setPronunciationConsent,
} from '../../logic/upload/recordingConsent';
import {PronunciationSettingsRow} from '../PronunciationSettingsRow';

/** Pronunciation step 3: the pronunciation consent switch in Settings. */
beforeEach(() => {
  const db = openRealSqlite(':memory:');
  runMigrations(db);
  resetDatabaseForTests(db);
});

afterEach(() => {
  resetDatabaseForTests(null);
});

async function render() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <PronunciationSettingsRow />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const toggle = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root
    .findAll(node => node.props.testID === 'pronunciation-settings-switch')
    .find(node => typeof node.props.onValueChange === 'function')!;

describe('PronunciationSettingsRow', () => {
  it('shows the saved consent and switches it, and only it', async () => {
    setPronunciationConsent('on');
    const tree = await render();
    expect(toggle(tree).props.value).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain('Microsoft Azure Speech');

    await act(async () => toggle(tree).props.onValueChange(false));
    expect(isPronunciationConsentOn()).toBe(false);
    expect(toggle(tree).props.value).toBe(false);

    await act(async () => toggle(tree).props.onValueChange(true));
    expect(isPronunciationConsentOn()).toBe(true);
    expect(isEvaluationConsentOn()).toBe(false);
  });
});
