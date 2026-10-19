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
<div><u>A</u>. Giám sát độ ẩm đất, nhiệt độ, ánh sáng và tự động bật tắt hệ thống tưới từ xa qua điện thoại</div><div>B. Biến đổi gen cây trồng ngay ngoài đồng ruộng</div><div>C. Tự động thu hoạch toàn bộ gỗ rừng nguyên sinh</div><div>D. Không cần sử dụng nước và dinh dưỡng cho cây</div>`;

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
<div>A. 100 Hz</div><div><u>B</u>. 50 Hz</div><div>C. 60 Hz</div><div>D. 220 Hz</div>`;

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
<div>A. Nước muối NaCl</div><div><u>B</u>. Dung dịch kiềm mạnh (như NaOH)</div><div>C. Dầu hỏa</div><div>D. Khí Nitrogen ở nhiệt độ thường</div>`;

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
<div><u>A</u>. Chữ người tử tù</div><div>B. Một thời vang bóng</div><div>C. Chiếc lư đồng mắt cua</div><div>D. Hương cuội</div>`;

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
<div>A. on</div><div>B. at</div><div><u>C</u>. in</div><div>D. with</div>`;

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
<div><u>A</u>. Ngô Quyền</div><div>B. Đinh Bộ Lĩnh</div><div>C. Lê Hoàn</div><div>D. Lý Công Uẩn</div>`;

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
<div><u>A</u>. Biển Đông</div><div>B. Ấn Độ Dương</div><div>C. Địa Trung Hải</div><div>D. Biển Đỏ</div>`;

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
<div><u>A</u>. Quốc hội</div><div>B. Ủy ban nhân dân xã</div><div>C. Các doanh nghiệp tư nhân</div><div>D. Ngân hàng thương mại</div>`;

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
<div><u>A</u>. Đặt mật khẩu mạnh (gồm chữ hoa, chữ thường, số, ký tự đặc biệt) và bật xác thực 2 lớp (2FA), tuyệt đối không chia sẻ mã OTP</div><div>B. Đặt mật khẩu là 123456 cho dễ nhớ</div><div>C. Nhấp vào mọi đường link lạ trúng thưởng</div><div>D. Công khai mật khẩu lên mạng xã hội</div>`;

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
<div><u>A</u>. Từ đủ 18 tuổi đến hết 25 tuổi (đối với công dân được đào tạo trình độ cao đẳng, đại học thì đến hết 27 tuổi)</div><div>B. Từ 12 tuổi đến 15 tuổi</div><div>C. Từ 45 tuổi đến 60 tuổi</div><div>D. Không quy định độ tuổi</div>`;

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

export function cleanQuestionTitleText(rawText: string): string {
  return rawText
    .replace(/^(?:Câu\s*\d+[:.]?|\d+[.:])\s*/i, '')
    .replace(/^\s*\[[^\]]+\]\s*/g, '')
    .replace(/\[(?:SINH HỌC|CÔNG NGHỆ[^\]]*|TOÁN|VẬT LÝ|HÓA HỌC|NGỮ VĂN|TIẾNG ANH|LỊCH SỬ|ĐỊA LÝ|TIN HỌC|GDKTPL|GDQPAN)\]\s*/gi, '')
    .trim();
}

export function aiAutoDetectCorrectIndex(questionText: string, optionsArray: string[]): number {
  if (!optionsArray || optionsArray.length === 0) return 0;
  const qLower = (questionText || '').toLowerCase();
  let bestIdx = 0;
  let highestScore = -999;

  optionsArray.forEach((opt, idx) => {
    const oLower = (opt || '').toLowerCase().trim();
    let score = 0;

    if (/(\(đúng\)|✓|✔|\*$|đáp án đúng)/i.test(oLower)) score += 100;

    AI_KNOWLEDGE_KEYWORDS.forEach(kw => {
      if (oLower.includes(kw)) score += 35;
    });

    if (/(tất cả.*đều đúng|cả a, b, c đều đúng|cả a và b đều đúng|cả ba phương án)/i.test(oLower)) {
      score += 28;
    }
    if (/(không có đáp án|tất cả đều sai)/i.test(oLower)) {
      score -= 10;
    }

    score += Math.min(oLower.length * 0.18, 12);

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

export function parseHTMLToQuiz(htmlString: string): QuizItem[] {
  const lines = htmlString.split(/<br\s*[\/]?>|<\/div>|<\/p>/i);
  const parsed: { text: string; isU: boolean; raw: string }[] = [];
  lines.forEach(l => {
    const clean = l.replace(/<div>|<p>/gi, '').trim();
    if (clean) {
      const w = document.createElement('div');
      w.innerHTML = clean;
      const isU = w.querySelector('u') !== null || /text-decoration:\s*underline/i.test(clean);
      parsed.push({ text: w.textContent?.trim() || '', isU, raw: clean });
    }
  });

  const res: QuizItem[] = [];
  let cur: QuizItem | null = null;

  parsed.forEach(p => {
    const qM = p.text.match(/^(?:Câu\s*\d+[:.]?|\d+[.:])\s*(.*)/i);
    const optM = p.text.match(/^([A-Da-d])[.:\)]\s*(.*)/);
    const tfM = p.text.match(/^([a-d])[\)\.\:]\s*(.*)/i);
    const saM = p.text.match(/^(?:Đáp án|ĐA|TL|ShortAnswer|Answer)[:.]?\s*(.*)/i);

    if (qM && !optM && !saM) {
      if (cur) res.push(cur);
      const isTF = /\[Đúng\/Sai\]|\[Đ\/S\]|đúng\/sai/i.test(p.text);
      const isSA = /\[Trả lời ngắn\]|\[Điền khuyết\]|\[Điền số\]|trả lời ngắn/i.test(p.text);
      cur = {
        qid: res.length,
        q: cleanQuestionTitleText(p.text),
        format: isTF ? 'TRUE_FALSE' : (isSA ? 'SHORT_ANSWER' : 'MULTIPLE_CHOICE'),
        opts: [],
        correct: -1,
        tfItems: [],
        shortAnswer: '',
        rightCount: 0,
        wrongCount: 0
      };
    } else if (saM && cur) {
      cur.format = 'SHORT_ANSWER';
      const ansVal = saM[1].replace(/<[^>]+>/g, '').trim();
      cur.shortAnswer = ansVal;
      cur.opts = [ansVal];
      cur.correct = 0;
    } else if (cur && cur.format === 'TRUE_FALSE' && tfM) {
      const label = tfM[1].toLowerCase();
      const textContent = tfM[2].replace(/\s*\((?:Đúng|Sai)\)\s*|\s*\[(?:Đúng|Sai)\]\s*|\s*✓\s*|\s*✔\s*/gi, '').trim();
      const isTrue = p.isU || /(\(đúng\)|\[đúng\]|✓|✔)/i.test(tfM[2]) || !/(\(sai\)|\[sai\])/i.test(tfM[2]);
      cur.tfItems = cur.tfItems || [];
      cur.tfItems.push({ label, text: textContent, isCorrect: isTrue });
      cur.opts.push(`${label.toUpperCase()}. ${textContent} (${isTrue ? 'Đúng' : 'Sai'})`);
    } else if (optM && cur) {
      // Check if this looks like True/False
      if (/^([a-d])[\)\.]/i.test(p.text) && (p.text.toLowerCase().includes('(đúng)') || p.text.toLowerCase().includes('(sai)'))) {
        cur.format = 'TRUE_FALSE';
        const label = optM[1].toLowerCase();
        const textContent = optM[2].replace(/\s*\((?:Đúng|Sai)\)\s*|\s*\[(?:Đúng|Sai)\]\s*|\s*✓\s*|\s*✔\s*/gi, '').trim();
        const isTrue = p.isU || /(\(đúng\)|\[đúng\]|✓|✔)/i.test(optM[2]);
        cur.tfItems = cur.tfItems || [];
        cur.tfItems.push({ label, text: textContent, isCorrect: isTrue });
        cur.opts.push(`${label.toUpperCase()}. ${textContent} (${isTrue ? 'Đúng' : 'Sai'})`);
      } else {
        const oIdx = cur.opts.length;
        const cleanOpt = optM[2].replace(/\s*\(đúng\)\s*|\s*✓\s*|\s*✔\s*/gi, '').trim();
        cur.opts.push(cleanOpt);
        if ((p.isU || /(\(đúng\)|✓|✔)/i.test(optM[2])) && cur.correct === -1) {
          cur.correct = oIdx;
        }
      }
    }
  });

  if (cur) res.push(cur);

  return res.map(item => {
    if (item.format === 'TRUE_FALSE') {
      if (!item.tfItems || item.tfItems.length === 0) {
        // Fallback default 4 tf items
        item.tfItems = [
          { label: 'a', text: item.opts[0] || 'Mệnh đề 1', isCorrect: true },
          { label: 'b', text: item.opts[1] || 'Mệnh đề 2', isCorrect: false },
          { label: 'c', text: item.opts[2] || 'Mệnh đề 3', isCorrect: true },
          { label: 'd', text: item.opts[3] || 'Mệnh đề 4', isCorrect: false }
        ];
      }
      return item;
    }
    if (item.format === 'SHORT_ANSWER') {
      if (!item.shortAnswer && item.opts.length > 0) {
        item.shortAnswer = item.opts[0];
      }
      return item;
    }
    // MULTIPLE_CHOICE
    if (item.correct === -1 && item.opts.length > 0) {
      item.correct = aiAutoDetectCorrectIndex(item.q, item.opts);
      item.aiSelected = true;
    }
    return item;
  }).filter(item => {
    if (item.format === 'SHORT_ANSWER') return !!item.shortAnswer;
    if (item.format === 'TRUE_FALSE') return (item.tfItems?.length || 0) >= 2;
    return item.opts.length >= 2;
  });
}

export function formatQuizToHTML(items: QuizItem[]): string {
  let html = '';
  items.forEach((item, i) => {
    if (item.format === 'TRUE_FALSE') {
      html += `<div>Câu ${i + 1} [Đúng/Sai]: ${cleanQuestionTitleText(item.q)}</div>`;
      (item.tfItems || []).forEach(tf => {
        if (tf.isCorrect) {
          html += `<div><u>${tf.label})</u> ${tf.text} (Đúng)</div>`;
        } else {
          html += `<div>${tf.label}) ${tf.text} (Sai)</div>`;
        }
      });
    } else if (item.format === 'SHORT_ANSWER') {
      html += `<div>Câu ${i + 1} [Trả lời ngắn]: ${cleanQuestionTitleText(item.q)}</div>`;
      html += `<div><u>Đáp án: ${item.shortAnswer || item.opts[0] || ''}</u></div>`;
    } else {
      html += `<div>Câu ${i + 1}: ${cleanQuestionTitleText(item.q)}</div>`;
      item.opts.forEach((o, oi) => {
        const ch = String.fromCharCode(65 + oi);
        html += (oi === item.correct) ? `<div><u>${ch}</u>. ${o}</div>` : `<div>${ch}. ${o}</div>`;
      });
    }
    html += `<br>`;
  });
  return html;
}

export const SAMPLE_PHAN_1_MC = `<div>Câu [Phần I]: Bào quan nào thực hiện chức năng quang hợp chủ yếu ở thực vật?</div><div><u>A</u>. Lục lạp</div><div>B. Ti thể</div><div>C. Không bào</div><div>D. Bộ máy Golgi</div><br>`;

export const SAMPLE_PHAN_2_TF = `<div>Câu [Đúng/Sai]: Trong các phát biểu sau về cấu trúc của phân tử DNA mạch kép:</div><div><u>a)</u> Hai mạch đơn của DNA xoắn đều quanh một trục tưởng tượng theo chiều từ trái sang phải. (Đúng)</div><div><u>b)</u> Các nucleotide trên hai mạch liên kết với nhau theo nguyên tắc bổ sung (A-T, G-X). (Đúng)</div><div>c) Liên kết giữa các nucleotide trên cùng một mạch là liên kết hydrogen yếu. (Sai)</div><div><u>d)</u> Tỉ lệ (A + G) / (T + X) trong phân tử DNA luôn xấp xỉ bằng 1. (Đúng)</div><br>`;

export const SAMPLE_PHAN_3_SA = `<div>Câu [Trả lời ngắn]: Có bao nhiêu bộ ba mã di truyền (codon) trên phân tử mRNA đóng vai trò tín hiệu kết thúc quá trình dịch mã?</div><div><u>Đáp án: 3</u></div><br>`;


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
      partTitle: 'PHẦN II: TRẮC NGHIỆM ĐÚNG / SAI',
      partBadge: 'PHẦN II • ĐÚNG/SAI',
      badgeColor: '#f59e0b'
    };
  }
  if (format === 'SHORT_ANSWER') {
    return {
      partNumber: 3,
      partTitle: 'PHẦN III: TRẢ LỜI NGẮN (ĐIỀN SỐ / TỪ KHÓA)',
      partBadge: 'PHẦN III • ĐIỀN KHUYẾT',
      badgeColor: '#10b981'
    };
  }
  return {
    partNumber: 1,
    partTitle: 'PHẦN I: TRẮC NGHIỆM 4 PHƯƠNG ÁN LỰA CHỌN',
    partBadge: 'PHẦN I • 4 LỰA CHỌN',
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

export const FASTEST_Q_DURATION_SEC = 20;
export const FASTEST_MAX_POINTS = 1000;

export function calculateFastestPoints(elapsedSeconds: number, orderIndex: number): number {
  if (orderIndex === 0 && elapsedSeconds <= 1.2) {
    return FASTEST_MAX_POINTS;
  }
  const clampedSec = Math.max(0, Math.min(FASTEST_Q_DURATION_SEC, elapsedSeconds));
  const timeFactor = 1 - 0.85 * (clampedSec / FASTEST_Q_DURATION_SEC);
  const orderPenalty = Math.min(150, orderIndex * 15);
  const rawPts = Math.round(FASTEST_MAX_POINTS * timeFactor) - orderPenalty;
  return Math.max(100, Math.min(FASTEST_MAX_POINTS, rawPts));
}

export function getConvertedGradeByRank(rankNumber: number, totalScore: number) {
  if (!totalScore || totalScore <= 0) {
    return { grade: 0, label: '0 điểm (Chưa có điểm)', css: 'grade-other' };
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
  return { grade: 6, label: 'Khuyến khích', css: 'grade-other' };
}

export function getInitialSubjects(): Record<string, SubjectData> {
  const saved = localStorage.getItem('thpt_mangthit_subjects_v9');
  let db: Record<string, SubjectData> = {};
  if (saved) {
    try { db = JSON.parse(saved); } catch(e) {}
  }
  if (!db['BIO']) db['BIO'] = { name: '🧬 Sinh Học', html: DEFAULT_BIO.trim(), color: '#10b981', fixed: true };
  if (!db['AGRI']) db['AGRI'] = { name: '🚜 Công Nghệ', html: DEFAULT_AGRI.trim(), color: '#f59e0b', fixed: true };
  if (!db['MATH']) db['MATH'] = { name: '📐 Toán Học', html: DEFAULT_MATH.trim(), color: '#0284c7', fixed: true };
  if (!db['PHYS']) db['PHYS'] = { name: '⚡ Vật Lý', html: DEFAULT_PHYS.trim(), color: '#8b5cf6', fixed: true };
  if (!db['CHEM']) db['CHEM'] = { name: '🧪 Hóa Học', html: DEFAULT_CHEM.trim(), color: '#ec4899', fixed: true };
  if (!db['LIT']) db['LIT'] = { name: '📖 Ngữ Văn', html: DEFAULT_LIT.trim(), color: '#e11d48', fixed: true };
  if (!db['ENG']) db['ENG'] = { name: '🇬🇧 Tiếng Anh', html: DEFAULT_ENG.trim(), color: '#0891b2', fixed: true };
  if (!db['HIST']) db['HIST'] = { name: '📜 Lịch Sử', html: DEFAULT_HIST.trim(), color: '#b45309', fixed: true };
  if (!db['GEO']) db['GEO'] = { name: '🌍 Địa Lý', html: DEFAULT_GEO.trim(), color: '#059669', fixed: true };
  if (!db['GDKTPL']) db['GDKTPL'] = { name: '⚖️ GDKT & PL', html: DEFAULT_GDKTPL.trim(), color: '#7c3aed', fixed: true };
  if (!db['IT']) db['IT'] = { name: '💻 Tin Học', html: DEFAULT_IT.trim(), color: '#2563eb', fixed: true };
  if (!db['GDQPAN']) db['GDQPAN'] = { name: '🛡️ GDQP & AN', html: DEFAULT_GDQPAN.trim(), color: '#4d7c0f', fixed: true };

  const allCombinedHTML = [
    DEFAULT_BIO, DEFAULT_AGRI, DEFAULT_MATH, DEFAULT_PHYS, DEFAULT_CHEM, DEFAULT_LIT,
    DEFAULT_ENG, DEFAULT_HIST, DEFAULT_GEO, DEFAULT_GDKTPL, DEFAULT_IT, DEFAULT_GDQPAN
  ].map(s => s.trim()).join('<br>');

  db['ALL_SUBJ'] = { name: '🌟 Tổng Hợp 12 Môn THPT', html: allCombinedHTML, color: '#4f46e5', fixed: true };

  return db;
}

export function getPresetQuizBySubject(subjKey: string): QuizItem[] {
  const db = getInitialSubjects();
  if (db[subjKey]) return parseHTMLToQuiz(db[subjKey].html);
  return parseHTMLToQuiz(db['ALL_SUBJ'] ? db['ALL_SUBJ'].html : DEFAULT_BIO);
}

