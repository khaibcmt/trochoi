import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { MatchState, Player, GamePlayType } from '../types';
import { getConvertedGradeByRank } from '../data/defaultSubjects';

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
    const duration = 3.5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1200 };

    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        return clearInterval(interval);
      }
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: 0.15, y: 0.6 } });
      confetti({ ...defaults, particleCount, origin: { x: 0.85, y: 0.6 } });
      confetti({ ...defaults, particleCount, origin: { x: 0.5, y: 0.3 } });
    }, 280);

    return () => clearInterval(interval);
  }, []);

  const allPlayers: Player[] = [...matchState.redPlayers, ...matchState.bluePlayers];

  // Rank sorting based on active game mode
  const rankedPlayers = [...allPlayers].sort((a, b) => {
    if (matchState.gameType === 'BELL') {
      if (!a.eliminated && b.eliminated) return -1;
      if (a.eliminated && !b.eliminated) return 1;
      if ((b.lives || 0) !== (a.lives || 0)) return (b.lives || 0) - (a.lives || 0);
      if ((b.streak || 0) !== (a.streak || 0)) return (b.streak || 0) - (a.streak || 0);
      return (b.correct || 0) - (a.correct || 0);
    }
    if (matchState.gameType === 'FAST') {
      if ((b.fastScore || 0) !== (a.fastScore || 0)) return (b.fastScore || 0) - (a.fastScore || 0);
      return (b.correct || 0) - (a.correct || 0);
    }
    // Tug / Boss
    const scoreA = (a.correct || 0) * 100 + (a.fastScore || 0) + (a.streak || 0) * 20;
    const scoreB = (b.correct || 0) * 100 + (b.fastScore || 0) + (b.streak || 0) * 20;
    return scoreB - scoreA;
  });

  const top1 = rankedPlayers[0];
  const top2 = rankedPlayers[1];
  const top3 = rankedPlayers[2];
  const remainingPlayers = rankedPlayers.slice(3, 20);

  const getGradeInfo = (player: Player, rank: number) => {
    if (matchState.gameType === 'FAST') {
      return getConvertedGradeByRank(rank, player.fastScore || 0);
    }
    if (matchState.gameType === 'BELL') {
      if (!player.eliminated) {
        if (rank === 1) return { grade: 10, note: 'Thủ khoa trụ sàn xuất sắc' };
        if (rank <= 3) return { grade: 10, note: 'Trụ sàn xuất sắc' };
        if (rank <= 6) return { grade: 9.5, note: 'Trụ sàn vững vàng' };
        return { grade: 9.0, note: 'Trụ sàn tích cực' };
      }
      if (player.correct >= 8) return { grade: 8.5, note: 'Đạt thành tích tốt' };
      if (player.correct >= 5) return { grade: 8.0, note: 'Hoàn thành bài thi' };
      return { grade: 7.0, note: 'Cần rèn luyện thêm' };
    }
    // Tug / Boss
    if (rank <= 3) return { grade: 10, note: 'Chiến binh quả cảm (10đ)' };
    if (rank <= 6) return { grade: 9.5, note: 'Chiến binh xuất sắc (9.5đ)' };
    if (rank <= 10) return { grade: 9.0, note: 'Chiến binh tích cực (9.0đ)' };
    return { grade: 8.5, note: 'Đóng góp tốt (8.5đ)' };
  };

  const getVictoryTitle = () => {
    if (matchState.gameType === 'BOSS') {
      return '🐉 TOÀN THỂ LỚP HỌC ĐÃ TIÊU DIỆT BOSS KIẾN THỨC THÀNH CÔNG!';
    }
    if (matchState.gameType === 'BELL') {
      return '🔔 LỄ VINH DANH CÁC NHÀ VÔ ĐỊCH RUNG CHUÔNG VÀNG 3D!';
    }
    if (matchState.gameType === 'FAST') {
      return '⚡ BẢNG VÀNG THỦ KHOA TỐC ĐỘ & ĐIỂM SỐ XUẤT SẮC NHẤT!';
    }
    if (matchState.redRoundWins > matchState.blueRoundWins) {
      return '🔴 ĐỘI ĐỎ ĐOẠT CUP VÔ ĐỊCH KÉO CO 3D!';
    }
    if (matchState.blueRoundWins > matchState.redRoundWins) {
      return '🔵 ĐỘI XANH ĐOẠT CUP VÔ ĐỊCH KÉO CO 3D!';
    }
    return '🏆 TRẬN ĐẤU KẾT THÚC VỚI TỈ SỐ HÒA CỰC KỲ KỊCH TÍNH!';
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 150,
      overflowY: 'auto',
      background: 'radial-gradient(circle at 50% 15%, #1e1b4b 0%, #0f172a 50%, #020617 100%)',
      color: '#ffffff',
      padding: '24px 16px 40px 16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxSizing: 'border-box'
    }}>
      {/* Header Trophy Banner */}
      <div style={{ textAlign: 'center', maxWidth: '960px', width: '100%', marginBottom: '18px' }}>
        <div style={{ fontSize: '50px', marginBottom: '4px', filter: 'drop-shadow(0 0 20px rgba(245, 158, 11, 0.7))' }}>
          🏆
        </div>
        <h1 style={{
          fontSize: 'clamp(22px, 3.2vw, 36px)',
          fontWeight: 900,
          background: 'linear-gradient(90deg, #fef08a, #f59e0b, #fbbf24, #fef08a)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: '0 0 6px 0',
          letterSpacing: '0.5px'
        }}>
          {getVictoryTitle()}
        </h1>
        <p style={{ fontSize: '15px', color: '#cbd5e1', margin: 0 }}>
          Phòng thi: <b style={{ color: '#38bdf8' }}>{activeRoomId}</b> • Tổng số thí sinh: <b style={{ color: '#fef08a' }}>{allPlayers.length} HS</b> • Chương trình GDPT 2018
        </p>
      </div>

      {/* 3D Podium for Top 3 */}
      {top1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: '14px',
          maxWidth: '750px',
          width: '100%',
          margin: '10px auto 26px auto',
          padding: '0 10px'
        }}>
          {/* Top 2: Silver Podium (Left) */}
          {top2 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '26px', marginBottom: '2px' }}>🥈</div>
              <div style={{
                fontSize: '14px',
                fontWeight: 900,
                color: '#e2e8f0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '130px',
                textAlign: 'center'
              }}>
                {top2.label}
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginBottom: '6px' }}>
                {matchState.gameType === 'FAST' ? `${top2.fastScore || 0}đ` : `${top2.correct || 0} câu đúng`} • <span style={{ color: '#fde047', fontWeight: 900 }}>[{getGradeInfo(top2, 2).grade}đ]</span>
              </div>
              <div style={{
                width: '100%',
                height: '110px',
                background: 'linear-gradient(180deg, #94a3b8 0%, #475569 50%, #1e293b 100%)',
                border: '2px solid #cbd5e1',
                borderBottom: '6px solid #0f172a',
                borderRadius: '16px 16px 0 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                color: '#ffffff',
                fontWeight: 900
              }}>
                <div style={{ fontSize: '32px', color: '#e2e8f0' }}>2</div>
                <div style={{ fontSize: '11px', color: '#f1f5f9', letterSpacing: '0.5px' }}>Á QUÂN 1</div>
              </div>
            </div>
          ) : <div style={{ flex: 1 }} />}

          {/* Top 1: Gold Podium (Center, Highest) */}
          <div style={{ flex: 1.25, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '38px', marginBottom: '2px', filter: 'drop-shadow(0 0 15px rgba(253, 224, 71, 0.9))' }}>
              👑
            </div>
            <div style={{
              fontSize: '17px',
              fontWeight: 900,
              color: '#fde047',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '170px',
              textAlign: 'center'
            }}>
              {top1.label}
            </div>
            <div style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '8px' }}>
              {matchState.gameType === 'FAST' ? `${top1.fastScore || 0}đ` : `${top1.correct || 0} câu đúng`} • <span style={{ color: '#4ade80', fontWeight: 900, fontSize: '14px' }}>[{getGradeInfo(top1, 1).grade}đ]</span>
            </div>
            <div style={{
              width: '100%',
              height: '150px',
              background: 'linear-gradient(180deg, #f59e0b 0%, #d97706 45%, #78350f 100%)',
              border: '2.5px solid #fef08a',
              borderBottom: '8px solid #451a03',
              borderRadius: '20px 20px 0 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 15px 35px rgba(245, 158, 11, 0.5), inset 0 2px 4px rgba(255,255,255,0.4)',
              color: '#ffffff',
              fontWeight: 900
            }}>
              <div style={{ fontSize: '48px', color: '#fef08a', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>1</div>
              <div style={{ fontSize: '13px', color: '#fef08a', letterSpacing: '1px' }}>QUÁN QUÂN 🏆</div>
            </div>
          </div>

          {/* Top 3: Bronze Podium (Right) */}
          {top3 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '26px', marginBottom: '2px' }}>🥉</div>
              <div style={{
                fontSize: '14px',
                fontWeight: 900,
                color: '#fdba74',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '130px',
                textAlign: 'center'
              }}>
                {top3.label}
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginBottom: '6px' }}>
                {matchState.gameType === 'FAST' ? `${top3.fastScore || 0}đ` : `${top3.correct || 0} câu đúng`} • <span style={{ color: '#fde047', fontWeight: 900 }}>[{getGradeInfo(top3, 3).grade}đ]</span>
              </div>
              <div style={{
                width: '100%',
                height: '90px',
                background: 'linear-gradient(180deg, #d97706 0%, #b45309 50%, #451a03 100%)',
                border: '2px solid #fed7aa',
                borderBottom: '6px solid #290e02',
                borderRadius: '16px 16px 0 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                color: '#ffffff',
                fontWeight: 900
              }}>
                <div style={{ fontSize: '30px', color: '#fed7aa' }}>3</div>
                <div style={{ fontSize: '11px', color: '#ffedd5', letterSpacing: '0.5px' }}>Á QUÂN 2</div>
              </div>
            </div>
          ) : <div style={{ flex: 1 }} />}
        </div>
      )}

      {/* Leaderboard Table (Top 4 - 20) */}
      <div style={{
        maxWidth: '850px',
        width: '100%',
        background: 'rgba(15, 23, 42, 0.94)',
        borderRadius: '20px',
        border: '2px solid #334155',
        boxShadow: '0 15px 40px rgba(0,0,0,0.6)',
        padding: '16px 18px',
        marginBottom: '24px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '10px',
          borderBottom: '1.5px solid #334155',
          marginBottom: '10px'
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: '#fef08a', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📊 BẢNG THÀNH TÍCH TOÀN LỚP & QUY ĐỔI ĐIỂM SỐ</span>
          </h3>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            Thang điểm 10 theo thông tư GDPT 2018
          </span>
        </div>

        <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#1e293b', color: '#38bdf8', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px', borderRadius: '8px 0 0 8px' }}>HẠNG</th>
                <th style={{ padding: '8px 10px' }}>HỌ VÀ TÊN</th>
                <th style={{ padding: '8px 10px' }}>ĐỘI / LỚP</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>CÂU ĐÚNG</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>ĐIỂM ĐUA</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', borderRadius: '0 8px 8px 0' }}>ĐIỂM HỌC TẬP</th>
              </tr>
            </thead>
            <tbody>
              {rankedPlayers.slice(0, 20).map((player, idx) => {
                const rank = idx + 1;
                const info = getGradeInfo(player, rank);
                const isPodium = rank <= 3;
                return (
                  <tr
                    key={player.id}
                    style={{
                      borderBottom: '1px solid #1e293b',
                      background: isPodium ? (rank === 1 ? 'rgba(234, 179, 8, 0.12)' : 'rgba(255, 255, 255, 0.04)') : 'transparent'
                    }}
                  >
                    <td style={{ padding: '8px 10px', fontWeight: 900, color: rank === 1 ? '#fde047' : rank === 2 ? '#e2e8f0' : rank === 3 ? '#fdba74' : '#94a3b8' }}>
                      {rank === 1 ? '🥇 Top 1' : rank === 2 ? '🥈 Top 2' : rank === 3 ? '🥉 Top 3' : `#${rank}`}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 800, color: '#f8fafc' }}>
                      {player.label}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 900,
                        background: player.team === 'RED' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(2, 132, 199, 0.2)',
                        color: player.team === 'RED' ? '#fca5a5' : '#7dd3fc',
                        border: player.team === 'RED' ? '1px solid #ef4444' : '1px solid #0284c7'
                      }}>
                        {player.team === 'RED' ? 'Đội Đỏ' : 'Đội Xanh'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900, color: '#4ade80' }}>
                      {player.correct || 0}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900, color: '#38bdf8' }}>
                      {player.fastScore || 0}đ
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontWeight: 900,
                        fontSize: '12px',
                        background: info.grade >= 9.5 ? '#fef08a' : info.grade >= 9.0 ? '#bbf7d0' : info.grade >= 8.0 ? '#bae6fd' : '#e2e8f0',
                        color: '#0f172a'
                      }}>
                        {info.grade}đ
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grand Finale Action Buttons Row */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        justifyContent: 'center',
        maxWidth: '900px',
        width: '100%'
      }}>
        <button
          onClick={onReviewMatch}
          style={{
            padding: '11px 18px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #059669, #047857)',
            color: '#ffffff',
            border: '1.5px solid #6ee7b7',
            borderBottom: '4.5px solid #064e3b',
            fontWeight: 900,
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(5, 150, 105, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          📖 CHỮA BÀI TRÊN LỚP
        </button>

        <button
          onClick={onDownloadCSV}
          style={{
            padding: '11px 18px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #0d9488, #0f766e)',
            color: '#ffffff',
            border: '1.5px solid #5eead4',
            borderBottom: '4.5px solid #134e4a',
            fontWeight: 900,
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(13, 148, 136, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          📊 XUẤT BẢNG ĐIỂM (.CSV)
        </button>

        <button
          onClick={onExportHTMLSlide}
          style={{
            padding: '11px 18px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #d97706, #b45309)',
            color: '#ffffff',
            border: '1.5px solid #fde047',
            borderBottom: '4.5px solid #78350f',
            fontWeight: 900,
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(217, 119, 6, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🎨 TẢI SLIDE MÀU (.HTML)
        </button>

        <button
          onClick={onPrintPDFEvidence}
          style={{
            padding: '11px 18px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: '#ffffff',
            border: '1.5px solid #a5b4fc',
            borderBottom: '4.5px solid #3730a3',
            fontWeight: 900,
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🖨️ IN / LƯU PDF MINH CHỨNG
        </button>

        <button
          onClick={onRestartMatch}
          style={{
            padding: '11px 18px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            color: '#ffffff',
            border: '1.5px solid #7dd3fc',
            borderBottom: '4.5px solid #075985',
            fontWeight: 900,
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(2, 132, 199, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🔄 BẮT ĐẦU TRẬN MỚI
        </button>

        <button
          onClick={onReturnToSetup}
          style={{
            padding: '11px 18px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #475569, #334155)',
            color: '#ffffff',
            border: '1.5px solid #94a3b8',
            borderBottom: '4.5px solid #1e293b',
            fontWeight: 900,
            fontSize: '13.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🏠 VỀ CÀI ĐẶT
        </button>
      </div>
    </div>
  );
};
