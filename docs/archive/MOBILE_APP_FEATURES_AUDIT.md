> **Lưu trữ:** mô tả bản cũ, không còn đúng với code hiện tại. Xem [`architecture/feature-map.md`](../architecture/feature-map.md).

# Báo Cáo Tổng Hợp Tính Năng & Tiến Độ Mobile App React Native (LingoBites-App)

Dưới đây là kết quả review, audit toàn diện toàn bộ mã nguồn, các module chức năng, navigation, state stores và hệ thống release/feature flags của ứng dụng **LingoBites Mobile App (React Native)**.

---

## 1. Tổng quan Kiến trúc & Tech Stack

- **Framework**: React Native (Bare React Native, TypeScript Strict Mode).
- **Navigation**: React Navigation 6 (Architecture phân tầng: RootStack cho các modal/ingestion/YouTube History, Bottom Tab Navigator gồm 4 tabs: `Home`, `Create`, `Lessons`, `Profile` và các Nested Native Stack Navigators).
- **State Management**: Local-first architecture sử dụng Zustand stores kết hợp AsyncStorage, có Outbox Queue phục vụ đồng bộ dữ liệu ngoại tuyến (Offline-first Resilience).
- **Design System & Theme Engine**: Hệ thống Multi-Theme động (7 theme presets: Default/Light, Dark, Core, PastelKids, Neo-Brutalism, Comic, Cartoon, StickerSoft) tuân thủ tiêu chuẩn tương phản WCAG (AA/AAA).
- **Feature Flagging & Release Management**: `src/release/` với `featureRegistry`, `useFeatureFlags`, kiểm soát bật/tắt tính năng theo môi trường `dev` và `production`.

---

## 2. Bảng Tổng Hợp Chi Tiết Tính Năng & Trạng Thái Tiến Độ

| STT    | Phân nhóm / Module     | Tính năng (Feature)            |  Trạng thái (Status)   | Entry Point / Vị trí Code                          | Mô tả chức năng & Mức độ hoàn thiện                                                                                            |
| ------ | ---------------------- | ------------------------------ | :--------------------: | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **1**  | **Input & Ingestion**  | **Paste Text Input**           |      🟢 **Ready**      | `CreateTab -> PasteTextScreen`                     | Nhập hoặc dán đoạn văn bản tiếng Anh trực tiếp, có validation độ dài và định dạng.                                             |
|        | `modules/input`        | **Camera Image Capture**       |      🟢 **Ready**      | `CreateTab -> ImageCaptureScreen`                  | Chụp ảnh văn bản thực tế qua camera thiết bị để trích xuất văn bản.                                                            |
|        |                        | **Photo Gallery Picker**       |      🟢 **Ready**      | `modules/input/imagePicker.ts`                     | Chọn ảnh tài liệu, hóa đơn, biển báo từ thư viện ảnh thiết bị.                                                                 |
|        |                        | **Ingestion Gate & Hub**       |      🟢 **Ready**      | `CreateTab -> CreateScreen`                        | Hub tạo bài học tập trung với điều hướng kiểm soát theo Feature Flag.                                                          |
| **2**  | **OCR Engine**         | **OCR Scanner**                |      🟢 **Ready**      | `modules/ocr/OCRService.ts`                        | Nhận diện ký tự quang học trích xuất văn bản tiếng Anh từ ảnh chụp/tải lên.                                                    |
|        | `modules/ocr`          | **OCR Review & Edit**          |      🟢 **Ready**      | `CreateTab -> OCRReviewScreen`                     | Giao diện cho phép người dùng xem lại, chỉnh sửa văn bản đã quét trước khi phân tích.                                          |
| **3**  | **AI Analysis**        | **AI Lesson Analysis**         |      🟢 **Ready**      | `modules/ai-analysis`                              | Phân tích bài học qua LLM: dịch thuật, phân tích câu, từ vựng, ngữ pháp, hướng dẫn phát âm.                                    |
|        | `modules/ai-analysis`  | **Analyzing Progress UI**      |      🟢 **Ready**      | `CreateTab -> AnalyzingScreen`                     | Màn hình chờ hiển thị trạng thái phân tích AI theo thời gian thực (Step progress & animation).                                 |
| **4**  | **Lesson System**      | **Lesson Result View**         |      🟢 **Ready**      | `CreateTab -> LessonResultScreen`                  | Hiển thị bài học hoàn chỉnh theo từng khối: Bản dịch tiếng Việt, Câu, Từ vựng, Ngữ pháp, Bài tập.                              |
|        | `modules/lesson`       | **Lesson Detail Drilldowns**   |      🟢 **Ready**      | `WordDetail`, `SentenceDetail`, `GrammarDetail`    | Màn hình chi tiết chuyên sâu cho từng Từ vựng (nghĩa, IPA, audio, ví dụ), Câu và Ngữ pháp.                                     |
|        |                        | **Lesson Save & History**      |      🟢 **Ready**      | `LessonsTab -> LessonsHistoryScreen`               | Lưu trữ bài học cá nhân, danh sách lịch sử bài học kèm tìm kiếm, lọc theo ngày/chủ đề.                                         |
|        |                        | **Optimistic Bookmarking**     |      🟢 **Ready**      | `modules/lesson/useBookmarkOptimistic.ts`          | Đánh dấu bài học, từ vựng yêu thích với cập nhật giao diện tức thì (Optimistic UI).                                            |
|        |                        | **Flashcard Library**          |      🟢 **Ready**      | `LessonsTab -> FlashcardListScreen`                | Bộ thẻ học từ vựng Flashcard, hỗ trợ lật thẻ (flip card), theo dõi độ ghi nhớ.                                                 |
|        |                        | **Progressive Lesson (V2)**    |      🟡 **Beta**       | `ProgressiveLessonScreen.tsx`                      | Luồng học từng bước theo mô hình tương tác thế hệ mới (Lesson V2).                                                             |
| **5**  | **Practice & Quiz**    | **Short Practice / Quiz**      |      🟢 **Ready**      | `modules/practice` (quick practice flows)          | Bài tập trắc nghiệm nhanh tạo tự động từ nội dung bài học (Multiple choice, Fill blank, Matching).                             |
|        | `modules/practice`     | **Quiz Engine & Grader**       |      🟢 **Ready**      | `sessionEngine.ts`, `grader.ts`                    | Động cơ chấm điểm tức thì, giải thích đáp án đúng/sai, tổng kết kết quả (`resultSummary`).                                     |
| **6**  | **Review & SRS**       | **Daily Review (SRS)**         |      🟢 **Ready**      | `HomeTab -> DailyReviewScreen`                     | Hệ thống lặp lại ngắt quãng (Spaced Repetition System) ôn tập từ vựng, câu hỏi mỗi ngày.                                       |
|        | `modules/review`       | **Review Scheduler**           |      🟢 **Ready**      | `modules/review/reviewScheduler.ts`                | Thuật toán tính toán chu kỳ ôn tập dựa trên độ bền trí nhớ của người học.                                                      |
| **7**  | **YouTube Learning**   | **YouTube Video Ingestion**    |      🟡 **Beta**       | `CreateTab -> YouTubeInputScreen`                  | Nhập liên kết video YouTube, kiểm tra tính hợp lệ và lấy dữ liệu phụ đề.                                                       |
|        | `modules/youtube`      | **Transcript Sync & Player**   |      🟡 **Beta**       | `YouTubeLessonScreen.tsx`                          | Trình phát video đồng bộ phụ đề thời gian thực, tua đến vị trí câu khi nhấn.                                                   |
|        |                        | **Sentence Carousel & Enrich** |      🟡 **Beta**       | `SentenceCarousel.tsx`, `useSentenceEnrichment.ts` | Carousel câu tương tác, tra cứu từ vựng trực tiếp trên phụ đề kèm phân tích ngữ nghĩa.                                         |
|        |                        | **YouTube History (Root)**     |      🟡 **Beta**       | `RootStack -> YouTubeHistoryScreen`                | Quản lý lịch sử học qua video YouTube độc lập trên Root Stack (không bị che bởi Tab bar).                                      |
| **8**  | **Content Packages**   | **Content Importer & Lint**    |      🟢 **Ready**      | `modules/content/importer`                         | Trình giải nén và nhập gói bài học đóng gói (.zip) kèm kiểm tra checksum và schema linting.                                    |
|        | `modules/content`      | **Content Lesson Runtime**     |      🟢 **Ready**      | `ContentLessonRuntimeScreen.tsx`                   | Môi trường thực thi bài học theo lộ trình định sẵn với âm thanh và các bước tương tác.                                         |
| **9**  | **Speaking & Pronun.** | **Shadowing Activity**         |   🟡 **In Progress**   | `SpeakingShadowingActivity.tsx`                    | Giao diện luyện nói Shadowing theo từng câu mẫu.                                                                               |
|        | `modules/speaking`     | **Audio Recording & Upload**   |      🟢 **Ready**      | `recordingService.ts`, `recordingUploadWorker.ts`  | Ghi âm giọng nói người học và hàng đợi tải lên background worker.                                                              |
|        |                        | **Error Notebook**             |      🟢 **Ready**      | `errorNotebookService.ts`                          | Sổ tay ghi nhận các lỗi phát âm để theo dõi tiến độ cải thiện.                                                                 |
|        |                        | **AI Speech Evaluation**       | ⚪ **Not Implemented** | `modules/speaking`                                 | Chấm điểm phát âm tự động qua AI (đang để dạng placeholder / cấu hình chờ backend).                                            |
| **10** | **Audio & TTS**        | **TTS Audio Player**           |      🟢 **Ready**      | `modules/audio/ttsService.ts`                      | Đọc phát âm từ vựng, câu tiếng Anh bằng giọng đọc bản xứ.                                                                      |
|        | `modules/audio`        | **Chapter Audio Cache**        |      🟢 **Ready**      | `chapterAudioCache.ts`, `audioCachePolicy.ts`      | Bộ nhớ đệm âm thanh tối ưu lưu lượng và hỗ trợ phát offline.                                                                   |
| **11** | **Engagement & Daily** | **Today Dashboard & Streak**   |      🟢 **Ready**      | `HomeTab -> TodayScreen`                           | Theo dõi chuỗi ngày học liên tục (Streak), mục tiêu trong ngày và gợi ý học thích ứng.                                         |
|        | `modules/engagement`   | **Local Reminder Scheduler**   |      🟢 **Ready**      | `nativeReminderScheduler.ts`                       | Lập lịch thông báo nhắc nhở học tập hàng ngày trên thiết bị.                                                                   |
|        |                        | **Interactive Mini Games**     | ⚪ **Not Implemented** | `modules/engagement`                               | Các mini-game độc lập (Word Match, Fill Blank, Tense Quiz, Sentence Order) đang ở mức schema/logic nền tảng, chưa có UI riêng. |
| **12** | **Account & Setup**    | **Boot Gate & Onboarding**     |      🟢 **Ready**      | `BootGateScreen.tsx`, `OnboardingNameScreen.tsx`   | Khởi tạo ứng dụng, thu thập tên và thiết lập ban đầu cho người dùng mới.                                                       |
|        | `modules/account`      | **Profile Management**         |      🟢 **Ready**      | `ProfileTab -> ProfileScreen`                      | Quản lý thông tin cá nhân, cấp độ học và cách ly dữ liệu người dùng.                                                           |
| **13** | **Theme & UI System**  | **Multi-Theme Engine**         |      🟢 **Ready**      | `src/theme/` (7 theme presets)                     | Chuyển đổi linh hoạt giữa 7 giao diện (Default, Dark, Core, PastelKids, Neo, Comic, Cartoon, StickerSoft).                     |
|        | `src/theme`            | **WCAG Contrast Compliance**   |      🟢 **Ready**      | `contrastCompliance.test.ts`                       | Bộ token màu sắc được kiểm thử tự động đạt chuẩn tương phản cao.                                                               |
| **14** | **Sync & Analytics**   | **Offline Outbox Sync**        |      🟢 **Ready**      | `modules/sync/outboxSync.ts`                       | Lưu trữ ngoại tuyến các hành động học tập và tự động đẩy lên server khi có mạng.                                               |
|        | `modules/analytics`    | **Privacy-Safe Analytics**     |      🟢 **Ready**      | `modules/analytics/analyticsService.ts`            | Ghi nhận sự kiện sử dụng có lọc bỏ dữ liệu nhạy cảm (không log nội dung text quét của người dùng).                             |

---

## 3. Đánh Giá Mức Độ Hoàn Thiện Tổng Thể

1. **Nhóm Tính Năng Cốt Lõi (Core MVP - Phase 0)**: **100% Hoàn Thành (Production Ready)**
   - Toàn bộ luồng: _Nhập liệu (Text/Ảnh/OCR) ➔ Phân tích AI ➔ Xem chi tiết bài học (Câu/Từ/Ngữ pháp) ➔ Luyện tập ngắn (Quiz) ➔ Lưu bài học & Ôn tập Spaced Repetition (SRS)_ đều đã hoàn thiện, hoạt động ổn định và có kiểm thử bao phủ toàn diện.
2. **Nhóm Tính Năng Mở Rộng (Expansion Features)**: **90% Hoàn Thành (Beta / Stable)**
   - Tính năng học qua video YouTube (`youtubeLearning`) với đồng bộ phụ đề, carousel câu tương tác và quản lý lịch sử học đã được tích hợp đầy đủ.
   - Hệ thống nhập và chạy các gói khóa học đóng gói (`ContentPackageImporter` & `ContentLessonRuntime`).
   - Hệ thống 7 bộ Theme linh hoạt và đồng bộ dữ liệu Offline-first.
3. **Nhóm Tính Năng Đang Phát Triển / Tương Lai (Future / In Progress)**:
   - Chấm điểm phát âm tự động bằng AI (AI Speech Evaluation) trong `modules/speaking` (đã có UI ghi âm và sổ tay lỗi, chờ kết nối scoring service).
   - Các màn hình mini-game tương tác độc lập trong `modules/engagement` (hiện tại phần luyện tập đang được đáp ứng đầy đủ qua `modules/practice`).
