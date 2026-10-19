import React from 'react';
import {Alert} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
import {openDatabase as open} from '@core/db/sqlite';
import {validFullOutput} from '@core/fixtures';
import {FeatureFlagProvider} from '@core/release';

import {CORE_WITH_REVIEW, makeTestReleaseConfig} from '@test/support';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {saveFlashcard} from '../../logic/FlashcardRepository';
import * as FlashcardRepository from '../../logic/FlashcardRepository';
import {DailyReviewScreen} from '../DailyReviewScreen';

const renderedTrees: ReactTestRenderer.ReactTestRenderer[] = [];

function navigation() {
  return {
    goBack: jest.fn(),
    navigate: jest.fn(),
    popToTop: jest.fn(),
  };
}

async function renderScreen(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(CORE_WITH_REVIEW)}
      >
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
    await Promise.resolve();
  });
  renderedTrees.push(tree);
  return tree;
}

function revealCard(tree: ReactTestRenderer.ReactTestRenderer) {
  return act(async () => {
    const flipCard = tree.root.find(
      node =>
        node.props.testID === 'daily-review-flip-card' &&
        typeof node.props.onPress === 'function',
    );
    flipCard.props.onPress();
  });
}

function seedCards(count: number) {
  const lessonId = `review-lesson-${count}`;

  return Array.from({length: count}, (_, index) => {
    const vocab = {
      ...validFullOutput.vocabulary[0],
      id: `review-word-${count}-${index}`,
      word: `word-${index + 1}`,
      meaning_vi: `meaning-${index + 1}`,
    };
    const result = saveFlashcard({
      lessonId,
      vocabulary: vocab,
      now: '2026-08-17T00:00:00.000Z',
    });
    if (!result.ok) {
      throw new Error('Could not seed flashcard');
    }
    return result.flashcardId;
  });
}

describe('DailyReviewScreen', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
  });

  afterEach(() => {
    renderedTrees.splice(0).forEach(tree => {
      act(() => {
        tree.unmount();
      });
    });
    jest.restoreAllMocks();
  });

  it('uses the session snapshot size for progress and shows carry-over at the soft cap', async () => {
    seedCards(7);
    const nav = navigation();

    const tree = await renderScreen(
      <DailyReviewScreen navigation={nav as never} softCap={5} />,
    );

    const progress = tree.root.findByProps({testID: 'review-progress'});
    expect(progress.findAllByProps({children: '1/5'}).length).toBeGreaterThan(
      0,
    );
    expect(
      progress.findAllByProps({accessibilityRole: 'progressbar'}).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({children: 'còn 2 thẻ để dành lần ôn sau'})
        .length,
    ).toBeGreaterThan(0);
  });

  it('lets the learner write the word before flipping, then rate it', async () => {
    seedCards(1);
    const tree = await renderScreen(
      <DailyReviewScreen navigation={navigation() as never} softCap={5} />,
    );

    await act(async () => {
      tree.root.findByProps({testID: 'review-practice-write'}).props.onPress();
    });
    expect(
      tree.root.findByProps({testID: 'review-write-meaning'}).props.children,
    ).toBe('meaning-1');
    expect(
      tree.root.findAllByProps({testID: 'review-swipe-card'}),
    ).toHaveLength(0);
    // While writing, the card's own buttons are gone: only the panel's.
    for (const testID of [
      'rating-reveal',
      'rating-remembered',
      'rating-forgot',
      'rating-skip',
      'review-practice-write',
    ]) {
      expect(tree.root.findAllByProps({testID})).toHaveLength(0);
    }
    const input = tree.root.find(
      node =>
        node.props.testID === 'review-write-input' &&
        typeof node.props.onChangeText === 'function',
    );
    await act(async () => input.props.onChangeText('word-1'));
    await act(async () => {
      tree.root.findByProps({testID: 'review-write-check'}).props.onPress();
    });
    expect(
      tree.root.findByProps({testID: 'review-write-verdict'}).props.children,
    ).toBe('Chính xác!');
    await act(async () => {
      tree.root.findByProps({testID: 'review-write-done'}).props.onPress();
    });
    expect(tree.root.findAllByProps({testID: 'review-practice-write'})).toHaveLength(
      0,
    );
    await act(async () => {
      tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
    });
    expect(tree.root.findByProps({testID: 'review-summary'})).toBeTruthy();
  });

  it('skips through the session and renders the completion summary', async () => {
    seedCards(2);
    const nav = navigation();
    const tree = await renderScreen(
      <DailyReviewScreen navigation={nav as never} softCap={5} />,
    );

    await revealCard(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
    });
    await revealCard(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'rating-skip'}).props.onPress();
    });

    expect(tree.root.findByProps({testID: 'review-summary'})).toBeTruthy();
    expect(
      tree.root.findByProps({testID: 'summary-reviewed-count'}).props.children,
    ).toBe(2);
    expect(
      tree.root.findByProps({testID: 'summary-remembered-count'}).props
        .children,
    ).toBe(1);
    expect(
      tree.root.findByProps({testID: 'summary-forgot-count'}).props.children,
    ).toBe(0);
  });

  it('shows distinct empty copy when no flashcards have ever been saved', async () => {
    const tree = await renderScreen(
      <DailyReviewScreen navigation={navigation() as never} />,
    );

    expect(
      tree.root.findAllByProps({
        children: 'Lưu flashcard đầu tiên để bắt đầu ôn mỗi ngày.',
      }).length,
    ).toBeGreaterThan(0);
  });

  it('shows distinct empty copy when all cards are done for today', async () => {
    seedCards(1);
    const tree = await renderScreen(
      <DailyReviewScreen navigation={navigation() as never} />,
    );

    await revealCard(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
    });

    expect(tree.root.findByProps({testID: 'review-summary'})).toBeTruthy();

    const secondTree = await renderScreen(
      <DailyReviewScreen navigation={navigation() as never} />,
    );

    expect(
      secondTree.root.findAllByProps({
        children: 'Bạn đã ôn xong tất cả thẻ đến hạn hôm nay.',
      }).length,
    ).toBeGreaterThan(0);
  });

  it('renders the carry-over count on the summary when the soft cap leaves cards behind', async () => {
    seedCards(3);
    const tree = await renderScreen(
      <DailyReviewScreen navigation={navigation() as never} softCap={2} />,
    );

    await revealCard(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
    });
    await revealCard(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
    });

    expect(tree.root.findByProps({testID: 'review-summary'})).toBeTruthy();
    expect(
      tree.root.findAllByProps({children: 'còn 1 thẻ để dành lần ôn sau'})
        .length,
    ).toBeGreaterThan(0);
  });

  it('returns home from the summary with popToTop only, without a stray goBack', async () => {
    seedCards(1);
    const nav = navigation();
    const tree = await renderScreen(
      <DailyReviewScreen navigation={nav as never} />,
    );

    await revealCard(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
    });
    await act(async () => {
      tree.root
        .find(
          node =>
            node.props.accessibilityLabel === 'Quay về Home' &&
            typeof node.props.onPress === 'function',
        )
        .props.onPress();
    });

    expect(nav.popToTop).toHaveBeenCalledTimes(1);
    expect(nav.goBack).not.toHaveBeenCalled();
  });

  it('exits without confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    seedCards(1);
    const nav = navigation();
    const tree = await renderScreen(
      <DailyReviewScreen navigation={nav as never} />,
    );

    await act(async () => {
      tree.root.findByProps({testID: 'review-close'}).props.onPress();
    });

    // First card, no answers given: nothing at stake, no prompt (SETE-255).
    expect(alertSpy).not.toHaveBeenCalled();
    expect(nav.goBack).toHaveBeenCalledTimes(1);
  });

  it('confirms before exiting when rated progress would be lost (SETE-255)', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    seedCards(2);
    const nav = navigation();
    const tree = await renderScreen(
      <DailyReviewScreen navigation={nav as never} />,
    );

    await revealCard(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({testID: 'review-close'}).props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      'Thoát buổi ôn tập?',
      'Tiến độ 1/2 sẽ không được lưu.',
      expect.arrayContaining([
        expect.objectContaining({text: 'Huỷ', style: 'cancel'}),
        expect.objectContaining({text: 'Thoát', style: 'destructive'}),
      ]),
    );
    expect(nav.goBack).not.toHaveBeenCalled();

    const quitButton = (
      alertSpy.mock.calls[0][2] as Array<{
        text: string;
        style?: string;
        onPress?: () => void;
      }>
    ).find(button => button.style === 'destructive');
    await act(async () => {
      quitButton?.onPress?.();
    });

    expect(nav.goBack).toHaveBeenCalledTimes(1);
  });

  it('stays in the session when the exit confirmation is cancelled', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    seedCards(2);
    const nav = navigation();
    const tree = await renderScreen(
      <DailyReviewScreen navigation={nav as never} />,
    );

    await revealCard(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({testID: 'review-close'}).props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const stayButton = (
      alertSpy.mock.calls[0][2] as Array<{
        text: string;
        style?: string;
        onPress?: () => void;
      }>
    ).find(button => button.style === 'cancel');
    await act(async () => {
      stayButton?.onPress?.();
    });

    expect(nav.goBack).not.toHaveBeenCalled();
    // Still mid-session on the second card.
    expect(
      tree.root
        .findByProps({testID: 'review-progress'})
        .findAllByProps({children: '2/2'}).length,
    ).toBeGreaterThan(0);
  });

  it('shows only the reveal action until the card is revealed', async () => {
    seedCards(1);
    const tree = await renderScreen(
      <DailyReviewScreen navigation={navigation() as never} />,
    );

    expect(
      tree.root.findAllByProps({testID: 'rating-remembered'}),
    ).toHaveLength(0);
    expect(tree.root.findAllByProps({testID: 'rating-forgot'})).toHaveLength(0);

    await act(async () => {
      tree.root.findByProps({testID: 'rating-reveal'}).props.onPress();
    });

    expect(tree.root.findAllByProps({testID: 'rating-reveal'})).toHaveLength(0);
    expect(
      tree.root.findByProps({testID: 'rating-remembered'}).props.disabled,
    ).toBe(false);
    expect(
      tree.root.findByProps({testID: 'rating-forgot'}).props.disabled,
    ).toBe(false);
  });

  it('rates by swiping once revealed: right = remembered, left = forgot', async () => {
    seedCards(2);
    const tree = await renderScreen(
      <DailyReviewScreen navigation={navigation() as never} />,
    );
    const swipe = (direction: 'left' | 'right') =>
      act(async () => {
        tree.root
          .findByProps({testID: 'review-swipe-card'})
          .props.onSwipe(direction);
      });

    await revealCard(tree);
    await swipe('right');
    await revealCard(tree);
    await swipe('left');

    expect(
      tree.root.findByProps({testID: 'summary-remembered-count'}).props
        .children,
    ).toBe(1);
    expect(
      tree.root.findByProps({testID: 'summary-forgot-count'}).props.children,
    ).toBe(1);
  });

  it('shows the translated error and does not advance when rating persistence fails', async () => {
    seedCards(1);
    const tree = await renderScreen(
      <DailyReviewScreen navigation={navigation() as never} />,
    );

    await revealCard(tree);

    const failure: {
      ok: false;
      errorCode: 'LOCAL_DB_ERROR';
      message: string;
    } = {
      ok: false,
      errorCode: 'LOCAL_DB_ERROR',
      message: 'Không thể lưu kết quả ôn tập. Vui lòng thử lại.',
    };
    const spy = jest
      .spyOn(FlashcardRepository, 'recordFlashcardRating')
      .mockReturnValue(failure);

    await act(async () => {
      tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const progress = tree.root.findByProps({testID: 'review-progress'});
    expect(progress.findAllByProps({children: '1/1'}).length).toBeGreaterThan(
      0,
    );
    expect(tree.root.findAllByProps({testID: 'review-summary'})).toHaveLength(
      0,
    );
    expect(
      tree.root.findAllByProps({
        children: 'Không thể lưu kết quả ôn tập. Vui lòng thử lại.',
      }).length,
    ).toBeGreaterThan(0);

    spy.mockRestore();

    await act(async () => {
      tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
    });

    expect(tree.root.findByProps({testID: 'review-summary'})).toBeTruthy();
    expect(
      tree.root.findByProps({testID: 'summary-reviewed-count'}).props.children,
    ).toBe(1);
  });

  it('shows an English-only prompt on the front and the Vietnamese answer on the back (SETE-253)', async () => {
    seedCards(1);
    const tree = await renderScreen(
      <DailyReviewScreen navigation={navigation() as never} />,
    );

    const frontTexts = tree.root
      .findByProps({testID: 'review-card-front'})
      .findAll(node => typeof node.props?.children === 'string')
      .map(node => node.props.children as string);
    expect(frontTexts).toContain('word-1');
    expect(frontTexts.join('\n')).not.toContain('meaning-1');
    expect(tree.root.findByProps({testID: 'review-speak-front'})).toBeTruthy();
    expect(
      tree.root.findAllByProps({children: 'Nhấn để xem nghĩa'}).length,
    ).toBeGreaterThan(0);

    await revealCard(tree);

    const backTexts = tree.root
      .findByProps({testID: 'review-card-back'})
      .findAll(node => typeof node.props?.children === 'string')
      .map(node => node.props.children as string);
    expect(backTexts).toContain('meaning-1');
    expect(backTexts).toContain('word-1');
    expect(backTexts.join('\n')).not.toBe(frontTexts.join('\n'));
    expect(tree.root.findByProps({testID: 'review-speak-back'})).toBeTruthy();
  });

  it('falls back to the sentence a word was found in when it has no curated example', async () => {
    const saved = saveFlashcard({
      lessonId: 'review-lesson-context',
      vocabulary: {
        ...validFullOutput.vocabulary[0],
        id: 'review-word-context',
        word: 'brew',
        meaning_vi: 'pha',
        example: undefined,
        example_translation: 'bản dịch của ví dụ',
        source_sentence: 'I brew coffee every morning.',
      },
      now: '2026-08-17T00:00:00.000Z',
    });
    expect(saved.ok).toBe(true);
    const tree = await renderScreen(
      <DailyReviewScreen navigation={navigation() as never} />,
    );
    await revealCard(tree);

    const back = tree.root.findByProps({testID: 'review-card-back'});
    const texts = back
      .findAll(node => typeof node.props?.children === 'string')
      .map(node => node.props.children as string);
    expect(texts).toContain('I brew coffee every morning.');
    // The example translation belongs to the example, not to the sentence.
    expect(texts).not.toContain('bản dịch của ví dụ');
  });
});
