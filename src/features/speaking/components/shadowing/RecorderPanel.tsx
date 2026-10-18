import React, {useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import Svg, {Circle} from 'react-native-svg';

import {AppText} from '@ui/components/AppText';
import {withAlpha} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import {
  formatShadowingElapsed,
  SHADOWING_MAX_RECORDING_MS,
  type ShadowingSessionState,
} from '../../logic/shadowing/useShadowingSession';

export type RecorderPanelProps = {
  sessionState: ShadowingSessionState;
  elapsedMs: number;
  onStart: () => void;
  onStop: () => void;
  /** Shown beside the mic while idle; omitted hides "Bỏ qua". */
  onSkip?: () => void;
};

const RING_SIZE = 84;
const RING_STROKE = 5;
const MIC_SIZE = 64;
const WAVE_BARS = 16;

/**
 * The compact mic dock pinned under the sentence, one row high so the
 * sentence card above keeps its sample buttons on screen.
 * Idle: [mint mic] "Chạm để nói theo" / "Tối đa 30s" (info, not a button)
 * [Bỏ qua]. Recording: a coral stop button inside a ring that fills up to
 * the 30-second limit, the timer and a moving wave in the same row.
 */
export function RecorderPanel({
  sessionState,
  elapsedMs,
  onStart,
  onStop,
  onSkip,
}: RecorderPanelProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const recording = sessionState === 'recording';
  const maxLabel = formatShadowingElapsed(SHADOWING_MAX_RECORDING_MS);
  const share = Math.min(
    1,
    Math.max(0, elapsedMs / SHADOWING_MAX_RECORDING_MS),
  );
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={styles.dock} testID="shadowing-recorder-panel">
      <View style={styles.micWrap}>
        <Svg
          height={RING_SIZE}
          style={StyleSheet.absoluteFill}
          width={RING_SIZE}
        >
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill={recording ? 'none' : withAlpha(theme.colors.accent, 0.18)}
            r={radius}
            stroke={recording ? theme.colors.surfaceHigh : 'none'}
            strokeWidth={RING_STROKE}
          />
          {recording ? (
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              fill="none"
              origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
              r={radius}
              rotation={-90}
              stroke={HERO_PALETTE.coral}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (1 - share)}
              strokeLinecap="round"
              strokeWidth={RING_STROKE}
            />
          ) : null}
        </Svg>
        <Pressable
          accessibilityHint={
            recording
              ? 'Dừng và nghe lại bản ghi'
              : 'Ghi giọng bạn nói theo câu mẫu'
          }
          accessibilityLabel={recording ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'}
          accessibilityRole="button"
          onPress={recording ? onStop : onStart}
          style={({pressed}) => [
            styles.mic,
            recording ? styles.micRecording : styles.micIdle,
            pressed && styles.micPressed,
          ]}
          testID="shadowing-record-button"
        >
          {recording ? (
            <View style={styles.stopSquare} />
          ) : (
            <MaterialIcon color={theme.colors.accentInk} name="mic" size={30} />
          )}
        </Pressable>
      </View>

      <View style={styles.text}>
        {recording ? (
          <>
            <AppText style={styles.timer} testID="shadowing-recording-counter">
              {formatShadowingElapsed(elapsedMs)}
              <AppText style={styles.timerMax}>{` / ${maxLabel}`}</AppText>
            </AppText>
            <View
              accessibilityHint="Sóng chạy trong lúc ghi âm"
              accessibilityLabel="Mức âm thanh"
              style={styles.wave}
              testID="shadowing-level-animation"
            >
              {Array.from({length: WAVE_BARS}, (_, index) => (
                <View
                  key={index}
                  style={[
                    styles.waveBar,
                    {height: waveHeight(index, elapsedMs)},
                  ]}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            <AppText style={styles.hint} testID="shadowing-record-hint">
              Chạm để nói theo
            </AppText>
            <View style={styles.limit}>
              <MaterialIcon
                color={theme.colors.text.muted}
                name="timer"
                size={15}
              />
              <AppText color="muted" style={styles.sub}>
                Tối đa 30s
              </AppText>
            </View>
          </>
        )}
      </View>

      {!recording && onSkip ? (
        <Pressable
          accessibilityHint="Chuyển sang câu tiếp theo"
          accessibilityLabel="Bỏ qua câu này"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onSkip}
          style={({pressed}) => [styles.skip, pressed && styles.skipPressed]}
          testID="shadowing-skip-sentence"
        >
          <AppText color="secondary" style={styles.skipLabel}>
            Bỏ qua
          </AppText>
          <MaterialIcon
            color={theme.colors.text.secondary}
            name="chevron_right"
            size={18}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Bar heights for the recording wave. The recorder reports no input level,
 * so the bars move with the elapsed time instead of the voice.
 */
function waveHeight(index: number, elapsedMs: number): number {
  const tick = Math.floor(elapsedMs / 120);
  const swing = Math.abs(
    Math.sin(index * 1.7 + tick * 0.9) * Math.cos(index * 0.45 + tick * 0.3),
  );
  return 6 + Math.round(swing * 22);
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    dock: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.shelf?.surface.color ?? theme.colors.surfaceHigh,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderTopWidth: 1,
      flexDirection: 'row',
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.md,
    },
    micWrap: {
      alignItems: 'center',
      height: RING_SIZE,
      justifyContent: 'center',
      width: RING_SIZE,
    },
    text: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    limit: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 3,
    },
    mic: {
      alignItems: 'center',
      borderRadius: MIC_SIZE / 2,
      height: MIC_SIZE,
      justifyContent: 'center',
      width: MIC_SIZE,
    },
    micIdle: {
      backgroundColor: theme.colors.accent,
      ...getStickerEdge(4, HERO_PALETTE.shelf),
    },
    micRecording: {
      backgroundColor: HERO_PALETTE.coral,
      ...getStickerEdge(4, HERO_PALETTE.coralShelf),
    },
    micPressed: {
      transform: [{translateY: 3}],
    },
    stopSquare: {
      backgroundColor: HERO_PALETTE.white,
      borderRadius: 6,
      height: 22,
      width: 22,
    },
    hint: {
      fontSize: 16,
      fontWeight: '800',
    },
    sub: {
      fontSize: 13,
      fontWeight: '700',
    },
    timer: {
      color: theme.colors.onSecondaryContainer,
      fontSize: 20,
      fontVariant: ['tabular-nums'],
      fontWeight: '800',
    },
    timerMax: {
      color: theme.colors.text.muted,
      fontSize: 15,
      fontWeight: '600',
    },
    wave: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 3,
      height: 28,
    },
    waveBar: {
      backgroundColor: HERO_PALETTE.coral,
      borderRadius: 2,
      width: 4,
    },
    // A small sticker button: the only action besides the mic.
    skip: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.shelf?.surface.color ?? theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      flexDirection: 'row',
      gap: 2,
      minHeight: 40,
      paddingLeft: 14,
      paddingRight: 8,
      ...getStickerEdge(
        3,
        theme.shelf?.surface.color ?? theme.colors.surfaceHigh,
      ),
    },
    skipPressed: {
      transform: [{translateY: 2}],
      ...getStickerEdge(
        1,
        theme.shelf?.surface.color ?? theme.colors.surfaceHigh,
      ),
    },
    skipLabel: {
      fontSize: 14,
      fontWeight: '800',
    },
  });
}
