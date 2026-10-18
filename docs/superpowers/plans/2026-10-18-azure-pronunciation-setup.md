# Đăng ký Azure Speech cho chấm phát âm

> Ngày: 2026-10-18. Dùng cho bước 0 (thử 50–100 clip) và bước 2 (server).
> Đi kèm: `2026-10-18-pronunciation-step2-server-plan.md`.
> Chỗ ghi **[kiểm tra]** là thông tin chưa đối chiếu được với trang chính thức lúc viết. Xác nhận khi làm bước 0.

## 1. Cần lấy gì từ Azure

| Thông tin | Lấy ở đâu | Dùng ở đâu |
|---|---|---|
| **Key** (KEY 1, dự phòng KEY 2) | Resource Speech → *Keys and Endpoint* | Secret `AZURE_SPEECH_KEY` (GCP Secret Manager). Không đưa vào git, không đưa vào app. |
| **Region** (ví dụ `southeastasia`) | Cùng trang, mục *Location/Region* | `AZURE_SPEECH_REGION`. Dùng để ghép URL. |
| **Pricing tier** (F0 hoặc S0) | Trang *Overview* của resource | Biết hạn mức miễn phí và giá. |
| **Subscription ID, Resource group** | Trang *Overview* | Đặt Budget alert, xem hoá đơn. |

App **không** cần bất kỳ thông tin nào từ Azure. Chỉ server gọi Azure.

Hai resource riêng: một cho staging, một cho production. Như vậy key bị lộ ở staging không ảnh hưởng production, và chi phí tách được.

## 2. Các bước đăng ký

1. **Tạo tài khoản Azure.** Vào https://azure.microsoft.com/free, đăng nhập bằng tài khoản Microsoft (nên dùng email công ty, không dùng email cá nhân). Cần số điện thoại và thẻ thanh toán quốc tế để xác minh. Tài khoản mới thường được tín dụng dùng thử **[kiểm tra]**.
2. **Chọn subscription.** Sau thời gian dùng thử, chuyển sang *Pay-As-You-Go*, nếu không resource S0 sẽ ngừng chạy.
3. **Tạo resource group.** Portal (https://portal.azure.com) → *Resource groups* → *Create*. Tên gợi ý: `lingobites-speech`. Region: `Southeast Asia`.
4. **Tạo resource Speech.** *Create a resource* → tìm **"Speech"** (Azure AI services → Speech service, không chọn "Azure AI services" đa dịch vụ để hoá đơn tách riêng).
   - Resource group: `lingobites-speech`.
   - Region: **Southeast Asia** (Singapore, gần Việt Nam nhất). Pronunciation Assessment cho `en-US` có ở region này **[kiểm tra]**; nếu không, chọn `East Asia` hoặc `East US`.
   - Name: `lingobites-speech-staging` (lần hai: `lingobites-speech-prod`).
   - Pricing tier: **Free F0** cho staging và bước 0 (mỗi subscription chỉ được một resource F0; giới hạn khoảng 5 giờ audio mỗi tháng và số request đồng thời thấp **[kiểm tra]**). **Standard S0** cho production.
   - Network: để *All networks* (server Cloud Run không có IP cố định).
5. **Lấy key và region.** Mở resource → *Keys and Endpoint*. Chép KEY 1 và *Location/Region*. Không chụp màn hình gửi qua chat.
6. **Đặt ngân sách.** *Cost Management* → *Budgets* → *Add*. Scope: resource group `lingobites-speech`. Đặt mức theo tháng (ví dụ 20 USD lúc thử) và cảnh báo email ở 50 %, 80 %, 100 %. Budget chỉ gửi cảnh báo, không tự chặn; chặn thật nằm ở hạn mức mỗi người trong server.
7. **Lưu key vào GCP Secret Manager** (người có quyền GCP làm):
   ```bash
   printf '%s' '<KEY 1>' | gcloud secrets create AZURE_SPEECH_KEY \
     --project <GCP_PROJECT_ID> --data-file=-
   ```
   Làm riêng cho project staging và production. Region không phải bí mật, đặt bằng biến môi trường thường.
8. **Đọc điều khoản dữ liệu.** Đọc trang *Data, privacy, and security for Speech to text* của Microsoft. Ghi lại: audio gửi qua REST short audio có bị lưu hay không, lưu ở đâu, bao lâu **[kiểm tra]**. Đưa nội dung này và link vào thông báo riêng tư của app (bước 3).

## 3. Gọi thử (bước 0)

Chuẩn bị một file WAV 16 kHz mono từ bản ghi m4a của app:

```bash
ffmpeg -i sample.m4a -ac 1 -ar 16000 -acodec pcm_s16le sample.wav
```

Tạo header `Pronunciation-Assessment` (JSON rồi base64, một dòng):

```bash
PA=$(printf '%s' '{"ReferenceText":"ship","GradingSystem":"HundredMark","Granularity":"Phoneme","Dimension":"Comprehensive","EnableMiscue":true,"PhonemeAlphabet":"IPA"}' | base64 -w0)
```

Gọi endpoint short audio:

```bash
curl -sS -X POST \
  "https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed" \
  -H "Ocp-Apim-Subscription-Key: ${AZURE_SPEECH_KEY}" \
  -H "Content-Type: audio/wav; codecs=audio/pcm; samplerate=16000" \
  -H "Accept: application/json" \
  -H "Pronunciation-Assessment: ${PA}" \
  --data-binary @sample.wav
```

Đặt key bằng `read -s AZURE_SPEECH_KEY` để không lưu vào lịch sử shell.

Kết quả mong đợi (rút gọn):

```jsonc
{
  "RecognitionStatus": "Success",          // NoMatch, InitialSilenceTimeout, BabbleTimeout, Error
  "NBest": [{
    "PronunciationAssessment": {           // có bản đặt các điểm thẳng trong NBest[0] [kiểm tra]
      "AccuracyScore": 85, "FluencyScore": 90, "CompletenessScore": 100, "PronScore": 88
    },
    "Words": [{
      "Word": "ship",
      "PronunciationAssessment": { "AccuracyScore": 62, "ErrorType": "Mispronunciation" },
      "Phonemes": [{ "Phoneme": "ʃ", "PronunciationAssessment": { "AccuracyScore": 40 } }]
    }]
  }]
}
```

### Cần ghi lại ở bước 0

| Điều cần xác nhận | Cách |
|---|---|
| Endpoint trên trả điểm phát âm (không phải chỉ chữ) | Response có `AccuracyScore` theo từ |
| `PhonemeAlphabet: IPA` chạy được qua REST | Trường `Phoneme` là ký hiệu IPA, không phải SAPI (`sh`, `ih`) |
| Có điểm ngữ điệu (`EnableProsodyAssessment`) qua REST không | Thêm `"EnableProsodyAssessment":true`, xem có `ProsodyScore` |
| Giới hạn độ dài | Đã tìm thấy: REST short audio nhận tới 60 s, riêng chấm phát âm tối đa 30 s. Server giới hạn 15 s nên đủ. |
| Độ trễ | Ghi thời gian mỗi lần gọi (mục tiêu dưới 3 s cho clip 5 s) |
| Chi phí thật | Sau 1–2 ngày, xem *Cost Management* → *Cost analysis*, lọc theo resource. Chia cho tổng phút audio đã gửi. Các nguồn giá đang mâu thuẫn ($0,30/giờ hay $1/giờ), chỉ tin hoá đơn. |
| Độ chính xác | 50–100 clip: người Việt đọc đúng và cố tình đọc sai (`ship`/`sheep`, `think`/`sink`, âm cuối `-s`, `-ed`). Đếm số từ sai được bắt và số từ đúng bị báo sai. |
| Fast transcription | Một trả lời trên Microsoft Q&A nói endpoint fast transcription không hỗ trợ chấm phát âm. Không dùng endpoint đó. |

Lưu response mẫu (đã bỏ `Display`, `Lexical`, `ITN`) làm fixture cho test adapter ở PR 2.2.

## 4. Biến môi trường server

```dotenv
PRONUNCIATION_ENABLED=false            # bật khi đã xong bước 2 và 3
PRONUNCIATION_PROVIDER=azure           # mock trong test
AZURE_SPEECH_KEY=                      # secret, chỉ qua Secret Manager
AZURE_SPEECH_REGION=southeastasia
PRONUNCIATION_COST_PER_MINUTE_USD=     # điền sau khi có hoá đơn thật
```

## 5. Vận hành

- **Đổi key:** đổi app sang KEY 2 (cập nhật secret, deploy lại), rồi *Regenerate* KEY 1. Làm khi có người rời nhóm hoặc nghi lộ key.
- **Key lộ:** Regenerate ngay cả hai key, cập nhật secret, deploy.
- **Hạn mức Azure:** S0 có giới hạn số request đồng thời. Worker chạy từng job một nên không chạm tới lúc đầu. Khi nhiều người dùng, xem lỗi 429 trong log (`last_error = HTTP_429`) rồi mới xin nâng.
