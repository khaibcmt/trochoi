# Đấu Trường 3D: Kéo Co, Rung Chuông Vàng & Ai Nhanh Nhất
**Tác giả:** Thầy Hồ Tấn Khải – Trường THPT Mang Thít

Hệ thống thi đấu và học tập tương tác 3D đa người chơi theo thời gian thực dành cho 12 môn học cấp THPT (Chương trình GDPT 2018).

## Tính năng chính

1. **3 Chế độ thi đấu 3D:**
   - **Kéo Co 3D (Đồng đội 3 hiệp):** Đội Đỏ vs Đội Xanh đối đầu qua 3 bối cảnh thời gian (Ban ngày ➔ Hoàng hôn ➔ Đêm sân vận động). Đội nào dẫn trước 3 câu thắng hiệp, thắng 2/3 hiệp giành Cúp Vàng 3D.
   - **Rung Chuông Vàng 3D (Sinh tồn cá nhân):** Mỗi học sinh có 3 lượt chơi (❤️❤️❤️). Trả lời đúng 3 câu liên tiếp được thưởng +1 mạng. Trả lời sai 3 câu bị loại khỏi sàn đấu. Tích hợp tính năng Cứu trợ & Hồi sinh toàn bộ thí sinh hoặc bốc thăm ngẫu nhiên 5 thí sinh.
   - **Ai Nhanh Nhất 3D (Đua tốc độ 20 giây):** Đếm ngược 20 giây mỗi câu. Trả lời đúng và nhanh nhất nhận trọn 1.000 điểm, giảm dần theo thời gian. Bảng xếp hạng Top 10 Realtime trực tiếp và quy đổi điểm hệ 10 (Hạng 1–3: 10đ; Hạng 4–6: 9đ; Hạng 7–10: 8đ; Hạng 11–15: 7đ).

2. **Ngân hàng đề 12 Môn học THPT:**
   - Sinh Học, Công Nghệ, Toán Học, Vật Lý, Hóa Học, Ngữ Văn, Tiếng Anh, Lịch Sử, Địa Lý, GDKT & PL, Tin Học, GDQP & AN, và Tổng hợp 12 Môn.
   - Hỗ trợ thêm môn mới, tự động phát hiện đáp án gạch chân hoặc AI tự động suy luận đáp án đúng.
   - Xuất/nhập đề định dạng JSON.

3. **Xuất học liệu & Minh chứng:**
   - Xuất Slide HTML màu sắc chuẩn trực quan phục vụ trình chiếu trên lớp.
   - In hoặc lưu file PDF minh chứng chuyên nghiệp kèm thống kê đúng/sai.
   - Xuất bảng điểm thi đấu chi tiết dạng file CSV.

4. **Công nghệ & Kiến trúc:**
   - **Framework:** React 18, TypeScript, Vite.
   - **Đồ họa 3D:** Three.js với các hiệu ứng đổ bóng, ánh sáng sân vận động, bối cảnh bầu trời linh hoạt, nhân vật Chibi 3D, cúp vàng rơi tự do và hiệu ứng hạt confetti.
   - **Mạng thời gian thực:** Kết nối đám mây đa máy chủ MQTT (HiveMQ, Mosquitto, EMQX) qua WebSocket WSS cổng 443 kết hợp BroadcastChannel nội bộ, hỗ trợ học sinh quét mã QR hoặc nhập mã phòng 5 chữ số từ điện thoại di động qua 4G/Wi-Fi.
   - **Âm thanh:** Web Audio API synthesizer tự sinh âm thanh còi, kéo thừng, tiếng chuông hồi sinh, đóng băng và khúc nhạc khải hoàn chiến thắng.
