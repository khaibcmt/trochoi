import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { MatchState, Player } from '../types';
import { getConvertedGradeByRank } from '../data/defaultSubjects';
import { exportHonorCertificateHTML } from '../utils/exportEvidence';

interface Props {
  matchState: MatchState;
  activeRoomId: string;
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
  onReviewMatch,
  onDownloadCSV,
  onExportHTMLSlide,
  onPrintPDFEvidence,
  onRestartMatch,
  onReturnToSetup
}) => {
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

  // Rank sorting based on score and correct answers (and survival in Golden Bell)
  const rankedPlayers = [...allPlayers].sort((a, b) => {
    if (matchState.gameType === 'BELL') {
      if (!a.eliminated && b.eliminated) return -1;
      if (a.eliminated && !b.eliminated) return 1;
      if ((b.lives || 0) !== (a.lives || 0)) return (b.lives || 0) - (a.lives || 0);
      if ((b.correct || 0) !== (a.correct || 0)) return (b.correct || 0) - (a.correct || 0);
      return (b.fastScore || 0) - (a.fastScore || 0);
    }
    const scoreA = (a.fastScore || 0) + (a.correct || 0) * 100;
    const scoreB = (b.fastScore || 0) + (b.correct || 0) * 100;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return (b.correct || 0) - (a.correct || 0);
  });

  // Top 10 Honorees
  const top10Players = rankedPlayers.slice(0, 10);
  const top1 = top10Players[0];
  const top2 = top10Players[1];
  const top3 = top10Players[2];

  // Determine Tug-of-War Winning Team based on Round Wins, Rope Score, Total Correct Answers & Team Points
  const redTotalPts = matchState.redPlayers.reduce((sum, p) => sum + (p.fastScore || 0) + (p.correct || 0) * 100, 0);
  const blueTotalPts = matchState.bluePlayers.reduce((sum, p) => sum + (p.fastScore || 0) + (p.correct || 0) * 100, 0);
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

  // Boss Slayer Champion
  const bossChampion = [...allPlayers].sort((a, b) => {
    const dmgB = (b.fastScore || 0) + (b.correct || 0) * 100;
    const dmgA = (a.fastScore || 0) + (a.correct || 0) * 100;
    return dmgB - dmgA;
  })[0];

  const getGradeInfo = (player: Player, rank: number) => {
    const totalPts = (player.fastScore || 0) + (player.correct || 0) * 100;
    if (matchState.gameType === 'FAST') {
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
      <div style={{ textAlign: 'center', maxWidth: '1150px', width: '100%', marginBottom: '16px' }}>
        <div style={{ fontSize: '44px', marginBottom: '2px', filter: 'drop-shadow(0 0 18px rgba(250, 204, 21, 0.75))' }}>
          🏆👑🏆
        </div>
        <h1 style={{
          fontSize: 'clamp(24px, 3vw, 36px)',
          fontWeight: 900,
          background: 'linear-gradient(90deg, #fef08a, #f59e0b, #fde047, #f59e0b)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: '0 0 4px 0',
          letterSpacing: '0.8px',
          textTransform: 'uppercase'
        }}>
          SÂN KHẤU VINH DANH QUÁN QUÂN & BẢNG VÀNG TOP 10
        </h1>
        <p style={{ fontSize: '14.5px', color: '#cbd5e1', margin: 0, fontWeight: 700 }}>
          Phòng thi: <b style={{ color: '#38bdf8' }}>{activeRoomId}</b> • Tổng số thí sinh tham dự: <b style={{ color: '#4ade80' }}>{allPlayers.length} Học sinh</b> • Chương trình GDPT 2018
        </p>
      </div>

      {/* 3 Khối Vinh Danh Đặc Biệt: Quán Quân Rung Chuông Vàng • Quán Quân Diệt Boss • Đội Vô Địch Kéo Co */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
        gap: '14px',
        maxWidth: '1150px',
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
                ? `Còn ${bellChampion.lives ?? 3} ❤️ • ${bellChampion.correct || 0} câu đúng • ${(bellChampion.fastScore || 0) + (bellChampion.correct || 0) * 100}đ`
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
                ? `Sát thương: ${(bossChampion.fastScore || 0) + (bossChampion.correct || 0) * 100} HP • ${bossChampion.correct || 0} câu đúng`
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

      {/* Bục Vinh Danh Top 3 (Nếu có học sinh) */}
      {top1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: '16px',
          maxWidth: '760px',
          width: '100%',
          margin: '4px auto 20px auto',
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
                {top2.correct || 0} đúng • {(top2.fastScore || 0) + (top2.correct || 0) * 100}đ
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
              {top1.correct || 0} câu đúng • {(top1.fastScore || 0) + (top1.correct || 0) * 100} điểm
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
              <div style={{ fontSize: '12px', color: '#ffffff', letterSpacing: '1px' }}>TOP 1 XUẤT SẮC NHẤT 🏆</div>
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
                {top3.correct || 0} đúng • {(top3.fastScore || 0) + (top3.correct || 0) * 100}đ
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

      {/* BẢNG VÀNG VINH DANH TOP 10 THÍ SINH XUẤT SẮC NHẤT */}
      <div style={{
        maxWidth: '1150px',
        width: '100%',
        background: 'rgba(15, 23, 42, 0.95)',
        borderRadius: '20px',
        border: '2px solid #38bdf8',
        boxShadow: '0 15px 40px rgba(0,0,0,0.65)',
        padding: '16px 20px',
        marginBottom: '20px'
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
          <h3 style={{ margin: 0, fontSize: '18px', color: '#fef08a', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🌟 BẢNG VÀNG VINH DANH TOP 10 HỌC SINH XUẤT SẮC NHẤT</span>
          </h3>
          <span style={{ fontSize: '12.5px', color: '#7dd3fc', fontWeight: 800 }}>
            Xếp hạng theo Tổng Điểm & Số Câu Trả Lời Đúng (Chuẩn GDPT 2018)
          </span>
        </div>

        {top10Players.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px', color: '#94a3b8', fontSize: '15px', fontWeight: 800 }}>
            Chưa có dữ liệu thí sinh trong trận đấu này.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#1e293b', color: '#38bdf8', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', borderRadius: '10px 0 0 10px' }}>HẠNG</th>
                  <th style={{ padding: '10px 12px' }}>HỌ VÀ TÊN THÍ SINH</th>
                  <th style={{ padding: '10px 12px' }}>{matchState.gameType === 'TUG' ? 'ĐỘI THI ĐẤU' : 'TRẠNG THÁI'}</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>SỐ CÂU ĐÚNG</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>TỔNG ĐIỂM</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', borderRadius: '0 10px 10px 0' }}>ĐIỂM QUY ĐỔI (THANG 10)</th>
                </tr>
              </thead>
              <tbody>
                {top10Players.map((player, idx) => {
                  const rank = idx + 1;
                  const info = getGradeInfo(player, rank);
                  const totalPts = (player.fastScore || 0) + (player.correct || 0) * 100;
                  return (
                    <tr
                      key={player.id}
                      style={{
                        borderBottom: '1px solid #1e293b',
                        background: rank === 1
                          ? 'rgba(234, 179, 8, 0.16)'
                          : rank <= 3
                          ? 'rgba(56, 189, 248, 0.08)'
                          : 'transparent'
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 900, fontSize: '15px', color: rank === 1 ? '#fde047' : rank === 2 ? '#e2e8f0' : rank === 3 ? '#fdba74' : '#94a3b8' }}>
                        {rank === 1 ? '🥇 Hạng 1' : rank === 2 ? '🥈 Hạng 2' : rank === 3 ? '🥉 Hạng 3' : `#${rank}`}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 900, color: '#ffffff', fontSize: '15px' }}>
                        {player.label}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {matchState.gameType === 'TUG' ? (
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 900,
                            background: player.team === 'RED' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(2, 132, 199, 0.25)',
                            color: player.team === 'RED' ? '#fca5a5' : '#7dd3fc',
                            border: player.team === 'RED' ? '1px solid #ef4444' : '1px solid #0284c7'
                          }}>
                            {player.team === 'RED' ? '🔴 Đội Đỏ' : '🔵 Đội Xanh'}
                          </span>
                        ) : matchState.gameType === 'BELL' ? (
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 900,
                            background: player.eliminated ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                            color: player.eliminated ? '#fde047' : '#6ee7b7'
                          }}>
                            {player.eliminated ? '📣 Khán giả cổ vũ' : `🔔 Trụ sàn (${player.lives ?? 3}❤️)`}
                          </span>
                        ) : (
                          <span style={{ color: '#cbd5e1', fontSize: '12.5px', fontWeight: 800 }}>
                            🌟 Cá nhân toàn lớp
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 900, color: '#4ade80', fontSize: '15px' }}>
                        {player.correct || 0} câu
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 900, color: '#38bdf8', fontSize: '15px' }}>
                        {totalPts} điểm
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '999px',
                          fontWeight: 900,
                          fontSize: '13px',
                          background: info.grade >= 9.5 ? '#fef08a' : info.grade >= 9.0 ? '#bbf7d0' : '#bae6fd',
                          color: '#0f172a'
                        }}>
                          {info.grade} điểm
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Thanh Công Cụ Điều Khiển Màn Hình Vinh Danh */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        justifyContent: 'center',
        maxWidth: '1050px',
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
          📊 TẢI BẢNG ĐIỂM (.CSV)
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
