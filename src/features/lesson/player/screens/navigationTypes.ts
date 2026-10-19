export type CanonicalLessonPlayerRouteParams = {
  lessonId: string;
};

/** PR 10: the six-step player of a curriculum lesson. */
export type LessonFlowPlayerRouteParams = {
  lessonId: string;
  /** Open on the lesson map ("Xem chi tiết") instead of the step to do. */
  showMap?: boolean;
};

export type LessonCreationRouteParams = {
  /** Stable id for the persisted idempotency key (one per draft). */
  submissionId: string;
  initialSource?: 'text' | 'ocr' | 'youtube';
  initialText?: string;
};

/** Lesson screens (registered on the root stack). */
export type LessonFlowParamList = {
  CanonicalLessonPlayer: CanonicalLessonPlayerRouteParams;
  LessonFlowPlayer: LessonFlowPlayerRouteParams;
  LessonCreation: LessonCreationRouteParams;
};
