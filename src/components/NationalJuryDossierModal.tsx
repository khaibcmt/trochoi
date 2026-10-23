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
                      BƯỚC 1: CHỌN HOẶC NẠP ĐỀ THI
                    </h4>
                  </div>
                  <div style={{ fontSize: '15px', color: '#f1f5f9', lineHeight: 1.65 }}>
                    <div style={{ marginBottom: '8px' }}>
                      <b style={{ color: '#fde047' }}>• Cách 1:</b> Bấm chọn ngay <b>12 Môn THPT có sẵn</b> (Sinh học, Công nghệ, Toán, Lý, Hóa, Văn, Anh, Sử, Địa, GDCD, Tin học, GDQP).
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <b style={{ color: '#4ade80' }}>• Cách 2:</b> Dán đề từ Word/PDF vào <b>3 Khung Dạng Thức Chia Sẵn</b> (Dạng I: 4 lựa chọn, Dạng II: Đúng/Sai chùm, Dạng III: Điền đáp số).
                    </div>
                    <div>
                      <b style={{ color: '#f472b6' }}>• Cách 3:</b> Bấm nút <b>&ldquo;🤖 AI Soạn Đề&rdquo;</b> hoặc <b>&ldquo;📸 AI Quét Đề Từ Ảnh&rdquo;</b> để máy tự tạo đề thi trong 5 giây!
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
                      <b style={{ color: '#f87171' }}>• Chế độ 1:</b> ⚔️ <b>Kéo Co 3D</b> (Chia 2 đội Đỏ - Xanh đối kháng tranh tài).
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <b style={{ color: '#fde047' }}>• Chế độ 2:</b> 🔔 <b>Rung Chuông Vàng 3D</b> (Mỗi HS có 3 Tim ❤️, sống sót đến câu cuối).
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <b style={{ color: '#38bdf8' }}>• Chế độ 3:</b> ⚡ <b>Ai Nhanh Nhất</b> (Đua tốc độ cá nhân, phản xạ cực nhanh).
                    </div>
                    <div>
                      <b style={{ color: '#c084fc' }}>• Chế độ 4:</b> 🐉 <b>Diệt Boss Kiến Thức</b> (Cả lớp hợp sức giải toán trừ máu Rồng).
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
                      BƯỚC 3: HS QUÉT QR & THI ĐẤU
                    </h4>
                  </div>
                  <div style={{ fontSize: '15px', color: '#f1f5f9', lineHeight: 1.65 }}>
                    <div style={{ marginBottom: '8px' }}>
                      • Bấm <b>&ldquo;📱 Hiện Mã QR&rdquo;</b> trên màn hình lớn máy chiếu cho học sinh quét vào phòng trong 10 giây.
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      • Bấm <b>&ldquo;🚀 BẮT ĐẦU TRẬN ĐẤU&rdquo;</b>: Đếm ngược 30 giây, tự động đọc đề bằng giọng MC, hiển thị kết quả trực quan.
                    </div>
                    <div>
                      • Khi kết thúc: Tự động mở <b>Vinh Danh Top 10</b> và <b>Sổ Điểm Giáo Viên</b>, có thể bấm <b>&ldquo;💾 Tải Excel (.CSV)&rdquo;</b> để nộp nhà trường!
                    </div>
                  </div>
                </div>
              </div>

              {/* Hộp Điểm Nhấn Công Nghệ Mới (Nhanh - Bất Ngờ - May Rủi) */}
              <div
                style={{
                  background: 'linear-gradient(90deg, #831843 0%, #311042 50%, #1e1b4b 100%)',
                  border: '2px solid #f43f5e',
                  borderRadius: '20px',
                  padding: '20px 24px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '26px' }}>🎲</span>
                  <h3 style={{ margin: 0, fontSize: '19px', color: '#fecdd3', fontWeight: 900 }}>
                    TÍNH NĂNG ĐỈNH CAO: YẾU TỐ NHANH • BẤT NGỜ • MAY RỦI TOÀN CẦU
                  </h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', fontSize: '14.5px', color: '#ffe4e6', lineHeight: 1.6 }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(244,63,94,0.3)' }}>
                    <b style={{ color: '#fef08a' }}>⚡ Tia Chớp Đầu Tiên (+500đ):</b> HS trả lời đúng nhanh nhất lớp nhận vinh danh Tia Chớp và cộng nóng +500 điểm.
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(244,63,94,0.3)' }}>
                    <b style={{ color: '#67e8f9' }}>🎲 Cược Bản Lĩnh:</b> HS tự chọn mức cược trước khi chốt đáp án: <b>An Toàn (x1)</b> • <b>Liều Lĩnh (x1.5)</b> • <b>Tất Tay (x2.5)</b>.
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(244,63,94,0.3)' }}>
                    <b style={{ color: '#a7f3d0' }}>🎁 3 Rương Bí Ẩn:</b> Khi trả lời đúng được chọn 1 trong 3 rương: Nổ Hũ +1500đ, Đạo chích cướp 500đ của Top 1, Tim hồi sinh, Khiên bất tử!
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(244,63,94,0.3)' }}>
                    <b style={{ color: '#fed7aa' }}>🌪️ Vòng Quay Bất Ngờ:</b> Giáo viên có thể bấm nút <b>&ldquo;🎲 Sự Kiện Bất Ngờ&rdquo;</b> để kích hoạt Câu hỏi vàng x2, Phép màu cứu trợ, Bão đảo chiều!
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
                  Giao diện Giáo viên được thiết kế chuyên biệt để hỗ trợ cấu trúc đề thi <b>3 Dạng thức chuẩn GDPT 2018</b> (Quyết định 764/QĐ-BGDĐT) và lưu điểm theo <b>Thông tư 22/2021/TT-BGDĐT</b>.
                </p>
              </div>

              {/* Chi Tiết Từng Tính Năng Giáo Viên */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* 1. Bộ 3 Khung Dạng Thức */}
                <div style={{ background: '#111827', border: '2px solid #334155', borderRadius: '16px', padding: '18px 22px' }}>
                  <div style={{ fontSize: '17px', fontWeight: 900, color: '#fde047', marginBottom: '8px' }}>
                    1️⃣ Bộ 3 Khung Soạn Đề Riêng Biệt (Không Bao Giờ Bị Lẫn Câu)
                  </div>
                  <div style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: 1.65 }}>
                    • <b>Khung Dạng thức I (4 lựa chọn):</b> Dành cho câu hỏi trắc nghiệm truyền thống A, B, C, D có 1 đáp án đúng duy nhất. Giáo viên gạch chân <u>A</u> hoặc tô đậm <b>A</b> để hệ thống tự nhận diện đáp án đúng.<br />
                    • <b>Khung Dạng thức II (Đúng/Sai chùm):</b> Mỗi câu gồm 4 mệnh đề a, b, c, d. Giáo viên ghi chú <code>(Đúng)</code> hoặc <code>(Sai)</code> ở cuối dòng mệnh đề.<br />
                    • <b>Khung Dạng thức III (Trả lời ngắn):</b> Học sinh tự điền số hoặc từ khóa (ví dụ: <code>Đáp án: 12.5</code>).<br />
                    • <b>Lọc sạch rác Word/PDF:</b> Khi copy từ Word hoặc Zalo, hệ thống tự động bóc sạch các mã rác như <code>font-family, mso-, span</code> và tự ngắt dòng A. B. C. D. thông minh.
                  </div>
                </div>

                {/* 2. Soạn Đề Bằng AI */}
                <div style={{ background: '#111827', border: '2px solid #818cf8', borderRadius: '16px', padding: '18px 22px' }}>
                  <div style={{ fontSize: '17px', fontWeight: 900, color: '#a5b4fc', marginBottom: '8px' }}>
                    2️⃣ AI Soạn Đề Tự Động & Quét Đề Từ Ảnh (OCR Document)
                  </div>
                  <div style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: 1.65 }}>
                    • Bấm <b>&ldquo;🤖 AI Soạn Đề 3 Dạng Thức&rdquo;</b>: Chỉ cần nhập chủ đề (ví dụ: <i>&ldquo;Quang hợp ở thực vật C3, C4, CAM&rdquo;</i>) và chọn mức độ nhận thức (Nhận biết, Thông hiểu, Vận dụng). AI sẽ tự tạo bộ câu hỏi chất lượng cao.<br />
                    • Bấm <b>&ldquo;📸 AI Quét Đề Từ Ảnh / Văn Bản&rdquo;</b>: Tải ảnh chụp trang sách giáo khoa hoặc đề thi in trên giấy, AI sẽ tự động đọc chữ (OCR) và nạp vào 3 khung.<br />
                    • Có sẵn ngân hàng chuẩn 12 môn THPT để dùng ngay cả khi không có kết nối Internet.
                  </div>
                </div>

                {/* 3. Điều Khiển Sân Đấu 3D */}
                <div style={{ background: '#111827', border: '2px solid #10b981', borderRadius: '16px', padding: '18px 22px' }}>
                  <div style={{ fontSize: '17px', fontWeight: 900, color: '#6ee7b7', marginBottom: '8px' }}>
                    3️⃣ Bảng Điều Khiển Trên Màn Hình Máy Chiếu Lớp Học
                  </div>
                  <div style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: 1.65 }}>
                    • <b>Tối ưu hiển thị 10 nhân vật 3D:</b> Dù lớp có 40 đến 100 học sinh, màn hình chính chỉ hiển thị 10 nhân vật đại diện tiêu biểu để sân khấu thoáng đãng, không bị che khuất câu hỏi.<br />
                    • <b>🔊 Đọc Đề Tự Động:</b> Giọng MC chuyên nghiệp đọc to câu hỏi và các phương án cho cả lớp cùng nghe.<br />
                    • <b>💡 AI Giải Thích:</b> Khi hết giờ, giáo viên có thể bấm để AI hiện tóm tắt bản chất kiến thức và mẹo nhớ nhanh cho học sinh.<br />
                    • <b>🌟 Vòng Quay Định Mệnh:</b> Bấm <b>&ldquo;🎲 Sự Kiện Bất Ngờ&rdquo;</b> để tạo bất ngờ toàn sân (Nhân đôi điểm, Tiếp sức đội yếu, Cứu sinh học sinh bị loại).
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
                <div style={{ background: '#111827', border: '1.5px solid #334155', borderRadius: '16px', padding: '18px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#fde047', marginBottom: '8px' }}>
                    1. Quét Mã QR & Vào Phòng Nhanh
                  </div>
                  <div style={{ fontSize: '14.5px', color: '#cbd5e1', lineHeight: 1.6 }}>
                    • Mở Camera, Zalo hoặc trình duyệt quét mã QR trên máy chiếu.<br />
                    • Hoặc truy cập đường link và nhập <b>Mã phòng 5 chữ số</b> do Thầy/Cô cung cấp.<br />
                    • Kết nối qua cùng máy chủ nội bộ giúp đường truyền mượt mà 100%, <b>không bao giờ bị văng</b> kể cả khi dùng mạng 3G/4G yếu.
                  </div>
                </div>

                <div style={{ background: '#111827', border: '1.5px solid #334155', borderRadius: '16px', padding: '18px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#38bdf8', marginBottom: '8px' }}>
                    2. Đặt Họ Tên & Tạo Nhân Vật Nam / Nữ
                  </div>
                  <div style={{ fontSize: '14.5px', color: '#cbd5e1', lineHeight: 1.6 }}>
                    • Nhập đúng <b>Họ và tên học sinh</b> (để thầy cô lưu điểm chính xác vào sổ).<br />
                    • Chọn giới tính <b>👦 Nam</b> hoặc <b>👧 Nữ</b>, chọn kiểu mũ (Mũ cử nhân, Vương miện, Băng đô) và trang phục yêu thích.<br />
                    • Nhân vật 3D của bạn sẽ xuất hiện trên sân khấu chính của lớp học!
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
                    • <b>🛡️ An Toàn (x1):</b> Sai không bị trừ điểm (mức mặc định).<br />
                    • <b>⚡ Liều Lĩnh (x1.5):</b> Đúng nhân 1.5x điểm, sai bị trừ <b>-300đ</b>.<br />
                    • <b>🔥 Tất Tay (x2.5):</b> Đúng nhân 2.5x điểm, sai bị trừ <b>-800đ</b> (dành cho bạn tự tin 100% để lật kèo)!<br />
                    <span style={{ color: '#fde047', fontWeight: 800 }}>
                      ⚠️ Lưu ý: Khi đã bấm chọn Liều Lĩnh hoặc Tất Tay, bạn đã dùng hết lượt cược duy nhất của trận đấu; các câu sau sẽ tự động trở về An Toàn (x1)!
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
                    <b style={{ color: '#f87171' }}>• Điều kiện bắt buộc:</b> Phải trả lời đúng <b>liên tiếp 5 câu</b> (Streak = 5) mới được mở rương (mỗi học sinh chỉ mở 1 lần duy nhất trong cả trận).<br />
                    • Màn hình xuất hiện <b>3 Rương Kho Báu</b>. Bạn có <b>4 giây</b> để chọn mở 1 rương ngẫu nhiên:<br />
                    &nbsp;&nbsp;💎 <b>Nổ Hũ Kim Cương:</b> +1.500 điểm thưởng.<br />
                    &nbsp;&nbsp;🥷 <b>Đạo Chích:</b> +900đ và hút 500đ của bạn đang dẫn đầu Top 1.<br />
                    &nbsp;&nbsp;💖 <b>Tim Vàng:</b> +1 Mạng hồi sinh trong Rung Chuông Vàng.<br />
                    &nbsp;&nbsp;🛡️ <b>Khiên Bất Tử:</b> Bảo vệ bạn tuyệt đối không bị phạt nếu câu sau sai!
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
                  <span>⚡ 2 CƠ CHẾ ĐẶC BIỆT TOÀN DIỆN: MỖI HỌC SINH CHỈ DÙNG 1 LẦN DUY NHẤT!</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginTop: '10px' }}>
                  <div style={{ background: '#0b0f19', border: '1.5px solid #ef4444', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ color: '#fda4af', fontWeight: 900, fontSize: '15px', marginBottom: '6px' }}>
                      🎲 1. Cược Bản Lĩnh Trước Khi Chốt (Dùng 1 Lần Duy Nhất):
                    </div>
                    <div style={{ fontSize: '13.5px', color: '#cbd5e1', lineHeight: 1.55 }}>
                      • <b>🛡️ An Toàn (x1):</b> Sai không bị trừ điểm (mặc định an tâm).<br />
                      • <b>⚡ Liều Lĩnh (x1.5):</b> Đúng nhân 1.5x điểm (+1.500đ), sai bị trừ <b>-300đ</b>.<br />
                      • <b>🔥 Tất Tay (x2.5):</b> Đúng nhân 2.5x điểm (+2.500đ), sai bị trừ <b>-800đ</b> (dành cho bạn tự tin 100% để lật kèo)!
                    </div>
                  </div>

                  <div style={{ background: '#0b0f19', border: '1.5px solid #f59e0b', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ color: '#fde047', fontWeight: 900, fontSize: '15px', marginBottom: '6px' }}>
                      🎁 2. Mở Rương Bí Ẩn Định Mệnh (Bắt Buộc Đúng 5 Câu Liên Tiếp - 4s Chọn):
                    </div>
                    <div style={{ fontSize: '13.5px', color: '#cbd5e1', lineHeight: 1.55 }}>
                      Xuất hiện 3 Rương, có 4 giây để chọn 1 rương ngẫu nhiên:<br />
                      • 💎 <b>Nổ Hũ Kim Cương:</b> +1.500 điểm thưởng.<br />
                      • 🥷 <b>Đạo Chích:</b> +900đ và hút 500đ của đối thủ đang Top 1.<br />
                      • 💖 <b>Tim Vàng:</b> +1 Mạng hồi sinh trong Rung Chuông Vàng.<br />
                      • 🛡️ <b>Khiên Bất Tử:</b> Bảo vệ bạn không bị phạt nếu câu sau sai!
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
                    📒 BẢNG 2: SỐ CÂU ĐÚNG GHI SỔ ĐIỂM GV
                  </div>
                  <div style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: 1.65 }}>
                    • <b>Tuyệt đối không bị trừ điểm câu sai:</b> Đánh giá công bằng dựa trên tổng số câu học sinh làm đúng.<br />
                    • <b>Quy đổi thang điểm 10 theo chuẩn Thông tư 22:</b><br />
                    &nbsp;&nbsp;⭐ Top 1: 10.0 điểm<br />
                    &nbsp;&nbsp;⭐ Top 2 - 3: 9.5 điểm<br />
                    &nbsp;&nbsp;⭐ Top 4 - 6: 9.0 điểm<br />
                    &nbsp;&nbsp;⭐ Top 7 - 10: 8.5 điểm<br />
                    &nbsp;&nbsp;⭐ Các em có câu đúng đều đạt từ 7.5 - 8.0 điểm trở lên.<br />
                    • Bấm <b>&ldquo;💾 Xuất File Excel (.CSV)&rdquo;</b> để nộp hồ sơ kiểm tra đánh giá thường xuyên.
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
