import {useEffect, useMemo, useState} from 'react';

import {useLearnerProfileStore} from '@features/onboarding';
import {loadReadingRecorder} from '@features/speaking';

import {fetchPronunciationEnabled} from './pronunciationClient';

/**
 * Pronunciation step 3: whether to offer "Luyện phát âm" at all. The Server
 * must score pronunciation, the learner must not be a kid (A11; the Server
 * refuses kids too) and the device must have a recorder. A "yes" from the
 * Server is kept for the session, so later sheets open without waiting; a
 * "no" is asked again next time.
 */

let enabledThisSession = false;

export function usePronunciationAvailable(): boolean {
  const kid = useLearnerProfileStore(
    state => state.profile?.ageGroup === 'kids',
  );
  const [enabled, setEnabled] = useState(enabledThisSession);
  const hasRecorder = useMemo(() => loadReadingRecorder() !== null, []);

  useEffect(() => {
    if (enabledThisSession) return;
    const controller = new AbortController();
    fetchPronunciationEnabled(controller.signal).then(value => {
      if (value) enabledThisSession = true;
      if (!controller.signal.aborted) setEnabled(value);
    });
    return () => controller.abort();
  }, []);

  return enabled && !kid && hasRecorder;
}

/** Tests only: forget the session's answer. */
export function resetPronunciationAvailabilityForTests(): void {
  enabledThisSession = false;
}
