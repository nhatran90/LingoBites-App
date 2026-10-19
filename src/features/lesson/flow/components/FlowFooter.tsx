import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';

import {StudyNavButton} from '../../player/components/StudyControls';

export type FlowFooterFeedback = {
  tone: 'pass' | 'retry';
  title: string;
  body?: string;
};

/** The pinned bottom action of the lesson player. */
export type FlowFooterAction = {
  title: string;
  hint: string;
  testID: string;
  onPress: () => void;
  icon?: HandoffIconName;
  /** Redesign: a result shown above the button, as a bottom sheet. */
  feedback?: FlowFooterFeedback;
  /** Greyed out until the entry is done; `note` says what is missing. */
  disabled?: boolean;
  note?: string;
  /** A second, lighter button on the left (e.g. "Thẻ trước"). */
  secondary?: {
    title: string;
    hint: string;
    testID: string;
    onPress: () => void;
    disabled?: boolean;
  };
};

/**
 * What a registration asks for: an action, or `'hidden'` for no bottom bar
 * at all (e.g. while a word card's practice panel has its own buttons).
 */
export type FlowFooterRequest = FlowFooterAction | 'hidden';

type Registration = {
  owner: number;
  priority: number;
  action: FlowFooterRequest;
};

type Register = (
  owner: number,
  priority: number,
  action: FlowFooterRequest | null,
) => void;

const FlowFooterContext = createContext<Register | null>(null);

let nextOwner = 1;

/**
 * Lets a step's content take over the pinned bottom button (and show its
 * feedback there) while it is mounted, or hide the bar (`'hidden'`). The
 * highest priority wins; without a host (a component rendered on its own)
 * it returns false and the caller shows its own inline button.
 */
export function useFlowFooter(
  action: FlowFooterRequest | null,
  priority: number,
): boolean {
  const register = useContext(FlowFooterContext);
  const owner = useRef(0);
  if (owner.current === 0) {
    owner.current = nextOwner;
    nextOwner += 1;
  }
  const latest = useRef(action);
  latest.current = action;
  // Only what is shown re-registers; the press always reaches the newest
  // handler through the ref.
  const shown =
    action === 'hidden'
      ? 'hidden'
      : action
        ? JSON.stringify([
            action.title,
            action.hint,
            action.testID,
            action.icon,
            action.feedback,
            action.disabled,
            action.note,
            action.secondary
              ? [
                  action.secondary.title,
                  action.secondary.testID,
                  action.secondary.disabled,
                ]
              : null,
          ])
        : null;

  useEffect(() => {
    if (!register) return;
    const id = owner.current;
    const current = latest.current;
    if (current === 'hidden') {
      register(id, priority, 'hidden');
      return () => register(id, priority, null);
    }
    register(
      id,
      priority,
      shown && current
        ? {
            ...current,
            onPress: () => latestAction()?.onPress(),
            secondary: current.secondary
              ? {
                  ...current.secondary,
                  onPress: () => latestAction()?.secondary?.onPress(),
                }
              : undefined,
          }
        : null,
    );
    return () => register(id, priority, null);
  }, [register, priority, shown]);

  return register !== null;

  function latestAction(): FlowFooterAction | null {
    const value = latest.current;
    return value === 'hidden' ? null : value;
  }
}

/**
 * State for the host: the action of the highest-priority registration, and
 * whether that registration hides the bar instead.
 */
export function useFlowFooterHost(): {
  register: Register;
  action: FlowFooterAction | null;
  hidden: boolean;
} {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const register = useCallback<Register>((owner, priority, action) => {
    setRegistrations(previous => {
      const rest = previous.filter(entry => entry.owner !== owner);
      return action ? [...rest, {owner, priority, action}] : rest;
    });
  }, []);
  const best = useMemo(() => {
    let found: Registration | null = null;
    for (const entry of registrations) {
      if (!found || entry.priority >= found.priority) found = entry;
    }
    return found?.action ?? null;
  }, [registrations]);
  return {
    register,
    action: best === 'hidden' ? null : best,
    hidden: best === 'hidden',
  };
}

export function FlowFooterProvider({
  register,
  children,
}: {
  register: Register;
  children: React.ReactNode;
}) {
  return (
    <FlowFooterContext.Provider value={register}>
      {children}
    </FlowFooterContext.Provider>
  );
}

/**
 * The pinned bottom bar: the button, with a tinted feedback sheet around it
 * when the action carries a result.
 */
export function FlowFooterBar({action}: {action: FlowFooterAction}) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const feedback = action.feedback;
  const pass = feedback?.tone === 'pass';
  return (
    <View
      style={[
        themedStyles.bar,
        feedback
          ? [
              themedStyles.sheet,
              pass ? themedStyles.sheetPass : themedStyles.sheetRetry,
            ]
          : null,
      ]}
    >
      {feedback ? (
        <View
          accessibilityLiveRegion="polite"
          style={themedStyles.feedback}
          testID="lesson-flow-entry-feedback"
        >
          <View
            style={[
              themedStyles.icon,
              pass ? themedStyles.iconPass : themedStyles.iconRetry,
            ]}
          >
            <MaterialIcon
              color={theme.colors.text.inverse}
              name={pass ? 'check_circle' : 'refresh'}
              size={26}
            />
          </View>
          <View style={themedStyles.flex}>
            <AppText
              style={pass ? themedStyles.titlePass : themedStyles.titleRetry}
              variant="h3"
            >
              {feedback.title}
            </AppText>
            {feedback.body ? (
              <AppText
                style={pass ? themedStyles.titlePass : themedStyles.titleRetry}
                variant="label"
              >
                {feedback.body}
              </AppText>
            ) : null}
          </View>
        </View>
      ) : null}
      {action.note && !feedback ? (
        <AppText color="muted" style={themedStyles.note} variant="caption">
          {action.note}
        </AppText>
      ) : null}
      <View style={themedStyles.buttons}>
        {action.secondary ? (
          <StudyNavButton
            accessibilityHint={action.secondary.hint}
            disabled={action.secondary.disabled}
            icon="chevron_left"
            label={action.secondary.title}
            onPress={action.secondary.onPress}
            testID={action.secondary.testID}
            tone="ghost"
          />
        ) : null}
        <StudyNavButton
          accessibilityHint={action.hint}
          disabled={action.disabled}
          icon={action.icon ?? 'chevron_right'}
          iconSide="right"
          label={action.title}
          onPress={action.onPress}
          testID={action.testID}
          tone="coral"
        />
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  return StyleSheet.create({
    bar: {
      backgroundColor: colors.background,
      borderTopColor: colors.outlineVariant,
      borderTopWidth: 1,
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.md,
    },
    buttons: {
      flexDirection: 'row',
      gap: 10,
    },
    note: {
      textAlign: 'center',
    },
    feedback: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    flex: {
      flex: 1,
    },
    icon: {
      alignItems: 'center',
      borderRadius: theme.radius.pill,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    iconPass: {
      backgroundColor: colors.primary,
    },
    iconRetry: {
      backgroundColor: colors.secondary,
    },
    sheet: {
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      paddingTop: theme.spacing.lg,
      ...getStickerFace(theme, 0),
      borderBottomWidth: 0,
      borderLeftWidth: 0,
      borderRightWidth: 0,
    },
    sheetPass: {
      backgroundColor: colors.accentSoft,
    },
    sheetRetry: {
      backgroundColor: colors.secondarySoft,
    },
    titlePass: {
      color: colors.primary,
    },
    titleRetry: {
      color: colors.secondary,
    },
  });
}
