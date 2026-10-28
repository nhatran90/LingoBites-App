> **Lưu trữ:** mô tả bản cũ, không còn đúng với code hiện tại. Xem [`architecture/feature-map.md`](../../architecture/feature-map.md).

# SETE-276 — Bằng chứng chốt preset `production` và xác thực staging OCR/AI/YouTube

Ngày ghi: 2026-09-12. Phạm vi: preset phát hành + hành vi timeout / rate limit /
fallback của ba luồng phụ thuộc provider ngoài (`lessonV2`, `youtubeLearning`).

## 1. AC1 — `DEFAULT_RELEASE_NAME === 'production'` (đạt, có contract test)

- `src/release/release-manifest.ts:5` — `DEFAULT_RELEASE_NAME = 'production'`.
- Contract test `src/release/__tests__/validate-release-config.test.ts:128-132`
  (`DEFAULT_RELEASE_NAME remains production`) — xanh.
- Cả hai preset `dev` / `production` đều bật toàn bộ ready + beta
  (`lessonV2`, `youtubeLearning`, `stickerSoftTheme`), `not_implemented` giữ tắt;
  validator `validateReleaseConfig` chấp nhận cả hai (xanh).
- Kết quả: `npx jest src/release --watchman=false` → 2 suites, 12 tests, xanh.

## 2. AC2/AC3 — Ma trận timeout / rate limit / fallback theo luồng

Staging: `https://lingobites-api-staging-1062615944807.asia-southeast1.run.app`
(`/health` → `ok:true`), provider thật: `AI_PROVIDER=gemini`,
`OCR_PROVIDER=google-vision`, `TRANSCRIPT_PROVIDER=auto`,
`ASYNC_ANALYSIS_ENABLED=true` (xác nhận từ `api-server/.env.staging`, chỉ đọc
tên provider — không in key). Raw request/response lưu ở `/tmp/sete276-staging/`
(`ocr_success`, `ocr_blank`, `ai_create`, `ai_poll`, `ai_empty`,
`yt_invalid`, `evidence_index`). Tóm tắt số liệu thật dưới đây; chi tiết
request/response xem mục 2.1–2.3.

| Luồng                                                                | Timeout                                                                                                                     | Rate limit (429) / 5xx                                                                                                               | Fallback quan sát được                                                                                                                                                                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OCR (`ocrClient.ts`, watchdog 30s)                                   | Treo quá 30s → `OCR_TIMEOUT`, `retryable: true`, message `errors.ocr_timeout` (`__tests__/ocrClient.test.ts`)               | Server trả envelope lỗi kèm `retryable`; client giữ nguyên `errorCode` để UI quyết định thử lại                                      | Lỗi hiện message + nút thử lại, không màn hình trắng                                                                                                                                                                      |
| AI (`analysisJobClient.ts`, watchdog 10s/request, deadline poll 75s) | Request treo bị watchdog abort → thử lại ở kỳ poll sau; quá 75s → `AI_POLL_GIVE_UP` (`__tests__/analysisJobClient.test.ts`) | Poll gặp 429/5xx, rớt mạng, JSON hỏng → chờ 1.5s rồi poll tiếp; lỗi đầu cuối giữ nguyên `errorCode`                                  | `AnalyzingScreen` quay về màn nhập, giữ text, kèm `analyzeError` — không nuốt lỗi                                                                                                                                         |
| YouTube (`youtubeApi.ts`, **mới sửa**)                               | Trước đây poll GET treo thì kẹt vô hạn; nay watchdog 10s/request + deadline 75s → quá hạn trả `errors.youtube_timeout`      | Trước đây 429/5xx ở kỳ poll là lỗi đầu cuối ngay; nay thử lại mỗi 1s tới deadline (test: 429, 500, rớt mạng, JSON hỏng đều hồi phục) | `TRANSCRIPT_UNAVAILABLE` / `TRANSCRIPT_SOURCE_BLOCKED` → giữ link, chuyển `YouTubeManualTranscript` (đường lui R2); lỗi khác → màn hình lỗi có URL + nút Thử lại + Đổi link (`YouTubeProcessingScreen`, đã có test retry) |

Thay đổi code trong kỳ này (nhỏ, theo đúng convention của `analysisJobClient.ts`):

- `src/modules/youtube/api/youtubeApi.ts` — thêm `FETCH_TIMEOUT_MS = 10_000`,
  helper `withTimeout` / `waitBeforeNextAttempt` / `isTransientStatus`; POST và
  mỗi lượt poll GET đều có watchdog; poll 429/5xx, rớt fetch, hỏng JSON thành
  transient (chờ 1s, thử tiếp) thay vì lỗi đầu cuối; phân biệt cancel của người
  dùng (`cancelled`) với timeout nội bộ.
- `src/modules/youtube/api/__tests__/youtubeApi.test.ts` — thêm 12 test cho
  `runYouTubeJob`: happy path + `Idempotency-Key`, create fail, transient
  429/500/rớt mạng/JSON hỏng rồi hồi phục, lỗi đầu cuối giữ nguyên code
  (`TRANSCRIPT_UNAVAILABLE` — trigger của đường lui thủ công,
  `RATE_LIMIT_EXCEEDED`, `YOUTUBE_NOT_EMBEDDABLE`), hết deadline 75s,
  watchdog 10s cho poll treo, cancellation.

Kết quả: suite youtubeApi 22/22 xanh; `tsc --noEmit` sạch; eslint sạch.
Các suite liên quan (`src/shared/api`, `src/modules/youtube`, `ocr`,
`ai-analysis`): 188/189 xanh — 1 fail duy nhất là
`OCRReviewScreen › navigates to Analyzing… (TC-006)`, đã kiểm tra fail y hệt
trên base chưa sửa (pre-existing, không liên quan kỳ này).

Phía server đã có sẵn, không đụng tới: `autoCaption.ts` map 429 →
`TRANSCRIPT_SOURCE_BLOCKED` (`retryable: true`), network/`ETIMEDOUT`/429 lạ →
retryable; captcha IP Cloud Run → `TRANSCRIPT_SOURCE_BLOCKED` (đúng rủi ro đã
chấp nhận ở R1, đường lui là `ManualTranscriptSource` theo R2).

## 2.1. OCR live (2026-09-12, provider `google-vision`) — ĐẠT

- Happy path: `POST /v1/ocr` (multipart, ảnh chụp màn hình app 526KB có chữ
  EN+VI, `source_type=gallery`) → **200 trong 2299ms** (ngân sách client 30s).
  `provider=google-vision`, `extracted_text` 398 ký tự / 22 dòng
  (`text_length_bucket=101-500`, `has_english_signal=true`,
  `low_confidence=false`), mở đầu đúng nội dung ảnh:
  `"12:58\n( Bài học đang tạo...\nBài học\nBài học đang tạo...\nBeginner 12 câu\n…\nWhy are companies who work with l…"`.
- Fallback quan sát được: ảnh trắng 800×600 tự sinh → **422 trong 398ms**,
  `error.code=OCR_NO_TEXT`, message `No readable text was detected.`,
  `retryable=true` — client hiện lỗi + nút thử lại, không màn hình trắng.

## 2.2. AI live (2026-09-12, provider `gemini`) — ĐẠT

- Happy path: `POST /v1/ai/analyses` (câu EN ~80 ký tự,
  `prompt_version=lesson-analysis-v1`, kèm `Idempotency-Key`) → **202 trong
  233ms**, header `Retry-After: 1`, `status=queued`.
- Poll `GET /v1/ai/analyses/{id}` → **completed sau 4 lượt poll / 16s**
  (ngân sách client 75s): 6/6 stage `completed` (attempts=1, không retry),
  `schema_version=ai-output-v1`, bài học đầy đủ (dịch VI, IPA từng từ, 2 điểm
  ngữ pháp, 7 từ vựng, 5 câu luyện tập).
- Fallback quan sát được: `confirmed_text` rỗng → **400**,
  `error.code=VALIDATION_EMPTY_TEXT`, message tiếng Việt
  `Vui lòng nhập nội dung tiếng Anh.` — client chặn từ UI + quay về màn nhập
  giữ text, không nuốt lỗi.

## 2.3. YouTube live — BỊ CHẶN (blocker cụ thể, không phải fail)

- `POST /v1/youtube/transcripts` trên staging trả **404 của Fastify:
  `Route POST:/v1/youtube/transcripts not found`** — route không được đăng ký
  vì `YOUTUBE_ENABLED !== 'true'` trên staging (`api-server/src/server.ts:117`
  `if (env.youtubeEnabled)`). Mọi nhánh YouTube live (auto transcript, manual
  cues R2, timeout, rate limit) đều **không thể chạy** cho tới khi bật
  `YOUTUBE_ENABLED=true` (+ `YOUTUBE_API_KEY`) trên staging.
- Đây là chicken-and-egg với điều kiện đóng SETE-154 (đo chi phí 5 video mẫu
  _trước khi_ bật production): hướng giải là bật trên **staging trước** để đo,
  production vẫn tắt. Client đã sẵn sàng: retry 429/5xx + watchdog 10s
  (12 unit test mới, mục 2 bảng trên), đường lui thủ công giữ link
  (`YouTubeManualTranscript`) đã có test retry ở `YouTubeProcessingScreen`.

## 3. Timeout / rate limit / multi-worker / chi phí — kết luận xác thực

- **Timeout (live)**: OCR 2299ms « 30s; AI create 233ms « 10s, job xong 16s «
  75s. Ép timeout provider thật (proxy delay) không làm vì làm chậm shared
  staging; hành vi khi timeout đã chứng minh bằng unit test
  (`OCR_TIMEOUT`, `AI_POLL_GIVE_UP`, `youtube_timeout`).
- **Rate limit (không ép live — cố ý)**: giới hạn cấu hình trong code
  (`api-server/src/config/env.ts`): OCR 10 req/phút, AI 10 req/phút, YouTube 5
  req/phút (strict), cửa sổ 60s; quá hạn → **429 kèm header `Retry-After`**
  (`src/middleware/rateLimit.ts:51,61`). Ép 429 live = dội shared staging nên
  không làm; client gặp 429/5xx thì poll tiếp (đã test), không rớt ngay.
- **Backend multi-worker**: `deploy-staging.sh:67` và `deploy-production.sh:65`
  đều `--max-instances 1` với comment "job state is still in RAM" — nguy cơ
  job tạo ở instance A / poll trúng instance B hiện bị vô hiệu hoá bằng pin
  single-instance (đúng quyết định D2). Scale ngang **chưa được xác thực theo
  thiết kế**; track Postgres (`JobStore → async → Postgres`) phải xong trước
  khi mở người dùng thật.
- **Chi phí mỗi request**: response API không có trường token usage
  (`model` của AI luôn là label tĩnh `'staged-pipeline'`, không phải tên model
  thật) — chi phí chỉ đọc được từ Google AI / Cloud Vision / YouTube console.
  Đo trên 5 video mẫu + log billing vẫn mở (phụ thuộc gỡ blocker mục 2.3).
- Lệnh `npx jest` trong repo cần thêm `--watchman=false` ở môi trường này
  (watchman hệ thống lỗi `fchmod … Operation not permitted`, không liên quan code).

## 4. Runbook còn lại (sau khi gỡ blocker 2.3)

1. Bật `YOUTUBE_ENABLED=true` + `YOUTUBE_API_KEY` trên **staging only**,
   deploy lại, kiểm tra `POST /v1/youtube/transcripts` trả 202.
2. Dán link có phụ đề EN → expect transcript + dịch VI + IPA; nếu
   `TRANSCRIPT_SOURCE_BLOCKED` (IP Cloud Run bị YouTube chặn — rủi ro R1 đã
   chấp nhận) thì đi đường lui R2: giữ link, nạp file `.srt` tới màn học.
3. Đo chi phí Data API + LLM enrichment cho 5 video mẫu, ghi billing console.
4. Ép 429 tạo job (vượt 5 req/phút từ một IP test riêng, ngoài giờ) → expect
   429 + `Retry-After`, client poll tiếp và hồi phục.

Đóng issue khi: contract test xanh (có) + YouTube live đạt qua runbook trên +
số liệu chi phí/5 video được ghi lại.
