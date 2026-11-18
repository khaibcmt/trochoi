import { QuizItem, SubjectData, QuestionFormat } from '../types';

export const DEFAULT_BIO = `
<div>Câu 1: Loại quả nào sau đây chứa nhiều vitamin C, giúp tăng sức đề kháng?</div><div>A. Quả táo</div><div>B. Quả chuối</div><div><u>C</u>. Quả cam</div><div>D. Quả dưa hấu</div><br>
<div>Câu 2: Rửa tay bằng xà phòng đúng cách có tác dụng chính nào?</div><div><u>A</u>. Loại bỏ vi khuẩn và giảm nguy cơ lây bệnh qua tay</div><div>B. Làm tay thơm vĩnh viễn, không cần rửa lại</div><div>C. Cung cấp vitamin cho da tay</div><div>D. Làm móng tay dài nhanh hơn</div><br>
<div>Câu 3: Cây xanh đặt trong nhà muốn quang hợp tốt cần có đủ yếu tố nào?</div><div>A. Bóng tối hoàn toàn</div><div>B. Không cần nước tưới</div><div>C. Không cần không khí</div><div><u>D</u>. Ánh sáng, nước và khí carbon dioxide</div><br>
<div>Câu 4: Khi chạy bộ nhanh, nhịp tim của người khỏe mạnh thường thay đổi như thế nào?</div><div>A. Giảm xuống rất thấp</div><div><u>B</u>. Tăng lên để bơm máu nhiều hơn cho cơ bắp</div><div>C. Ngừng đập trong lúc chạy</div><div>D. Không thay đổi chút nào</div><br>
<div>Câu 5: Thức ăn đã nấu chín để lâu ở nhiệt độ phòng qua đêm có nguy cơ gì?</div><div>A. Luôn an toàn tuyệt đối</div><div>B. Càng để lâu càng bổ dưỡng hơn</div><div><u>C</u>. Dễ bị vi khuẩn phát triển, nên bảo quản trong tủ lạnh</div><div>D. Tự động diệt hết vi khuẩn</div><br>
<div>Câu 6: Phân loại rác thải sinh hoạt tại nhà có ích lợi gì?</div><div><u>A</u>. Giúp tái chế và giảm ô nhiễm môi trường</div><div>B. Làm lượng rác tăng lên gấp đôi</div><div>C. Không có tác dụng gì</div><div>D. Chỉ làm cho thùng rác đẹp hơn</div><br>
<div>Câu 7 [Đúng/Sai]: Xét các phát biểu sau về dinh dưỡng và vệ sinh thực phẩm:</div><div><u>a)</u> Ăn nhiều rau xanh cung cấp chất xơ tốt cho tiêu hóa. (Đúng)</div><div><u>b)</u> Rửa rau quả dưới vòi nước sạch giúp loại bỏ bụi bẩn và một phần vi khuẩn. (Đúng)</div><div>c) Uống nước ngọt có ga thay hoàn toàn nước lọc hằng ngày là tốt nhất cho sức khỏe. (Sai)</div><div>d) Thức ăn đã có mùi ôi thiu chỉ cần đun sôi lại là ăn an toàn tuyệt đối. (Sai)</div><br>
<div>Câu 8 [Đúng/Sai]: Xét các phát biểu sau về cây xanh và cơ thể người:</div><div>a) Cây xanh quang hợp chủ yếu vào ban đêm, ban ngày không quang hợp. (Sai)</div><div><u>b)</u> Tập thể dục đều đặn giúp tim mạch khỏe hơn. (Đúng)</div><div><u>c)</u> Cơ thể cần ngủ đủ giấc để phục hồi và ghi nhớ tốt hơn. (Đúng)</div><div>d) Mọi vi khuẩn đều có hại hoàn toàn, không có vi khuẩn nào có ích cho con người. (Sai)</div><br>
<div>Câu 9 [Trả lời ngắn]: Một bữa ăn gồm ba phần có năng lượng lần lượt là 200 kcal, 150 kcal và 50 kcal. Tổng năng lượng của bữa ăn là bao nhiêu kcal?</div><div><u>Đáp án: 400</u></div><br>
<div>Câu 10 [Trả lời ngắn]: Bạn An đếm nhịp tim trong 15 giây được 18 nhịp. Nhịp tim của bạn An trong 1 phút là bao nhiêu nhịp?</div><div><u>Đáp án: 72</u></div><br>`;

export const DEFAULT_AGRI = `
<div>Câu 1: Trồng rau trên ban công, nên tưới nước vào thời điểm nào là tốt nhất cho cây?</div><div>A. Giữa trưa nắng gắt</div><div><u>B</u>. Sáng sớm hoặc chiều mát</div><div>C. Lúc nửa đêm về sáng</div><div>D. Chỉ tưới khi cây đã héo rũ hẳn</div><br>
<div>Câu 2: Muốn đất trồng trong chậu tơi xốp và giàu dinh dưỡng cho rau, nên trộn thêm chất nào sau đây?</div><div>A. Nước muối pha loãng</div><div>B. Tro bếp còn đang nóng</div><div><u>C</u>. Phân hữu cơ đã hoai mục</div><div>D. Dầu ăn đã qua sử dụng</div><br>
<div>Câu 3: Để chuồng gà tại nhà sạch sẽ và ít mùi hôi, người nuôi nên làm việc nào thường xuyên?</div><div><u>A</u>. Dọn phân và thay chất độn chuồng định kỳ</div><div>B. Đóng kín chuồng cả ngày cho ấm</div><div>C. Phun nước cho nền chuồng luôn ướt sũng</div><div>D. Để máng nước uống cạn khô nhiều ngày</div><br>
<div>Câu 4: Cách bảo quản rau xanh trong tủ lạnh được lâu hơn là cách nào sau đây?</div><div>A. Rửa rau thật ướt rồi cho ngay vào túi kín</div><div>B. Để rau chung với thịt sống không bọc kín</div><div>C. Phơi rau ngoài nắng gắt cho khô hẳn</div><div><u>D</u>. Gói rau bằng khăn giấy khô, cho vào hộp rồi để ngăn mát</div><br>
<div>Câu 5: Cá cảnh trong bể liên tục nổi lên mặt nước đớp không khí, nguyên nhân thường gặp nhất là gì?</div><div>A. Bể cá đặt ở nơi có ánh sáng</div><div>B. Cá đang ngủ nên bơi chậm lại</div><div><u>C</u>. Nước trong bể thiếu oxy</div><div>D. Cá vừa được cho ăn nên no bụng</div><br>
<div>Câu 6: Để hạt giống gieo tại nhà nảy mầm tốt, cần đảm bảo điều kiện nào sau đây?</div><div>A. Gieo hạt thật sâu khoảng 20 cm</div><div><u>B</u>. Giữ đất ẩm vừa, không khô và không úng nước</div><div>C. Để khay gieo dưới nắng gắt suốt cả ngày</div><div>D. Tưới nước muối cho hạt nhanh nứt vỏ</div><br>
<div>Câu 7 [Đúng/Sai]: Xét các phát biểu sau về tưới nước và chăm sóc rau tại nhà:</div><div><u>a)</u> Tưới nước vào sáng sớm giúp cây hấp thu tốt và hạn chế mất nước. (Đúng)</div><div>b) Tưới thật nhiều nước mỗi ngày cho đất luôn ngập nước thì rau càng lớn nhanh. (Sai)</div><div><u>c)</u> Nhổ cỏ dại quanh gốc giúp cây bớt bị tranh nước và chất dinh dưỡng. (Đúng)</div><div>d) Bón phân càng sát gốc và càng nhiều trong một lần thì cây càng khỏe. (Sai)</div><br>
<div>Câu 8 [Đúng/Sai]: Xét các phát biểu sau về nuôi gà và vệ sinh chuồng trại tại nhà:</div><div>a) Có thể cho gà ăn thức ăn đã mốc vì gà mổ được mọi thứ. (Sai)</div><div><u>b)</u> Cần cung cấp nước uống sạch cho gà mỗi ngày. (Đúng)</div><div><u>c)</u> Chuồng gà nên giữ khô ráo và thoáng mát. (Đúng)</div><div>d) Không cần dọn phân gà vì phân để lâu sẽ tự hết mùi. (Sai)</div><br>
<div>Câu 9 [Đúng/Sai]: Xét các phát biểu sau về bảo quản nông sản và an toàn thực phẩm:</div><div><u>a)</u> Thịt, cá tươi mua về nên bảo quản trong tủ lạnh nếu chưa nấu ngay. (Đúng)</div><div><u>b)</u> Rau ăn sống cần rửa sạch dưới vòi nước trước khi ăn. (Đúng)</div><div>c) Thức ăn đã có mùi ôi thiu chỉ cần nấu lại thật sôi là ăn an toàn hoàn toàn. (Sai)</div><div><u>d)</u> Để riêng thịt sống với rau và thức ăn chín giúp tránh lây nhiễm chéo. (Đúng)</div><br>
<div>Câu 10 [Đúng/Sai]: Xét các phát biểu sau về làm đất và bón phân cho cây trồng:</div><div>a) Bón phân hóa học càng nhiều thì đất càng tơi xốp lâu dài. (Sai)</div><div><u>b)</u> Phân hữu cơ phải ủ hoai mục trước khi bón cho cây mới an toàn và hiệu quả. (Đúng)</div><div>c) Đất bị úng nước lâu ngày vẫn rất tốt cho mọi loại rau. (Sai)</div><div>d) Chỉ cần bón phân một lần duy nhất là cây đủ dinh dưỡng suốt cả vụ. (Sai)</div><br>`;

export const DEFAULT_MATH = `
<div>Câu 1: Một chiếc áo giá 200000 đồng được giảm giá 25%. Giá của chiếc áo sau khi giảm là bao nhiêu đồng?</div><div>A. 175000 đồng</div><div><u>B</u>. 150000 đồng</div><div>C. 125000 đồng</div><div>D. 100000 đồng</div><br>
<div>Câu 2: Một học sinh có điểm kiểm tra 4 môn lần lượt là 8, 9, 7, 8. Điểm trung bình cộng của 4 môn là bao nhiêu?</div><div>A. 7,5</div><div>B. 7</div><div><u>C</u>. 8</div><div>D. 9</div><br>
<div>Câu 3: Một căn phòng hình chữ nhật có chiều dài 5 m và chiều rộng 4 m. Diện tích của căn phòng là bao nhiêu mét vuông?</div><div><u>A</u>. 20 m²</div><div>B. 18 m²</div><div>C. 9 m²</div><div>D. 40 m²</div><br>
<div>Câu 4: Một ô tô đi được quãng đường 120 km trong 2 giờ. Vận tốc trung bình của ô tô là bao nhiêu km/h?</div><div>A. 50 km/h</div><div>B. 240 km/h</div><div>C. 40 km/h</div><div><u>D</u>. 60 km/h</div><br>
<div>Câu 5: Đổi 2,5 kg ra gam ta được kết quả nào?</div><div>A. 250 g</div><div><u>B</u>. 2500 g</div><div>C. 25 g</div><div>D. 25000 g</div><br>
<div>Câu 6: Gửi ngân hàng 10000000 đồng với lãi suất đơn giản 5% một năm. Sau 1 năm, số tiền lãi nhận được là bao nhiêu đồng?</div><div>A. 50000 đồng</div><div>B. 5000000 đồng</div><div><u>C</u>. 500000 đồng</div><div>D. 1000000 đồng</div><br>
<div>Câu 7 [Đúng/Sai]: Xét các phát biểu sau về một căn phòng hình chữ nhật có chiều dài 8 m và chiều rộng 5 m:</div><div><u>a)</u> Diện tích của căn phòng là 40 m². (Đúng)</div><div>b) Chu vi của căn phòng là 13 m. (Sai)</div><div><u>c)</u> Tổng độ dài của một chiều dài và một chiều rộng là 13 m. (Đúng)</div><div>d) 40 m² bằng 400 cm². (Sai)</div><br>
<div>Câu 8 [Đúng/Sai]: Xét các phát biểu sau về quãng đường, thời gian và vận tốc:</div><div>a) Đi được 60 km trong 1 giờ thì vận tốc trung bình là 30 km/h. (Sai)</div><div><u>b)</u> Đi được 90 km trong 3 giờ thì vận tốc trung bình là 30 km/h. (Đúng)</div><div><u>c)</u> 2 giờ 30 phút bằng 150 phút. (Đúng)</div><div>d) 1 km bằng 100 m. (Sai)</div><br>
<div>Câu 9 [Trả lời ngắn]: Một quyển vở giá 12000 đồng. Mua 5 quyển vở như thế hết bao nhiêu đồng?</div><div><u>Đáp án: 60000</u></div><br>
<div>Câu 10 [Trả lời ngắn]: Một hình vuông có cạnh 9 cm. Diện tích của hình vuông đó bằng bao nhiêu cm²?</div><div><u>Đáp án: 81</u></div><br>`;

export const DEFAULT_PHYS = `
<div>Câu 1: Một ô tô đi được quãng đường 180 km trong 3 giờ. Tốc độ trung bình của ô tô là bao nhiêu km/h?</div><div>A. 40 km/h</div><div><u>B</u>. 60 km/h</div><div>C. 90 km/h</div><div>D. 540 km/h</div><br>
<div>Câu 2: Một bóng đèn có công suất 100 W được thắp sáng trong 5 giờ. Điện năng mà bóng đèn tiêu thụ là bao nhiêu kWh?</div><div>A. 5 kWh</div><div>B. 50 kWh</div><div><u>C</u>. 0,5 kWh</div><div>D. 500 kWh</div><br>
<div>Câu 3: Một đoạn mạch có hiệu điện thế 12 V và điện trở 4 ôm. Cường độ dòng điện chạy qua đoạn mạch là bao nhiêu ampe?</div><div><u>A</u>. 3 A</div><div>B. 48 A</div><div>C. 8 A</div><div>D. 16 A</div><br>
<div>Câu 4: Việc làm nào sau đây giúp tiết kiệm điện trong gia đình?</div><div>A. Để ti vi ở chế độ chờ suốt đêm</div><div>B. Bật đèn cả ngày dù không có người trong phòng</div><div>C. Mở tủ lạnh liên tục trong thời gian dài</div><div><u>D</u>. Tắt đèn và quạt khi ra khỏi phòng</div><br>
<div>Câu 5: Một máy điều hòa có công suất 1000 W, tức là 1 kW, chạy liên tục trong 2 giờ. Điện năng mà máy điều hòa tiêu thụ là bao nhiêu kWh?</div><div>A. 1 kWh</div><div><u>B</u>. 2 kWh</div><div>C. 1000 kWh</div><div>D. 2000 kWh</div><br>
<div>Câu 6: Ở điều kiện thông thường, nước sôi ở nhiệt độ nào?</div><div>A. 0 °C</div><div>B. 50 °C</div><div><u>C</u>. 100 °C</div><div>D. 37 °C</div><br>
<div>Câu 7 [Đúng/Sai]: Xét các phát biểu sau về tốc độ và chuyển động:</div><div><u>a)</u> Trong cùng một khoảng thời gian, xe nào có tốc độ lớn hơn thì đi được quãng đường dài hơn. (Đúng)</div><div><u>b)</u> Tốc độ được tính bằng quãng đường đi được chia cho thời gian đi hết quãng đường đó. (Đúng)</div><div>c) Đi được 100 km trong 2 giờ thì tốc độ trung bình là 200 km/h. (Sai)</div><div>d) Đơn vị đo khối lượng là ki-lô-mét trên giờ. (Sai)</div><br>
<div>Câu 8 [Đúng/Sai]: Xét các phát biểu sau về sử dụng điện trong gia đình:</div><div>a) Bóng đèn 60 W dùng trong 10 giờ tiêu thụ 6 kWh điện năng. (Sai)</div><div><u>b)</u> Ti vi 100 W dùng trong 10 giờ tiêu thụ 1 kWh điện năng. (Đúng)</div><div>c) Để tiết kiệm điện nên đặt điều hòa ở 16 °C và bật suốt cả ngày. (Sai)</div><div><u>d)</u> Tắt các thiết bị điện khi không sử dụng giúp tiết kiệm điện. (Đúng)</div><br>
<div>Câu 9 [Trả lời ngắn]: Một đoạn mạch có hiệu điện thế 20 V và điện trở 5 ôm. Cường độ dòng điện chạy qua đoạn mạch bằng bao nhiêu ampe?</div><div><u>Đáp án: 4</u></div><br>
<div>Câu 10 [Trả lời ngắn]: Một xe máy đi được quãng đường 150 km trong 3 giờ. Tốc độ trung bình của xe máy bằng bao nhiêu km/h?</div><div><u>Đáp án: 50</u></div><br>`;

export const DEFAULT_CHEM = `
<div>Câu 1: Khi cho giấm ăn vào bột nở (baking soda) để làm bánh, hiện tượng nào thường thấy?</div><div>A. Hỗn hợp đông cứng lại ngay lập tức</div><div><u>B</u>. Hỗn hợp sủi bọt khí</div><div>C. Hỗn hợp chuyển thành màu xanh lá</div><div>D. Không có hiện tượng gì xảy ra</div><br>
<div>Câu 2: Để tách vụn sắt ra khỏi hỗn hợp cát và vụn sắt, cách đơn giản nhất là dùng gì?</div><div>A. Lọc bằng giấy lọc</div><div>B. Đun nóng cho bay hơi</div><div>C. Chưng cất hỗn hợp</div><div><u>D</u>. Dùng nam châm hút vụn sắt</div><br>
<div>Câu 3: Đinh sắt để ngoài trời ẩm lâu ngày bị gỉ chủ yếu vì tiếp xúc với yếu tố nào?</div><div><u>A</u>. Oxy trong không khí và nước</div><div>B. Chỉ ánh nắng mặt trời</div><div>C. Chỉ cát và bụi</div><div>D. Khí nitơ khô</div><br>
<div>Câu 4: Pha 20 gam muối ăn vào 80 gam nước, dung dịch thu được có nồng độ phần trăm là bao nhiêu?</div><div>A. 10%</div><div>B. 15%</div><div><u>C</u>. 20%</div><div>D. 25%</div><br>
<div>Câu 5: Khi sử dụng thuốc tẩy trong nhà, việc làm nào là an toàn?</div><div>A. Trộn thuốc tẩy với giấm để tẩy mạnh hơn</div><div><u>B</u>. Đeo găng tay và mở cửa cho thoáng khí</div><div>C. Ngửi trực tiếp để kiểm tra mùi</div><div>D. Đổ thuốc tẩy vào chai nước uống để cất giữ</div><br>
<div>Câu 6: Đậy kín một nồi dầu đang bốc cháy nhỏ sẽ làm ngọn lửa tắt dần vì thiếu yếu tố nào?</div><div>A. Ánh sáng</div><div>B. Nhiệt độ phòng</div><div>C. Khí carbon dioxide</div><div><u>D</u>. Khí oxy</div><br>
<div>Câu 7 [Đúng/Sai]: Xét các phát biểu sau về tách hỗn hợp và nước trong đời sống:</div><div><u>a)</u> Lọc bằng vải có thể tách cát ra khỏi nước đục. (Đúng)</div><div>b) Chỉ đun sôi nước biển rồi để nguội, không ngưng tụ hơi nước, thì nước sẽ hết mặn hoàn toàn. (Sai)</div><div><u>c)</u> Dầu ăn nổi trên mặt nước nên có thể gạn để tách dầu ra khỏi nước. (Đúng)</div><div>d) Đường đã hòa tan vào nước thì không thể thu lại bằng cách cho nước bay hơi. (Sai)</div><br>
<div>Câu 8 [Đúng/Sai]: Xét các phát biểu sau về hóa chất và an toàn trong gia đình:</div><div>a) Có thể nếm thử hóa chất trong nhà để biết đó là chất gì. (Sai)</div><div><u>b)</u> Bột nở (baking soda) có thể dùng để khử mùi hôi trong tủ lạnh. (Đúng)</div><div>c) Tất cả các chất khí đều không màu và không mùi. (Sai)</div><div><u>d)</u> Đốt than trong phòng kín rất nguy hiểm vì có thể sinh ra khí độc carbon monoxide. (Đúng)</div><br>
<div>Câu 9 [Trả lời ngắn]: Một chai dung dịch giấm có nồng độ 5%. Trong 200 gam dung dịch giấm đó có bao nhiêu gam axit axetic?</div><div><u>Đáp án: 10</u></div><br>
<div>Câu 10 [Trả lời ngắn]: Nước có công thức là H2O. Một phân tử nước có tổng cộng bao nhiêu nguyên tử?</div><div><u>Đáp án: 3</u></div><br>`;

export const DEFAULT_LIT = `
<div>Câu 1: Tục ngữ Uống nước nhớ nguồn khuyên chúng ta điều gì?</div><div><u>A</u>. Biết ơn những người đã tạo ra thành quả cho mình hưởng</div><div>B. Uống thật nhiều nước mỗi ngày</div><div>C. Nhớ mang theo nước khi đi xa</div><div>D. Chọn nguồn nước sạch để uống</div><br>
<div>Câu 2: Thành ngữ Ăn quả nhớ kẻ trồng cây có nghĩa gần nhất với ý nào sau đây?</div><div>A. Ăn quả phải nhớ mình đã mua ở chợ nào</div><div>B. Trồng cây thì chắc chắn sẽ có quả ăn</div><div>C. Quả ngon chủ yếu là nhờ thời tiết tốt</div><div><u>D</u>. Hưởng thành quả thì phải nhớ ơn người tạo ra thành quả đó</div><br>
<div>Câu 3: Từ nào sau đây viết đúng chính tả?</div><div>A. sảy ra</div><div><u>B</u>. xảy ra</div><div>C. xẩy ra</div><div>D. sẩy ra</div><br>
<div>Câu 4: Dấu câu nào dùng để kết thúc một câu hỏi?</div><div>A. Dấu chấm</div><div>B. Dấu phẩy</div><div><u>C</u>. Dấu chấm hỏi</div><div>D. Dấu chấm than</div><br>
<div>Câu 5: Từ trái nghĩa với từ nhanh là từ nào?</div><div><u>A</u>. chậm</div><div>B. mau</div><div>C. vội</div><div>D. lẹ</div><br>
<div>Câu 6: Câu Học ăn, học nói, học gói, học mở khuyên người ta điều gì?</div><div>A. Chỉ cần học cách ăn uống cho ngon</div><div>B. Học cách gói quà cho thật đẹp</div><div>C. Học nấu ăn là việc quan trọng nhất</div><div><u>D</u>. Cần học cách ứng xử và giao tiếp trong cuộc sống</div><br>
<div>Câu 7: Từ đồng nghĩa với từ chăm chỉ là từ nào?</div><div>A. lười biếng</div><div><u>B</u>. siêng năng</div><div>C. chậm chạp</div><div>D. cẩu thả</div><br>
<div>Câu 8: Trong câu Mẹ mua rau, cá và trứng, dấu phẩy được dùng để làm gì?</div><div>A. Kết thúc câu</div><div>B. Hỏi một điều gì đó</div><div><u>C</u>. Ngăn cách các ý được liệt kê</div><div>D. Thể hiện cảm xúc mạnh</div><br>
<div>Câu 9: Tục ngữ Gần mực thì đen, gần đèn thì sáng khuyên điều gì?</div><div>A. Ngồi gần đèn để học bài cho sáng hơn</div><div>B. Mực đen thường dùng để viết bài</div><div>C. Nên tránh xa những nơi tối tăm</div><div><u>D</u>. Môi trường và bạn bè xung quanh ảnh hưởng nhiều đến mỗi người</div><br>
<div>Câu 10: Từ trái nghĩa với từ cao là từ nào?</div><div>A. lớn</div><div><u>B</u>. thấp</div><div>C. rộng</div><div>D. dài</div><br>`;

export const DEFAULT_ENG = `
<div>Câu 1: Choose the correct greeting in the morning: Good ______!</div><div>A. night</div><div><u>B</u>. morning</div><div>C. bye</div><div>D. thanks</div><br>
<div>Câu 2: She ______ to school every day.</div><div>A. go</div><div>B. going</div><div><u>C</u>. goes</div><div>D. gone</div><br>
<div>Câu 3: I was born ______ 2010.</div><div><u>A</u>. in</div><div>B. on</div><div>C. at</div><div>D. by</div><br>
<div>Câu 4: What is the opposite of big?</div><div>A. large</div><div>B. huge</div><div>C. tall</div><div><u>D</u>. small</div><br>
<div>Câu 5: They ______ football yesterday afternoon.</div><div>A. play</div><div><u>B</u>. played</div><div>C. plays</div><div>D. playing</div><br>
<div>Câu 6: How many ______ are there in the classroom?</div><div><u>A</u>. students</div><div>B. student</div><div>C. studentes</div><div>D. studentss</div><br>
<div>Câu 7: ______ is your name?</div><div>A. Where</div><div>B. When</div><div><u>C</u>. What</div><div>D. How many</div><br>
<div>Câu 8: We have English lessons ______ Monday.</div><div>A. in</div><div>B. at</div><div>C. to</div><div><u>D</u>. on</div><br>
<div>Câu 9: Which word means the same as happy?</div><div><u>A</u>. glad</div><div>B. sad</div><div>C. angry</div><div>D. tired</div><br>
<div>Câu 10: He ______ a doctor. He works in a hospital.</div><div>A. are</div><div><u>B</u>. is</div><div>C. am</div><div>D. be</div><br>`;

export const DEFAULT_HIST = `
<div>Câu 1: Ngày 2 tháng 9 năm 1945, Chủ tịch Hồ Chí Minh đã đọc bản Tuyên ngôn Độc lập, khai sinh nước Việt Nam Dân chủ Cộng hòa tại địa điểm nào?</div><div>A. Dinh Độc Lập (Sài Gòn)</div><div><u>B</u>. Quảng trường Ba Đình (Hà Nội)</div><div>C. Cố đô Huế</div><div>D. Bến Nhà Rồng (Sài Gòn)</div><br>
<div>Câu 2: Chiến thắng Điện Biên Phủ "lừng lẫy năm châu, chấn động địa cầu" diễn ra vào năm nào?</div><div>A. Năm 1945</div><div>B. Năm 1968</div><div>C. Năm 1975</div><div><u>D</u>. Năm 1954</div><br>
<div>Câu 3: Ngày 30 tháng 4 năm 1975 là ngày kỷ niệm sự kiện lịch sử nào của dân tộc ta?</div><div><u>A</u>. Miền Nam hoàn toàn giải phóng, đất nước thống nhất</div><div>B. Ngày Quốc khánh nước Việt Nam</div><div>C. Ngày thành lập Đảng Cộng sản Việt Nam</div><div>D. Ngày chiến thắng Điện Biên Phủ</div><br>
<div>Câu 4: Giỗ Tổ Hùng Vương được tổ chức vào ngày nào theo âm lịch hằng năm?</div><div>A. Ngày 1 tháng 1 âm lịch</div><div>B. Ngày 15 tháng 8 âm lịch</div><div><u>C</u>. Ngày 10 tháng 3 âm lịch</div><div>D. Ngày 30 tháng 4 âm lịch</div><br>
<div>Câu 5: Chủ tịch Hồ Chí Minh (Bác Hồ) sinh vào năm nào?</div><div>A. Năm 1889</div><div><u>B</u>. Năm 1890</div><div>C. Năm 1891</div><div>D. Năm 1900</div><br>
<div>Câu 6: Ngày Quốc khánh của nước Cộng hòa xã hội chủ nghĩa Việt Nam là ngày nào?</div><div>A. Ngày 1 tháng 5</div><div>B. Ngày 30 tháng 4</div><div>C. Ngày 27 tháng 7</div><div><u>D</u>. Ngày 2 tháng 9</div><br>
<div>Câu 7 [Đúng/Sai]: Xét các phát biểu sau về Cách mạng tháng Tám và ngày Quốc khánh năm 1945:</div><div><u>a)</u> Ngày 2/9/1945, Bác Hồ đọc bản Tuyên ngôn Độc lập tại Quảng trường Ba Đình, Hà Nội. (Đúng)</div><div>b) Bản Tuyên ngôn Độc lập năm 1945 được đọc tại Dinh Độc Lập ở Sài Gòn. (Sai)</div><div><u>c)</u> Cách mạng tháng Tám năm 1945 thành công đã mở ra kỷ nguyên độc lập, tự do cho dân tộc Việt Nam. (Đúng)</div><div>d) Nước Việt Nam Dân chủ Cộng hòa được thành lập vào năm 1975. (Sai)</div><br>
<div>Câu 8 [Đúng/Sai]: Xét các phát biểu sau về chiến thắng Điện Biên Phủ và ngày giải phóng miền Nam:</div><div>a) Chiến thắng Điện Biên Phủ diễn ra vào năm 1975. (Sai)</div><div><u>b)</u> Ngày 30/4/1975, miền Nam hoàn toàn giải phóng, đất nước thống nhất. (Đúng)</div><div><u>c)</u> Đại tướng Võ Nguyên Giáp là Tổng tư lệnh trong chiến dịch Điện Biên Phủ năm 1954. (Đúng)</div><div>d) Xe tăng của Quân giải phóng tiến vào Dinh Độc Lập vào ngày 2/9/1945. (Sai)</div><br>
<div>Câu 9 [Đúng/Sai]: Xét các phát biểu sau về Chủ tịch Hồ Chí Minh và các Vua Hùng:</div><div><u>a)</u> Chủ tịch Hồ Chí Minh sinh năm 1890 tại quê nhà ở tỉnh Nghệ An. (Đúng)</div><div><u>b)</u> Đền Hùng nằm ở tỉnh Phú Thọ, là nơi thờ cúng các Vua Hùng. (Đúng)</div><div>c) Giỗ Tổ Hùng Vương được tổ chức vào ngày 2 tháng 9 dương lịch hằng năm. (Sai)</div><div><u>d)</u> "Các Vua Hùng đã có công dựng nước, Bác cháu ta phải cùng nhau giữ lấy nước" là lời căn dặn của Chủ tịch Hồ Chí Minh. (Đúng)</div><br>
<div>Câu 10 [Đúng/Sai]: Xét các phát biểu sau về các ngày lễ lớn của Việt Nam:</div><div>a) Ngày Quốc khánh của Việt Nam là ngày 30 tháng 4 hằng năm. (Sai)</div><div><u>b)</u> Ngày 27 tháng 7 là Ngày Thương binh - Liệt sĩ, dịp để tri ân những người có công với đất nước. (Đúng)</div><div>c) Tết Nguyên đán là ngày lễ truyền thống được tính theo dương lịch. (Sai)</div><div><u>d)</u> Ngày 1 tháng 5 là Ngày Quốc tế Lao động. (Đúng)</div><br>`;

export const DEFAULT_GEO = `
<div>Câu 1: Con sông nào sau đây là con sông lớn nhất chảy vào đồng bằng sông Cửu Long ở Việt Nam?</div><div>A. Sông Hồng</div><div>B. Sông Đà</div><div>C. Sông Mã</div><div><u>D</u>. Sông Mê Công</div><br>
<div>Câu 2: Vào buổi sáng, Mặt Trời mọc ở hướng nào?</div><div>A. Hướng tây</div><div><u>B</u>. Hướng đông</div><div>C. Hướng nam</div><div>D. Hướng bắc</div><br>
<div>Câu 3: Tháng 1 ở miền Bắc Việt Nam thường có thời tiết như thế nào?</div><div>A. Nắng nóng gay gắt như mùa hè</div><div>B. Mưa bão liên tục cả tháng</div><div><u>C</u>. Trời lạnh, có thể có rét đậm</div><div>D. Nóng ẩm, không bao giờ lạnh</div><br>
<div>Câu 4: Thủ đô của Việt Nam là thành phố nào?</div><div><u>A</u>. Hà Nội</div><div>B. Thành phố Hồ Chí Minh</div><div>C. Đà Nẵng</div><div>D. Cần Thơ</div><br>
<div>Câu 5: Trên bản đồ thông thường, hướng bắc thường nằm ở phía nào của bản đồ?</div><div>A. Phía dưới bản đồ</div><div>B. Phía bên trái bản đồ</div><div>C. Phía bên phải bản đồ</div><div><u>D</u>. Phía trên bản đồ</div><br>
<div>Câu 6: Trên bản đồ có tỉ lệ 1 : 100 000, khoảng cách 1 cm trên bản đồ ứng với bao nhiêu mét ngoài thực tế?</div><div>A. 100 mét</div><div><u>B</u>. 1000 mét</div><div>C. 10 mét</div><div>D. 10000 mét</div><br>
<div>Câu 7 [Đúng/Sai]: Xét các phát biểu sau về phương hướng và mùa ở Việt Nam:</div><div><u>a)</u> Dùng la bàn có thể xác định được hướng bắc. (Đúng)</div><div>b) Mặt Trời lặn ở hướng đông. (Sai)</div><div><u>c)</u> Miền Nam Việt Nam có hai mùa rõ rệt là mùa mưa và mùa khô. (Đúng)</div><div>d) Đường xích đạo nằm ở cực Bắc của Trái Đất. (Sai)</div><br>
<div>Câu 8 [Đúng/Sai]: Xét các phát biểu sau về địa lí Việt Nam và bản đồ:</div><div>a) Thành phố Hồ Chí Minh là thủ đô của Việt Nam. (Sai)</div><div>b) Sông Hồng chủ yếu chảy qua miền Nam Việt Nam. (Sai)</div><div><u>c)</u> Đà Nẵng là thành phố ven biển ở miền Trung Việt Nam. (Đúng)</div><div><u>d)</u> Bản đồ có tỉ lệ càng lớn thì khu vực được thể hiện càng chi tiết. (Đúng)</div><br>
<div>Câu 9 [Trả lời ngắn]: Trên bản đồ có tỉ lệ 1 : 50 000, một đoạn đường dài 2 cm trên bản đồ. Ngoài thực tế, đoạn đường đó dài bao nhiêu mét?</div><div><u>Đáp án: 1000</u></div><br>
<div>Câu 10 [Trả lời ngắn]: Một thành phố có giờ sớm hơn Hà Nội 2 giờ. Khi Hà Nội là 9 giờ thì thành phố đó là bao nhiêu giờ?</div><div><u>Đáp án: 11</u></div><br>`;

export const DEFAULT_GDKTPL = `
<div>Câu 1: Khi điều khiển hoặc ngồi trên xe mô tô, xe gắn máy tham gia giao thông, người tham gia giao thông bắt buộc phải làm gì?</div><div>A. Mang theo nhiều tiền mặt</div><div>B. Mặc áo phản quang</div><div><u>C</u>. Đội mũ bảo hiểm và cài quai đúng quy cách</div><div>D. Mang dép lê cho thoải mái</div><br>
<div>Câu 2: Theo quy định của pháp luật, người điều khiển phương tiện tham gia giao thông đường bộ đã uống rượu, bia thì phải xử sự như thế nào?</div><div><u>A</u>. Tuyệt đối không được điều khiển phương tiện tham gia giao thông</div><div>B. Vẫn được lái xe nếu chỉ uống một ít</div><div>C. Vẫn được lái xe nếu quãng đường đi ngắn</div><div>D. Vẫn được lái xe nếu cảm thấy mình còn tỉnh táo</div><br>
<div>Câu 3: Theo Luật Hôn nhân và gia đình, điều kiện về độ tuổi để được đăng ký kết hôn là gì?</div><div>A. Nam đủ 18 tuổi trở lên, nữ đủ 16 tuổi trở lên</div><div>B. Nam đủ 18 tuổi trở lên, nữ đủ 18 tuổi trở lên</div><div>C. Nam đủ 20 tuổi trở lên, nữ đủ 20 tuổi trở lên</div><div><u>D</u>. Nam đủ 20 tuổi trở lên, nữ đủ 18 tuổi trở lên</div><br>
<div>Câu 4: Theo Hiến pháp nước ta, công dân đủ bao nhiêu tuổi trở lên thì có quyền bầu cử?</div><div>A. Đủ 16 tuổi</div><div><u>B</u>. Đủ 18 tuổi</div><div>C. Đủ 20 tuổi</div><div>D. Đủ 21 tuổi</div><br>
<div>Câu 5: Khi mua hàng hóa và phát hiện hàng bị lỗi, hàng giả hoặc kém chất lượng, người tiêu dùng nên làm gì?</div><div>A. Im lặng bỏ qua vì đã mua rồi</div><div>B. Tự ý đến đập phá cửa hàng của người bán</div><div><u>C</u>. Khiếu nại với người bán để yêu cầu đổi trả, sửa chữa hoặc bồi thường theo quy định</div><div>D. Không có quyền làm gì cả</div><br>
<div>Câu 6: Theo Luật Giao thông đường bộ, người đủ bao nhiêu tuổi trở lên mới được điều khiển xe gắn máy có dung tích xi-lanh dưới 50 cm³?</div><div><u>A</u>. Đủ 16 tuổi</div><div>B. Đủ 14 tuổi</div><div>C. Đủ 18 tuổi</div><div>D. Đủ 12 tuổi</div><br>
<div>Câu 7 [Đúng/Sai]: Xét các phát biểu sau về an toàn giao thông đường bộ:</div><div><u>a)</u> Khi đi xe mô tô, xe gắn máy, cả người điều khiển và người ngồi sau đều phải đội mũ bảo hiểm. (Đúng)</div><div>b) Người đi bộ có thể sang đường ở bất cứ đâu, không cần đi đúng vạch kẻ đường dành cho người đi bộ. (Sai)</div><div><u>c)</u> Khi đèn tín hiệu giao thông chuyển sang màu đỏ, người tham gia giao thông phải dừng lại trước vạch dừng. (Đúng)</div><div>d) Trẻ em ngồi trên xe mô tô, xe gắn máy thì không cần đội mũ bảo hiểm. (Sai)</div><br>
<div>Câu 8 [Đúng/Sai]: Xét các phát biểu sau về quyền của công dân:</div><div>a) Công dân đủ 16 tuổi trở lên đã có quyền bầu cử đại biểu Quốc hội. (Sai)</div><div><u>b)</u> Mọi công dân đều bình đẳng trước pháp luật, không phân biệt giới tính, dân tộc, tôn giáo. (Đúng)</div><div>c) Căn cước công dân chỉ được cấp cho người từ đủ 18 tuổi trở lên. (Sai)</div><div><u>d)</u> Công dân có quyền khiếu nại khi quyền và lợi ích hợp pháp của mình bị xâm phạm. (Đúng)</div><br>
<div>Câu 9 [Đúng/Sai]: Xét các phát biểu sau về hôn nhân, gia đình và học đường:</div><div><u>a)</u> Nam đủ 20 tuổi trở lên, nữ đủ 18 tuổi trở lên mới đủ điều kiện về tuổi để đăng ký kết hôn. (Đúng)</div><div><u>b)</u> Bạo lực học đường là hành vi bị nghiêm cấm trong trường học. (Đúng)</div><div>c) Cha mẹ có quyền ép buộc con chưa đủ tuổi kết hôn phải lấy vợ, lấy chồng theo ý cha mẹ. (Sai)</div><div><u>d)</u> Vợ và chồng có quyền, nghĩa vụ ngang nhau trong quan hệ gia đình. (Đúng)</div><br>
<div>Câu 10 [Đúng/Sai]: Xét các phát biểu sau về quyền của người tiêu dùng và ý thức tuân thủ pháp luật:</div><div><u>a)</u> Khi mua hàng hóa, người tiêu dùng có quyền được cung cấp thông tin đầy đủ, trung thực về hàng hóa. (Đúng)</div><div>b) Hàng hóa đã mua rồi thì trong mọi trường hợp người bán không phải chịu trách nhiệm nếu hàng bị lỗi. (Sai)</div><div>c) Khi ký hợp đồng, không cần đọc kỹ nội dung vì điều khoản trong hợp đồng nào cũng giống nhau. (Sai)</div><div><u>d)</u> Khi phát hiện hành vi vi phạm pháp luật, công dân có quyền tố cáo đến cơ quan nhà nước có thẩm quyền. (Đúng)</div><br>`;

export const DEFAULT_IT = `
<div>Câu 1: Mật khẩu nào sau đây được coi là mật khẩu mạnh và an toàn?</div><div><u>A</u>. Mật khẩu đủ dài, kết hợp chữ hoa, chữ thường, chữ số và ký tự đặc biệt</div><div>B. Mật khẩu là dãy số 123456</div><div>C. Mật khẩu là ngày sinh của bản thân</div><div>D. Mật khẩu là tên của bản thân viết thường</div><br>
<div>Câu 2: Em nhận được tin nhắn lạ thông báo "trúng thưởng lớn" và yêu cầu cung cấp mã OTP để nhận thưởng. Em nên làm gì?</div><div>A. Gửi ngay mã OTP theo yêu cầu để nhận thưởng</div><div>B. Chuyển trước một khoản tiền làm phí nhận thưởng</div><div><u>C</u>. Không cung cấp mã OTP cho bất kỳ ai và kiểm tra lại qua kênh chính thức</div><div>D. Nhờ bạn bè gửi mã OTP của bạn ấy thay mình</div><br>
<div>Câu 3: Theo quy ước trong sách giáo khoa Tin học, 1 GB bằng bao nhiêu MB?</div><div>A. 1000 MB</div><div><u>B</u>. 1024 MB</div><div>C. 512 MB</div><div>D. 2048 MB</div><br>
<div>Câu 4: Việc sao lưu dữ liệu (backup) thường xuyên mang lại lợi ích chính nào sau đây?</div><div>A. Giúp máy tính chạy nhanh hơn hẳn</div><div>B. Làm tăng dung lượng của ổ cứng</div><div>C. Tự động xóa hết virus trong máy</div><div><u>D</u>. Giúp khôi phục lại dữ liệu khi máy bị hỏng hoặc bị mất dữ liệu</div><br>
<div>Câu 5: Khi sử dụng Wi-Fi công cộng miễn phí ở quán cà phê, em nên tránh làm việc nào sau đây?</div><div><u>A</u>. Đăng nhập tài khoản ngân hàng và thực hiện giao dịch quan trọng</div><div>B. Đọc tin tức trên báo điện tử</div><div>C. Nghe nhạc trực tuyến</div><div>D. Xem bản đồ tìm đường đi</div><br>
<div>Câu 6: Thư rác (spam) trong hộp thư điện tử là loại thư nào?</div><div>A. Thư do bạn bè gửi cho mình</div><div>B. Thư của giáo viên gửi kèm bài tập</div><div><u>C</u>. Thư quảng cáo hoặc lừa đảo được gửi hàng loạt mà người nhận không mong muốn</div><div>D. Thư thông báo của nhà trường</div><br>
<div>Câu 7 [Đúng/Sai]: Xét các phát biểu sau về an toàn khi sử dụng mạng xã hội:</div><div><u>a)</u> Không nên công khai số điện thoại và địa chỉ nhà riêng của mình lên mạng xã hội. (Đúng)</div><div>b) Nên chấp nhận mọi lời mời kết bạn từ người lạ để có càng nhiều bạn càng tốt. (Sai)</div><div><u>c)</u> Trước khi chia sẻ một thông tin trên mạng, cần kiểm tra xem thông tin đó có đáng tin cậy hay không. (Đúng)</div><div>d) Có thể chia sẻ mật khẩu tài khoản của mình cho bạn thân để nhờ đăng nhập hộ. (Sai)</div><br>
<div>Câu 8 [Đúng/Sai]: Xét các phát biểu sau về mã OTP và lừa đảo trực tuyến:</div><div>a) Nhân viên ngân hàng sẽ yêu cầu khách hàng cung cấp mã OTP qua điện thoại để hỗ trợ giao dịch. (Sai)</div><div><u>b)</u> Mã OTP chỉ nên nhập trên trang web hoặc ứng dụng chính thức khi chính mình đang thực hiện giao dịch. (Đúng)</div><div><u>c)</u> Khi nhận cuộc gọi tự xưng là công an yêu cầu chuyển tiền để phục vụ điều tra, cần bình tĩnh kiểm chứng và không chuyển tiền theo yêu cầu qua điện thoại. (Đúng)</div><div>d) Nhấn vào mọi đường link lạ trong tin nhắn sẽ giúp điện thoại chạy nhanh và an toàn hơn. (Sai)</div><br>
<div>Câu 9 [Đúng/Sai]: Xét các phát biểu sau về bảo vệ dữ liệu và thiết bị:</div><div><u>a)</u> Nên sao lưu dữ liệu quan trọng ra ổ cứng ngoài hoặc dịch vụ lưu trữ đám mây. (Đúng)</div><div><u>b)</u> Theo quy ước trong sách giáo khoa Tin học, 1 GB bằng 1024 MB. (Đúng)</div><div>c) Chỉ cần dùng một mật khẩu duy nhất cho mọi tài khoản là cách an toàn tuyệt đối. (Sai)</div><div><u>d)</u> Cập nhật phần mềm và hệ điều hành giúp vá các lỗ hổng bảo mật trên thiết bị. (Đúng)</div><br>
<div>Câu 10 [Đúng/Sai]: Xét các phát biểu sau về sử dụng thư điện tử và mạng Internet an toàn:</div><div>a) Mọi thư trong hộp thư đến đều an toàn nên có thể mở mọi tệp đính kèm mà không cần kiểm tra. (Sai)</div><div><u>b)</u> Nên đăng xuất khỏi tài khoản sau khi sử dụng máy tính chung ở trường hoặc nơi công cộng. (Đúng)</div><div>c) Wi-Fi công cộng không có mật khẩu luôn an toàn tuyệt đối cho mọi giao dịch ngân hàng. (Sai)</div><div><u>d)</u> Bật xác thực hai lớp giúp tài khoản an toàn hơn trước nguy cơ bị đánh cắp mật khẩu. (Đúng)</div><br>`;

export const DEFAULT_GDQPAN = `
<div>Câu 1: Khi cần báo công an trong trường hợp khẩn cấp, cần gọi số điện thoại nào?</div><div>A. 114</div><div><u>B</u>. 113</div><div>C. 115</div><div>D. 1080</div><br>
<div>Câu 2: Khi phát hiện cháy và cần gọi lực lượng cứu hỏa, cần gọi số điện thoại nào?</div><div>A. 113</div><div>B. 115</div><div>C. 1080</div><div><u>D</u>. 114</div><br>
<div>Câu 3: Khi có người bị tai nạn cần cấp cứu y tế khẩn cấp, cần gọi số điện thoại nào?</div><div><u>A</u>. 115</div><div>B. 114</div><div>C. 113</div><div>D. 1080</div><br>
<div>Câu 4: Quân đội nhân dân Việt Nam được thành lập vào ngày tháng năm nào?</div><div>A. Ngày 2 tháng 9 năm 1945</div><div>B. Ngày 30 tháng 4 năm 1975</div><div><u>C</u>. Ngày 22 tháng 12 năm 1944</div><div>D. Ngày 19 tháng 8 năm 1945</div><br>
<div>Câu 5: Để thoát khỏi nơi có nhiều khói do cháy, nên di chuyển như thế nào?</div><div>A. Chạy trong tư thế đứng thẳng cho nhanh</div><div><u>B</u>. Cúi thấp người và men theo lối thoát hiểm</div><div>C. Nấp trong phòng kín và chờ đợi</div><div>D. Dùng thang máy để xuống cho nhanh</div><br>
<div>Câu 6: Có người lạ gọi điện tự xưng là nhân viên ngân hàng và yêu cầu cung cấp mã OTP, bạn nên làm gì?</div><div><u>A</u>. Không cung cấp mã OTP và báo cho người thân hoặc cơ quan chức năng</div><div>B. Cung cấp ngay vì họ nói là nhân viên ngân hàng</div><div>C. Gửi mã cho bạn bè xem trước rồi mới cung cấp</div><div>D. Đọc mã thật chậm để họ ghi lại cho đúng</div><br>
<div>Câu 7: Để bảo vệ tài khoản cá nhân trên mạng, mật khẩu nên được đặt và giữ như thế nào?</div><div>A. Dùng ngày sinh làm mật khẩu và chia sẻ cho bạn thân</div><div>B. Dùng một mật khẩu cho mọi tài khoản và ghi công khai</div><div>C. Đặt mật khẩu dễ nhớ là dãy số 123456</div><div><u>D</u>. Đặt mật khẩu riêng, đủ mạnh và không chia sẻ cho người khác</div><br>
<div>Câu 8: Quốc khánh của nước Cộng hòa xã hội chủ nghĩa Việt Nam là ngày nào?</div><div>A. Ngày 1 tháng 1</div><div>B. Ngày 30 tháng 4</div><div><u>C</u>. Ngày 2 tháng 9</div><div>D. Ngày 22 tháng 12</div><br>
<div>Câu 9: Khi đi xe máy tham gia giao thông, việc làm nào đúng quy định và an toàn?</div><div>A. Chở ba người cho tiện chuyến đi</div><div><u>B</u>. Đội mũ bảo hiểm và cài quai đúng quy cách</div><div>C. Vừa lái xe vừa sử dụng điện thoại</div><div>D. Vượt đèn đỏ khi thấy đường vắng</div><br>
<div>Câu 10: Bài hát Tiến quân ca, Quốc ca của Việt Nam, do nhạc sĩ nào sáng tác?</div><div><u>A</u>. Văn Cao</div><div>B. Trịnh Công Sơn</div><div>C. Phạm Tuyên</div><div>D. Hoàng Việt</div><br>`;

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

// ============================================================================
// Chuyển đổi phương trình Word (OMML) sang LaTeX — ĐỆ QUY trên cây OMML.
// Hỗ trợ: m:f (phân số, lồng nhau), m:rad (căn thường + căn bậc n qua m:deg),
// m:sSup / m:sSub / m:sSubSup / m:sPre, m:nary (∑/∏/∫… kèm cận dưới/trên),
// m:d (ngoặc phân cách \left…\right theo ký tự ngoặc thật; ma trận trong ngoặc
// -> pmatrix/bmatrix…), m:acc (dấu trên đầu: \vec, \hat, \tilde, \overline,
// \dot, \ddot), m:eqArr (hệ phương trình -> \begin{cases}), m:matrix
// (-> \begin{matrix}), m:limLow / m:limUpp (giới hạn), m:bar (\overline /
// \underline), m:groupChr (\overbrace / \underbrace / \overrightarrow…),
// m:func (sin/cos/log/lim…). Các thẻ *Pr (thuộc tính) bị bỏ qua; thẻ lạ thì
// đệ quy vào con để không bao giờ làm mất chữ.
// Đầu ra là LaTeX trần ($...$ cho m:oMath inline, $$...$$ cho m:oMathPara)
// để dùng chung cho extractNormalizedLines và đường dán trong TeacherSetupView.
// ============================================================================

interface OmmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: Array<OmmlNode | string>;
}

const OMML_PROP_TAGS = new Set([
  'm:fpr', 'm:radpr', 'm:ssuppr', 'm:ssubpr', 'm:ssubsuppr', 'm:sprepr',
  'm:narypr', 'm:dpr', 'm:accpr', 'm:eqarrpr', 'm:mpr', 'm:limlowpr',
  'm:limupppr', 'm:barpr', 'm:groupchrpr', 'm:funcpr', 'm:boxpr',
  'm:borderboxpr', 'm:ctrlpr', 'm:rpr', 'w:rpr', 'm:phantpr'
]);

function decodeOmmlAttrEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseOmmlAttrs(attrRaw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([A-Za-z0-9_:.\-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrRaw)) !== null) {
    attrs[m[1].toLowerCase()] = decodeOmmlAttrEntities(m[2] !== undefined ? m[2] : m[3] || '');
  }
  return attrs;
}

// Parser XML/HTML nhẹ, không cần DOM (chạy được cả trong Node khi kiểm chứng):
// dựng cây từ một đoạn OMML; text giữa các thẻ được giữ nguyên (kể cả entity
// HTML như &lt; để các pipeline HTML phía sau tự giải mã đúng ngữ cảnh).
function parseOmmlFragment(fragment: string): Array<OmmlNode | string> {
  const root: OmmlNode = { tag: '#root', attrs: {}, children: [] };
  const stack: OmmlNode[] = [root];
  const tagRe = /<(\/?)([A-Za-z][A-Za-z0-9_:.\-]*)((?:\s[^<>]*?)?)(\/?)>/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  const pushText = (txt: string) => {
    if (txt) stack[stack.length - 1].children.push(txt);
  };
  while ((m = tagRe.exec(fragment)) !== null) {
    pushText(fragment.slice(lastIdx, m.index));
    lastIdx = tagRe.lastIndex;
    const isClose = m[1] === '/';
    const tag = m[2].toLowerCase();
    const selfClose = m[4] === '/';
    if (isClose) {
      // Đóng thẻ: lui stack tới thẻ khớp (bỏ qua thẻ lạc không khớp)
      for (let i = stack.length - 1; i >= 1; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const node: OmmlNode = { tag, attrs: parseOmmlAttrs(m[3] || ''), children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClose) stack.push(node);
  }
  pushText(fragment.slice(lastIdx));
  return root.children;
}

const OMML_SYMBOL_MAP: Record<string, string> = {
  'α': '\\alpha ', 'β': '\\beta ', 'γ': '\\gamma ', 'δ': '\\delta ',
  'ε': '\\epsilon ', 'ζ': '\\zeta ', 'η': '\\eta ', 'θ': '\\theta ',
  'ι': '\\iota ', 'κ': '\\kappa ', 'λ': '\\lambda ', 'μ': '\\mu ',
  'ν': '\\nu ', 'ξ': '\\xi ', 'π': '\\pi ', 'ρ': '\\rho ',
  'σ': '\\sigma ', 'τ': '\\tau ', 'υ': '\\upsilon ', 'φ': '\\phi ',
  'χ': '\\chi ', 'ψ': '\\psi ', 'ω': '\\omega ',
  'Γ': '\\Gamma ', 'Δ': '\\Delta ', 'Θ': '\\Theta ', 'Λ': '\\Lambda ',
  'Ξ': '\\Xi ', 'Π': '\\Pi ', 'Σ': '\\Sigma ', 'Φ': '\\Phi ',
  'Ψ': '\\Psi ', 'Ω': '\\Omega ',
  '∞': '\\infty ', '→': '\\to ', '←': '\\leftarrow ', '↔': '\\leftrightarrow ',
  '⇒': '\\Rightarrow ', '⇐': '\\Leftarrow ', '⇔': '\\Leftrightarrow ',
  '≤': '\\le ', '≥': '\\ge ', '≠': '\\ne ', '≈': '\\approx ',
  '≡': '\\equiv ', '±': '\\pm ', '∓': '\\mp ', '×': '\\times ',
  '÷': '\\div ', '·': '\\cdot ', '∘': '\\circ ', '∈': '\\in ',
  '∉': '\\notin ', '⊂': '\\subset ', '⊆': '\\subseteq ', '∪': '\\cup ',
  '∩': '\\cap ', '∅': '\\emptyset ', '∀': '\\forall ', '∃': '\\exists ',
  '∑': '\\sum ', '∏': '\\prod ', '∫': '\\int ', '∮': '\\oint ',
  '∂': '\\partial ', '∇': '\\nabla ', '√': '\\sqrt ', '−': '-',
  '′': "'", '″': "''", '…': '\\ldots ', '⋯': '\\cdots '
};

function ommlTextToLatex(text: string): string {
  let out = '';
  for (const ch of text) {
    out += OMML_SYMBOL_MAP[ch] !== undefined ? OMML_SYMBOL_MAP[ch] : ch;
  }
  return out;
}

function ommlChild(node: OmmlNode, tag: string): OmmlNode | null {
  for (const c of node.children) {
    if (typeof c !== 'string' && c.tag === tag) return c;
  }
  return null;
}

function ommlChildren(node: OmmlNode, tag: string): OmmlNode[] {
  return node.children.filter((c): c is OmmlNode => typeof c !== 'string' && c.tag === tag);
}

// Đọc thuộc tính kiểu <m:xxxPr><m:chr m:val="…"/></m:xxxPr> hoặc m:val trực tiếp
function ommlPropVal(node: OmmlNode, propTag: string, innerTag: string): string | null {
  const prop = ommlChild(node, propTag);
  if (!prop) return null;
  const inner = ommlChild(prop, innerTag);
  if (!inner) return null;
  const v = inner.attrs['m:val'] !== undefined ? inner.attrs['m:val'] : inner.attrs['val'];
  return v !== undefined ? v : null;
}

function ommlConvertChildren(node: OmmlNode): string {
  return node.children.map(c => (typeof c === 'string' ? ommlTextToLatex(c) : ommlConvertNode(c))).join('');
}

function ommlConvertChild(node: OmmlNode, tag: string): string {
  const child = ommlChild(node, tag);
  return child ? ommlConvertChildren(child).trim() : '';
}

function ommlBrace(content: string): string {
  return `{${content}}`;
}

// Ký tự ngoặc của m:d -> dạng LaTeX dùng sau \left / \right ('' = không có ngoặc)
function ommlDelimToLatex(ch: string | null, fallback: string): string {
  const c = ch === null ? fallback : ch;
  switch (c) {
    case '': return '.';
    case '(': return '(';
    case ')': return ')';
    case '[': return '[';
    case ']': return ']';
    case '{': return '\\{';
    case '}': return '\\}';
    case '|': return '|';
    case '‖': return '\\|';
    case '⟨': case '〈': return '\\langle ';
    case '⟩': case '〉': return '\\rangle ';
    case '⌊': return '\\lfloor ';
    case '⌋': return '\\rfloor ';
    case '⌈': return '\\lceil ';
    case '⌉': return '\\rceil ';
    default: return c;
  }
}

function ommlMatrixRows(matrixNode: OmmlNode): string {
  return ommlChildren(matrixNode, 'm:mr')
    .map(row => ommlChildren(row, 'm:e').map(cell => ommlConvertChildren(cell).trim()).join(' & '))
    .join(' \\\\ ');
}

function ommlFindMatrix(node: OmmlNode): OmmlNode | null {
  if (node.tag === 'm:matrix') return node;
  for (const c of node.children) {
    if (typeof c !== 'string') {
      const found = ommlFindMatrix(c);
      if (found) return found;
    }
  }
  return null;
}

function ommlConvertNode(node: OmmlNode): string {
  const tag = node.tag;
  if (OMML_PROP_TAGS.has(tag)) return '';

  switch (tag) {
    case 'm:t':
      return ommlConvertChildren(node);
    case 'm:r':
    case 'm:omath':
    case 'm:omathpara':
      return ommlConvertChildren(node);
    // Các thẻ "hộp chứa" một thành phần: bóc vỏ, đệ quy vào trong
    case 'm:e':
    case 'm:num':
    case 'm:den':
    case 'm:sub':
    case 'm:sup':
    case 'm:deg':
    case 'm:lim':
    case 'm:fname':
      return ommlConvertChildren(node);

    case 'm:f': {
      const num = ommlConvertChild(node, 'm:num');
      const den = ommlConvertChild(node, 'm:den');
      const type = (ommlPropVal(node, 'm:fpr', 'm:type') || '').toLowerCase();
      const cmd = type === 'lin' ? '\\tfrac' : '\\frac';
      return `${cmd}${ommlBrace(num)}${ommlBrace(den)}`;
    }

    case 'm:rad': {
      const deg = ommlConvertChild(node, 'm:deg');
      const expr = ommlConvertChild(node, 'm:e');
      return deg ? `\\sqrt[${deg}]${ommlBrace(expr)}` : `\\sqrt${ommlBrace(expr)}`;
    }

    case 'm:ssup': {
      const base = ommlConvertChild(node, 'm:e');
      const sup = ommlConvertChild(node, 'm:sup');
      return sup ? `${base}^{${sup}}` : base;
    }
    case 'm:ssub': {
      const base = ommlConvertChild(node, 'm:e');
      const sub = ommlConvertChild(node, 'm:sub');
      return sub ? `${base}_{${sub}}` : base;
    }
    case 'm:ssubsup': {
      const base = ommlConvertChild(node, 'm:e');
      const sub = ommlConvertChild(node, 'm:sub');
      const sup = ommlConvertChild(node, 'm:sup');
      return `${base}${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''}`;
    }
    case 'm:spre': {
      const base = ommlConvertChild(node, 'm:e');
      const sub = ommlConvertChild(node, 'm:sub');
      const sup = ommlConvertChild(node, 'm:sup');
      return `${sub || sup ? `{}_{${sub}}^{${sup}}` : ''}${base}`;
    }

    case 'm:nary': {
      const chr = ommlPropVal(node, 'm:narypr', 'm:chr');
      const opMap: Record<string, string> = {
        '∑': '\\sum', '∏': '\\prod', '∫': '\\int', '∮': '\\oint',
        '∐': '\\coprod', '⋃': '\\bigcup', '⋂': '\\bigcap',
        '⋁': '\\bigvee', '⋀': '\\bigwedge', '⨁': '\\bigoplus', '⨂': '\\bigotimes'
      };
      const op = chr === null || chr === '' ? '\\int' : opMap[chr] || ommlTextToLatex(chr).trim();
      const sub = ommlConvertChild(node, 'm:sub');
      const sup = ommlConvertChild(node, 'm:sup');
      const body = ommlConvertChild(node, 'm:e');
      return `${op}${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''}${body ? ` ${body}` : ''}`;
    }

    case 'm:d': {
      const begChr = ommlPropVal(node, 'm:dpr', 'm:begchr');
      const endChr = ommlPropVal(node, 'm:dpr', 'm:endchr');
      const sepChr = ommlPropVal(node, 'm:dpr', 'm:sepchr');
      const eChildren = ommlChildren(node, 'm:e');

      // Hệ phương trình bên trong ngoặc: \begin{cases} đã tự mang ngoặc, không bọc thêm
      if (eChildren.length === 1) {
        const only = ommlConvertChildren(eChildren[0]).trim();
        if (/^\\begin\{cases\}/.test(only)) return only;
      }

      // Ma trận trong ngoặc -> môi trường ma trận có ngoặc tương ứng
      const matrix = eChildren.length === 1 ? ommlFindMatrix(eChildren[0]) : null;
      if (matrix && eChildren[0].children.length === 1) {
        const rows = ommlMatrixRows(matrix);
        const pair = `${begChr === null ? '(' : begChr}|${endChr === null ? ')' : endChr}`;
        const envMap: Record<string, string> = {
          '(|)': 'pmatrix', '[|]': 'bmatrix', '{|}': 'Bmatrix',
          '||': 'vmatrix', '‖|‖': 'Vmatrix'
        };
        const env = envMap[pair];
        if (env) return `\\begin{${env}}${rows}\\end{${env}}`;
        if (pair === '|') return `\\begin{matrix}${rows}\\end{matrix}`;
      }

      const sep = sepChr === null ? '' : ommlDelimToLatex(sepChr, '');
      const inner = eChildren
        .map(e => ommlConvertChildren(e).trim())
        .join(sep && sep !== '.' ? sep : ' ');
      const beg = ommlDelimToLatex(begChr, '(');
      const end = ommlDelimToLatex(endChr, ')');
      return `\\left${beg}${inner}\\right${end}`;
    }

    case 'm:acc': {
      const chr = ommlPropVal(node, 'm:accpr', 'm:chr');
      const base = ommlConvertChild(node, 'm:e');
      const accMap: Record<string, string> = {
        '⃗': '\\vec', '→': '\\vec',
        '^': '\\hat', 'ˆ': '\\hat', '\u0302': '\\hat',
        '~': '\\tilde', '˜': '\\tilde', '\u0303': '\\tilde',
        '¯': '\\overline', 'ˉ': '\\overline', '\u0305': '\\overline', '\u0304': '\\overline',
        '˙': '\\dot', '\u0307': '\\dot',
        '¨': '\\ddot', '\u0308': '\\ddot',
        '´': '\\acute', '`': '\\grave', '˘': '\\breve', 'ˇ': '\\check'
      };
      const cmd = chr === null || chr === '' ? '\\hat' : accMap[chr];
      if (cmd) return `${cmd}${ommlBrace(base)}`;
      return `\\overset{${ommlTextToLatex(chr || '')}}{${base}}`;
    }

    case 'm:eqarr': {
      const rows = ommlChildren(node, 'm:e').map(e => ommlConvertChildren(e).trim());
      return `\\begin{cases}${rows.join(' \\\\ ')}\\end{cases}`;
    }

    case 'm:matrix': {
      return `\\begin{matrix}${ommlMatrixRows(node)}\\end{matrix}`;
    }
    case 'm:mr': {
      return ommlChildren(node, 'm:e').map(cell => ommlConvertChildren(cell).trim()).join(' & ');
    }

    case 'm:limlow': {
      const base = ommlConvertChild(node, 'm:e');
      const lim = ommlConvertChild(node, 'm:lim');
      const namedOps: Record<string, string> = {
        lim: '\\lim', max: '\\max', min: '\\min', sup: '\\sup',
        inf: '\\inf', limsup: '\\limsup', liminf: '\\liminf'
      };
      const op = namedOps[base.toLowerCase()] || base;
      return lim ? `${op}_{${lim}}` : op;
    }
    case 'm:limupp': {
      const base = ommlConvertChild(node, 'm:e');
      const lim = ommlConvertChild(node, 'm:lim');
      const namedOps: Record<string, string> = { lim: '\\lim', max: '\\max', min: '\\min', sup: '\\sup', inf: '\\inf' };
      const op = namedOps[base.toLowerCase()] || base;
      return lim ? `${op}^{${lim}}` : op;
    }

    case 'm:bar': {
      const base = ommlConvertChild(node, 'm:e');
      const pos = (ommlPropVal(node, 'm:barpr', 'm:pos') || 'top').toLowerCase();
      return pos === 'bot' || pos === 'bottom' ? `\\underline${ommlBrace(base)}` : `\\overline${ommlBrace(base)}`;
    }

    case 'm:groupchr': {
      const chr = ommlPropVal(node, 'm:groupchrpr', 'm:chr') || '';
      const pos = (ommlPropVal(node, 'm:groupchrpr', 'm:pos') || 'top').toLowerCase();
      const base = ommlConvertChild(node, 'm:e');
      const isTop = pos !== 'bot' && pos !== 'bottom';
      if (chr === '⏞' || chr === '\u23de') return isTop ? `\\overbrace${ommlBrace(base)}` : `\\underbrace${ommlBrace(base)}`;
      if (chr === '⏟' || chr === '\u23df') return `\\underbrace${ommlBrace(base)}`;
      if (chr === '¯' || chr === '‾' || chr === '\u0305') return `\\overline${ommlBrace(base)}`;
      if (chr === '_' || chr === '‗') return `\\underline${ommlBrace(base)}`;
      if (chr === '→' || chr === '⃗') return isTop ? `\\overrightarrow${ommlBrace(base)}` : `\\underrightarrow${ommlBrace(base)}`;
      if (chr === '←') return isTop ? `\\overleftarrow${ommlBrace(base)}` : `\\underleftarrow${ommlBrace(base)}`;
      if (chr === '^' || chr === 'ˆ') return `\\hat${ommlBrace(base)}`;
      if (!chr) return base;
      const chrLatex = ommlTextToLatex(chr).trim();
      return isTop ? `\\overset{${chrLatex}}{${base}}` : `\\underset{${chrLatex}}{${base}}`;
    }

    case 'm:func': {
      const fname = ommlConvertChild(node, 'm:fname');
      const arg = ommlConvertChild(node, 'm:e');
      const known = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'lg', 'exp', 'lim', 'max', 'min', 'sup', 'inf', 'det', 'gcd', 'arg', 'deg'];
      const cmd = known.includes(fname.toLowerCase()) ? `\\${fname.toLowerCase()}` : fname;
      return arg ? `${cmd} ${arg}` : cmd;
    }

    case 'm:borderbox':
    case 'm:box':
      return ommlConvertChildren(node);

    default:
      // Thẻ lạ (kể cả w:r / w:t lọt vào vùng toán): đệ quy vào con, không mất chữ
      return ommlConvertChildren(node);
  }
}

// Tìm một phần tử theo tên thẻ trong chuỗi (có đếm lồng cùng thẻ) và trả về
// [vị trí bắt đầu, vị trí kết thúc (sau thẻ đóng), đoạn con bên trong]
function findOmmlElementRange(s: string, tagName: string, fromIdx: number): [number, number, string] | null {
  const openRe = new RegExp(`<${tagName}\\b[^>]*?(/?)>`, 'i');
  const rest = s.slice(fromIdx);
  const openMatch = openRe.exec(rest);
  if (!openMatch) return null;
  const start = fromIdx + openMatch.index;
  const openEnd = start + openMatch[0].length;
  if (openMatch[1] === '/') return [start, openEnd, ''];
  const scanRe = new RegExp(`<(/?)${tagName}\\b[^>]*?(/?)>`, 'gi');
  scanRe.lastIndex = openEnd;
  let depth = 1;
  let sm: RegExpExecArray | null;
  while ((sm = scanRe.exec(s)) !== null) {
    if (sm[1] === '/') {
      depth--;
      if (depth === 0) {
        return [start, scanRe.lastIndex, s.slice(openEnd, sm.index)];
      }
    } else if (sm[2] !== '/') {
      depth++;
    }
  }
  return null;
}

function ommlFragmentToLatex(fragment: string): string {
  const nodes = parseOmmlFragment(fragment);
  return nodes
    .map(n => (typeof n === 'string' ? ommlTextToLatex(n) : ommlConvertNode(n)))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

const OMML_STRAY_TAGS = [
  'm:eqArr', 'm:nary', 'm:sSubSup', 'm:sSub', 'm:sSup', 'm:sPre',
  'm:rad', 'm:groupChr', 'm:limLow', 'm:limUpp', 'm:matrix',
  'm:func', 'm:acc', 'm:bar', 'm:d', 'm:f'
];

export function convertWordOMMLToLatex(html: string): string {
  if (!html || !/<m:/i.test(html)) return html;
  let s = html;

  // 1. Khối hiển thị riêng đoạn <m:oMathPara> -> $$...$$
  let guard = 0;
  while (guard++ < 200) {
    const range = findOmmlElementRange(s, 'm:oMathPara', 0);
    if (!range) break;
    const [start, end, inner] = range;
    const latex = ommlFragmentToLatex(inner);
    s = s.slice(0, start) + (latex ? ` $$${latex}$$ ` : '') + s.slice(end);
  }

  // 2. Công thức inline <m:oMath> -> $...$
  guard = 0;
  while (guard++ < 500) {
    const range = findOmmlElementRange(s, 'm:oMath', 0);
    if (!range) break;
    const [start, end, inner] = range;
    const latex = ommlFragmentToLatex(inner);
    s = s.slice(0, start) + (latex ? ` $${latex}$ ` : '') + s.slice(end);
  }

  // 3. Cấu trúc OMML lạc ngoài oMath (bản cũ từng xử lý m:f / m:rad / m:sSub /
  //    m:sSup rời): chuyển nốt thành $...$ để tương thích ngược.
  guard = 0;
  while (guard++ < 500 && /<m:/i.test(s)) {
    let replaced = false;
    for (const strayTag of OMML_STRAY_TAGS) {
      const range = findOmmlElementRange(s, strayTag, 0);
      if (range) {
        const [start, end, inner] = range;
        const openTagEnd = s.indexOf('>', start) + 1;
        const fragment = s.slice(start, openTagEnd) + inner + `</${strayTag}>`;
        const latex = ommlFragmentToLatex(fragment);
        s = s.slice(0, start) + (latex ? ` $${latex}$ ` : '') + s.slice(end);
        replaced = true;
        break;
      }
    }
    if (!replaced) break;
  }

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
    // 0. Loại bỏ trước các thẻ <style>, <script>, <xml> và comment điều kiện của Microsoft Word (trừ ![if !supportLists])
    .replace(/<!--\[if\s+!supportLists\]-->/gi, '')
    .replace(/<!--\[endif\]-->/gi, '')
    .replace(/<!\[if\s+!supportLists\]>/gi, '')
    .replace(/<!\[endif\]>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(style|script|xml|head|title|meta|link)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, shield)
    .replace(/<img\b[^>]*\/?>/gi, shield)
    .replace(/<\/?(?:sub|sup|u|ins|b|strong)\b[^>]*>/gi, shield);

  working = working
    .replace(/&quot;/gi, '"')
    // 0A. Xóa khối Word XML / Normal 0 false false false EN-US... & /* Style Definitions */ table.MsoNormalTable {...}
    .replace(
      /(?:Normal\s+0\s+(?:false\s+){1,4}(?:EN-[A-Z]+|[A-Z]{2}-[A-Z]{2}|X-NONE)\s*)+/gi,
      ' '
    )
    .replace(
      /\/\*\s*Style\s+Definitions\s*\*\/[\s\S]*?(?:table\.MsoNormalTable\s*\{[^}]*\}|\})/gi,
      ' '
    )
    .replace(
      /(?:table\.MsoNormalTable|p\.MsoNormal|li\.MsoNormal|div\.MsoNormal|span\.Mso[A-Za-z0-9]+|@font-face|@page\s+\w+|div\.WordSection\d+)\s*\{[^}]*\}/gi,
      ' '
    )
    .replace(
      /\b(?:DontGrowAutofit|DontVertAlignCellWithSp|DontBreakConstrainedForcedTables|DontVertAlignInTxbx|CachedColBalance|SplitPgBreakAndParaMark|EnableOpenTypeKerning|DontFlipMirrorIndents|OverrideTableStyleHps|UseAsianBreakRules|ValidateAgainstSchemas|SaveIfXMLInvalid|IgnoreMixedContent|AlwaysShowPlaceholderText|DoNotPromoteQF|LidThemeOther|LidThemeAsian|LidThemeComplexScript|Compatibility|BrowserLevel|mathPr|mso-[a-z0-9\-]+\s*:\s*[^;}\n]+;?)\b/gi,
      ' '
    )
    // 0B. Phục hồi ký hiệu mũi tên Wingdings/Symbol của Word bị biến thành dấu ngoặc kép ( " ) khi nằm giữa 2 cụm từ
    .replace(/([a-zA-ZÀ-ỹ0-9\)\]])\s+"(?=\s+[a-zA-ZÀ-ỹ0-9\(\[])/g, '$1 ➔')
    .replace(/[\uF0E0\uF0E8\uF0AE\u2192\u2794\u279C\u27A1]/g, '➔')
    // 1. Mảnh vỡ bắt đầu bằng tên thuộc tính CSS/MSO kết thúc bằng >
    .replace(
      /(?:[a-z0-9\-]*?(?:font-family|family|font-size|line-height|mso-[a-z0-9\-]+|text-align|font-weight|font-style|mso-ansi-language|mso-fareast-language|mso-bidi-language))\s*:\s*[^<>]{0,220}?(?:>|&gt;)/gi,
      ' '
    )
    // 2. Mảnh vỡ bắt đầu bằng tên phông chữ trong dấu nháy kết thúc bằng >
    .replace(
      /["'“”‘’]+(?:Times\s+New\s+Roman|Arial|Calibri|Cambria|Tahoma|Verdana|Helvetica|Courier\s+New|Segoe\s+UI|Roboto|Wingdings|Symbol)["'“”‘’]*[^<>]{0,220}?(?:>|&gt;)/gi,
      ' '
    )
    // 3. Mảnh vỡ bắt đầu bằng ,serif"> , ;mso-...> , ;font-...>
    .replace(
      /(?:,\s*(?:serif|sans-serif|monospace)|;\s*(?:mso-[a-z0-9\-]+|font-[a-z0-9\-]+)|mso-ansi-language\s*:\s*[A-Z\-]+)[^<>]{0,220}?(?:>|&gt;)/gi,
      ' '
    )
    // 4. Mảnh vỡ thuộc tính font-family còn sót dù mất dấu >
    .replace(
      /(?:[a-z0-9\-]*?font-family|family)\s*:\s*["'“”]+(?:Times\s+New\s+Roman|Arial|Calibri|Cambria|Wingdings|Symbol)["'“”]+(?:\s*,\s*(?:serif|sans-serif))?(?:\s*;)?/gi,
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

/* ============================================================================
 * BỘ CẮT ĐỀ THI CHUẨN (17/11/2026 — sửa lỗi nạp file đề nuốt tiêu đề/câu dẫn):
 * Đề thi thật có khối tiêu đề (SỞ/TRƯỜNG/NĂM HỌC/KỲ THI) ở đầu, các PHẦN I/II/III
 * kèm câu dẫn ("Thí sinh trả lời từ câu 1 đến câu 12"...), kết bằng "— HẾT —"
 * rồi mới tới ĐÁP ÁN / HƯỚNG DẪN GIẢI. Bộ cắt này đảm bảo:
 * 1. Chỉ đọc vùng từ tiêu đề "PHẦN I" tới mốc "HẾT" (hoặc tiêu đề vùng đáp án).
 * 2. Dòng tiêu đề phần + dòng câu dẫn KHÔNG bao giờ thành câu hỏi.
 * 3. Vùng sau HẾT không thành câu hỏi; đáp án tổng hợp trong vùng đó vẫn được
 *    thu hoạch, lời giải theo từng câu được gán vào trường explanation CHỈ khi
 *    khớp số câu + phần một cách duy nhất (khớp không chắc thì bỏ qua).
 * 4. Đường biên câu CỨNG: mốc "Câu N:" dính giữa dòng (bảng Word/mammoth gộp
 *    dòng) bị tách ra trước khi phân tích — một phương án không bao giờ được
 *    chứa mốc của câu khác.
 * ========================================================================== */

type NormalizedLine = { text: string; isU: boolean; isBold?: boolean; raw: string };

/** Chữ thuần của 1 dòng chuẩn hoá (bỏ rác style Word + token gạch chân/in đậm). */
function examLinePlainText(raw: string): string {
  return stripWordStyleGarbage(raw || '')
    .replace(/⟦\/?[UB]⟧/g, '')
    .replace(/^\*+\s*/, '')
    .trim();
}

/**
 * Nhận diện dòng TIÊU ĐỀ PHẦN: "PHẦN I. ...", "PHẦN II. Câu trắc nghiệm đúng sai
 * (2,0 điểm). Thí sinh trả lời...", "DẠNG THỨC 2..." -> trả 1 | 2 | 3.
 * Tiêu đề thật thường NGẮN hoặc chứa từ khoá đặc trưng của đề thi; dòng văn xuôi
 * bắt đầu bằng "Phần..." dài mà không có từ khoá thì KHÔNG coi là tiêu đề.
 */
export function detectExamSectionHeader(raw: string): 1 | 2 | 3 | null {
  const t = examLinePlainText(raw);
  const m = t.match(/^(?:PHẦN|DẠNG\s*THỨC)\s*(I|II|III|1|2|3)\b/i);
  if (!m) return null;
  const hasKeyword = /(trắc\s*nghiệm|đúng\s*sai|trả\s*lời\s*ngắn|thí\s*sinh|học\s*sinh)/i.test(t);
  if (t.length >= 170 && !hasKeyword) return null;
  const g = m[1].toUpperCase();
  return g === 'I' || g === '1' ? 1 : g === 'II' || g === '2' ? 2 : 3;
}

/**
 * Nhận diện dòng CÂU DẪN / hướng dẫn làm bài của từng phần — không bao giờ là
 * câu hỏi: "Thí sinh trả lời từ câu 1 đến câu 12", "Học sinh làm từ câu 1 đến
 * câu 4", "Mỗi câu hỏi thí sinh chỉ chọn một phương án", mảnh tiêu đề phần bị
 * tách dòng ("Câu trắc nghiệm nhiều phương án lựa chọn...")...
 */
export function isExamInstructionLine(raw: string): boolean {
  const t = examLinePlainText(raw);
  if (!t || t.length > 320) return false;
  if (/\?\s*$/.test(t)) return false; // câu hỏi thật thường kết thúc bằng dấu ?
  // Mảnh vỡ của tiêu đề phần bị bộ tách dòng cắt ra có thể còn dính nhãn mệnh đề ở
  // đầu (VD "d) ở mỗi câu, thí sinh chọn đúng hoặc sai.") — xét cả dạng đã lột nhãn.
  const u = t.replace(/^[a-dA-D]\s*[.)]\s*/, '');
  const variants = u !== t ? [t, u] : [t];
  for (const v of variants) {
    if (/từ\s+câu\s+\d+\s+đến\s+câu\s+\d+/i.test(v)) return true;
    if (/^(?:thí\s*sinh|học\s*sinh)\s+(?:trả\s*lời|làm\s*bài|làm|thực\s*hiện)\b/i.test(v)) return true;
    if (/^mỗi\s+câu\b[\s\S]*\bthí\s*sinh\b/i.test(v)) return true;
    if (/^ở\s+mỗi\s+câu\b[\s\S]*\bthí\s*sinh\b/i.test(v)) return true;
    if (/^trong\s+mỗi\s+ý\b[\s\S]*\bthí\s*sinh\b[\s\S]*\bchọn\b/i.test(v)) return true;
    if (/^câu\s+trắc\s+nghiệm\b/i.test(v)) return true; // mảnh tiêu đề phần tách dòng (không có số câu)
    if (/\bthí\s*sinh\s+chọn\s+(?:đúng|một)\b/i.test(v)) return true;
    if (/\bthí\s*sinh\b/i.test(v) && /(trả\s*lời|chỉ\s+chọn|không\s+được\s+sử\s+dụng|được\s+\d)/i.test(v)) return true;
  }
  return false;
}

/**
 * Nhận diện dòng TIÊU ĐỀ VÙNG ĐÁP ÁN đứng riêng: "ĐÁP ÁN", "ĐÁP ÁN PHẦN I",
 * "ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM", "HƯỚNG DẪN GIẢI", "LỜI GIẢI"...
 * KHÔNG nhận nhầm dòng đáp án của từng câu ("Đáp án: 5", "Đáp án: A",
 * "Đáp án đúng là...") — các dòng đó thuộc về bộ phân tích chính.
 */
export function isAnswerSectionHeaderLine(raw: string): boolean {
  const t = examLinePlainText(raw);
  if (!t || t.length > 80 || /[?]/.test(t)) return false;
  if (!/^(?:ĐÁP\s*ÁN|BẢNG\s*ĐÁP\s*ÁN|HƯỚNG\s*DẪN|LỜI\s*GIẢI)\b/i.test(t)) return false;
  if (/^đáp\s*án\s*[:=]\s*(?:[a-d]\b|\d|đúng|sai|đ\b|s\b)/i.test(t)) return false;
  if (/^đáp\s*án\b[\s\S]*\b(?:là|chọn)\b/i.test(t)) return false;
  return true;
}

/** Tìm mốc kết đề "HẾT": đứng riêng/ở đầu dòng -> 'line'; dính cuối dòng sau dấu gạch -> 'split'. */
function findExamEndMarker(raw: string): { kind: 'line' } | { kind: 'split'; index: number } | null {
  const rawText = raw || '';
  const t = examLinePlainText(rawText);
  if (!t) return null;
  const stripped = t.replace(/[—–\-.*\s()\[\]]/g, '');
  if (/^hết$/i.test(stripped)) return { kind: 'line' };
  if (/^[—–-]/.test(t) && /(?:HẾT|Hết)\b/.test(t.slice(0, 14))) return { kind: 'line' };
  const idx = rawText.search(/[—–]\s*HẾT\s*[—–]/);
  if (idx > 0) return { kind: 'split', index: idx };
  return null;
}

/**
 * Tách mốc "Câu N:" BỊ DÍNH GIỮA DÒNG thành dòng riêng (đường biên câu cứng).
 * Chỉ tách ở mốc viết hoa "Câu" + số + dấu ":" / "." / ")" đứng sau khoảng trắng;
 * "câu" thường trong thân câu (VD "kết quả câu 5 cho thấy...") không bị tách.
 * Dòng chứa bảng/hình (HTML/media token) giữ nguyên vì mốc trong ô bảng là dữ kiện.
 */
export function splitEmbeddedQuestionMarkers(line: NormalizedLine): NormalizedLine[] {
  const text = line.text || '';
  if (/<table|<img|⟦MEDIA/i.test(text)) return [line];
  const out: NormalizedLine[] = [];
  let rest = text;
  for (let guard = 0; guard < 8; guard++) {
    const m = rest.match(/\s+(Câu\s*(?:hỏi)?\s*\d{1,3}\s*[:.)])\s+/);
    if (!m || m.index === undefined) break;
    const before = rest.slice(0, m.index).trim();
    if (before) out.push({ ...line, text: before });
    rest = rest.slice(m.index).trim();
  }
  if (rest.trim()) out.push({ ...line, text: rest });
  return out.length > 0 ? out : [line];
}

export interface PreparedExamRegion {
  lines: NormalizedLine[];
  tailLines: NormalizedLine[];
  /** true khi tìm thấy mốc "PHẦN I" (đề có cấu trúc chuẩn) */
  regionApplied: boolean;
}

/**
 * Cắt vùng đề: [PHẦN I ... HẾT). Mọi dòng trước "PHẦN I" (khối tiêu đề) bị bỏ;
 * mọi dòng từ mốc "HẾT" (hoặc tiêu đề vùng đáp án, khi đề chuẩn không có HẾT)
 * trở đi nằm ở tailLines để thu hoạch đáp án/lời giải, không vào bộ phân tích.
 * Không tìm thấy mốc nào -> giữ nguyên toàn bộ (đề tự do do giáo viên tự soạn).
 */
export function prepareExamRegion(input: NormalizedLine[]): PreparedExamRegion {
  const split: NormalizedLine[] = [];
  input.forEach(l => split.push(...splitEmbeddedQuestionMarkers(l)));

  let start = 0;
  let regionApplied = false;
  for (let i = 0; i < split.length; i++) {
    if (detectExamSectionHeader(split[i].text) === 1) {
      start = i;
      regionApplied = true;
      break;
    }
  }

  let end = split.length;
  let tailStart = split.length;
  let seenQuestion = false;
  for (let i = start; i < split.length; i++) {
    const t = examLinePlainText(split[i].text);
    if (/^(?:Câu|Bài|Question)\s*(?:hỏi)?\s*\d+/i.test(t)) seenQuestion = true;

    const het = findExamEndMarker(split[i].text);
    if (het) {
      if (het.kind === 'split') {
        const before = (split[i].text || '').slice(0, het.index).trim();
        if (before) {
          split[i] = { ...split[i], text: before };
          end = i + 1;
        } else {
          end = i;
        }
      } else {
        end = i;
      }
      tailStart = i + 1;
      break;
    }

    if (regionApplied && seenQuestion && isAnswerSectionHeaderLine(t)) {
      end = i;
      tailStart = i;
      break;
    }
  }

  return { lines: split.slice(start, end), tailLines: split.slice(tailStart), regionApplied };
}

export interface TailExplanation {
  num: number;
  format: QuestionFormat | null;
  text: string;
}

export interface TailHarvest {
  answerKey: Record<number, number>;
  explanations: TailExplanation[];
}

/**
 * Thu hoạch vùng SAU mốc kết đề: bảng đáp án tổng hợp (cho answerKey) và các
 * khối lời giải bắt đầu bằng "Câu N:" (cho explanation). Khối chỉ chứa mỗi đáp
 * án ("Câu 3: A") hoặc quá ngắn thì bỏ — thà thiếu lời giải còn hơn gán sai.
 */
export function harvestExamTail(tailLines: NormalizedLine[]): TailHarvest {
  const answerKey: Record<number, number> = {};
  const blocks: { num: number; format: QuestionFormat | null; lines: string[] }[] = [];
  let curFmt: QuestionFormat | null = null;
  let cur: { num: number; format: QuestionFormat | null; lines: string[] } | null = null;
  const flush = () => {
    if (cur) {
      blocks.push(cur);
      cur = null;
    }
  };

  for (const l of tailLines) {
    const t = examLinePlainText(l.text);
    if (!t) continue;
    const sec = detectExamSectionHeader(t);
    if (sec) {
      curFmt = sec === 1 ? 'MULTIPLE_CHOICE' : sec === 2 ? 'TRUE_FALSE' : 'SHORT_ANSWER';
      flush();
      continue;
    }
    if (isAnswerSectionHeaderLine(t)) {
      flush();
      continue;
    }
    if (isExamInstructionLine(t)) continue;
    const batch = extractBatchAnswerKeyMap(t);
    if (batch && t.length < 220 && !/[?]/.test(t)) {
      Object.assign(answerKey, batch);
      continue;
    }
    const bm = t.match(/^Câu\s*(?:hỏi)?\s*(\d{1,3})\s*[:.)\-]?\s*([\s\S]*)$/i);
    if (bm) {
      flush();
      cur = { num: parseInt(bm[1], 10), format: curFmt, lines: bm[2] ? [bm[2]] : [] };
      continue;
    }
    if (cur) cur.lines.push(t);
  }
  flush();

  const explanations: TailExplanation[] = blocks
    .map(b => {
      let text = b.lines.join(' ').replace(/\s+/g, ' ').trim();
      // Bỏ tiền tố đáp án ở đầu khối ("Đáp án: A. ", "Đáp án B ") nếu phía sau còn nội dung lời giải
      text = text.replace(/^(?:Đáp\s*án(?:\s*đúng)?|ĐA)\s*[:=.]?\s*(?:[A-D]\s*[:.)\-]\s*)?/i, '').trim();
      return { num: b.num, format: b.format, text };
    })
    .filter(e => e.text.length >= 25 && !/^(?:chọn\s*)?[a-d]\.?$/i.test(e.text));

  return { answerKey, explanations };
}

export function parseHTMLToQuiz(
  htmlString: string,
  forcedFormat?: QuestionFormat,
  plainTextFallback?: string
): QuizItem[] {
  const rawLines = extractNormalizedLines(htmlString, plainTextFallback);
  if (rawLines.length === 0) return [];
  // BỘ CẮT ĐỀ: chỉ phân tích vùng PHẦN I -> HẾT; vùng sau HẾT chỉ để thu hoạch
  // đáp án tổng hợp + lời giải (gán explanation khi khớp chắc chắn).
  const examRegion = prepareExamRegion(rawLines);
  const parsed = examRegion.lines;
  const tailHarvest = harvestExamTail(examRegion.tailLines);
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
    // Bộ cắt đề 17/11: nhận cả tiêu đề DÀI kèm câu dẫn (trước đây giới hạn < 140 ký tự
    // khiến tiêu đề phần dài bị nuốt thành câu hỏi rác).
    const sectionPart = detectExamSectionHeader(cleanLine);
    if (sectionPart) {
      if (!forcedFormat) {
        currentSectionFormat =
          sectionPart === 1 ? 'MULTIPLE_CHOICE' : sectionPart === 2 ? 'TRUE_FALSE' : 'SHORT_ANSWER';
      }
      continue;
    }
    // Tiêu đề vùng đáp án đứng riêng ("ĐÁP ÁN", "HƯỚNG DẪN GIẢI"...) không bao giờ là câu hỏi,
    // và tuyệt đối không được lọt vào nhánh "Đáp án: ..." làm sai dạng câu hiện tại.
    if (isAnswerSectionHeaderLine(cleanLine)) {
      continue;
    }
    // Dòng câu dẫn của phần ("Thí sinh trả lời từ câu 1 đến câu 12"...) không tính vào số câu.
    if (isExamInstructionLine(cleanLine)) {
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
      /^(?:\[\s*([A-Da-d])\s*\]|\(\s*([A-Da-d])\s*\)|([A-Da-d])\s*\*?\s*(?:[\.:\)]|\s+-\s+))\s*\*?\s*([A-ZÀ-Ỹa-zà-ỹ0-9"“'(\[{<\-$√][\s\S]*)/
    );

    const optM: [string, string, string] | null = rawBracketOrLetterOpt
      ? [
          rawBracketOrLetterOpt[0],
          rawBracketOrLetterOpt[1] || rawBracketOrLetterOpt[2] || rawBracketOrLetterOpt[3],
          rawBracketOrLetterOpt[4]
        ]
      : null;

    const tfM = cleanLine.match(
      /^(?:Ý\s+|Mệnh\s*đề\s+|Phát\s*biểu\s+)?(?:\[\s*([a-dA-D])\s*\]|\(\s*([a-dA-D])\s*\)|([a-dA-D])\s*\*?\s*[\)\.\:\-])\s*\*?\s*([A-ZÀ-Ỹa-zà-ỹ0-9"“'(\[{<\-$√][\s\S]*)/i
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

        const isNextA = /^(?:\[\s*[Aa]\s*\]|\(\s*[Aa]\s*\)|[Aa]\s*\*?\s*(?:[\.:\)]|\s+-\s+))\s*[A-ZÀ-Ỹa-zà-ỹ0-9"“'(\[{<\-$√]/.test(nextClean);
        const isNextBCD = /^(?:\[\s*[B-Db-d]\s*\]|\(\s*[B-Db-d]\s*\)|[B-Db-d]\s*\*?\s*(?:[\.:\)]|\s+-\s+))\s*[A-ZÀ-Ỹa-zà-ỹ0-9"“'(\[{<\-$√]/.test(nextClean);
        const isNextD = /^(?:\[\s*[Dd]\s*\]|\(\s*[Dd]\s*\)|[Dd]\s*\*?\s*(?:[\.:\)]|\s+-\s+))\s*[A-ZÀ-Ỹa-zà-ỹ0-9"“'(\[{<\-$√]/.test(nextClean);

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

  // BỘ CẮT ĐỀ: gộp bảng đáp án thu hoạch từ vùng SAU mốc HẾT vào cùng bản đồ đáp án
  if (Object.keys(tailHarvest.answerKey).length > 0) {
    Object.assign(globalAnswerKeyMap, tailHarvest.answerKey);
  }

  // BỘ CẮT ĐỀ: gán LỜI GIẢI (vùng hướng dẫn giải sau HẾT) vào trường explanation.
  // CHỈ gán khi khớp chắc chắn, theo 1 trong 2 cách:
  // (a) dãy khối lời giải khớp TUẦN TỰ tuyệt đối với dãy câu hỏi (số lượng + số câu);
  // (b) mỗi khối khớp DUY NHẤT một câu theo (số câu + phần). Khớp mơ hồ -> bỏ qua.
  if (tailHarvest.explanations.length > 0 && res.length > 0) {
    const seqOk =
      tailHarvest.explanations.length === res.length &&
      tailHarvest.explanations.every((b, i) => b.num === (res[i]._origQNum || i + 1));
    if (seqOk) {
      res.forEach((item, i) => {
        if (!item.explanation) item.explanation = tailHarvest.explanations[i].text;
      });
    } else {
      tailHarvest.explanations.forEach(b => {
        const candidates = res.filter(
          item =>
            item._origQNum === b.num &&
            (!b.format || item.format === b.format) &&
            !item.explanation
        );
        if (candidates.length === 1) {
          candidates[0].explanation = b.text;
        }
      });
    }
  }

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

  const isBogusWordGarbageQuestion = (item: QuizItem): boolean => {
    const qClean = (item.q || '').trim();
    const isDefaultOrEmptyQ =
      !qClean ||
      /^Câu\s*hỏi\s*\d*[:.]?$/i.test(qClean) ||
      /^(?:Normal\s+0|false\s+false|table\.MsoNormalTable|Style\s+Definitions)/i.test(qClean);

    if (!item.format || item.format === 'MULTIPLE_CHOICE') {
      const meaningfulOpts = (item.opts || []).filter(o => {
        const t = (o || '').trim();
        return (
          t.length > 0 &&
          !/^(?:Phương\s+án\s+[A-D]|[A-D]\.?|[A-D]\.\s*[A-D]\.?)$/i.test(t)
        );
      });
      if (isDefaultOrEmptyQ && meaningfulOpts.length === 0) {
        return true;
      }
      if (meaningfulOpts.length === 0 && (item.opts || []).some(o => /^[A-D]\.?$/i.test((o || '').trim()))) {
        return true;
      }
    }
    return false;
  };

  return res
    .map((item, idx) => {
      item.qid = idx;
      item.q = cleanQuestionTitleText(item.q || '');
      const repaired = repairQuizItemIfCorrupted(item);

      // NGHIỆM THU PHƯƠNG ÁN (17/11/2026): đường biên câu cứng + phương án hỏng phải
      // bị gắn cờ LỖI rõ ràng, không trình ra như kết quả đạt:
      // - Phương án còn chứa mốc "Câu N:" của câu khác -> cắt tại mốc đó.
      // - Phương án rỗng / chữ giữ chỗ "Phương án X" / mảnh nhãn dang dở ("C.") /
      //   công thức bị cắt cụt (kết thúc bằng dấu + - * / ^ =) -> ghi vào parseWarning.
      if (!repaired.format || repaired.format === 'MULTIPLE_CHOICE') {
        const badLetters: string[] = [];
        repaired.opts = (repaired.opts || []).map((o, oi) => {
          let t = String(o || '').trim();
          const markerIdx = t.search(/\sCâu\s*(?:hỏi)?\s*\d{1,3}\s*[:.)]/);
          if (markerIdx >= 0) {
            t = markerIdx === 0 ? '' : t.slice(0, markerIdx).trim();
            if (!badLetters.includes(String.fromCharCode(65 + oi))) {
              badLetters.push(String.fromCharCode(65 + oi));
            }
          }
          const isDangling =
            !t ||
            /^Phương\s*án\s*[A-D]$/i.test(t) ||
            /^[A-Da-d]\s*[.)]$/.test(t) ||
            /[+\-*/^=]\s*$/.test(t);
          if (isDangling && !badLetters.includes(String.fromCharCode(65 + oi))) {
            badLetters.push(String.fromCharCode(65 + oi));
          }
          return t;
        });
        if (badLetters.length > 0) {
          const warn = `Cảnh báo: Phương án ${badLetters.join(
            ', '
          )} chưa trích xuất được nội dung gốc (rỗng/dự phòng/bị cắt cụt) — hãy kiểm tra lại file đề.`;
          repaired.parseWarning = repaired.parseWarning ? `${repaired.parseWarning} ${warn}` : warn;
        }
      }
      return repaired;
    })
    .filter(item => !isBogusWordGarbageQuestion(item) && item.q.length > 0 && item.opts.length >= 1)
    .map((item, idx) => ({
      ...item,
      qid: idx,
      // Đợt 4 (GĐ3.4): chuẩn hoá NFC tại điểm ra của parser để MỌI đường nạp
      // (dán / file / JSON) đều cho chữ tiếng Việt dựng sẵn, hết lệch NFD khi
      // tìm kiếm / đối sánh / hiển thị.
      q: (item.q || '').normalize('NFC'),
      opts: (item.opts || []).map(o => String(o || '').normalize('NFC')),
      tfItems: item.tfItems
        ? item.tfItems.map(tf => ({ ...tf, text: (tf.text || '').normalize('NFC') }))
        : item.tfItems,
      shortAnswer:
        typeof item.shortAnswer === 'string' ? item.shortAnswer.normalize('NFC') : item.shortAnswer,
      explanation:
        typeof item.explanation === 'string' ? item.explanation.normalize('NFC') : item.explanation
    }));
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
    mcHTML += `<div><b>Câu ${i + 1}:</b> ${cleanQuestionTitleText(item.q)}</div>`;
    item.opts.slice(0, 4).forEach((o, oi) => {
      const ch = String.fromCharCode(65 + oi);
      mcHTML += oi === item.correct ? `<div><u>${ch}. ${o}</u></div>` : `<div>${ch}. ${o}</div>`;
    });
    mcHTML += `<br>`;
  });

  let tfHTML = '';
  tfItems.forEach((item, i) => {
    tfHTML += `<div><b>Câu ${i + 1}:</b> ${cleanQuestionTitleText(item.q)}</div>`;
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
    saHTML += `<div><b>Câu ${i + 1}:</b> ${cleanQuestionTitleText(item.q)}</div>`;
    saHTML += `<div><b>Đáp án:</b> <u>${cleanAns}</u></div>`;
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
// The questions WITHIN each part AND the options within each question are randomly shuffled on every match!
export function shuffleQuestionOrder(deck: QuizItem[]): QuizItem[] {
  if (!deck || deck.length === 0) return [];
  const cloned: QuizItem[] = JSON.parse(JSON.stringify(deck)).map((q: QuizItem) => repairQuizItemIfCorrupted(q));

  const shuffleArray = <T>(arr: T[]): T[] => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Phân loại chính xác 3 dạng thức GDPT 2018:
  // Phần II: Đúng/Sai (format TRUE_FALSE hoặc có tfItems)
  // Phần III: Trả lời ngắn (format SHORT_ANSWER hoặc có shortAnswer)
  // Phần I: Trắc nghiệm 4 lựa chọn (các câu còn lại)
  const isPart2 = (q: QuizItem) => q.format === 'TRUE_FALSE' || (Array.isArray(q.tfItems) && q.tfItems.length > 0);
  const isPart3 = (q: QuizItem) => q.format === 'SHORT_ANSWER' || (!isPart2(q) && (q.shortAnswer !== undefined && q.shortAnswer !== ''));
  const isPart1 = (q: QuizItem) => !isPart2(q) && !isPart3(q);

  const part1 = cloned.filter(isPart1).map(q => {
    const rawOpts = Array.isArray(q.opts) ? q.opts : [];
    const safeCorrectIdx = typeof q.correct === 'number' && q.correct >= 0 && q.correct < rawOpts.length ? q.correct : 0;
    const hasPositionalRef = rawOpts.some(o =>
      /(?:cả\s+[a-d]|tất\s+cả.*đều|không\s+có\s+đáp\s+án|[a-d]\s+và\s+[a-d])/i.test(String(o || ''))
    );

    if (rawOpts.length >= 2 && !hasPositionalRef) {
      const tagged = rawOpts.map((text, idx) => ({
        text: String(text || '').replace(/^[A-D][\.\:\)]\s*/i, '').trim() || String(text || ''),
        isCorrect: idx === safeCorrectIdx
      }));
      const shuffledTagged = shuffleArray(tagged);
      const newCorrectIdx = Math.max(0, shuffledTagged.findIndex(item => item.isCorrect));
      return {
        ...q,
        format: 'MULTIPLE_CHOICE' as QuestionFormat,
        opts: shuffledTagged.map(item => item.text),
        correct: newCorrectIdx
      };
    }

    return {
      ...q,
      format: (q.format || 'MULTIPLE_CHOICE') as QuestionFormat
    };
  });

  const part2 = cloned.filter(isPart2).map(q => {
    const rawTf = Array.isArray(q.tfItems) ? [...q.tfItems] : [];
    if (rawTf.length >= 2) {
      const shuffledTf = shuffleArray(rawTf).map((tf, i) => ({
        label: String.fromCharCode(97 + i),
        text: cleanTFStatementText(tf.text),
        isCorrect: Boolean(tf.isCorrect)
      }));
      return {
        ...q,
        format: 'TRUE_FALSE' as QuestionFormat,
        tfItems: shuffledTf,
        opts: shuffledTf.map(tf => `${tf.label}) ${tf.text} (${tf.isCorrect ? 'Đúng' : 'Sai'})`)
      };
    }
    return { ...q, format: 'TRUE_FALSE' as QuestionFormat };
  });

  const part3 = cloned.filter(isPart3).map(q => ({ ...q, format: 'SHORT_ANSWER' as QuestionFormat }));

  const shuffledPart1 = shuffleArray(part1);
  const shuffledPart2 = shuffleArray(part2);
  const shuffledPart3 = shuffleArray(part3);

  // Thứ tự bắt buộc: Tất cả câu Phần I ➔ Tất cả câu Phần II ➔ Tất cả câu Phần III
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
  // Đồng nhất 100% giữa màn hình Giáo viên và Học sinh, không tự ý xáo trộn phương án
  const result: QuizItem = {
    ...questionItem,
    q: cleanQuestionTitleText(questionItem.q),
    opts: [...(questionItem.opts || [])]
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
// QUAN TRỌNG: totalQuestions BẮT BUỘC là tổng số câu THẬT của đề/trận đang chơi — tuyệt đối
// không để mặc định cứng theo đề ví dụ 12 câu (lỗi cũ: trận 24 câu vẫn chia cho 12 nên
// em nào đúng từ 12 câu trở lên cũng bị kẹp thành 10.0 điểm).
export function getTeacherGradebookScore(correctCount: number, totalQuestions: number, _rankByCorrect?: number) {
  const safeTotalQ = Math.max(1, Math.floor(totalQuestions) || 1);
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

/**
 * 🌱 PHIÊN BẢN SEED CỦA BỘ MẶC ĐỊNH (chuẩn hoá 18/11/2026): nội dung 12 môn
 * mặc định được chuẩn hoá lại theo cấu trúc đề thi tốt nghiệp (môn 3 phần:
 * 6-2-2; môn 2 phần: 6-4-0; môn 1 phần: 10-0-0 — tổng 10 đơn vị/môn, nội
 * dung dễ, ứng dụng đời sống). Mỗi lần nội dung chuẩn thay đổi, TĂNG số này:
 * bản đang lưu của chính các bộ mặc định có seedVersion nhỏ hơn sẽ được làm
 * mới (xem applyDefaultSeedRefresh trong utils/deckStore.ts); bộ giáo viên
 * tự tạo không bao giờ bị đụng.
 */
export const DEFAULT_SEED_VERSION = 2;

/** Thứ tự 12 môn mặc định (cũng là thứ tự gộp vào Tổng Hợp). */
export const DEFAULT_SUBJECT_ORDER = [
  'BIO', 'AGRI', 'MATH', 'PHYS', 'CHEM', 'LIT',
  'ENG', 'HIST', 'GEO', 'GDKTPL', 'IT', 'GDQPAN'
];

/** Toàn bộ khoá mặc định: 12 môn + bộ Tổng Hợp (ALL_SUBJ). */
export const DEFAULT_SUBJECT_KEYS = [...DEFAULT_SUBJECT_ORDER, 'ALL_SUBJ'];

/**
 * Dựng bản chuẩn của 13 bộ mặc định từ mã nguồn (kèm dấu seedVersion).
 * ALL_SUBJ = gộp toàn bộ câu hỏi của 12 môn theo đúng cơ chế cũ (nối html).
 */
export function buildDefaultSubjects(): Record<string, SubjectData> {
  const mk = (name: string, html: string, color: string): SubjectData => ({
    name,
    html: html.trim(),
    color,
    fixed: true,
    seedVersion: DEFAULT_SEED_VERSION
  });
  const db: Record<string, SubjectData> = {
    BIO: mk('🧬 Sinh Học', DEFAULT_BIO, '#10b981'),
    AGRI: mk('🚜 Công Nghệ', DEFAULT_AGRI, '#f59e0b'),
    MATH: mk('📐 Toán Học', DEFAULT_MATH, '#0284c7'),
    PHYS: mk('⚡ Vật Lý', DEFAULT_PHYS, '#8b5cf6'),
    CHEM: mk('🧪 Hóa Học', DEFAULT_CHEM, '#ec4899'),
    LIT: mk('📖 Ngữ Văn', DEFAULT_LIT, '#e11d48'),
    ENG: mk('🇬🇧 Tiếng Anh', DEFAULT_ENG, '#0891b2'),
    HIST: mk('📜 Lịch Sử', DEFAULT_HIST, '#b45309'),
    GEO: mk('🌍 Địa Lý', DEFAULT_GEO, '#059169'),
    GDKTPL: mk('⚖️ GDKT & PL', DEFAULT_GDKTPL, '#7c3aed'),
    IT: mk('💻 Tin Học', DEFAULT_IT, '#2563eb'),
    GDQPAN: mk('🛡️ GDQP & AN', DEFAULT_GDQPAN, '#4d7c0f')
  };
  const allCombinedHTML = DEFAULT_SUBJECT_ORDER.map(k => db[k].html).join('<br>');
  db['ALL_SUBJ'] = mk('🌟 Tổng Hợp 12 Môn THPT', allCombinedHTML, '#4f46e5');
  return db;
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
          if (
            /font-family|mso-|Times New Roman|Normal\s+0\s+false|Style\s+Definitions|MsoNormalTable|Chưa nhập nội dung mệnh đề|\[Đúng\/Sai\]|\s+"\s+[a-zA-ZÀ-ỹ]/i.test(
              db[k].html
            )
          ) {
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
        const repairedActive = parsedActive
          .map((q: QuizItem) => repairQuizItemIfCorrupted(q))
          .filter((q: QuizItem) => {
            const qTxt = (q.q || '').trim();
            if (!qTxt || /^(?:Normal\s+0|false\s+false|table\.MsoNormalTable|Style\s+Definitions)/i.test(qTxt)) {
              return false;
            }
            if (!q.format || q.format === 'MULTIPLE_CHOICE') {
              const validOpts = (q.opts || []).filter(
                o => !/^(?:Phương\s+án\s+[A-D]|[A-D]\.?)$/i.test(String(o || '').trim())
              );
              if (validOpts.length === 0) return false;
            }
            return true;
          })
          .map((q: QuizItem, idx: number) => ({ ...q, qid: idx }));
        localStorage.setItem('custom_Active_Quiz_V31', JSON.stringify(repairedActive));
      }
    }
  } catch (e) {}

  // 🌱 GIEO + LÀM MỚI BỘ MẶC ĐỊNH THEO PHIÊN BẢN SEED: thiếu thì gieo mới;
  // bản đang lưu của CHÍNH bộ mặc định mà cũ hơn DEFAULT_SEED_VERSION (nội
  // dung méo qua các lần nâng cấp) thì thay bằng bản chuẩn trong mã nguồn;
  // ALL_SUBJ luôn dựng lại từ 12 môn như trước. Bộ đã ở đúng phiên bản seed
  // thì giữ nguyên (kể cả phần giáo viên đã sửa sau lần làm mới gần nhất).
  // Việc tôn trọng tombstone xoá tường minh ở tầng kho bền do
  // applyDefaultSeedRefresh (utils/deckStore.ts) đảm nhiệm lúc boot.
  const seedDefaults = buildDefaultSubjects();
  for (const key of DEFAULT_SUBJECT_KEYS) {
    const cur = db[key];
    if (!cur || key === 'ALL_SUBJ' || (cur.seedVersion ?? 0) < DEFAULT_SEED_VERSION) {
      db[key] = seedDefaults[key];
    }
  }

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

