import React, { useState } from 'react';
import { QuizItem, MatchState, Player } from '../types';
import { cleanQuestionTitleText, getConvertedGradeByRank, getTeacherGradebookScore } from '../data/defaultSubjects';
import { exportHonorCertificateHTML } from '../utils/exportEvidence';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  quizList: QuizItem[];
  matchState: MatchState;
  subjectName: string;
  activeRoomId: string;
  onExportHTMLSlide: () => void;
  onPrintPDFEvidence: () => void;
  onTriggerDemoBots?: () => void;
}

export const NationalJuryDossierModal: React.FC<Props> = ({
  isOpen,
  onClose,
  quizList,
  matchState,
  subjectName,
  activeRoomId,
  onExportHTMLSlide,
  onPrintPDFEvidence,
  onTriggerDemoBots
}) => {
  const [activeTab, setActiveTab] = useState<'GUIDE' | 'MATRIX' | 'ANALYTICS' | 'DOSSIER'>('GUIDE');

  if (!isOpen) return null;

  const countF1 = quizList.filter(q => !q.format || q.format === 'MULTIPLE_CHOICE').length;
  const countF2 = quizList.filter(q => q.format === 'TRUE_FALSE').length;
  const countF3 = quizList.filter(q => q.format === 'SHORT_ANSWER').length;
  const totalQ = Math.max(quizList.length, 1);

  const allPlayers: Player[] = [...matchState.redPlayers, ...matchState.bluePlayers];
  const rankedPlayers = [...allPlayers].sort((a, b) => {
    if ((b.fastScore || 0) !== (a.fastScore || 0)) return (b.fastScore || 0) - (a.fastScore || 0);
    return (b.correct || 0) - (a.correct || 0);
  });

  // Phân loại phổ điểm quy đổi Thông tư 22
  let tierExcellent = 0; // >= 9.0
  let tierGood = 0; // 8.0 - 8.9
  let tierFair = 0; // 6.5 - 7.9
  let tierPass = 0; // < 6.5

  rankedPlayers.forEach((p, idx) => {
    const gb = getTeacherGradebookScore(p.correct || 0, totalQ, idx + 1).grade;
    if (gb >= 9.0) tierExcellent++;
    else if (gb >= 8.0) tierGood++;
    else if (gb >= 6.5) tierFair++;
    else tierPass++;
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 100005,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        style={{
          background: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
          border: '2.5px solid #f59e0b',
          borderRadius: '22px',
          maxWidth: '1080px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75)',
          color: '#ffffff',
          overflow: 'hidden'
        }}
      >
        {/* Header Hướng Dẫn Sử Dụng */}
        <div
          style={{
            padding: '16px 22px',
            background: 'linear-gradient(90deg, #1e1b4b 0%, #0f172a 50%, #1e1b4b 100%)',
            borderBottom: '2px solid #f59e0b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#0f172a',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '11.5px',
                  fontWeight: 900
                }}
              >
                📖 HƯỚNG DẪN SỬ DỤNG CHI TIẾT
              </span>
              <span style={{ fontSize: '12.5px', color: '#7dd3fc', fontWeight: 800 }}>
                👨‍🏫 Tác giả: Thầy Hồ Tấn Khải • Trường THPT Mang Thít
              </span>
            </div>
            <h2 style={{ margin: '5px 0 0 0', fontSize: '20px', fontWeight: 900, color: '#fef08a' }}>
              CẨM NANG HƯỚNG DẪN SỬ DỤNG ĐẤU TRƯỜNG 3D DÀNH CHO GIÁO VIÊN & HỌC SINH
            </h2>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#ef4444',
              border: 'none',
              color: '#ffffff',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              fontSize: '18px',
              fontWeight: 900,
              cursor: 'pointer'
            }}
            title="Đóng cửa sổ"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '10px 22px',
            background: '#0b1120',
            borderBottom: '1px solid #1e293b',
            flexWrap: 'wrap'
          }}
        >
          <button
            onClick={() => setActiveTab('GUIDE')}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: activeTab === 'GUIDE' ? '2px solid #fde047' : '1px solid #334155',
              background: activeTab === 'GUIDE' ? 'linear-gradient(135deg, #d97706, #b45309)' : '#1e293b',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            📖 1. Hướng Dẫn Sử Dụng (GV & HS)
          </button>

          <button
            onClick={() => setActiveTab('MATRIX')}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: activeTab === 'MATRIX' ? '2px solid #38bdf8' : '1px solid #334155',
              background: activeTab === 'MATRIX' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : '#1e293b',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            📊 2. Ma Trận 3 Dạng Thức & Thống Kê Câu Hỏi
          </button>

          <button
            onClick={() => setActiveTab('ANALYTICS')}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: activeTab === 'ANALYTICS' ? '2px solid #4ade80' : '1px solid #334155',
              background: activeTab === 'ANALYTICS' ? 'linear-gradient(135deg, #059669, #047857)' : '#1e293b',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            📈 3. Phổ Điểm & Sổ Điểm Giáo Viên ({allPlayers.length} HS)
          </button>

          <button
            onClick={() => setActiveTab('DOSSIER')}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: activeTab === 'DOSSIER' ? '2px solid #c084fc' : '1px solid #334155',
              background: activeTab === 'DOSSIER' ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : '#1e293b',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            🏅 4. Giới Thiệu Sư Phạm & Tính Năng
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {activeTab === 'GUIDE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Phần 1: Hướng dẫn dành cho Giáo viên */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '2px solid #38bdf8',
                  borderRadius: '16px',
                  padding: '16px 20px'
                }}
              >
                <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', color: '#38bdf8', fontWeight: 900 }}>
                  👨‍🏫 PHẦN I — HƯỚNG DẪN DÀNH CHO GIÁO VIÊN (3 BƯỚC TỔ CHỨC TRÊN LỚP)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '12px' }}>
                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ fontSize: '14.5px', fontWeight: 900, color: '#fde047', marginBottom: '6px' }}>
                      Bước 1: Chuẩn bị Bộ Câu Hỏi (3 Dạng Thức)
                    </div>
                    <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.55 }}>
                      • Chọn môn học có sẵn hoặc bấm tab <b>&ldquo;📋 Dán Nhanh Theo Khung 3 Dạng Thức&rdquo;</b> để copy-paste câu hỏi từ Word/PDF vào 3 khung riêng biệt:<br />
                      &nbsp;&nbsp;1️⃣ <b>Dạng thức I</b>: Trắc nghiệm 4 phương án A, B, C, D.<br />
                      &nbsp;&nbsp;2️⃣ <b>Dạng thức II</b>: Đúng/Sai 4 mệnh đề a, b, c, d.<br />
                      &nbsp;&nbsp;3️⃣ <b>Dạng thức III</b>: Trả lời ngắn (điền đáp số).<br />
                      • Có thể sửa trực tiếp từng câu hỏi hoặc dùng <b>AI Soạn Đề</b>.
                    </div>
                  </div>

                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ fontSize: '14.5px', fontWeight: 900, color: '#4ade80', marginBottom: '6px' }}>
                      Bước 2: Chọn Trò Chơi & Mở Sân Đấu 3D
                    </div>
                    <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.55 }}>
                      • Chọn 1 trong 4 trò chơi: <b>⚔️ Kéo Co 3D</b>, <b>🔔 Rung Chuông Vàng</b>, <b>⚡ Ai Nhanh Hơn</b>, hoặc <b>🐉 Đánh Boss</b>.<br />
                      • Bấm <b>&ldquo;🚀 BẮT ĐẦU TRẬN ĐẤU&rdquo;</b> để mở Sân Đấu 3D.<br />
                      • Bấm vào <b>Mã QR</b> ở góc màn hình để phóng to cho học sinh quét mã vào phòng, hoặc bấm <b>&ldquo;🤖 Demo GK&rdquo;</b> để tạo 12 học sinh 3D giả lập.
                    </div>
                  </div>

                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ fontSize: '14.5px', fontWeight: 900, color: '#f472b6', marginBottom: '6px' }}>
                      Bước 3: Điều Khiển & Xuất Sổ Điểm Giáo Viên
                    </div>
                    <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.55 }}>
                      • Bấm <b>&ldquo;🔊 Đọc Đề&rdquo;</b> để giọng MC đọc câu hỏi tự động.<br />
                      • Bấm <b>&ldquo;🏆 2 BXH &amp; Sổ Điểm&rdquo;</b> hoặc <b>&ldquo;⏹ Kết Thúc&rdquo;</b> để xem song song <b>2 Bảng Xếp Hạng</b> (Bảng Tổng Điểm Thi Đấu &amp; Bảng Số Câu Đúng Ghi Sổ Điểm GV) và tải file Excel <b>.CSV</b>.
                    </div>
                  </div>
                </div>
              </div>

              {/* Phần 2: Hướng dẫn dành cho Học sinh */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '2px solid #10b981',
                  borderRadius: '16px',
                  padding: '16px 20px'
                }}
              >
                <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', color: '#6ee7b7', fontWeight: 900 }}>
                  📱 PHẦN II — HƯỚNG DẪN DÀNH CHO HỌC SINH TRÊN ĐIỆN THOẠI
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '12px' }}>
                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ fontSize: '14.5px', fontWeight: 900, color: '#fef08a', marginBottom: '6px' }}>
                      1. Nhập Tên & Chọn Nhân Vật Nam / Nữ
                    </div>
                    <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.55 }}>
                      • Học sinh quét mã QR trên màn hình máy chiếu (hoặc nhập Mã phòng).<br />
                      • <b>Nhập Họ và tên / Lớp</b> (bắt buộc để ghi sổ điểm).<br />
                      • Bấm chọn <b>👦 Nhân vật Nam</b> hoặc <b>👧 Nhân vật Nữ</b>, chọn kiểu mũ, trang phục yêu thích. Ngay cả khi đang làm bài vẫn có nút đổi nhanh <b>👦 Nam / 👧 Nữ</b>!
                    </div>
                  </div>

                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ fontSize: '14.5px', fontWeight: 900, color: '#38bdf8', marginBottom: '6px' }}>
                      2. Hai Chế Độ Vào Phòng Thi
                    </div>
                    <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.55 }}>
                      • <b>🚀 Vào Trực Tiếp Phòng Có Câu Hỏi</b>: Vào thẳng câu hỏi hiện tại và chọn đáp án trả lời ngay.<br />
                      • <b>🚪 Bấm Vào Phòng Chờ</b>: Học sinh chỉ nhìn thấy nội dung câu hỏi để đọc trước nhưng <b>chưa được trả lời</b>; ngay khi Giáo viên bấm <b>&ldquo;Bắt đầu&rdquo;</b> sẽ tự động mở khóa đáp án!
                    </div>
                  </div>

                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ fontSize: '14.5px', fontWeight: 900, color: '#4ade80', marginBottom: '6px' }}>
                      3. Thời Gian 30 Giây & Bảo Lưu Điểm
                    </div>
                    <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.55 }}>
                      • Mỗi câu hỏi có <b>30 giây</b> suy nghĩ. Khi trả lời xong, học sinh chờ hết 30s để cả lớp cùng chuyển sang câu mới (hết 30s không chọn coi như sai).<br />
                      • Nếu mạng yếu, bấm nút <b>&ldquo;🔄 Kết nối lại&rdquo;</b> để thi tiếp mà không mất điểm!
                    </div>
                  </div>
                </div>
              </div>

              {/* Phần 3: Luật chơi & Cách tính điểm 4 trò chơi */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '2px solid #f59e0b',
                  borderRadius: '16px',
                  padding: '16px 20px'
                }}
              >
                <h3 style={{ margin: '0 0 10px 0', fontSize: '17px', color: '#fde047', fontWeight: 900 }}>
                  🎮 PHẦN III — LUẬT CHƠI 4 CHẾ ĐỘ & CƠ CHẾ 2 BẢNG XẾP HẠNG
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px' }}>
                  <div style={{ background: '#1e293b', borderRadius: '12px', padding: '12px', border: '1px solid #334155' }}>
                    <div style={{ fontWeight: 900, color: '#38bdf8', fontSize: '14px', marginBottom: '4px' }}>
                      ⚔️ 1. Kéo Co 3D (Chia Đội)
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.5 }}>
                      Chia 2 đội Đỏ &amp; Xanh. Trả lời đúng kéo dây về phía đội mình; đúng 3 câu liên tiếp nhận <b>Thẻ Kỹ Năng</b> (Khiên, Băng giá, 50/50, x2 Kéo).
                    </div>
                  </div>

                  <div style={{ background: '#1e293b', borderRadius: '12px', padding: '12px', border: '1px solid #334155' }}>
                    <div style={{ fontWeight: 900, color: '#fde047', fontSize: '14px', marginBottom: '4px' }}>
                      🔔 2. Rung Chuông Vàng (3 ❤️)
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.5 }}>
                      Mỗi học sinh có <b>3 mạng ❤️</b>. Chọn sai mất 1 mạng; hết 3 mạng thành Khán giả cổ vũ và chờ Giáo viên tung <b>Phao Cứu Trợ</b> hồi sinh!
                    </div>
                  </div>

                  <div style={{ background: '#1e293b', borderRadius: '12px', padding: '12px', border: '1px solid #334155' }}>
                    <div style={{ fontWeight: 900, color: '#a855f7', fontSize: '14px', marginBottom: '4px' }}>
                      ⚡ 3. Ai Nhanh Hơn (-1000đ/sai)
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.5 }}>
                      Đua điểm cá nhân: Mỗi câu đúng <b>+1000 điểm</b>, mỗi câu chọn sai bị <b>trừ -1000 điểm</b> vào Tổng điểm xếp hạng!
                    </div>
                  </div>

                  <div style={{ background: '#1e293b', borderRadius: '12px', padding: '12px', border: '1px solid #334155' }}>
                    <div style={{ fontWeight: 900, color: '#f87171', fontSize: '14px', marginBottom: '4px' }}>
                      🐉 4. Đánh Boss (-1000đ/sai)
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.5 }}>
                      Cả lớp hợp sức trừ HP Rồng Hắc Ám. Câu đúng <b>+1000 điểm</b> và gây sát thương Boss; câu chọn sai bị <b>trừ -1000 điểm</b> cá nhân!
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.14)', border: '1.5px solid #10b981', borderRadius: '12px', fontSize: '13px', color: '#d1fae5', fontWeight: 800 }}>
                  💡 <b>Đặc biệt — Hệ thống 2 Bảng Xếp Hạng song song:</b> Bên cạnh <b>🏆 Bảng Xếp Hạng Tổng Điểm Thi Đấu</b> (có trừ -1000đ câu sai để tăng kịch tính), hệ thống luôn có <b>📒 Bảng Xếp Hạng Theo Số Câu Đúng</b> quy đổi ra thang điểm 10 để Giáo viên ghi vào sổ điểm (học sinh tham gia chơi có câu đúng luôn có điểm!).
                </div>
              </div>
            </div>
          )}

          {activeTab === 'DOSSIER' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: 'rgba(30, 27, 75, 0.65)',
                  border: '1.5px solid #818cf8',
                  borderRadius: '16px',
                  padding: '16px 20px'
                }}
              >
                <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', color: '#fde047', fontWeight: 900 }}>
                  🎯 I. MỤC TIÊU SƯ PHẠM & ĐỔI MỚI PHƯƠNG PHÁP DẠY HỌC (GDPT 2018)
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#e2e8f0', lineHeight: 1.6 }}>
                  Giải pháp chuyển hóa các tiết ôn tập, kiểm tra đánh giá thường xuyên (theo <b>Thông tư 22/2021/TT-BGDĐT</b>) và cấu trúc đề thi tốt nghiệp THPT mới (<b>3 Dạng thức câu hỏi</b> theo Quyết định 764/QĐ-BGDĐT) thành một <b>Đấu trường 3D tương tác thời gian thực</b>. Học sinh sử dụng điện thoại thông minh quét mã QR để hóa thân thành các nhân vật Chibi 3D Nam/Nữ trực tiếp tranh tài trên màn hình lớn của lớp học.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                  gap: '12px'
                }}
              >
                <div style={{ background: '#111827', border: '1.5px solid #ef4444', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#fca5a5', marginBottom: '6px' }}>
                    ⚔️ 1. Kéo Co 3D Chiến Thuật
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
                    Phát triển <b>năng lực hợp tác nhóm</b> (Đội Đỏ vs Đội Xanh). Tích hợp chuỗi thắng 3 câu nhận Thẻ Kỹ Năng (Khiên bảo vệ, Băng giá, 50/50, Nhân đôi lực kéo).
                  </div>
                </div>

                <div style={{ background: '#111827', border: '1.5px solid #f59e0b', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#fde047', marginBottom: '6px' }}>
                    🔔 2. Rung Chuông Vàng 3D
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
                    Mô phỏng sàn thi đấu 100 thí sinh với <b>cơ chế 3 mạng (3 ❤️)</b> nhân văn. Hết 3 mạng học sinh trở thành Khán giả cổ vũ và được Giáo viên tung <b>Phao Cứu Trợ</b> hồi sinh.
                  </div>
                </div>

                <div style={{ background: '#111827', border: '1.5px solid #38bdf8', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#7dd3fc', marginBottom: '6px' }}>
                    ⚡ 3. Đường Đua Tốc Độ 3D
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
                    Rèn luyện <b>phản xạ tư duy nhanh</b>. Mỗi câu đúng +1000 điểm, chọn sai trừ -1000 điểm, kết hợp bảng xếp hạng Số Câu Đúng để ghi sổ điểm giáo viên.
                  </div>
                </div>

                <div style={{ background: '#111827', border: '1.5px solid #a855f7', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#e879f9', marginBottom: '6px' }}>
                    🐉 4. Dũng Sĩ Diệt Boss Kiến Thức
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
                    Cả lớp đoàn kết hợp lực giải các câu hỏi vận dụng để tiêu diệt Quái vật Rồng Hắc Ám 3D (Co-op Raid), không bỏ lại học sinh nào phía sau.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'MATRIX' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '12px'
                }}
              >
                <div style={{ background: '#111827', border: '2px solid #0284c7', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 900, color: '#38bdf8' }}>PHẦN I • DẠNG THỨC 1</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                    {countF1} câu ({Math.round((countF1 / totalQ) * 100)}%)
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Trắc nghiệm 4 phương án A, B, C, D • Đánh giá mức độ Nhận biết & Thông hiểu
                  </div>
                </div>

                <div style={{ background: '#111827', border: '2px solid #f59e0b', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 900, color: '#fde047' }}>PHẦN II • DẠNG THỨC 2</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                    {countF2} câu ({Math.round((countF2 / totalQ) * 100)}%)
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Trắc nghiệm Đúng/Sai 4 mệnh đề a, b, c, d • Đánh giá tư duy Phân tích & Vận dụng
                  </div>
                </div>

                <div style={{ background: '#111827', border: '2px solid #10b981', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 900, color: '#4ade80' }}>PHẦN III • DẠNG THỨC 3</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                    {countF3} câu ({Math.round((countF3 / totalQ) * 100)}%)
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Trắc nghiệm Trả lời ngắn • Đánh giá năng lực Giải quyết vấn đề & Vận dụng cao
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: '#111827',
                  border: '1.5px solid #334155',
                  borderRadius: '16px',
                  padding: '14px',
                  overflowX: 'auto'
                }}
              >
                <div style={{ fontSize: '15px', fontWeight: 900, color: '#fde047', marginBottom: '10px' }}>
                  📋 BẢNG PHÂN TÍCH ĐỘ KHÓ THỰC NGHIỆM TỪNG CÂU HỎI (ITEM ANALYSIS):
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#7dd3fc', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>CÂU</th>
                      <th style={{ padding: '8px 10px' }}>NỘI DUNG CÂU HỎI</th>
                      <th style={{ padding: '8px 10px' }}>DẠNG THỨC GDPT 2018</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>LƯỢT ĐÚNG / SAI</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>ĐÁNH GIÁ ĐỘ KHÓ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizList.map((item, idx) => {
                      const r = item.rightCount || 0;
                      const w = item.wrongCount || 0;
                      const tot = r + w;
                      const pct = tot > 0 ? Math.round((r / tot) * 100) : null;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 900, color: '#fde047' }}>Câu {idx + 1}</td>
                          <td style={{ padding: '8px 10px', color: '#f8fafc', maxWidth: '380px' }}>
                            {cleanQuestionTitleText(item.q)}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 800, color: '#38bdf8' }}>
                            {item.format === 'TRUE_FALSE'
                              ? 'Dạng II: Đúng/Sai (4 ý)'
                              : item.format === 'SHORT_ANSWER'
                              ? 'Dạng III: Trả lời ngắn'
                              : 'Dạng I: 4 phương án'}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800 }}>
                            <span style={{ color: '#4ade80' }}>✅ {r}</span> / <span style={{ color: '#f87171' }}>❌ {w}</span>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900 }}>
                            {pct === null ? (
                              <span style={{ color: '#94a3b8' }}>Chưa thống kê</span>
                            ) : pct >= 75 ? (
                              <span style={{ color: '#4ade80' }}>{pct}% (Nhận biết/Dễ)</span>
                            ) : pct >= 45 ? (
                              <span style={{ color: '#fde047' }}>{pct}% (Thông hiểu/Vừa)</span>
                            ) : (
                              <span style={{ color: '#f87171' }}>{pct}% (Vận dụng cao/Khó)</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'ANALYTICS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '12px'
                }}
              >
                <div style={{ background: '#111827', border: '2px solid #f59e0b', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', color: '#fde047', fontWeight: 900 }}>🌟 MỨC TỐT (9.0 - 10 ĐIỂM)</div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                    {tierExcellent} học sinh
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>Nắm vững kiến thức & phản xạ xuất sắc</div>
                </div>

                <div style={{ background: '#111827', border: '2px solid #10b981', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', color: '#4ade80', fontWeight: 900 }}>✅ MỨC KHÁ (8.0 - 8.9 ĐIỂM)</div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                    {tierGood} học sinh
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>Hoàn thành tốt yêu cầu cần đạt</div>
                </div>

                <div style={{ background: '#111827', border: '2px solid #38bdf8', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', color: '#7dd3fc', fontWeight: 900 }}>📘 MỨC ĐẠT (6.5 - 7.9 ĐIỂM)</div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                    {tierFair} học sinh
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>Đạt chuẩn kiến thức cơ bản</div>
                </div>

                <div style={{ background: '#111827', border: '2px solid #f43f5e', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', color: '#fda4af', fontWeight: 900 }}>💪 KHUYẾN KHÍCH (&lt; 6.5 ĐIỂM)</div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                    {tierPass} học sinh
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>Cần ôn luyện thêm các câu vận dụng</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 22px',
            background: '#0b1120',
            borderTop: '1.5px solid #1e293b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={onExportHTMLSlide}
              style={{
                padding: '9px 14px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#ffffff',
                border: '1px solid #7dd3fc',
                fontWeight: 900,
                fontSize: '12.5px',
                cursor: 'pointer'
              }}
            >
              🌐 Xuất Học Liệu Số (.HTML)
            </button>

            <button
              onClick={onPrintPDFEvidence}
              style={{
                padding: '9px 14px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#ffffff',
                border: '1px solid #a5b4fc',
                fontWeight: 900,
                fontSize: '12.5px',
                cursor: 'pointer'
              }}
            >
              🖨️ In Hồ Sơ Ma Trận Đề Thi (PDF)
            </button>

            <button
              onClick={() => exportHonorCertificateHTML(matchState, activeRoomId)}
              style={{
                padding: '9px 14px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #d97706, #b45309)',
                color: '#ffffff',
                border: '1px solid #fde047',
                fontWeight: 900,
                fontSize: '12.5px',
                cursor: 'pointer'
              }}
            >
              📜 Xuất Bằng Vinh Danh & Sổ Điểm
            </button>

            {onTriggerDemoBots && (
              <button
                onClick={() => {
                  onTriggerDemoBots();
                  onClose();
                }}
                style={{
                  padding: '9px 14px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  border: '1px solid #6ee7b7',
                  fontWeight: 900,
                  fontSize: '12.5px',
                  cursor: 'pointer'
                }}
              >
                🤖 Bật Giả Lập Lớp Học 3D (Demo)
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              background: '#334155',
              color: '#ffffff',
              border: '1px solid #64748b',
              fontWeight: 900,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Đóng Hướng Dẫn
          </button>
        </div>
      </div>
    </div>
  );
};
