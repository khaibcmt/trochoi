# Tích Hợp Engine Tự Động Chữa Lỗi Dính Dòng & Giữ Nguyên Gạch Chân Cho 3 Khung

Bổ sung và nâng cấp bộ xử lý dán văn bản (Paste Engine) cho 3 khung câu hỏi (Phần I: Trắc nghiệm 4 phương án, Phần II: Đúng/Sai 4 ý, Phần III: Trả lời ngắn) giúp tự động tách các phương án bị dính dòng từ Word/PDF, giữ nguyên thẻ gạch chân `<u>...</u>`, bảo toàn ảnh minh họa/bảng số liệu và tự động đánh lại số thứ tự `Câu 1, Câu 2...` liên tục kèm cập nhật tức thì lên Bảng xem trước.

## User Review & Critical Decisions

> [!IMPORTANT]
> Các quyết định đã được Thầy xác nhận ở bước làm rõ yêu cầu:

- **Phương thức tích hợp**: Tích hợp trực tiếp 3 bộ lọc (`cleanKhung1HTML`, `cleanKhung2HTML`, `cleanKhung3HTML`) vào bộ xử lý sự kiện Paste của 3 khung soạn thảo React, đồng thời giữ nguyên khả năng dán ảnh chụp màn hình (`<img>`), bảng số liệu (`<table>`) và công thức(`<sub>`, `<sup>`).
- **Đánh số câu hỏi & Đồng bộ**: Khi dán thêm câu hỏi mới vào bất kỳ khung nào, hệ thống tự động chuẩn hóa, đánh lại số thứ tự `Câu 1, Câu 2...` liên tục từ đầu đến cuối trong khung đó và cập nhật ngay lập tức lên Bảng kiểm tra xem trước cùng bộ đếm câu hỏi.

## 1. Overview & Core Concept

- **Chức năng chính**: Giải quyết triệt để tình trạng giáo viên sao chép (Copy/Paste) đề thi từ Microsoft Word, PDF hoặc Zalo bị dính liền các phương án `A. B. C. D.` hoặc `a) b) c) d)` trên cùng một hàng ngang, hoặc bị mất định dạng gạch chân đáp án đúng.
- **Đối tượng sử dụng**: Giáo viên các bộ môn THPT (GDPT 2018) soạn và nạp đề thi nhanh vào hệ thống Đấu Trường 3D Pro.
- **Giá trị cốt lõi**: Dán đề 1-click sạch đẹp, tách dòng chuẩn xác cho cả 3 dạng thức, giữ nguyên 100% đáp án gạch chân và tự động đánh số lại câu hỏi liên tục.

## 2. User Experience & Visual Design

- **Luồng trải nghiệm của Giáo viên**:
  1. Giáo viên copy một hoặc nhiều câu hỏi từ file Word/PDF (có thể bị dính dòng ngang `A. ... B. ... C. ... D. ...` và có gạch chân đáp án đúng).
  2. Giáo viên nhấn `Ctrl + V` (Paste) vào **Khung 1 (Trắc nghiệm)**, **Khung 2 (Đúng/Sai)** hoặc **Khung 3 (Trả lời ngắn)**.
  3. Hệ thống tự động nhận diện loại khung hoặc cấu trúc câu hỏi:
     - Chuyển đổi mọi kiểu gạch chân của Word (`<span style="text-decoration: underline">`, `<ins>`, `<u>`) về thẻ `<u>...</u>` chuẩn.
     - Bảo vệ các thẻ `<img>`, `<table>`, `<sub>`, `<sup>` nếu có trong câu hỏi.
     - Tách riêng tiêu đề câu hỏi và từng phương án `A, B, C, D` (Khung 1), `a), b), c), d)` (Khung 2), hoặc `Đáp án:` (Khung 3) xuống từng dòng `<div>` riêng biệt.
     - Tự động gộp với các câu hiện có trong khung, đánh lại số thứ tự `Câu 1:`, `Câu 2:`, `Câu 3:` liên tục và cập nhật ngay lên thanh thống kê cùng Bảng xem trước.
- **Giao diện & Hiển thị**:
  - Giữ nguyên bố cục 3 khung màu sắc đặc trưng chuẩn GDPT 2018 (`--primary` Xanh Dương cho Khung 1, Tím cho Khung 2, Xanh Lục cho Khung 3).
  - Các câu hỏi sau khi dán có tiêu đề `<b>Câu X:</b>` rõ ràng, mỗi phương án nằm trên 1 dòng sạch sẽ, phương án đúng được gạch chân `<u>` nổi bật.

## 3. Key Product Decisions & Trade-Offs

- **Quyết định 1: Kết hợp Regex bóc tách dính dòng với cơ chế bảo toàn thẻ HTML học liệu (`<img>`, `<table>`, `<sub>`, `<sup>`)**
  - *Cách tiếp cận*: Trước khi lọc bỏ thẻ rác (`<span>`, `<font>`, `mso-*`) của Word, hệ thống mã hóa tạm (tokenize) các thẻ `<img>`, `<table>`, `<sub>`, `<sup>` và chuyển mọi kiểu gạch chân CSS thành `<u>...</u>`. Sau khi tách câu và phương án bằng Regex, hệ thống khôi phục lại các thẻ học liệu.
  - *Lý do*: Đảm bảo công thức Hóa học ($H_2SO_4$), Toán/Lý ($x^2$), bảng số liệu Địa/Sinh và hình ảnh không bị mất khi làm sạch rác HTML từ Word.
- **Quyết định 2: Tự động đánh lại số thứ tự liên tục (`Câu 1, Câu 2...`) sau mỗi lần Paste**
  - *Cách tiếp cận*: Sau khi chèn nội dung đã làm sạch vào khung, hệ thống quét lại toàn bộ danh sách câu hỏi trong khung đó để đánh số lại từ `Câu 1:` đến `Câu N:` và đồng bộ ngay với `syncEditorQuestionsLive()`.
  - *Lý do*: Khi giáo viên copy-paste nhiều lần từ nhiều đề khác nhau (ví dụ dán Câu 5, Câu 8 từ đề gốc), khung soạn thảo vẫn tự động sắp xếp thành Câu 1, Câu 2... liền mạch, không bị trùng hay nhảy số.

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Sơ đồ kiến trúc xử lý sự kiện Paste**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│                Sự kiện Paste (Ctrl+V) trên Khung 1 / 2 / 3              │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Kiểm tra dữ liệu Clipboard:                                          │
│    • Nếu là File Ảnh trực tiếp (Snipping Tool/Zalo) ➔ Nén & Chèn <img>  │
│    • Nếu là Văn bản / HTML từ Word, PDF, Web ➔ Chuyển sang Bộ Lọc       │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. Bộ Lọc Chữa Lỗi Dính Dòng & Giữ Gạch Chân (Theo Khung):              │
│    ├── Khung 1: cleanKhung1HTML (Tách Câu + A. B. C. D. + Giữ <u>)      │
│    ├── Khung 2: cleanKhung2HTML (Tách Câu + a) b) c) d) + Giữ <u>)      │
│    └── Khung 3: cleanKhung3HTML (Tách Câu + Đáp án/Đáp số + Bọc <u>)    │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. Chèn HTML sạch & Đánh lại số thứ tự liên tục (Câu 1, Câu 2...):      │
│    • Đánh lại số thứ tự liền mạch toàn bộ câu trong khung               │
│    • Gọi syncEditorQuestionsLive() cập nhật Bảng Xem Trước & Bác Sĩ Đề  │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Chi tiết xử lý tương tác & Trạng thái**:
  - `cleanKhung1HTML(htmlInput, textInput, startIndex)`: Chuẩn hóa `text-decoration: underline` thành `<u>`, bảo toàn thẻ `<u>`, `<sub>`, `<sup>`, `<img>`, `<table>`, tách từng khối câu hỏi và dùng Regex `/(?:^|[\s\t\n])([A-D])[\.\:\)]\s*([\s\S]*?)(?=(?:[\s\t\n]+[A-D][\.\:\)]|$))/g` để tách rời 4 phương án A, B, C, D dù dính trên 1 dòng.
  - `cleanKhung2HTML(htmlInput, textInput, startIndex)`: Chuẩn hóa thẻ gạch chân `<u>` cho các mệnh đề Đúng/Sai, dùng Regex tách rời 4 ý `a), b), c), d)` dù bị dính dòng ngang.
  - `cleanKhung3HTML(htmlInput, textInput, startIndex)`: Tách câu hỏi và nhận diện `Đáp án:` / `Đáp số:`, tự động bọc `<u>` cho giá trị đáp án ngắn.
  - Tự động đánh số thứ tự liên tục (`renumberEditorBoxQuestions`) cho toàn bộ câu trong khung sau khi dán và đồng bộ ngay lập tức với `livePreviewItems`.
