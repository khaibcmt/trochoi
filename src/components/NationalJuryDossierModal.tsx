import React, { useState } from 'react';
import { QuizItem, MatchState, Player } from '../types';
import { cleanQuestionTitleText, getTeacherGradebookScore } from '../data/defaultSubjects';
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
  const [activeTab, setActiveTab] = useState<'ALL_IN_ONE' | 'TEACHER' | 'STUDENT' | 'GAME_MODES' | 'SYNC_BACKUP' | 'GRADEBOOK'>('ALL_IN_ONE');

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
        background: 'rgba(2, 6, 23, 0.90)',
        backdropFilter: 'blur(10px)',
        zIndex: 100005,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.25s ease-out'
      }}
    >
      <div
        style={{
          background: 'linear-gradient(180deg, #090d16 0%, #030712 100%)',
          border: '3px solid #f59e0b',
          borderRadius: '26px',
          maxWidth: '1160px',
          width: '100%',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.85), 0 0 35px rgba(245, 158, 11, 0.25)',
          color: '#ffffff',
          overflow: 'hidden'
        }}
      >
        {/* Header Rực Rỡ & Bắt Mắt - Nút [X] cố định góc trên bên phải, không bao giờ bị rớt dòng */}
        <div
          style={{
            position: 'relative',
            padding: '14px 68px 14px 18px',
            background: 'linear-gradient(90deg, #1e1b4b 0%, #1e293b 45%, #0f172a 100%)',
            borderBottom: '2.5px solid #f59e0b',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              minWidth: '46px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              boxShadow: '0 6px 18px rgba(245, 158, 11, 0.45)',
              border: '2px solid #fef08a'
            }}
          >
            📖
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
              <span
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: '#ffffff',
                  padding: '2px 9px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 900,
                  letterSpacing: '0.4px'
                }}
              >
                CẨM NANG TOÀN DIỆN
              </span>
              <span style={{ fontSize: '12.5px', color: '#38bdf8', fontWeight: 800 }}>
                🌾 Trường THPT Mang Thít • Tác giả: Hồ Tấn Khải
              </span>
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#6ee7b7',
                  border: '1px solid #10b981',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 800
                }}
              >
                Chuẩn GDPT 2018
              </span>
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '17px',
                fontWeight: 900,
                color: '#fef08a',
                lineHeight: 1.3,
                letterSpacing: '0.2px',
                textShadow: '0 2px 8px rgba(0,0,0,0.6)'
              }}
            >
              HƯỚNG DẪN SỬ DỤNG ĐẤU TRƯỜNG 3D: KÉO CO • RUNG CHUÔNG VÀNG • TỐC ĐỘ • DIỆT BOSS
            </h2>
          </div>

          {/* Nút Đóng [X] neo cố định ở góc trên bên phải tuyệt đối */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '50%',
              right: '16px',
              transform: 'translateY(-50%)',
              background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
              border: '2px solid #fca5a5',
              color: '#ffffff',
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              fontSize: '19px',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.5)',
              zIndex: 20
            }}
            title="Đóng cửa sổ hướng dẫn"
          >
            ✕
          </button>
        </div>

        {/* Thanh Chọn Mục Hướng Dẫn: Tự co giãn theo Grid, KHÔNG BỊ THANH CUỘN NGANG CẮT CHỮ */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '8px',
            padding: '10px 16px',
            background: '#030712',
            borderBottom: '2px solid #1f2937'
          }}
        >
          <button
            onClick={() => setActiveTab('ALL_IN_ONE')}
            style={{
              padding: '9px 10px',
              borderRadius: '10px',
              border: activeTab === 'ALL_IN_ONE' ? '2px solid #fde047' : '1px solid #374151',
              background: activeTab === 'ALL_IN_ONE' ? 'linear-gradient(135deg, #d97706, #b45309)' : '#111827',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '13px',
              cursor: 'pointer',
              textAlign: 'center',
              boxShadow: activeTab === 'ALL_IN_ONE' ? '0 4px 12px rgba(217, 119, 6, 0.45)' : 'none'
            }}
          >
            🌟 1. Quy Trình Nhanh
          </button>

          <button
            onClick={() => setActiveTab('TEACHER')}
            style={{
              padding: '9px 10px',
              borderRadius: '10px',
              border: activeTab === 'TEACHER' ? '2px solid #38bdf8' : '1px solid #374151',
              background: activeTab === 'TEACHER' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : '#111827',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '13px',
              cursor: 'pointer',
              textAlign: 'center',
              boxShadow: activeTab === 'TEACHER' ? '0 4px 12px rgba(2, 132, 199, 0.45)' : 'none'
            }}
          >
            👨‍🏫 2. Dành Cho Giáo Viên
          </button>

          <button
            onClick={() => setActiveTab('STUDENT')}
            style={{
              padding: '9px 10px',
              borderRadius: '10px',
              border: activeTab === 'STUDENT' ? '2px solid #4ade80' : '1px solid #374151',
              background: activeTab === 'STUDENT' ? 'linear-gradient(135deg, #059669, #047857)' : '#111827',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '13px',
              cursor: 'pointer',
              textAlign: 'center',
              boxShadow: activeTab === 'STUDENT' ? '0 4px 12px rgba(5, 150, 105, 0.45)' : 'none'
            }}
          >
            📱 3. Dành Cho Học Sinh
          </button>

          <button
            onClick={() => setActiveTab('GAME_MODES')}
            style={{
              padding: '9px 10px',
              borderRadius: '10px',
              border: activeTab === 'GAME_MODES' ? '2px solid #f472b6' : '1px solid #374151',
              background: activeTab === 'GAME_MODES' ? 'linear-gradient(135deg, #db2777, #9d174d)' : '#111827',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '13px',
              cursor: 'pointer',
              textAlign: 'center',
              boxShadow: activeTab === 'GAME_MODES' ? '0 4px 12px rgba(219, 39, 119, 0.45)' : 'none'
            }}
          >
            🎮 4. Thể Lệ 4 Trò Chơi
          </button>

          <button
            onClick={() => setActiveTab('SYNC_BACKUP')}
            style={{
              padding: '9px 10px',
              borderRadius: '10px',
              border: activeTab === 'SYNC_BACKUP' ? '2px solid #a78bfa' : '1px solid #374151',
              background: activeTab === 'SYNC_BACKUP' ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : '#111827',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '13px',
              cursor: 'pointer',
              textAlign: 'center',
              boxShadow: activeTab === 'SYNC_BACKUP' ? '0 4px 12px rgba(124, 58, 237, 0.45)' : 'none'
            }}
          >
            ☁️ 5. Đồng Bộ Đám Mây
          </button>

          <button
            onClick={() => setActiveTab('GRADEBOOK')}
            style={{
              padding: '9px 10px',
              borderRadius: '10px',
              border: activeTab === 'GRADEBOOK' ? '2px solid #fb923c' : '1px solid #374151',
              background: activeTab === 'GRADEBOOK' ? 'linear-gradient(135deg, #ea580c, #c2410c)' : '#111827',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '13px',
              cursor: 'pointer',
              textAlign: 'center',
              boxShadow: activeTab === 'GRADEBOOK' ? '0 4px 12px rgba(234, 88, 12, 0.45)' : 'none'
            }}
          >
            📊 6. Sổ Điểm & BXH
          </button>
        </div>

        {/* Nội Dung Hướng Dẫn Chi Tiết (Chữ To Rõ, Màu Sắc Bắt Mắt, Thanh Cuộn Sleek Mượt) */}
        <div
          className="sleek-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            background: '#090d16'
          }}
        >
          
          {/* TAB 1: TỔNG QUAN TOÀN BỘ QUY TRÌNH (ALL IN ONE) */}
          {activeTab === 'ALL_IN_ONE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* Banner Giới Thiệu Cực Đẹp */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.85), rgba(15, 23, 42, 0.95))',
                  border: '2.5px solid #818cf8',
                  borderRadius: '20px',
                  padding: '20px 24px',
                  boxShadow: '0 8px 24px rgba(99, 102, 241, 0.2)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '28px' }}>🚀</span>
                  <h3 style={{ margin: 0, fontSize: '20px', color: '#fef08a', fontWeight: 900 }}>
                    QUY TRÌNH 3 BƯỚC VẬN HÀNH TIẾT HỌC HOÀN HẢO (CHỈ MẤT 30 GIÂY CHUẨN BỊ)
                  </h3>
                </div>
                <p style={{ margin: 0, fontSize: '15.5px', color: '#e2e8f0', lineHeight: 1.65 }}>
                  Hệ thống Đấu Trường 3D giải quyết trọn vẹn việc biến bài kiểm tra 15 phút, ôn tập giữa kỳ/cuối kỳ thành Game Show truyền hình trực tiếp sôi động. <b>Học sinh không cần cài app</b>, chỉ cần quét mã QR bằng Zalo, Camera hoặc trình duyệt web là lập tức hòa mình vào sàn đấu 3D.
                </p>
              </div>

              {/* 3 Thẻ Bước Vận Hành To Rõ, Màu Bắt Mắt */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
                {/* Bước 1 */}
                <div
                  style={{
                    background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
                    border: '2px solid #38bdf8',
                    borderRadius: '18px',
                    padding: '20px',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.4)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <span
                      style={{
                        background: '#0284c7',
                        color: '#ffffff',
                        width: '36px',
                        height: '36px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '18px'
                      }}
                    >
                      1
                    </span>
                    <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#38bdf8' }}>
                      BƯỚC 1: SOẠN ĐỀ & KIỂM TOÁN AI
                    </h4>
                  </div>
                  <div style={{ fontSize: '15px', color: '#f1f5f9', lineHeight: 1.65 }}>
                    <div style={{ marginBottom: '8px' }}>
                      <b style={{ color: '#fde047' }}>• Nạp đề linh hoạt:</b> Chọn sẵn <b>12 Môn THPT chuẩn</b> hoặc dán đề từ Word/PDF vào <b>3 Khung Dạng Thức Chia Sẵn</b> (Dạng I: 4 lựa chọn, Dạng II: Đúng/Sai chùm, Dạng III: Điền đáp số).
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <b style={{ color: '#4ade80' }}>• Nhận dạng Toán, Lý, Hóa, Sinh & Hình ảnh:</b> Hỗ trợ trọn vẹn công thức LaTeX, KaTeX, ký hiệu <code>{'$\\sqrt{x}$'}</code>, phân số, phương trình phản ứng hóa học (H₂SO₄, ⇌) và sơ đồ hình ảnh trực quan.
                    </div>
                    <div>
                      <b style={{ color: '#f472b6' }}>• 🔍 Kiểm Toán & Báo Lỗi Câu Hỏi (AI Doctor):</b> Quét tự động phát hiện chính xác <i>câu số mấy bị thiếu đáp án, lỗi cú pháp</i> và bấm nút <b>&ldquo;⚡ Tự Động Sửa Toàn Bộ Lỗi&rdquo;</b> chỉ bằng 1 cú nhấp!
                    </div>
                  </div>
                </div>

                {/* Bước 2 */}
                <div
                  style={{
                    background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
                    border: '2px solid #10b981',
                    borderRadius: '18px',
                    padding: '20px',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.4)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <span
                      style={{
                        background: '#059669',
                        color: '#ffffff',
                        width: '36px',
                        height: '36px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '18px'
                      }}
                    >
                      2
                    </span>
                    <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#4ade80' }}>
                      BƯỚC 2: CHỌN TRÒ CHƠI & MỞ SÀN ĐẤU
                    </h4>
                  </div>
                  <div style={{ fontSize: '15px', color: '#f1f5f9', lineHeight: 1.65 }}>
                    <div style={{ marginBottom: '8px' }}>
                      <b style={{ color: '#f87171' }}>• Chế độ 1:</b> ⚔️ <b>Kéo Co 3D</b> (Chia 2 đội Đỏ - Xanh đối kháng kịch tính).
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <b style={{ color: '#fde047' }}>• Chế độ 2:</b> 🔔 <b>Rung Chuông Vàng 3D</b> (Mỗi HS có 3 Tim ❤️, sống sót đến câu cuối).
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <b style={{ color: '#38bdf8' }}>• Chế độ 3:</b> ⚡ <b>Ai Nhanh Nhất</b> (Đua tốc độ cá nhân, phản xạ cực nhanh).
                    </div>
                    <div>
                      <b style={{ color: '#c084fc' }}>• Chế độ 4:</b> 🐉 <b>Diệt Boss Kiến Thức</b> (Cả lớp hợp sức giải toán trừ máu Rồng 3D).
                    </div>
                  </div>
                </div>

                {/* Bước 3 */}
                <div
                  style={{
                    background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
                    border: '2px solid #f59e0b',
                    borderRadius: '18px',
                    padding: '20px',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.4)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <span
                      style={{
                        background: '#d97706',
                        color: '#ffffff',
                        width: '36px',
                        height: '36px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '18px'
                      }}
                    >
                      3
                    </span>
                    <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#fde047' }}>
                      BƯỚC 3: QUÉT QR VÀO NGAY & VẬN HÀNH
                    </h4>
                  </div>
                  <div style={{ fontSize: '15px', color: '#f1f5f9', lineHeight: 1.65 }}>
                    <div style={{ marginBottom: '8px' }}>
                      • <b>Vào phòng trực tiếp & Quét mã vào ngay:</b> Quét QR là vào thẳng <b>Phòng Chờ (WAITING ROOM)</b>, tự cấp tên tạm <code>Thí sinh #...</code>, khóa câu trả lời chống bấm nhầm, nhập tên ngay trong phòng chờ.
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      • <b>Nút của Giáo viên &ldquo;🧲 Kéo học sinh vào phòng chờ&rdquo;:</b> 1-Click kéo 100% học sinh online vào phòng sẵn sàng thi đấu!
                    </div>
                    <div>
                      • <b>Hệ thống 2 BXH & Xuất sổ Thông tư 22:</b> Màn hình trực tiếp hiện Top 10 kèm nút mở rộng xem toàn bộ lớp. Bảng 2 tính điểm chuẩn <code>(Đúng / Tổng câu) * 10</code> làm tròn 1 số lẻ, sắp xếp từ cao xuống thấp để vào sổ vnEdu / SMAS.
                    </div>
                  </div>
                </div>
              </div>

              {/* Hộp Điểm Nhấn Công Nghệ Mới (Nhanh - Bất Ngờ - May Rủi) */}
              <div
                style={{
                  background: 'linear-gradient(90deg, #831843 0%, #311042 50%, #1e1b4b 100%)',
                  border: '2.5px solid #f43f5e',
                  borderRadius: '20px',
                  padding: '20px 24px',
                  boxShadow: '0 8px 24px rgba(244, 63, 94, 0.25)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '26px' }}>🎲</span>
                  <h3 style={{ margin: 0, fontSize: '19px', color: '#fecdd3', fontWeight: 900 }}>
                    TÍNH NĂNG ĐỈNH CAO: NHANH • BẤT NGỜ • MAY RỦI & BẢO TOÀN ĐIỂM SỔ
                  </h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', fontSize: '14.5px', color: '#ffe4e6', lineHeight: 1.6 }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(244,63,94,0.3)' }}>
                    <b style={{ color: '#fef08a' }}>⚡ Tia Chớp Đầu Tiên (+500đ):</b> HS trả lời đúng nhanh nhất lớp nhận vinh danh Tia Chớp và cộng nóng +500 điểm thi đấu.
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(244,63,94,0.3)' }}>
                    <b style={{ color: '#67e8f9' }}>🎲 Cược Bản Lĩnh (Dùng 1 lần):</b> Chọn mức cược trước khi chốt đáp án: <b>An Toàn (x1)</b> • <b>Liều Lĩnh (x1.5 / -300đ)</b> • <b>Tất Tay (x2.5 / -800đ)</b>.
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(244,63,94,0.3)' }}>
                    <b style={{ color: '#a7f3d0' }}>🎁 Rương Bí Ẩn (Streak = 5, dùng 1 lần):</b> Trả lời đúng liên tiếp 5 câu, có 4s chọn 1 trong 3 rương: Nổ Hũ +1500đ, Đạo chích hút 500đ Top 1, Tim hồi sinh, Khiên bất tử!
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(244,63,94,0.3)' }}>
                    <b style={{ color: '#fed7aa' }}>📊 Chuẩn Thông Tư 22/BGDĐT:</b> Thang điểm 10 = <code>(Đúng / Tổng câu) * 10</code> làm tròn 1 số lẻ, xếp thứ tự từ cao xuống thấp để vào sổ vnEdu / SMAS.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HƯỚNG DẪN DÀNH CHO GIÁO VIÊN */}
          {activeTab === 'TEACHER' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.2), rgba(15, 23, 42, 0.9))',
                  border: '2.5px solid #0284c7',
                  borderRadius: '20px',
                  padding: '20px 24px'
                }}
              >
                <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', color: '#38bdf8', fontWeight: 900 }}>
                  👨‍🏫 HƯỚNG DẪN ĐẦY ĐỦ DÀNH CHO GIÁO VIÊN SOẠN BÀI & DẠY HỌC
                </h3>
                <p style={{ margin: 0, fontSize: '15px', color: '#e2e8f0', lineHeight: 1.65 }}>
                  Giao diện Giáo viên được thiết kế chuyên biệt để hỗ trợ cấu trúc đề thi <b>3 Dạng thức chuẩn GDPT 2018</b> (Quyết định 764/QĐ-BGDĐT), nhận diện chuyên sâu Toán - Lý - Hóa - Sinh và quản lý điểm số theo <b>Thông tư 22/2021/TT-BGDĐT</b>.
                </p>
              </div>

              {/* Chi Tiết Từng Tính Năng Giáo Viên */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* 1. Bộ 3 Khung Dạng Thức & Nhận diện STEM */}
                <div style={{ background: '#111827', border: '2px solid #334155', borderRadius: '16px', padding: '18px 22px' }}>
                  <div style={{ fontSize: '17px', fontWeight: 900, color: '#fde047', marginBottom: '8px' }}>
                    1️⃣ Bộ 3 Khung Soạn Đề Riêng Biệt & Nhận Diện Công Thức Toán - Lý - Hóa - Sinh
                  </div>
                  <div style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: 1.65 }}>
                    • <b>Khung Dạng thức I (4 lựa chọn):</b> Dành cho câu hỏi trắc nghiệm truyền thống A, B, C, D có 1 đáp án đúng duy nhất. Giáo viên gạch chân <u>A</u> hoặc tô đậm <b>A</b> để hệ thống tự nhận diện đáp án đúng.<br />
                    • <b>Khung Dạng thức II (Đúng/Sai chùm):</b> Mỗi câu gồm 4 mệnh đề a, b, c, d. Giáo viên ghi chú <code>(Đúng)</code> hoặc <code>(Sai)</code> ở cuối dòng mệnh đề.<br />
                    • <b>Khung Dạng thức III (Trả lời ngắn):</b> Học sinh tự điền số hoặc từ khóa (ví dụ: <code>Đáp án: 12.5</code>).<br />
                    • <b>Nhận diện sơ đồ, hình ảnh & công thức khoa học (LaTeX, KaTeX, Phản ứng hóa học):</b> Hỗ trợ trọn vẹn các công thức toán học (<code>{'$\\sqrt{x}$'}</code>, <code>{'$\\frac{a}{b}$'}</code>, <code>{'$\\int$'}</code>), phương trình phản ứng hóa học (H₂SO₄, ⇌, chỉ số trên dưới) và thẻ hình ảnh minh họa <code>&lt;img src="..." /&gt;</code>.<br />
                    • <b>Lọc sạch rác Word/PDF:</b> Khi copy từ Word hoặc Zalo, hệ thống tự động bóc sạch các mã rác như <code>font-family, mso-, span</code> và tự ngắt dòng A. B. C. D. thông minh.
                  </div>
                </div>

                {/* 2. Soạn Đề Bằng AI & Kiểm Toán Lỗi */}
                <div style={{ background: '#111827', border: '2px solid #818cf8', borderRadius: '16px', padding: '18px 22px' }}>
                  <div style={{ fontSize: '17px', fontWeight: 900, color: '#a5b4fc', marginBottom: '8px' }}>
                    2️⃣ AI Soạn Đề Tự Động & &ldquo;🔍 Kiểm Toán &amp; Báo Lỗi Câu Hỏi&rdquo; (AI Doctor &amp; STEM Auditor)
                  </div>
                  <div style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: 1.65 }}>
                    • Bấm <b>&ldquo;🤖 AI Soạn Đề 3 Dạng Thức&rdquo;</b>: Nhập chủ đề (ví dụ: <i>&ldquo;Quang hợp ở thực vật C3, C4, CAM&rdquo;</i> hoặc <i>&ldquo;Cực trị hàm số&rdquo;</i>) và chọn mức độ nhận thức. AI sẽ tự tạo bộ câu hỏi hoàn chỉnh.<br />
                    • Bấm <b>&ldquo;📸 AI Quét Đề Từ Ảnh / Văn Bản&rdquo;</b>: Tải ảnh chụp trang sách hoặc đề in trên giấy, AI tự động OCR và nạp vào 3 khung.<br />
                    • <b>🔍 Tính năng Kiểm Toán &amp; Báo Lỗi Câu Hỏi (AI Doctor):</b> Bấm <b>&ldquo;🔍 Kiểm Toán &amp; Báo Lỗi&rdquo;</b> để hệ thống quét toàn diện đề thi. Nếu phát hiện câu nào thiếu đáp án, sai mệnh đề hoặc lỗi cú pháp, màn hình sẽ chỉ rõ <i>&ldquo;Câu X bị lỗi Y&rdquo;</i> kèm nút <b>&ldquo;⚡ Tự Động Sửa Toàn Bộ Lỗi&rdquo;</b> để sửa chuẩn trong 1 giây!
                  </div>
                </div>

                {/* 3. Điều Khiển Sân Đấu & Nút Kéo Học Sinh */}
                <div style={{ background: '#111827', border: '2px solid #10b981', borderRadius: '16px', padding: '18px 22px' }}>
                  <div style={{ fontSize: '17px', fontWeight: 900, color: '#6ee7b7', marginBottom: '8px' }}>
                    3️⃣ Đồng Bộ 100% Câu Hỏi • Nút Kéo Học Sinh &amp; Khóa/Mở Đáp Án Đồng Loạt
                  </div>
                  <div style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: 1.65 }}>
                    • <b>🔒 Tự động che &amp; khóa đáp án khi chưa bắt đầu:</b> Khi Giáo viên chưa nhấn <b>&ldquo;🚀 BẮT ĐẦU TRẬN ĐẤU&rdquo;</b>, toàn bộ đáp án trên điện thoại của học sinh đều được che và khóa an toàn tuyệt đối (đã xóa bỏ hoàn toàn nút tự ý vào mở đáp án trước giờ thi).<br />
                    • <b>🚀 Bấm Bắt Đầu kéo 100% học sinh đồng loạt:</b> Ngay khi Giáo viên nhấn nút <b>&ldquo;🚀 BẮT ĐẦU TRẬN ĐẤU&rdquo;</b>, hệ thống tự động kéo 100% học sinh từ Sảnh và Phòng chờ vào phòng thi, mở khóa đáp án và đồng bộ cùng 1 câu hỏi tại cùng 1 thời điểm.<br />
                    • <b>🔄 Đồng bộ câu hỏi tuyệt đối giữa Giáo viên &amp; Học sinh:</b> Học sinh sau khi chốt đáp án sẽ đợi Thầy/Cô chuyển câu để cả lớp luôn làm cùng 1 câu hỏi với màn hình máy chiếu, không bao giờ xảy ra lệch câu hỏi.<br />
                    • <b>🧲 Nút &ldquo;Kéo HS Vào Chờ&rdquo; (1-Click):</b> Nằm ngay trên thanh điều khiển phòng đấu giúp kéo toàn bộ học sinh vào phòng chờ chuẩn bị sẵn sàng trước giờ G.<br />
                    • <b>🔊 Đọc Đề Tự Động &amp; 💡 AI Giải Thích:</b> Giọng MC đọc to câu hỏi và AI giải thích bản chất kiến thức kèm mẹo nhớ nhanh sau mỗi câu.
                  </div>
                </div>

                {/* 4. Sổ Điểm & Bảng Xếp Hạng Chuẩn Thông Tư 22/BGDĐT */}
                <div style={{ background: '#111827', border: '2px solid #f59e0b', borderRadius: '16px', padding: '18px 22px' }}>
                  <div style={{ fontSize: '17px', fontWeight: 900, color: '#fde047', marginBottom: '8px' }}>
                    4️⃣ Hệ Thống 2 Bảng Xếp Hạng &amp; Sổ Điểm Giáo Viên (Thông Tư 22/BGDĐT)
                  </div>
                  <div style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: 1.65 }}>
                    • <b>Bảng 1 (BXH Trò Chơi):</b> Giữ nguyên cấu trúc, tính điểm tốc độ, cược bản lĩnh, streak, rương thưởng để vinh danh Top 1, 2, 3 trao giải thưởng.<br />
                    • <b>Bảng 2 (BXH GV Ghi Điểm):</b> Tính điểm theo chuẩn Thông tư 22/BGDĐT: Thang điểm 10 = <code>(Số câu đúng / Tổng câu) * 10</code> làm tròn 1 chữ số thập phân. Xếp thứ tự thực tế từ cao xuống thấp để giáo viên dễ dàng ghi vào sổ điểm vnEdu hoặc SMAS.<br />
                    • <b>Thống kê đủ 100% học sinh:</b> Cả 2 bảng đều lưu trữ trọn vẹn 100% học sinh tham gia phòng thi.<br />
                    • <b>Hiển thị trực tiếp Top 10:</b> Màn hình chính mặc định hiện Top 10 học sinh xuất sắc nhất kèm nút mở rộng xem toàn bộ lớp.<br />
                    • <b>1-Click Sao chép &amp; Xuất dữ liệu:</b> Bấm nút sao chép để dán ngay vào Excel / Google Sheets, xuất file CSV và in bằng khen danh dự!
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HƯỚNG DẪN DÀNH CHO HỌC SINH */}
          {activeTab === 'STUDENT' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.25), rgba(15, 23, 42, 0.9))',
                  border: '2.5px solid #10b981',
                  borderRadius: '20px',
                  padding: '20px 24px'
                }}
              >
                <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', color: '#6ee7b7', fontWeight: 900 }}>
                  📱 HƯỚNG DẪN DÀNH CHO HỌC SINH THI ĐẤU TRÊN ĐIỆN THOẠI
                </h3>
                <p style={{ margin: 0, fontSize: '15px', color: '#e2e8f0', lineHeight: 1.65 }}>
                  Giao diện học sinh được tối ưu cho mọi kích thước màn hình điện thoại (iOS, Android, máy tính bảng), hỗ trợ phím bấm to, phản hồi rung âm thanh và đồ họa 3D sống động.
                </p>
              </div>

              {/* Banner Chú Ý Đặc Biệt: Mỗi học sinh chỉ dùng 1 lần duy nhất */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.25), rgba(245, 158, 11, 0.25))',
                  border: '2.5px solid #f59e0b',
                  borderRadius: '18px',
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  boxShadow: '0 8px 24px rgba(245, 158, 11, 0.2)'
                }}
              >
                <span style={{ fontSize: '32px' }}>⚡</span>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#fef08a' }}>
                    QUY TẮC ĐẶC BIỆT: CÁC CƠ CHẾ NÀY MỖI HỌC SINH CHỈ DÙNG 1 LẦN DUY NHẤT TRONG TẤT CẢ CÁC TRÒ CHƠI!
                  </div>
                  <div style={{ fontSize: '13.5px', color: '#cbd5e1', marginTop: '3px', lineHeight: 1.5 }}>
                    Cả <b>Cơ Chế Cược Bản Lĩnh</b> và <b>Mở Rương Bí Ẩn Định Mệnh</b> đều được giới hạn đúng <b>1 lần duy nhất</b> cho mỗi học sinh trong cả trận đấu. Hãy lựa chọn thời điểm chiến lược để lật ngược thế cờ!
                  </div>
                </div>
              </div>

              {/* Các Bước Dành Cho Học Sinh */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '16px' }}>
                <div style={{ background: '#111827', border: '2px solid #38bdf8', borderRadius: '16px', padding: '18px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#38bdf8', marginBottom: '8px' }}>
                    1. Quét Mã Vào Phòng Chờ &amp; Bắt Buộc Điền Tên Lưu Lại Mới Được Chơi
                  </div>
                  <div style={{ fontSize: '14.5px', color: '#cbd5e1', lineHeight: 1.6 }}>
                    • <b>Quét mã QR vào thẳng Phòng Chờ:</b> Dùng Zalo hoặc Camera quét mã là vào ngay <b>Phòng Chờ (WAITING ROOM)</b>.<br />
                    • <b>⚠️ Bắt buộc điền Họ &amp; Tên thật và bấm Lưu lại:</b> Học sinh bắt buộc phải nhập Họ Tên thật và nhấn nút <b>&ldquo;💾 LƯU TÊN&rdquo;</b> mới được phép mở khóa trả lời câu hỏi.<br />
                    • <b>🔒 Che &amp; khóa đáp án khi GV chưa bắt đầu:</b> Khi Thầy/Cô chưa nhấn Bắt đầu, toàn bộ các đáp án đều bị che và khóa lại để đảm bảo công bằng.<br />
                    • <b>🚀 Tự động mở khóa 100% khi GV nhấn Bắt đầu:</b> Ngay khi Thầy/Cô bấm nút Bắt đầu, 100% học sinh được kéo tự động vào câu hỏi, mở đáp án và đồng bộ toàn diện với màn hình Giáo viên.
                  </div>
                </div>

                <div style={{ background: '#111827', border: '2px solid #10b981', borderRadius: '16px', padding: '18px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#4ade80', marginBottom: '8px' }}>
                    2. Chống Văng Mạng &amp; Tự Động Khôi Phục Phiên Đấu 100%
                  </div>
                  <div style={{ fontSize: '14.5px', color: '#cbd5e1', lineHeight: 1.6 }}>
                    • <b>Cơ chế lưu trữ kép bảo toàn:</b> Tích hợp công nghệ sao lưu kép (<code>localStorage + sessionStorage</code>) bảo vệ an toàn 100% phiên đấu của học sinh.<br />
                    • <b>Bảo toàn điểm số khi gặp sự cố:</b> Dù bạn vô tình tắt mở màn hình, xoay máy, chuyển sang ứng dụng khác, reload trang hay mạng 3G/4G yếu: Khi mở lại, hệ thống sẽ tự động khôi phục đúng phòng, bảo toàn nguyên vẹn <b>điểm số, số câu đúng, streak và cược bản lĩnh</b>.<br />
                    • <b>Nút &ldquo;⚡ Kết Nối Ngay&rdquo;:</b> Nếu thanh trạng thái báo kết nối chậm, chỉ cần bấm nút này để tái kết nối tức thì.
                  </div>
                </div>

                <div style={{ background: '#111827', border: '2px solid #f43f5e', borderRadius: '16px', padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '16.5px', fontWeight: 900, color: '#fda4af' }}>
                      3. Cơ Chế Cược Bản Lĩnh Trước Khi Chốt
                    </div>
                    <span style={{ fontSize: '11px', background: '#dc2626', color: '#fff', padding: '2px 8px', borderRadius: '999px', fontWeight: 900 }}>
                      Dùng 1 Lần Duy Nhất
                    </span>
                  </div>
                  <div style={{ fontSize: '14.5px', color: '#cbd5e1', lineHeight: 1.65 }}>
                    Trước khi bấm chọn đáp án, học sinh có thể chọn mức cược chiến thuật:<br />
                    • <b>🛡️ An Toàn (x1):</b> Đúng cộng điểm chuẩn, sai không bị trừ điểm (mức mặc định).<br />
                    • <b>⚡ Liều Lĩnh (x1.5):</b> Đúng nhân 1.5x điểm (+1.500đ), sai bị trừ <b>-300đ</b>.<br />
                    • <b>🔥 Tất Tay (x2.5):</b> Đúng nhân 2.5x điểm (+2.500đ), sai bị trừ <b>-800đ</b> (dành cho bạn tự tin 100% để bứt phá lên Top 1)!<br />
                    <span style={{ color: '#fde047', fontWeight: 800 }}>
                      ⚠️ Lưu ý quan trọng: Mỗi học sinh chỉ được chọn Liều Lĩnh hoặc Tất Tay đúng 1 lần duy nhất trong cả trận đấu. Sau lượt cược này, hệ thống tự động khóa và trở về An Toàn (x1)!
                    </span>
                  </div>
                </div>

                <div style={{ background: '#111827', border: '2px solid #f59e0b', borderRadius: '16px', padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '16.5px', fontWeight: 900, color: '#fde047' }}>
                      4. Mở Rương Bí Ẩn Định Mệnh
                    </div>
                    <span style={{ fontSize: '11px', background: '#d97706', color: '#fff', padding: '2px 8px', borderRadius: '999px', fontWeight: 900 }}>
                      Streak = 5 • 4 Giây Chọn
                    </span>
                  </div>
                  <div style={{ fontSize: '14.5px', color: '#cbd5e1', lineHeight: 1.65 }}>
                    <b style={{ color: '#f87171' }}>• Điều kiện bắt buộc:</b> Phải trả lời đúng <b>liên tiếp 5 câu</b> (Streak = 5) mới được kích hoạt (mỗi học sinh chỉ mở đúng 1 lần duy nhất cả trận).<br />
                    • Xuất hiện <b>3 Rương Kho Báu</b>, đếm ngược <b>4 giây</b> để bạn chạm chọn 1 rương ngẫu nhiên:<br />
                    &nbsp;&nbsp;💎 <b>Nổ Hũ Kim Cương:</b> +1.500 điểm thưởng.<br />
                    &nbsp;&nbsp;🥷 <b>Đạo Chích:</b> +900đ và hút 500đ của bạn đang dẫn đầu Top 1.<br />
                    &nbsp;&nbsp;💖 <b>Tim Vàng:</b> +1 Mạng hồi sinh trong Rung Chuông Vàng.<br />
                    &nbsp;&nbsp;🛡️ <b>Khiên Bất Tử:</b> Bảo vệ bạn tuyệt đối không bị trừ điểm nếu câu sau trả lời sai!
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: THỂ LỆ 4 TRÒ CHƠI & YẾU TỐ KỊCH TÍNH */}
          {activeTab === 'GAME_MODES' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(219, 39, 119, 0.25), rgba(15, 23, 42, 0.9))',
                  border: '2.5px solid #db2777',
                  borderRadius: '20px',
                  padding: '20px 24px'
                }}
              >
                <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', color: '#f472b6', fontWeight: 900 }}>
                  🎮 THỂ LỆ CHI TIẾT 4 CHẾ ĐỘ CHƠI & CƠ CHẾ ĐẤU TRƯỜNG QUỐC TẾ
                </h3>
                <p style={{ margin: 0, fontSize: '15px', color: '#e2e8f0', lineHeight: 1.65 }}>
                  Mỗi chế độ mang một triết lý sư phạm riêng biệt, từ tinh thần đồng đội hợp tác đến bản lĩnh cá nhân và tư duy tốc độ.
                </p>
              </div>

              {/* 4 Chế Độ Chơi Thẻ Chi Tiết */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {/* Mode 1: TUG */}
                <div style={{ background: '#111827', border: '2px solid #ef4444', borderRadius: '16px', padding: '18px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#f87171', marginBottom: '8px' }}>
                    ⚔️ 1. KÉO CO 3D (ĐỐI KHÁNG ĐỒNG ĐỘI)
                  </div>
                  <div style={{ fontSize: '14.5px', color: '#cbd5e1', lineHeight: 1.6 }}>
                    • Học sinh được chia vào <b>Đội Đỏ</b> và <b>Đội Xanh</b>.<br />
                    • Mỗi câu trả lời đúng của từng thành viên sẽ tạo lực kéo sợi dây về phía đội mình.<br />
                    • Đội nào kéo dây qua vạch quy định sẽ giành chiến thắng hiệp đấu.<br />
                    • Chuỗi đúng 3 câu mở khóa <b>Thẻ Kỹ Năng</b>: Đóng băng đối thủ, Khiên chắn, Nhân đôi lực kéo!
                  </div>
                </div>

                {/* Mode 2: BELL */}
                <div style={{ background: '#111827', border: '2px solid #f59e0b', borderRadius: '16px', padding: '18px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#fde047', marginBottom: '8px' }}>
                    🔔 2. RUNG CHUÔNG VÀNG (SỐNG SÓT ĐẾN CÙNG)
                  </div>
                  <div style={{ fontSize: '14.5px', color: '#cbd5e1', lineHeight: 1.6 }}>
                    • Mỗi thí sinh bắt đầu với <b>3 Trái Tim Sinh Mệnh (3 ❤️)</b>.<br />
                    • Trả lời sai trừ 1 ❤️. Khi mất hết 3 ❤️, nhân vật sẽ <b>tự động ẩn khỏi sân khấu 3D</b> để nhường chỗ cho các bạn còn lại và chuyển sang ghế Khán giả.<br />
                    • Giáo viên có thể bấm <b>&ldquo;🆘 Phao Cứu Trợ&rdquo;</b> hoặc quay <b>Phép Màu</b> để hồi sinh toàn bộ thí sinh quay lại sàn đấu!
                  </div>
                </div>

                {/* Mode 3: FAST */}
                <div style={{ background: '#111827', border: '2px solid #0284c7', borderRadius: '16px', padding: '18px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#38bdf8', marginBottom: '8px' }}>
                    ⚡ 3. ĐƯỜNG ĐUA TỐC ĐỘ (PHẢN XẠ CÁ NHÂN)
                  </div>
                  <div style={{ fontSize: '14.5px', color: '#cbd5e1', lineHeight: 1.6 }}>
                    • Đua điểm cá nhân toàn diện trên bảng xếp hạng trực tiếp.<br />
                    • Đúng trong <b>≤ 5 giây:</b> Thưởng nóng <b>+300đ</b>.<br />
                    • Đúng trong <b>≤ 10 giây:</b> Thưởng nóng <b>+150đ</b>.<br />
                    • Trả lời đúng đầu tiên toàn phòng nhận danh hiệu <b>⚡ Tia Chớp Đầu Tiên (+500đ)</b>.<br />
                    • Trả lời sai bị trừ điểm nếu chọn cược Liều Lĩnh / Tất Tay.
                  </div>
                </div>

                {/* Mode 4: BOSS */}
                <div style={{ background: '#111827', border: '2px solid #a855f7', borderRadius: '16px', padding: '18px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#c084fc', marginBottom: '8px' }}>
                    🐉 4. DIỆT BOSS HẮC ÁM (CO-OP RAID)
                  </div>
                  <div style={{ fontSize: '14.5px', color: '#cbd5e1', lineHeight: 1.6 }}>
                    • Cả lớp cùng đoàn kết đánh bại <b>Quái Vật Rồng Hắc Ám 3D</b>.<br />
                    • Mỗi câu trả lời đúng bắn một luồng năng lượng trừ máu Boss.<br />
                    • Boss có các pha cuồng nộ và triệu hồi khiên chắn khi máu xuống dưới 50%.<br />
                    • Thúc đẩy tinh thần &ldquo;Không bỏ lại bất kỳ học sinh nào phía sau&rdquo;!
                  </div>
                </div>
              </div>

              {/* 2 CƠ CHẾ ĐẶC BIỆT ÁP DỤNG XUYÊN SUỐT CẢ 4 TRÒ CHƠI */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 27, 75, 0.95))',
                  border: '2.5px solid #f59e0b',
                  borderRadius: '18px',
                  padding: '18px 22px',
                  boxShadow: '0 8px 25px rgba(245, 158, 11, 0.25)'
                }}
              >
                <div style={{ fontSize: '17px', fontWeight: 900, color: '#fde047', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>⚡ 2 CƠ CHẾ ĐẶC BIỆT TOÀN DIỆN: MỖI HỌC SINH CHỈ DÙNG 1 LẦN DUY NHẤT TRONG CẢ TRẬN ĐẤU!</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginTop: '10px' }}>
                  <div style={{ background: '#0b0f19', border: '1.5px solid #ef4444', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ color: '#fda4af', fontWeight: 900, fontSize: '15px', marginBottom: '6px' }}>
                      🎲 1. Cược Bản Lĩnh Trước Khi Chốt (Dùng 1 Lần Duy Nhất):
                    </div>
                    <div style={{ fontSize: '13.5px', color: '#cbd5e1', lineHeight: 1.55 }}>
                      • <b>🛡️ An Toàn (x1):</b> Sai không bị trừ điểm (mặc định an tâm).<br />
                      • <b>⚡ Liều Lĩnh (x1.5):</b> Đúng nhân 1.5x điểm (+1.500đ), sai bị trừ <b>-300đ</b>.<br />
                      • <b>🔥 Tất Tay (x2.5):</b> Đúng nhân 2.5x điểm (+2.500đ), sai bị trừ <b>-800đ</b> (dành cho bạn tự tin 100% để lật kèo)!<br />
                      <i>* Sau khi dùng 1 lần, các câu sau hệ thống tự động khóa và trở về An Toàn (x1).</i>
                    </div>
                  </div>

                  <div style={{ background: '#0b0f19', border: '1.5px solid #f59e0b', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ color: '#fde047', fontWeight: 900, fontSize: '15px', marginBottom: '6px' }}>
                      🎁 2. Mở Rương Bí Ẩn Định Mệnh (Streak = 5, Đếm Ngược 4s Chọn, Dùng 1 Lần):
                    </div>
                    <div style={{ fontSize: '13.5px', color: '#cbd5e1', lineHeight: 1.55 }}>
                      Khi trả lời đúng 5 câu liên tiếp, học sinh có 4 giây để chọn 1 trong 3 rương bí ẩn:<br />
                      • 💎 <b>Nổ Hũ Kim Cương:</b> +1.500 điểm thưởng.<br />
                      • 🥷 <b>Đạo Chích:</b> +900đ và hút 500đ của đối thủ đang Top 1.<br />
                      • 💖 <b>Tim Vàng:</b> +1 Mạng hồi sinh trong Rung Chuông Vàng.<br />
                      • 🛡️ <b>Khiên Bất Tử:</b> Bảo vệ bạn không bị trừ điểm nếu câu sau trả lời sai!
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ĐỒNG BỘ GOOGLE & MẬT KHẨU ẨN DANH */}
          {activeTab === 'SYNC_BACKUP' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.25), rgba(15, 23, 42, 0.9))',
                  border: '2.5px solid #7c3aed',
                  borderRadius: '20px',
                  padding: '20px 24px'
                }}
              >
                <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', color: '#c4b5fd', fontWeight: 900 }}>
                  ☁️ TÍNH NĂNG ĐỒNG BỘ ĐÁM MÂY ĐA THIẾT BỊ (SOẠN Ở NHÀ – DẠY Ở TRƯỜNG)
                </h3>
                <p style={{ margin: 0, fontSize: '15px', color: '#e2e8f0', lineHeight: 1.65 }}>
                  Giúp giáo viên chuẩn bị bài giảng, ngân hàng câu hỏi tùy chỉnh ở nhà trên máy tính cá nhân. Khi mang laptop đến trường hoặc dùng máy tính của phòng máy/máy chiếu, chỉ cần 1 thao tác là toàn bộ dữ liệu tự động đồng bộ ngay lập tức!
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
                {/* Cách 1: Google Sync */}
                <div style={{ background: '#111827', border: '2px solid #3b82f6', borderRadius: '18px', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '28px' }}>🌐</span>
                    <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#60a5fa' }}>
                      CÁCH 1: ĐỒNG BỘ TÀI KHOẢN GOOGLE
                    </h4>
                  </div>
                  <div style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: 1.65 }}>
                    • Bấm nút <b>&ldquo;☁️ Đồng Bộ Google&rdquo;</b> ở đầu trang.<br />
                    • Nhập email Google của Thầy/Cô (ví dụ: <code>khaibcmt@gmail.com</code>).<br />
                    • <b>Tại máy ở nhà:</b> Bấm <b>&ldquo;☁️ Sao Lưu Lên Google&rdquo;</b>.<br />
                    • <b>Tại máy ở trường:</b> Bấm <b>&ldquo;🔄 Tải &amp; Đồng Bộ Về Máy Này&rdquo;</b>.<br />
                    • Bật tùy chọn <b>&ldquo;⚡ Tự động sao lưu&rdquo;</b> để mỗi khi sửa câu hỏi, dữ liệu sẽ tự động đẩy lên đám mây mà không cần nhớ sao lưu thủ công.
                  </div>
                </div>

                {/* Cách 2: Password Sync */}
                <div style={{ background: '#111827', border: '2px solid #f59e0b', borderRadius: '18px', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '28px' }}>🔑</span>
                    <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#fde047' }}>
                      CÁCH 2: NHẬP MẬT KHẨU ĐỒNG BỘ (ẨN DANH)
                    </h4>
                  </div>
                  <div style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: 1.65 }}>
                    • <b>Dành cho máy lạ ở trường hoặc Tab Ẩn Danh:</b> Thầy/Cô không muốn đăng nhập tài khoản Google cá nhân vì sợ lộ mật khẩu.<br />
                    • Bấm nút <b>&ldquo;🔑 Nhập Mật Khẩu Đồng Bộ (Ẩn Danh)&rdquo;</b>.<br />
                    • <b>Tại máy ở nhà:</b> Đặt một mật khẩu cá nhân dễ nhớ (ví dụ: <code>thpt-sinh12</code>) rồi bấm <b>&ldquo;🔒 Sao Lưu Bằng Mật Khẩu&rdquo;</b>.<br />
                    • <b>Tại máy trường:</b> Chỉ cần nhập đúng mật khẩu đó và bấm <b>&ldquo;⚡ Nhập Mật Khẩu &amp; Đồng Bộ&rdquo;</b> là xong ngay trong 1 giây!
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: 2 BẢNG XẾP HẠNG & SỔ ĐIỂM GIÁO VIÊN */}
          {activeTab === 'GRADEBOOK' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.25), rgba(15, 23, 42, 0.9))',
                  border: '2.5px solid #ea580c',
                  borderRadius: '20px',
                  padding: '20px 24px'
                }}
              >
                <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', color: '#fed7aa', fontWeight: 900 }}>
                  📊 HỆ THỐNG 2 BẢNG XẾP HẠNG & QUY ĐỔI ĐIỂM SỐ GHI SỔ (THÔNG TƯ 22)
                </h3>
                <p style={{ margin: 0, fontSize: '15px', color: '#e2e8f0', lineHeight: 1.65 }}>
                  Một sáng kiến sư phạm độc đáo: Tách biệt rạch ròi giữa <b>Điểm Thi Đấu Game Show</b> (có trừ điểm câu sai để tăng kịch tính) và <b>Điểm Số Thực Học Để Ghi Sổ Điểm</b> (học sinh tích cực tham gia và có câu đúng luôn được bảo vệ quyền lợi!).
                </p>
              </div>

              {/* 2 Bảng Xếp Hạng So Sánh */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
                <div style={{ background: '#111827', border: '2px solid #e11d48', borderRadius: '18px', padding: '20px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#fb7185', marginBottom: '8px' }}>
                    🏆 BẢNG 1: TỔNG ĐIỂM THI ĐẤU (GAME SHOW)
                  </div>
                  <div style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: 1.65 }}>
                    • Tính điểm dựa trên: Câu đúng, tốc độ trả lời (Reflex Speed Bonus), hệ số Cược Bản Lĩnh (x1, x1.5, x2.5), Tia Chớp Đầu Tiên (+500đ) và Rương Kho Báu.<br />
                    • Có trừ điểm khi cược sai để kích thích tính toán chiến thuật và hồi hộp.<br />
                    • Dùng để <b>Vinh danh trao thưởng</b> (Huy chương Vàng, Bạc, Đồng) và tạo không khí bùng nổ trong lớp học!
                  </div>
                </div>

                <div style={{ background: '#111827', border: '2px solid #10b981', borderRadius: '18px', padding: '20px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#4ade80', marginBottom: '8px' }}>
                    📒 BẢNG 2: SỔ ĐIỂM GIÁO VIÊN (THÔNG TƯ 22/BGDĐT)
                  </div>
                  <div style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: 1.65 }}>
                    • <b>Tuyệt đối không bị trừ điểm câu sai:</b> Đánh giá năng lực thực chất dựa trên tổng số câu học sinh làm đúng.<br />
                    • <b>Công thức chuẩn Thông tư 22/2021/TT-BGDĐT:</b> Tất cả trả về thang điểm 10 theo công thức: <code>Điểm = Làm tròn 1 số lẻ ((Số câu đúng / Tổng câu) * 10)</code>.<br />
                    &nbsp;&nbsp;⭐ Đúng 12/12 câu: <b>10.0 điểm</b><br />
                    &nbsp;&nbsp;⭐ Đúng 10/12 câu: <b>8.3 điểm</b><br />
                    &nbsp;&nbsp;⭐ Đúng 9/12 câu: <b>7.5 điểm</b><br />
                    &nbsp;&nbsp;⭐ Đúng 8/12 câu: <b>6.7 điểm</b><br />
                    &nbsp;&nbsp;⭐ Đúng 7/12 câu: <b>5.8 điểm</b><br />
                    &nbsp;&nbsp;⭐ Đúng 6/12 câu: <b>5.0 điểm</b><br />
                    • <b>Xếp thứ tự thực tế từ cao xuống thấp:</b> Giúp giáo viên chỉ việc mở sổ điểm điện tử <b>vnEdu</b> hoặc <b>SMAS</b> và vào điểm ngay lập tức.<br />
                    • <b>Thống kê 100% học sinh:</b> Cả 2 BXH đều lấy trọn vẹn toàn bộ học sinh tham gia, không bỏ sót bất kỳ em nào.<br />
                    • <b>Hiển thị trực tiếp Top 10:</b> Màn hình thi đấu ưu tiên hiện Top 10 dẫn đầu để vinh danh và giữ màn hình thông thoáng, kèm nút chuyển đổi xem đầy đủ 100% học sinh.<br />
                    • <b>1-Click Sao chép vào Excel:</b> Nút <b>&ldquo;📋 Sao Chép Bảng Điểm&rdquo;</b> dán tức thì vào Excel/Sheets, kèm nút <b>&ldquo;💾 Xuất File CSV&rdquo;</b> và <b>&ldquo;📜 In Minh Chứng&rdquo;</b>!
                  </div>
                </div>
              </div>

              {/* Bảng Thống Kê Phổ Điểm Thực Tế Của Lớp */}
              <div style={{ background: '#111827', border: '1.5px solid #374151', borderRadius: '18px', padding: '20px' }}>
                <div style={{ fontSize: '17px', fontWeight: 900, color: '#fef08a', marginBottom: '12px' }}>
                  📈 PHỔ ĐIỂM HIỆN TẠI CỦA PHÒNG THI ({allPlayers.length} HỌC SINH ĐÃ THAM GIA):
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                  <div style={{ background: '#1e293b', border: '1.5px solid #f59e0b', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ fontSize: '12.5px', color: '#fde047', fontWeight: 900 }}>🌟 MỨC TỐT (9.0 - 10đ)</div>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                      {tierExcellent} học sinh
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Xuất sắc, tư duy vững vàng</div>
                  </div>

                  <div style={{ background: '#1e293b', border: '1.5px solid #10b981', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ fontSize: '12.5px', color: '#4ade80', fontWeight: 900 }}>✅ MỨC KHÁ (8.0 - 8.9đ)</div>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                      {tierGood} học sinh
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Đạt chuẩn kiến thức nâng cao</div>
                  </div>

                  <div style={{ background: '#1e293b', border: '1.5px solid #38bdf8', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ fontSize: '12.5px', color: '#7dd3fc', fontWeight: 900 }}>📘 MỨC ĐẠT (6.5 - 7.9đ)</div>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                      {tierFair} học sinh
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Nắm kiến thức cơ bản</div>
                  </div>

                  <div style={{ background: '#1e293b', border: '1.5px solid #f43f5e', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ fontSize: '12.5px', color: '#fda4af', fontWeight: 900 }}>💪 KHUYẾN KHÍCH (&lt; 6.5đ)</div>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                      {tierPass} học sinh
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Cần động viên ôn tập thêm</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              PHẦN TÁC GIẢ BẢN QUYỀN & ĐƠN VỊ CÔNG TÁC - XUẤT HIỆN Ở CUỐI CÁC TRANG HƯỚNG DẪN
              ========================================================================= */}
          <div
            style={{
              marginTop: '36px',
              padding: '24px 28px',
              background: 'linear-gradient(135deg, #0b0f19 0%, #1e1b4b 40%, #0f172a 100%)',
              border: '2.5px solid #f59e0b',
              borderRadius: '20px',
              boxShadow: '0 15px 40px rgba(0, 0, 0, 0.7), 0 0 30px rgba(245, 158, 11, 0.25)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Vệt sáng trang trí */}
            <div
              style={{
                position: 'absolute',
                top: '-40px',
                right: '-40px',
                width: '130px',
                height: '130px',
                background: 'radial-gradient(circle, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0) 70%)',
                borderRadius: '50%',
                pointerEvents: 'none'
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                borderBottom: '1.5px solid rgba(245, 158, 11, 0.35)',
                paddingBottom: '16px',
                marginBottom: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '18px',
                    background: 'linear-gradient(135deg, #f59e0b, #b45309)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    boxShadow: '0 8px 24px rgba(245, 158, 11, 0.45)',
                    border: '2.5px solid #fef08a',
                    flexShrink: 0
                  }}
                >
                  👨‍🏫
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span
                      style={{
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: '#ffffff',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        fontSize: '11.5px',
                        fontWeight: 900,
                        letterSpacing: '0.4px',
                        boxShadow: '0 2px 8px rgba(239,68,68,0.4)'
                      }}
                    >
                      TÁC GIẢ SÁNG KIẾN & LẬP TRÌNH
                    </span>
                    <span
                      style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        border: '1px solid #38bdf8',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        fontSize: '11.5px',
                        fontWeight: 800
                      }}
                    >
                      Bản Quyền Trí Tuệ Sư Phạm
                    </span>
                  </div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '22px',
                      fontWeight: 900,
                      color: '#fef08a',
                      letterSpacing: '0.3px',
                      textShadow: '0 2px 10px rgba(0,0,0,0.7)'
                    }}
                  >
                    HỒ TẤN KHẢI
                  </h3>
                  <div style={{ fontSize: '15px', color: '#38bdf8', fontWeight: 800, marginTop: '2px' }}>
                    🏫 TRƯỜNG THPT MANG THÍT • TỈNH VĨNH LONG
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1.5px solid #334155',
                  borderRadius: '12px',
                  padding: '10px 16px',
                  textAlign: 'right'
                }}
              >
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 800 }}>DỰ ÁN PHẦN MỀM GIÁO DỤC</div>
                <div style={{ fontSize: '13.5px', color: '#4ade80', fontWeight: 900, marginTop: '2px' }}>
                  ĐẤU TRƯỜNG 3D TRI THỨC ĐA NĂNG
                </div>
                <div style={{ fontSize: '11.5px', color: '#cbd5e1', fontWeight: 700 }}>
                  Chuẩn 3 Dạng Thức Đánh Giá GDPT 2018
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '14px',
                color: '#e2e8f0',
                fontSize: '13px',
                lineHeight: '1.6'
              }}
            >
              <div
                style={{
                  background: 'rgba(2, 6, 23, 0.6)',
                  border: '1px solid #1e293b',
                  borderRadius: '12px',
                  padding: '12px 16px'
                }}
              >
                <div style={{ color: '#fde047', fontWeight: 900, marginBottom: '4px', fontSize: '13.5px' }}>
                  🎯 Sứ Mệnh Chuyển Đổi Số Giảng Dạy:
                </div>
                <div>
                  Hệ thống được thầy <b>Hồ Tấn Khải (Trường THPT Mang Thít)</b> nghiên cứu và phát triển nhằm đổi mới sinh hoạt chuyên môn, tạo không khí học tập sôi nổi, kịch tính, giúp học sinh hào hứng ôn tập và rèn luyện kỹ năng làm bài thi tốt nghiệp THPT.
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(2, 6, 23, 0.6)',
                  border: '1px solid #1e293b',
                  borderRadius: '12px',
                  padding: '12px 16px'
                }}
              >
                <div style={{ color: '#38bdf8', fontWeight: 900, marginBottom: '4px', fontSize: '13.5px' }}>
                  ☁️ Tối Ưu Hóa & Đồng Bộ Cho Giáo Viên:
                </div>
                <div>
                  Tích hợp đồng bộ đám mây liên máy qua tài khoản Google hoặc Mật khẩu cá nhân, giúp quý Thầy/Cô soạn giáo án, câu hỏi tại nhà và mang lên lớp trình chiếu tức thì trên màn hình tương tác hoặc máy chiếu mà không lo mất dữ liệu.
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(2, 6, 23, 0.6)',
                  border: '1px solid #1e293b',
                  borderRadius: '12px',
                  padding: '12px 16px'
                }}
              >
                <div style={{ color: '#4ade80', fontWeight: 900, marginBottom: '4px', fontSize: '13.5px' }}>
                  📬 Hỗ Trợ Kỹ Thuật & Đóng Góp Ý Kiến:
                </div>
                <div>
                  Quý Thầy/Cô và các em học sinh có đóng góp về ngân hàng câu hỏi 12 môn học hoặc tính năng vui lòng liên hệ <b>Thầy Hồ Tấn Khải - Trường THPT Mang Thít</b> để cùng hoàn thiện học liệu số dùng chung cho ngành giáo dục.
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px dashed rgba(245, 158, 11, 0.3)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                fontSize: '12px',
                color: '#94a3b8'
              }}
            >
              <span>
                🌾 <b>Tác giả: Thầy Hồ Tấn Khải</b> • Đơn vị: <b>Trường THPT Mang Thít</b> (Vĩnh Long)
              </span>
              <span style={{ color: '#fde047', fontWeight: 800 }}>
                ⭐ Chúc quý Thầy/Cô và các em học sinh có những giờ học bổ ích & đầy hứng khởi!
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions: Đầy Đủ & Nổi Bật */}
        <div
          style={{
            padding: '12px 20px',
            background: 'linear-gradient(90deg, #030712 0%, #0f172a 100%)',
            borderTop: '2px solid #1f2937',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={onExportHTMLSlide}
              style={{
                padding: '10px 16px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#ffffff',
                border: '1.5px solid #7dd3fc',
                fontWeight: 900,
                fontSize: '13.5px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
              }}
            >
              🎨 Xuất Slide Học Liệu Màu (.HTML)
            </button>

            <button
              onClick={onPrintPDFEvidence}
              style={{
                padding: '10px 16px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#ffffff',
                border: '1.5px solid #a5b4fc',
                fontWeight: 900,
                fontSize: '13.5px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
              }}
            >
              🖨️ In / Lưu PDF Minh Chứng
            </button>

            <button
              onClick={() => exportHonorCertificateHTML(matchState, activeRoomId)}
              style={{
                padding: '10px 16px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #d97706, #b45309)',
                color: '#ffffff',
                border: '1.5px solid #fde047',
                fontWeight: 900,
                fontSize: '13.5px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)'
              }}
            >
              📜 Bằng Vinh Danh & Sổ Điểm
            </button>

            {onTriggerDemoBots && (
              <button
                onClick={() => {
                  onTriggerDemoBots();
                  onClose();
                }}
                style={{
                  padding: '10px 16px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  border: '1.5px solid #6ee7b7',
                  fontWeight: 900,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
              >
                🤖 Test Tải 40 HS Giả Lập
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12.5px', color: '#93c5fd', fontWeight: 800, background: 'rgba(30, 41, 59, 0.8)', padding: '6px 12px', borderRadius: '8px', border: '1px solid #3b82f6' }}>
              🌾 Tác giả: <b style={{ color: '#fde047' }}>Hồ Tấn Khải</b> • <b style={{ color: '#67e8f9' }}>Trường THPT Mang Thít</b>
            </span>
            <button
              onClick={onClose}
              style={{
                padding: '11px 24px',
                borderRadius: '12px',
                background: '#374151',
                color: '#ffffff',
                border: '1.5px solid #9ca3af',
                fontWeight: 900,
                fontSize: '14.5px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Đóng Hướng Dẫn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
