import { QuizItem, SubjectData, QuestionFormat } from '../types';

export const DEFAULT_BIO = `
<div>Câu 1: Bào quan nào thực hiện chức năng quang hợp chủ yếu ở thực vật?</div>
<div><u>A</u>. Lục lạp</div><div>B. Ti thể</div><div>C. Không bào</div><div>D. Bộ máy Golgi</div><br>
<div>Câu 2: Cơ quan thoát hơi nước chủ yếu của cây xanh là cơ quan nào?</div>
<div>A. Rễ cây</div><div>B. Thân cây</div><div><u>C</u>. Lá cây (qua khí khổng)</div><div>D. Hoa và quả</div><br>
<div>Câu 3: Mạch gỗ ở thực vật có chức năng vận chuyển chủ yếu các chất nào?</div>
<div><u>A</u>. Nước và các ion khoáng từ rễ lên lá</div><div>B. Các chất hữu cơ tổng hợp từ lá xuống rễ</div><div>C. Khí oxygen và carbon dioxide</div><div>D. Các hormone thực vật từ chồi ngọn xuống</div><br>
<div>Câu 4: Quá trình hô hấp tế bào ở thực vật diễn ra mạnh nhất ở bào quan nào?</div>
<div>A. Ribosome</div><div><u>B</u>. Ti thể</div><div>C. Lưới nội chất</div><div>D. Nhân tế bào</div><br>
<div>Câu 5: Hormone thực vật nào sau đây có vai trò kích thích sự kéo dài tế bào và hướng sáng của thân?</div>
<div><u>A</u>. Auxin</div><div>B. Ethylene</div><div>C. Abscisic acid</div><div>D. Florigen</div><br>
<div>Câu 6: Hình thức sinh sản vô tính nào ở thực vật giúp tạo ra hàng loạt cây con sạch bệnh trong ống nghiệm?</div>
<div>A. Giâm cành</div><div>B. Chiết cành</div><div>C. Ghép mắt</div><div><u>D</u>. Nuôi cấy mô tế bào thực vật</div><br>
<div>Câu 7: Ở thực vật có hoa, sau khi thụ tinh kép thì bộ phận nào sẽ phát triển thành hạt?</div>
<div>A. Bầu nhụy</div><div><u>B</u>. Noãn đã thụ tinh</div><div>C. Đài hoa</div><div>D. Đầu nhụy</div><br>
<div>Câu 8: Phân tử nào sau đây làm khuôn trực tiếp cho quá trình dịch mã tổng hợp chuỗi polypeptide?</div>
<div>A. DNA mạch gốc</div><div>B. tRNA</div><div><u>C</u>. mRNA (RNA thông tin)</div><div>D. rRNA</div><br>
<div>Câu 9: Tập hợp các cá thể cùng loài, cùng sống trong một khoảng không gian xác định vào một thời điểm nhất định gọi là gì?</div>
<div><u>A</u>. Quần thể sinh vật</div><div>B. Quần xã sinh vật</div><div>C. Hệ sinh thái</div><div>D. Sinh quyển</div><br>
<div>Câu 10: Vi khuẩn cố định đạm sống trong nốt sần rễ cây họ Đậu là biểu hiện của mối quan hệ sinh thái nào?</div>
<div><u>A</u>. Cộng sinh</div><div>B. Kí sinh</div><div>C. Cạnh tranh</div><div>D. Ức chế cảm nhiễm</div><br>
<div>Câu 11 [Đúng/Sai]: Trong các phát biểu sau về quá trình quang hợp ở thực vật C3:</div>
<div><u>a)</u> Pha sáng diễn ra tại màng thylakoid của lục lạp. (Đúng)</div>
<div>b) Khí oxygen giải phóng trong pha sáng có nguồn gốc từ CO2. (Sai)</div>
<div><u>c)</u> Nước là nguồn cung cấp electron và proton H+ cho pha sáng. (Đúng)</div>
<div>d) Chu trình Calvin (pha tối) diễn ra trong xoang thylakoid. (Sai)</div><br>
<div>Câu 12 [Trả lời ngắn]: Có bao nhiêu bộ ba mã di truyền (codon) trên phân tử mRNA đóng vai trò kết thúc quá trình dịch mã?</div>
<div><u>Đáp án: 3</u></div>`;

export const DEFAULT_AGRI = `
<div>Câu 1: Hệ thống tưới nhỏ giọt kết hợp châm phân tự động mang lại lợi ích lớn nhất nào?</div>
<div>A. Giúp tăng nhanh chiều cao thân cây gấp đôi</div><div>B. Tiêu diệt hoàn toàn sâu đục thân</div><div><u>C</u>. Tiết kiệm nước tưới và tối ưu hóa lượng phân bón hòa tan</div><div>D. Tăng độ mặn cho đất trồng</div><br>
<div>Câu 2: Để cải tạo đất chua và đất phèn, biện pháp hóa học phổ biến nhất mà nông dân thường áp dụng là gì?</div>
<div><u>A</u>. Bón vôi nông nghiệp kết hợp rửa mặn, xổ phèn</div><div>B. Bón thật nhiều phân đạm Urea</div><div>C. Tưới nước muối loãng lên mặt ruộng</div><div>D. Phủ bạt nilon kín mặt đất quanh năm</div><br>
<div>Câu 3: Nhóm phân bón nào sau đây cung cấp các nguyên tố dinh dưỡng đa lượng thiết yếu nhất cho cây trồng?</div>
<div>A. Phân Sắt, Đồng, Kẽm</div><div><u>B</u>. Phân Đạm (N), Lân (P), Kali (K)</div><div>C. Phân Bo, Molypden, Clo</div><div>D. Nước vôi trong và tro bếp</div><br>
<div>Câu 4: Sử dụng ong mắt đỏ hoặc bọ rùa để tiêu diệt sâu hại cây trồng là ứng dụng của biện pháp bảo vệ thực vật nào?</div>
<div>A. Biện pháp hóa học</div><div><u>B</u>. Biện pháp sinh học (sử dụng thiên địch)</div><div>C. Biện pháp cơ giới vật lý</div><div>D. Biện pháp kiểm dịch thực vật</div><br>
<div>Câu 5: Giá thể xơ dừa trước khi đem trồng cây cần được xử lý ngâm xả nước nhằm mục đích chính là gì?</div>
<div><u>A</u>. Loại bỏ chất chát (tanin, lignin) gây nghẹt rễ cây</div><div>B. Làm xơ dừa nặng hơn để giữ cây</div><div>C. Tăng lượng muối khoáng trong xơ dừa</div><div>D. Tạo mùi thơm thu hút côn trùng</div><br>
<div>Câu 6: Chế phẩm nấm đối kháng Trichoderma thường được ủ chung với phân chuồng hoai mục có tác dụng gì?</div>
<div>A. Làm cỏ dại mọc nhanh hơn</div><div><u>B</u>. Phân hủy nhanh xác hữu cơ và tiêu diệt nấm bệnh hại rễ</div><div>C. Làm tăng độ chua của đất</div><div>D. Thay thế hoàn toàn ánh sáng mặt trời</div><br>
<div>Câu 7: Trong kỹ thuật chiết cành cây ăn quả, vì sao phải cạo sạch lớp tượng tầng dưới vỏ cành chiết?</div>
<div>A. Để cành chiết nhanh khô héo</div><div><u>B</u>. Ngăn mạch rây vận chuyển chất hữu cơ xuống dưới, kích thích ra rễ tại vết cắt</div><div>C. Ngăn nước từ rễ đi lên lá</div><div>D. Giúp bầu đất nhẹ hơn</div><br>
<div>Câu 8: Công nghệ trồng cây thủy canh là phương pháp canh tác như thế nào?</div>
<div><u>A</u>. Trồng cây trực tiếp vào dung dịch dinh dưỡng khoáng mà không cần đất tự nhiên</div><div>B. Trồng cây hoàn toàn trên cát khô sa mạc</div><div>C. Trồng cây dưới đáy ao hồ ngập nước hoàn toàn</div><div>D. Chỉ phun sương nước lã lên lá cây</div><br>
<div>Câu 9: Biện pháp bảo quản nông sản rau quả tươi trong kho lạnh có cơ sở khoa học chính là gì?</div>
<div>A. Làm tăng cường độ quang hợp của quả</div><div><u>B</u>. Ức chế quá trình hô hấp của nông sản và hạn chế vi sinh vật gây thối hỏng</div><div>C. Làm đóng băng cứng hoàn toàn tế bào rau tươi</div><div>D. Giúp rau quả tự tổng hợp thêm đường</div><br>
<div>Câu 10: Ứng dụng cảm biến thông minh IoT trong nông nghiệp công nghệ cao giúp người nông dân thực hiện điều gì tự động?</div>
<div><u>A</u>. Giám sát độ ẩm đất, nhiệt độ, ánh sáng và tự động bật tắt hệ thống tưới từ xa qua điện thoại</div><div>B. Biến đổi gen cây trồng ngay ngoài đồng ruộng</div><div>C. Tự động thu hoạch toàn bộ gỗ rừng nguyên sinh</div><div>D. Không cần sử dụng nước và dinh dưỡng cho cây</div><br>
<div>Câu 11 [Đúng/Sai]: Khi nói về kỹ thuật trồng và chăm sóc cây trồng công nghệ cao theo chương trình GDPT 2018:</div>
<div><u>a)</u> Hệ thống tưới nhỏ giọt giúp tiết kiệm nước và cung cấp phân bón hòa tan trực tiếp đến vùng rễ. (Đúng)</div>
<div>b) Bón càng nhiều phân hóa học đạm Urea thì đất càng tơi xốp và pH đất tăng cao. (Sai)</div>
<div><u>c)</u> Chế phẩm vi sinh Trichoderma giúp phân giải chất hữu cơ và ức chế nấm gây bệnh thối rễ. (Đúng)</div>
<div><u>d)</u> Trồng cây trong nhà màng giúp hạn chế côn trùng gây hại và chủ động điều chỉnh tiểu khí hậu. (Đúng)</div><br>
<div>Câu 12 [Trả lời ngắn]: Nhiệt độ bảo quản lạnh thông thường đối với nhiều loại rau quả tươi trong kho mát dao động từ 2 đến bao nhiêu độ C (nhập số nguyên)?</div>
<div><u>Đáp án: 10</u></div>`;

export const DEFAULT_MATH = `
<div>Câu 1: Đạo hàm của hàm số y = x³ - 3x² + 2 trên tập số thực là biểu thức nào sau đây?</div>
<div><u>A</u>. y' = 3x² - 6x</div><div>B. y' = 3x² - 3x</div><div>C. y' = x² - 6x</div><div>D. y' = 3x³ - 6x</div><br>
<div>Câu 2: Trong mặt phẳng tọa độ, tổng ba góc trong một tam giác bất kỳ luôn bằng bao nhiêu độ?</div>
<div>A. 90 độ</div><div><u>B</u>. 180 độ</div><div>C. 270 độ</div><div>D. 360 độ</div><br>
<div>Câu 3: Nghiệm của phương trình cơ bản 2x - 10 = 0 là giá trị nào?</div>
<div>A. x = 2</div><div>B. x = -5</div><div><u>C</u>. x = 5</div><div>D. x = 10</div><br>
<div>Câu 4: Công thức tính diện tích xung quanh của hình trụ có bán kính đáy r và chiều cao h là gì?</div>
<div><u>A</u>. S = 2πrh</div><div>B. S = πr²h</div><div>C. S = πrh</div><div>D. S = 4πr²</div><br>
<div>Câu 5: Giá trị lượng giác của biểu thức sin²α + cos²α luôn bằng bao nhiêu với mọi góc α?</div>
<div>A. 0</div><div><u>B</u>. 1</div><div>C. 2</div><div>D. -1</div><br>
<div>Câu 6: Một cấp số cộng có số hạng đầu u₁ = 3 và công sai d = 4. Số hạng thứ hai u₂ bằng bao nhiêu?</div>
<div>A. 12</div><div>B. 6</div><div><u>C</u>. 7</div><div>D. 1</div><br>
<div>Câu 7: Với a là số thực dương khác 1, giá trị của logₐ(a³) bằng bao nhiêu?</div>
<div><u>A</u>. 3</div><div>B. 1</div><div>C. a</div><div>D. 0</div><br>
<div>Câu 8: Nguyên hàm của hàm số f(x) = 2x trên tập số thực là hàm số nào sau đây?</div>
<div>A. 2 + C</div><div><u>B</u>. x² + C</div><div>C. 2x² + C</div><div>D. x + C</div><br>
<div>Câu 9: Gieo một con xúc xắc cân đối và đồng chất 1 lần. Xác suất để xuất hiện mặt có số chấm chẵn là bao nhiêu?</div>
<div>A. 1/6</div><div>B. 1/3</div><div><u>C</u>. 1/2</div><div>D. 2/3</div><br>
<div>Câu 10: Thể tích của khối lập phương có cạnh bằng 3 cm là bao nhiêu?</div>
<div>A. 9 cm³</div><div>B. 18 cm³</div><div><u>C</u>. 27 cm³</div><div>D. 36 cm³</div><br>
<div>Câu 11 [Đúng/Sai]: Cho hàm số $y = x^3 - 3x^2 + 2$. Xét tính đúng/sai của các mệnh đề sau:</div>
<div><u>a)</u> Đạo hàm của hàm số là $y' = 3x^2 - 6x$. (Đúng)</div>
<div><u>b)</u> Điểm cực đại của đồ thị hàm số là $(0; 2)$. (Đúng)</div>
<div>c) Hàm số đồng biến trên khoảng $(0; 2)$. (Sai)</div>
<div><u>d)</u> Giá trị cực tiểu của hàm số bằng $-2$. (Đúng)</div><br>
<div>Câu 12 [Trả lời ngắn]: Cho tích phân $I = \int_{0}^{2} 2x \, dx$. Giá trị của $I$ bằng bao nhiêu?</div>
<div><u>Đáp án: 4</u></div>`;

export const DEFAULT_PHYS = `
<div>Câu 1: Theo định luật II Newton, gia tốc của một vật có mối liên hệ như thế nào với lực tác dụng và khối lượng?</div>
<div><u>A</u>. Cùng hướng với lực tác dụng, tỉ lệ thuận với độ lớn của lực và tỉ lệ nghịch với khối lượng (a = F/m)</div><div>B. Tỉ lệ thuận với khối lượng của vật</div><div>C. Luôn ngược hướng với lực tác dụng</div><div>D. Không phụ thuộc vào độ lớn của hợp lực</div><br>
<div>Câu 2: Đơn vị đo cường độ dòng điện trong hệ đo lường quốc tế SI là gì?</div>
<div>A. Vôn (V)</div><div><u>B</u>. Ampe (A)</div><div>C. Ôm (Ω)</div><div>D. Oát (W)</div><br>
<div>Câu 3: Biểu thức tính chu kỳ dao động điều hòa của con lắc đơn có chiều dài l tại nơi có gia tốc trọng trường g là gì?</div>
<div><u>A</u>. T = 2π√(l/g)</div><div>B. T = 2π√(g/l)</div><div>C. T = √(l/g)</div><div>D. T = 1 / (2π√(l/g))</div><br>
<div>Câu 4: Sóng cơ học không thể lan truyền được trong môi trường nào sau đây?</div>
<div>A. Chất rắn</div><div>B. Chất lỏng</div><div>C. Chất khí</div><div><u>D</u>. Chân không</div><br>
<div>Câu 5: Tốc độ truyền ánh sáng trong môi trường chân không có giá trị xấp xỉ bằng bao nhiêu?</div>
<div><u>A</u>. 300.000 km/s (3.10⁸ m/s)</div><div>B. 340 m/s</div><div>C. 1500 m/s</div><div>D. 30.000 km/s</div><br>
<div>Câu 6: Theo định luật Ohm đối với đoạn mạch chỉ có điện trở thuần R, cường độ dòng điện I được tính bằng công thức nào?</div>
<div>A. I = U.R</div><div><u>B</u>. I = U / R</div><div>C. I = R / U</div><div>D. I = U² / R</div><br>
<div>Câu 7: Hiện tượng ánh sáng trắng bị phân tách thành dải màu cầu vồng khi đi qua lăng kính gọi là hiện tượng gì?</div>
<div><u>A</u>. Tán sắc ánh sáng</div><div>B. Phản xạ toàn phần</div><div>C. Nhiễu xạ ánh sáng</div><div>D. Hiện tượng quang điện</div><br>
<div>Câu 8: Trong nguyên tử, hạt mang điện tích âm chuyển động xung quanh hạt nhân là hạt nào?</div>
<div>A. Proton</div><div>B. Neutron</div><div><u>C</u>. Electron</div><div>D. Tất cả các hạt trong nhân</div><br>
<div>Câu 9: Khi một vật chuyển động rơi tự do từ trên cao xuống gần mặt đất (bỏ qua sức cản không khí), đại lượng nào tăng dần?</div>
<div><u>A</u>. Động năng của vật</div><div>B. Thế năng trọng trường của vật</div><div>C. Khối lượng của vật</div><div>D. Gia tốc rơi tự do</div><br>
<div>Câu 10: Dòng điện xoay chiều sử dụng trong mạng điện sinh hoạt dân dụng tại Việt Nam có tần số chuẩn là bao nhiêu?</div>
<div>A. 100 Hz</div><div><u>B</u>. 50 Hz</div><div>C. 60 Hz</div><div>D. 220 Hz</div><br>
<div>Câu 11 [Đúng/Sai]: Cho một vật dao động điều hòa trên trục Ox quanh vị trí cân bằng O:</div>
<div><u>a)</u> Khi vật đi qua vị trí cân bằng, tốc độ của vật đạt giá trị cực đại. (Đúng)</div>
<div>b) Tại vị trí biên, gia tốc của vật có độ lớn bằng 0. (Sai)</div>
<div><u>c)</u> Vectơ gia tốc của vật luôn hướng về vị trí cân bằng và tỉ lệ với độ lớn li độ. (Đúng)</div>
<div>d) Cơ năng của con lắc biến thiên tuần hoàn theo thời gian với chu kỳ T. (Sai)</div><br>
<div>Câu 12 [Trả lời ngắn]: Cho đoạn mạch chỉ có điện trở thuần R = 10 Ω, hiệu điện thế hai đầu mạch U = 20 V. Cường độ dòng điện I chạy qua mạch bằng bao nhiêu Ampe?</div>
<div><u>Đáp án: 2</u></div>`;

export const DEFAULT_CHEM = `
<div>Câu 1: Kim loại nào sau đây là kim loại duy nhất tồn tại ở trạng thái lỏng ở điều kiện nhiệt độ phòng?</div>
<div>A. Sắt (Fe)</div><div>B. Đồng (Cu)</div><div><u>C</u>. Thủy ngân (Hg)</div><div>D. Nhôm (Al)</div><br>
<div>Câu 2: Công thức hóa học của khí Carbon dioxide (khí các-bô-níc) là gì?</div>
<div>A. CO</div><div><u>B</u>. CO₂</div><div>C. SO₂</div><div>D. NO₂</div><br>
<div>Câu 3: Một dung dịch làm quỳ tím chuyển sang màu đỏ thì giá trị pH của dung dịch đó như thế nào?</div>
<div><u>A</u>. pH < 7 (Môi trường acid)</div><div>B. pH = 7 (Môi trường trung tính)</div><div>C. pH > 7 (Môi trường kiềm)</div><div>D. pH = 14</div><br>
<div>Câu 4: Nguyên khí nào chiếm tỉ lệ thể tích lớn nhất (khoảng 78%) trong bầu khí quyển Trái Đất?</div>
<div>A. Khí Oxygen (O₂)</div><div><u>B</u>. Khí Nitrogen (N₂)</div><div>C. Khí Hydrogen (H₂)</div><div>D. Khí Helium (He)</div><br>
<div>Câu 5: Kim loại nào sau đây có tính dẫn điện tốt nhất trong tất cả các kim loại?</div>
<div>A. Vàng (Au)</div><div>B. Đồng (Cu)</div><div><u>C</u>. Bạc (Ag)</div><div>D. Nhôm (Al)</div><br>
<div>Câu 6: Công thức hóa học của muối ăn thông thường dùng trong đời sống hằng ngày là gì?</div>
<div><u>A</u>. NaCl (Sodium chloride)</div><div>B. CaCO₃</div><div>C. NaOH</div><div>D. NaHCO₃</div><br>
<div>Câu 7: Hợp chất hữu cơ Glucose (C₆H₁₂O₆) thuộc loại hợp chất nào sau đây?</div>
<div><u>A</u>. Carbohydrate (Monosaccharide)</div><div>B. Ester</div><div>C. Amino acid</div><div>D. Hydrocarbon</div><br>
<div>Câu 8: Khi cho kim loại Kẽm (Zn) tác dụng với dung dịch acid HCl loãng, chất khí nào sẽ thoát ra?</div>
<div>A. Khí Chlorine (Cl₂)</div><div><u>B</u>. Khí Hydrogen (H₂)</div><div>C. Khí Oxygen (O₂)</div><div>D. Khí Sulfur dioxide (SO₂)</div><br>
<div>Câu 9: Nguyên tố hóa học đầu tiên ở ô số 1 trong Bảng tuần hoàn các nguyên tố hóa học là nguyên tố nào?</div>
<div><u>A</u>. Hydrogen (H)</div><div>B. Helium (He)</div><div>C. Lithium (Li)</div><div>D. Carbon (C)</div><br>
<div>Câu 10: Kim loại Nhôm (Al) có tính chất hóa học đặc trưng là tác dụng được với cả dung dịch acid mạnh và dung dịch nào sau đây?</div>
<div>A. Nước muối NaCl</div><div><u>B</u>. Dung dịch kiềm mạnh (như NaOH)</div><div>C. Dầu hỏa</div><div>D. Khí Nitrogen ở nhiệt độ thường</div><br>
<div>Câu 11 [Đúng/Sai]: Xét các phát biểu sau về carbohydrate (glucose, saccharose, tinh bột, cellulose):</div>
<div><u>a)</u> Glucose có phản ứng tráng bạc khi tác dụng với thuốc thử Tollens. (Đúng)</div>
<div>b) Cellulose tan tốt trong nước lạnh tạo thành dung dịch keo. (Sai)</div>
<div><u>c)</u> Thủy phân hoàn toàn tinh bột trong môi trường acid thu được sản phẩm cuối cùng là glucose. (Đúng)</div>
<div>d) Saccharose là một polysaccharide có cấu trúc mạch phân nhánh. (Sai)</div><br>
<div>Câu 12 [Trả lời ngắn]: Phân tử khối của hợp chất Sodium hydroxide (NaOH, biết Na=23, O=16, H=1) bằng bao nhiêu?</div>
<div><u>Đáp án: 40</u></div>`;

export const DEFAULT_LIT = `
<div>Câu 1: Tác phẩm "Truyện Kiều" (Đoạn trường tân thanh) là kiệt tác thơ Nôm của đại thi hào nào?</div>
<div>A. Nguyễn Trãi</div><div><u>B</u>. Nguyễn Du</div><div>C. Nguyễn Khuyến</div><div>D. Hồ Xuân Hương</div><br>
<div>Câu 2: Bài thơ "Tây Tiến" với hình tượng người lính hào hùng và hào hoa là sáng tác của nhà thơ nào?</div>
<div><u>A</u>. Quang Dũng</div><div>B. Tố Hữu</div><div>C. Chính Hữu</div><div>D. Xuân Diệu</div><br>
<div>Câu 3: Nhân vật Chí Phèo và Thị Nở xuất hiện trong tác phẩm truyện ngắn nổi tiếng nào của nhà văn Nam Cao?</div>
<div>A. Lão Hạc</div><div>B. Đời thừa</div><div><u>C</u>. Chí Phèo</div><div>D. Sống mòn</div><br>
<div>Câu 4: Bản "Tuyên ngôn Độc lập" khai sinh ra nước Việt Nam Dân chủ Cộng hòa ngày 2/9/1945 do ai soạn thảo và đọc tại Quảng trường Ba Đình?</div>
<div><u>A</u>. Chủ tịch Hồ Chí Minh</div><div>B. Phan Bội Châu</div><div>C. Phan Châu Trinh</div><div>D. Tố Hữu</div><br>
<div>Câu 5: Thể thơ truyền thống thuần Việt gồm các cặp câu một câu 6 chữ và một câu 8 chữ liên tiếp gọi là thể thơ gì?</div>
<div>A. Thất ngôn bát cú</div><div><u>B</u>. Thơ Lục bát</div><div>C. Song thất lục bát</div><div>D. Thơ Ngũ ngôn</div><br>
<div>Câu 6: Biện pháp tu từ nào gọi tên sự vật, hiện tượng này bằng tên sự vật, hiện tượng khác có nét tương đồng với nó?</div>
<div>A. So sánh</div><div><u>B</u>. Ẩn dụ</div><div>C. Hoán dụ</div><div>D. Liệt kê</div><br>
<div>Câu 7: Tác phẩm "Vợ nhặt" phản ánh nạn đói năm Ất Dậu 1945 và khát vọng sống của người nông dân là của nhà văn nào?</div>
<div><u>A</u>. Kim Lân</div><div>B. Ngô Tất Tố</div><div>C. Nguyễn Công Hoan</div><div>D. Vũ Trọng Phụng</div><br>
<div>Câu 8: Tùy bút "Người lái đò Sông Đà" ca ngợi vẻ đẹp hùng vĩ, trữ tình của thiên nhiên Tây Bắc và con người lao động là của tác giả nào?</div>
<div>A. Hoàng Phủ Ngọc Tường</div><div><u>B</u>. Nguyễn Tuân</div><div>C. Nguyễn Minh Châu</div><div>D. Tô Hoài</div><br>
<div>Câu 9: Tập thơ "Nhật ký trong tù" của Chủ tịch Hồ Chí Minh được sáng tác bằng chữ viết nào?</div>
<div>A. Chữ Quốc ngữ</div><div>B. Chữ Nôm</div><div><u>C</u>. Chữ Hán</div><div>D. Chữ Pháp</div><br>
<div>Câu 10: Nhân vật Huấn Cao với tài viết chữ đẹp và khí phách hiên ngang là nhân vật chính trong truyện ngắn nào của Nguyễn Tuân?</div>
<div><u>A</u>. Chữ người tử tù</div><div>B. Một thời vang bóng</div><div>C. Chiếc lư đồng mắt cua</div><div>D. Hương cuội</div><br>
<div>Câu 11 [Đúng/Sai]: Xét các nhận định sau về tác phẩm "Tuyên ngôn Độc lập" của Chủ tịch Hồ Chí Minh:</div>
<div><u>a)</u> Tác phẩm được đọc tại Quảng trường Ba Đình (Hà Nội) vào ngày 02/09/1945. (Đúng)</div>
<div><u>b)</u> Mở đầu bản Tuyên ngôn trích dẫn lời trong Tuyên ngôn Độc lập của Mỹ (1776) và Tuyên ngôn Nhân quyền và Dân quyền của Pháp (1791). (Đúng)</div>
<div>c) Bản Tuyên ngôn được viết theo thể thơ lục bát truyền thống. (Sai)</div>
<div><u>d)</u> Tác phẩm là một áng văn chính luận mẫu mực với lập luận chặt chẽ, đanh thép. (Đúng)</div><br>
<div>Câu 12 [Trả lời ngắn]: Trong một cặp câu thơ lục bát chuẩn, tổng số chữ (tiếng) của cả câu lục và câu bát cộng lại là bao nhiêu chữ?</div>
<div><u>Đáp án: 14</u></div>`;

export const DEFAULT_ENG = `
<div>Câu 1: Choose the correct form: "She _______ to school by bus every day."</div>
<div>A. go</div><div><u>B</u>. goes</div><div>C. going</div><div>D. gone</div><br>
<div>Câu 2: What is the synonym of the word "happy"?</div>
<div><u>A</u>. Joyful</div><div>B. Sad</div><div>C. Angry</div><div>D. Tired</div><br>
<div>Câu 3: Conditional Sentence Type 1: "If it rains tomorrow, we _______ at home."</div>
<div>A. stayed</div><div>B. would stay</div><div><u>C</u>. will stay</div><div>D. staying</div><br>
<div>Câu 4: Passive Voice: "This school _______ in 1995."</div>
<div><u>A</u>. was built</div><div>B. built</div><div>C. is building</div><div>D. has built</div><br>
<div>Câu 5: Preposition: "My brother is very interested _______ learning English and IT."</div>
<div>A. on</div><div>B. at</div><div><u>C</u>. in</div><div>D. with</div><br>
<div>Câu 6 [Đúng/Sai]: Read the statements about English grammar (High School 2018 Curriculum) and decide True or False:</div>
<div><u>a)</u> Present Simple tense is used to describe habits and general truths. (Đúng)</div>
<div>b) In Conditional Type 1, we use Past Perfect in the "If" clause. (Sai)</div>
<div><u>c)</u> "Interested" is followed by the preposition "in". (Đúng)</div>
<div>d) "Go" is a regular verb whose past form is "goed". (Sai)</div><br>
<div>Câu 7 [Trả lời ngắn]: How many letters are there in the modern English alphabet (enter a number)?</div>
<div><u>Đáp án: 26</u></div>`;

export const DEFAULT_HIST = `
<div>Câu 1: Chiến thắng lịch sử Điện Biên Phủ "lừng lẫy năm châu, chấn động địa cầu" diễn ra vào năm nào?</div>
<div>A. Năm 1945</div><div><u>B</u>. Năm 1954</div><div>C. Năm 1968</div><div>D. Năm 1975</div><br>
<div>Câu 2: Đảng Cộng sản Việt Nam được thành lập vào ngày, tháng, năm nào?</div>
<div><u>A</u>. Ngày 03/02/1930</div><div>B. Ngày 19/08/1945</div><div>C. Ngày 02/09/1945</div><div>D. Ngày 30/04/1975</div><br>
<div>Câu 3: Chiến dịch Hồ Chí Minh lịch sử giải phóng hoàn toàn miền Nam, thống nhất đất nước thắng lợi vào ngày nào?</div>
<div>A. Ngày 27/01/1973</div><div><u>B</u>. Ngày 30/04/1975</div><div>C. Ngày 07/05/1954</div><div>D. Ngày 19/12/1946</div><br>
<div>Câu 4: Cuộc khởi nghĩa Lam Sơn đánh đuổi quân Minh xâm lược ở thế kỷ XV do vị anh hùng dân tộc nào lãnh đạo?</div>
<div>A. Trần Hưng Đạo</div><div><u>B</u>. Lê Lợi</div><div>C. Quang Trung - Nguyễn Huệ</div><div>D. Lý Thường Kiệt</div><br>
<div>Câu 5: Chiến thắng Bạch Đằng năm 938 chấm dứt hơn 1000 năm Bắc thuộc gắn liền với tên tuổi của vị anh hùng nào?</div>
<div><u>A</u>. Ngô Quyền</div><div>B. Đinh Bộ Lĩnh</div><div>C. Lê Hoàn</div><div>D. Lý Công Uẩn</div><br>
<div>Câu 6 [Đúng/Sai]: Xét các phát biểu lịch sử về Cách mạng tháng Tám năm 1945 ở Việt Nam:</div>
<div><u>a)</u> Cách mạng tháng Tám năm 1945 đã lật đổ ách thống trị của thực dân, phát xít và chế độ phong kiến. (Đúng)</div>
<div><u>b)</u> Ngày 02/09/1945, Chủ tịch Hồ Chí Minh đọc Tuyên ngôn Độc lập khai sinh nước Việt Nam Dân chủ Cộng hòa. (Đúng)</div>
<div>c) Cách mạng tháng Tám diễn ra sau chiến thắng Điện Biên Phủ năm 1954. (Sai)</div>
<div><u>d)</u> Thắng lợi của Cách mạng tháng Tám mở ra kỷ nguyên độc lập, tự do cho dân tộc Việt Nam. (Đúng)</div><br>
<div>Câu 7 [Trả lời ngắn]: Chiến thắng Điện Biên Phủ kết thúc thắng lợi vào ngày 07 tháng 05 năm nào (nhập 4 chữ số năm)?</div>
<div><u>Đáp án: 1954</u></div>`;

export const DEFAULT_GEO = `
<div>Câu 1: Vùng kinh tế nào được mệnh danh là vựa lúa và vùng xuất khẩu gạo, trái cây, thủy sản lớn nhất cả nước ta?</div>
<div>A. Đồng bằng sông Hồng</div><div><u>B</u>. Đồng bằng sông Cửu Long</div><div>C. Tây Nguyên</div><div>D. Đông Nam Bộ</div><br>
<div>Câu 2: Việt Nam nằm hoàn toàn trong đới khí hậu nào sau đây?</div>
<div><u>A</u>. Nhiệt đới gió mùa ẩm</div><div>B. Ôn đới hải dương</div><div>C. Hàn đới lạnh giá</div><div>D. Cận nhiệt đới khô hạn</div><br>
<div>Câu 3: Đỉnh núi Phan-xi-păng (Fansipan) cao 3.143m được mệnh danh là "Nóc nhà Đông Dương" thuộc dãy núi nào?</div>
<div>A. Dãy Trường Sơn Bắc</div><div><u>B</u>. Dãy Hoàng Liên Sơn</div><div>C. Dãy Ngân Sơn</div><div>D. Dãy Đông Triều</div><br>
<div>Câu 4: Tỉnh Vĩnh Long nằm ở trung tâm vùng Đồng bằng sông Cửu Long, nằm giữa hai con sông lớn nào?</div>
<div><u>A</u>. Sông Tiền và Sông Hậu</div><div>B. Sông Hồng và Sông Đà</div><div>C. Sông Đồng Nai và Sông Sài Gòn</div><div>D. Sông Hương và Sông Thu Bồn</div><br>
<div>Câu 5: Quần đảo Hoàng Sa và quần đảo Trường Sa của Việt Nam nằm ở vùng biển nào?</div>
<div><u>A</u>. Biển Đông</div><div>B. Ấn Độ Dương</div><div>C. Địa Trung Hải</div><div>D. Biển Đỏ</div><br>
<div>Câu 6 [Đúng/Sai]: Xét các đặc điểm tự nhiên và kinh tế của vùng Đồng bằng sông Cửu Long:</div>
<div><u>a)</u> Là vùng sản xuất lúa gạo, thủy sản và cây ăn quả nhiệt đới lớn nhất cả nước. (Đúng)</div>
<div>b) Địa hình chủ yếu là núi cao hiểm trở trên 2.000m. (Sai)</div>
<div><u>c)</u> Hệ thống sông Tiền và sông Hậu bồi đắp phù sa màu mỡ cho đồng bằng. (Đúng)</div>
<div>d) Vùng này không giáp biển và không có đảo ven bờ. (Sai)</div><br>
<div>Câu 7 [Trả lời ngắn]: Nước Việt Nam thống nhất hiện nay được chia thành bao nhiêu vùng kinh tế - xã hội (theo quy hoạch chuẩn SGK Địa lý 12 GDPT 2018)?</div>
<div><u>Đáp án: 6</u></div>`;

export const DEFAULT_GDKTPL = `
<div>Câu 1: Văn bản pháp luật nào có hiệu lực pháp lý cao nhất trong hệ thống pháp luật nước Cộng hòa xã hội chủ nghĩa Việt Nam?</div>
<div><u>A</u>. Hiến pháp</div><div>B. Bộ luật Dân sự</div><div>C. Nghị định của Chính phủ</div><div>D. Thông tư của Bộ trưởng</div><br>
<div>Câu 2: Theo quy định của Hiến pháp Việt Nam, công dân đủ bao nhiêu tuổi trở lên thì có quyền bầu cử đại biểu Quốc hội và Hội đồng nhân dân?</div>
<div>A. Đủ 16 tuổi</div><div><u>B</u>. Đủ 18 tuổi</div><div>C. Đủ 20 tuổi</div><div>D. Đủ 21 tuổi</div><br>
<div>Câu 3: Trong nền kinh tế thị trường, khi lượng cầu về một mặt hàng tăng cao hơn lượng cung thì giá cả mặt hàng đó thường có xu hướng gì?</div>
<div><u>A</u>. Giá cả có xu hướng tăng lên</div><div>B. Giá cả giảm mạnh về 0</div><div>C. Giá cả không bao giờ thay đổi</div><div>D. Hàng hóa bị tiêu hủy</div><br>
<div>Câu 4: Hành vi người điều khiển xe mô tô, xe gắn máy vượt đèn đỏ khi tham gia giao thông là vi phạm pháp luật loại nào?</div>
<div><u>A</u>. Vi phạm hành chính</div><div>B. Vi phạm kỷ luật trường học</div><div>C. Vi phạm hợp đồng dân sự</div><div>D. Không vi phạm pháp luật</div><br>
<div>Câu 5: Ngân sách nhà nước là toàn bộ các khoản thu, chi của Nhà nước được dự toán và thực hiện trong một khoảng thời gian nhất định do cơ quan nào quyết định?</div>
<div><u>A</u>. Quốc hội</div><div>B. Ủy ban nhân dân xã</div><div>C. Các doanh nghiệp tư nhân</div><div>D. Ngân hàng thương mại</div><br>
<div>Câu 6 [Đúng/Sai]: Xét các quy định của Hiến pháp về quyền và nghĩa vụ cơ bản của công dân:</div>
<div><u>a)</u> Mọi công dân đều bình đẳng trước pháp luật. (Đúng)</div>
<div><u>b)</u> Công dân đủ 18 tuổi trở lên có quyền bầu cử theo quy định của pháp luật. (Đúng)</div>
<div>c) Nộp thuế chỉ là quyền tự nguyện, không phải nghĩa vụ bắt buộc theo luật định. (Sai)</div>
<div><u>d)</u> Bảo vệ Tổ quốc là nghĩa vụ thiêng liêng và quyền cao quý của công dân. (Đúng)</div><br>
<div>Câu 7 [Trả lời ngắn]: Theo Hiến pháp Việt Nam, công dân từ đủ bao nhiêu tuổi trở lên thì có quyền ứng cử vào Quốc hội và Hội đồng nhân dân?</div>
<div><u>Đáp án: 21</u></div>`;

export const DEFAULT_IT = `
<div>Câu 1: Trong thiết kế trang web, ngôn ngữ đánh dấu siêu văn bản chuẩn dùng để tạo cấu trúc nội dung trang web được viết tắt là gì?</div>
<div><u>A</u>. HTML (HyperText Markup Language)</div><div>B. MP3</div><div>C. JPEG</div><div>D. PDF</div><br>
<div>Câu 2: Trong phần mềm soạn thảo hoặc trình duyệt trên hệ điều hành Windows, tổ hợp phím tắt nào dùng để Sao chép (Copy) và Dán (Paste)?</div>
<div><u>A</u>. Ctrl + C và Ctrl + V</div><div>B. Alt + F4</div><div>C. Ctrl + Z và Ctrl + Y</div><div>D. Shift + Delete</div><br>
<div>Câu 3: Thành phần phần cứng nào của máy tính được ví như "bộ não" xử lý trung tâm thực hiện các phép tính và điều khiển?</div>
<div>A. Bàn phím (Keyboard)</div><div><u>B</u>. Bộ vi xử lý CPU (Central Processing Unit)</div><div>C. Chuột máy tính (Mouse)</div><div>D. Loa âm thanh (Speaker)</div><br>
<div>Câu 4: Công nghệ Trí tuệ nhân tạo đang được ứng dụng rộng rãi trong giáo dục và đời sống có tên viết tắt tiếng Anh là gì?</div>
<div><u>A</u>. AI (Artificial Intelligence)</div><div>B. USB</div><div>C. DVD</div><div>D. VGA</div><br>
<div>Câu 5: Để bảo vệ tài khoản cá nhân trên không gian mạng an toàn nhất, người dùng nên thực hiện nguyên tắc nào sau đây?</div>
<div><u>A</u>. Đặt mật khẩu mạnh (gồm chữ hoa, chữ thường, số, ký tự đặc biệt) và bật xác thực 2 lớp (2FA), tuyệt đối không chia sẻ mã OTP</div><div>B. Đặt mật khẩu là 123456 cho dễ nhớ</div><div>C. Nhấp vào mọi đường link lạ trúng thưởng</div><div>D. Công khai mật khẩu lên mạng xã hội</div><br>
<div>Câu 6 [Đúng/Sai]: Xét các phát biểu về ngôn ngữ HTML và CSS trong thiết kế web (Tin học 12 GDPT 2018):</div>
<div><u>a)</u> Thẻ &lt;h1&gt; đến &lt;h6&gt; trong HTML dùng để định nghĩa các tiêu đề theo cấp độ giảm dần. (Đúng)</div>
<div><u>b)</u> CSS được sử dụng để định dạng màu sắc, phông chữ và bố cục hiển thị cho trang web. (Đúng)</div>
<div>c) Thẻ &lt;img&gt; trong HTML dùng để tạo bảng dữ liệu nhiều hàng cột. (Sai)</div>
<div><u>d)</u> Thuộc tính href trong thẻ &lt;a&gt; dùng để chỉ định địa chỉ liên kết siêu văn bản. (Đúng)</div><br>
<div>Câu 7 [Trả lời ngắn]: Trong hệ nhị phân (Binary) của máy tính, mỗi bit thông tin có thể nhận tối đa bao nhiêu trạng thái giá trị khác nhau (0 hoặc 1)?</div>
<div><u>Đáp án: 2</u></div>`;

export const DEFAULT_GDQPAN = `
<div>Câu 1: Lực lượng vũ trang nhân dân Việt Nam bao gồm ba thứ quân làm nòng cốt là những lực lượng nào?</div>
<div><u>A</u>. Bộ đội chủ lực, Bộ đội địa phương và Dân quân tự vệ</div><div>B. Chỉ có Bộ đội biên phòng</div><div>C. Chỉ có Thanh niên xung phong</div><div>D. Chỉ có Cảnh sát giao thông</div><br>
<div>Câu 2: Ngày truyền thống thành lập Quân đội Nhân dân Việt Nam và cũng là Ngày hội Quốc phòng toàn dân hàng năm là ngày nào?</div>
<div>A. Ngày 19 tháng 8</div><div><u>B</u>. Ngày 22 tháng 12</div><div>C. Ngày 27 tháng 7</div><div>D. Ngày 26 tháng 3</div><br>
<div>Câu 3: Khi phát hiện bom, mìn, vật liệu nổ còn sót lại sau chiến tranh ở địa phương, học sinh và người dân cần làm gì?</div>
<div>A. Tự ý dùng búa đập hoặc cưa lấy thuốc nổ</div><div>B. Ném đá vào vật nổ để thử</div><div><u>C</u>. Tuyệt đối không chạm vào, đánh dấu vị trí cảnh báo và báo ngay cho cơ quan Quân sự hoặc Công an gần nhất</div><div>D. Mang về nhà cất giữ làm kỷ niệm</div><br>
<div>Câu 4: Trong kỹ thuật cấp cứu ban đầu khi gặp người bị gãy xương chi, nguyên tắc quan trọng nhất trước khi di chuyển nạn nhân là gì?</div>
<div><u>A</u>. Cố định tạm thời xương gãy bằng nẹp đúng kỹ thuật để tránh đầu xương gãy làm tổn thương mạch máu, dây thần kinh</div><div>B. Kéo mạnh tay chân nạn nhân ngay lập tức</div><div>C. Bắt nạn nhân tự đứng dậy đi bộ</div><div>D. Không cần băng bó hay cố định</div><br>
<div>Câu 5: Theo Luật Nghĩa vụ quân sự hiện hành của Việt Nam, độ tuổi gọi công dân nhập ngũ trong thời bình thông thường là từ đủ bao nhiêu tuổi?</div>
<div><u>A</u>. Từ đủ 18 tuổi đến hết 25 tuổi (đối với công dân được đào tạo trình độ cao đẳng, đại học thì đến hết 27 tuổi)</div><div>B. Từ 12 tuổi đến 15 tuổi</div><div>C. Từ 45 tuổi đến 60 tuổi</div><div>D. Không quy định độ tuổi</div><br>
<div>Câu 6 [Đúng/Sai]: Xét các quy định về trách nhiệm bảo vệ Tổ quốc và an toàn giao thông của học sinh THPT:</div>
<div><u>a)</u> Công dân đủ 18 tuổi được gọi nhập ngũ trong thời bình theo Luật Nghĩa vụ quân sự. (Đúng)</div>
<div>b) Học sinh THPT được phép điều khiển xe mô tô có dung tích xi-lanh trên 100 cm³ đến trường. (Sai)</div>
<div><u>c)</u> Khi phát hiện vật liệu nổ còn sót lại sau chiến tranh, phải giữ khoảng cách an toàn và báo ngay cho cơ quan chức năng. (Đúng)</div>
<div>d) Người ngồi trên xe gắn máy chỉ cần đội mũ bảo hiểm khi đi trên đường quốc lộ. (Sai)</div><br>
<div>Câu 7 [Trả lời ngắn]: Ngày truyền thống Quân đội Nhân dân Việt Nam là ngày bao nhiêu trong tháng 12 hằng năm?</div>
<div><u>Đáp án: 22</u></div>`;

export const AI_KNOWLEDGE_KEYWORDS = [
  'lục lạp', 'khí khổng', 'mạch gỗ', 'nước và các ion khoáng', 'ti thể', 'auxin', 'nuôi cấy mô', 'noãn đã thụ tinh', 'mrna', 'quần thể', 'cộng sinh',
  'tiết kiệm nước tưới', 'bón vôi', 'đạm (n), lân (p), kali (k)', 'thiên địch', 'biện pháp sinh học', 'tanin', 'trichoderma', 'ngăn mạch rây', 'dung dịch dinh dưỡng', 'ức chế quá trình hô hấp', 'giám sát độ ẩm đất',
  '3x² - 6x', '180 độ', 'x = 5', '2πrh', 'x² + c', '27 cm³',
  'a = f/m', 'tỉ lệ thuận với độ lớn của lực', 'ampe (a)', '2π√(l/g)', 'chân không', '300.000 km/s', 'i = u / r', 'tán sắc ánh sáng', 'electron', 'động năng', '50 hz',
  'thủy ngân', 'co₂', 'ph < 7', 'nitrogen', 'bạc (ag)', 'nacl', 'carbohydrate', 'khí hydrogen', 'hydrogen (h)', 'dung dịch kiềm mạnh',
  'nguyễn du', 'quang dũng', 'chí phèo', 'hồ chí minh', 'lục bát', 'ẩn dụ', 'kim lân', 'nguyễn tuân', 'chữ hán', 'chữ người tử tù',
  'goes', 'joyful', 'will stay', 'was built', '1954', '03/02/1930', '30/04/1975', 'lê lợi', 'ngô quyền',
  'đồng bằng sông cửu long', 'nhiệt đới gió mùa ẩm', 'hoàng liên sơn', 'sông tiền và sông hậu', 'biển đông',
  'hiến pháp', 'đủ 18 tuổi', 'xu hướng tăng lên', 'vi phạm hành chính', 'quốc hội',
  'html', 'ctrl + c và ctrl + v', 'cpu', 'artificial intelligence', 'xác thực 2 lớp',
  'dân quân tự vệ', '22 tháng 12', 'báo ngay cho cơ quan quân sự', 'cố định tạm thời xương gãy', 'hết 25 tuổi'
];

// Chuẩn hóa ký tự Toán học Unicode (Mathematical Alphanumeric Symbols U+1D400..U+1D7FF từ Word Equation Editor)
// về chữ cái/số chuẩn để không bao giờ bị lỗi ô vuông hay rớt công thức khi copy từ Word 365
export function normalizeWordMathUnicode(raw: string): string {
  if (!raw) return '';
  let out = '';
  for (const ch of raw) {
    const cp = ch.codePointAt(0) || 0;
    if (cp >= 0x1d400 && cp <= 0x1d7ff) {
      if (cp >= 0x1d7ce && cp <= 0x1d7ff) {
        out += String.fromCharCode(48 + ((cp - 0x1d7ce) % 10));
        continue;
      }
      const latinOffsets: [number, number][] = [
        [0x1d400, 0x1d433], // Bold
        [0x1d434, 0x1d467], // Italic
        [0x1d468, 0x1d49b], // Bold Italic
        [0x1d5a0, 0x1d5d3], // Sans-Serif
        [0x1d5d4, 0x1d607], // Sans-Serif Bold
        [0x1d608, 0x1d63b], // Sans-Serif Italic
        [0x1d63c, 0x1d66f], // Sans-Serif Bold Italic
        [0x1d670, 0x1d6a3], // Monospace
      ];
      let mapped = false;
      for (const [start, end] of latinOffsets) {
        if (cp >= start && cp <= end) {
          const offset = cp - start;
          out += offset < 26 ? String.fromCharCode(65 + offset) : String.fromCharCode(97 + (offset - 26));
          mapped = true;
          break;
        }
      }
      if (mapped) continue;
      if (cp === 0x210e) {
        out += 'h';
        continue;
      }
      const greekLowerMap: Record<number, string> = {
        0x1d6fc: 'α', 0x1d6fd: 'β', 0x1d6fe: 'γ', 0x1d6ff: 'δ', 0x1d700: 'ε',
        0x1d703: 'θ', 0x1d706: 'λ', 0x1d707: 'μ', 0x1d70b: 'π', 0x1d70e: 'σ', 0x1d714: 'ω',
      };
      if (greekLowerMap[cp]) {
        out += greekLowerMap[cp];
        continue;
      }
      if (cp === 0x1d6e5) {
        out += 'Δ';
        continue;
      }
      if (cp === 0x1d6f4) {
        out += 'Ω';
        continue;
      }
    }
    if (cp === 0x2212) {
      out += '-';
      continue;
    }
    out += ch;
  }
  return out;
}

// Chuyển đổi các thẻ phương trình Toán học của Microsoft Word (<m:oMath>, <m:f>, <m:rad>, <m:sSub>, <m:sSup>) sang LaTeX chuẩn
function convertWordOMMLToLatex(html: string): string {
  if (!html || !/<m:/i.test(html)) return html;
  let s = html;
  // Phân số <m:f>...<m:num>A</m:num><m:den>B</m:den></m:f>
  s = s.replace(/<m:f\b[^>]*>[\s\S]*?<m:num\b[^>]*>([\s\S]*?)<\/m:num>[\s\S]*?<m:den\b[^>]*>([\s\S]*?)<\/m:den>[\s\S]*?<\/m:f>/gi, (_m, num, den) => {
    const cleanNum = num.replace(/<[^>]+>/g, '').trim();
    const cleanDen = den.replace(/<[^>]+>/g, '').trim();
    return ` $\\frac{${cleanNum}}{${cleanDen}}$ `;
  });
  // Căn thức <m:rad>...<m:deg>n</m:deg><m:e>X</m:e></m:rad>
  s = s.replace(/<m:rad\b[^>]*>[\s\S]*?<m:deg\b[^>]*>([\s\S]*?)<\/m:deg>[\s\S]*?<m:e\b[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<\/m:rad>/gi, (_m, deg, expr) => {
    const cleanDeg = deg.replace(/<[^>]+>/g, '').trim();
    const cleanExpr = expr.replace(/<[^>]+>/g, '').trim();
    return cleanDeg ? ` $\\sqrt[${cleanDeg}]{${cleanExpr}}$ ` : ` $\\sqrt{${cleanExpr}}$ `;
  });
  // Chỉ số trên & dưới <m:sSubSup>
  s = s.replace(/<m:sSubSup\b[^>]*>[\s\S]*?<m:e\b[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<m:sub\b[^>]*>([\s\S]*?)<\/m:sub>[\s\S]*?<m:sup\b[^>]*>([\s\S]*?)<\/m:sup>[\s\S]*?<\/m:sSubSup>/gi, (_m, base, sub, sup) => {
    const b = base.replace(/<[^>]+>/g, '').trim();
    const sb = sub.replace(/<[^>]+>/g, '').trim();
    const sp = sup.replace(/<[^>]+>/g, '').trim();
    return `${b}<sub>${sb}</sub><sup>${sp}</sup>`;
  });
  // Chỉ số dưới <m:sSub>
  s = s.replace(/<m:sSub\b[^>]*>[\s\S]*?<m:e\b[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<m:sub\b[^>]*>([\s\S]*?)<\/m:sub>[\s\S]*?<\/m:sSub>/gi, (_m, base, sub) => {
    const b = base.replace(/<[^>]+>/g, '').trim();
    const sb = sub.replace(/<[^>]+>/g, '').trim();
    return `${b}<sub>${sb}</sub>`;
  });
  // Chỉ số trên <m:sSup>
  s = s.replace(/<m:sSup\b[^>]*>[\s\S]*?<m:e\b[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<m:sup\b[^>]*>([\s\S]*?)<\/m:sup>[\s\S]*?<\/m:sSup>/gi, (_m, base, sup) => {
    const b = base.replace(/<[^>]+>/g, '').trim();
    const sp = sup.replace(/<[^>]+>/g, '').trim();
    return `${b}<sup>${sp}</sup>`;
  });
  return s;
}

// Loại bỏ triệt để mọi mảnh vỡ thuộc tính CSS / Microsoft Word (MSO) bị đứt dòng trong văn bản,
// ĐỒNG THỜI BẢO VỆ 100% các thẻ đa phương tiện hợp lệ (<img>, <table>, <sub>, <sup>, <u>, <b>)
export function stripWordStyleGarbage(raw: string): string {
  if (!raw) return '';

  const protectedVault: string[] = [];
  const shield = (match: string) => {
    const idx = protectedVault.length;
    protectedVault.push(match);
    return `⟦SAFE_TAG_${idx}⟧`;
  };

  let working = normalizeWordMathUnicode(raw)
    .replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, shield)
    .replace(/<img\b[^>]*\/?>/gi, shield)
    .replace(/<\/?(?:sub|sup|u|ins|b|strong)\b[^>]*>/gi, shield);

  working = working
    .replace(/&quot;/gi, '"')
    // 1. Mảnh vỡ bắt đầu bằng tên thuộc tính CSS/MSO kết thúc bằng >
    .replace(
      /(?:[a-z0-9\-]*?(?:font-family|family|font-size|line-height|mso-[a-z0-9\-]+|text-align|font-weight|font-style|mso-ansi-language|mso-fareast-language|mso-bidi-language))\s*:\s*[^<>]{0,220}?(?:>|&gt;)/gi,
      ' '
    )
    // 2. Mảnh vỡ bắt đầu bằng tên phông chữ trong dấu nháy kết thúc bằng >
    .replace(
      /["'“”‘’]+(?:Times\s+New\s+Roman|Arial|Calibri|Cambria|Tahoma|Verdana|Helvetica|Courier\s+New|Segoe\s+UI|Roboto)["'“”‘’]*[^<>]{0,220}?(?:>|&gt;)/gi,
      ' '
    )
    // 3. Mảnh vỡ bắt đầu bằng ,serif"> , ;mso-...> , ;font-...>
    .replace(
      /(?:,\s*(?:serif|sans-serif|monospace)|;\s*(?:mso-[a-z0-9\-]+|font-[a-z0-9\-]+)|mso-ansi-language\s*:\s*[A-Z\-]+)[^<>]{0,220}?(?:>|&gt;)/gi,
      ' '
    )
    // 4. Mảnh vỡ thuộc tính font-family còn sót dù mất dấu >
    .replace(
      /(?:[a-z0-9\-]*?font-family|family)\s*:\s*["'“”]+(?:Times\s+New\s+Roman|Arial|Calibri|Cambria)["'“”]+(?:\s*,\s*(?:serif|sans-serif))?(?:\s*;)?/gi,
      ' '
    )
    // 5. Thẻ mở HTML bị cụt ở cuối dòng
    .replace(/<(?:span|p|div|font|o:p|style|meta|link)\b[^<>]*$/gi, ' ')
    // 6. Thu gọn khoảng trắng thừa trước dấu phẩy / dấu chấm do thẻ span bị cắt giữa câu
    .replace(/\s+([,.;:?!])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ');

  working = working.replace(/⟦SAFE_TAG_(\d+)⟧/g, (_m, idxStr) => {
    const idx = parseInt(idxStr, 10);
    return protectedVault[idx] !== undefined ? protectedVault[idx] : '';
  });

  return working;
}

export function cleanTFStatementText(rawText: string): string {
  return stripWordStyleGarbage(rawText || '')
    .replace(/⟦\/?[UB]⟧/g, '')
    .replace(/<\/?(?:u|ins|b|strong)\b[^>]*>/gi, '')
    .replace(/^(?:(?:Ý|Mệnh\s*đề|Phát\s*biểu)\s+)?[a-dA-D]\s*\*?\s*[\)\.\:\-]\s*/i, '')
    .replace(/^(?:(?:Ý|Mệnh\s*đề|Phát\s*biểu)\s+)?[a-dA-D]\s*\*?\s*[\)\.\:\-]\s*/i, '')
    .replace(/\s*(?:\(\s*(?:Đúng|Sai|Đ|S|True|False)\s*\)|\[\s*(?:Đúng|Sai|Đ|S|True|False)\s*\]|(?:->|=>|-|:)\s*(?:Đúng|Sai|Đ|S|True|False)\s*[.;,]*$|✓|✔)\s*$/gi, '')
    .trim();
}

export function cleanQuestionTitleText(rawText: string): string {
  let cleaned = stripWordStyleGarbage(rawText || '')
    .replace(/⟦\/?[UB]⟧/g, '')
    .replace(/<\/?(?:u|ins)\b[^>]*>/gi, '')
    .trim();
  // Lặp tối đa 3 lần để bóc sạch trường hợp lồng nhau như: "Câu 46 [Đúng/Sai]: Câu 1. Một khu rừng keo..."
  for (let i = 0; i < 3; i++) {
    const next = cleaned
      .replace(/^\s*(?:PHẦN\s*[I123V]+|DẠNG\s*(?:THỨC)?\s*[I123V]+)\s*[:.\-]?\s*/i, '')
      .replace(/^\s*(?:Câu\s*(?:hỏi)?\s*(?:\d+\s*[:.)\-]?|[:.\-])|Bài\s*(?:tập)?\s*\d+\s*[:.)\-]?|Question\s*\d+\s*[:.)\-]?|\d{1,3}\s*[.):](?!\d))\s*/i, '')
      .replace(/^\s*\[(?:Phần\s*[I123V]+|Dạng\s*thức\s*[I123V]+|Đúng\s*\/\s*Sai|Đ\/S|Trả\s*lời\s*ngắn|Điền\s*khuyết|Điền\s*số|SINH HỌC|CÔNG NGHỆ[^\]]*|TOÁN|VẬT LÝ|HÓA HỌC|NGỮ VĂN|TIẾNG ANH|LỊCH SỬ|ĐỊA LÝ|TIN HỌC|GDKTPL|GDQPAN)\]\s*[:.)\-]?\s*/gi, '')
      .trim();
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned.replace(/\s*\((?:Đúng|Sai)\)\s*$/i, '').trim();
}

export function cleanShortAnswerValue(rawVal: string): string {
  return (rawVal || '')
    .replace(/⟦\/?[UB]⟧/g, '')
    .replace(/<\/?(?:u|ins|b|strong)\b[^>]*>/gi, '')
    .replace(/^(?:Đáp\s*án(?:\s*đúng)?|Đáp\s*số|ĐA|ĐS|TL|Trả\s*lời|Kết\s*quả|KQ|ShortAnswer|Answer)\s*[:=.]?\s*/i, '')
    .replace(/^(?:=>|=)\s*/, '')
    .trim();
}

export function aiAutoDetectCorrectIndex(questionText: string, optionsArray: string[]): number {
  if (!optionsArray || optionsArray.length === 0) return 0;
  const qLower = (questionText || '').toLowerCase();
  let bestIdx = 0;
  let highestScore = -999;

  // Hệ thống giải nhanh biểu thức Toán học cơ bản nếu câu hỏi chứa phép tính
  let computedMathValue: string | null = null;
  const simpleEqMatch = qLower.match(/(\d+)\s*([\+\-\*x×:\/])\s*(\d+)\s*=\s*\?/);
  if (simpleEqMatch) {
    const a = parseFloat(simpleEqMatch[1]);
    const op = simpleEqMatch[2];
    const b = parseFloat(simpleEqMatch[3]);
    const val = op === '+' ? a + b : op === '-' ? a - b : (op === '*' || op === 'x' || op === '×') ? a * b : b !== 0 ? a / b : null;
    if (val !== null) computedMathValue = String(val);
  }

  optionsArray.forEach((opt, idx) => {
    const oLower = (opt || '').toLowerCase().trim();
    let score = 0;

    if (/(\(đúng\)|\[đúng\]|✓|✔|\*$|đáp án đúng|<u>)/i.test(oLower)) score += 200;

    if (computedMathValue && oLower.replace(/[^0-9.\-]/g, '') === computedMathValue) {
      score += 150;
    }

    AI_KNOWLEDGE_KEYWORDS.forEach(kw => {
      if (oLower.includes(kw)) score += 40;
    });

    if (/(tất cả.*đều đúng|cả a, b, c đều đúng|cả a và b đều đúng|cả ba phương án)/i.test(oLower)) {
      score += 28;
    }
    if (/(không có đáp án|tất cả đều sai)/i.test(oLower)) {
      score -= 10;
    }

    score += Math.min(oLower.length * 0.15, 10);

    const qWords = qLower.split(/\s+/).filter(w => w.length > 4);
    qWords.forEach(w => {
      if (oLower.includes(w)) score += 2.5;
    });

    if (score > highestScore) {
      highestScore = score;
      bestIdx = idx;
    }
  });

  return bestIdx;
}

/**
 * HOTFIX 2.3: Chuẩn hóa chuỗi đáp án (cleanText) dùng chung cho cả hệ thống
 * Loại bỏ tiền tố A./a)/[A]/1., khoảng trắng thừa, dấu chấm cuối câu và đưa về chữ thường chuẩn NFC.
 */
export function cleanText(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFC')
    .replace(/^(?:⟦\/?[UB]⟧\s*)*\*?(?:\[\s*[A-Da-d1-4]\s*\]|\(\s*[A-Da-d1-4]\s*\)|[A-Da-d1-4]\s*[.):\/\-])\s*/i, '')
    .replace(/^(?:Đáp\s*án|ĐA|KQ|Kết\s*quả|Đáp\s*số)\s*(?:đúng\s*)?(?:là\s*)?[:.=]?\s*/i, '')
    .replace(/\s*\(\s*(?:đúng|sai)\s*\)\s*$/i, '')
    .replace(/[.;,]+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Phân tích dòng tổng hợp đáp án Đúng/Sai (VD: "Đáp án: Đ - S - Đ - S", "a) Đúng, b) Sai, c) Đúng, d) Sai", "a-Đ, b-S, c-S, d-Đ", "ĐSĐS")
function parseTrueFalseSummaryLine(rawAns: string): Record<string, boolean> | null {
  const cleaned = (rawAns || '').replace(/⟦\/?[UB]⟧/g, '').trim();
  if (!cleaned) return null;

  const result: Record<string, boolean> = {};
  let matchedCount = 0;

  // Cách 1: Có nhãn a, b, c, d đi kèm Đúng/Sai/Đ/S (VD: "a) Đúng, b) Sai, c) Đ, d) S" hoặc "a-Đ; b-S; c-Đ; d-S")
  const labeledRegex = /([a-d])\s*(?:[\)\.\:\-\=]|là)?\s*(đúng|sai|true|false|đ|s)(?=$|[\s,;\-\|\/)\].])/gi;
  let m: RegExpExecArray | null;
  while ((m = labeledRegex.exec(cleaned)) !== null) {
    const label = m[1].toLowerCase();
    const val = m[2].toLowerCase();
    result[label] = val === 'đúng' || val === 'đ' || val === 'true';
    matchedCount++;
  }
  if (matchedCount >= 2) {
    return result;
  }

  // Cách 2: Chuỗi viết liền "ĐSĐS" hoặc "Đ S Đ S" hoặc "Đ - S - Đ - S" hoặc "Đúng, Sai, Đúng, Sai"
  const compact = cleaned.replace(/[\s,\-;|\/\.]+/g, '').toLowerCase();
  if (/^[đstf]{2,4}$/.test(compact)) {
    const labels = ['a', 'b', 'c', 'd'];
    compact.split('').slice(0, 4).forEach((ch, idx) => {
      result[labels[idx]] = ch === 'đ' || ch === 't';
    });
    return result;
  }

  // Cách 3: Danh sách từ "Đúng", "Sai", "Đ", "S" cách nhau bởi dấu cách/phẩy/gạch ngang
  const tokens: boolean[] = [];
  const tokenRegex = /(?:^|[\s,;\-\|\/(\[])(đúng|sai|true|false|đ|s)(?=$|[\s,;\-\|\/)\].])/gi;
  while ((m = tokenRegex.exec(cleaned)) !== null) {
    const tk = m[1].toLowerCase();
    tokens.push(tk === 'đúng' || tk === 'đ' || tk === 'true');
  }
  if (tokens.length >= 2) {
    const labels = ['a', 'b', 'c', 'd'];
    tokens.slice(0, 4).forEach((val, idx) => {
      result[labels[idx]] = val;
    });
    return result;
  }

  return null;
}

// Chuẩn hóa và truyền thẻ ⟦U⟧...⟦/U⟧, ⟦B⟧...⟦/B⟧ qua các dấu cách và dấu xuống dòng (\n)
// Đảm bảo:
// 1. Nếu giáo viên bôi đen dính khoảng trắng trước phương án B ("A. Hà Nội<u>   B. Hải Phòng</u>"), ⟦U⟧ được đẩy sang đúng phương án B.
// 2. Nếu 1 thẻ <u>...</u> bao trùm nhiều dòng (VD: bôi đen cả 2 ý a) và b) rồi bấm Ctrl+U), mỗi dòng đều nhận được ⟦U⟧...⟦/U⟧ riêng!
// 3. Loại bỏ các cặp ⟦U⟧...⟦/U⟧ rỗng hoặc chỉ chứa dấu câu/khoảng trắng sót lại sau khi chỉnh sửa.
function propagateUnderlineMarkersAcrossLines(input: string): string {
  if (!input) return '';
  const s = input
    .replace(/⟦U⟧([ \t\n]+)/g, '$1⟦U⟧')
    .replace(/([ \t\n]+)⟦\/U⟧/g, '⟦/U⟧$1')
    .replace(/⟦B⟧([ \t\n]+)/g, '$1⟦B⟧')
    .replace(/([ \t\n]+)⟦\/B⟧/g, '⟦/B⟧$1')
    .replace(/⟦U⟧([^A-Za-z0-9À-ỹ]*)⟦\/U⟧/g, '$1')
    .replace(/⟦B⟧([^A-Za-z0-9À-ỹ]*)⟦\/B⟧/g, '$1');

  const lines = s.split('\n');
  let uDepth = 0;
  let bDepth = 0;
  const processedLines = lines.map(line => {
    let curLine = line;
    const prefixU = uDepth > 0 ? '⟦U⟧' : '';
    const prefixB = bDepth > 0 ? '⟦B⟧' : '';

    const openU = (curLine.match(/⟦U⟧/g) || []).length;
    const closeU = (curLine.match(/⟦\/U⟧/g) || []).length;
    const openB = (curLine.match(/⟦B⟧/g) || []).length;
    const closeB = (curLine.match(/⟦\/B⟧/g) || []).length;

    uDepth = Math.max(0, uDepth + openU - closeU);
    bDepth = Math.max(0, bDepth + openB - closeB);

    const suffixU = uDepth > 0 ? '⟦/U⟧' : '';
    const suffixB = bDepth > 0 ? '⟦/B⟧' : '';

    curLine = `${prefixB}${prefixU}${curLine}${suffixU}${suffixB}`
      .replace(/⟦U⟧([^A-Za-z0-9À-ỹ]*)⟦\/U⟧/g, '$1')
      .replace(/⟦B⟧([^A-Za-z0-9À-ỹ]*)⟦\/B⟧/g, '$1');
    return curLine;
  });

  return processedLines.join('\n');
}

// Chuyển đổi bảng HTML <table> thực sự (Bảng số liệu Địa lý, Sinh học, Vật lý, Hóa học, Toán thống kê)
// thành bảng HTML chuẩn gọn sạch để hiển thị trực tiếp trong câu hỏi mà không bị vỡ thành từng dòng rời rạc.
function serializeCleanDataTable(tableEl: Element): string {
  const rows = Array.from(tableEl.querySelectorAll('tr'));
  if (rows.length === 0) return '';
  let tableHTML = '<table class="stem-data-table">';
  rows.forEach((tr, rIdx) => {
    const cells = Array.from(tr.querySelectorAll(':scope > th, :scope > td'));
    if (cells.length === 0) return;
    tableHTML += '<tr>';
    cells.forEach(cell => {
      const isHeader = cell.tagName.toLowerCase() === 'th' || rIdx === 0;
      const tag = isHeader ? 'th' : 'td';
      const colspan = cell.getAttribute('colspan');
      const rowspan = cell.getAttribute('rowspan');
      const attrs = `${colspan && colspan !== '1' ? ` colspan="${colspan}"` : ''}${rowspan && rowspan !== '1' ? ` rowspan="${rowspan}"` : ''}`;
      let cellInner = cell.innerHTML
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<\/?(?:span|p|div|font|o:p|w:[a-z0-9]+|v:[a-z0-9]+)[^>]*>/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      cellInner = stripWordStyleGarbage(cellInner);
      tableHTML += `<${tag}${attrs}>${cellInner}</${tag}>`;
    });
    tableHTML += '</tr>';
  });
  tableHTML += '</table>';
  return tableHTML;
}

// Tách dòng thông minh từ HTML hoặc văn bản thuần (Word, PDF, Google Docs, Zalo, Bảng Table Word/Excel):
// 1. Giữ nguyên 100% hình ảnh <img>, sơ đồ, bản đồ Địa lý, bảng số liệu <table>, công thức <sub>/<sup> và LaTeX.
// 2. Nhận diện triệt để mọi kiểu gạch chân thật (<u>, <ins>, text-decoration:underline, text-underline:single/words của Word, border-bottom) bằng token ⟦U⟧...⟦/U⟧.
// 3. Tách chính xác nhiều câu hỏi Câu X., đáp án A. B. C. D. (2 cột, 4 cột, hoặc dính cuối câu hỏi) và mệnh đề a) b) c) d) nằm dính chùm trên cùng 1 hàng!
export function extractNormalizedLines(
  htmlString: string,
  plainTextFallback?: string
): { text: string; isU: boolean; isBold?: boolean; raw: string }[] {
  const sourceHasNothing = (!htmlString || !htmlString.trim()) && (!plainTextFallback || !plainTextFallback.trim());
  if (sourceHasNothing) return [];

  const parseRawSegment = (rawInput: string, isPlainMode: boolean): { text: string; isU: boolean; isBold?: boolean; raw: string }[] => {
    if (!rawInput || !rawInput.trim()) return [];

    const mediaVault: string[] = [];
    const storeMedia = (htmlSnippet: string): string => {
      const idx = mediaVault.length;
      mediaVault.push(htmlSnippet);
      return `⟦MEDIA_${idx}⟧`;
    };
    const restoreMedia = (str: string): string =>
      str
        .replace(/⟦SUB⟧/g, '<sub>')
        .replace(/⟦\/SUB⟧/g, '</sub>')
        .replace(/⟦SUP⟧/g, '<sup>')
        .replace(/⟦\/SUP⟧/g, '</sup>')
        .replace(/⟦MEDIA_(\d+)⟧/g, (_m, idxStr) => {
          const idx = parseInt(idxStr, 10);
          return mediaVault[idx] !== undefined ? mediaVault[idx] : '';
        });

    let fullMarkedText = '';

    const hasRealHtmlTags =
      !isPlainMode &&
      /<(?:div|p|br|span|u|ins|b|strong|em|i|img|svg|table|tr|td|th|sub|sup|math|m:omath|ol|ul|li|font|h[1-6]|section|article|blockquote|style|xml|meta|o:p)\b/i.test(rawInput);

    if (!hasRealHtmlTags) {
      let plainNorm = normalizeWordMathUnicode(rawInput)
        .replace(/\r\n|\r/g, '\n')
        .replace(/\u00A0/g, ' ');

      const rawPlainLines = plainNorm.split('\n');
      const rebuiltPlainLines: string[] = [];
      let tabTableBuffer: string[][] = [];

      const flushTabTableBuffer = () => {
        if (tabTableBuffer.length >= 2) {
          let tbl = '<table class="stem-data-table">';
          tabTableBuffer.forEach((rowCells, rIdx) => {
            const tag = rIdx === 0 ? 'th' : 'td';
            tbl += '<tr>' + rowCells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
          });
          tbl += '</table>';
          rebuiltPlainLines.push(storeMedia(tbl));
        } else if (tabTableBuffer.length === 1) {
          rebuiltPlainLines.push(tabTableBuffer[0].join('   '));
        }
        tabTableBuffer = [];
      };

      rawPlainLines.forEach(l => {
        if (l.includes('\t')) {
          const cells = l.split('\t').map(c => c.trim()).filter(Boolean);
          const isOptionRow = cells.some(c => /^(?:\[\s*[A-Da-d]\s*\]|\(\s*[A-Da-d]\s*\)|[A-Da-d]\s*\*?\s*[.:\)\/])\s*\S/.test(c));
          if (!isOptionRow && cells.length >= 2) {
            tabTableBuffer.push(cells);
            return;
          }
        }
        flushTabTableBuffer();
        rebuiltPlainLines.push(l);
      });
      flushTabTableBuffer();

      fullMarkedText = stripWordStyleGarbage(rebuiltPlainLines.join('\n'));
    } else {
      // Bước 1: Mở khóa comment danh sách tự động của Word <!--[if !supportLists]-->...<!--[endif]-->
      // để giữ nguyên nhãn A., B., C., D., a), b), c), d) và thẻ <u> gạch chân bên trong danh sách Word!
      const cleanedHTML = convertWordOMMLToLatex(normalizeWordMathUnicode(rawInput))
        .replace(/<!--\[if\s+!supportLists\]-->/gi, '')
        .replace(/<!--\[endif\]-->/gi, '')
        .replace(/<!\[if\s+!supportLists\]>/gi, '')
        .replace(/<!\[endif\]>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(style|script|xml|head|title)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<\/?(?:meta|link|o:p|w:[a-z0-9]+|v:[a-z0-9]+|m:[a-z0-9]+)[^>]*\/?>/gi, '');

      const container = document.createElement('div');
      container.innerHTML = cleanedHTML;

      // Bước 1.5: Bảo vệ Hình ảnh / Sơ đồ / Bản đồ Địa lý (<img>) và Bảng số liệu (<table>)
      Array.from(container.querySelectorAll('table')).forEach(tableEl => {
        if (!container.contains(tableEl)) return;
        const cells = Array.from(tableEl.querySelectorAll('td, th'));
        const optOrQuestionCells = cells.filter(c => {
          const txt = (c.textContent || '').trim();
          return (
            /^(?:\[\s*[A-Da-d]\s*\]|\(\s*[A-Da-d]\s*\)|[A-Da-d]\s*\*?\s*[.:\)\/\-])(\s*\S|$)/.test(txt) ||
            /^(?:Câu|Bài|Question)\s*\d+/i.test(txt)
          );
        });
        if (cells.length >= 2 && optOrQuestionCells.length < 2) {
          const cleanTableHTML = serializeCleanDataTable(tableEl);
          if (cleanTableHTML) {
            const token = storeMedia(cleanTableHTML);
            tableEl.replaceWith(document.createTextNode(` ${token} `));
          }
        }
      });

      Array.from(container.querySelectorAll('img')).forEach(imgEl => {
        const src = (imgEl.getAttribute('src') || '').trim();
        if (src && (src.startsWith('data:image/') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:') || src.startsWith('/'))) {
          const alt = (imgEl.getAttribute('alt') || 'Hình minh họa').replace(/"/g, '&quot;');
          const token = storeMedia(`<img src="${src}" alt="${alt}" class="stem-inline-img" />`);
          imgEl.replaceWith(document.createTextNode(` ${token} `));
        } else {
          imgEl.remove();
        }
      });

      Array.from(container.querySelectorAll('sub')).forEach(subEl => {
        subEl.insertBefore(document.createTextNode('⟦SUB⟧'), subEl.firstChild);
        subEl.appendChild(document.createTextNode('⟦/SUB⟧'));
      });
      Array.from(container.querySelectorAll('sup')).forEach(supEl => {
        supEl.insertBefore(document.createTextNode('⟦SUP⟧'), supEl.firstChild);
        supEl.appendChild(document.createTextNode('⟦/SUP⟧'));
      });

      // Bước 2: Chuyển các danh sách tự động <ol>/<ul> của Word thành dòng có ký hiệu chuẩn
      container.querySelectorAll('ol, ul').forEach(listEl => {
        const tag = listEl.tagName.toLowerCase();
        const typeAttr = (listEl.getAttribute('type') || '').trim();
        const items = Array.from(listEl.querySelectorAll(':scope > li'));
        const isLikelyOptionList =
          items.length >= 2 &&
          items.length <= 4 &&
          items.every(li => {
            const t = (li.textContent || '').trim();
            return !/^(?:Câu|Bài|Question|PHẦN|DẠNG)\b/i.test(t);
          });

        items.forEach((li, idx) => {
          const txt = (li.textContent || '').trim();
          const alreadyHasPrefix =
            /^([A-Da-d]\s*\*?\s*[.:\)\/\-]|\d{1,3}\s*[.:\)\/\-]|(?:Câu|Bài|Question|PHẦN|DẠNG|Đáp\s*án|ĐA|ĐS)\b)/i.test(txt);
          if (!alreadyHasPrefix) {
            if (isLikelyOptionList || typeAttr === 'A' || typeAttr === 'a') {
              const prefix =
                typeAttr === 'a'
                  ? `${String.fromCharCode(97 + (idx % 4))}) `
                  : `${String.fromCharCode(65 + (idx % 4))}. `;
              li.insertBefore(document.createTextNode(prefix), li.firstChild);
            } else if (tag === 'ol') {
              li.insertBefore(document.createTextNode(`Câu ${idx + 1}: `), li.firstChild);
            }
          }
        });
      });

      // Bước 3: Đánh dấu ⟦U⟧...⟦/U⟧ CHỈ CHO GẠCH CHÂN THẬT (<u>, <ins>, text-decoration:underline,
      // text-underline:single/words/double của Word, border-bottom, class underline).
      // Tách riêng tô màu/in đậm vào ⟦B⟧...⟦/B⟧ và tuyệt đối KHÔNG đưa màu xanh dương trang trí (blue/#0070c0) vào ⟦U⟧
      // để tránh lỗi cả 4 đáp án A, B, C, D đều bị nhận nhầm là gạch chân!
      const allElements = Array.from(container.querySelectorAll('*'));
      allElements.forEach(el => {
        const tag = el.tagName.toLowerCase();
        const styleAttr = (el.getAttribute('style') || '').toLowerCase();
        const colorAttr = (el.getAttribute('color') || '').toLowerCase();
        const classAttr = (el.getAttribute('class') || '').toLowerCase();

        const hasExplicitNoUnderline =
          /text-decoration(?:-line)?\s*:\s*none/i.test(styleAttr) ||
          /(?:mso-)?text-underline\s*:\s*none/i.test(styleAttr);

        const isUnderlinedTag = (tag === 'u' || tag === 'ins') && !hasExplicitNoUnderline;
        const isUnderlinedStyle =
          !hasExplicitNoUnderline &&
          (/text-decoration(?:-line)?\s*:\s*[^;]*underline/i.test(styleAttr) ||
            /(?:mso-)?text-underline\s*:\s*(?!none)[a-z0-9\-]+/i.test(styleAttr) ||
            /border-bottom(?:-style|-width)?\s*:\s*(?!none|0(?:px|pt|em|rem)?(?:\s*;|\s*$))/i.test(styleAttr) ||
            /\bunderline\b/i.test(classAttr));

        const isRedOrYellowHighlight =
          /(?:^|;|\s)color\s*:\s*(?:red|#ff0000|#f00|#ef4444|#dc2626|#c00000|#e11d48|#b91c1c|rgb\(\s*255\s*,\s*0\s*,\s*0\s*\))/i.test(styleAttr) ||
          /background(?:-color)?\s*:\s*(?:yellow|#ffff00|#fef08a|#fde047)/i.test(styleAttr) ||
          /^(?:red|#ff0000|#c00000)$/i.test(colorAttr);

        const isBoldTag = tag === 'b' || tag === 'strong';
        const isBoldStyle = /font-weight\s*:\s*(?:bold|[6-9]00)/i.test(styleAttr);

        if (isUnderlinedTag || isUnderlinedStyle) {
          el.insertBefore(document.createTextNode('⟦U⟧'), el.firstChild);
          el.appendChild(document.createTextNode('⟦/U⟧'));
        } else if (isRedOrYellowHighlight || isBoldTag || isBoldStyle) {
          el.insertBefore(document.createTextNode('⟦B⟧'), el.firstChild);
          el.appendChild(document.createTextNode('⟦/B⟧'));
        }
      });

      // Bước 4: Chèn ký tự xuống dòng \n vào các thẻ ngắt dòng / khối
      container.querySelectorAll('br').forEach(br => {
        br.replaceWith(document.createTextNode('\n'));
      });
      container.querySelectorAll('div, p, li, tr, td, th, h1, h2, h3, h4, h5, h6, section, article, blockquote').forEach(block => {
        block.insertBefore(document.createTextNode('\n'), block.firstChild);
        block.appendChild(document.createTextNode('\n'));
      });

      const rawTextFromDOM = (container.textContent || '')
        .replace(/\r\n|\r/g, '\n')
        .replace(/\u00A0/g, ' ');

      fullMarkedText = stripWordStyleGarbage(propagateUnderlineMarkersAcrossLines(rawTextFromDOM));
    }

    const rawLines = fullMarkedText.split('\n');
    const expandedLines: string[] = [];

    // Bước 5: Tách các câu hỏi Câu X., phương án A. B. C. D., mệnh đề a) b) c) d), hoặc Đáp án: ... bị dính chùm trên cùng 1 hàng
    rawLines.forEach(rawLine => {
      // QUAN TRỌNG: Giữ nguyên khoảng trắng kép và đổi \t thành 3 dấu cách trước khi tách phương án/câu hỏi dính chùm!
      const preCleaned = stripWordStyleGarbage(rawLine).replace(/\t+/g, '   ').trim();
      if (!preCleaned) return;

      let working = propagateUnderlineMarkersAcrossLines(preCleaned);

      // 5.1. Nếu một dòng bị lặp 2 nhãn mệnh đề đầu dòng (VD: "b) d) Sử dụng...") -> giữ nhãn thật phía sau
      working = working.replace(
        /^((?:⟦\/?[UB]⟧\s*)*\*?)[a-d]\s*\*?(?:⟦\/?[UB]⟧\s*)*[\)\.]\s+((?:⟦\/?[UB]⟧\s*)*\*?[a-d]\s*\*?(?:⟦\/?[UB]⟧\s*)*[\)\.]\s+)/i,
        '$1$2'
      );

      // 5.2. Nếu đầu dòng có 2 tiền tố "Câu 46 [Đúng/Sai]: Câu 1." lồng nhau -> gộp lại thành 1 tiền tố
      working = working.replace(
        /^((?:⟦\/?[UB]⟧\s*)*Câu\s*(?:hỏi)?\s*\d+\s*(?:\[[^\]]+\])?\s*[:.)\/\-]\s*)(?:⟦\/?[UB]⟧\s*)*(?:Câu\s*(?:hỏi)?\s*\d+\s*[:.)\/\-]\s*)/i,
        '$1'
      );

      // 5.3. Tách "Câu X:", "Câu X.", "Bài X:", "Question X:", "PHẦN I/II/III" bị dính chùm ở giữa dòng (kể cả khi không có dấu cách sau dấu chấm!)
      working = working.replace(
        /([.?!;:)\]"”’]\s*|\s+)((?:⟦\/?[UB]⟧\s*)*(?:(?:Câu(?:\s*hỏi)?|Bài(?:\s*tập)?|Question)\s*(?:⟦\/?[UB]⟧\s*)*\d+\s*(?:⟦\/?[UB]⟧\s*)*(?:[:.)\/\-]\s*\S|\s+[A-ZÀ-Ỹ])|(?:PHẦN|DẠNG\s*THỨC)\s+(?:I|II|III|1|2|3)\b))/gi,
        (fullMatch, sep, qToken, offset, fullStr) => {
          const beforeText = fullStr.slice(0, offset).replace(/⟦\/?[UB]⟧/g, '').trim();
          if (!beforeText) return fullMatch;
          // Tránh tách nhầm cụm tham chiếu trong thân câu như "như ở câu 1.", "theo câu 2:"
          if (/(?:như|ở|tại|trong|theo|xem|giống|với|từ|đến)\s*$/i.test(beforeText)) {
            return fullMatch;
          }
          const cleanSep = sep.trim();
          return `${cleanSep}\n${qToken}`;
        }
      );

      // 5.4. Tách nếu "Đáp án: ..." / "ĐS: ..." nằm trên cùng dòng với câu hỏi hoặc phương án
      working = working.replace(
        /(\s+|\(\s*|\[\s*|(?<=[.?!;)]))((?:⟦\/?[UB]⟧\s*)*(?:Đáp\s*án(?:\s*đúng)?|Đáp\s*số|ĐA|ĐS|Kết\s*quả|KQ|Trả\s*lời)\s*[:=]\s*)/gi,
        '\n$2'
      );

      // Xử lý từng dòng con sau khi đã tách Câu X:
      const subLinesAfterQSplit = propagateUnderlineMarkersAcrossLines(working).split('\n');

      subLinesAfterQSplit.forEach(subLineRaw => {
        let subWorking = subLineRaw.trim();
        if (!subWorking) return;

        const stemNounPrefixRe =
          /(?:tại|điểm|đỉnh|góc|cạnh|vật|chất|nhóm|loại|hình|bảng|ông|bà|anh|chị|vitamin|dung\s+dịch|ống|bình|mạch|cực|nguồn|vị\s+trí|trường\s+hợp|phần|đoạn|khu|vùng|tỉnh|nước|hạt|dây|quả\s+cầu|lò\s+xo|kí\s+hiệu|chữ|mẫu|cây|gen|alen|bệnh|đội|lớp|trường|công\s+ty)\s*$/i;

        // 5.5A. Nếu dòng bắt đầu bằng Câu hỏi (hoặc kết thúc vế hỏi bằng ? / :) và bị dính phương án "A. ..." ngay cuối dòng đó (kể cả khi B. ở dòng dưới):
        const plainSub = subWorking.replace(/⟦\/?[UB]⟧/g, '').trim();
        const startsWithOptionOrTF = /^(?:\*?\s*(?:\[\s*[A-Da-d]\s*\]|\(\s*[A-Da-d]\s*\)|[A-Da-d]\s*\*?\s*[\.\)]))\s*\S/.test(plainSub);

        if (!startsWithOptionOrTF) {
          subWorking = subWorking.replace(
            /([?:]\s+|\s{2,})((?:⟦U⟧\s*|⟦B⟧\s*)*\*?(?:\[\s*([Aa])\s*\]|([Aa])\s*\*?(?:⟦\/?[UB]⟧\s*)*[\.\)])(?:⟦\/?[UB]⟧\s*)*(?:\s+|(?=[A-ZÀ-Ỹa-zà-ỹ0-9"“'(\[-])))/g,
            (fullMatch, sep, optToken, _bL, _dL, offset, fullStr) => {
              const beforeText = fullStr.slice(0, offset).replace(/⟦\/?[UB]⟧/g, '').trim();
              const afterText = fullStr.slice(offset + fullMatch.length).replace(/⟦\/?[UB]⟧/g, '');
              if (!beforeText || stemNounPrefixRe.test(beforeText)) return fullMatch;
              // Nếu phía sau trong cùng dòng vẫn còn một cặp A. ... B. ... khác thì A. này thuộc câu dẫn
              if (/(?:^|[\s:?;!.)\]])\*?(?:\[\s*[Aa]\s*\]|[Aa]\s*\*?\s*[\.\)])\s*\S[\s\S]*?(?:^|[\s:?;!.)\]])\*?(?:\[\s*[Bb]\s*\]|[Bb]\s*\*?\s*[\.\)])\s*\S/.test(afterText)) {
                return fullMatch;
              }
              return `${sep.trim()}\n${optToken}`;
            }
          );
        }

        // 5.5B. Tách các phương án A. B. C. D. nằm cùng hàng (Hỗ trợ đầy đủ: 4 cột A-B-C-D, 2 cột A-B / C-D, hoặc C-D chung dòng):
        const subPartsAfterASplit = propagateUnderlineMarkersAcrossLines(subWorking).split('\n');
        const mcExpandedParts: string[] = [];

        subPartsAfterASplit.forEach(partLine => {
          let lineStr = partLine.trim();
          if (!lineStr) return;
          const plainPart = lineStr.replace(/⟦\/?[UB]⟧/g, '').trim();

          // Xác định ký hiệu phương án đầu dòng (nếu dòng đã bắt đầu sẵn bằng A., B., hoặc C.)
          const leadingOptMatch = plainPart.match(/^\*?(?:\[\s*([A-Da-d])\s*\]|\(\s*([A-Da-d])\s*\)|([A-Da-d])\s*\*?\s*[\.\)])\s*\S/);
          const leadingLetter = leadingOptMatch ? (leadingOptMatch[1] || leadingOptMatch[2] || leadingOptMatch[3]).toUpperCase() : '';

          // Kiểm tra xem dòng là mệnh đề Đúng/Sai a) b) c) d) hay phương án A. B. C. D.
          const isLowerTFLine =
            /^\*?[a-d]\s*\*?\s*\)\s*\S/.test(plainPart) ||
            /(?:^|[\s:.;?!>])\*?[a-d]\s*\*?\s*\)\s*\S[\s\S]*?[\s:.;?!>]\*?[b-d]\s*\*?\s*\)\s*\S/.test(plainPart);

          if (!isLowerTFLine) {
            let expectedNextCode =
              leadingLetter === 'A'
                ? 66 // Đã có A ở đầu dòng -> chờ B (66)
                : leadingLetter === 'B'
                ? 67 // Đã có B ở đầu dòng -> chờ C (67)
                : leadingLetter === 'C'
                ? 68 // Đã có C ở đầu dòng -> chờ D (68)
                : 65; // Chưa có phương án đầu dòng -> chờ A (65)

            const hasExplicitBInLine = /(?:^|[\s:?;!.)\]])(?:⟦U⟧\s*|⟦B⟧\s*)*\*?(?:\[\s*[Bb]\s*\]|[Bb]\s*\*?(?:⟦\/?[UB]⟧\s*)*[\.\)])\s*\S/.test(lineStr);

            lineStr = lineStr.replace(
              /([\s\t]+|(?<=[?:;!.…)\]"”’])\s*)((?:⟦U⟧\s*|⟦B⟧\s*)*\*?(?:\[\s*([A-Da-d])\s*\]|([A-Da-d])\s*\*?(?:⟦\/?[UB]⟧\s*)*[\.\)])(?:⟦\/?[UB]⟧\s*)*(?:\s+|(?=[A-ZÀ-Ỹa-zà-ỹ0-9"“'(\[-])))/g,
              (fullMatch, leadingSep, optToken, bracketLetter, dotLetter, offset, fullStr) => {
                if (offset === 0) return fullMatch;
                const rawLetter = (bracketLetter || dotLetter || '').toUpperCase();
                const code = rawLetter.charCodeAt(0);
                const beforeText = fullStr.slice(0, offset).replace(/⟦\/?[UB]⟧/g, '').trim();
                const afterText = fullStr.slice(offset + fullMatch.length).replace(/⟦\/?[UB]⟧/g, '');

                if (!beforeText || stemNounPrefixRe.test(beforeText)) {
                  return fullMatch;
                }

                // Tránh cắt nhầm viết tắt tên riêng hoặc số thập phân
                if (leadingSep === '' && /\d$/.test(beforeText)) {
                  return fullMatch;
                }

                if (code === 65 && expectedNextCode === 65) {
                  const hasAnotherABeforeB =
                    hasExplicitBInLine &&
                    /(?:^|[\s:?;!.)\]])\*?(?:\[\s*[Aa]\s*\]|[Aa]\s*\*?\s*[\.\)])\s*\S[\s\S]*?(?:^|[\s:?;!.)\]])\*?(?:\[\s*[Bb]\s*\]|[Bb]\s*\*?\s*[\.\)])\s*\S/.test(afterText);
                  if (hasAnotherABeforeB) {
                    return fullMatch;
                  }
                  expectedNextCode = 66;
                  return `\n${optToken}`;
                }

                if (code === expectedNextCode || (code === 67 && expectedNextCode === 65)) {
                  expectedNextCode = code + 1;
                  return `\n${optToken}`;
                }

                return fullMatch;
              }
            );
          }

          // 5.6. Tách mệnh đề Đúng/Sai a), b), c), d) (hoặc a., b., c., d.) bị dính chùm trên cùng dòng
          propagateUnderlineMarkersAcrossLines(lineStr)
            .split('\n')
            .forEach(mcSub => {
              let tfLine = mcSub.trim();
              if (!tfLine) return;
              const plainTF = tfLine.replace(/⟦\/?[UB]⟧/g, '').trim();

              const leadTFMatch = plainTF.match(/^\*?(?:Ý\s+|Mệnh\s*đề\s+|Phát\s*biểu\s+)?([a-d])\s*\*?\s*[\)\.]\s*\S/i);
              const leadTFLetter = leadTFMatch ? leadTFMatch[1].toLowerCase() : '';
              let expectedTFCode =
                leadTFLetter === 'a'
                  ? 98 // 'b'
                  : leadTFLetter === 'b'
                  ? 99 // 'c'
                  : leadTFLetter === 'c'
                  ? 100 // 'd'
                  : 97; // 'a'

              const hasInlineSequenceTF =
                /(?:^|[\s:.;?!)\]"”’>])\*?[a-d]\s*\*?\s*[\)\.]\s*\S[\s\S]*?(?:[\s:.;?!)\]"”’>])\*?[b-d]\s*\*?\s*[\)\.]\s*\S/i.test(plainTF) ||
                /[:.;?!)\]]\s*\*?a\s*\*?\s*\)\s*\S/i.test(plainTF);

              if (hasInlineSequenceTF) {
                tfLine = tfLine.replace(
                  /([\s\t]+|(?<=[:.;?!)\]"”’>])\s*)((?:⟦U⟧\s*|⟦B⟧\s*)*\*?([a-d])\s*\*?(?:⟦\/?[UB]⟧\s*)*([\)\.])(?:⟦\/?[UB]⟧\s*)*(?:\s+|(?=[A-ZÀ-Ỹa-zà-ỹ0-9"“'(\[-])))/gi,
                  (fullMatch, sep, labelToken, rawLet, punctChar, offset, fullStr) => {
                    if (offset === 0) return fullMatch;
                    const lCode = rawLet.toLowerCase().charCodeAt(0);
                    const beforeText = fullStr.slice(0, offset).replace(/⟦\/?[UB]⟧/g, '').trim();
                    if (!beforeText || stemNounPrefixRe.test(beforeText)) return fullMatch;
                    // Nếu dùng dấu chấm (a. b. c. d.) thay vì ngoặc đơn a), bắt buộc phải theo đúng thứ tự a -> b -> c -> d và có khoảng trắng
                    if (punctChar === '.' && lCode !== expectedTFCode) {
                      return fullMatch;
                    }
                    if (lCode === expectedTFCode || (punctChar === ')' && lCode >= expectedTFCode && lCode <= 100)) {
                      expectedTFCode = lCode + 1;
                      const cleanSep = sep.trim();
                      return `${cleanSep ? cleanSep : ''}\n${labelToken}`;
                    }
                    return fullMatch;
                  }
                );
              }

              mcExpandedParts.push(tfLine);
            });
        });

        const finalSubWorking = propagateUnderlineMarkersAcrossLines(mcExpandedParts.join('\n'));
        finalSubWorking.split('\n').forEach(sub => {
          const s = stripWordStyleGarbage(sub).replace(/[ \t]+/g, ' ').trim();
          if (s) expandedLines.push(s);
        });
      });
    });

    const parsed: { text: string; isU: boolean; isBold?: boolean; raw: string }[] = [];
    expandedLines.forEach(lineWithMarkers => {
      // Chỉ coi là có gạch chân (⟦U⟧) khi bên trong cặp ⟦U⟧...⟦/U⟧ thực sự có chữ cái hoặc chữ số
      const cleanedMarkers = lineWithMarkers
        .replace(/⟦U⟧([^A-Za-z0-9À-ỹ]*)⟦\/U⟧/g, '$1')
        .replace(/⟦B⟧([^A-Za-z0-9À-ỹ]*)⟦\/B⟧/g, '$1');

      const hasMarkerU = /⟦U⟧[\s\S]*?[A-Za-z0-9À-ỹ][\s\S]*?⟦\/U⟧/.test(cleanedMarkers) || cleanedMarkers.includes('⟦U⟧');
      const hasMarkerB = /⟦B⟧[\s\S]*?[A-Za-z0-9À-ỹ][\s\S]*?⟦\/B⟧/.test(cleanedMarkers) || cleanedMarkers.includes('⟦B⟧');
      const cleanTextLine = restoreMedia(
        stripWordStyleGarbage(
          cleanedMarkers
            .replace(/⟦\/?[UB]⟧/g, '')
            .replace(/\s+/g, ' ')
        ).trim()
      );
      if (!cleanTextLine) return;

      const hasStarMarker =
        /^([A-Da-d])\s*\*+\s*[.:\)\/\-]/.test(cleanTextLine) ||
        /^\*+\s*[A-Da-d]\s*[.:\)\/\-]/.test(cleanTextLine) ||
        /^[A-Da-d]\s*[.:\)\/\-]\s*\*+/.test(cleanTextLine);

      parsed.push({
        text: cleanTextLine,
        isU: hasMarkerU || hasStarMarker,
        isBold: hasMarkerB,
        raw: restoreMedia(cleanedMarkers.replace(/⟦\/?B⟧/g, ''))
      });
    });

    return parsed;
  };

  const htmlParsed = parseRawSegment(htmlString, false);
  if (!plainTextFallback || !plainTextFallback.trim()) {
    return htmlParsed;
  }

  const htmlHasMediaOrUnderline = htmlParsed.some(
    x => x.isU || x.text.includes('<img') || x.text.includes('<table') || x.text.includes('<sub>') || x.text.includes('<sup>')
  );

  const plainParsed = parseRawSegment(plainTextFallback, true);
  if (plainParsed.length === 0) return htmlParsed;
  if (htmlParsed.length === 0) return plainParsed;

  const countOptionMarkers = (arr: { text: string }[]) =>
    arr.filter(x => /^[A-Da-d]\s*\*?\s*[.:\)\/\-]\s*\S/.test(x.text)).length;
  const countQuestionMarkers = (arr: { text: string }[]) =>
    arr.filter(x => /^(?:Câu|Bài|Question|\d{1,3}\s*[.:\)\/])/i.test(x.text)).length;

  const htmlOptCount = countOptionMarkers(htmlParsed);
  const plainOptCount = countOptionMarkers(plainParsed);
  const htmlQCount = countQuestionMarkers(htmlParsed);
  const plainQCount = countQuestionMarkers(plainParsed);

  if (!htmlHasMediaOrUnderline && (plainOptCount > htmlOptCount || (plainOptCount === htmlOptCount && plainQCount > htmlQCount))) {
    const normalizeForMatch = (s: string) =>
      s
        .replace(/^(?:(?:Câu|Bài|Question)\s*\d+\s*[:.)\/\-]?\s*|[A-Da-d]\s*\*?\s*[.:\)\/\-]\s*|\d{1,3}\s*[.:\)\/]\s*)/i, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    const uNormList: string[] = [];
    const bNormList: string[] = [];
    htmlParsed.forEach(hp => {
      const norm = normalizeForMatch(hp.text);
      if (norm.length >= 1) {
        if (hp.isU) uNormList.push(norm);
        if (hp.isBold) bNormList.push(norm);
      }
    });

    return plainParsed.map(pp => {
      const norm = normalizeForMatch(pp.text);
      const isMarkedU =
        pp.isU ||
        (norm.length >= 1 && uNormList.some(uNorm => uNorm === norm || (uNorm.length >= 3 && norm.includes(uNorm)) || (norm.length >= 3 && uNorm.includes(norm))));
      const isMarkedB =
        pp.isBold ||
        (norm.length >= 1 && bNormList.some(bNorm => bNorm === norm));
      return {
        text: pp.text,
        isU: isMarkedU,
        isBold: isMarkedB,
        raw: isMarkedU && !pp.raw.includes('⟦U⟧') ? `⟦U⟧${pp.text}⟦/U⟧` : pp.raw
      };
    });
  }

  if (htmlHasMediaOrUnderline && plainOptCount > htmlOptCount && plainParsed.length === htmlParsed.length) {
    return htmlParsed.map((hp, idx) => {
      const pp = plainParsed[idx];
      const hpHasPrefix = /^([A-Da-d]\s*\*?\s*[.:\)\/\-]|\d{1,3}\s*[.:\)\/\-]|(?:Câu|Bài|Question)\b)/i.test(hp.text);
      const ppPrefixMatch = pp.text.match(/^([A-Da-d]\s*\*?\s*[.:\)\/\-]\s*|(?:Câu|Bài|Question)\s*\d+\s*[:.)\/\-]?\s*)/i);
      if (!hpHasPrefix && ppPrefixMatch) {
        const mergedText = `${ppPrefixMatch[1]}${hp.text}`;
        return {
          ...hp,
          text: mergedText,
          raw: hp.isU ? `⟦U⟧${mergedText}⟦/U⟧` : mergedText
        };
      }
      return hp;
    });
  }

  return htmlParsed;
}

/**
 * QUY TẮC SỐNG CÒN DẠNG THỨC II (ĐÚNG / SAI):
 * - Mặc định mệnh đề CÓ GẠCH CHÂN (lineIsU === true) hoặc đánh dấu sao (*) là ĐÚNG (isTrue = true), bất chấp cuối câu có chữ cũ hay không!
 * - Mặc định mệnh đề KHÔNG GẠCH CHÂN (lineIsU === false) là SAI (isTrue = false),
 *   trừ khi toàn bộ câu hỏi chưa dùng gạch chân và giáo viên ghi rõ chữ "(Đúng)" ở cuối mệnh đề.
 */
function detectStatementTrueFalse(
  rawStmt: string,
  lineIsU: boolean,
  hasStar: boolean,
  questionUsesUnderline: boolean = false
): { textContent: string; isTrue: boolean } {
  const cleanedStmt = stripWordStyleGarbage(rawStmt);
  const textContent = cleanTFStatementText(cleanedStmt) || cleanedStmt.trim();

  // Ưu tiên số 1 tuyệt đối: Nếu được gạch chân (<u>) hoặc có dấu * -> MẶC ĐỊNH LÀ ĐÚNG!
  if (lineIsU || hasStar) {
    return { textContent, isTrue: true };
  }

  if (questionUsesUnderline) {
    return { textContent, isTrue: false };
  }

  const hasExplicitFalse =
    /(?:\(\s*(?:sai|s|false)\s*\)|\[\s*(?:sai|s|false)\s*\]|(?:->|=>|-|:)\s*(?:sai|s|false)\s*[.;,]*$|(?:\s|^)sai\s*[.;,]*$)/i.test(cleanedStmt);
  if (hasExplicitFalse) {
    return { textContent, isTrue: false };
  }

  const hasExplicitTrue =
    /(?:\(\s*(?:đúng|đ|true)\s*\)|\[\s*(?:đúng|đ|true)\s*\]|(?:->|=>|-|:)\s*(?:đúng|đ|true)\s*[.;,]*$|(?:\s|^)đúng\s*[.;,]*$|✓|✔)/i.test(cleanedStmt);

  return { textContent, isTrue: hasExplicitTrue };
}

// Bóc tách bảng đáp án tổng hợp cuối đề (VD: "1A 2B 3C 4D" hoặc "1.A  2.B  3.C  4.D" hoặc "Câu 1: A, Câu 2: B")
function extractBatchAnswerKeyMap(rawLine: string): Record<number, number> | null {
  const cleaned = (rawLine || '').replace(/⟦\/?[UB]⟧/g, '').trim();
  if (!cleaned) return null;
  // Không ăn nhầm câu hỏi thực sự có dấu ? hoặc quá dài mà ít cặp số-chữ
  const pairs: { qNum: number; ansIdx: number }[] = [];
  const regex = /(?:(?:câu|bài)\s*)?(\d{1,3})\s*(?:[\.\:\-\=\)\/]\s*|\s+)?([A-D])(?=$|[\s,;|\/.\)\]])/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(cleaned)) !== null) {
    const qNum = parseInt(m[1], 10);
    const ansIdx = m[2].toUpperCase().charCodeAt(0) - 65;
    if (qNum >= 1 && qNum <= 500 && ansIdx >= 0 && ansIdx <= 3) {
      pairs.push({ qNum, ansIdx });
    }
  }
  // Nếu có từ 2 cặp đáp án trở lên (VD: "1.A 2.B") hoặc dòng chỉ chứa đúng 1 cặp ngắn như "1. A"
  const isSingleShortAnswerPair =
    pairs.length === 1 && /^(?:(?:câu|bài)\s*)?\d{1,3}\s*[\.\:\-\=\)]\s*[A-D]\.?$/i.test(cleaned);
  if (pairs.length >= 2 || isSingleShortAnswerPair) {
    const map: Record<number, number> = {};
    pairs.forEach(p => {
      map[p.qNum] = p.ansIdx;
    });
    return map;
  }
  return null;
}

export function parseHTMLToQuiz(
  htmlString: string,
  forcedFormat?: QuestionFormat,
  plainTextFallback?: string
): QuizItem[] {
  const parsed = extractNormalizedLines(htmlString, plainTextFallback);
  if (parsed.length === 0) return [];

  const res: (QuizItem & { _origQNum?: number })[] = [];
  let cur: (QuizItem & {
    _origQNum?: number;
    _boldOptIndices?: number[];
    _underlinedOptIndices?: number[];
    _tfUnderlinedFlags?: boolean[];
    _tfHasRealUnderline?: boolean;
  }) | null = null;
  let pendingOptionPrefix: { letter: string; isU: boolean; isBold?: boolean } | null = null;
  let currentSectionFormat: QuestionFormat | undefined = forcedFormat;
  const globalAnswerKeyMap: Record<number, number> = {};

  const pushCurrentIfValid = () => {
    if (!cur) return;

    // QUY TẮC TỐI THƯỢNG (DẠNG I - TRẮC NGHIỆM 4 LỰA CHỌN):
    // 1. Nếu có từ 1 đến 3 phương án được GẠCH CHÂN thật (<u>, style underline, hoặc dấu *), BẮT BUỘC nhận phương án gạch chân đó là ĐÚNG!
    // (Nếu cả 4 phương án đều có gạch chân 1 âm tiết như môn Tiếng Anh tìm từ phát âm khác, ưu tiên phương án in đậm/màu hoặc Đáp án: X)
    if (
      (!cur.format || cur.format === 'MULTIPLE_CHOICE') &&
      cur._underlinedOptIndices &&
      cur._underlinedOptIndices.length >= 1 &&
      cur._underlinedOptIndices.length <= 3
    ) {
      cur.correct = cur._underlinedOptIndices[cur._underlinedOptIndices.length - 1];
      cur.aiSelected = false;
    } else if (
      (!cur.format || cur.format === 'MULTIPLE_CHOICE') &&
      cur._boldOptIndices &&
      cur._boldOptIndices.length === 1
    ) {
      // 2. Nếu chưa có gạch chân đơn nhất mà có đúng 1 phương án in đậm / tô màu đỏ -> nhận phương án đó là đáp án đúng
      cur.correct = cur._boldOptIndices[0];
      cur.aiSelected = false;
    } else if (
      (!cur.format || cur.format === 'MULTIPLE_CHOICE') &&
      cur._underlinedOptIndices &&
      cur._underlinedOptIndices.length === 4 &&
      cur.correct === -1
    ) {
      cur.correct = cur._underlinedOptIndices[0];
      cur.aiSelected = false;
    }

    // QUY TẮC TỐI THƯỢNG (DẠNG II - ĐÚNG / SAI 4 MỆNH ĐỀ a, b, c, d):
    // Mặc định tuyệt đối: GẠCH CHÂN = ĐÚNG (true), KHÔNG GẠCH CHÂN = SAI (false)!
    if (cur.format === 'TRUE_FALSE' && cur.tfItems && cur.tfItems.length > 0 && cur._tfUnderlinedFlags) {
      if (cur._tfHasRealUnderline) {
        cur.tfItems.forEach((tf, idx) => {
          tf.isCorrect = Boolean(cur!._tfUnderlinedFlags![idx]);
        });
      }
      cur.opts = cur.tfItems.map(tf => `${tf.label}) ${tf.text} (${tf.isCorrect ? 'Đúng' : 'Sai'})`);
    }

    delete cur._boldOptIndices;
    delete cur._underlinedOptIndices;
    delete cur._tfUnderlinedFlags;
    delete cur._tfHasRealUnderline;

    // HOTFIX 2.2: Bắt lỗi đáp án rỗng / thiếu phương án (Fallback kèm cờ cảnh báo dòng cụ thể thay vì crash âm thầm)
    const lineNum = cur.sourceLine || 1;
    const warnings: string[] = [];
    if (!cur.format || cur.format === 'MULTIPLE_CHOICE') {
      if (cur.opts.length < 4) {
        warnings.push(`Cảnh báo dòng ${lineNum}: Câu hỏi chỉ nhận diện được ${cur.opts.length}/4 phương án (đã tự động điền phương án dự phòng).`);
      }
      if (cur.correct < 0 || cur.correct >= Math.max(cur.opts.length, 4)) {
        warnings.push(`Cảnh báo dòng ${lineNum}: Chưa gạch chân hoặc chọn đáp án đúng.`);
      }
    } else if (cur.format === 'TRUE_FALSE') {
      if (!cur.tfItems || cur.tfItems.length < 4) {
        warnings.push(`Cảnh báo dòng ${lineNum}: Câu Đúng/Sai thiếu đủ 4 mệnh đề a, b, c, d (chỉ có ${cur.tfItems?.length || 0}/4 mệnh đề).`);
      }
    } else if (cur.format === 'SHORT_ANSWER') {
      if (!cur.shortAnswer || !cur.shortAnswer.trim()) {
        warnings.push(`Cảnh báo dòng ${lineNum}: Câu trả lời ngắn chưa có dòng "Đáp án: ...".`);
      }
    }
    if (warnings.length > 0) {
      cur.parseWarning = warnings.join(' ');
    }

    if (
      (cur.q && cur.q.trim().length > 0) ||
      cur.opts.length > 0 ||
      (cur.tfItems && cur.tfItems.length > 0) ||
      (cur.shortAnswer && cur.shortAnswer.trim().length > 0)
    ) {
      res.push(cur);
    }
    cur = null;
  };

  const createBlankQuestion = (
    titleText: string,
    detectedFormat?: QuestionFormat,
    lineNumber: number = 1
  ): QuizItem & {
    _origQNum?: number;
    _boldOptIndices?: number[];
    _underlinedOptIndices?: number[];
    _tfUnderlinedFlags?: boolean[];
    _tfHasRealUnderline?: boolean;
  } => {
    const fmt: QuestionFormat =
      forcedFormat ||
      detectedFormat ||
      currentSectionFormat ||
      (/\[Đúng\/Sai\]|\[Đ\/S\]|xét\s+tính\s+đúng\s*\/?\s*sai|đúng\s+hay\s+sai\s+cho\s+mỗi\s+ý/i.test(titleText)
        ? 'TRUE_FALSE'
        : /\[Trả lời ngắn\]|\[Điền khuyết\]|\[Điền số\]/i.test(titleText)
        ? 'SHORT_ANSWER'
        : 'MULTIPLE_CHOICE');

    const numMatch = (titleText || '').match(/^\s*(?:Câu\s*(?:hỏi)?|Bài\s*(?:tập)?|Question)?\s*(\d{1,3})\b/i);
    const origNum = numMatch ? parseInt(numMatch[1], 10) : undefined;

    return {
      qid: res.length,
      q: cleanQuestionTitleText(titleText),
      format: fmt,
      opts: [],
      correct: -1,
      tfItems: [],
      shortAnswer: '',
      rightCount: 0,
      wrongCount: 0,
      sourceLine: lineNumber,
      _origQNum: origNum,
      _boldOptIndices: [],
      _underlinedOptIndices: [],
      _tfUnderlinedFlags: [],
      _tfHasRealUnderline: false
    };
  };

  for (let lineIdx = 0; lineIdx < parsed.length; lineIdx++) {
    const p = parsed[lineIdx];
    const currentLineNumber = lineIdx + 1;
    const rawTrimmed = stripWordStyleGarbage(p.text).trim();
    const cleanLine = rawTrimmed.replace(/^\*+\s*/, '').trim();
    if (!cleanLine) continue;

    // Bỏ qua dòng mệnh đề giả "c) Mệnh đề c (Sai)" sinh ra từ lần lưu lỗi trước đó
    if (/^[a-d]\s*[\)\.]\s*Mệnh\s+đề\s+[a-d]\s*(?:\(\s*(?:Đúng|Sai)\s*\))?$/i.test(cleanLine)) {
      continue;
    }

    // 0. Nhận diện tiêu đề Phần / Dạng thức (VD: "PHẦN I. Câu trắc nghiệm...", "PHẦN II. Đúng sai...", "PHẦN III. Trả lời ngắn...")
    if (/^(?:PHẦN|DẠNG\s*THỨC)\s*(?:I|1)\b/i.test(cleanLine) && cleanLine.length < 140) {
      if (!forcedFormat) currentSectionFormat = 'MULTIPLE_CHOICE';
      continue;
    }
    if (/^(?:PHẦN|DẠNG\s*THỨC)\s*(?:II|2)\b/i.test(cleanLine) && cleanLine.length < 140) {
      if (!forcedFormat) currentSectionFormat = 'TRUE_FALSE';
      continue;
    }
    if (/^(?:PHẦN|DẠNG\s*THỨC)\s*(?:III|3)\b/i.test(cleanLine) && cleanLine.length < 140) {
      if (!forcedFormat) currentSectionFormat = 'SHORT_ANSWER';
      continue;
    }
    if (/^(?:BẢNG\s*ĐÁP\s*ÁN|HƯỚNG\s*DẪN\s*GIẢI|ĐÁP\s*ÁN\s*THAM\s*KHẢO)\s*[:.]?$/i.test(cleanLine)) {
      continue;
    }

    // Kiểm tra xem dòng có phải là Bảng đáp án cuối đề (VD: "1.A 2.B 3.C 4.D" hoặc "1. A") không
    const batchKey = extractBatchAnswerKeyMap(cleanLine);
    if (batchKey && cleanLine.length < 200 && !/[?]/.test(cleanLine) && !/<table|<img/i.test(cleanLine)) {
      Object.assign(globalAnswerKeyMap, batchKey);
      continue;
    }

    // Nếu dòng trước chỉ có mỗi nhãn "A." hoặc "a)" rời (do copy từ bảng Word bị tách ô) -> ghép dòng này làm nội dung phương án đó!
    if (pendingOptionPrefix && cur) {
      const activeFmt = forcedFormat || cur.format;
      const pref = pendingOptionPrefix;
      pendingOptionPrefix = null;
      if (activeFmt === 'TRUE_FALSE') {
        const isLineUnderlined = pref.isU || p.isU;
        if (isLineUnderlined) cur._tfHasRealUnderline = true;
        const { textContent, isTrue } = detectStatementTrueFalse(cleanLine, isLineUnderlined, false, Boolean(cur._tfHasRealUnderline));
        cur.tfItems = cur.tfItems || [];
        if (cur.tfItems.length < 4) {
          cur.tfItems.push({ label: pref.letter.toLowerCase(), text: textContent, isCorrect: isTrue });
          cur._tfUnderlinedFlags = cur._tfUnderlinedFlags || [];
          cur._tfUnderlinedFlags.push(isLineUnderlined);
          cur.opts.push(`${pref.letter.toLowerCase()}) ${textContent} (${isTrue ? 'Đúng' : 'Sai'})`);
        }
        continue;
      } else {
        const letterIdx = pref.letter.toUpperCase().charCodeAt(0) - 65;
        if (letterIdx >= 0 && letterIdx < 4) {
          const oIdx = Math.min(cur.opts.length, 3);
          const isMarked = pref.isU || p.isU || /(\(\s*đúng\s*\)|\[\s*đúng\s*\]|✓|✔|\*$)/i.test(cleanLine);
          const cleanOpt = cleanLine
            .replace(/\s*\(\s*đúng\s*\)\s*|\s*\[\s*đúng\s*\]\s*|\s*✓\s*|\s*✔\s*|\s*\*+$/gi, '')
            .trim();
          if (cur.opts.length < 4) {
            cur.opts.push(cleanOpt || cleanLine);
          } else {
            cur.opts[3] = `${cur.opts[3]} ${cleanOpt || cleanLine}`.trim();
          }
          if (isMarked) {
            cur.correct = oIdx;
            cur.aiSelected = false;
            cur._underlinedOptIndices = cur._underlinedOptIndices || [];
            if (!cur._underlinedOptIndices.includes(oIdx)) cur._underlinedOptIndices.push(oIdx);
          }
          if (pref.isBold || p.isBold) {
            cur._boldOptIndices = cur._boldOptIndices || [];
            if (!cur._boldOptIndices.includes(oIdx)) cur._boldOptIndices.push(oIdx);
          }
        }
        continue;
      }
    }

    // Nhận diện dòng chỉ có mỗi ký hiệu "A." / "a." / "A)" / "[A]" đứng riêng 1 mình (chỉ chấp nhận A, B, C, D hoặc a, b, c, d)
    const standaloneOptPrefix = cleanLine.match(/^(?:\[\s*([A-Da-d])\s*\]|\(\s*([A-Da-d])\s*\)|([A-Da-d])\s*\*?\s*[\.:\)\-])$/);
    if (standaloneOptPrefix && cur) {
      const letter = standaloneOptPrefix[1] || standaloneOptPrefix[2] || standaloneOptPrefix[3];
      pendingOptionPrefix = {
        letter,
        isU: p.isU || /^\*/.test(rawTrimmed),
        isBold: p.isBold
      };
      continue;
    }

    // SELF-HEALING CHO PHƯƠNG ÁN THỨ 5 ("E." / "e)"):
    // Bắt buộc chỉ có 4 phương án A, B, C, D (hoặc a, b, c, d).
    // Nếu trong ô nhập cũ của giáo viên lỡ bị sinh ra dòng "E. ..." do câu hỏi dài bị cắt thân câu thành "A.",
    // tự động đẩy "A." (phần thân câu bị cắt nhầm) về lại câu dẫn cur.q và dịch B->A, C->B, D->C, E->D!
    const bogusOptionEMatch = cleanLine.match(
      /^(?:\[\s*([Ee])\s*\]|\(\s*([Ee])\s*\)|([Ee])\s*\*?\s*[\.:\)])\s*\*?\s*([\s\S]+)/
    );
    if (bogusOptionEMatch && cur) {
      const eTextRaw = bogusOptionEMatch[4] || '';
      const hasStarE = /^\*/.test(rawTrimmed) || /^[Ee]\s*\*/.test(cleanLine);
      const isMarkedE = p.isU || hasStarE || /(\(\s*đúng\s*\)|\[\s*đúng\s*\]|✓|✔|\*$)/i.test(eTextRaw);
      const cleanEText = eTextRaw
        .replace(/\s*\(\s*đúng\s*\)\s*|\s*\[\s*đúng\s*\]\s*|\s*✓\s*|\s*✔\s*|\s*\*+$/gi, '')
        .trim();

      if (cur.format === 'TRUE_FALSE' && cur.tfItems && cur.tfItems.length >= 4) {
        const firstText = cur.tfItems[0]?.text || '';
        if (/[?:…]$/.test(firstText) || !/[?:]$/.test((cur.q || '').trim())) {
          cur.q = cur.q ? `${cur.q} ${firstText}` : firstText;
          if (p.isU || hasStarE) cur._tfHasRealUnderline = true;
          const { textContent, isTrue } = detectStatementTrueFalse(eTextRaw, p.isU, hasStarE, Boolean(cur._tfHasRealUnderline));
          const prevFlags = cur._tfUnderlinedFlags || [false, false, false, false];
          const shifted = [
            { label: 'a', text: cur.tfItems[1].text, isCorrect: cur.tfItems[1].isCorrect },
            { label: 'b', text: cur.tfItems[2].text, isCorrect: cur.tfItems[2].isCorrect },
            { label: 'c', text: cur.tfItems[3].text, isCorrect: cur.tfItems[3].isCorrect },
            { label: 'd', text: textContent, isCorrect: isTrue }
          ];
          cur.tfItems = shifted;
          cur._tfUnderlinedFlags = [Boolean(prevFlags[1]), Boolean(prevFlags[2]), Boolean(prevFlags[3]), Boolean(p.isU || hasStarE)];
          cur.opts = shifted.map(tf => `${tf.label}) ${tf.text} (${tf.isCorrect ? 'Đúng' : 'Sai'})`);
        }
        continue;
      }

      if (cur.opts.length >= 4) {
        const firstOpt = cur.opts[0] || '';
        const firstLooksLikeStem =
          /[?:…]$/.test(firstOpt) ||
          !/[?:]$/.test((cur.q || '').trim()) ||
          /(?:^|\b)(?:hỏi|tính|xác\s+định|biết|cho\s+biết|số\s+phát\s+biểu|phát\s+biểu\s+nào|nội\s+dung\s+nào|ý\s+nghĩa\s+nào|nguyên\s+nhân\s+nào|đặc\s+điểm\s+nào|nhận\s+định\s+nào|kết\s+luận\s+nào|công\s+thức\s+nào|giá\s+trị\s+của|độ\s+dài|thể\s+tích|diện\s+tích|trong\s+các)/i.test(firstOpt);

        if (firstLooksLikeStem && cleanEText) {
          cur.q = cur.q ? `${cur.q} ${firstOpt}` : firstOpt;
          cur.opts = [cur.opts[1], cur.opts[2], cur.opts[3], cleanEText];
          if (cur._underlinedOptIndices) {
            cur._underlinedOptIndices = cur._underlinedOptIndices
              .map(idx => idx - 1)
              .filter(idx => idx >= 0 && idx < 4);
          }
          if (cur._boldOptIndices) {
            cur._boldOptIndices = cur._boldOptIndices
              .map(idx => idx - 1)
              .filter(idx => idx >= 0 && idx < 4);
          }
          if (cur.correct > 0) {
            cur.correct = cur.correct - 1;
          } else if (cur.correct === 0) {
            cur.correct = -1;
          }
          if (isMarkedE) {
            cur.correct = 3;
            cur.aiSelected = false;
            cur._underlinedOptIndices = cur._underlinedOptIndices || [];
            if (!cur._underlinedOptIndices.includes(3)) cur._underlinedOptIndices.push(3);
          }
        }
        continue;
      }
    }

    // Bỏ qua mọi dòng phương án F., G., H. nếu có
    if (/^(?:\[\s*[F-Zf-z]\s*\]|\(\s*[F-Zf-z]\s*\)|[F-Zf-z]\s*\*?\s*[\.\)])\s+\S/.test(cleanLine) && cur && cur.opts.length >= 4) {
      continue;
    }

    // Nhận diện dòng tiêu đề Câu hỏi: "Câu 1:", "Câu 1.", "Câu 1/", "Câu 1 -", "Câu 1 Bào quan...", "Bài 1:", "Question 1:", "Câu:"
    const explicitQMatch = cleanLine.match(
      /^(?:Câu\s*(?:hỏi)?\s*(?:\d+\s*(?:[:.)\/\-]|\s+(?=[A-ZÀ-Ỹ"“'(\[<]))|[:.\-\[])|Bài\s*(?:tập)?\s*\d+\s*[:.)\/\-]?|Question\s*\d+\s*[:.)\/\-]?)\s*([\s\S]*)/i
    );
    // Số thứ tự đầu dòng (VD: "1. ", "2) ", "3/ ", "4: ")
    // LƯU Ý QUAN TRỌNG: Trong câu hỏi dài (Sinh/Sử/Địa/Hóa/Lý/Toán), các ý "1. ...", "2. ...", "3. ...", "4. ..."
    // nằm TRƯỚC "A. B. C. D." là các phát biểu dữ kiện trong thân câu hỏi, KHÔNG PHẢI câu hỏi mới hay phương án A, B, C, D!
    const numberedQMatch = cleanLine.match(/^(\d{1,3})\s*[.):\/]\s*(?!\d)([\s\S]+)/);

    // Nhận diện dòng Đáp án trực tiếp (VD: "Đáp án: 25", "Đáp án: A", "ĐS: 12,5", "Kết quả: 3", "Đáp án: Đ-S-Đ-S")
    const saM = cleanLine.match(
      /^(?:Đáp\s*án(?:\s*đúng)?|Đáp\s*số|ĐA|ĐS|TL|Trả\s*lời|Kết\s*quả|KQ|ShortAnswer|Answer)\s*[:=.]?\s*([\s\S]*)/i
    );

    // QUY CHUẨN NHẬN DIỆN ĐÁP ÁN:
    // Bắt buộc chỉ nhận diện 4 phương án A, B, C, D (hoặc a, b, c, d) với ký hiệu chuẩn:
    // A. B. C. D. / a. b. c. d. / A) B) C) D) / a) b) c) d) / [A] [B] [C] [D] / (A) (B) (C) (D)
    // Hỗ trợ cả trường hợp giáo viên gõ quên dấu cách sau dấu chấm (VD: "A.Hà Nội")!
    const rawBracketOrLetterOpt = cleanLine.match(
      /^(?:\[\s*([A-Da-d])\s*\]|\(\s*([A-Da-d])\s*\)|([A-Da-d])\s*\*?\s*(?:[\.:\)]|\s+-\s+))\s*\*?\s*([A-ZÀ-Ỹa-zà-ỹ0-9"“'(\[<\-$][\s\S]*)/
    );

    const optM: [string, string, string] | null = rawBracketOrLetterOpt
      ? [
          rawBracketOrLetterOpt[0],
          rawBracketOrLetterOpt[1] || rawBracketOrLetterOpt[2] || rawBracketOrLetterOpt[3],
          rawBracketOrLetterOpt[4]
        ]
      : null;

    const tfM = cleanLine.match(
      /^(?:Ý\s+|Mệnh\s*đề\s+|Phát\s*biểu\s+)?(?:\[\s*([a-dA-D])\s*\]|\(\s*([a-dA-D])\s*\)|([a-dA-D])\s*\*?\s*[\)\.\:\-])\s*\*?\s*([A-ZÀ-Ỹa-zà-ỹ0-9"“'(\[<\-$][\s\S]*)/i
    );

    // Hàm trợ giúp nhìn trước (Lookahead) TRONG PHẠM VI CÂU HỎI HIỆN TẠI (tối đa 160 dòng cho câu hỏi siêu dài):
    // Dừng ngay khi gặp tiêu đề câu hỏi mới HOẶC khi đã đi qua phương án D. / d) của câu hiện tại!
    // Tuyệt đối không quét tràn sang phương án A. của câu hỏi kế tiếp!
    const inspectUpcomingOptionsInCurrentQuestion = () => {
      let hasOptionA = false;
      let hasOptionBCD = false;
      let hasAnotherABeforeB = false;
      let seenBInLookahead = false;
      let hasTFStatementA = false;
      let hasExplicitAnswerLineAhead = false;

      for (let offset = 1; offset <= 160; offset++) {
        const nextP = parsed[lineIdx + offset];
        if (!nextP) break;
        const nextClean = stripWordStyleGarbage(nextP.text).replace(/^\*+\s*/, '').trim();
        if (!nextClean) continue;

        // Dừng ngay nếu gặp tiêu đề câu hỏi mới ("Câu X", "Bài X", "Question X", "PHẦN I/II/III")
        if (
          /^(?:Câu\s*(?:hỏi)?\s*(?:\d+\s*(?:[:.)\/\-]|\s+[A-ZÀ-Ỹ"“'(\[<])|[:.\-\[])|Bài\s*(?:tập)?\s*\d+\s*[:.)\/\-]?|Question\s*\d+\s*[:.)\/\-]?|(?:PHẦN|DẠNG\s*THỨC)\s*(?:I|II|III|1|2|3)\b)/i.test(
            nextClean
          )
        ) {
          break;
        }

        // Nếu đã bắt đầu có phương án (hoặc vừa quét qua phương án B/C/D) mà gặp câu đánh số "2. Nội dung..." -> Dừng ngay!
        if ((hasOptionBCD || (cur && cur.opts.length >= 2)) && /^\d{1,3}\s*[.):\/]\s*(?!\d)[A-ZÀ-Ỹ"“'(\[]/.test(nextClean)) {
          break;
        }

        if (/^(?:Đáp\s*án(?:\s*đúng)?|Đáp\s*số|ĐA|ĐS|TL|Trả\s*lời|Kết\s*quả|KQ|ShortAnswer|Answer)\s*[:=.]/i.test(nextClean)) {
          hasExplicitAnswerLineAhead = true;
        }

        const isNextA = /^(?:\[\s*[Aa]\s*\]|\(\s*[Aa]\s*\)|[Aa]\s*\*?\s*(?:[\.:\)]|\s+-\s+))\s*[A-ZÀ-Ỹa-zà-ỹ0-9"“'(\[<\-$]/.test(nextClean);
        const isNextBCD = /^(?:\[\s*[B-Db-d]\s*\]|\(\s*[B-Db-d]\s*\)|[B-Db-d]\s*\*?\s*(?:[\.:\)]|\s+-\s+))\s*[A-ZÀ-Ỹa-zà-ỹ0-9"“'(\[<\-$]/.test(nextClean);
        const isNextD = /^(?:\[\s*[Dd]\s*\]|\(\s*[Dd]\s*\)|[Dd]\s*\*?\s*(?:[\.:\)]|\s+-\s+))\s*[A-ZÀ-Ỹa-zà-ỹ0-9"“'(\[<\-$]/.test(nextClean);

        if (isNextA) {
          hasOptionA = true;
          if (!seenBInLookahead) {
            hasAnotherABeforeB = true;
          } else {
            // Đã thấy B. rồi mà lại thấy A. -> A. này là của câu hỏi tiếp theo (không có chữ "Câu X:"), dừng quét ngay!
            break;
          }
        }
        if (isNextBCD) {
          hasOptionBCD = true;
          seenBInLookahead = true;
          if (isNextD) {
            // Đã quét tới phương án D. cuối cùng của câu hiện tại -> dừng quét để không tràn sang câu sau!
            break;
          }
        }
        if (/^(?:Ý\s+|Mệnh\s*đề\s+|Phát\s*biểu\s+)?(?:\[\s*[aA]\s*\]|\(\s*[aA]\s*\)|[aA]\s*\*?\s*[\)\.\:\-])\s*\S/.test(nextClean)) {
          hasTFStatementA = true;
        }
      }
      return { hasOptionA, hasOptionBCD, hasAnotherABeforeB, hasTFStatementA, hasExplicitAnswerLineAhead };
    };

    // Hàm kiểm tra xem sau khi câu hiện tại ĐÃ ĐỦ 4 phương án (D. / d)), phía trước có bộ phương án của câu hỏi mới không
    const hasNewQuestionOptionsAheadAfterComplete = () => {
      for (let offset = 1; offset <= 60; offset++) {
        const nextP = parsed[lineIdx + offset];
        if (!nextP) break;
        const nextClean = stripWordStyleGarbage(nextP.text).replace(/^\*+\s*/, '').trim();
        if (!nextClean) continue;
        if (/^(?:\[\s*[Aa]\s*\]|\(\s*[Aa]\s*\)|[Aa]\s*\*?\s*[\.\)\:\-])\s*\S/.test(nextClean)) {
          return true;
        }
        if (/^(?:Câu\s*(?:hỏi)?\s*\d+|Bài\s*(?:tập)?\s*\d+|Question\s*\d+)/i.test(nextClean)) {
          return false;
        }
      }
      return false;
    };

    // 1. Nếu là dòng bắt đầu câu hỏi mới
    const isCurrentQuestionComplete =
      !cur ||
      cur.opts.length >= 4 ||
      (cur.tfItems && cur.tfItems.length >= 4) ||
      !!cur.shortAnswer;

    const isNumberedNewQ =
      numberedQMatch &&
      !optM &&
      !saM &&
      isCurrentQuestionComplete &&
      numberedQMatch[2].trim().length > 2 &&
      /[a-zA-ZÀ-ỹ]/.test(numberedQMatch[2]);

    if ((explicitQMatch || isNumberedNewQ) && !saM && !optM) {
      pushCurrentIfValid();
      cur = createBlankQuestion(cleanLine, undefined, currentLineNumber);
      continue;
    }

    // 2. Nếu là dòng "Đáp án: ..."
    if (saM) {
      if (!cur) {
        const inlineBatch = extractBatchAnswerKeyMap(saM[1]);
        if (inlineBatch) {
          Object.assign(globalAnswerKeyMap, inlineBatch);
          continue;
        }
        cur = createBlankQuestion('Câu hỏi bổ sung');
      }
      const rawAns = cleanShortAnswerValue(saM[1]);
      if (!rawAns) continue;

      const inlineBatch = extractBatchAnswerKeyMap(rawAns);
      if (inlineBatch && Object.keys(inlineBatch).length >= 2) {
        Object.assign(globalAnswerKeyMap, inlineBatch);
        continue;
      }

      const activeFmt = forcedFormat || cur.format;

      // Kiểm tra xem có phải đáp án tổng hợp của câu Đúng/Sai không (VD: "Đáp án: Đ - S - Đ - S" hoặc "a) Đúng, b) Sai...")
      const tfSummary = parseTrueFalseSummaryLine(rawAns);
      if (tfSummary && (activeFmt === 'TRUE_FALSE' || (cur.tfItems && cur.tfItems.length > 0))) {
        cur.format = 'TRUE_FALSE';
        if (cur.tfItems && cur.tfItems.length > 0) {
          cur.tfItems.forEach((item, idx) => {
            const key = item.label.toLowerCase();
            const fallbackKey = String.fromCharCode(97 + idx);
            if (typeof tfSummary[key] === 'boolean') {
              item.isCorrect = tfSummary[key];
            } else if (typeof tfSummary[fallbackKey] === 'boolean') {
              item.isCorrect = tfSummary[fallbackKey];
            }
          });
          cur._tfUnderlinedFlags = cur.tfItems.map(it => it.isCorrect);
          cur._tfHasRealUnderline = true;
          cur.opts = cur.tfItems.map(tf => `${tf.label}) ${tf.text} (${tf.isCorrect ? 'Đúng' : 'Sai'})`);
        }
        continue;
      }

      // Nếu đang ở Dạng thức I (4 phương án) và dòng là "Đáp án: A" / "Đáp án: B. Lục lạp" -> đánh dấu phương án đúng A/B/C/D!
      const singleLetterMatch = rawAns.match(/^(?:Chọn\s*|Đáp\s*án\s*)?([A-D])(?=[.:\)\s\-]|$)/i);
      if (
        singleLetterMatch &&
        (activeFmt === 'MULTIPLE_CHOICE' || cur.opts.length >= 2) &&
        forcedFormat !== 'SHORT_ANSWER'
      ) {
        const chosenIdx = singleLetterMatch[1].toUpperCase().charCodeAt(0) - 65;
        cur.correct = chosenIdx;
        cur.aiSelected = false;
        cur._underlinedOptIndices = [chosenIdx];
        continue;
      }

      // Nếu đang ở Dạng thức III hoặc câu trả lời ngắn
      cur.format = forcedFormat || 'SHORT_ANSWER';
      cur.shortAnswer = rawAns;
      cur.opts = [rawAns];
      cur.correct = 0;
      continue;
    }

    // 3. Xử lý theo từng Dạng thức cụ thể:
    const activeFormat = forcedFormat || (cur ? cur.format : currentSectionFormat || 'MULTIPLE_CHOICE');

    // --- KHUNG DẠNG THỨC II: ĐÚNG / SAI 4 Ý (a, b, c, d) ---
    if (activeFormat === 'TRUE_FALSE') {
      if (!tfM && cur && cur.tfItems && cur.tfItems.length >= 2 && cleanLine.length <= 60) {
        const standaloneSummary = parseTrueFalseSummaryLine(cleanLine);
        if (standaloneSummary) {
          cur.tfItems.forEach((item, idx) => {
            const key = item.label.toLowerCase();
            const fallbackKey = String.fromCharCode(97 + idx);
            if (typeof standaloneSummary[key] === 'boolean') {
              item.isCorrect = standaloneSummary[key];
            } else if (typeof standaloneSummary[fallbackKey] === 'boolean') {
              item.isCorrect = standaloneSummary[fallbackKey];
            }
          });
          cur._tfUnderlinedFlags = cur.tfItems.map(it => it.isCorrect);
          cur._tfHasRealUnderline = true;
          cur.opts = cur.tfItems.map(tf => `${tf.label}) ${tf.text} (${tf.isCorrect ? 'Đúng' : 'Sai'})`);
          continue;
        }
      }

      if (tfM) {
        if (!cur) {
          cur = createBlankQuestion('', 'TRUE_FALSE', currentLineNumber);
        }
        cur.format = 'TRUE_FALSE';
        const label = (tfM[1] || tfM[2] || tfM[3] || 'a').toLowerCase();
        const tfTargetIdx = label.charCodeAt(0) - 97; // 0: a, 1: b, 2: c, 3: d
        const currentTfLen = cur.tfItems?.length || 0;

        if (label === 'a') {
          if (currentTfLen >= 2) {
            pushCurrentIfValid();
            cur = createBlankQuestion('', 'TRUE_FALSE', currentLineNumber);
          } else if (currentTfLen === 1) {
            const prevFalseA = cur.tfItems![0].text;
            cur.q = cur.q ? `${cur.q} ${prevFalseA}` : prevFalseA;
            cur.tfItems = [];
            cur._tfUnderlinedFlags = [];
            cur._tfHasRealUnderline = false;
            cur.opts = [];
          }
        } else if (currentTfLen === 0) {
          const { hasTFStatementA } = inspectUpcomingOptionsInCurrentQuestion();
          if (hasTFStatementA) {
            cur.q = cur.q ? `${cur.q} ${cleanLine}` : cleanLine;
            continue;
          }
        }

        const rawStatement = tfM[4] || '';
        const hasStar = /^\*/.test(rawTrimmed) || /^[a-dA-D]\s*\*/.test(cleanLine);
        const isStmtUnderlined = Boolean(p.isU || hasStar);
        if (isStmtUnderlined) {
          cur._tfHasRealUnderline = true;
        }
        const { textContent, isTrue } = detectStatementTrueFalse(
          rawStatement,
          p.isU,
          hasStar,
          Boolean(cur._tfHasRealUnderline)
        );

        cur.tfItems = cur.tfItems || [];
        cur._tfUnderlinedFlags = cur._tfUnderlinedFlags || [];

        if (tfTargetIdx >= 0 && tfTargetIdx < 4) {
          if (cur.tfItems.length <= tfTargetIdx) {
            cur.tfItems.push({ label, text: textContent, isCorrect: isTrue });
            cur._tfUnderlinedFlags.push(isStmtUnderlined);
            cur.opts.push(`${label}) ${textContent} (${isTrue ? 'Đúng' : 'Sai'})`);
          } else {
            cur.tfItems[tfTargetIdx] = { label, text: textContent, isCorrect: isTrue };
            cur._tfUnderlinedFlags[tfTargetIdx] = isStmtUnderlined;
            cur.opts[tfTargetIdx] = `${label}) ${textContent} (${isTrue ? 'Đúng' : 'Sai'})`;
          }
        }
        continue;
      }

      const hasFinishedStatements =
        (cur?.tfItems?.length || 0) >= 4 ||
        (cur?.tfItems || []).some(it => it.label === 'd');

      if (!cur) {
        cur = createBlankQuestion(cleanLine, 'TRUE_FALSE', currentLineNumber);
      } else if (!cur.tfItems || cur.tfItems.length === 0) {
        cur.q = cur.q ? `${cur.q} ${cleanLine}` : cleanLine;
      } else if (!hasFinishedStatements) {
        const lastIdx = cur.tfItems.length - 1;
        cur.tfItems[lastIdx].text = cleanTFStatementText(`${cur.tfItems[lastIdx].text} ${cleanLine}`);
        if (p.isU) {
          cur.tfItems[lastIdx].isCorrect = true;
          cur._tfHasRealUnderline = true;
          if (cur._tfUnderlinedFlags) cur._tfUnderlinedFlags[lastIdx] = true;
        }
        cur.opts[lastIdx] = `${cur.tfItems[lastIdx].label}) ${cur.tfItems[lastIdx].text} (${cur.tfItems[lastIdx].isCorrect ? 'Đúng' : 'Sai'})`;
      } else {
        // Đã có đủ 4 mệnh đề a, b, c, d: Kiểm tra xem dòng này là dòng nối tiếp của mệnh đề d) hay là câu hỏi mới
        const lastStmtText = (cur.tfItems[cur.tfItems.length - 1]?.text || '').trim();
        const looksLikeLowercaseContinuation = !/[.?!;)]$/.test(lastStmtText) && /^[a-zà-ỹ]/.test(cleanLine);

        if (!looksLikeLowercaseContinuation && hasNewQuestionOptionsAheadAfterComplete()) {
          pushCurrentIfValid();
          cur = createBlankQuestion(cleanLine, 'TRUE_FALSE', currentLineNumber);
        } else {
          const lastIdx = cur.tfItems.length - 1;
          cur.tfItems[lastIdx].text = cleanTFStatementText(`${cur.tfItems[lastIdx].text} ${cleanLine}`);
          if (p.isU) {
            cur.tfItems[lastIdx].isCorrect = true;
            cur._tfHasRealUnderline = true;
            if (cur._tfUnderlinedFlags) cur._tfUnderlinedFlags[lastIdx] = true;
          }
          cur.opts[lastIdx] = `${cur.tfItems[lastIdx].label}) ${cur.tfItems[lastIdx].text} (${cur.tfItems[lastIdx].isCorrect ? 'Đúng' : 'Sai'})`;
        }
      }
      continue;
    }

    // --- KHUNG DẠNG THỨC III: TRẢ LỜI NGẮN ---
    if (activeFormat === 'SHORT_ANSWER') {
      if (!cur) {
        cur = createBlankQuestion(cleanLine, 'SHORT_ANSWER', currentLineNumber);
        continue;
      }
      if (cur.shortAnswer && !/<img|<table/i.test(cleanLine)) {
        pushCurrentIfValid();
        cur = createBlankQuestion(cleanLine, 'SHORT_ANSWER', currentLineNumber);
        continue;
      }
      const { hasExplicitAnswerLineAhead } = inspectUpcomingOptionsInCurrentQuestion();
      const isArrowAnswer = /^(?:=>|=)\s*(.+)/.test(cleanLine);
      const isNumericOrShortKey =
        cleanLine.length <= 24 &&
        !/[?;:]|<img|<table/i.test(cleanLine) &&
        (/^[-+]?\d+(?:[.,\/]\d+)?(?:\s*%|\s*[a-zA-Z°²³]{1,5})?$/.test(cleanLine) ||
          (cleanLine.split(/\s+/).length <= 2 && !/[?]/.test(cleanLine)));

      // Nếu phía dưới đã có dòng "Đáp án: ..." tường minh của câu này thì mọi dòng phía trên đều là nội dung câu hỏi dài!
      if (
        cur.q &&
        !hasExplicitAnswerLineAhead &&
        !/<img|<table/i.test(cleanLine) &&
        (p.isU || isArrowAnswer || isNumericOrShortKey)
      ) {
        const ansClean = cleanShortAnswerValue(cleanLine);
        cur.shortAnswer = ansClean;
        cur.opts = [ansClean];
        cur.correct = 0;
        continue;
      }
      cur.q = cur.q ? `${cur.q} ${cleanLine}` : cleanLine;
      continue;
    }

    // --- KHUNG DẠNG THỨC I (HOẶC TỰ ĐỘNG NHẬN DIỆN): BẮT BUỘC CHỈ 4 PHƯƠNG ÁN A, B, C, D ---
    if (optM) {
      if (!cur) {
        cur = createBlankQuestion('Câu hỏi trắc nghiệm:', 'MULTIPLE_CHOICE', currentLineNumber);
      }
      const isLowercaseParenTF = /^([a-d])\s*\*?\s*\)/.test(cleanLine);
      const hasTrueFalseSuffix = /(?:\(\s*(?:đúng|sai|đ|s)\s*\)|\[\s*(?:đúng|sai|đ|s)\s*\])/i.test(cleanLine);
      if (
        (hasTrueFalseSuffix && isLowercaseParenTF) ||
        (!forcedFormat && isLowercaseParenTF && (hasTrueFalseSuffix || cur.format === 'TRUE_FALSE'))
      ) {
        cur.format = 'TRUE_FALSE';
        const label = optM[1].toLowerCase();
        const tfIdx = label.charCodeAt(0) - 97;
        const rawStatement = optM[2];
        const hasStar = /^\*/.test(rawTrimmed) || /^[a-dA-D]\s*\*/.test(cleanLine);
        const isStmtU = Boolean(p.isU || hasStar);
        if (isStmtU) cur._tfHasRealUnderline = true;
        const { textContent, isTrue } = detectStatementTrueFalse(rawStatement, p.isU, hasStar, Boolean(cur._tfHasRealUnderline));
        cur.tfItems = cur.tfItems || [];
        cur._tfUnderlinedFlags = cur._tfUnderlinedFlags || [];
        if (tfIdx >= 0 && tfIdx < 4 && cur.tfItems.length < 4) {
          cur.tfItems.push({ label, text: textContent, isCorrect: isTrue });
          cur._tfUnderlinedFlags.push(isStmtU);
          cur.opts.push(`${label}) ${textContent} (${isTrue ? 'Đúng' : 'Sai'})`);
        }
        continue;
      }

      const optLetter = optM[1].toUpperCase(); // 'A' | 'B' | 'C' | 'D'
      const letterIdx = optLetter.charCodeAt(0) - 65; // 0 | 1 | 2 | 3

      if (optLetter === 'A') {
        const { hasAnotherABeforeB, hasOptionBCD } = inspectUpcomingOptionsInCurrentQuestion();
        // CHỈ KHI phía trước còn một ký hiệu "A." khác xuất hiện TRƯỚC "B." của chính câu này
        // thì dòng "A." hiện tại mới là câu văn trong phần thân câu hỏi dài!
        if (cur.opts.length === 0 && hasAnotherABeforeB && hasOptionBCD) {
          cur.q = cur.q ? `${cur.q} ${cleanLine}` : cleanLine;
          continue;
        }
        if (cur.opts.length >= 2) {
          // Câu trước đã có ít nhất A, B và nay gặp A. của câu mới -> đóng câu cũ, tạo câu mới
          pushCurrentIfValid();
          cur = createBlankQuestion('Câu hỏi trắc nghiệm:', 'MULTIPLE_CHOICE', currentLineNumber);
        } else if (cur.opts.length === 1) {
          // Nếu cur.opts mới chỉ có 1 phần tử (do một dòng trong thân câu hỏi dài bị nhận nhầm trước đó)
          // mà nay mới gặp ký hiệu "A." thật -> trả phần tử đó về lại thân câu dẫn cur.q!
          const prematureOpt = cur.opts[0];
          cur.q = cur.q ? `${cur.q} ${prematureOpt}` : prematureOpt;
          cur.opts = [];
          cur.correct = -1;
          cur._underlinedOptIndices = [];
          cur._boldOptIndices = [];
        }
      } else {
        // Khi gặp B., C., D.:
        if (cur.opts.length === 0) {
          const { hasOptionA } = inspectUpcomingOptionsInCurrentQuestion();
          if (hasOptionA) {
            // Phía dưới vẫn còn "A." thật của câu này -> dòng bắt đầu bằng B/C/D này nằm trong thân câu hỏi dài!
            cur.q = cur.q ? `${cur.q} ${cleanLine}` : cleanLine;
            continue;
          }
        }
        // Nếu có các dòng bị đẩy dư trước khi gặp đúng nhãn B (idx 1), C (idx 2), D (idx 3) -> gộp vào phương án liền trước
        while (cur.opts.length > letterIdx && letterIdx > 0) {
          const extra = cur.opts.pop()!;
          cur.opts[cur.opts.length - 1] = `${cur.opts[cur.opts.length - 1]} ${extra}`.trim();
        }
      }

      const rawOptText = optM[2];
      const hasStar = /^\*/.test(rawTrimmed) || /^[A-Da-d]\s*\*/.test(cleanLine);
      const isMarkedCorrect =
        p.isU ||
        hasStar ||
        /(\(\s*đúng\s*\)|\[\s*đúng\s*\]|✓|✔|\*$)/i.test(rawOptText);
      const cleanOpt = rawOptText
        .replace(/\s*\(\s*đúng\s*\)\s*|\s*\[\s*đúng\s*\]\s*|\s*✓\s*|\s*✔\s*|\s*\*+$/gi, '')
        .trim();

      // Đảm bảo chỉ lưu tối đa 4 phương án (index 0..3 tương ứng A, B, C, D), tuyệt đối không bao giờ sinh ra phương án thứ 5 (E.)
      let oIdx = cur.opts.length;
      if (oIdx < 4) {
        cur.opts.push(cleanOpt || rawOptText.trim());
      } else {
        oIdx = 3;
        cur.opts[3] = cleanOpt || rawOptText.trim();
      }

      if (isMarkedCorrect) {
        cur.correct = oIdx;
        cur.aiSelected = false;
        cur._underlinedOptIndices = cur._underlinedOptIndices || [];
        if (!cur._underlinedOptIndices.includes(oIdx)) {
          cur._underlinedOptIndices.push(oIdx);
        }
      }
      if (p.isBold) {
        cur._boldOptIndices = cur._boldOptIndices || [];
        if (!cur._boldOptIndices.includes(oIdx)) {
          cur._boldOptIndices.push(oIdx);
        }
      }
      continue;
    }

    // Dòng văn bản KHÔNG có tiền tố "Câu X:" và KHÔNG có ký hiệu đáp án "A. B. C. D.":
    // (Ví dụ: các đoạn văn dài của câu hỏi, các nhận định 1. 2. 3. 4., bảng số liệu, hoặc dòng xuống hàng của phương án dài)
    const isMediaOrTableLine = /<table\b|<img\b|\[(?:Hình|Sơ đồ|Đồ thị|Bản đồ|Bảng)/i.test(cleanLine);

    if (!cur) {
      cur = createBlankQuestion(cleanLine, forcedFormat || currentSectionFormat || 'MULTIPLE_CHOICE', currentLineNumber);
    } else if (cur.opts.length === 0 && (!cur.tfItems || cur.tfItems.length === 0) && !cur.shortAnswer) {
      if (isMediaOrTableLine) {
        cur.q = cur.q ? `${cur.q} ${cleanLine}` : cleanLine;
        continue;
      }
      const { hasOptionA, hasOptionBCD } = inspectUpcomingOptionsInCurrentQuestion();

      const nextP = parsed[lineIdx + 1];
      const nextClean = nextP ? stripWordStyleGarbage(nextP.text).replace(/^\*+\s*/, '').trim() : '';
      const isImmediatelyBeforeOrphanB =
        !hasOptionA &&
        hasOptionBCD &&
        /^(?:\[\s*[Bb]\s*\]|\(\s*[Bb]\s*\)|[Bb]\s*\*?\s*(?:[\.:\)]|\s+-\s+))\s*\S/.test(nextClean);

      if (isImmediatelyBeforeOrphanB && /[?:…]$/.test(cur.q.trim())) {
        const isMarked = p.isU || /(\(\s*đúng\s*\)|\[\s*đúng\s*\]|✓|✔|\*$)/i.test(cleanLine);
        const cleanOpt = cleanLine.replace(/\s*\(\s*đúng\s*\)\s*|\s*\[\s*đúng\s*\]\s*|\s*✓\s*|\s*✔\s*|\s*\*+$/gi, '').trim();
        cur.opts.push(cleanOpt || cleanLine);
        if (isMarked) {
          cur.correct = 0;
          cur.aiSelected = false;
          cur._underlinedOptIndices = [0];
        }
        if (p.isBold) {
          cur._boldOptIndices = [0];
        }
      } else {
        // Nối toàn bộ nội dung câu hỏi dài vào cur.q cho đến khi gặp đúng ký hiệu "A."
        cur.q = cur.q ? `${cur.q} ${cleanLine}` : cleanLine;
      }
    } else if (cur.opts.length > 0 && cur.opts.length < 4 && cur.format === 'MULTIPLE_CHOICE') {
      const { hasOptionA, hasOptionBCD } = inspectUpcomingOptionsInCurrentQuestion();

      if (hasOptionBCD || !hasOptionA) {
        const lastIdx = cur.opts.length - 1;
        const isMarked = p.isU || /(\(\s*đúng\s*\)|\[\s*đúng\s*\]|✓|✔|\*$)/i.test(cleanLine);
        const cleanOpt = cleanLine.replace(/\s*\(\s*đúng\s*\)\s*|\s*\[\s*đúng\s*\]\s*|\s*✓\s*|\s*✔\s*|\s*\*+$/gi, '').trim();
        cur.opts[lastIdx] = `${cur.opts[lastIdx]} ${cleanOpt || cleanLine}`.trim();
        if (isMarked) {
          cur.correct = lastIdx;
          cur.aiSelected = false;
          cur._underlinedOptIndices = cur._underlinedOptIndices || [];
          if (!cur._underlinedOptIndices.includes(lastIdx)) {
            cur._underlinedOptIndices.push(lastIdx);
          }
        }
        if (p.isBold) {
          cur._boldOptIndices = cur._boldOptIndices || [];
          if (!cur._boldOptIndices.includes(lastIdx)) {
            cur._boldOptIndices.push(lastIdx);
          }
        }
      } else {
        pushCurrentIfValid();
        cur = createBlankQuestion(cleanLine, forcedFormat || currentSectionFormat || 'MULTIPLE_CHOICE', currentLineNumber);
      }
    } else if (cur.opts.length >= 4 && cur.format === 'MULTIPLE_CHOICE') {
      // Đã nhận đủ 4 phương án A, B, C, D:
      // Kiểm tra xem dòng này là câu hỏi mới (không có chữ "Câu X:") hay là phần xuống dòng của phương án D. dài
      const lastOptText = (cur.opts[3] || '').trim();
      const looksLikeLowercaseContinuation = !/[.?!;)]$/.test(lastOptText) && /^[a-zà-ỹ]/.test(cleanLine);

      if (!looksLikeLowercaseContinuation && hasNewQuestionOptionsAheadAfterComplete()) {
        pushCurrentIfValid();
        cur = createBlankQuestion(cleanLine, forcedFormat || currentSectionFormat || 'MULTIPLE_CHOICE', currentLineNumber);
      } else {
        const isMarked = p.isU || /(\(\s*đúng\s*\)|\[\s*đúng\s*\]|✓|✔|\*$)/i.test(cleanLine);
        const cleanOpt = cleanLine.replace(/\s*\(\s*đúng\s*\)\s*|\s*\[\s*đúng\s*\]\s*|\s*✓\s*|\s*✔\s*|\s*\*+$/gi, '').trim();
        cur.opts[3] = `${cur.opts[3]} ${cleanOpt || cleanLine}`.trim();
        if (isMarked) {
          cur.correct = 3;
          cur.aiSelected = false;
          cur._underlinedOptIndices = cur._underlinedOptIndices || [];
          if (!cur._underlinedOptIndices.includes(3)) {
            cur._underlinedOptIndices.push(3);
          }
        }
      }
    } else {
      pushCurrentIfValid();
      cur = createBlankQuestion(cleanLine, forcedFormat || currentSectionFormat || 'MULTIPLE_CHOICE', currentLineNumber);
    }
  }

  pushCurrentIfValid();

  // Áp dụng Bảng đáp án tổng hợp cuối đề (nếu giáo viên dán kèm "1A 2B 3C 4D" ở dưới đề)
  if (Object.keys(globalAnswerKeyMap).length > 0) {
    res.forEach((item, idx) => {
      const qNum = item._origQNum || idx + 1;
      const fallbackQNum = idx + 1;
      const mappedAns =
        typeof globalAnswerKeyMap[qNum] === 'number'
          ? globalAnswerKeyMap[qNum]
          : typeof globalAnswerKeyMap[fallbackQNum] === 'number'
          ? globalAnswerKeyMap[fallbackQNum]
          : undefined;
      if (
        typeof mappedAns === 'number' &&
        (!item.format || item.format === 'MULTIPLE_CHOICE') &&
        (item.correct === -1 || item.aiSelected)
      ) {
        item.correct = mappedAns;
        item.aiSelected = false;
      }
      delete item._origQNum;
    });
  } else {
    res.forEach(item => {
      delete item._origQNum;
    });
  }

  return res
    .map((item, idx) => {
      item.qid = idx;
      if (!item.q || !item.q.trim()) {
        item.q = `Câu hỏi ${idx + 1}`;
      }
      return repairQuizItemIfCorrupted(item);
    })
    .filter(item => item.q.length > 0 && item.opts.length >= 1);
}

/**
 * Tự động phục hồi & làm sạch các câu hỏi bị dính chữ (đặc biệt là Dạng thức II Đúng/Sai
 * khi mệnh đề a) dính vào câu dẫn hoặc mệnh đề c), d) dính chung 1 ô, hoặc dính rác CSS Word).
 * TUYỆT ĐỐI TÔN TRỌNG ĐÁP ÁN DO GIÁO VIÊN GẠCH CHÂN / ĐÁNH DẤU!
 * BẮT BUỘC CHỈ CÓ TỐI ĐA 4 PHƯƠNG ÁN (A, B, C, D hoặc a, b, c, d) — KHÔNG BAO GIỜ CÓ PHƯƠNG ÁN E!
 */
export function repairQuizItemIfCorrupted(rawItem: QuizItem): QuizItem {
  const item: QuizItem = {
    ...rawItem,
    q: cleanQuestionTitleText(rawItem.q || ''),
    opts: Array.isArray(rawItem.opts) ? rawItem.opts.map(o => stripWordStyleGarbage(String(o || '')).trim()) : []
  };

  if (item.format === 'TRUE_FALSE') {
    const collectedTF: { text: string; isCorrect: boolean }[] = [];

    // 1. Nếu câu dẫn item.q còn dính "a) ... " ở cuối (sau dấu :, ., ;, ?, !) và không phải trong thẻ HTML -> tách ra thành mệnh đề đầu tiên
    const embeddedInQ = !/<table|<img/i.test(item.q)
      ? item.q.match(/^([\s\S]*?[:.;?!])\s*((?:[a-d]\s*[\)\.]\s+\S[\s\S]*))$/i)
      : null;
    if (embeddedInQ) {
      item.q = cleanQuestionTitleText(embeddedInQ[1]);
      const partsFromQ = embeddedInQ[2]
        .split(/(?=(?:^|[.?!;]\s+|\s{2,})[a-d]\s*[\)\.]\s+)/i)
        .map(s => s.trim())
        .filter(Boolean);
      partsFromQ.forEach(part => {
        const m = part.match(/^[a-d]\s*[\)\.]\s*([\s\S]*)/i);
        const rawBody = m ? m[1] : part;
        const { textContent, isTrue } = detectStatementTrueFalse(rawBody, false, false);
        const cleaned = cleanTFStatementText(textContent);
        if (cleaned && !/^(?:Chưa nhập nội dung mệnh đề|Mệnh đề\s+[a-d]\b)/i.test(cleaned)) {
          collectedTF.push({ text: cleaned, isCorrect: isTrue });
        }
      });
    }

    // 2. Duyệt qua các tfItems hiện có, giữ nguyên 100% giá trị isCorrect mà giáo viên đã gạch chân / chọn
    const sourceTF =
      item.tfItems && item.tfItems.length > 0
        ? item.tfItems
        : item.opts.map((txt, i) => ({
            label: String.fromCharCode(97 + i),
            text: txt,
            isCorrect: /\(\s*đúng\s*\)|<u>/i.test(txt)
          }));

    sourceTF.forEach(tf => {
      const rawText = stripWordStyleGarbage(String(tf.text || '')).trim();
      if (!rawText || /^(?:Chưa nhập nội dung mệnh đề|Mệnh đề\s+[a-d]\b)/i.test(cleanTFStatementText(rawText))) {
        return;
      }
      // Tách nếu trong nội dung mệnh đề có dính thêm mệnh đề b), c), d) phía sau
      const subParts = rawText
        .split(/(?=(?:^|[.?!;]\s+|\s{2,})[a-d]\s*[\)\.]\s+\S)/i)
        .map(s => s.trim())
        .filter(Boolean);

      if (subParts.length <= 1) {
        const cleaned = cleanTFStatementText(rawText);
        if (cleaned && !/^(?:Chưa nhập nội dung mệnh đề|Mệnh đề\s+[a-d]\b)/i.test(cleaned)) {
          collectedTF.push({ text: cleaned, isCorrect: Boolean(tf.isCorrect) });
        }
      } else {
        subParts.forEach((sp, spIdx) => {
          const m = sp.match(/^[a-d]\s*[\)\.]\s*([\s\S]*)/i);
          const body = m ? m[1] : sp;
          const hasExplicitTag = /(?:\(\s*(?:đúng|sai|đ|s)\s*\)|\[\s*(?:đúng|sai|đ|s)\s*\])/i.test(body);
          const { textContent, isTrue } = detectStatementTrueFalse(body, false, false);
          const cleaned = cleanTFStatementText(textContent);
          if (cleaned && !/^(?:Chưa nhập nội dung mệnh đề|Mệnh đề\s+[a-d]\b)/i.test(cleaned)) {
            collectedTF.push({
              text: cleaned,
              isCorrect: hasExplicitTag ? isTrue : spIdx === 0 ? Boolean(tf.isCorrect) : isTrue
            });
          }
        });
      }
    });

    // Khử trùng lặp liên tiếp nếu câu a) vừa nằm ở q vừa nằm ở tfItems[0]
    const dedupedTF: { text: string; isCorrect: boolean }[] = [];
    collectedTF.forEach(entry => {
      const norm = entry.text.toLowerCase().replace(/\s+/g, ' ').trim();
      const alreadyExists = dedupedTF.some(existing => existing.text.toLowerCase().replace(/\s+/g, ' ').trim() === norm);
      if (!alreadyExists) {
        dedupedTF.push(entry);
      }
    });

    while (dedupedTF.length < 4) {
      const nextIdx = dedupedTF.length;
      dedupedTF.push({
        text: `Mệnh đề ${String.fromCharCode(97 + nextIdx)}`,
        isCorrect: false
      });
    }

    item.tfItems = dedupedTF.slice(0, 4).map((tf, i) => ({
      label: String.fromCharCode(97 + i),
      text: cleanTFStatementText(tf.text) || `Mệnh đề ${String.fromCharCode(97 + i)}`,
      isCorrect: Boolean(tf.isCorrect)
    }));
    item.opts = item.tfItems.map(tf => `${tf.label}) ${tf.text} (${tf.isCorrect ? 'Đúng' : 'Sai'})`);
    return item;
  }

  if (item.format === 'SHORT_ANSWER') {
    if (!item.shortAnswer && item.opts.length > 0) {
      item.shortAnswer = cleanShortAnswerValue(item.opts[0]);
    }
    item.shortAnswer = cleanShortAnswerValue(item.shortAnswer || '');
    if (!item.shortAnswer) {
      item.shortAnswer = '1';
    }
    item.opts = [item.shortAnswer];
    item.correct = 0;
    return item;
  }

  // MULTIPLE_CHOICE: Nếu câu hỏi cũ bị lưu dư > 4 phương án (có phương án E.), tự động khôi phục về đúng 4 phương án A, B, C, D
  if (item.opts.length > 4) {
    const firstOpt = item.opts[0] || '';
    if (/[?:…]$/.test(firstOpt) || !/[?:]$/.test(item.q.trim())) {
      item.q = cleanQuestionTitleText(`${item.q} ${firstOpt}`);
      item.opts = item.opts.slice(1, 5);
      if (item.correct > 0) item.correct = Math.min(3, item.correct - 1);
    } else {
      item.opts = item.opts.slice(0, 4);
      if (item.correct >= 4) item.correct = 0;
    }
  }

  while (item.opts.length > 0 && item.opts.length < 4) {
    item.opts.push(`Phương án ${String.fromCharCode(65 + item.opts.length)}`);
  }
  if (item.opts.length === 0 && item.q) {
    item.opts = ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'];
  }
  item.opts = item.opts.slice(0, 4);

  // CHỈ dùng AI dự đoán khi câu hỏi hoàn toàn CHƯA có đáp án đúng (item.correct === -1)
  if (item.correct === -1 && item.opts.length > 0) {
    item.correct = aiAutoDetectCorrectIndex(item.q, item.opts);
    item.aiSelected = true;
  }
  if (item.correct < 0 || item.correct >= 4) {
    item.correct = 0;
  }
  return item;
}

// Tách danh sách QuizItem thành 3 chuỗi HTML riêng biệt cho 3 Khung Dạng Thức I, II, III
// Quy chuẩn hiển thị đồng nhất: Phương án / Mệnh đề ĐÚNG được bọc <u>...</u>, phương án / mệnh đề SAI không gạch chân!
// Bắt buộc chỉ xuất đúng 4 phương án A, B, C, D (Dạng 1) và a, b, c, d (Dạng 2).
export function splitQuizTo3FormatHTML(rawItems: QuizItem[]): {
  mcHTML: string;
  tfHTML: string;
  saHTML: string;
} {
  const items = (rawItems || []).map(q => repairQuizItemIfCorrupted(q));
  const mcItems = items.filter(q => !q.format || q.format === 'MULTIPLE_CHOICE');
  const tfItems = items.filter(q => q.format === 'TRUE_FALSE');
  const saItems = items.filter(q => q.format === 'SHORT_ANSWER');

  let mcHTML = '';
  mcItems.forEach((item, i) => {
    mcHTML += `<div>Câu ${i + 1}: ${cleanQuestionTitleText(item.q)}</div>`;
    item.opts.slice(0, 4).forEach((o, oi) => {
      const ch = String.fromCharCode(65 + oi);
      mcHTML += oi === item.correct ? `<div><u>${ch}. ${o}</u></div>` : `<div>${ch}. ${o}</div>`;
    });
    mcHTML += `<br>`;
  });

  let tfHTML = '';
  tfItems.forEach((item, i) => {
    tfHTML += `<div>Câu ${i + 1}: ${cleanQuestionTitleText(item.q)}</div>`;
    (item.tfItems || []).slice(0, 4).forEach((tf, tfi) => {
      const lbl = String.fromCharCode(97 + tfi);
      const cleanTxt = cleanTFStatementText(tf.text);
      if (tf.isCorrect) {
        tfHTML += `<div><u>${lbl}) ${cleanTxt}</u></div>`;
      } else {
        tfHTML += `<div>${lbl}) ${cleanTxt}</div>`;
      }
    });
    tfHTML += `<br>`;
  });

  let saHTML = '';
  saItems.forEach((item, i) => {
    const cleanAns = cleanShortAnswerValue(item.shortAnswer || item.opts[0] || '');
    saHTML += `<div>Câu ${i + 1}: ${cleanQuestionTitleText(item.q)}</div>`;
    saHTML += `<div><u>Đáp án: ${cleanAns}</u></div>`;
    saHTML += `<br>`;
  });

  return { mcHTML, tfHTML, saHTML };
}

export function formatQuizToHTML(rawItems: QuizItem[]): string {
  const items = (rawItems || []).map(q => repairQuizItemIfCorrupted(q));
  let html = '';
  items.forEach((item, i) => {
    if (item.format === 'TRUE_FALSE') {
      html += `<div>Câu ${i + 1} [Đúng/Sai]: ${cleanQuestionTitleText(item.q)}</div>`;
      (item.tfItems || []).slice(0, 4).forEach((tf, tfi) => {
        const lbl = String.fromCharCode(97 + tfi);
        const cleanTxt = cleanTFStatementText(tf.text);
        if (tf.isCorrect) {
          html += `<div><u>${lbl}) ${cleanTxt}</u></div>`;
        } else {
          html += `<div>${lbl}) ${cleanTxt}</div>`;
        }
      });
    } else if (item.format === 'SHORT_ANSWER') {
      const cleanAns = cleanShortAnswerValue(item.shortAnswer || item.opts[0] || '');
      html += `<div>Câu ${i + 1} [Trả lời ngắn]: ${cleanQuestionTitleText(item.q)}</div>`;
      html += `<div><u>Đáp án: ${cleanAns}</u></div>`;
    } else {
      html += `<div>Câu ${i + 1}: ${cleanQuestionTitleText(item.q)}</div>`;
      item.opts.slice(0, 4).forEach((o, oi) => {
        const ch = String.fromCharCode(65 + oi);
        html += oi === item.correct ? `<div><u>${ch}. ${o}</u></div>` : `<div>${ch}. ${o}</div>`;
      });
    }
    html += `<br>`;
  });
  return html;
}

export const SAMPLE_PHAN_1_MC = `<div>Câu: Bào quan nào thực hiện chức năng quang hợp chủ yếu ở thực vật?</div><div><u>A. Lục lạp</u></div><div>B. Ti thể</div><div>C. Không bào</div><div>D. Bộ máy Golgi</div><br>`;

export const SAMPLE_PHAN_2_TF = `<div>Câu: Trong các phát biểu sau về cấu trúc của phân tử DNA mạch kép (Gạch chân = Đúng, Không gạch chân = Sai):</div><div><u>a) Hai mạch đơn của DNA xoắn đều quanh một trục tưởng tượng theo chiều từ trái sang phải.</u></div><div><u>b) Các nucleotide trên hai mạch liên kết với nhau theo nguyên tắc bổ sung (A-T, G-X).</u></div><div>c) Liên kết giữa các nucleotide trên cùng một mạch là liên kết hydrogen yếu.</div><div><u>d) Tỉ lệ (A + G) / (T + X) trong phân tử DNA luôn xấp xỉ bằng 1.</u></div><br>`;

export const SAMPLE_PHAN_3_SA = `<div>Câu: Có bao nhiêu bộ ba mã di truyền (codon) trên phân tử mRNA đóng vai trò tín hiệu kết thúc quá trình dịch mã?</div><div><u>Đáp án: 3</u></div><br>`;


// Shuffles questions strictly adhering to GDPT 2018 format order:
// Part 1 (Multiple Choice) -> Part 2 (True/False) -> Part 3 (Short Answer)
// The questions WITHIN each part are randomly shuffled on every match!
export function shuffleQuestionOrder(deck: QuizItem[]): QuizItem[] {
  const cloned: QuizItem[] = JSON.parse(JSON.stringify(deck));

  const part1 = cloned.filter(q => !q.format || q.format === 'MULTIPLE_CHOICE');
  const part2 = cloned.filter(q => q.format === 'TRUE_FALSE');
  const part3 = cloned.filter(q => q.format === 'SHORT_ANSWER');

  const shuffleArray = (arr: QuizItem[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const shuffledPart1 = shuffleArray(part1);
  const shuffledPart2 = shuffleArray(part2);
  const shuffledPart3 = shuffleArray(part3);

  const combined = [...shuffledPart1, ...shuffledPart2, ...shuffledPart3];
  return combined.map((item, idx) => ({
    ...item,
    qid: idx
  }));
}

export function getQuestionPartInfo(format?: QuestionFormat): { partNumber: number; partTitle: string; partBadge: string; badgeColor: string } {
  if (format === 'TRUE_FALSE') {
    return {
      partNumber: 2,
      partTitle: 'DẠNG THỨC II (PHẦN II): TRẮC NGHIỆM ĐÚNG / SAI (4 Ý a, b, c, d)',
      partBadge: 'DẠNG THỨC II • ĐÚNG/SAI 4 Ý',
      badgeColor: '#f59e0b'
    };
  }
  if (format === 'SHORT_ANSWER') {
    return {
      partNumber: 3,
      partTitle: 'DẠNG THỨC III (PHẦN III): TRẮC NGHIỆM TRẢ LỜI NGẮN',
      partBadge: 'DẠNG THỨC III • TRẢ LỜI NGẮN',
      badgeColor: '#10b981'
    };
  }
  return {
    partNumber: 1,
    partTitle: 'DẠNG THỨC I (PHẦN I): TRẮC NGHIỆM 4 PHƯƠNG ÁN LỰA CHỌN',
    partBadge: 'DẠNG THỨC I • 4 PHƯƠNG ÁN',
    badgeColor: '#38bdf8'
  };
}

const studentShuffledCache: Record<string, QuizItem> = {};
export function getStableShuffledQuestion(questionItem: QuizItem, qIndexKey: number): QuizItem {
  const cacheKey = `${qIndexKey}_${questionItem.q}`;
  if (studentShuffledCache[cacheKey]) return studentShuffledCache[cacheKey];
  const optObjs = questionItem.opts.map((txt, idx) => ({ txt, isCorrect: idx === questionItem.correct }));
  for (let i = optObjs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [optObjs[i], optObjs[j]] = [optObjs[j], optObjs[i]];
  }
  const result: QuizItem = {
    qid: questionItem.qid,
    q: cleanQuestionTitleText(questionItem.q),
    format: questionItem.format,
    tfItems: questionItem.tfItems,
    shortAnswer: questionItem.shortAnswer,
    opts: optObjs.map(o => o.txt),
    correct: optObjs.findIndex(o => o.isCorrect),
    rightCount: questionItem.rightCount,
    wrongCount: questionItem.wrongCount
  };
  studentShuffledCache[cacheKey] = result;
  return result;
}

export const FASTEST_Q_DURATION_SEC = 30;
export const FASTEST_MAX_POINTS = 1000;
export const WRONG_ANSWER_PENALTY_POINTS = 1000;

export function calculateFastestPoints(elapsedSeconds: number, orderIndex: number): number {
  if (orderIndex === 0 && elapsedSeconds <= 2.0) {
    return FASTEST_MAX_POINTS;
  }
  const clampedSec = Math.max(0, Math.min(FASTEST_Q_DURATION_SEC, elapsedSeconds));
  const timeFactor = 1 - 0.5 * (clampedSec / FASTEST_Q_DURATION_SEC);
  const orderPenalty = Math.min(150, orderIndex * 10);
  const rawPts = Math.round(FASTEST_MAX_POINTS * timeFactor) - orderPenalty;
  return Math.max(500, Math.min(FASTEST_MAX_POINTS, rawPts));
}

export function getConvertedGradeByRank(rankNumber: number, totalScore: number) {
  if (totalScore <= 0 && rankNumber > 15) {
    return { grade: 6.0, label: '6.0 điểm (Khuyến khích)', css: 'grade-other' };
  }
  if (rankNumber >= 1 && rankNumber <= 3) {
    return { grade: 10, label: '10 điểm', css: 'grade-10' };
  }
  if (rankNumber >= 4 && rankNumber <= 6) {
    return { grade: 9, label: '9 điểm', css: 'grade-9' };
  }
  if (rankNumber >= 7 && rankNumber <= 10) {
    return { grade: 8, label: '8 điểm', css: 'grade-8' };
  }
  if (rankNumber >= 11 && rankNumber <= 15) {
    return { grade: 7, label: '7 điểm', css: 'grade-7' };
  }
  return { grade: 6, label: '6 điểm (Khuyến khích)', css: 'grade-other' };
}

// Tính điểm ghi vào Sổ điểm Giáo viên chuẩn theo Thông tư 22/2021/TT-BGDĐT:
// Tất cả trả về thang điểm 10, chỉ tính (số câu đúng / tổng số câu) * 10, làm tròn đến 1 chữ số thập phân.
// Tính điểm thực tế xếp thứ tự từ cao đến thấp để giáo viên ghi trực tiếp vào sổ điểm.
export function getTeacherGradebookScore(correctCount: number, totalQuestions: number = 12, _rankByCorrect?: number) {
  const safeTotalQ = Math.max(1, totalQuestions || 12);
  const safeCorrect = Math.max(0, Math.min(safeTotalQ, correctCount || 0));
  const exactGrade = Number(((safeCorrect / safeTotalQ) * 10).toFixed(1));

  let classification = 'Chưa đạt';
  let badgeColor = '#ef4444';
  if (exactGrade >= 8.0) {
    classification = 'Tốt / Giỏi';
    badgeColor = '#10b981';
  } else if (exactGrade >= 6.5) {
    classification = 'Khá';
    badgeColor = '#0284c7';
  } else if (exactGrade >= 5.0) {
    classification = 'Đạt';
    badgeColor = '#f59e0b';
  }

  return {
    grade: exactGrade,
    correctCount: safeCorrect,
    totalQuestions: safeTotalQ,
    classification,
    badgeColor,
    label: `${exactGrade.toFixed(1)} điểm (${classification})`
  };
}

export function getInitialSubjects(): Record<string, SubjectData> {
  const saved = localStorage.getItem('thpt_mangthit_subjects_v10');
  let db: Record<string, SubjectData> = {};
  let needsResave = false;
  if (saved) {
    try {
      db = JSON.parse(saved);
      Object.keys(db).forEach(k => {
        if (db[k] && typeof db[k].html === 'string') {
          if (/font-family|mso-|Times New Roman|Chưa nhập nội dung mệnh đề|\[Đúng\/Sai\]/i.test(db[k].html)) {
            const cleanedItems = parseHTMLToQuiz(db[k].html);
            if (cleanedItems.length > 0) {
              db[k].html = formatQuizToHTML(cleanedItems);
              const baseName = (db[k].name || '').replace(/\s*\(\d+\s*câu\)/i, '');
              if (!db[k].fixed) {
                db[k].name = `${baseName} (${cleanedItems.length} câu)`;
              }
              needsResave = true;
            }
          }
        }
      });
    } catch (e) {}
  }
  try {
    const activeSaved = localStorage.getItem('custom_Active_Quiz_V31');
    if (activeSaved) {
      const parsedActive = JSON.parse(activeSaved);
      if (Array.isArray(parsedActive) && parsedActive.length > 0) {
        const repairedActive = parsedActive.map((q: QuizItem) => repairQuizItemIfCorrupted(q));
        localStorage.setItem('custom_Active_Quiz_V31', JSON.stringify(repairedActive));
      }
    }
  } catch (e) {}

  if (!db['BIO']) db['BIO'] = { name: '🧬 Sinh Học', html: DEFAULT_BIO.trim(), color: '#10b981', fixed: true };
  if (!db['AGRI']) db['AGRI'] = { name: '🚜 Công Nghệ', html: DEFAULT_AGRI.trim(), color: '#f59e0b', fixed: true };
  if (!db['MATH']) db['MATH'] = { name: '📐 Toán Học', html: DEFAULT_MATH.trim(), color: '#0284c7', fixed: true };
  if (!db['PHYS']) db['PHYS'] = { name: '⚡ Vật Lý', html: DEFAULT_PHYS.trim(), color: '#8b5cf6', fixed: true };
  if (!db['CHEM']) db['CHEM'] = { name: '🧪 Hóa Học', html: DEFAULT_CHEM.trim(), color: '#ec4899', fixed: true };
  if (!db['LIT']) db['LIT'] = { name: '📖 Ngữ Văn', html: DEFAULT_LIT.trim(), color: '#e11d48', fixed: true };
  if (!db['ENG']) db['ENG'] = { name: '🇬🇧 Tiếng Anh', html: DEFAULT_ENG.trim(), color: '#0891b2', fixed: true };
  if (!db['HIST']) db['HIST'] = { name: '📜 Lịch Sử', html: DEFAULT_HIST.trim(), color: '#b45309', fixed: true };
  if (!db['GEO']) db['GEO'] = { name: '🌍 Địa Lý', html: DEFAULT_GEO.trim(), color: '#059169', fixed: true };
  if (!db['GDKTPL']) db['GDKTPL'] = { name: '⚖️ GDKT & PL', html: DEFAULT_GDKTPL.trim(), color: '#7c3aed', fixed: true };
  if (!db['IT']) db['IT'] = { name: '💻 Tin Học', html: DEFAULT_IT.trim(), color: '#2563eb', fixed: true };
  if (!db['GDQPAN']) db['GDQPAN'] = { name: '🛡️ GDQP & AN', html: DEFAULT_GDQPAN.trim(), color: '#4d7c0f', fixed: true };

  const allCombinedHTML = [
    DEFAULT_BIO, DEFAULT_AGRI, DEFAULT_MATH, DEFAULT_PHYS, DEFAULT_CHEM, DEFAULT_LIT,
    DEFAULT_ENG, DEFAULT_HIST, DEFAULT_GEO, DEFAULT_GDKTPL, DEFAULT_IT, DEFAULT_GDQPAN
  ].map(s => s.trim()).join('<br>');

  db['ALL_SUBJ'] = { name: '🌟 Tổng Hợp 12 Môn THPT', html: allCombinedHTML, color: '#4f46e5', fixed: true };

  if (needsResave) {
    try {
      localStorage.setItem('thpt_mangthit_subjects_v10', JSON.stringify(db));
    } catch (e) {}
  }

  return db;
}

export function getPresetQuizBySubject(subjKey: string): QuizItem[] {
  const db = getInitialSubjects();
  if (db[subjKey]) return parseHTMLToQuiz(db[subjKey].html);
  return parseHTMLToQuiz(db['ALL_SUBJ'] ? db['ALL_SUBJ'].html : DEFAULT_BIO);
}

