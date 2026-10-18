# Kiến trúc phát âm LingoBites

> Trạng thái: **ĐỀ XUẤT**, chưa được duyệt. Ngày: 2026-10-12.
> Repo: `LingoBites-App` và `LingoBites-Server`.
> Đi trước: `2026-10-11-speech-pronunciation-feedback-options.md` (so sánh hai hướng chấm).

Mục tiêu: người học nghe mẫu, ghi âm, nhận điểm theo từng từ và từng âm. Mỗi bước kết thúc ở trạng thái chạy được, không có bản tạm.

## 1. Quyết định chính

| Vấn đề | Đề xuất | Lý do |
|---|---|---|
| Bộ chấm | Azure Pronunciation Assessment (REST short audio) | Đo được phát âm theo từ và theo âm. OpenAI logprobs chỉ báo "máy không chắc", không phải điểm phát âm. |
| Cách tích hợp | Port `PronunciationAssessor` riêng, không tái dùng `evaluateUtterance` | `evaluateUtterance` chỉ so text với câu mẫu. Không đo được âm sai. |
| Định dạng audio | App giữ m4a. Server chuyển sang WAV 16 kHz mono bằng ffmpeg trong worker | Azure không nhận m4a. Không đổi máy ghi của app nên không ảnh hưởng luồng bài nói hiện có. |
| Dependency | Không thêm npm. ffmpeg là dependency hệ thống (cần duyệt) | `fetch` đủ cho REST. `child_process` gọi ffmpeg. |
| Lưu kết quả | Bảng mới `pronunciation_jobs`, `pronunciation_attempts` | Item không phải task, nên không thể đặt vào `evaluations` (cột `task_id` bắt buộc). |
| Bật tính năng | Cờ riêng `PRONUNCIATION_ENABLED`, mặc định `false` | Tách khỏi cờ `SPEECH_EVALUATION_ENABLED` để bật độc lập. |
| Trẻ em | Không gửi đi chấm máy | Đã có quy tắc A11. Kiểm tra ở server, không chỉ ở app. |

## 2. Sơ đồ hệ thống

```mermaid
flowchart LR
  subgraph APP["App (React Native)"]
    UI["Màn luyện phát âm"]
    TTS["ttsService: nghe mẫu"]
    REC["recordingService: ghi m4a"]
    Q["recordingUploadQueue"]
    POLL["Poll kết quả"]
  end
  subgraph API["Server API (Fastify)"]
    REQ["POST recordings (mode=pronunciation)"]
    DONE["Complete upload: tạo job"]
    GET["GET kết quả"]
    CAP["capabilities: cờ pronunciation"]
  end
  subgraph DATA["Dữ liệu"]
    DB[("Postgres: recordings, pronunciation_jobs, pronunciation_attempts")]
    OBJ[("Object storage: audio")]
  end
  subgraph WORKER["PronunciationWorker"]
    CLAIM["Claim job bằng lease"]
    TRANS["Transcode ffmpeg: WAV 16k mono"]
    ASSESS["PronunciationAssessor port"]
    SAVE["Lưu kết quả đã chuẩn hoá"]
  end
  AZ["Azure Speech: Pronunciation Assessment (REST)"]

  UI --> TTS
  UI --> REC --> Q
  Q -->|upload| OBJ
  Q --> REQ
  Q --> DONE
  DONE --> DB
  POLL --> GET --> DB
  CLAIM --> DB
  CLAIM --> OBJ
  CLAIM --> TRANS --> ASSESS --> AZ
  ASSESS --> SAVE --> DB
  CAP -. bật/tắt .-> UI
```

Worker là tiến trình riêng, dùng cơ chế lease giống `evaluation_jobs`. API không gọi Azure trực tiếp.

## 3. Luồng một lần luyện

```mermaid
sequenceDiagram
  autonumber
  participant U as Người học
  participant A as App
  participant S as API
  participant O as Object storage
  participant W as Worker
  participant F as ffmpeg
  participant Z as Azure

  U->>A: Bấm loa (nghe mẫu)
  A->>A: TTS en-US (ttsService)
  U->>A: Giữ để ghi (tối đa 15 s)
  A->>S: POST recordings (mode=pronunciation, item_id)
  S-->>A: upload target
  A->>O: PUT audio m4a
  A->>S: Complete upload
  S->>S: Tạo pronunciation_jobs (queued)
  W->>S: Claim job (lease 60 s)
  W->>O: Đọc audio
  W->>F: m4a sang WAV 16 kHz mono
  W->>Z: REST + Pronunciation-Assessment (ReferenceText = item.text)
  Z-->>W: Điểm câu, điểm từng từ, âm
  W->>S: Lưu attempt đã chuẩn hoá, xoá audio tạm
  A->>S: Poll GET kết quả
  S-->>A: Điểm và từ được tô màu
  A->>U: Hiện kết quả, nghe lại mẫu
```

## 4. Vòng đời một lần luyện

```mermaid
stateDiagram-v2
  [*] --> pending_upload
  pending_upload --> queued: complete upload
  pending_upload --> expired: quá upload_expires_at
  queued --> processing: worker claim
  processing --> scored: Azure trả kết quả hợp lệ
  processing --> queued: lỗi tạm (timeout, 429, 5xx), attempts < 2
  processing --> failed_retryable: hết lượt thử tạm
  processing --> unscorable: audio quá ngắn, im lặng, sai định dạng
  scored --> [*]
  unscorable --> [*]
  expired --> [*]
  failed_retryable --> queued: người học bấm thử lại
```

`unscorable` là kết quả hợp lệ, không phải lỗi. UI hiện lý do cụ thể ("Nói to hơn", "Ghi âm quá ngắn").

## 5. Dữ liệu

```mermaid
erDiagram
  RECORDINGS ||--o| PRONUNCIATION_JOBS : "1 job"
  RECORDINGS ||--o| PRONUNCIATION_ATTEMPTS : "1 kết quả"
  ITEMS ||--o{ PRONUNCIATION_ATTEMPTS : "luyện"
  USERS ||--o{ PRONUNCIATION_ATTEMPTS : "sở hữu"
  RECORDINGS {
    uuid id PK
    string mode "thêm giá trị pronunciation"
    uuid item_id "mới, nullable"
  }
  PRONUNCIATION_JOBS {
    uuid recording_id PK
    string status
    int attempts
    timestamp lease_expires_at
    string last_error
  }
  PRONUNCIATION_ATTEMPTS {
    uuid id PK
    uuid recording_id UK
    uuid item_id
    string reference_text
    int accuracy
    int fluency
    int completeness
    int prosody "null nếu không hỗ trợ"
    jsonb words "text, accuracy, error_type, phonemes"
    string provider
    string model_version
    int audio_ms
    int latency_ms
  }
```

Migration: thêm hai bảng và một cột nullable. Không đổi bảng `evaluations`. Kiểm tra ràng buộc check trên `recordings.mode` trước khi thêm giá trị mới. Không lưu bản chữ người học nói, chỉ lưu điểm và text mẫu.

## 6. Việc phải làm theo thành phần

### Server

| File / module | Việc |
|---|---|
| `common/pronunciation/assessor.ts` (mới) | Interface `PronunciationAssessor` và kiểu kết quả đã chuẩn hoá. Không lộ kiểu của Azure. |
| `common/pronunciation/azureAssessor.ts` (mới) | Adapter REST bằng `fetch`. Header `Pronunciation-Assessment` (base64 JSON). Lỗi chỉ mang mã HTTP, không mang body. |
| `common/audio/transcode.ts` (mới) | Gọi ffmpeg qua `child_process.spawn`: m4a sang WAV PCM 16 kHz mono. Có timeout và thư mục tạm riêng. |
| `modules/pronunciation/service/pronunciationWorker.ts` (mới) | Vòng claim và lease giống `evaluationWorker`. Đọc audio, transcode, gọi assessor, lưu, xoá audio tạm. |
| `modules/pronunciation/controller/` (mới) | GET kết quả theo `recording_id`. Chỉ trả về cho chủ sở hữu. |
| `modules/recordings/controller/recordings.ts` | Nhận `mode=pronunciation` và `item_id`. Khi complete upload thì tạo `pronunciation_jobs`. |
| `app/controller/capabilities.ts` | Thêm cờ `pronunciation` riêng, không dùng chung cờ `speech`. |
| `common/config/env.ts`, `.env.example` | `PRONUNCIATION_ENABLED` (mặc định false), `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `PRONUNCIATION_DAILY_LIMIT`. Secret không ghi giá trị thật. |
| Migration (mới) | Hai bảng mới, một cột nullable, một giá trị mới cho `mode`. |
| `Dockerfile` / deploy | Cài ffmpeg. Health check báo lỗi nếu không tìm thấy ffmpeg khi cờ bật. |

### App

| File / module | Việc |
|---|---|
| `features/pronunciation/` (mới) | Tính năng tách khỏi `speaking` và `lesson/player`: màn luyện, hook trạng thái, mapper kết quả. |
| Màn luyện | Nghe mẫu, ghi, upload, poll, hiện kết quả. Có nút thử lại và nghe lại mẫu. |
| Hiển thị kết quả | Tô màu từng từ theo ngưỡng. Từ sai thì mở các âm sai. Điểm câu hiện ở đầu. |
| `recordingService.ts` | Giữ m4a. Thêm giới hạn 15 s cho mode này. Không đổi cấu hình ghi âm. |
| `LessonPronunciationSection.tsx` | Thêm nút "Luyện phát âm" cho từng item, mở màn luyện. |
| `core/release/feature-registry.ts` | `pronunciationSupport` chuyển sang `ready` khi đã có đủ đầu cuối và được bật. |

### Phần nghe mẫu (đã làm, xem mục 7)

## 7. Trạng thái phần nghe mẫu (đã làm)

- `ttsService.speak` dừng tiếng đang đọc trước khi đọc mới, nên các lần bấm không chồng tiếng.
- Kết quả của `speak` không còn chuỗi tiếng Việt cứng trong `ttsService`. Chỉ trả về mã lỗi, UI dịch theo i18n.
- Hook `useSpeak` (`features/audio/logic/useSpeak.ts`):
  - báo lỗi tại chỗ trên màn bài học (`lesson-speech-notice`), thay vì nuốt lỗi như trước;
  - dừng tiếng khi màn đóng hoặc app xuống nền.
- Bài "Nghe và chọn" trong mục Phát âm: app đọc một từ của cặp, người học chọn từ đúng. Chấm đúng sai tuyệt đối, không cần chấm giọng. Logic nằm ở `minimalPairQuiz.ts`, có test.

**Đính chính:** tài liệu trước ghi "gỡ TtsSpike khỏi navigation của người dùng". Kiểm tra lại thì lối vào màn này nằm trong `__DEV__` ở `SupportAboutScreen.tsx`, nên người dùng production không thấy. Không cần gỡ.

**Chưa làm:** cache kiểm tra giọng en-US. Lần bấm nào cũng kiểm tra lại. Cache cần thiết kế lại cùng test, vì test hiện dùng mock chung.

**Đã sửa (2026-10-15) các lời gọi `speak` khác:** ôn tập (`DailyReviewScreen`, `ItemReviewScreen`), bài kiểm tra đầu vào (`PlacementTestScreen`) và các hoạt động trong bài (gợi ý, tự đánh giá nói, nhập vai, thẻ nghe, câu hỏi chọn) giờ đi qua `useSpeak` và hiện lý do khi không phát được (`SpeechNotice`). Các hoạt động lấy `speak` của màn bọc ngoài qua `SpeakContext` / `useScreenSpeak`. Ba màn bọc ngoài là bài 6 bước, nhiệm vụ tổng hợp unit và luyện bài tự tạo. Ngoài các màn đó, hoạt động vẫn phát được nhưng lỗi không hiện.

**Còn nuốt lỗi:** shadowing (`useShadowingSession`) chờ đọc xong rồi mới chạy tiếp, nên có luồng riêng, chưa đổi.

## 8. Quy tắc cố định

- **Trẻ em:** không gửi đi chấm máy (A11). Kiểm tra ở server.
- **Cờ:** `PRONUNCIATION_ENABLED=false` mặc định. Tắt cờ thì endpoint trả 403 và UI ẩn nút.
- **Riêng tư:** không log text người học nói, không log audio, không log nội dung response của Azure. Chỉ log mã lỗi và độ trễ.
- **Đồng ý:** mở màn ghi âm chỉ sau khi người học đồng ý gửi giọng sang Microsoft Azure. Cập nhật thông báo riêng tư nêu rõ bên xử lý này.
- **Giữ audio:** xoá audio tạm sau khi chấm, hoặc theo chính sách retention hiện có. Cần chốt.
- **Chi phí:** giới hạn số lần chấm mỗi người mỗi ngày. Lưu `audio_ms` để tính chi phí thật trong trang admin.

## 9. Lộ trình

| Bước | Nội dung | Điều kiện hoàn thành |
|---|---|---|
| 0 | Thử 50–100 clip trên Azure. Đo độ chính xác và chi phí thật. Không sửa code tính năng. | Bắt đúng đa số từ sai. Báo nhầm chấp nhận được. Có chi phí thật trên hóa đơn thử. Xác nhận endpoint và giới hạn độ dài. |
| 1 | Hoàn thiện nghe mẫu và bài "Nghe và chọn" | **Đã làm.** Test pass, lint sạch, `tsc` sạch. |
| 2 | Server: assessor, transcode, worker, API, migration, cờ | Test adapter với fetch giả, transcode với m4a mẫu, worker với assessor giả và lỗi tạm, endpoint người dùng khác trả 404. |
| 3 | App: màn luyện và hiển thị kết quả | Mapper với fixture đã chuẩn hoá. Màn với các trạng thái queued, scored, unscorable, failed. |
| 4 | Bật dần và đo | Bật cho tài khoản nội bộ, rồi nhóm nhỏ. Theo dõi tỉ lệ scored, độ trễ, chi phí mỗi lần, và phản hồi không đồng ý với kết quả. Ngưỡng màu chỉnh theo dữ liệu. |

## 10. Rủi ro và điều chưa xác minh

| Điểm | Trạng thái | Hướng xử lý |
|---|---|---|
| Giới hạn 30 s cho REST | Chưa xác nhận từ tài liệu chính thức | Thiết kế dùng tối đa 15 s nên không phụ thuộc. Kiểm tra ở bước 0. |
| Giá Azure | Nguồn mâu thuẫn: $0,30/giờ (add-on) hay $1/giờ (real-time). Trang giá Trung Quốc khác. | Không dựa vào con số nào. Đo trên hóa đơn thử ở bước 0. |
| Endpoint hỗ trợ chấm | Một nguồn cộng đồng nói fast transcription không hỗ trợ | Gọi đúng endpoint short-audio kèm header. Xác nhận bằng lần gọi thật ở bước 0. |
| ffmpeg | Dependency hệ thống mới | Cần duyệt. Cài trong image Docker. Health check. |
| Mở rộng sang shadowing, mẫu câu | Quyết định sản phẩm | Port và bảng đủ tổng quát, nhưng đợt này chỉ làm item phát âm. |

## 11. Cần quyết định trước bước 2

> 2026-10-18: đã chốt câu 1 (Azure) và câu 2 (đồng ý gửi giọng). Câu 3–5 có mặc định trong `2026-10-18-pronunciation-step2-server-plan.md`, chờ duyệt.

1. Engine: đồng ý dùng Azure Pronunciation Assessment, hay chỉ cần "máy không nghe rõ" (khi đó dùng logprobs và ghi rõ trên UI là không phải điểm phát âm)?
2. Chấp nhận gửi giọng người học tới Microsoft Azure và cập nhật consent, thông báo riêng tư?
3. Duyệt cài ffmpeg trong image Docker?
4. Giữ audio: xoá ngay sau khi chấm, hay theo chính sách bản ghi âm hiện tại?
5. Ngân sách: số lần chấm tối đa mỗi người mỗi ngày, và trần chi phí mỗi tháng?
