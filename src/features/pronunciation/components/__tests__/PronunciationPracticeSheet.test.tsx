import {jest} from '@jest/globals';
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import type {ReadingRecorder} from '@features/speaking';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';
import type {PronunciationAttempt} from '@core/schemas/pronunciation';

import type {FetchReadingResult} from '../../logic/pronunciationClient';
import type {PracticeDeps} from '../../logic/usePronunciationPractice';
import {
  type PracticeItem,
  PronunciationPracticeSheet,
} from '../PronunciationPracticeSheet';

const ITEM: PracticeItem = {
  itemId: '44444444-4444-4444-8444-444444444444',
  text: 'The ship is big',
  ipa: '/ðə ʃɪp ɪz bɪɡ/',
};

const SCORED: PronunciationAttempt = {
  recording_id: '55555555-5555-4555-8555-555555555555',
  item_id: ITEM.itemId,
  status: 'scored',
  unscorable_reason: null,
  reference_text: ITEM.text,
  scores: {
    pron: 74,
    accuracy: 70,
    fluency: 88,
    completeness: 75,
    prosody: null,
  },
  words: [
    {text: 'The', accuracy: 96, error: 'none', phonemes: []},
    {
      text: 'ship',
      accuracy: 42,
      error: 'mispronunciation',
      phonemes: [
        {ipa: 'ʃ', accuracy: 88},
        {ipa: 'ɪ', accuracy: 30},
        {ipa: 'p', accuracy: 65},
      ],
    },
    {text: 'is', accuracy: 70, error: 'none', phonemes: []},
    {text: 'big', accuracy: 0, error: 'omission', phonemes: []},
    {text: null, accuracy: 0, error: 'insertion', phonemes: []},
  ],
  created_at: '2026-10-18T03:00:00.000Z',
};

function fakeRecorder() {
  return {
    startRecording: jest.fn(async (_mode: string, _id: string) => ({
      ok: true as const,
      filePath: '/recordings/take.m4a',
    })),
    stopRecording: jest.fn(async (filePath: string) => ({
      ok: true as const,
      filePath,
      durationMs: 2400,
    })),
    playRecording: jest.fn(async () => ({ok: true as const})),
    stopPlayback: jest.fn(async () => undefined),
    deleteRecordingFile: jest.fn(async () => undefined),
    readRecordingFileForUpload: jest.fn(async () => ({
      ok: true as const,
      byteSize: 2048,
      sha256: 'b'.repeat(64),
      binary: new ArrayBuffer(8),
    })),
  };
}

let recorder: ReturnType<typeof fakeRecorder>;
let consent: 'on' | 'off' | 'undecided';
let fetchReading: jest.Mock<() => Promise<FetchReadingResult>>;
let deps: Partial<PracticeDeps>;

function sheet(item: PracticeItem | null, onClose = jest.fn()) {
  return (
    <FeatureFlagProvider>
      <AppThemeProvider>
        <PronunciationPracticeSheet
          deps={deps}
          item={item}
          onClose={onClose}
          onSpeakText={onSpeak}
        />
      </AppThemeProvider>
    </FeatureFlagProvider>
  );
}

const onSpeak = jest.fn();

async function render(item: PracticeItem | null = ITEM) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(sheet(item));
  });
  return tree;
}

const find = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll(node => node.props.testID === id);

const press = async (tree: ReactTestRenderer.ReactTestRenderer, id: string) => {
  const node = find(tree, id).find(
    candidate => typeof candidate.props.onPress === 'function',
  );
  if (!node) throw new Error(`no pressable ${id}`);
  await act(async () => node.props.onPress());
};

const text = (tree: ReactTestRenderer.ReactTestRenderer) =>
  JSON.stringify(tree.toJSON());

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await act(async () => undefined);
}

beforeEach(() => {
  jest.useFakeTimers();
  recorder = fakeRecorder();
  consent = 'on';
  onSpeak.mockClear();
  fetchReading = jest.fn(async () => ({
    status: 'done' as const,
    attempt: SCORED,
  }));
  deps = {
    recorder: recorder as unknown as ReadingRecorder,
    submitReading: (async () => ({
      ok: true,
      recordingId: SCORED.recording_id,
    })) as unknown as PracticeDeps['submitReading'],
    fetchReading: fetchReading as unknown as PracticeDeps['fetchReading'],
    consent: {
      isOn: () => consent === 'on',
      shouldAsk: () => consent === 'undecided',
      set: value => {
        consent = value;
      },
    },
  };
});

afterEach(() => {
  jest.useRealTimers();
});

describe('PronunciationPracticeSheet', () => {
  it('stays closed without an item', async () => {
    const tree = await render(null);
    expect(find(tree, 'pronunciation-sheet')).toHaveLength(0);
  });

  it('shows the sentence and reads the model aloud', async () => {
    const tree = await render();
    expect(text(tree)).toContain('The ship is big');
    expect(text(tree)).toContain('/ðə ʃɪp ɪz bɪɡ/');
    await press(tree, 'pronunciation-listen');
    expect(onSpeak).toHaveBeenCalledWith('The ship is big');
    // The same "0.5×" slow reading as on word cards.
    await press(tree, 'pronunciation-listen-slow');
    expect(onSpeak).toHaveBeenLastCalledWith('The ship is big', 0.3);
  });

  it('asks for the consent naming Microsoft Azure; "later" leaves only listening', async () => {
    consent = 'undecided';
    const tree = await render();
    expect(text(tree)).toContain('Microsoft Azure Speech');
    expect(find(tree, 'pronunciation-record')).toHaveLength(0);

    await press(tree, 'pronunciation-consent-later');
    expect(consent).toBe('off');
    expect(find(tree, 'pronunciation-declined').length).toBeGreaterThan(0);
    expect(find(tree, 'pronunciation-record')).toHaveLength(0);

    await press(tree, 'pronunciation-declined-agree');
    expect(consent).toBe('on');
    expect(find(tree, 'pronunciation-record').length).toBeGreaterThan(0);
  });

  it('records, scores and shows each word by band, as "Đọc từ" does', async () => {
    const tree = await render();
    await press(tree, 'pronunciation-record');
    expect(find(tree, 'pronunciation-stop').length).toBeGreaterThan(0);
    await press(tree, 'pronunciation-stop');
    expect(find(tree, 'pronunciation-scoring').length).toBeGreaterThan(0);
    await advance(800);

    expect(find(tree, 'speak-result').length).toBeGreaterThan(0);
    expect(text(tree)).toContain('74');
    expect(find(tree, 'speak-word-0-good').length).toBeGreaterThan(0);
    expect(find(tree, 'speak-word-1-poor').length).toBeGreaterThan(0);
    expect(find(tree, 'speak-word-2-fair').length).toBeGreaterThan(0);
    expect(find(tree, 'speak-word-3-omitted').length).toBeGreaterThan(0);
    // The added word is counted, never shown as a word.
    expect(find(tree, 'speak-word-4-poor')).toHaveLength(0);
    expect(find(tree, 'speak-result-added').length).toBeGreaterThan(0);

    // A word lists its sounds.
    await press(tree, 'speak-word-1-poor');
    expect(find(tree, 'speak-sound-0-good').length).toBeGreaterThan(0);
    expect(find(tree, 'speak-sound-1-poor').length).toBeGreaterThan(0);
    expect(find(tree, 'speak-sound-2-fair').length).toBeGreaterThan(0);

    await press(tree, 'pronunciation-play-own');
    expect(recorder.playRecording).toHaveBeenCalledWith('/recordings/take.m4a');

    await press(tree, 'pronunciation-retry');
    expect(find(tree, 'pronunciation-record').length).toBeGreaterThan(0);
    expect(recorder.deleteRecordingFile).toHaveBeenCalledWith(
      '/recordings/take.m4a',
    );
  });

  it('says why a take could not be scored', async () => {
    fetchReading.mockResolvedValueOnce({
      status: 'done',
      attempt: {
        ...SCORED,
        status: 'unscorable',
        unscorable_reason: 'limit',
        scores: null,
        words: [],
      },
    });
    const tree = await render();
    await press(tree, 'pronunciation-record');
    await press(tree, 'pronunciation-stop');
    await advance(800);
    expect(text(tree)).toContain('hết lượt chấm');
    expect(find(tree, 'pronunciation-retry').length).toBeGreaterThan(0);
  });

  it('offers to check again when scoring is slow, and no retry once disabled', async () => {
    fetchReading.mockResolvedValue({status: 'pending'});
    const tree = await render();
    await press(tree, 'pronunciation-record');
    await press(tree, 'pronunciation-stop');
    await advance(33_000);
    expect(find(tree, 'pronunciation-error-slow').length).toBeGreaterThan(0);

    fetchReading.mockResolvedValue({status: 'disabled'});
    await press(tree, 'pronunciation-check-again');
    await advance(800);
    expect(find(tree, 'pronunciation-error-disabled').length).toBeGreaterThan(
      0,
    );
    expect(find(tree, 'pronunciation-retry')).toHaveLength(0);
  });

  it('closing deletes the take on the device', async () => {
    const onClose = jest.fn();
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(sheet(ITEM, onClose));
    });
    await press(tree, 'pronunciation-record');
    await press(tree, 'pronunciation-stop');
    await advance(800);

    await press(tree, 'pronunciation-sheet-close');
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(sheet(null, onClose)));
    expect(find(tree, 'pronunciation-sheet')).toHaveLength(0);
    expect(recorder.deleteRecordingFile).toHaveBeenCalledWith(
      '/recordings/take.m4a',
    );
  });
});
