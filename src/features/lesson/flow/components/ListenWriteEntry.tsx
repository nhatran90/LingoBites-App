import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {useScreenSpeak} from '@features/audio';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {normalizeAnswer} from '@core/learning';
import type {LessonSupportLevel} from '@core/schemas/sync';

import type {EntryResult} from '../logic/activityOutcome';
import {SLOW_TTS_RATE} from './ListenCardDeck';
import {SoftButton} from './SoftButton';
import {SpeakSelfCheck} from './SpeakSelfCheck';
import {TypedEntry} from './TypedEntry';

export type ListenWriteEntryProps = {
  model: string;
  meaning: string;
  onReport: (result: EntryResult, support: LessonSupportLevel) => void;
};

/**
 * One listen-and-repeat sentence: say it back (SpeakSelfCheck), or choose
 * "Viết thay vì nói" and write what you hear with the tile keyboard. The
 * sentence text is hidden while writing; the written answer is reported
 * like a typed one (decided with the user).
 */
export function ListenWriteEntry({
  model,
  meaning,
  onReport,
}: ListenWriteEntryProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const speak = useScreenSpeak();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [writing, setWriting] = useState(false);
  const [reported, setReported] = useState(false);
  const report = (result: EntryResult, support: LessonSupportLevel) => {
    setReported(true);
    onReport(result, support);
  };

  return (
    <View style={styles.container}>
      {reported ? null : (
        <AppButton
          accessibilityHint={t(
            writing
              ? 'lessonFlow.listen_speak_instead_hint'
              : 'lessonFlow.listen_write_instead_hint',
          )}
          iconLeft={writing ? 'mic' : 'edit'}
          onPress={() => setWriting(on => !on)}
          testID="lesson-flow-listen-write-switch"
          title={t(
            writing
              ? 'lessonFlow.listen_speak_instead'
              : 'lessonFlow.listen_write_instead',
          )}
          variant="ghost"
        />
      )}
      {writing ? (
        <>
          <View style={styles.listen}>
            <AppText color="secondary" variant="label">
              {t('lessonFlow.listen_write_title')}
            </AppText>
            <AppText
              color="secondary"
              testID="lesson-flow-prompt"
              variant="bodyLg"
            >
              {meaning}
            </AppText>
            <View style={styles.row}>
              <SoftButton
                accessibilityHint={t('lessonFlow.listen_model_hint')}
                icon="volume_up"
                label={t('lessonFlow.listen_model')}
                onPress={() => {
                  speak(model);
                }}
                testID="lesson-flow-listen-write-play"
              />
              <SoftButton
                accessibilityHint={t('lessonFlow.listen_slow_hint')}
                icon="volume_up"
                label={t('listen.slow_labelled')}
                onPress={() => {
                  speak(model, SLOW_TTS_RATE);
                }}
                testID="lesson-flow-listen-write-slow"
              />
            </View>
          </View>
          <TypedEntry
            accepted={[normalizeAnswer(model)]}
            hints={[]}
            modelAnswer={model}
            onReport={report}
          />
        </>
      ) : (
        <SpeakSelfCheck
          hints={null}
          meaning={meaning}
          model={model}
          onReport={report}
        />
      )}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {gap: theme.spacing.sm},
    listen: {gap: theme.spacing.sm},
    row: {flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm},
  });
}
