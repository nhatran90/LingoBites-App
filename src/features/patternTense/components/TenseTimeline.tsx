import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle, Path, Rect} from 'react-native-svg';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

type Props = {time: string | null; aspect: string | null};

/** Where each time sits on the 300-wide line; "now" is the middle. */
const ANCHOR: Record<string, number> = {past: 78, present: 150, future: 222};
/** The point a perfect tense looks back from. */
const REFERENCE: Record<string, number> = {
  past: 112,
  present: 150,
  future: 250,
};
const Y = 24;

/**
 * A small line of time under a tense's name, drawn from its time and aspect:
 * simple is a point (a row of points for the present: habits), continuous a
 * bar, perfect a point with an arrow to the moment it is seen from, perfect
 * continuous a bar up to that moment. A tense outside the grid (be going to)
 * is an arrow from now to a point ahead.
 */
export function TenseTimeline({time, aspect}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const ink = theme.colors.primary;
  const anchor = ANCHOR[time ?? ''] ?? ANCHOR.future!;
  const reference = REFERENCE[time ?? ''] ?? REFERENCE.present!;
  const perfect = aspect === 'perfect' || aspect === 'perfect_continuous';

  let mark: React.ReactNode;
  if (aspect === 'simple' && time === 'present') {
    mark = [96, 123, 150, 177, 204].map(x => (
      <Circle cx={x} cy={Y} fill={ink} key={x} r={5} />
    ));
  } else if (aspect === 'simple' && ANCHOR[time ?? '']) {
    mark = <Circle cx={anchor} cy={Y} fill={ink} r={7} />;
  } else if (aspect === 'continuous' && ANCHOR[time ?? '']) {
    mark = (
      <>
        <Rect
          fill={ink}
          height={12}
          rx={6}
          width={60}
          x={anchor - 30}
          y={Y - 6}
        />
        <Circle cx={anchor} cy={Y} fill={HERO_PALETTE.white} r={3} />
      </>
    );
  } else if (aspect === 'perfect' && REFERENCE[time ?? '']) {
    const event = reference - 52;
    mark = (
      <>
        <Circle cx={event} cy={Y} fill={ink} r={7} />
        <Path
          d={`M${event + 9} ${Y} H${reference - 8}`}
          stroke={ink}
          strokeDasharray="4 3"
          strokeWidth={2.5}
        />
        <Path
          d={`M${reference - 13} ${Y - 5} L${reference - 6} ${Y} L${reference - 13} ${Y + 5}`}
          fill="none"
          stroke={ink}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
        />
      </>
    );
  } else if (aspect === 'perfect_continuous' && REFERENCE[time ?? '']) {
    mark = (
      <>
        <Rect
          fill={ink}
          height={12}
          rx={6}
          width={58}
          x={reference - 66}
          y={Y - 6}
        />
        <Path
          d={`M${reference - 13} ${Y - 7} L${reference - 4} ${Y} L${reference - 13} ${Y + 7}`}
          fill={ink}
        />
      </>
    );
  } else {
    mark = (
      <>
        <Path
          d={`M156 ${Y} H212`}
          stroke={ink}
          strokeDasharray="4 3"
          strokeWidth={2.5}
        />
        <Circle cx={222} cy={Y} fill={ink} r={7} />
      </>
    );
  }

  return (
    <View
      accessibilityLabel={t('patternTense.timeline_a11y')}
      accessible
      style={styles.box}
      testID="tense-timeline"
    >
      <Svg height={40} viewBox="0 0 300 48" width="100%">
        <Path
          d={`M14 ${Y} H282`}
          stroke={theme.colors.outlineVariant}
          strokeLinecap="round"
          strokeWidth={2.5}
        />
        <Path
          d={`M276 ${Y - 5} L284 ${Y} L276 ${Y + 5}`}
          fill="none"
          stroke={theme.colors.outlineVariant}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
        />
        <Path
          d={`M150 ${Y - 16} V${Y + 16}`}
          stroke={HERO_PALETTE.coralShelf}
          strokeLinecap="round"
          strokeWidth={2.5}
        />
        {mark}
        {perfect && time !== 'present' && REFERENCE[time ?? ''] ? (
          <Circle
            cx={reference}
            cy={Y}
            fill={HERO_PALETTE.white}
            r={6}
            stroke={theme.colors.ink}
            strokeWidth={2}
          />
        ) : null}
      </Svg>
      <View style={styles.labels}>
        <AppText style={styles.label}>{t('patternTense.time_past')}</AppText>
        <AppText style={[styles.label, styles.now]}>
          {t('patternTense.timeline_now')}
        </AppText>
        <AppText style={styles.label}>{t('patternTense.time_future')}</AppText>
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    box: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 16,
      paddingBottom: 8,
      paddingHorizontal: 8,
      paddingTop: 6,
    },
    label: {
      color: theme.colors.text.muted,
      flex: 1,
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
    },
    labels: {
      flexDirection: 'row',
    },
    now: {
      color: HERO_PALETTE.coralShelf,
      fontWeight: '700',
    },
  });
}
