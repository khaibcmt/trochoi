import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { MatchState, Player } from '../types';
import { getConvertedGradeByRank, getTeacherGradebookScore } from '../data/defaultSubjects';
import { exportHonorCertificateHTML } from '../utils/exportEvidence';

interface Props {
  matchState: MatchState;
  activeRoomId: string;
  totalQuestions?: number;
  onReviewMatch: () => void;
  onDownloadCSV: () => void;
  onExportHTMLSlide: () => void;
  onPrintPDFEvidence: () => void;
  onRestartMatch: () => void;
  onReturnToSetup: () => void;
}

export const GrandFinaleScreen: React.FC<Props> = ({
  matchState,
  activeRoomId,
  totalQuestions = 12,
  onReviewMatch,
  onDownloadCSV,
  onPrintPDFEvidence,
  onRestartMatch,
  onReturnToSetup
}) => {
  const [activeTab, setActiveTab] = useState<'DUAL' | 'SCORE' | 'CORRECT'>('DUAL');
  // Mặc định hiển thị Top 10 trên màn hình theo yêu cầu 4, có nút bấm mở rộng để xem toàn bộ cả lớp
  const [showAllStudents, setShowAllStudents] = useState<boolean>(false);
  const [copiedGradebook, setCopiedGradebook] = useState<boolean>(false);

  // Fire celebration confetti when grand finale screen opens
  useEffect(() => {
    const duration = 4.0 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 32, spread: 360, ticks: 65, zIndex: 100000 };

    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        return clearInterval(interval);
      }
      const particleCount = 55 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: 0.15, y: 0.55 } });
      confetti({ ...defaults, particleCount, origin: { x: 0.85, y: 0.55 } });
      confetti({ ...defaults, particleCount, origin: { x: 0.5, y: 0.25 } });
    }, 300);

    return () => clearInterval(interval);
  }, []);

  const allPlayers: Player[] = [...matchState.redPlayers, ...matchState.bluePlayers];
  const safeTotalQ = Math.max(1, totalQuestions || 12);

  // 1. BẢNG XẾP HẠNG THEO TỔNG ĐIỂM THI ĐẤU (BXH TRÒ CHƠI - GIỮ NGUYÊN CẤU TRÚC)
  const rankedByScorePlayers = [...allPlayers].sort((a, b) => {
    if (matchState.gameType === 'BELL') {
      if (!a.eliminated && b.eliminated) return -1;
      if (a.eliminated && !b.eliminated) return 1;
      if ((b.lives || 0) !== (a.lives || 0)) return (b.lives || 0) - (a.lives || 0);
    }
    if ((b.fastScore || 0) !== (a.fastScore || 0)) {
      return (b.fastScore || 0) - (a.fastScore || 0);
    }
    if ((b.correct || 0) !== (a.correct || 0)) {
      return (b.correct || 0) - (a.correct || 0);
    }
    return (a.wrongTotal || 0) - (b.wrongTotal || 0);
  });

  // 2. BẢNG XẾP HẠNG GHI ĐIỂM GIÁO VIÊN (CHUẨN THÔNG TƯ 22/BGDĐT)
  // - Trả về thang điểm 10, chỉ tính (Số câu đúng / Tổng số câu) * 10, làm tròn 1 số lẻ
  // - Xếp điểm thực tế theo thứ tự từ cao đến thấp để ghi vào sổ điểm
  const rankedByCorrectPlayers = [...allPlayers].sort((a, b) => {
    const scoreA = Number((((a.correct || 0) / safeTotalQ) * 10).toFixed(1));
    const scoreB = Number((((b.correct || 0) / safeTotalQ) * 10).toFixed(1));
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    if ((b.fastScore || 0) !== (a.fastScore || 0)) {
      return (b.fastScore || 0) - (a.fastScore || 0);
    }
    return (a.wrongTotal || 0) - (b.wrongTotal || 0);
  });

  // Danh sách hiển thị trên màn hình: Top 10 (mặc định) hoặc toàn bộ nếu mở rộng
  const displayedScorePlayers = showAllStudents ? rankedByScorePlayers : rankedByScorePlayers.slice(0, 10);
  const displayedCorrectPlayers = showAllStudents ? rankedByCorrectPlayers : rankedByCorrectPlayers.slice(0, 10);

  // Top 3 Honorees on podium
  const top1 = rankedByScorePlayers[0];
  const top2 = rankedByScorePlayers[1];
  const top3 = rankedByScorePlayers[2];

  // 1-Click Copy toàn bộ điểm Thông tư 22/BGDĐT cho giáo viên dán vào Excel / phần mềm quản lý điểm
  const handleCopyGradebookTable = () => {
    let tsv = 'STT\tHọ và tên\tSố câu đúng\tTổng số câu\tĐiểm TT22 (Thang 10)\tXếp loại\tĐiểm trò chơi\n';
    rankedByCorrectPlayers.forEach((p, idx) => {
      const gb = getTeacherGradebookScore(p.correct || 0, safeTotalQ);
      tsv += `${idx + 1}\t${p.label}\t${p.correct || 0}\t${safeTotalQ}\t${gb.grade.toFixed(1)}\t${gb.classification}\t${p.fastScore || 0}\n`;
    });
    navigator.clipboard?.writeText(tsv).then(() => {
      setCopiedGradebook(true);
      setTimeout(() => setCopiedGradebook(false), 2500);
    }).catch(() => {});
  };

  // Determine Tug-of-War Winning Team based on Round Wins, Rope Score, Total Correct Answers & Team Points
  const redTotalPts = matchState.redPlayers.reduce((sum, p) => sum + (p.fastScore || 0), 0);
  const blueTotalPts = matchState.bluePlayers.reduce((sum, p) => sum + (p.fastScore || 0), 0);
  const redTotalRight = matchState.redTotalCorrect || matchState.redPlayers.reduce((s, p) => s + (p.correct || 0), 0);
  const blueTotalRight = matchState.blueTotalCorrect || matchState.bluePlayers.reduce((s, p) => s + (p.correct || 0), 0);

  const getTugChampionInfo = () => {
    if (matchState.redRoundWins > matchState.blueRoundWins) {
      return { teamName: '🔴 ĐỘI ĐỎ VÔ ĐỊCH', color: '#ef4444', border: '#fca5a5', detail: `${matchState.redRoundWins} Hiệp Thắng • ${redTotalRight} câu đúng (${redTotalPts}đ)` };
    }
    if (matchState.blueRoundWins > matchState.redRoundWins) {
      return { teamName: '🔵 ĐỘI XANH VÔ ĐỊCH', color: '#0284c7', border: '#7dd3fc', detail: `${matchState.blueRoundWins} Hiệp Thắng • ${blueTotalRight} câu đúng (${blueTotalPts}đ)` };
    }
    if (matchState.ropeScore < 0 || redTotalRight > blueTotalRight || redTotalPts > blueTotalPts) {
      return { teamName: '🔴 ĐỘI ĐỎ CHIẾN THẮNG', color: '#ef4444', border: '#fca5a5', detail: `${redTotalRight} câu đúng • Tổng ${redTotalPts} điểm` };
    }
    if (matchState.ropeScore > 0 || blueTotalRight > redTotalRight || blueTotalPts > redTotalPts) {
      return { teamName: '🔵 ĐỘI XANH CHIẾN THẮNG', color: '#0284c7', border: '#7dd3fc', detail: `${blueTotalRight} câu đúng • Tổng ${blueTotalPts} điểm` };
    }
    return { teamName: '🤝 ĐỘI ĐỎ & ĐỘI XANH ĐỒNG VÔ ĐỊCH', color: '#f59e0b', border: '#fde047', detail: `Cân tài cân sức (${redTotalRight} - ${blueTotalRight} câu đúng)` };
  };

  const tugChamp = getTugChampionInfo();

  // Golden Bell Champion
  const bellChampion = [...allPlayers].sort((a, b) => {
    if (!a.eliminated && b.eliminated) return -1;
    if (a.eliminated && !b.eliminated) return 1;
    if ((b.lives || 0) !== (a.lives || 0)) return (b.lives || 0) - (a.lives || 0);
    if ((b.correct || 0) !== (a.correct || 0)) return (b.correct || 0) - (a.correct || 0);
    return (b.fastScore || 0) - (a.fastScore || 0);
  })[0];

  // Boss Slayer Champion (Tính theo Tổng Điểm fastScore có trừ 1000đ câu sai)
  const bossChampion = [...allPlayers].sort((a, b) => {
    if ((b.fastScore || 0) !== (a.fastScore || 0)) return (b.fastScore || 0) - (a.fastScore || 0);
    return (b.correct || 0) - (a.correct || 0);
  })[0];

  const getGradeInfo = (player: Player, rank: number) => {
    const totalPts = player.fastScore || 0;
    if (matchState.gameType === 'FAST' || matchState.gameType === 'BOSS') {
      return getConvertedGradeByRank(rank, totalPts);
    }
    if (matchState.gameType === 'BELL') {
      if (!player.eliminated) {
        if (rank <= 3) return { grade: 10, label: 'Quán quân trụ sàn (10đ)' };
        if (rank <= 6) return { grade: 9.5, label: 'Trụ sàn xuất sắc (9.5đ)' };
        return { grade: 9.0, label: 'Trụ sàn vững vàng (9.0đ)' };
      }
      if ((player.correct || 0) >= 5) return { grade: 8.5, label: 'Đạt thành tích tốt' };
      return { grade: 8.0, label: 'Khán giả tích cực' };
    }
    if (rank <= 3) return { grade: 10, label: 'Xuất sắc (10đ)' };
    if (rank <= 6) return { grade: 9.5, label: 'Giỏi (9.5đ)' };
    if (rank <= 10) return { grade: 9.0, label: 'Tốt (9.0đ)' };
    return { grade: 8.5, label: 'Đạt (8.5đ)' };
  };

  return (
    <div
      id="grand-finale-blank-screen"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        overflowY: 'auto',
        background: 'radial-gradient(circle at 50% 10%, #1e1b4b 0%, #090d16 55%, #020617 100%)',
        color: '#ffffff',
        padding: '20px 24px 36px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxSizing: 'border-box'
      }}
    >
      {/* Header Vinh Danh Chung Cuộc */}
      <div style={{ textAlign: 'center', maxWidth: '1240px', width: '100%', marginBottom: '16px' }}>
        <div style={{ fontSize: '42px', marginBottom: '2px', filter: 'drop-shadow(0 0 18px rgba(250, 204, 21, 0.75))' }}>
          🏆👑🏆
        </div>
        <h1 style={{
          fontSize: 'clamp(22px, 2.8vw, 34px)',
          fontWeight: 900,
          background: 'linear-gradient(90deg, #fef08a, #f59e0b, #fde047, #f59e0b)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: '0 0 4px 0',
          letterSpacing: '0.8px',
          textTransform: 'uppercase'
        }}>
          SÂN KHẤU VINH DANH QUÁN QUÂN & HỆ THỐNG 2 BẢNG XẾP HẠNG
        </h1>
        <p style={{ fontSize: '14px', color: '#cbd5e1', margin: 0, fontWeight: 700 }}>
          Phòng thi: <b style={{ color: '#38bdf8' }}>{activeRoomId}</b> • Thí sinh: <b style={{ color: '#4ade80' }}>{allPlayers.length} Học sinh</b> • Xếp hạng theo <b style={{ color: '#fde047' }}>Tổng Điểm Thi Đấu (-1000đ/sai)</b> & <b style={{ color: '#6ee7b7' }}>Số Câu Đúng Ghi Sổ Điểm Giáo Viên</b>
        </p>
      </div>

      {/* 3 Khối Vinh Danh Đặc Biệt: Quán Quân Rung Chuông Vàng • Quán Quân Diệt Boss • Đội Vô Địch Kéo Co */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
        gap: '14px',
        maxWidth: '1240px',
        width: '100%',
        marginBottom: '18px'
      }}>
        {/* 1. QUÁN QUÂN RUNG CHUÔNG VÀNG */}
        <div style={{
          background: matchState.gameType === 'BELL'
            ? 'linear-gradient(135deg, rgba(180, 83, 9, 0.45), rgba(15, 23, 42, 0.95))'
            : 'rgba(15, 23, 42, 0.88)',
          border: matchState.gameType === 'BELL' ? '2.5px solid #fde047' : '1.5px solid #f59e0b',
          borderRadius: '18px',
          padding: '14px 18px',
          boxShadow: matchState.gameType === 'BELL' ? '0 0 28px rgba(245, 158, 11, 0.45)' : '0 8px 20px rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #f59e0b, #b45309)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '30px',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)'
          }}>
            🔔
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11.5px', fontWeight: 900, color: '#fde047', letterSpacing: '0.5px' }}>
              QUÁN QUÂN RUNG CHUÔNG VÀNG
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: '2px 0' }}>
              {bellChampion ? bellChampion.label : 'Chưa có thí sinh'}
            </div>
            <div style={{ fontSize: '12.5px', color: '#a7f3d0', fontWeight: 800 }}>
              {bellChampion
                ? `Còn ${bellChampion.lives ?? 3} ❤️ • ${bellChampion.correct || 0} câu đúng • ${bellChampion.fastScore || 0}đ`
                : 'Sẵn sàng vinh danh'}
            </div>
          </div>
        </div>

        {/* 2. QUÁN QUÂN DIỆT BOSS KIẾN THỨC */}
        <div style={{
          background: matchState.gameType === 'BOSS'
            ? 'linear-gradient(135deg, rgba(147, 51, 234, 0.45), rgba(15, 23, 42, 0.95))'
            : 'rgba(15, 23, 42, 0.88)',
          border: matchState.gameType === 'BOSS' ? '2.5px solid #e879f9' : '1.5px solid #a855f7',
          borderRadius: '18px',
          padding: '14px 18px',
          boxShadow: matchState.gameType === 'BOSS' ? '0 0 28px rgba(168, 85, 247, 0.45)' : '0 8px 20px rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #9333ea, #6b21a8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '30px',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(147, 51, 234, 0.4)'
          }}>
            🐉
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11.5px', fontWeight: 900, color: '#e879f9', letterSpacing: '0.5px' }}>
              DŨNG SĨ QUÁN QUÂN DIỆT BOSS
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: '2px 0' }}>
              {bossChampion ? bossChampion.label : 'Chưa có thí sinh'}
            </div>
            <div style={{ fontSize: '12.5px', color: '#fde047', fontWeight: 800 }}>
              {bossChampion
                ? `Tổng điểm: ${bossChampion.fastScore || 0}đ • ${bossChampion.correct || 0} câu đúng`
                : `Boss HP: ${matchState.bossHP ?? 0}/${matchState.maxBossHP ?? 1000}`}
            </div>
          </div>
        </div>

        {/* 3. ĐỘI VÔ ĐỊCH KÉO CO 3D */}
        <div style={{
          background: matchState.gameType === 'TUG'
            ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.45), rgba(15, 23, 42, 0.95))'
            : 'rgba(15, 23, 42, 0.88)',
          border: `2px solid ${tugChamp.border}`,
          borderRadius: '18px',
          padding: '14px 18px',
          boxShadow: matchState.gameType === 'TUG' ? '0 0 28px rgba(56, 189, 248, 0.45)' : '0 8px 20px rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            background: `linear-gradient(135deg, ${tugChamp.color}, #1e293b)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '30px',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
          }}>
            ⚔️
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11.5px', fontWeight: 900, color: '#7dd3fc', letterSpacing: '0.5px' }}>
              ĐỘI VÔ ĐỊCH KÉO CO 3D
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#fef08a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: '2px 0' }}>
              {tugChamp.teamName}
            </div>
            <div style={{ fontSize: '12.5px', color: '#cbd5e1', fontWeight: 800 }}>
              {tugChamp.detail}
            </div>
          </div>
        </div>
      </div>

      {/* Bục Vinh Danh Top 3 Theo Tổng Điểm (Nếu có học sinh) */}
      {top1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: '16px',
          maxWidth: '760px',
          width: '100%',
          margin: '4px auto 18px auto',
          padding: '0 10px'
        }}>
          {/* Hạng 2 */}
          {top2 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '26px', marginBottom: '2px' }}>🥈</div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#e2e8f0', textAlign: 'center' }}>
                {top2.label}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 800 }}>
                {top2.fastScore || 0} điểm • {top2.correct || 0} đúng
              </div>
              <div style={{
                width: '100%',
                height: '92px',
                background: 'linear-gradient(180deg, #94a3b8 0%, #475569 55%, #1e293b 100%)',
                border: '2px solid #cbd5e1',
                borderRadius: '14px 14px 0 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900
              }}>
                <div style={{ fontSize: '28px', color: '#ffffff' }}>HẠNG 2</div>
                <div style={{ fontSize: '11px', color: '#f1f5f9' }}>Á QUÂN</div>
              </div>
            </div>
          ) : <div style={{ flex: 1 }} />}

          {/* Hạng 1 - Quán Quân */}
          <div style={{ flex: 1.25, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '2px', filter: 'drop-shadow(0 0 14px rgba(253, 224, 71, 0.9))' }}>
              👑
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#fde047', textAlign: 'center' }}>
              {top1.label}
            </div>
            <div style={{ fontSize: '13px', color: '#4ade80', marginBottom: '6px', fontWeight: 900 }}>
              {top1.fastScore || 0} điểm • {top1.correct || 0} câu đúng
            </div>
            <div style={{
              width: '100%',
              height: '125px',
              background: 'linear-gradient(180deg, #f59e0b 0%, #d97706 50%, #78350f 100%)',
              border: '2.5px solid #fef08a',
              borderRadius: '18px 18px 0 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 12px 30px rgba(245, 158, 11, 0.45)',
              fontWeight: 900
            }}>
              <div style={{ fontSize: '34px', color: '#fef08a' }}>QUÁN QUÂN</div>
              <div style={{ fontSize: '12px', color: '#ffffff', letterSpacing: '1px' }}>TOP 1 TỔNG ĐIỂM 🏆</div>
            </div>
          </div>

          {/* Hạng 3 */}
          {top3 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '26px', marginBottom: '2px' }}>🥉</div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#fdba74', textAlign: 'center' }}>
                {top3.label}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 800 }}>
                {top3.fastScore || 0} điểm • {top3.correct || 0} đúng
              </div>
              <div style={{
                width: '100%',
                height: '78px',
                background: 'linear-gradient(180deg, #d97706 0%, #b45309 55%, #451a03 100%)',
                border: '2px solid #fed7aa',
                borderRadius: '14px 14px 0 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900
              }}>
                <div style={{ fontSize: '24px', color: '#fed7aa' }}>HẠNG 3</div>
                <div style={{ fontSize: '11px', color: '#ffedd5' }}>Á QUÂN 2</div>
              </div>
            </div>
          ) : <div style={{ flex: 1 }} />}
        </div>
      )}

      {/* Thanh chuyển chế độ xem 2 Bảng Xếp Hạng & Nút xem Top 10 / Toàn bộ cả lớp */}
      <div style={{
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        maxWidth: '1240px',
        width: '100%',
        marginBottom: '14px'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('DUAL')}
          style={{
            padding: '9px 16px',
            borderRadius: '12px',
            border: activeTab === 'DUAL' ? '2px solid #38bdf8' : '1.5px solid #334155',
            background: activeTab === 'DUAL' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : '#0f172a',
            color: '#ffffff',
            fontWeight: 900,
            fontSize: '12.5px',
            cursor: 'pointer'
          }}
        >
          📊 SONG SONG CẢ 2 BẢNG XẾP HẠNG
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('SCORE')}
          style={{
            padding: '9px 16px',
            borderRadius: '12px',
            border: activeTab === 'SCORE' ? '2px solid #fde047' : '1.5px solid #334155',
            background: activeTab === 'SCORE' ? 'linear-gradient(135deg, #d97706, #b45309)' : '#0f172a',
            color: '#ffffff',
            fontWeight: 900,
            fontSize: '12.5px',
            cursor: 'pointer'
          }}
        >
          🎮 BẢNG 1: BXH TRÒ CHƠI (ĐIỂM THI ĐẤU)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('CORRECT')}
          style={{
            padding: '9px 16px',
            borderRadius: '12px',
            border: activeTab === 'CORRECT' ? '2px solid #6ee7b7' : '1.5px solid #334155',
            background: activeTab === 'CORRECT' ? 'linear-gradient(135deg, #059669, #047857)' : '#0f172a',
            color: '#ffffff',
            fontWeight: 900,
            fontSize: '12.5px',
            cursor: 'pointer'
          }}
        >
          📒 BẢNG 2: SỔ GHI ĐIỂM GV (THÔNG TƯ 22)
        </button>

        {/* Nút chuyển đổi: Chỉ hiện Top 10 trên màn hình vs Mở rộng toàn bộ cả lớp */}
        <button
          type="button"
          onClick={() => setShowAllStudents(!showAllStudents)}
          style={{
            padding: '9px 16px',
            borderRadius: '12px',
            border: showAllStudents ? '2px solid #a855f7' : '1.5px solid #3b82f6',
            background: showAllStudents ? 'linear-gradient(135deg, #9333ea, #7e22ce)' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#ffffff',
            fontWeight: 900,
            fontSize: '12.5px',
            cursor: 'pointer'
          }}
          title="Chuyển đổi giữa chế độ chỉ hiện Top 10 và xem toàn bộ cả lớp"
        >
          {showAllStudents ? `👥 Đang hiện toàn bộ ${allPlayers.length} HS • Bấm để xem Top 10` : `⭐ Chỉ hiện Top 10 trên màn hình • Bấm để xem hết ${allPlayers.length} HS`}
        </button>
      </div>

      {/* HỆ THỐNG 2 BẢNG XẾP HẠNG: TỔNG ĐIỂM THI ĐẤU & SỔ ĐIỂM GIÁO VIÊN THEO SỐ CÂU ĐÚNG */}
      <div style={{
        maxWidth: '1240px',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: activeTab === 'DUAL' ? 'repeat(auto-fit, minmax(520px, 1fr))' : '1fr',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* BẢNG 1: XẾP HẠNG THEO TỔNG ĐIỂM THI ĐẤU */}
        {(activeTab === 'DUAL' || activeTab === 'SCORE') && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.95)',
            borderRadius: '20px',
            border: '2px solid #f59e0b',
            boxShadow: '0 15px 40px rgba(0,0,0,0.65)',
            padding: '16px 18px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '10px',
              borderBottom: '1.5px solid #334155',
              marginBottom: '10px',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16.5px', color: '#fde047', fontWeight: 900 }}>
                  🎮 BẢNG 1: BXH TRÒ CHƠI (GIỮ NGUYÊN CẤU TRÚC ĐIỂM SỐ)
                </h3>
                <div style={{ fontSize: '11.5px', color: '#cbd5e1', fontWeight: 700, marginTop: '2px' }}>
                  Tính theo tốc độ, combo chuỗi, cược bản lĩnh • Đua tốc độ & Diệt Boss chọn sai <b style={{ color: '#f87171' }}>trừ -1000đ</b>
                </div>
              </div>
              <span style={{
                fontSize: '11.5px',
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid #f59e0b',
                color: '#fef08a',
                padding: '4px 10px',
                borderRadius: '999px',
                fontWeight: 900
              }}>
                {showAllStudents ? `Hiện tất cả ${rankedByScorePlayers.length} HS` : `Top 10 / ${rankedByScorePlayers.length} HS`}
              </span>
            </div>

            {displayedScorePlayers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px', color: '#94a3b8', fontSize: '14.5px', fontWeight: 800 }}>
                Chưa có dữ liệu thí sinh trong trận đấu này.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: '480px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#fde047', textAlign: 'left' }}>
                      <th style={{ padding: '9px 10px', borderRadius: '10px 0 0 10px' }}>HẠNG</th>
                      <th style={{ padding: '9px 10px' }}>HỌ VÀ TÊN</th>
                      <th style={{ padding: '9px 10px', textAlign: 'center' }}>ĐÚNG / SAI</th>
                      <th style={{ padding: '9px 10px', textAlign: 'center', borderRadius: '0 10px 10px 0' }}>TỔNG ĐIỂM THI ĐẤU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedScorePlayers.map((player, idx) => {
                      const rank = idx + 1;
                      const totalPts = player.fastScore || 0;
                      const info = getGradeInfo(player, rank);
                      return (
                        <tr
                          key={`score-row-${player.id}`}
                          style={{
                            borderBottom: '1px solid #1e293b',
                            background: rank === 1
                              ? 'rgba(234, 179, 8, 0.16)'
                              : rank <= 3
                              ? 'rgba(56, 189, 248, 0.08)'
                              : 'transparent'
                          }}
                        >
                          <td style={{ padding: '9px 10px', fontWeight: 900, fontSize: '14px', color: rank === 1 ? '#fde047' : rank === 2 ? '#e2e8f0' : rank === 3 ? '#fdba74' : '#94a3b8' }}>
                            {rank === 1 ? '🥇 Hạng 1' : rank === 2 ? '🥈 Hạng 2' : rank === 3 ? '🥉 Hạng 3' : `#${rank}`}
                          </td>
                          <td style={{ padding: '9px 10px', fontWeight: 900, color: '#ffffff', fontSize: '14.5px' }}>
                            {player.label}
                          </td>
                          <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 800, fontSize: '12.5px' }}>
                            <span style={{ color: '#4ade80' }}>✅ {player.correct || 0}</span>
                            <span style={{ color: '#64748b', margin: '0 4px' }}>/</span>
                            <span style={{ color: '#f87171' }}>❌ {player.wrongTotal || 0}</span>
                          </td>
                          <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 900, color: totalPts < 0 ? '#f87171' : '#38bdf8', fontSize: '15px' }}>
                            {totalPts} điểm <span style={{ fontSize: '11.5px', color: '#fde047' }}>({info.grade}đ)</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* BẢNG 2: XẾP HẠNG THEO SỐ CÂU ĐÚNG — GHI SỔ ĐIỂM CỦA GIÁO VIÊN (THÔNG TƯ 22/BGDĐT) */}
        {(activeTab === 'DUAL' || activeTab === 'CORRECT') && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.95)',
            borderRadius: '20px',
            border: '2.5px solid #10b981',
            boxShadow: '0 15px 40px rgba(0,0,0,0.65)',
            padding: '16px 18px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '10px',
              borderBottom: '1.5px solid #334155',
              marginBottom: '10px',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16.5px', color: '#6ee7b7', fontWeight: 900 }}>
                  📒 BẢNG 2: SỔ GHI ĐIỂM GV (CHUẨN THÔNG TƯ 22/BGDĐT)
                </h3>
                <div style={{ fontSize: '11.5px', color: '#cbd5e1', fontWeight: 700, marginTop: '2px' }}>
                  Thang điểm 10 • Chỉ tính <b style={{ color: '#4ade80' }}>(Số câu đúng / {safeTotalQ}) × 10</b> • Làm tròn 1 số lẻ • Xếp thực tế từ cao xuống thấp
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handleCopyGradebookTable}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: copiedGradebook ? '#059669' : '#065f46',
                    border: '1px solid #34d399',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 900,
                    cursor: 'pointer'
                  }}
                  title="Sao chép toàn bộ danh sách điểm lớp để dán vào Excel/vnEdu"
                >
                  {copiedGradebook ? '✅ Đã Copy Điểm!' : '📋 Copy Sổ Điểm'}
                </button>
                <span style={{
                  fontSize: '11.5px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid #10b981',
                  color: '#6ee7b7',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontWeight: 900
                }}>
                  {showAllStudents ? `Hiện tất cả ${rankedByCorrectPlayers.length} HS` : `Top 10 / ${rankedByCorrectPlayers.length} HS`}
                </span>
              </div>
            </div>

            {displayedCorrectPlayers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px', color: '#94a3b8', fontSize: '14.5px', fontWeight: 800 }}>
                Chưa có dữ liệu thí sinh trong trận đấu này.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: '480px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#6ee7b7', textAlign: 'left' }}>
                      <th style={{ padding: '9px 10px', borderRadius: '10px 0 0 10px' }}>HẠNG SỔ</th>
                      <th style={{ padding: '9px 10px' }}>HỌ VÀ TÊN</th>
                      <th style={{ padding: '9px 10px', textAlign: 'center' }}>SỐ CÂU ĐÚNG</th>
                      <th style={{ padding: '9px 10px', textAlign: 'center' }}>ĐIỂM TT22 (THANG 10)</th>
                      <th style={{ padding: '9px 10px', textAlign: 'center', borderRadius: '0 10px 10px 0' }}>XẾP LOẠI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedCorrectPlayers.map((player, idx) => {
                      const rankByCorrect = idx + 1;
                      const gb = getTeacherGradebookScore(player.correct || 0, safeTotalQ);
                      return (
                        <tr
                          key={`correct-row-${player.id}`}
                          style={{
                            borderBottom: '1px solid #1e293b',
                            background: rankByCorrect === 1
                              ? 'rgba(16, 185, 129, 0.16)'
                              : rankByCorrect <= 3
                              ? 'rgba(16, 185, 129, 0.08)'
                              : 'transparent'
                          }}
                        >
                          <td style={{ padding: '9px 10px', fontWeight: 900, fontSize: '14px', color: rankByCorrect === 1 ? '#fde047' : rankByCorrect === 2 ? '#e2e8f0' : rankByCorrect === 3 ? '#fdba74' : '#94a3b8' }}>
                            {rankByCorrect === 1 ? '🥇 Hạng 1' : rankByCorrect === 2 ? '🥈 Hạng 2' : rankByCorrect === 3 ? '🥉 Hạng 3' : `#${rankByCorrect}`}
                          </td>
                          <td style={{ padding: '9px 10px', fontWeight: 900, color: '#ffffff', fontSize: '14.5px' }}>
                            {player.label}
                          </td>
                          <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 900, color: '#4ade80', fontSize: '15px' }}>
                            ✅ {player.correct || 0}/{safeTotalQ} câu
                          </td>
                          <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '999px',
                              fontWeight: 900,
                              fontSize: '14px',
                              background: gb.grade >= 8.0
                                ? 'linear-gradient(135deg, #10b981, #059669)'
                                : gb.grade >= 6.5
                                ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                                : gb.grade >= 5.0
                                ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                                : 'linear-gradient(135deg, #ef4444, #dc2626)',
                              color: '#ffffff',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                            }}>
                              📒 {gb.grade.toFixed(1)} điểm
                            </span>
                          </td>
                          <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 800, color: gb.badgeColor }}>
                            {gb.classification}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Thanh Công Cụ Điều Khiển Màn Hình Vinh Danh */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        justifyContent: 'center',
        maxWidth: '1150px',
        width: '100%'
      }}>
        <button
          onClick={onReviewMatch}
          style={{
            padding: '11px 18px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #059669, #047857)',
            color: '#ffffff',
            border: '1.5px solid #6ee7b7',
            fontWeight: 900,
            fontSize: '13.5px',
            cursor: 'pointer'
          }}
        >
          📖 XEM LẠI & CHỮA CÂU HỎI
        </button>

        <button
          onClick={onDownloadCSV}
          style={{
            padding: '11px 18px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #0d9488, #0f766e)',
            color: '#ffffff',
            border: '1.5px solid #5eead4',
            fontWeight: 900,
            fontSize: '13.5px',
            cursor: 'pointer'
          }}
        >
          📊 TẢI SỔ ĐIỂM GIÁO VIÊN (.CSV)
        </button>

        <button
          onClick={() => exportHonorCertificateHTML(matchState, activeRoomId)}
          style={{
            padding: '11px 18px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #d97706, #b45309)',
            color: '#ffffff',
            border: '1.5px solid #fde047',
            fontWeight: 900,
            fontSize: '13.5px',
            cursor: 'pointer'
          }}
        >
          📜 XUẤT BẰNG VINH DANH QUÁN QUÂN
        </button>

        <button
          onClick={onPrintPDFEvidence}
          style={{
            padding: '11px 18px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: '#ffffff',
            border: '1.5px solid #a5b4fc',
            fontWeight: 900,
            fontSize: '13.5px',
            cursor: 'pointer'
          }}
        >
          🖨️ IN / LƯU PDF HỒ SƠ ĐỀ THI
        </button>

        <button
          onClick={onRestartMatch}
          style={{
            padding: '11px 18px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            color: '#ffffff',
            border: '1.5px solid #7dd3fc',
            fontWeight: 900,
            fontSize: '13.5px',
            cursor: 'pointer'
          }}
        >
          🔄 THI ĐẤU TRẬN MỚI
        </button>

        <button
          onClick={onReturnToSetup}
          style={{
            padding: '11px 18px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #475569, #334155)',
            color: '#ffffff',
            border: '1.5px solid #94a3b8',
            fontWeight: 900,
            fontSize: '13.5px',
            cursor: 'pointer'
          }}
        >
          🏠 VỀ CÀI ĐẶT ĐỀ THI
        </button>
      </div>
    </div>
  );
};
