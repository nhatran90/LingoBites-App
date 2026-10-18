import type {AppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import type {MemoryLevel} from '../logic/libraryModel';

/** Face and ink of a cell by how well the tense is remembered. */
export function levelColors(theme: AppTheme, level: MemoryLevel) {
  const {colors} = theme;
  switch (level) {
    case 'new':
      return {face: colors.surfaceContainer, ink: colors.text.secondary};
    case 'started':
      return {face: colors.tertiarySoft, ink: colors.text.primary};
    case 'recalling':
      return {face: colors.secondarySoft, ink: colors.text.primary};
    case 'stable':
      return {face: colors.accentSoft, ink: colors.accentInk};
  }
}

/**
 * The chip, edge and icon of a level on the tense map's picture tiles and
 * the tense's hero. A tense not yet learned has no chip. The faces are
 * opaque: the chips sit on a picture.
 */
export function levelChip(theme: AppTheme, level: MemoryLevel) {
  const {colors} = theme;
  switch (level) {
    case 'new':
      return {
        face: colors.surfaceMuted,
        ink: colors.text.secondary,
        edge: colors.surfaceHigh,
        icon: null,
      };
    case 'started':
      return {
        face: solidOver(colors.tertiarySoft, colors.surface),
        ink: colors.onTertiaryContainer,
        edge: HERO_PALETTE.sunShelf,
        icon: 'bolt' as const,
      };
    case 'recalling':
      return {
        face: solidOver(colors.secondarySoft, colors.surface),
        ink: colors.onSecondaryContainer,
        edge: HERO_PALETTE.coralShelf,
        icon: 'refresh' as const,
      };
    case 'stable':
      return {
        face: colors.accentSoft,
        ink: colors.primary,
        edge: colors.accent,
        icon: 'check_circle' as const,
      };
  }
}
