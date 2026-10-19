import React from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppProgressBar} from '@ui/components/AppProgressBar';

import {FLOW_STEPS, type FlowStep} from '../logic/practiceCompletion';

export type FlowProgressBarProps = {
  step: FlowStep;
  /** Steps whose activities all have an attempt. */
  doneSteps: ReadonlySet<number>;
  /** Steps with nothing to do (an empty step 1): left out of the bar. */
  skippedSteps?: ReadonlySet<number>;
  onSelect: (step: FlowStep) => void;
};

/**
 * The steps as the app's progress notes: done steps mint, the open step
 * coral; skipped ones are left out and the rest numbered as shown. An
 * invisible button lies over each note, so tapping it opens that step, like
 * the old step chips.
 */
export function FlowProgressBar({
  step,
  doneSteps,
  skippedSteps,
  onSelect,
}: FlowProgressBarProps) {
  const {t} = useTranslation();
  const steps = FLOW_STEPS.filter(
    value => value === step || !skippedSteps?.has(value),
  );
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{
        text: t('lessonFlow.progress_a11y', {
          step: steps.indexOf(step) + 1,
          total: steps.length,
        }),
      }}
      style={styles.row}
      testID="lesson-flow-progress"
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.bar}
      >
        <AppProgressBar
          current={steps.indexOf(step)}
          done={toIndexes(steps, doneSteps)}
          total={steps.length}
        />
      </View>
      {steps.map((value, index) => {
        const done = doneSteps.has(value);
        return (
          <Pressable
            accessibilityHint={t('lessonFlow.step_chip_hint')}
            accessibilityLabel={t('lessonFlow.step_heading', {
              step: index + 1,
              label: t(`lessonFlow.step_${value}`),
            })}
            accessibilityRole="button"
            accessibilityState={{
              selected: value === step,
              checked: done,
            }}
            key={value}
            onPress={() => onSelect(value)}
            style={styles.hit}
            testID={`lesson-flow-step-${value}`}
          />
        );
      })}
    </View>
  );
}

/** The positions of `picked` among the shown steps (notes count from 0). */
function toIndexes(
  steps: readonly FlowStep[],
  picked: ReadonlySet<number>,
): Set<number> {
  return new Set(
    steps.flatMap((value, index) => (picked.has(value) ? [index] : [])),
  );
}

const styles = StyleSheet.create({
  bar: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
  },
  hit: {
    flex: 1,
    minHeight: 44,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
});
