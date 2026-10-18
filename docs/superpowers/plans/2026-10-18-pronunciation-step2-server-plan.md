# Bước 2: Server chấm phát âm bằng Azure

> Trạng thái: **KẾ HOẠCH, CHỜ DUYỆT**. Ngày: 2026-10-18.
> Repo: `LingoBites-Server`.
> Đi trước: `2026-10-12-pronunciation-architecture.md` (kiến trúc), `2026-10-18-azure-pronunciation-setup.md` (đăng ký Azure).

## 0. Đã chốt

- Engine: **Azure Pronunciation Assessment**, REST short audio.
- Đồng ý gửi giọng người học (không phải trẻ em) tới Microsoft Azure. Màn xin đồng ý và thông báo riêng tư làm ở bước 3 (app). Server chỉ chặn trẻ em và chặn khi cờ tắt.

## 1. Còn cần chốt (plan dùng mặc định dưới đây nếu không có ý kiến khác)

| # | Câu hỏi | Mặc định trong plan |
|---|---|---|
| 1 | Cài ffmpeg vào image Docker | Có. `apt-get install ffmpeg` ở stage runtime. Image tăng khoảng vài chục tới hơn 100 MB, cần đo khi build. |
| 2 | Giữ audio | Xoá audio (object + dòng `recordings`) ngay khi job kết thúc, kể cả lỗi. Chỉ giữ điểm. |
| 3 | Giới hạn mỗi ngày | 20 lần chấm mỗi người mỗi ngày (giờ Việt Nam), đặt qua hệ thống hạn mức có sẵn (`LIMIT_KEYS`), chỉnh được theo gói và theo từng người. |
| 4 | Trần chi phí tháng | Đặt bằng Budget alert trên Azure (xem tài liệu đăng ký), chưa chặn trong code. |
| 5 | Câu mẫu | Chỉ `items.text` của item `kind = pronunciation` đã publish. Cặp tối thiểu và câu ví dụ để sau. |

## 2. Khác so với tài liệu kiến trúc

- **Giới hạn mỗi ngày** dùng `consumeDaily` / `refundDaily` (`src/modules/plans/service/usageCounter.ts`) với khoá mới `pronunciation.daily_assessments`, thay vì biến môi trường `PRONUNCIATION_DAILY_LIMIT`. Lý do: đã có sẵn, chống đếm trùng khi hai job chạy cùng lúc, chỉnh được theo gói.
- **Bỏ trạng thái `failed_retryable` có nút thử lại trên cùng audio.** Job hết lượt thử thì kết thúc là `failed`, audio bị xoá. App cho người học ghi lại. Ít code hơn, không phải giữ audio.
- **`pronunciation_attempts.recording_id` không có khoá ngoại.** Vì audio và dòng `recordings` bị xoá sau khi chấm, kết quả vẫn tra được theo `recording_id`.

## 3. Chia PR

Mỗi PR chạy được, test xanh, cờ vẫn tắt.

### PR 2.1: Dữ liệu, cấu hình, cờ

| File | Việc |
|---|---|
| `src/common/database/migrations/034_pronunciation.sql` (+ `.down.sql`) | Xem mục 4. |
| `prisma/schema.prisma` | Thêm `itemId` vào `Recordings`, model `PronunciationJobs`, `PronunciationAttempts`. Chạy `prisma generate`. |
| `src/common/config/env.ts`, `.env.example` | `PRONUNCIATION_ENABLED` (mặc định `false`), `PRONUNCIATION_PROVIDER` (`mock` \| `azure`), `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `PRONUNCIATION_COST_PER_MINUTE_USD`. Cờ bật + provider `azure` mà thiếu key/region thì server không khởi động (giống `STT_API_KEY`). |
| `src/modules/plans/model/limitKeys.ts` | Khoá `pronunciation.daily_assessments`, mặc định 20, tối đa 1000. |
| `src/app/controller/capabilities.ts` | Thêm `capabilities.pronunciation.enabled`. Trường mới, app cũ bỏ qua được. |
| `src/modules/admin/repository/adminStore.ts` | Khi gộp tài khoản, chuyển `user_id` trong hai bảng mới (giống dòng `evaluation_jobs` đang có). |
| `deploy-production.sh`, `deploy-staging.sh` | Thêm `AZURE_SPEECH_KEY=AZURE_SPEECH_KEY:latest` vào danh sách secret. Không ghi giá trị. |

Test: migration lên/xuống trên DB test, env thiếu key thì lỗi, capabilities trả `pronunciation.enabled=false` mặc định.

### PR 2.2: Cổng chấm và adapter Azure

| File | Việc |
|---|---|
| `src/common/pronunciation/assessor.ts` (mới) | Interface `PronunciationAssessor { provider; assess(input) }`. Input: `wav: Buffer`, `referenceText`, `locale: 'en-US'`. Output đã chuẩn hoá (mục 5). Lỗi `AssessRetryableError` / `AssessFatalError` giống `SttRetryableError` / `SttFatalError`. |
| `src/common/pronunciation/azureAssessor.ts` (mới) | `fetch` tới endpoint short audio. Header `Ocp-Apim-Subscription-Key`, `Content-Type: audio/wav; codecs=audio/pcm; samplerate=16000`, `Pronunciation-Assessment` (base64 JSON). Timeout 20 s. 408/409/429/5xx là lỗi tạm, còn lại là lỗi hẳn. Lỗi chỉ mang mã HTTP, không đọc body vào log. Đọc được cả hai dạng response (điểm nằm trong `PronunciationAssessment` hoặc nằm thẳng trong `NBest[0]`). |
| `src/common/pronunciation/mockAssessor.ts` (mới) | Trả điểm cố định theo `referenceText`, dùng cho test và dev. |
| `src/common/pronunciation/index.ts` (mới) | `createPronunciationAssessor(env)`. |

Test (`test/pronunciationAssessor.test.ts`): header đúng (giải base64 ra JSON đúng `ReferenceText`), map response mẫu ra kết quả chuẩn, `NoMatch` / `InitialSilenceTimeout` ra `unscorable: no_speech`, 429 là lỗi tạm, 401 là lỗi hẳn, timeout là lỗi tạm. Dùng `fetch` giả, không gọi Azure thật. Fixture response lấy từ lần gọi thật ở bước 0 (đã xoá mọi thứ ngoài điểm).

### PR 2.3: Chuyển định dạng audio

| File | Việc |
|---|---|
| `src/common/audio/transcode.ts` (mới) | `toWav16kMono(bytes, mimeType)`: `spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-ac', '1', '-ar', '16000', '-f', 'wav', '-acodec', 'pcm_s16le', 'pipe:1'])`. Đầu vào qua stdin, không ghi file tạm. Timeout 10 s thì kill. Giới hạn kích thước đầu ra. Lỗi ffmpeg chỉ trả mã `TRANSCODE_FAILED`, không log stderr (có thể chứa metadata). `ffmpegAvailable()` chạy `ffmpeg -version` một lần, nhớ kết quả. |
| `deploy/api/Dockerfile` | Stage runtime: `apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*`. |
| `src/app/controller/health.ts` hoặc lúc khởi động | Cờ bật mà không có ffmpeg thì log lỗi một lần và capabilities trả `pronunciation.enabled=false`, thay vì để mọi job lỗi. Không làm `/health` trả lỗi, để Cloud Run không khởi động lại liên tục. |

Test: file m4a ngắn mẫu trong `test/fixtures/` ra WAV có header 16 kHz mono; bytes rác ra `TRANSCODE_FAILED`. Test bỏ qua (skip có lý do) khi máy test không có ffmpeg, và `scripts/ensure-test-prerequisites.mjs` báo cần cài.

### PR 2.4: Worker, API, nối luồng

| File | Việc |
|---|---|
| `src/modules/recordings/model/recordings.ts` | Schema tạo bản ghi `mode = pronunciation`: `client_recording_id`, `item_id`, `duration_ms` (≤ 15 000), `mime_type`, `byte_size`, `sha256`. |
| `src/modules/recordings/controller/recordings.ts` | Nhánh `createPronunciation` giống `createLessonTask`: cờ tắt hoặc tài khoản trẻ em thì 403 `PRONUNCIATION_DISABLED` (A11); item không có / chưa publish / không phải `pronunciation` thì 404 `PRONUNCIATION_ITEM_NOT_FOUND`. Khi upload xong và `mode = pronunciation` thì gọi `deps.onPronunciationUploaded?.()` để đánh thức worker. |
| `src/modules/recordings/repository/store.ts` | `createRecording` nhận `itemId`. `completeRecording` tạo dòng `pronunciation_jobs` trong cùng transaction, ngay chỗ đang tạo `evaluation_jobs` (dòng ~405). |
| `src/modules/pronunciation/service/pronunciationWorker.ts` (mới) | Mục 6. |
| `src/modules/pronunciation/repository/pronunciationStore.ts` (mới) | Lưu attempt, tìm attempt theo `(user_id, recording_id)`, tìm kết quả cũ theo `sha256 + item_id`. |
| `src/modules/pronunciation/controller/pronunciation.ts` (mới) | `GET /v1/pronunciation/attempts/:recordingId`. Chưa có kết quả mà job còn chạy thì `200 { status: 'pending' }`. Của người khác hoặc không có thì 404. Cờ tắt thì 403. |
| `src/app/server.ts` | Khởi tạo `PronunciationWorker` như `EvaluationWorker` (tắt bằng `PRONUNCIATION_WORKER_ENABLED=false` trong test), đăng ký route, nối `onPronunciationUploaded`. |

Test (`test/pronunciation*.test.ts`, có DB):
- tạo bản ghi: cờ tắt 403, tài khoản trẻ em 403, item sai 404, quá 15 s 400;
- worker với assessor giả: kết quả `scored` được lưu, audio bị xoá; lỗi tạm thì xếp lại, lần hai vẫn lỗi thì `failed` và trả lượt hạn mức; quá hạn mức thì `unscorable: limit`; dưới 0,5 s thì `too_short`; cùng audio cùng item thì chép kết quả cũ, không gọi Azure, không trừ hạn mức;
- GET: chủ sở hữu thấy kết quả, người khác 404.

## 4. Migration `034_pronunciation.sql`

```sql
-- Phát âm bước 2: bản ghi luyện một item phát âm, chấm bằng Azure.
ALTER TABLE recordings
    ADD COLUMN item_id uuid REFERENCES items(id) ON DELETE CASCADE,
    DROP CONSTRAINT recordings_mode_check,
    DROP CONSTRAINT recordings_duration_ms_check,
    DROP CONSTRAINT recordings_target_check;

ALTER TABLE recordings
    ADD CONSTRAINT recordings_mode_check CHECK (mode = ANY (ARRAY[
        'shadowing','quick_answer','standup','app_description','bug_report',
        'mock_interview','lesson_task','pronunciation']::text[])),
    ADD CONSTRAINT recordings_duration_ms_check CHECK (
        duration_ms >= 1 AND duration_ms <= (CASE
            WHEN mode = 'lesson_task' THEN 90000
            WHEN mode = 'pronunciation' THEN 15000
            ELSE 35000 END)),
    ADD CONSTRAINT recordings_target_check CHECK (CASE
        WHEN mode = 'lesson_task' THEN <giữ nguyên điều kiện ở 010>
        WHEN mode = 'pronunciation' THEN
            item_id IS NOT NULL AND lesson_id IS NULL AND sentence_id IS NULL
            AND attempt_id IS NULL AND task_id IS NULL
        ELSE <giữ nguyên điều kiện ở 010> AND item_id IS NULL
    END);

CREATE TABLE pronunciation_jobs (
    -- giống evaluation_jobs: recording_id PK, user_id, status
    -- queued|processing|done, attempts, lease_expires_at, last_error, timestamps
);

CREATE TABLE pronunciation_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recording_id uuid NOT NULL,          -- không FK: bản ghi bị xoá sau khi chấm
    item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    sha256 char(64) NOT NULL,            -- để chép kết quả khi gửi lại cùng audio
    status varchar(12) NOT NULL CHECK (status IN ('scored','unscorable','failed')),
    unscorable_reason varchar(16),       -- too_short | no_speech | limit | target_gone
    reference_text varchar(500) NOT NULL,
    pron_score smallint, accuracy smallint, fluency smallint,
    completeness smallint, prosody smallint,
    words jsonb NOT NULL DEFAULT '[]',
    provider varchar(16) NOT NULL,
    audio_ms integer NOT NULL,
    latency_ms integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, recording_id)
);
CREATE INDEX pronunciation_attempts_user_item_idx
    ON pronunciation_attempts (user_id, item_id, created_at DESC);
```

**Rủi ro migration:** viết lại ba ràng buộc check trên bảng `recordings` đang có dữ liệu. Postgres kiểm tra lại mọi dòng khi thêm check, bảng lớn thì khoá lâu. Chạy thử trên bản sao staging trước. Bản `.down.sql` xoá dòng `mode = pronunciation`, xoá hai bảng, trả lại ba check như 010.

## 5. Kết quả đã chuẩn hoá (API trả cho app)

```jsonc
{
  "status": "scored",            // pending | scored | unscorable | failed
  "unscorable_reason": null,
  "reference_text": "ship",
  "scores": { "pron": 82, "accuracy": 85, "fluency": 90, "completeness": 100, "prosody": null },
  "words": [
    {
      "text": "ship",
      "accuracy": 62,
      "error": "mispronunciation",   // none | mispronunciation | omission | insertion
      "phonemes": [ { "ipa": "ʃ", "accuracy": 40 }, { "ipa": "ɪ", "accuracy": 88 }, { "ipa": "p", "accuracy": 90 } ]
    }
  ]
}
```

Không trả, không lưu chữ máy nghe được (`Display`, `Lexical`). Từ có lỗi `insertion` là từ người học nói thêm. Không lưu `text` của từ này (vì đó là lời người học), chỉ lưu `error: insertion`.

## 6. Worker

Theo khuôn `EvaluationWorker` (lease 60 s, `FOR UPDATE SKIP LOCKED`, tối đa 2 lượt thử):

1. Claim job. Đọc dòng `recordings`. Không có hoặc sai mode thì kết thúc `recording_gone`.
2. Đã có attempt cho `recording_id` này thì kết thúc (chạy lại an toàn).
3. Đọc item. Không còn hoặc không còn publish thì `unscorable: target_gone`.
4. Hết lượt thử thì `failed`, trả lại lượt hạn mức nếu đã trừ.
5. `duration_ms < 500` thì `unscorable: too_short`.
6. Cùng `sha256` và cùng item đã có kết quả `scored` thì chép lại, không gọi Azure, không trừ hạn mức.
7. `consumeDaily(..., 'pronunciation.daily_assessments', limit)`. Hết lượt thì `unscorable: limit`.
8. Đọc audio, `toWav16kMono`, `assessor.assess`. Lỗi tạm và còn lượt thì xếp lại (giữ lượt hạn mức đã trừ cho lần sau, không trừ thêm). Lỗi hẳn thì `failed` và `refundDaily`.
9. Lưu attempt, kết thúc job, xoá object audio và dòng `recordings` (mặc định ở mục 1.2).

Log chỉ có `recordingId`, mã lỗi, độ trễ. Không log text, audio, body của Azure.

## 7. Kiểm tra trước khi coi bước 2 là xong

- `yarn lint`, `yarn format`, `tsc`, `yarn test`, `yarn test:db` sạch.
- Build image Docker, chạy được `ffmpeg -version` trong container, ghi lại kích thước image tăng bao nhiêu.
- Trên staging, bật cờ cho tài khoản nội bộ, gọi API bằng `curl` với một file m4a thật, nhận `scored`. Xoá audio đã thực hiện (object không còn trong bucket).
- Bảng chi phí: `audio_ms` cộng dồn khớp với số phút trên Azure Cost Management sau một ngày.

## 8. Ngoài phạm vi bước 2

- Màn luyện, đồng ý gửi giọng, thông báo riêng tư: bước 3 (app).
- Trang admin chi phí phát âm: sau khi có dữ liệu thật.
- Chấm câu ví dụ, cặp tối thiểu, shadowing.
