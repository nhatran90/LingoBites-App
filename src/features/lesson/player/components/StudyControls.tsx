/**
 * Shared pieces of the lesson's study screens (Học từng câu, Từ & cụm, Mẫu
 * câu, Nghe hiểu, Phát âm, Ngữ pháp): the page layout with its bottom
 * buttons, the progress strip and the bookmark toggle.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {ActionIconButton} from '@ui/components/ActionIconButton';
import {AppProgressBar} from '@ui/components/AppProgressBar';
import {AppText} from '@ui/components/AppText';
import {BottomActionBar} from '@ui/components/BottomActionBar';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {SaveToggle} from '@ui/components/SaveToggle';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge, getStickerFace} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

type StudyPageProps = {
  /** Changing it scrolls back to the top, e.g. the current sentence. */
  pageKey: string | number;
  children: React.ReactNode;
  footer: React.ReactNode;
  testID?: string;
};

/**
 * Stops the study page from scrolling while true, e.g. while a card is being
 * dragged sideways: on iOS the page's native scroll keeps going under a JS
 * drag unless it is switched off. Outside a study page it does nothing.
 */
const ScrollLockContext = createContext<(locked: boolean) => void>(() => {});

export function useStudyScrollLock(): (locked: boolean) => void {
  return useContext(ScrollLockContext);
}

/** A study page: its own scroll area over a fixed row of buttons. */
export function StudyPage({pageKey, children, footer, testID}: StudyPageProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const scrollRef = useRef<ScrollView>(null);
  const [scrollLocked, setScrollLocked] = useState(false);
  useEffect(() => {
    scrollRef.current?.scrollTo?.({y: 0, animated: false});
  }, [pageKey]);
  return (
    <View style={styles.page} testID={testID}>
      <ScrollView
        contentContainerStyle={styles.content}
        ref={scrollRef}
        scrollEnabled={!scrollLocked}
        showsVerticalScrollIndicator={false}
        style={styles.page}
      >
        <ScrollLockContext.Provider value={setScrollLocked}>
          {children}
        </ScrollLockContext.Provider>
      </ScrollView>
      <BottomActionBar style={styles.footer}>{footer}</BottomActionBar>
    </View>
  );
}

type NavButtonProps = {
  label: string;
  onPress: () => void;
  /** `ghost` for "back", `coral` for "next", `primary` for a main action. */
  tone: 'ghost' | 'coral' | 'primary';
  icon?: HandoffIconName;
  iconSide?: 'left' | 'right';
  disabled?: boolean;
  accessibilityHint?: string;
  testID: string;
};

/** One of the two buttons at the bottom of a study page. */
export function StudyNavButton({
  label,
  onPress,
  tone,
  icon,
  iconSide = 'left',
  disabled = false,
  accessibilityHint,
  testID,
}: NavButtonProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const ink =
    tone === 'ghost'
      ? theme.colors.primary
      : tone === 'primary'
        ? theme.colors.text.inverse
        : (HERO_PALETTE.white as string);
  const iconNode = icon ? (
    <MaterialIcon color={ink} name={icon} size={20} />
  ) : null;
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.navButton,
        tone === 'ghost'
          ? styles.navGhost
          : tone === 'coral'
            ? styles.navCoral
            : styles.navPrimary,
        pressed ? styles.navPressed : null,
        disabled ? styles.navDisabled : null,
      ]}
      testID={testID}
    >
      {iconSide === 'left' ? iconNode : null}
      <AppText numberOfLines={1} style={[styles.navText, {color: ink}]}>
        {label}
      </AppText>
      {iconSide === 'right' ? iconNode : null}
    </Pressable>
  );
}

/** The two bottom buttons side by side. */
export function StudyNavRow({children}: {children: React.ReactNode}) {
  return <View style={rowStyles.row}>{children}</View>;
}

type ProgressProps = {
  total: number;
  index: number;
  /** "3/9"; shown at the end of the strip. */
  label: string;
  onSelect: (index: number) => void;
  testID?: string;
};

/**
 * The app's progress notes with "3/9" after them. Tapping a note jumps to
 * that page; screen readers use the page's own next / previous actions.
 */
export function StudyProgress({
  total,
  index,
  label,
  onSelect,
  testID = 'study-progress',
}: ProgressProps) {
  return (
    <AppProgressBar
      accessibilityValue={{min: 1, max: total, now: index + 1}}
      count={label}
      current={index}
      onSelect={onSelect}
      testID={testID}
      total={total}
    />
  );
}

type BookmarkProps = {
  saved: boolean;
  onPress: () => void;
  /** Read aloud: "Lưu thẻ" / "Đánh dấu"; "Đã lưu" once saved. */
  label: string;
  savedLabel: string;
  accessibilityHint?: string;
  /** Lighter face on a tinted card. */
  onTint?: boolean;
  testID: string;
};

/** Bookmark button: the shared save toggle as a raised square. */
export function BookmarkToggle({
  saved,
  onPress,
  label,
  savedLabel,
  accessibilityHint,
  onTint = false,
  testID,
}: BookmarkProps) {
  return (
    <SaveToggle
      accessibilityHint={accessibilityHint ?? ''}
      accessibilityLabel={saved ? savedLabel : label}
      onPress={onPress}
      onTint={onTint}
      raised="row"
      saved={saved}
      testID={testID}
    />
  );
}

type SpeakSquareProps = {
  onPress: () => void;
  /** `timer` for "Nghe chậm". */
  icon?: HandoffIconName;
  accessibilityLabel: string;
  accessibilityHint?: string;
  onTint?: boolean;
  testID: string;
};

/** "Listen" button matching the bookmark toggle. */
export function SpeakSquare({
  onPress,
  icon = 'volume_up',
  accessibilityLabel,
  accessibilityHint,
  onTint = false,
  testID,
}: SpeakSquareProps) {
  return (
    <ActionIconButton
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      icon={icon}
      onPress={onPress}
      onTint={onTint}
      testID={testID}
    />
  );
}

/** Small uppercase label above a block, e.g. "MẸO", "TRONG BÀI". */
export function StudyLabel({
  children,
  color,
  testID,
}: {
  children: string;
  color?: string;
  testID?: string;
}) {
  const {theme} = useAppTheme();
  return (
    <AppText
      style={[rowStyles.label, {color: color ?? theme.colors.text.muted}]}
      testID={testID}
    >
      {children.toUpperCase()}
    </AppText>
  );
}

/** White sticker card used by every study page. */
export function studyCardStyle(theme: AppTheme) {
  return {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    ...getStickerFace(theme, 4),
  } as const;
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    page: {
      flex: 1,
    },
    content: {
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.lg,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    footer: {
      backgroundColor: theme.colors.background,
      borderTopColor: theme.colors.outlineVariant,
    },
    navButton: {
      alignItems: 'center',
      borderRadius: theme.radius.lg,
      flex: 1,
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      minHeight: 52,
      paddingHorizontal: 12,
    },
    navGhost: {
      backgroundColor: theme.colors.surface,
      ...getStickerEdge(4, theme.colors.outlineVariant),
    },
    navCoral: {
      backgroundColor: HERO_PALETTE.coral,
      ...getStickerEdge(4, HERO_PALETTE.coralShelf),
    },
    navPrimary: {
      backgroundColor: theme.colors.primary,
      ...getStickerEdge(4, HERO_PALETTE.tealInk),
    },
    navPressed: {
      opacity: theme.states.pressedOpacity,
    },
    navDisabled: {
      opacity: theme.states.disabledOpacity,
    },
    navText: {
      flexShrink: 1,
      fontSize: 16,
      fontWeight: '800',
    },
  });
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
});
