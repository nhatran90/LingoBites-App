/**
 * PackStatusCard — a word pack in the Library's stack and the pack list.
 *
 * The pack's cover fills the right of the card and melts into a face whose
 * colour says where the learner is with the pack:
 *   [A1] [GÓI 2] [ĐANG HỌC]                     [cover]
 *   Daily life
 *   12 từ
 *   [ Đã nhớ  ███████████░  11/12 ]   white strip
 *   [ ▶ Học tiếp ]
 * Learning is mint, downloaded sky, done green; a pack not on the phone yet
 * is drawn pale with a dashed edge and a faded cover.
 */
import React, {useMemo, useState} from 'react';
import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {Defs, LinearGradient, Rect, Stop, Svg} from 'react-native-svg';

import {AppProgressBar} from '@ui/components/AppProgressBar';
import {AppText} from '@ui/components/AppText';
import {
  type CoverGlyph,
  Glyph,
  LibraryCover,
} from '@ui/components/LibraryCover';
import {ShelfSurface} from '@ui/components/ShelfSurface';
import type {CardAction} from '@ui/components/ToneCard';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {HERO_PALETTE} from '@ui/theme/heroPalette';
import {levelTone} from '@ui/theme/levelColors';

export const PACK_CARD_HEIGHT = 224;
export const PACK_CARD_RADIUS = 26;
export const PACK_CARD_SHELF_HEIGHT = 6;
/** Share of a card the cover takes, on the right. */
const ART_SHARE = 0.7;

export type PackCardStatus = 'learning' | 'ready' | 'not_downloaded' | 'done';

interface StatusLook {
  face: string;
  shelf: string;
  /** The status chip. */
  chip: string;
  onChip: string;
  /** The action pill: a solid fill, or white with this ink. */
  pill: string;
  solidPill: boolean;
  /** A pack not on the phone: dashed edge, faded cover. */
  remote: boolean;
}

/**
 * Colours of each status, the same in every theme (like the hero cards), so
 * the copy on them always takes the dark hero ink.
 */
const STATUS_LOOK: Record<PackCardStatus, StatusLook> = {
  learning: {
    face: '#c9f2ea',
    shelf: '#8fd3c6',
    chip: HERO_PALETTE.tealInk,
    onChip: HERO_PALETTE.white,
    pill: HERO_PALETTE.teal,
    solidPill: true,
    remote: false,
  },
  ready: {
    face: '#dcefff',
    shelf: '#a9cfea',
    chip: HERO_PALETTE.white,
    onChip: HERO_PALETTE.skyInk,
    pill: HERO_PALETTE.teal,
    solidPill: true,
    remote: false,
  },
  not_downloaded: {
    face: '#f1eedf',
    shelf: '#d8d3b8',
    chip: '#ebe4fb',
    onChip: '#5d4a9e',
    pill: HERO_PALETTE.teal,
    solidPill: false,
    remote: true,
  },
  done: {
    face: '#e4f2dc',
    shelf: '#b5d6a3',
    chip: '#2e7d32',
    onChip: HERO_PALETTE.white,
    pill: '#2e7d32',
    solidPill: false,
    remote: false,
  },
};

/** Fixed inks on the status faces. */
const CARD_INK = {
  muted: '#3d3b2c',
  note: '#4f4c3a',
  remoteEdge: '#bdb795',
  eyebrowChip: 'rgba(255,255,255,0.9)',
  clear: 'transparent',
} as const;

const STATUS_GLYPH: Record<PackCardStatus, 'play' | 'check' | null> = {
  learning: 'play',
  ready: 'check',
  not_downloaded: null,
  done: 'check',
};

export interface PackStatusCardProps {
  title: string;
  /** "Gói 2"; hidden when null. */
  eyebrow?: string | null;
  /** CEFR level for the coloured chip; hidden when null. */
  level: string | null;
  status: PackCardStatus;
  /** "Đang học", "Đã tải", "Chưa tải", "Hoàn thành". */
  statusLabel: string;
  /** "12 từ · 2 cụm từ". */
  description?: string | null;
  learned: number;
  total: number;
  /** "Đã nhớ", before the progress bar. */
  learnedLabel: string;
  /** Shown in the strip instead of the bar for a pack not on the phone. */
  remoteNote: string;
  cover: {imageUrl: string | null; glyph: CoverGlyph};
  action: CardAction;
  accessibilityHint: string;
  onPress: () => void;
  /** Ignores presses, e.g. while another pack downloads. */
  disabled?: boolean;
  testID: string;
  /** Width of the list's side padding, to size the cover. */
  gutter: number;
  /** Screen reader actions on the card, e.g. "Gói sau" in a stack. */
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
}

export function PackStatusCard({
  title,
  eyebrow,
  level,
  status,
  statusLabel,
  description,
  learned,
  total,
  learnedLabel,
  remoteNote,
  cover,
  action,
  accessibilityHint,
  onPress,
  disabled = false,
  testID,
  gutter,
  accessibilityActions,
  onAccessibilityAction,
}: PackStatusCardProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const {width} = useWindowDimensions();
  const [pressed, setPressed] = useState(false);
  const look = STATUS_LOOK[status];
  const levelColors = level ? levelTone(theme, level) : null;
  const artWidth = Math.max(0, (width - gutter * 2) * ART_SHARE);
  const gradientId = `packFade-${testID}`;
  const statusGlyph = STATUS_GLYPH[status];
  const pillInk = look.solidPill ? HERO_PALETTE.white : look.pill;

  return (
    <Pressable
      accessibilityActions={accessibilityActions}
      accessibilityHint={accessibilityHint}
      accessibilityLabel={[
        level,
        eyebrow,
        title,
        statusLabel,
        description,
        look.remote ? null : `${learnedLabel} ${learned}/${total}`,
        action.label,
      ]
        .filter(Boolean)
        .join('. ')}
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onAccessibilityAction={onAccessibilityAction}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={testID}
    >
      <ShelfSurface
        borderRadius={PACK_CARD_RADIUS}
        faceStyle={[
          styles.face,
          {backgroundColor: look.face},
          look.remote ? styles.remoteFace : null,
        ]}
        isPressed={pressed}
        shelfColor={look.shelf}
        shelfHeight={PACK_CARD_SHELF_HEIGHT}
      >
        <View
          style={[
            styles.art,
            {width: artWidth},
            look.remote ? styles.remoteArt : null,
          ]}
        >
          <LibraryCover
            aspectRatio={artWidth > 0 ? artWidth / PACK_CARD_HEIGHT : undefined}
            glyph={cover.glyph}
            hideLevelChip
            imageUrl={cover.imageUrl}
            shape="lesson"
            testID={`${testID}-cover`}
          />
        </View>
        <Svg
          height={PACK_CARD_HEIGHT}
          pointerEvents="none"
          style={[styles.fade, {width: artWidth}]}
          width={artWidth}
        >
          <Defs>
            <LinearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
              <Stop offset="0" stopColor={look.face} stopOpacity={1} />
              <Stop offset="0.3" stopColor={look.face} stopOpacity={0.82} />
              <Stop offset="0.7" stopColor={look.face} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect fill={`url(#${gradientId})`} height="100%" width="100%" />
        </Svg>

        <View style={styles.copy}>
          <View style={styles.chips}>
            {levelColors ? (
              <View
                style={[styles.chip, {backgroundColor: levelColors.strong}]}
                testID={`${testID}-level`}
              >
                <AppText style={[styles.chipText, {color: levelColors.on}]}>
                  {level}
                </AppText>
              </View>
            ) : null}
            {eyebrow ? (
              <View style={[styles.chip, styles.eyebrowChip]}>
                <AppText style={styles.chipText}>
                  {eyebrow.toUpperCase()}
                </AppText>
              </View>
            ) : null}
            <View
              style={[
                styles.chip,
                styles.statusChip,
                {backgroundColor: look.chip},
              ]}
              testID={`${testID}-status`}
            >
              {statusGlyph ? (
                <Glyph color={look.onChip} name={statusGlyph} size={11} />
              ) : null}
              <AppText style={[styles.chipText, {color: look.onChip}]}>
                {statusLabel.toUpperCase()}
              </AppText>
            </View>
          </View>
          <View style={styles.titles}>
            <AppText numberOfLines={2} style={styles.title}>
              {title}
            </AppText>
            {description ? (
              <AppText
                numberOfLines={1}
                style={styles.description}
                testID={`${testID}-description`}
              >
                {description}
              </AppText>
            ) : null}
          </View>
          <View style={styles.spacer} />
          <View style={styles.strip}>
            {look.remote ? (
              <AppText numberOfLines={1} style={styles.stripNote}>
                {remoteNote}
              </AppText>
            ) : (
              <>
                <AppText style={styles.stripLabel}>{learnedLabel}</AppText>
                <AppProgressBar
                  compact
                  count={`${learned}/${total}`}
                  done={learned}
                  style={styles.bar}
                  surface="hero"
                  testID={`${testID}-progress`}
                  total={total}
                />
              </>
            )}
          </View>
          <View
            style={[
              styles.pill,
              look.solidPill
                ? [styles.solidPill, {backgroundColor: look.pill}]
                : styles.lightPill,
              look.remote ? {borderColor: look.pill} : null,
            ]}
            testID={`${testID}-action`}
          >
            {action.glyph && action.glyph !== 'add' ? (
              <Glyph color={pillInk} name={action.glyph} size={15} />
            ) : null}
            <AppText style={[styles.pillText, {color: pillInk}]}>
              {action.label}
            </AppText>
          </View>
        </View>
      </ShelfSurface>
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    face: {
      height: PACK_CARD_HEIGHT,
      overflow: 'hidden',
    },
    remoteFace: {
      borderColor: CARD_INK.remoteEdge,
      borderStyle: 'dashed',
      borderWidth: 2,
    },
    art: {
      bottom: 0,
      overflow: 'hidden',
      position: 'absolute',
      right: 0,
      top: 0,
    },
    remoteArt: {
      opacity: 0.45,
    },
    fade: {
      bottom: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    copy: {
      flex: 1,
      gap: 6,
      padding: 16,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      maxWidth: '80%',
    },
    chip: {
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    eyebrowChip: {
      backgroundColor: CARD_INK.eyebrowChip,
    },
    statusChip: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
    },
    chipText: {
      color: HERO_PALETTE.ink,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      lineHeight: 14,
    },
    titles: {
      gap: 2,
      width: '64%',
    },
    title: {
      color: HERO_PALETTE.ink,
      fontSize: 20,
      fontWeight: '800',
      lineHeight: 24,
    },
    description: {
      color: CARD_INK.muted,
      fontSize: 13,
      lineHeight: 17,
    },
    spacer: {
      flex: 1,
    },
    strip: {
      alignItems: 'center',
      backgroundColor: HERO_PALETTE.strip,
      borderRadius: 14,
      flexDirection: 'row',
      gap: 10,
      minHeight: 36,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    stripLabel: {
      color: HERO_PALETTE.tealInk,
      fontSize: 13,
      fontWeight: '700',
    },
    stripNote: {
      color: CARD_INK.note,
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
    },
    bar: {
      flex: 1,
    },
    pill: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 6,
      marginTop: 2,
      minHeight: 34,
      paddingLeft: 12,
      paddingRight: 16,
    },
    solidPill: {
      borderBottomColor: HERO_PALETTE.tealInk,
      borderBottomWidth: 2,
    },
    lightPill: {
      backgroundColor: HERO_PALETTE.white,
      borderColor: CARD_INK.clear,
      borderWidth: 2,
    },
    pillText: {
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 18,
    },
  });
}
