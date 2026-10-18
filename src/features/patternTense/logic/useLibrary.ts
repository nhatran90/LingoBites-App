import {useCallback, useEffect, useState} from 'react';

import {fetchPatternLibrary, fetchTenseLibrary} from './libraryClient';
import type {LibraryTense} from './libraryModel';
import {
  readPatternLibrary,
  readTenseLibrary,
  savePatternLibrary,
  saveTenseLibrary,
  type StoredPatterns,
} from './libraryRepository';

/**
 * Vocab path P6: the pattern library and the tense map show what the device
 * keeps at once, then refresh from the Server and keep the new lists. Without
 * a network they stay on the kept lists; `offline` says the refresh failed.
 */
export type LibraryState<T> = {
  /** Null until either the device or the Server has answered. */
  data: T | null;
  loading: boolean;
  offline: boolean;
  reload: () => void;
};

function useStoredThenRemote<T>(
  readLocal: () => T | null,
  refresh: () => Promise<T | null>,
): LibraryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    try {
      const local = readLocal();
      if (local) setData(local);
    } catch {
      // A broken local copy only means waiting for the Server.
    }
    setLoading(true);
    refresh()
      .then(remote => {
        if (!alive) return;
        if (remote) {
          setData(remote);
          setOffline(false);
        } else {
          setOffline(true);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // `readLocal` and `refresh` are module functions; `attempt` re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const reload = useCallback(() => setAttempt(count => count + 1), []);
  return {data, loading, offline, reload};
}

async function refreshPatterns(): Promise<StoredPatterns | null> {
  const result = await fetchPatternLibrary();
  if (!result.ok) return null;
  try {
    savePatternLibrary(result.value, new Date());
    return readPatternLibrary();
  } catch {
    return {
      patterns: result.value.patterns.map(entry => ({
        item: entry.item,
        cefrLevel: entry.cefr_level,
        tags: entry.tags,
      })),
      functions: result.value.functions.map(entry => ({
        code: entry.code,
        labelVi: entry.label_vi,
      })),
      exams: result.value.exams.map(entry => ({
        code: entry.code,
        labelVi: entry.label_vi,
      })),
    };
  }
}

async function refreshTenses(): Promise<LibraryTense[] | null> {
  const result = await fetchTenseLibrary();
  if (!result.ok) return null;
  try {
    saveTenseLibrary(result.value, new Date());
    return readTenseLibrary();
  } catch {
    return result.value.tenses.map(entry => ({
      item: entry.item,
      time: entry.time,
      aspect: entry.aspect,
      imageUrl: entry.image_url ?? null,
    }));
  }
}

export function usePatternLibrary(): LibraryState<StoredPatterns> {
  return useStoredThenRemote(readPatternLibrary, refreshPatterns);
}

export function useTenseLibrary(): LibraryState<LibraryTense[]> {
  return useStoredThenRemote(readTenseLibrary, refreshTenses);
}
