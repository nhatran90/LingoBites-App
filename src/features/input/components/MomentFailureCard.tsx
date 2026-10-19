import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import type {MomentFailureKind} from '../logic/momentMessages';
import {MomentSituationChip} from './MomentSituationChip';

const ICONS: Record<MomentFailureKind, HandoffIconName> = {
  system: 'warning',
  not_suitable: 'lightbulb',
  paused: 'schedule',
  limit: 'schedule',
  cancelled: 'info',
  pick_other: 'info',
};

type Props = {
  kind: MomentFailureKind;
  title: string;
  message: string;
  situation: string | null;
  /** `not_suitable`: what the AI said was missing and how to say it better. */
  reason?: string | null;
  suggestion?: string | null;
  /** `system`: a short reference for support (server code and request id). */
  reference?: string | null;
};

/**
 * E3 failure state: one heading, why it happened in the learner's words, and
 * that no credit was used. The actions live in the screen's footer, because
 * each kind leads somewhere else (retry, edit, wait, pick another).
 */
export function MomentFailureCard({
  kind,
  title,
  message,
  situation,
  reason,
  suggestion,
  reference,
}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const ours = kind === 'system';
  const tip =
    kind === 'not_suitable'
      ? (suggestion ?? t('moment.fail_vague_tip_default'))
      : null;

  return (
    <View style={styles.card} testID={`moment-failed-${kind}`}>
      <View style={[styles.badge, ours ? styles.badgeCoral : styles.badgeSun]}>
        <MaterialIcon
          color={ours ? HERO_PALETTE.coralShelf : HERO_PALETTE.sunShelf}
          name={ICONS[kind]}
          size={32}
        />
      </View>
      <View accessibilityLiveRegion="polite" accessible style={styles.text}>
        <AppText style={styles.center} variant="h3">
          {title}
        </AppText>
        <AppText color="secondary" style={styles.center}>
          {reason ?? message}
        </AppText>
      </View>
      {tip ? (
        <View style={styles.tip}>
          <AppText variant="caption">
            <AppText style={styles.tipLead} variant="caption">
              {t('moment.fail_tip')}{' '}
            </AppText>
            {tip}
          </AppText>
        </View>
      ) : null}
      {kind !== 'limit' ? (
        <View style={styles.keep} testID="moment-failed-no-credit">
          <MaterialIcon color={theme.colors.accentInk} name="bolt" size={15} />
          <AppText style={styles.keepText} variant="caption">
            {t('moment.fail_no_credit')}
          </AppText>
        </View>
      ) : null}
      {situation && kind !== 'not_suitable' ? (
        <MomentSituationChip centered title={situation} />
      ) : null}
      {ours && reference ? (
        <AppText color="muted" style={styles.ref} variant="caption">
          {reference}
        </AppText>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      gap: 12,
      paddingHorizontal: 18,
      paddingVertical: 22,
      ...getStickerEdge(5, theme.colors.surfaceHigh),
    },
    badge: {
      alignItems: 'center',
      borderRadius: 22,
      height: 64,
      justifyContent: 'center',
      width: 64,
    },
    badgeCoral: {
      backgroundColor: theme.colors.secondarySoft,
      ...getStickerEdge(4, HERO_PALETTE.coralRing),
    },
    badgeSun: {
      backgroundColor: theme.colors.tertiarySoft,
      ...getStickerEdge(4, theme.colors.tertiaryBorder),
    },
    text: {alignSelf: 'stretch', gap: 6},
    center: {textAlign: 'center'},
    tip: {
      alignSelf: 'stretch',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    tipLead: {fontWeight: '800'},
    keep: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 5,
    },
    keepText: {color: theme.colors.accentInk, fontWeight: '700'},
    ref: {fontSize: 11},
  });
}
