import {useEffect, useState} from 'react';

import {
  isPronunciationConsentOn,
  subscribePronunciationConsent,
} from '@features/speaking';

import {usePronunciationAvailable} from './usePronunciationAvailable';

/**
 * How a pack or review card offers "Nói từ":
 * - `hidden`: scoring is not offered here at all (release flag or Server
 *   off, a kid, no recorder), as for "Luyện phát âm";
 * - `locked`: offered, but the learner has not turned on "Chấm phát âm bằng
 *   máy"; the button is dimmed and opens Settings;
 * - `ready`: the learner can read the card aloud for scoring.
 */
export type SpeakWordAccess = 'hidden' | 'locked' | 'ready';

export function useSpeakWordAccess(): SpeakWordAccess {
  const available = usePronunciationAvailable();
  const [consentOn, setConsentOn] = useState(isPronunciationConsentOn);

  useEffect(
    () =>
      subscribePronunciationConsent(() =>
        setConsentOn(isPronunciationConsentOn()),
      ),
    [],
  );

  if (!available) return 'hidden';
  return consentOn ? 'ready' : 'locked';
}
