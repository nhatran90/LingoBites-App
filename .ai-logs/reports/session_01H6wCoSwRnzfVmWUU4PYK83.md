# Session report: tile composer "right" stage color

## Summary
User reported that "Viết từ" never matched ("Student " vs "student"). Investigation showed the
check already normalises case and spaces (`normalizeAnswer`), and a reproduction test returned
"Chính xác!". The real confusion: on a right answer the stage was tinted with the theme's
`secondary` colors, which are coral/pink in pastelKids (and red in comic), so it looked wrong.

## Changed files
- `src/ui/components/TileComposer.tsx`: `stageRight` now uses `accentSoft` background and
  `primary` border, the same "right" colors as `StudySession`.
- `src/ui/components/__tests__/TileComposer.test.tsx`: regression test for the right/wrong
  stage colors (fails on the old code with `#fe7488`).

## New dependencies
None.

## Review carefully
- Affects every TileComposer user (WriteWordPanel, TypedEntry, FreeWritingEntry,
  ApplyExerciseCard) across all themes; worth a visual check in a non-pastel theme.
