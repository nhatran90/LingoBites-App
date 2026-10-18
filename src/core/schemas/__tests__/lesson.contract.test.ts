import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {LESSON_CONTRACT_FIXTURE_SHA256} from '../fixtures';
import {
  itemCardIds,
  LESSON_CONTRACT_FIXTURE_REVISION,
  LESSON_CONTRACT_VERSION,
  LessonCatalogResponseSchema,
  LessonSnapshotResponseSchema,
} from '../lesson';

/**
 * The App lesson mirror matches the Server contract. The fixtures below are
 * byte-identical copies of the Server canonical fixtures
 * (`src/modules/canonicalLesson/model/fixtures/`), pinned by the same SHA-256
 * digests as the Server; this test fails if either side drifts.
 */
function readFixture(name: string): Buffer {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name));
}

function loadFixture(name: string): unknown {
  return JSON.parse(readFixture(name).toString('utf8'));
}

type SnapshotBody = {
  contract_version: number;
  lesson: Record<string, unknown>;
};

describe('canonical lesson contract mirror', () => {
  it('uses lesson contract version 1', () => {
    expect(LESSON_CONTRACT_VERSION).toBe(1);
    expect(LESSON_CONTRACT_FIXTURE_REVISION).toBe('backward-design-pr5');
  });

  it.each(Object.entries(LESSON_CONTRACT_FIXTURE_SHA256))(
    'keeps %s byte-identical to the Server',
    (name, digest) => {
      expect(
        crypto.createHash('sha256').update(readFixture(name)).digest('hex'),
      ).toBe(digest);
    },
  );

  it('parses the canonical snapshot fixture', () => {
    const parsed = LessonSnapshotResponseSchema.safeParse(
      loadFixture('valid-lesson-snapshot-response.json'),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.contract_version).toBe(1);
      expect(parsed.data.lesson.sentences.length).toBeGreaterThan(0);
      for (const sentence of parsed.data.lesson.sentences) {
        expect(sentence.text_en.trim()).not.toBe('');
        expect(sentence.text_vi.trim()).not.toBe('');
        expect(sentence.ipa.trim()).not.toBe('');
      }
      // Snapshot analyses are keyed by sentence row id (AD-001/AD-005).
      for (const [sentenceId, analysis] of Object.entries(
        parsed.data.lesson.analyses,
      )) {
        expect(analysis.sentence_id).toBe(sentenceId);
      }
    }
  });

  it('accepts the optional per-word IPA (ipa_words) on sentences', () => {
    const body = loadFixture('valid-lesson-snapshot-response.json') as {
      lesson: {sentences: Array<Record<string, unknown>>};
    };
    body.lesson.sentences[0]!.ipa_words = ['aɪ', null];
    if (body.lesson.sentences[1]) {
      body.lesson.sentences[1].ipa_words = null;
    }
    const parsed = LessonSnapshotResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    expect(
      parsed.success && parsed.data.lesson.sentences[0]!.ipa_words,
    ).toEqual(['aɪ', null]);
  });

  it('parses the specification fixture with items, tasks and steps', () => {
    const parsed = LessonSnapshotResponseSchema.safeParse(
      loadFixture('valid-lesson-snapshot-with-spec-response.json'),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    const lesson = parsed.data.lesson;
    expect(lesson.spec?.code).toBe('A1-DRINKS-L01');
    expect(lesson.spec?.can_do.length).toBeGreaterThan(0);
    expect(lesson.lesson_items?.length).toBeGreaterThan(0);
    const kinds = new Set(lesson.lesson_items?.map(entry => entry.item.kind));
    expect(kinds.has('pattern')).toBe(true);
    expect(lesson.tasks?.some(task => task.kind === 'independent')).toBe(true);
    expect(lesson.blocks.every(block => block.step != null)).toBe(true);

    const itemIds = new Set(lesson.lesson_items?.map(entry => entry.item.id));
    const cards = lesson.blocks.filter(block => block.type === 'item_cards');
    expect(cards.length).toBeGreaterThan(0);
    for (const block of cards) {
      expect(itemCardIds(block).every(id => itemIds.has(id))).toBe(true);
    }
  });

  it('parses the composed fixture: a learner six-step lesson (S4.3)', () => {
    const lesson = LessonSnapshotResponseSchema.parse(
      loadFixture('valid-lesson-snapshot-composed-response.json'),
    ).lesson;
    expect(lesson.origin).toBe('learner');
    expect(lesson.generated).toBe(true);
    expect(lesson.derived_from_lesson_id).toEqual(expect.any(String));
    expect(lesson.situation_source).toBe('source');
    expect(lesson.spec?.code).toBeNull();
    expect(lesson.tasks?.some(task => task.kind === 'independent')).toBe(true);
  });

  it('parses the canonical catalog fixture', () => {
    const parsed = LessonCatalogResponseSchema.safeParse(
      loadFixture('valid-lesson-catalog-response.json'),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.contract_version).toBe(1);
      expect(parsed.data.lessons.length).toBeGreaterThan(0);
      const origins = new Set(parsed.data.lessons.map(lesson => lesson.origin));
      expect(origins.has('admin')).toBe(true);
      expect(origins.has('learner')).toBe(true);
    }
  });

  it('accepts the catalog card fields code and can-do', () => {
    const body = loadFixture('valid-lesson-catalog-response.json') as {
      lessons: Record<string, unknown>[];
    };
    const parsed = LessonCatalogResponseSchema.safeParse({
      ...body,
      lessons: body.lessons.map(lesson => ({
        ...lesson,
        code: 'A1-DRINKS-L01',
        can_do: ['Tự gọi một đồ uống kèm cỡ.'],
      })),
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects the retired v2 items[] and contract version 2', () => {
    const body = loadFixture(
      'valid-lesson-snapshot-response.json',
    ) as SnapshotBody;
    const withItems = LessonSnapshotResponseSchema.safeParse({
      ...body,
      lesson: {...body.lesson, items: []},
    });
    expect(withItems.success).toBe(false);
    const v2 = LessonSnapshotResponseSchema.safeParse({
      ...body,
      contract_version: 2,
    });
    expect(v2.success).toBe(false);
  });

  it('rejects the retired vocabulary and grammar blocks', () => {
    const body = loadFixture(
      'valid-lesson-snapshot-response.json',
    ) as SnapshotBody;
    const blocks = body.lesson.blocks as Record<string, unknown>[];
    for (const type of ['vocabulary', 'grammar']) {
      const parsed = LessonSnapshotResponseSchema.safeParse({
        ...body,
        lesson: {...body.lesson, blocks: [{...blocks[0], type}]},
      });
      expect(parsed.success).toBe(false);
    }
  });

  it('rejects a contract_version mismatch instead of parsing leniently', () => {
    const body = loadFixture('valid-lesson-snapshot-response.json') as Record<
      string,
      unknown
    >;
    const parsed = LessonSnapshotResponseSchema.safeParse({
      ...body,
      contract_version: 999,
    });
    expect(parsed.success).toBe(false);
  });
});
