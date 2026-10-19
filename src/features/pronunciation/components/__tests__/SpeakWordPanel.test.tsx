import {jest} from '@jest/globals';
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import type {ReadingRecorder} from '@features/speaking';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';
import type {PronunciationAttempt} from '@core/schemas/pronunciation';

import type {FetchReadingResult} from '../../logic/pronunciationClient';
import type {ReadingTarget} from '../../logic/readingTarget';
import type {PracticeDeps} from '../../logic/usePronunciationPractice';
import {SpeakWordButton} from '../SpeakWordButton';
import {SpeakWordPanel} from '../SpeakWordPanel';

const WORD: PronunciationAttempt = {
  recording_id: '55555555-5555-4555-8555-555555555555',
  item_id: null,
  status: 'scored',
  unscorable_reason: null,
  reference_text: 'schedule',
  scores: {
    pron: 72,
    accuracy: 70,
    fluency: 88,
    completeness: 100,
    prosody: null,
  },
  words: [
    {
      text: 'schedule',
      accuracy: 72,
      error: 'none',
      phonemes: [
        {ipa: 's', accuracy: 92},
        {ipa: 'k', accuracy: 88},
        {ipa: 'e', accuracy: 74},
        {ipa: 'dʒ', accuracy: 41},
      ],
    },
  ],
  created_at: '2026-10-18T03:00:00.000Z',
};

const SENTENCE: PronunciationAttempt = {
  ...WORD,
  reference_text: 'send me the report',
  scores: {
    pron: 64,
    accuracy: 66,
    fluency: 70,
    completeness: 75,
    prosody: null,
  },
  words: [
    {
      text: 'send',
      accuracy: 52,
      error: 'mispronunciation',
      phonemes: [
        {ipa: 's', accuracy: 88},
        {ipa: 'd', accuracy: 31},
      ],
    },
    {
      text: 'me',
      accuracy: 82,
      error: 'none',
      phonemes: [{ipa: 'm', accuracy: 85}],
    },
    {text: 'the', accuracy: 0, error: 'omission', phonemes: []},
    {
      text: 'report',
      accuracy: 68,
      error: 'none',
      phonemes: [{ipa: 'r', accuracy: 68}],
    },
  ],
};

const TARGET: ReadingTarget = {
  source: 'review_word',
  referenceText: 'schedule',
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
      durationMs: 1800,
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
let submitReading: jest.Mock;
let attempt: PronunciationAttempt;
let deps: Partial<PracticeDeps>;
const onSpeak = jest.fn();
const onDone = jest.fn();

async function render(text = 'schedule') {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <SpeakWordPanel
            deps={deps}
            ipa="/ˈskedʒ.uːl/"
            meaningVi="lịch trình"
            onDone={onDone}
            onSpeak={onSpeak}
            target={TARGET}
            text={text}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
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

async function recordAndScore(tree: ReactTestRenderer.ReactTestRenderer) {
  await press(tree, 'speak-word-record');
  await press(tree, 'speak-word-stop');
  await act(async () => {
    jest.advanceTimersByTime(800);
  });
  await act(async () => undefined);
}

beforeEach(() => {
  jest.useFakeTimers();
  recorder = fakeRecorder();
  attempt = WORD;
  onSpeak.mockClear();
  onDone.mockClear();
  submitReading = jest.fn(async () => ({
    ok: true,
    recordingId: WORD.recording_id,
  }));
  deps = {
    recorder: recorder as unknown as ReadingRecorder,
    submitReading: submitReading as unknown as PracticeDeps['submitReading'],
    fetchReading: (async (): Promise<FetchReadingResult> => ({
      status: 'done',
      attempt,
    })) as unknown as PracticeDeps['fetchReading'],
    consent: {isOn: () => true, shouldAsk: () => false, set: () => undefined},
  };
});

afterEach(() => {
  jest.useRealTimers();
});

describe('SpeakWordPanel', () => {
  it('shows the card to read and its model', async () => {
    const tree = await render();
    expect(text(tree)).toContain('Đọc to từ này');
    expect(text(tree)).toContain('/ˈskedʒ.uːl/ · lịch trình');
    expect(text(tree)).toContain('Đọc to từ này, tối đa 15 giây.');
    await press(tree, 'speak-word-listen');
    expect(onSpeak).toHaveBeenCalledWith('schedule');
  });

  it('sends the take for its target and shows the weakest sound first', async () => {
    const tree = await render();
    await recordAndScore(tree);
    expect(submitReading).toHaveBeenCalledWith(
      expect.objectContaining({target: TARGET, durationMs: 1800}),
    );

    expect(find(tree, 'speak-result-score-fair').length).toBeGreaterThan(0);
    expect(find(tree, 'speak-result-weakest').length).toBeGreaterThan(0);
    expect(text(tree)).toContain('/dʒ/');
    expect(text(tree)).toContain('Cần sửa nhất');
    expect(text(tree)).toContain('Còn 2 âm cần sửa.');
    expect(find(tree, 'speak-sound-0-good').length).toBeGreaterThan(0);
    expect(find(tree, 'speak-sound-2-fair').length).toBeGreaterThan(0);
    expect(find(tree, 'speak-sound-3-poor').length).toBeGreaterThan(0);

    await press(tree, 'speak-result-listen-slow');
    expect(onSpeak).toHaveBeenLastCalledWith('schedule', 0.3);
  });

  it('lets a sentence be read word by word, with left-out words marked', async () => {
    attempt = SENTENCE;
    const tree = await render('send me the report');
    await recordAndScore(tree);

    expect(text(tree)).toContain('1 từ cần sửa, 1 từ chưa đọc.');
    expect(find(tree, 'speak-word-2-omitted').length).toBeGreaterThan(0);
    // The word holding the weakest sound opens first.
    expect(text(tree)).toContain('Các âm trong “send”');
    await press(tree, 'speak-word-3-fair');
    expect(text(tree)).toContain('Các âm trong “report”');
    await press(tree, 'speak-word-2-omitted');
    expect(find(tree, 'speak-sounds-omitted').length).toBeGreaterThan(0);
  });

  it('tries again with a new take, and goes back to the card when done', async () => {
    const tree = await render();
    await recordAndScore(tree);
    await press(tree, 'speak-word-retry');
    expect(find(tree, 'speak-word-record').length).toBeGreaterThan(0);
    expect(recorder.deleteRecordingFile).toHaveBeenCalled();
    await press(tree, 'speak-word-cancel');
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('SpeakWordButton', () => {
  async function button(locked: boolean, label = 'schedule') {
    const onPress = jest.fn();
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider>
          <AppThemeProvider>
            <SpeakWordButton
              locked={locked}
              onPress={onPress}
              testID="speak"
              text={label}
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });
    return {tree, onPress};
  }

  it('reads "Đọc từ" for a word and a phrase alike', async () => {
    expect(text((await button(false)).tree)).toContain('Đọc từ');
    expect(text((await button(false, 'look after')).tree)).toContain('Đọc từ');
  });

  it('says why it is locked and still answers a press (to open Settings)', async () => {
    const {tree, onPress} = await button(true);
    expect(find(tree, 'speak-locked').length).toBeGreaterThan(0);
    expect(text(tree)).toContain('Chưa bật “Chấm phát âm bằng máy”');
    await press(tree, 'speak');
    expect(onPress).toHaveBeenCalledTimes(1);

    const open = await button(false);
    expect(find(open.tree, 'speak-locked')).toHaveLength(0);
  });
});
