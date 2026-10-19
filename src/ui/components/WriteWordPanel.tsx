import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {answerWords, normalizeAnswer, type TileMode} from '@core/learning';

import {type AppTheme, useAppTheme} from '../theme';
import {AppButton} from './AppButton';
import {AppText} from './AppText';
import {TileComposer} from './TileComposer';
import {useTileMode} from './useTileMode';

type Props = {
  /** The English word or phrase to write; hidden while writing. */
  word: string;
  meaningVi: string;
  ipa?: string | null;
  /** Back to the card (after checking, or cancelled before). */
  onDone: () => void;
  /** Prefix of the panel's testIDs. */
  testID?: string;
};

const WORD_MODES: readonly TileMode[] = ['letters', 'keyboard'];
const PHRASE_MODES: readonly TileMode[] = ['words', 'letters', 'keyboard'];

/**
 * "Viết từ" on a word card: write the word from its Vietnamese meaning with
 * the tile keyboard, then go back to the card. Practice only — nothing is
 * scored, scheduled or counted as a hint.
 */
export function WriteWordPanel({
  word,
  meaningVi,
  ipa = null,
  onDone,
  testID = 'write-word',
}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [value, setValue] = useState('');
  const [mode, setMode] = useTileMode();
  const [right, setRight] = useState<boolean | null>(null);
  const phrase = answerWords(word).length > 1;

  const check = () =>
    setRight(normalizeAnswer(value) === normalizeAnswer(word));

  return (
    <View style={styles.container} testID={`${testID}-panel`}>
      <AppText color="secondary" variant="label">
        {t(phrase ? 'writeWord.title_phrase' : 'writeWord.title')}
      </AppText>
      <AppText testID={`${testID}-meaning`} variant="h2">
        {meaningVi}
      </AppText>
      {ipa ? <AppText color="muted">{ipa}</AppText> : null}
      <TileComposer
        accessibilityHint={t('writeWord.input_hint')}
        accessibilityLabel={t(
          phrase ? 'writeWord.title_phrase' : 'writeWord.title',
        )}
        answer={word}
        editable={right === null}
        mode={mode}
        modes={phrase ? PHRASE_MODES : WORD_MODES}
        onChangeText={setValue}
        onHint={() => undefined}
        onModeChange={setMode}
        seed={word}
        status={right === null ? null : right ? 'right' : 'wrong'}
        testID={`${testID}-input`}
        value={value}
      />
      {right === null ? (
        <View style={styles.row}>
          <AppButton
            accessibilityHint={t('writeWord.cancel_hint')}
            onPress={onDone}
            testID={`${testID}-cancel`}
            title={t('writeWord.cancel')}
            variant="secondary"
          />
          <AppButton
            accessibilityHint={t('writeWord.check_hint')}
            disabled={value.trim() === ''}
            onPress={check}
            style={styles.grow}
            testID={`${testID}-check`}
            title={t('writeWord.check')}
          />
        </View>
      ) : (
        <>
          <AppText
            color={right ? 'primary' : 'danger'}
            testID={`${testID}-verdict`}
            variant="label"
          >
            {right ? t('writeWord.right') : t('writeWord.wrong', {word})}
          </AppText>
          <AppButton
            accessibilityHint={t('writeWord.done_hint')}
            onPress={onDone}
            testID={`${testID}-done`}
            title={t('writeWord.done')}
          />
        </>
      )}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {gap: theme.spacing.md},
    grow: {flex: 1},
    row: {alignItems: 'center', flexDirection: 'row', gap: theme.spacing.sm},
  });
}
