import {act} from 'react-test-renderer';

import {comboSituationsAvailable} from '@features/combo';

import type {CatalogItem} from '@core/schemas/lesson';

import {mockAppNavigation} from '@test/support/appNavigationMock';
import {has, press, renderWithTheme, textOf} from '@test/support/lessonFlow';

import {
  findDownloadedPack,
  listDownloadedPacks,
  saveWordPack,
} from '../../logic/wordPackRepository';
import {
  fetchWordPack,
  fetchWordPath,
  type WordPath,
} from '../../logic/wordPathClient';
import {WordPackScreen} from '../WordPackScreen';
import {WordPathList} from '../WordPathScreen';

/** Vocab path P5: the word path list splits word and sentence packs and shows what each teaches; a pack shows its summary first. */

jest.mock('../../logic/wordPathClient', () => ({
  fetchWordPath: jest.fn(),
  fetchWordPack: jest.fn(),
}));

jest.mock('../../logic/wordPackRepository', () => ({
  findDownloadedPack: jest.fn(() => null),
  learnedCodes: jest.fn(() => new Set()),
  learnedCount: jest.fn(() => 0),
  listDownloadedPacks: jest.fn(() => []),
  removeDownloadedPacks: jest.fn(),
  saveWordPack: jest.fn(),
}));

jest.mock('@features/combo', () => ({
  comboSituationsAvailable: jest.fn(),
}));

jest.mock('@core/db/catalogItems', () => ({
  readCatalogItems: jest.fn(() => new Map()),
}));

const mockPath = fetchWordPath as jest.MockedFunction<typeof fetchWordPath>;
const mockPack = fetchWordPack as jest.MockedFunction<typeof fetchWordPack>;

const WORD_PACK = '00000000-0000-4000-8000-00000000000a';
const SENTENCE_PACK = '00000000-0000-4000-8000-00000000000b';

const path: WordPath = {
  request_id: 'r',
  status: 'success',
  levels: [
    {
      cefr_level: 'A1',
      topics: [
        {
          topic_code: null,
          title_vi: 'chung',
          packs: [
            {
              id: WORD_PACK,
              position: 1,
              title_vi: 'Gói A1 · chung 1',
              item_count: 12,
              kind_counts: {word: 12, phrase: 0, pattern: 0, grammar: 0},
              preview: [
                {text: 'hello', meaning_vi: 'xin chào'},
                {text: 'tea', meaning_vi: 'trà'},
              ],
            },
            {
              id: SENTENCE_PACK,
              position: 2,
              title_vi: 'Gói A1 · chung 2',
              item_count: 10,
              kind_counts: {word: 2, phrase: 5, pattern: 3, grammar: 0},
              preview: [{text: 'The bill, please.', meaning_vi: 'Tính tiền.'}],
            },
          ],
        },
      ],
    },
  ],
};

function word(code: string, text: string, kind: CatalogItem['kind']) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    code,
    kind,
    text,
    meaning_vi: `nghĩa ${text}`,
    ipa: null,
    part_of_speech: null,
    note_vi: null,
    audience: 'all',
    payload: {},
    audio: null,
    image: null,
    examples: [],
    variants: [],
    errors: [],
  } as CatalogItem;
}

async function renderList() {
  const tree = renderWithTheme(<WordPathList />);
  await act(async () => {
    await Promise.resolve();
  });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPath.mockResolvedValue({ok: true, value: path});
});

describe('WordPathList', () => {
  it('shows word packs first, with what they teach and their status', async () => {
    const tree = await renderList();
    expect(has(tree, `word-path-pack-${WORD_PACK}`)).toBe(true);
    expect(has(tree, `word-path-pack-${SENTENCE_PACK}`)).toBe(false);
    expect(textOf(tree, `word-path-pack-${WORD_PACK}-description`)).toBe(
      '12 từ',
    );
    expect(textOf(tree, `word-path-pack-${WORD_PACK}-level`)).toBe('A1');
    expect(textOf(tree, `word-path-pack-${WORD_PACK}-status`)).toBe('CHƯA TẢI');
    expect(has(tree, `word-path-section-A1-not_downloaded`)).toBe(true);
    expect(has(tree, 'word-path-next')).toBe(false);
  });

  it('shows one level at a time, picked from the level buttons', async () => {
    const A2_PACK = '00000000-0000-4000-8000-00000000000c';
    mockPath.mockResolvedValue({
      ok: true,
      value: {
        ...path,
        levels: [
          ...path.levels,
          {
            cefr_level: 'A2',
            topics: [
              {
                topic_code: null,
                title_vi: 'chung',
                packs: [
                  {
                    id: A2_PACK,
                    position: 1,
                    title_vi: 'Gói A2 · chung 1',
                    item_count: 8,
                    kind_counts: {word: 8, phrase: 0, pattern: 0, grammar: 0},
                    preview: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const tree = await renderList();
    expect(has(tree, 'word-path-level-A1')).toBe(true);
    expect(has(tree, 'word-path-level-A2')).toBe(false);
    expect(textOf(tree, 'word-path-level-tab-A2')).toBe('A20/1');
    press(tree, 'word-path-level-tab-A2');
    expect(has(tree, 'word-path-level-A1')).toBe(false);
    expect(has(tree, `word-path-pack-${A2_PACK}`)).toBe(true);
  });

  it('switches to sentence packs', async () => {
    const tree = await renderList();
    press(tree, 'word-path-tab-sentence');
    expect(has(tree, `word-path-pack-${SENTENCE_PACK}`)).toBe(true);
    expect(has(tree, `word-path-pack-${WORD_PACK}`)).toBe(false);
    expect(
      textOf(tree, `word-path-pack-${SENTENCE_PACK}-description`),
    ).toContain('5 cụm từ');
  });

  it('downloads a pack that is not on the device, then opens it', async () => {
    mockPack.mockResolvedValue({
      ok: true,
      value: {
        request_id: 'r',
        status: 'success',
        pack: {
          id: WORD_PACK,
          cefr_level: 'A1',
          topic_code: null,
          position: 1,
          title_vi: 'Gói A1 · chung 1',
        },
        items: [],
      },
    });
    const tree = await renderList();
    await act(async () => {
      press(tree, `word-path-pack-${WORD_PACK}`);
    });
    expect(mockPack).toHaveBeenCalledWith(WORD_PACK);
    expect(saveWordPack).toHaveBeenCalled();
    expect(mockAppNavigation.openWordPack).toHaveBeenCalledWith(WORD_PACK);
  });

  it('opens a downloaded pack straight away', async () => {
    (listDownloadedPacks as jest.Mock).mockReturnValue([
      {
        packId: WORD_PACK,
        cefrLevel: 'A1',
        topicCode: null,
        position: 1,
        titleVi: 'Gói A1 · chung 1',
        itemCodes: [],
        downloadedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const tree = await renderList();
    expect(textOf(tree, `word-path-pack-${WORD_PACK}-status`)).toBe('ĐÃ TẢI');
    expect(has(tree, `word-path-section-A1-ready`)).toBe(true);
    press(tree, `word-path-pack-${WORD_PACK}`);
    expect(mockPack).not.toHaveBeenCalled();
    expect(mockAppNavigation.openWordPack).toHaveBeenCalledWith(WORD_PACK);
    (listDownloadedPacks as jest.Mock).mockReturnValue([]);
  });
});

describe('WordPackScreen', () => {
  const items = [
    word('word:hello', 'hello', 'word'),
    word('word:tea', 'tea', 'word'),
    word('phrase:bill', 'The bill, please.', 'phrase'),
  ];

  const mockSituations = comboSituationsAvailable as jest.MockedFunction<
    typeof comboSituationsAvailable
  >;

  it('shows the summary, counts and which items are learned', async () => {
    mockSituations.mockResolvedValue('ok');
    (findDownloadedPack as jest.Mock).mockReturnValue({
      packId: WORD_PACK,
      cefrLevel: 'A1',
      topicCode: null,
      position: 1,
      titleVi: 'Gói A1 · chung 1',
      itemCodes: items.map(entry => entry.code),
      downloadedAt: '2026-01-01T00:00:00.000Z',
    });
    const tree = renderWithTheme(
      <WordPackScreen
        items={items}
        learned={['word:hello']}
        route={{params: {packId: WORD_PACK}}}
      />,
    );
    expect(textOf(tree, 'word-pack-summary')).toContain('Gói 1');
    expect(textOf(tree, 'word-pack-summary')).toContain('2 từ · 1 cụm từ');
    expect(textOf(tree, 'word-pack-kind')).toBe('Gói từ');
    expect(textOf(tree, 'word-pack-learned-count')).toBe('1');
    expect(has(tree, 'word-pack-learned-word:hello')).toBe(true);
    expect(has(tree, 'word-pack-new-word:tea')).toBe(true);

    press(tree, 'word-pack-learn');
    expect(mockAppNavigation.openPackLearn).toHaveBeenCalledWith(WORD_PACK);
    await act(async () => {
      press(tree, 'word-pack-combo-word:tea');
    });
    expect(mockSituations).toHaveBeenCalledWith('word:tea');
    expect(mockAppNavigation.openComboSetup).toHaveBeenCalledWith('word:tea');
    expect(has(tree, 'word-pack-combo-notice-word:tea')).toBe(false);
  });

  it('stays on the pack and says so when no situation fits the item', async () => {
    mockSituations.mockResolvedValue('none');
    mockAppNavigation.openComboSetup.mockClear();
    const tree = renderWithTheme(
      <WordPackScreen items={items} route={{params: {packId: WORD_PACK}}} />,
    );
    await act(async () => {
      press(tree, 'word-pack-combo-word:tea');
    });
    expect(mockAppNavigation.openComboSetup).not.toHaveBeenCalled();
    expect(textOf(tree, 'word-pack-combo-notice-word:tea')).toBe(
      'Chưa có tình huống phù hợp với từ này.',
    );
    expect(has(tree, 'word-pack-combo-notice-word:hello')).toBe(false);
  });

  it('stays on the pack and asks to retry when the check fails', async () => {
    mockSituations.mockResolvedValue('error');
    mockAppNavigation.openComboSetup.mockClear();
    const tree = renderWithTheme(
      <WordPackScreen items={items} route={{params: {packId: WORD_PACK}}} />,
    );
    await act(async () => {
      press(tree, 'word-pack-combo-word:hello');
    });
    expect(mockAppNavigation.openComboSetup).not.toHaveBeenCalled();
    expect(textOf(tree, 'word-pack-combo-notice-word:hello')).toBe(
      'Chưa kiểm tra được tình huống. Hãy thử lại.',
    );
  });

  it('offers a review and no quick check once every item is learned', () => {
    const tree = renderWithTheme(
      <WordPackScreen
        items={items}
        learned={items.map(entry => entry.code)}
        route={{params: {packId: WORD_PACK}}}
      />,
    );
    expect(has(tree, 'word-pack-check')).toBe(false);
    expect(has(tree, 'word-pack-learn')).toBe(true);
  });
});
