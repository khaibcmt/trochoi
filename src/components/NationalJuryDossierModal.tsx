import React, { useState } from 'react';
import { QuizItem, MatchState, Player } from '../types';
import { cleanQuestionTitleText, getConvertedGradeByRank } from '../data/defaultSubjects';
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
  const [activeTab, setActiveTab] = useState<'DOSSIER' | 'MATRIX' | 'ANALYTICS'>('DOSSIER');

  if (!isOpen) return null;

  const countF1 = quizList.filter(q => !q.format || q.format === 'MULTIPLE_CHOICE').length;
  const countF2 = quizList.filter(q => q.format === 'TRUE_FALSE').length;
  const countF3 = quizList.filter(q => q.format === 'SHORT_ANSWER').length;
  const totalQ = Math.max(quizList.length, 1);

  const allPlayers: Player[] = [...matchState.redPlayers, ...matchState.bluePlayers];
  const rankedPlayers = [...allPlayers].sort((a, b) => {
    const sA = (a.fastScore || 0) + (a.correct || 0) * 100;
    const sB = (b.fastScore || 0) + (b.correct || 0) * 100;
    return sB - sA;
  });

  // Phân loại phổ điểm quy đổi Thông tư 22
  let tierExcellent = 0; // >= 9.0
  let tierGood = 0; // 8.0 - 8.9
  let tierFair = 0; // 6.5 - 7.9
  let tierPass = 0; // < 6.5

  rankedPlayers.forEach((p, idx) => {
    const totalPts = (p.fastScore || 0) + (p.correct || 0) * 100;
    const g = getConvertedGradeByRank(idx + 1, totalPts).grade;
    if (g >= 9.0) tierExcellent++;
    else if (g >= 8.0) tierGood++;
    else if (g >= 6.5) tierFair++;
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
        {/* Header Hồ Sơ Quốc Gia */}
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
                🏅 HỒ SƠ DỰ THI CẤP QUỐC GIA
              </span>
              <span style={{ fontSize: '12.5px', color: '#7dd3fc', fontWeight: 800 }}>
                👨‍🏫 Tác giả: Thầy Hồ Tấn Khải • Trường THPT Mang Thít
              </span>
            </div>
            <h2 style={{ margin: '5px 0 0 0', fontSize: '20px', fontWeight: 900, color: '#fef08a' }}>
              HỆ SINH THÁI TRÒ CHƠI GIÁO DỤC 3D & ĐÁNH GIÁ NĂNG LỰC SỐ CHUẨN GDPT 2018
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
            onClick={() => setActiveTab('DOSSIER')}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: activeTab === 'DOSSIER' ? '2px solid #fde047' : '1px solid #334155',
              background: activeTab === 'DOSSIER' ? 'linear-gradient(135deg, #d97706, #b45309)' : '#1e293b',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            📜 1. Thuyết Minh Sư Phạm & Tính Mới Cấp Quốc Gia
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
            📊 2. Ma Trận 3 Dạng Thức & Phân Tích Độ Khó ({quizList.length} câu)
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
            📈 3. Đánh Giá Năng Lực Thông Tư 22 & Hồ Sơ Minh Chứng ({allPlayers.length} HS)
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'DOSSIER' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  background: 'rgba(30, 27, 75, 0.7)',
                  border: '1.5px solid #6366f1',
                  borderRadius: '16px',
                  padding: '16px 20px'
                }}
              >
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16.5px', color: '#fef08a', fontWeight: 900 }}>
                  🌟 TÍNH MỚI, TÍNH KHOA HỌC & GIÁ TRỊ SƯ PHẠM ĐỘT PHÁ (CHUẨN BỘ GD&ĐT)
                </h3>
                <p style={{ margin: 0, fontSize: '13.5px', color: '#e2e8f0', lineHeight: 1.6 }}>
                  Công trình được thiết kế dựa trên thực tiễn giảng dạy và đổi mới kiểm tra đánh giá theo{' '}
                  <b style={{ color: '#38bdf8' }}>Chương trình Giáo dục phổ thông 2018</b>, đáp ứng toàn diện{' '}
                  <b style={{ color: '#4ade80' }}>Quyết định 4725/QĐ-BGDĐT</b> về Bộ chỉ số chuyển đổi số và cấu trúc định dạng đề thi mới từ năm 2025.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                <div style={{ background: '#111827', border: '1.5px solid #0284c7', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#38bdf8', marginBottom: '6px' }}>
                    1️⃣ Chuẩn Hóa 3 Dạng Thức Thi Tốt Nghiệp THPT 2025
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.55 }}>
                    • <b>Dạng thức I (4 phương án A, B, C, D)</b>: Tự động xáo trộn vị trí đáp án độc lập trên từng máy học sinh chống quay cóp.<br />
                    • <b>Dạng thức II (Đúng/Sai 4 ý a, b, c, d)</b>: Đánh giá toàn diện tư duy phân tích trên cùng một ngữ cảnh.<br />
                    • <b>Dạng thức III (Trả lời ngắn)</b>: Rèn luyện năng lực tính toán chính xác, tự động chuẩn hóa dấu phẩy/chấm thập phân.
                  </div>
                </div>

                <div style={{ background: '#111827', border: '1.5px solid #f59e0b', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#fde047', marginBottom: '6px' }}>
                    2️⃣ Tâm Lý Học Trò Chơi Nhân Văn (Không Bỏ Rơi Học Sinh)
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.55 }}>
                    • <b>Rung Chuông Vàng 3D</b>: Thí sinh có 3 mạng (❤️❤️❤️); khi hết 3 mạng sẽ chuyển thành <b>Khán giả cổ vũ tương tác</b> (vỗ tay, đánh trống tiếp lửa) và có cơ hội được Thầy/Cô tung Phao cứu trợ.<br />
                    • <b>Kéo Co 3D, Đua Tốc Độ, Diệt Boss</b>: Câu sai không bị trừ mạng để khuyến khích mọi học sinh kiên trì làm bài đến câu cuối cùng.
                  </div>
                </div>

                <div style={{ background: '#111827', border: '1.5px solid #10b981', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#4ade80', marginBottom: '6px' }}>
                    3️⃣ Công Nghệ Bảo Lưu Điểm Số & Phòng Chờ Thông Minh
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.55 }}>
                    • <b>Bảo lưu kết quả tức thời</b>: Khi mạng 4G/WiFi lớp học chập chờn, học sinh chỉ cần bấm 1 nút <b>&ldquo;🔄 Kết nối lại&rdquo;</b> để khôi phục 100% điểm số và số câu đúng.<br />
                    • <b>Linh hoạt 2 chế độ vào phòng</b>: Hỗ trợ cả <b>Vào trực tiếp phòng câu hỏi</b> và <b>Phòng chờ đọc đề trước</b> chờ hiệu lệnh của Giáo viên.
                  </div>
                </div>
              </div>

              {onTriggerDemoBots && (
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(2, 132, 199, 0.18))',
                    border: '2px dashed #34d399',
                    borderRadius: '16px',
                    padding: '14px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14.5px', fontWeight: 900, color: '#6ee7b7' }}>
                      🤖 CHẾ ĐỘ DEMO THUYẾT TRÌNH TRƯỚC HỘI ĐỒNG GIÁM KHẢO QUỐC GIA
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#cbd5e1', marginTop: '2px' }}>
                      Triệu hồi ngay đội hình học sinh 3D thông minh tự động trả lời câu hỏi theo thời gian thực để trình diễn trực quan cả 4 trò chơi!
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onTriggerDemoBots();
                      onClose();
                    }}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#ffffff',
                      border: '2px solid #a7f3d0',
                      fontWeight: 900,
                      fontSize: '13.5px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    🚀 Kích Hoạt Lớp Học Giả Lập (Demo Giám Khảo)
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'MATRIX' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* 3 Format Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div style={{ background: '#111827', border: '1.5px solid #0284c7', borderRadius: '14px', padding: '12px 16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 900, color: '#38bdf8' }}>PHẦN I • DẠNG THỨC 1 (4 LỰA CHỌN)</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                    {countF1} câu ({Math.round((countF1 / totalQ) * 100)}%)
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>Mức độ: Nhận biết & Thông hiểu</div>
                </div>

                <div style={{ background: '#111827', border: '1.5px solid #f59e0b', borderRadius: '14px', padding: '12px 16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 900, color: '#fde047' }}>PHẦN II • DẠNG THỨC 2 (ĐÚNG/SAI 4 Ý)</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                    {countF2} câu ({Math.round((countF2 / totalQ) * 100)}%)
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>Mức độ: Thông hiểu & Vận dụng</div>
                </div>

                <div style={{ background: '#111827', border: '1.5px solid #10b981', borderRadius: '14px', padding: '12px 16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 900, color: '#4ade80' }}>PHẦN III • DẠNG THỨC 3 (TRẢ LỜI NGẮN)</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                    {countF3} câu ({Math.round((countF3 / totalQ) * 100)}%)
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>Mức độ: Vận dụng & Vận dụng cao</div>
                </div>
              </div>

              {/* Item-by-Item Psychometric Table */}
              <div style={{ background: '#111827', border: '1px solid #334155', borderRadius: '14px', padding: '14px', overflowX: 'auto' }}>
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#fef08a', marginBottom: '10px' }}>
                  📋 BẢNG PHÂN TÍCH ĐỘ KHÓ & TỈ LỆ ĐÚNG/SAI TỪNG CÂU HỎI TRÊN LỚP ({subjectName})
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#7dd3fc', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>CÂU</th>
                      <th style={{ padding: '8px 10px' }}>DẠNG THỨC</th>
                      <th style={{ padding: '8px 10px' }}>NỘI DUNG CÂU HỎI</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>LƯỢT ĐÚNG / SAI</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>MỨC ĐỘ ĐÁNH GIÁ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizList.map((q, idx) => {
                      const r = q.rightCount || 0;
                      const w = q.wrongCount || 0;
                      const tot = r + w;
                      const rate = tot > 0 ? Math.round((r / tot) * 100) : null;
                      const level =
                        rate !== null
                          ? rate >= 75
                            ? '🟢 Nhận biết (Dễ)'
                            : rate >= 45
                            ? '🔵 Thông hiểu (Vừa)'
                            : '🔴 Vận dụng cao (Khó)'
                          : q.format === 'SHORT_ANSWER'
                          ? '🟠 Vận dụng cao'
                          : q.format === 'TRUE_FALSE'
                          ? '🔵 Thông hiểu - Vận dụng'
                          : '🟢 Nhận biết - Thông hiểu';

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 900, color: '#fde047' }}>Câu {idx + 1}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 800 }}>
                            {q.format === 'TRUE_FALSE'
                              ? 'Dạng II (Đ/S 4 ý)'
                              : q.format === 'SHORT_ANSWER'
                              ? 'Dạng III (Ngắn)'
                              : 'Dạng I (A,B,C,D)'}
                          </td>
                          <td style={{ padding: '8px 10px', color: '#e2e8f0', maxWidth: '420px' }}>
                            {cleanQuestionTitleText(q.q).slice(0, 110)}
                            {cleanQuestionTitleText(q.q).length > 110 ? '...' : ''}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800 }}>
                            <span style={{ color: '#4ade80' }}>✅ {r}</span> / <span style={{ color: '#f87171' }}>❌ {w}</span>
                            {rate !== null && <span style={{ color: '#fef08a', marginLeft: '4px' }}>({rate}%)</span>}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#cbd5e1' }}>
                            {level}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div style={{ background: '#111827', border: '1.5px solid #fde047', borderRadius: '14px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#fde047', fontWeight: 900 }}>XUẤT SẮC (9.0 - 10đ)</div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>{tierExcellent} HS</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Mức Tốt (Thông tư 22)</div>
                </div>
                <div style={{ background: '#111827', border: '1.5px solid #4ade80', borderRadius: '14px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#4ade80', fontWeight: 900 }}>GIỎI (8.0 - 8.9đ)</div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>{tierGood} HS</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Mức Tốt (Thông tư 22)</div>
                </div>
                <div style={{ background: '#111827', border: '1.5px solid #38bdf8', borderRadius: '14px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 900 }}>KHÁ (6.5 - 7.9đ)</div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>{tierFair} HS</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Mức Khá (Thông tư 22)</div>
                </div>
                <div style={{ background: '#111827', border: '1.5px solid #f59e0b', borderRadius: '14px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 900 }}>ĐẠT (5.0 - 6.4đ)</div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>{tierPass} HS</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Mức Đạt (Thông tư 22)</div>
                </div>
              </div>

              <div
                style={{
                  background: '#111827',
                  border: '1.5px solid #38bdf8',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ fontSize: '15px', fontWeight: 900, color: '#fef08a' }}>
                  🖨️ TRÍCH XUẤT BỘ HỒ SƠ MINH CHỨNG NỘP BAN GIÁM KHẢO CẤP QUỐC GIA
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
                  Hệ thống tự động đóng gói đầy đủ <b>Ma trận đặc tả 3 dạng thức GDPT 2018</b>, <b>Thống kê kết quả từng câu hỏi</b> và <b>Bằng Vinh Danh Quán Quân & Top 10 Học sinh</b> để giáo viên lưu trữ hồ sơ dự thi hoặc in ấn ngay tại hội trường.
                </p>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <button
                    onClick={onExportHTMLSlide}
                    style={{
                      padding: '11px 16px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                      color: '#ffffff',
                      border: '1.5px solid #7dd3fc',
                      fontWeight: 900,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    🌐 Xuất Học Liệu Số & Ma Trận 3 Dạng Thức (.HTML)
                  </button>

                  <button
                    onClick={onPrintPDFEvidence}
                    style={{
                      padding: '11px 16px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: '#ffffff',
                      border: '1.5px solid #a5b4fc',
                      fontWeight: 900,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    🖨️ In / Lưu PDF Hồ Sơ Minh Chứng Đề Thi
                  </button>

                  <button
                    onClick={() => exportHonorCertificateHTML(matchState, activeRoomId)}
                    style={{
                      padding: '11px 16px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #d97706, #b45309)',
                      color: '#ffffff',
                      border: '1.5px solid #fde047',
                      fontWeight: 900,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    🏆 Xuất Bằng Vinh Danh Quán Quân & Top 10 (.HTML / PDF)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
