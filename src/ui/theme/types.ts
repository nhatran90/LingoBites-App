import type {ViewStyle} from 'react-native';

export type FontWeight = '400' | '500' | '600' | '700' | '800';

export type TypographyPreset = {
  fontSize: number;
  lineHeight: number;
  fontWeight: FontWeight;
  /** Ceiling for RN's `allowFontScaling` — see docs/implementation-notes/font-scaling-policy.notes.md. */
  maxFontSizeMultiplier: number;
};

export type ColorScale = {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceLow: string;
  surfaceContainer: string;
  surfaceHigh: string;
  border: string;
  outline: string;
  outlineVariant: string;
  primary: string;
  primaryPressed: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  secondaryContainer: string;
  secondarySoft: string;
  onSecondaryContainer: string;
  tertiary: string;
  tertiaryContainer: string;
  tertiaryFixed: string;
  tertiarySoft: string;
  onTertiaryContainer: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  danger: string;
  /** Hard outline/shadow color for sticker-style surfaces (dark ink on light themes, light on dark). */
  ink: string;
  /** Translucent white "glass" highlight over solid brand-colored surfaces. */
  overlayLight: string;
  /** Dark scrim behind captions/text overlaid on arbitrary photos. */
  overlay: string;
  /** Text color drawn on top of `overlay`. */
  onOverlay: string;
  /** Border for tertiary-tinted callouts (deeper alpha than tertiarySoft). */
  tertiaryBorder: string;
  text: {
    primary: string;
    secondary: string;
    inverse: string;
    muted: string;
  };
};

export type SixStep = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
};

/**
 * 7-step spacing scale matching `design/app.css` (4/8/12/16/24/32/48).
 * `xxl` is 32 and the legacy 48 value moved to `xxxl` so existing
 * `xxl` call sites had to opt into `xxxl` explicitly (see pastelKids
 * handoff notes) instead of silently shrinking.
 */
export type SpacingScale = SixStep & {
  xxxl: number;
};

export type RadiusScale = {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  pill: number;
};

export type ShadowScale = {
  soft: ViewStyle;
  medium: ViewStyle;
  strong: ViewStyle;
  [key: string]: ViewStyle;
};

export type ShelfScale = {
  surface: {height: number; color: string};
  accent: {height: number; color: string};
  coral: {height: number; color: string};
  primary: {height: number; color: string};
  ghost: {height: number; color: string};
  /** Edge under AppButton's `outline` and `secondary` variants. */
  outline: {height: number; color: string};
  secondary: {height: number; color: string};
  chipTeal: {height: number; color: string};
  chipYellow: {height: number; color: string};
  chipPink: {height: number; color: string};
  iconButton: {height: number; color: string};
  tabBar: {height: number; color: string};
};

export type AppTheme = {
  id: string;
  name: string;
  colors: ColorScale;
  states: {disabledOpacity: number; pressedOpacity: number};
  typography: {
    fontFamily: {primary?: string; display?: string};
    size: SixStep;
    weight: {regular: '400'; medium: '600'; bold: FontWeight};
    presets: {
      display: TypographyPreset;
      h1: TypographyPreset;
      h2: TypographyPreset;
      h3: TypographyPreset;
      title: TypographyPreset;
      subtitle: TypographyPreset;
      bodyLg: TypographyPreset;
      body: TypographyPreset;
      label: TypographyPreset;
      caption: TypographyPreset;
    };
  };
  gutter: number;
  spacing: SpacingScale;
  radius: RadiusScale;
  shadow: ShadowScale;
  shelf?: ShelfScale;
  components: {
    button: Record<
      string,
      {
        background: string;
        text: string;
        border?: string;
        height: number;
        radius: number;
        shadow?: string;
      }
    >;
    card: {
      background: string;
      radius: number;
      padding: number;
      shadow: string;
    };
    input: {
      background: string;
      text: string;
      placeholder: string;
      border: string;
      radius: number;
    };
  };
};
