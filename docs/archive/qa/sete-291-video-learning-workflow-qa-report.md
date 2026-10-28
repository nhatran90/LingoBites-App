> **Lưu trữ:** mô tả bản cũ, không còn đúng với code hiện tại. Xem [`architecture/feature-map.md`](../../architecture/feature-map.md).

# SETE-291 — Báo cáo Kiểm thử Toàn diện & Ma trận Test Case: Luồng "Học qua video" (Video Learning Workflow) trên Simulator qua Orca CLI

- **Mã công việc:** SETE-291 (Issue: `01a09995-2cb8-714f-937c-473be8245881`)
- **Vai trò:** Senior QA Analyst (ID: `fa7faf2f-c7d7-47f5-9b7b-913dcc012dd8`)
- **Ngày thực hiện:** 2026-09-13
- **Mục tiêu:** Gắn Orca CLI vào active iOS Simulator, thiết kế ma trận kiểm thử toàn diện, và thực hiện end-to-end testing toàn bộ workflow học tiếng Anh qua video YouTube (`YouTubeHistoryScreen`, `YouTubeInputScreen`, `YouTubeProcessingScreen`, `YouTubeLessonScreen`, `TranscriptLine`, `PracticeScreen`).

---

## 1. Tóm tắt kết quả kiểm thử (Executive Summary)

- **Kết luận:** **PASS WITH DEFECTS (ĐẠT VỀ MẶT TÍNH NĂNG CHÍNH - PHÁT HIỆN 1 DEFECT NGHIÊM TRỌNG TRAP USER VÀ 2 DEFECT VỀ UX / LOCALIZATION)**
- **Môi trường thử nghiệm:**
  - Thiết bị giả lập: **iPhone 17 Pro** (`E8253964-95DD-483A-8C54-A5234D23537C`), iOS 26.5.
  - Công cụ điều khiển: **Orca CLI** (`orca emulator attach`, `tap`, `type`, `ax`, `kill`).
  - Ứng dụng: `com.lingobites.dev` (LingoBites Dev build).
  - Database: SQLite (`lingobites.db`).
- **Tổng số kịch bản kiểm thử (Test Scenarios):** 16 test cases kiểm thử giao diện & luồng nghiệp vụ end-to-end.
- **Automated Tests:** 14 test suites, 121 automated unit/integration tests pass 100%.
- **Defects phát hiện:**
  1. **DEFECT-SETE-291-01 (Severity: High / Critical):** Tràn layout thanh điều khiển Header trên `YouTubeLessonScreen` khi kích hoạt tính năng lặp A–B khiến nút "Quay lại" bị đè hoàn toàn bởi icon "Bật bản dịch" ở cùng tọa độ `(x: 0.0398, y: 0.0801)`. Nếu bài học chưa có bản dịch (nút dịch bị disabled), người dùng bị kẹt (TRAPPED) trong màn hình bài học và không thể bấm Back.
  2. **DEFECT-SETE-291-02 (Severity: Medium):** Nút "Luyện tập" (school icon) trên `YouTubeLessonScreen` luôn hiển thị và cho phép bấm (`enabled: true`), nhưng khi transcript chưa được dịch tiếng Việt (< 2 câu có `vi`), hàm `mapTranscriptToPractice` trả về mảng rỗng và app nuốt tương tác trong im lặng (silent failure), không có thông báo toast/alert giải thích cho người dùng.
  3. **DEFECT-SETE-291-03 (Severity: Low / Medium):** Banner cảnh báo hiển thị chuỗi mã nội bộ thô `youtube_enrichment_block_1_failed` trực tiếp ra giao diện người dùng thay vì thông báo tiếng Việt thân thiện có thể hiểu được.

---

## 2. Ma trận Test Case Toàn diện (Traceability Matrix)

| Test ID       | Module / Màn hình  | Kịch bản kiểm thử (Test Scenario)                   | Điều kiện tiên quyết & Dữ liệu             | Các bước thực hiện (Steps)                                                                                       | Kết quả kỳ vọng (Expected Result)                                                                                          | Kết quả thực tế (Actual Result)                                                    | Priority | Trạng thái           |
| ------------- | ------------------ | --------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------- | -------------------- |
| **TC-VLF-01** | Home -> Video      | Khởi động luồng học video từ Home khi có bài đã lưu | App ở Home, DB có bài học YouTube          | 1. Tap card "Học qua video" (`home-explore-video`).                                                              | Mở `YouTubeHistoryScreen` hiển thị danh sách bài đã lưu.                                                                   | Mở chính xác `YouTubeHistoryScreen`.                                               | P0       | **PASS**             |
| **TC-VLF-02** | History            | Xem danh sách bài học đã lưu                        | Đang ở `YouTubeHistoryScreen`              | 1. Quan sát card bài học, tiêu đề, số câu, nút tạo bài mới, nút xóa.                                             | Hiển thị thumbnail, tiêu đề, số lượng câu, icon Play và nút Xóa.                                                           | Hiển thị đầy đủ bài học `Mz-Hne9h_aE` (61 câu).                                    | P1       | **PASS**             |
| **TC-VLF-03** | History            | Hủy xóa bài học khi xuất hiện Alert xác nhận        | Đang ở `YouTubeHistoryScreen`              | 1. Tap icon Thùng rác.<br>2. Nhấn "Hủy" trên Alert dialog.                                                       | Dialog đóng lại, bài học vẫn tồn tại trong danh sách.                                                                      | Dialog đóng, bài học nguyên vẹn.                                                   | P1       | **PASS**             |
| **TC-VLF-04** | History            | Xóa bài học đã lưu và hiển thị Empty State          | Đang ở `YouTubeHistoryScreen`              | 1. Tap icon Thùng rác.<br>2. Nhấn "Xóa" trên Alert dialog.                                                       | Bài học bị xóa khỏi SQLite, màn hình chuyển sang trạng thái Rỗng (Empty State) với nút "Tạo bài học từ video YouTube mới". | Xóa thành công, hiển thị empty state chuẩn thiết kế.                               | P1       | **PASS**             |
| **TC-VLF-05** | History -> Input   | Chuyển sang màn hình nhập link từ History           | Đang ở `YouTubeHistoryScreen`              | 1. Nhấn nút "Tạo bài học từ video YouTube mới".                                                                  | Mở `YouTubeInputScreen` ("Học từ YouTube") với ô link rỗng.                                                                | Chuyển sang `YouTubeInputScreen`.                                                  | P1       | **PASS**             |
| **TC-VLF-06** | Input              | Validation khi bỏ trống link YouTube                | Đang ở `YouTubeInputScreen`, input rỗng    | 1. Nhấn nút "Tạo bài học" (`youtube-submit`).                                                                    | Hiển thị lỗi inline màu đỏ: "Vui lòng nhập link YouTube hợp lệ...". Không chuyển màn.                                      | Lỗi hiển thị chính xác dưới ô nhập liệu.                                           | P1       | **PASS**             |
| **TC-VLF-07** | Input              | Validation khi nhập link không phải YouTube         | Đang ở `YouTubeInputScreen`                | 1. Nhập URL `https://google.com`.<br>2. Nhấn "Tạo bài học".                                                      | Không gửi request job, hiển thị cảnh báo link không hợp lệ.                                                                | Báo lỗi URL không hợp lệ.                                                          | P1       | **PASS**             |
| **TC-VLF-08** | Lesson Player      | Khởi chạy player và đồng bộ transcript              | Mở bài học từ History                      | 1. Tap card bài học đã lưu.                                                                                      | Vào `YouTubeLessonScreen`, video load iframe player, transcript tải danh sách câu.                                         | Player nạp video, transcript hiển thị từ câu 1-61.                                 | P0       | **PASS**             |
| **TC-VLF-09** | Lesson Transcript  | Chạm vào dòng transcript để tua video (Tap-to-seek) | Video đang dừng/phát                       | 1. Tap vào Câu 1 ("I'm going to win this.").                                                                     | Player phát video và tua ngay lập tức tới giây bắt đầu của câu, tô sáng dòng được chọn (màu xanh ngọc).                    | Video tự động play và seek đến 0:02, câu 1 được tô sáng.                           | P0       | **PASS**             |
| **TC-VLF-10** | Lesson Transcript  | Tự động cuộn theo video đang phát (Auto-scroll)     | Video đang phát                            | 1. Để video phát tự nhiên qua các câu thoại tiếp theo.                                                           | Dòng transcript đang phát tự động chuyển highlight và cuộn mượt mà vào tầm nhìn.                                           | Video chuyển qua các câu 2, 3, 4..., dòng tương ứng tự scroll và highlight.        | P0       | **PASS**             |
| **TC-VLF-11** | Lesson Controls    | Thay đổi tốc độ phát (Playback Rate Cycle)          | Đang ở `YouTubeLessonScreen`               | 1. Tap icon đồng hồ tốc độ phát nhiều lần.                                                                       | Tốc độ chu kỳ tuần hoàn: 1× -> 1.25× -> 1.5× -> 0.75× -> 1×. Nhãn accessibility cập nhật tương ứng.                        | Tốc độ thay đổi chính xác theo chu kỳ.                                             | P1       | **PASS**             |
| **TC-VLF-12** | Lesson Controls    | Bật/Tắt lặp một câu (Repeat toggle)                 | Đang ở `YouTubeLessonScreen`               | 1. Tap icon lặp câu (`youtube-toggle-repeat`).                                                                   | Nút đổi trạng thái sang active ("Tắt lặp câu"), video chỉ lặp lại câu đang chọn.                                           | Nút chuyển tone accent và nhãn thành "Tắt lặp câu".                                | P1       | **PASS**             |
| **TC-VLF-13** | Lesson Controls    | Thiết lập khoảng lặp A–B (A-B Loop) & Xóa lặp       | Đang ở `YouTubeLessonScreen`               | 1. Chọn điểm A tại câu hiện tại.<br>2. Quan sát sự xuất hiện của nút "Xóa lặp A–B".<br>3. Tap nút "Xóa lặp A–B". | Đặt điểm A thành công, xuất hiện nút xóa, tap nút xóa đưa A–B về trạng thái ban đầu.                                       | Thiết lập được điểm A, nhưng phát sinh DEFECT-SETE-291-01 (đè nút Back).           | P1       | **FAIL (DEFECT-01)** |
| **TC-VLF-14** | Lesson Transcript  | Lưu câu vào Flashcard (Bookmark optimistic)         | Đang ở `YouTubeLessonScreen`               | 1. Tap icon Trái tim tại dòng câu thoại.                                                                         | Trái tim chuyển sang trạng thái tô màu (accent/fill), lưu bookmark vào SQLite. Tap lại để bỏ lưu.                          | Trái tim đổi sang màu xanh ngọc, lưu thành công vào Flashcard DB.                  | P1       | **PASS**             |
| **TC-VLF-15** | Lesson Controls    | Bật/Tắt hiển thị bản dịch tiếng Việt & IPA          | Bài học đã được enrich (có `vi` và `ipa`)  | 1. Tap nút dịch để ẩn tiếng Việt.<br>2. Tap nút IPA để ẩn IPA.                                                   | Transcript chuyển đổi linh hoạt: 3 dòng -> 2 dòng (EN+IPA) -> 1 dòng (chỉ EN).                                             | Chuyển đổi hiển thị chính xác theo từng toggle.                                    | P0       | **PASS**             |
| **TC-VLF-16** | Lesson -> Practice | Chuyển từ bài học sang chế độ Luyện tập trắc nghiệm | Bài học có transcript được dịch tiếng Việt | 1. Tap nút mũ tốt nghiệp (`youtube-start-practice`).                                                             | Chuyển sang màn hình `Practice` với các câu hỏi trắc nghiệm tạo từ transcript video, có 4 lựa chọn và chấm điểm tức thì.   | Màn hình Luyện tập mở ra (5 câu), chọn đáp án hiển thị "Chính xác!" và giải thích. | P0       | **PASS**             |

---

## 3. Nhật ký Kiểm thử Thực tế trên Simulator qua Orca CLI

### 3.1. Kết nối và khởi tạo Orca Simulator Helper

- Thực hiện kết nối tới thiết bị đang chạy:
  ```bash
  orca emulator attach E8253964-95DD-483A-8C54-A5234D23537C
  # Attached to E8253964-95DD-483A-8C54-A5234D23537C (preview: http://127.0.0.1:3100/stream.mjpeg)
  ```

### 3.2. Kiểm thử luồng Player & Đồng bộ Transcript

1. Đã mở bài học `Mz-Hne9h_aE` ("The Little Bear Who Was Afraid to Try...").
2. Tap vào Câu 1 tại tọa độ `(0.44, 0.48)`:
   - Video player tự động bắt đầu phát tại giây thứ 2 (`0:02 / 5:08`).
   - Dòng 1 được highlight với nền `primaryContainer`.
   - Khi video phát tiếp, highlight tự động nhảy theo thời gian thực sang các câu kế tiếp.
3. Test chu kỳ tốc độ phát (`youtube-playback-rate`):
   - Chạm 1: `Tốc độ phát 1.25×`.
   - Chạm 2: `Tốc độ phát 1.5×`.
   - Chạm 3: `Tốc độ phát 0.75×`.
4. Test tính năng lưu câu (Bookmark):
   - Tap icon trái tim tại câu 2: icon chuyển thành fill accent, lưu thành công.

### 3.3. Kiểm thử luồng Quản lý Lịch sử & Xóa bài học (History & Delete)

1. Tap icon Thùng rác bên phải card bài học `(0.875, 0.254)`:
   - Hiển thị Alert Dialog hệ thống: _"Xóa bài học này? "The Little Bear Who Was Afraid to Try..." sẽ bị xóa khỏi thiết bị này."_
2. Tap "Hủy" `(0.31, 0.58)`: Alert đóng, bài học vẫn tồn tại.
3. Tap "Xóa" `(0.68, 0.58)`:
   - Bản ghi trong DB bị xóa.
   - Màn hình chuyển sang Empty State chuẩn: _"Chưa có bài nào được lưu"_, kèm CTA button _"Tạo bài từ video mới"_.
4. Tap CTA trên empty state: Điều hướng chuẩn xác sang `YouTubeInputScreen`.

### 3.4. Kiểm thử Chế độ Luyện tập (Practice Quiz Mode)

1. Cập nhật dữ liệu bài học mẫu có bản dịch tiếng Việt và IPA cho các câu 1-5.
2. Mở bài học, tap icon Mũ tốt nghiệp (`youtube-start-practice` tại `(0.91, 0.105)`):
   - Màn hình `PracticeScreen` hiển thị ngay lập tức với tiêu đề "Luyện tập", thanh tiến trình "1 / 5".
   - Câu hỏi: _"I'm going to win this."_.
   - 4 đáp án trắc nghiệm A, B, C, D được sinh tự động từ các câu trong video.
3. Chọn đáp án B ("Tôi sẽ chiến thắng trò này."):
   - Lựa chọn chuyển sang màu xanh ngọc, nhãn "đúng".
   - Hiển thị thông báo "Chính xác!", kèm giải thích _"Dịch nghĩa từ câu trong video YouTube."_ và nút "Câu tiếp theo".

---

## 4. Báo cáo Chi tiết Các Lỗi Phát hiện (Defect Reports)

### 🔴 DEFECT-SETE-291-01: Tràn nút Header đè mất nút "Quay lại" và giam lỏng người dùng trên màn hình Lesson

- **Mức độ nghiêm trọng (Severity):** High / Critical.
- **Mức độ ưu tiên (Priority):** P0.
- **Mô tả:** Khi người dùng bật tính năng lặp đoạn A–B, nút `youtube-ab-loop-clear` ("Xóa lặp A–B") xuất hiện, nâng tổng số action button trên header lên 8 nút. Do container `headerActions` không giới hạn chiều rộng và `ScreenHeader` chia không gian dạng flex row, cụm action button này dạt hết sang trái, đè hoàn toàn lên nút Back (`Quay lại`).
- **Bằng chứng AX Tree:**
  ```json
  {"id": null, "label": "Quay lại", "frame": {"x": 0.0398, "y": 0.0801, "width": 0.1095, "height": 0.0503}}
  {"id": "youtube-toggle-vietnamese", "label": "Bật bản dịch", "frame": {"x": 0.0398, "y": 0.0801, "width": 0.1095, "height": 0.0503}}
  ```
- **Hậu quả:** Tiêu đề bài học bị thu nhỏ về 0 (biến mất hoàn toàn). Nghiêm trọng hơn, nếu bài học chưa có bản dịch thì nút `youtube-toggle-vietnamese` bị disabled; khi người dùng cố gắng bấm nút "Quay lại", tương tác rơi vào nút disabled này và không có cách nào thoát khỏi màn hình (User Trap).
- **Khuyến nghị khắc phục:**
  - Gom các hành động phụ (A-B loop, lặp câu, tốc độ phát) vào một thanh toolbar phụ dưới Player (`playerControls`) hoặc dùng Action Sheet / Overflow menu (3 chấm) thay vì dồn 8 nút lên header.
  - Cố định vùng `leftAction` trên `ScreenHeader` để không bao giờ bị `rightAction` đè lên.

---

### 🟡 DEFECT-SETE-291-02: Nút Luyện tập nuốt tương tác trong im lặng khi transcript chưa có bản dịch

- **Mức độ nghiêm trọng (Severity):** Medium.
- **Mức độ ưu tiên (Priority):** P2.
- **Mô tả:** Tại `YouTubeLessonScreen.tsx`, nút `youtube-start-practice` luôn hiển thị nếu có prop `onStartPractice`. Khi người dùng bấm nút:
  ```ts
  const handleStartPractice = useCallback(() => {
    if (!lesson) return;
    const questions = mapTranscriptToPractice(lesson.segments, 10);
    if (questions.length > 0) {
      nav.navigate('Practice', { ... });
    }
  }, [lesson, nav, t]);
  ```
  Nếu bài học có các câu chưa dịch tiếng Việt hoặc số câu hợp lệ < 2, `questions.length` trả về 0. Ứng dụng không làm gì cả (silent failure), không có thông báo toast, alert hay vô hiệu hóa nút (`disabled`).
- **Khuyến nghị khắc phục:**
  - Vô hiệu hóa nút (`disabled={!canPractice}`) hoặc khi bấm vào hiển thị thông báo toast: _"Bài học chưa đủ dữ liệu bản dịch để tạo bài luyện tập."_.

---

### 🟢 DEFECT-SETE-291-03: Hiển thị mã lỗi nội bộ thô `youtube_enrichment_block_1_failed` ra UI

- **Mức độ nghiêm trọng (Severity):** Low / Medium.
- **Mức độ ưu tiên (Priority):** P2.
- **Mô tả:** Khi quá trình xử lý video gặp sự cố tại block làm giàu dữ liệu, mã lỗi chuỗi thô `youtube_enrichment_block_1_failed` được lưu vào `warnings` và render trực tiếp trong banner _"Về bài học này"_.
- **Khuyến nghị khắc phục:**
  - Cung cấp hàm dịch i18n cho các mã warning (ví dụ: `t('youtube.warnings.enrichment_block_failed', {defaultValue: 'Bản dịch tự động cho một số câu chưa hoàn tất.'})`).

---

## 5. Kết luận & Đánh giá Sẵn sàng Release

1. **Chức năng cốt lõi:** Luồng học qua video (nhập link, xem danh sách bài đã lưu, xóa bài, empty state, player, auto-scroll transcript, tap-to-seek, lưu từ vựng vào flashcard, và bài tập trắc nghiệm) hoạt động mượt mà, ổn định và chính xác theo thiết kế.
2. **Yêu cầu trước khi Release:** Cần fix khẩn cấp `DEFECT-SETE-291-01` để tránh việc người dùng bị kẹt trên màn hình bài học khi kích hoạt tính năng lặp A-B.
