import React, { useState } from 'react';
import { Player, GamePlayType } from '../types';
import { getConvertedGradeByRank } from '../data/defaultSubjects';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  gameType: GamePlayType;
  allPlayers: Player[];
  activeRoomId: string;
  onDownloadCSV: () => void;
  onPrintPDFEvidence?: () => void;
}

export const Top10LeaderboardModal: React.FC<Props> = ({
  isOpen,
  onClose,
  gameType,
  allPlayers,
  activeRoomId,
  onDownloadCSV,
  onPrintPDFEvidence
}) => {
  const [activeTab, setActiveTab] = useState<GamePlayType>(gameType || 'BELL');

  if (!isOpen) return null;

  // 1. RUNG CHUÔNG VÀNG LEADERBOARD
  // Sorted by: Alive status first, then lives remaining desc, streak desc, correct answers desc
  const bellLeaderboard = [...allPlayers].sort((a, b) => {
    if (!a.eliminated && b.eliminated) return -1;
    if (a.eliminated && !b.eliminated) return 1;
    if (b.lives !== a.lives) return b.lives - a.lives;
    if (b.streak !== a.streak) return b.streak - a.streak;
    return b.correct - a.correct;
  });

  // 2. AI NHANH NHẤT LEADERBOARD
  // Sorted by fastScore desc, then correct desc
  const fastLeaderboard = [...allPlayers].sort((a, b) => {
    if ((b.fastScore || 0) !== (a.fastScore || 0)) {
      return (b.fastScore || 0) - (a.fastScore || 0);
    }
    return b.correct - a.correct;
  });

  // 3. ĐÁNH BOSS / KÉO CO LEADERBOARD
  // Sorted by correct desc, streak desc, lives desc
  const bossLeaderboard = [...allPlayers].sort((a, b) => {
    const scoreA = a.correct * 100 + a.streak * 25 + (a.lives || 0) * 10;
    const scoreB = b.correct * 100 + b.streak * 25 + (b.lives || 0) * 10;
    return scoreB - scoreA;
  });

  // Select active list
  const currentList = activeTab === 'BELL'
    ? bellLeaderboard
    : activeTab === 'FAST'
    ? fastLeaderboard
    : bossLeaderboard;

  const top10 = currentList.slice(0, 10);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { medal: '🥇', label: 'Quán Quân', bg: 'linear-gradient(135deg, #fbbf24, #d97706)', text: '#78350f' };
    if (rank === 2) return { medal: '🥈', label: 'Á Quân', bg: 'linear-gradient(135deg, #e2e8f0, #94a3b8)', text: '#334155' };
    if (rank === 3) return { medal: '🥉', label: 'Hạng Ba', bg: 'linear-gradient(135deg, #fdba74, #ea580c)', text: '#7c2d12' };
    return { medal: `#${rank}`, label: `Top ${rank}`, bg: '#1e293b', text: '#94a3b8' };
  };

  const getGradeForPlayer = (player: Player, rank: number, tab: GamePlayType) => {
    if (tab === 'FAST') {
      return getConvertedGradeByRank(rank, player.fastScore || 0);
    }
    if (tab === 'BELL') {
      if (!player.eliminated) {
        if (rank === 1) return { grade: 10, note: 'Xuất sắc trụ sàn (10đ)' };
        if (rank <= 3) return { grade: 10, note: 'Trụ sàn vững vàng (10đ)' };
        if (rank <= 6) return { grade: 9.5, note: 'Trụ sàn xuất sắc (9.5đ)' };
        return { grade: 9.0, note: 'Trụ sàn tích cực (9.0đ)' };
      }
      if (player.correct >= 8) return { grade: 8.5, note: 'Khá giỏi (8.5đ)' };
      if (player.correct >= 5) return { grade: 8.0, note: 'Đạt chuẩn (8.0đ)' };
      return { grade: 7.0, note: 'Cần cố gắng (7.0đ)' };
    }
    // Boss / Tug
    if (rank <= 3) return { grade: 10, note: 'Đại dũng sĩ (10đ)' };
    if (rank <= 6) return { grade: 9.0, note: 'Chiến binh xuất sắc (9.0đ)' };
    if (rank <= 10) return { grade: 8.5, note: 'Hộ vệ tích cực (8.5đ)' };
    return { grade: 8.0, note: 'Đóng góp tốt (8.0đ)' };
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 7, 18, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 1300,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)',
        border: '3px solid #f59e0b',
        boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(245, 158, 11, 0.35)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '820px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#ffffff'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(90deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)',
          borderBottom: '2px solid #f59e0b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>🏆</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 900, color: '#fef08a' }}>
                BẢNG VINH DANH TOP 10 XUẤT SẮC NHẤT
              </h2>
              <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                Mã phòng: <b style={{ color: '#38bdf8' }}>{activeRoomId}</b> • Tổng sĩ số: <b>{allPlayers.length} thí sinh</b>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              color: '#ffffff',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Game Mode Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '10px 18px',
          background: '#090d16',
          borderBottom: '1px solid #334155',
          overflowX: 'auto'
        }}>
          <button
            onClick={() => setActiveTab('BELL')}
            style={{
              padding: '8px 14px',
              borderRadius: '12px',
              border: activeTab === 'BELL' ? '2px solid #f59e0b' : '1px solid #334155',
              background: activeTab === 'BELL' ? 'linear-gradient(135deg, #d97706, #b45309)' : '#1e293b',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            🔔 Top 10 Rung Chuông Vàng
          </button>
          <button
            onClick={() => setActiveTab('FAST')}
            style={{
              padding: '8px 14px',
              borderRadius: '12px',
              border: activeTab === 'FAST' ? '2px solid #9333ea' : '1px solid #334155',
              background: activeTab === 'FAST' ? 'linear-gradient(135deg, #9333ea, #6b21a8)' : '#1e293b',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            ⚡ Top 10 Ai Nhanh Nhất
          </button>
          <button
            onClick={() => setActiveTab('BOSS')}
            style={{
              padding: '8px 14px',
              borderRadius: '12px',
              border: activeTab === 'BOSS' ? '2px solid #ef4444' : '1px solid #334155',
              background: activeTab === 'BOSS' ? 'linear-gradient(135deg, #dc2626, #991b1b)' : '#1e293b',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            🐉 Top 10 Dũng Sĩ Diệt Boss
          </button>
        </div>

        {/* Table Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
          {top10.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: '#94a3b8' }}>
              <div style={{ fontSize: '42px', marginBottom: '8px' }}>⏳</div>
              <div style={{ fontSize: '15px', fontWeight: 800 }}>Chưa có dữ liệu thí sinh tham gia hoặc chưa bắt đầu thi đấu.</div>
              <div style={{ fontSize: '12.5px', marginTop: '4px', color: '#64748b' }}>Học sinh quét mã QR và trả lời câu hỏi sẽ tự động xuất hiện trên bảng này!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {top10.map((player, idx) => {
                const rank = idx + 1;
                const badge = getRankBadge(rank);
                const gradeInfo = getGradeForPlayer(player, rank, activeTab);

                return (
                  <div
                    key={player.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '14px',
                      background: rank === 1
                        ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.25), rgba(30, 41, 59, 0.8))'
                        : rank === 2
                        ? 'linear-gradient(90deg, rgba(148, 163, 184, 0.2), rgba(30, 41, 59, 0.8))'
                        : rank === 3
                        ? 'linear-gradient(90deg, rgba(234, 88, 12, 0.2), rgba(30, 41, 59, 0.8))'
                        : '#1e293b',
                      border: rank === 1
                        ? '1.5px solid #fde047'
                        : rank === 2
                        ? '1.5px solid #cbd5e1'
                        : rank === 3
                        ? '1.5px solid #fdba74'
                        : '1px solid #334155',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}
                  >
                    {/* Rank & Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '180px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: badge.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: rank <= 3 ? '18px' : '13px',
                        fontWeight: 900,
                        color: rank <= 3 ? '#ffffff' : '#94a3b8',
                        flexShrink: 0
                      }}>
                        {badge.medal}
                      </div>

                      <div>
                        <div style={{ fontWeight: 900, fontSize: '14.5px', color: '#f8fafc' }}>
                          {player.label}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                          Đội: <b style={{ color: player.team === 'RED' ? '#f87171' : '#38bdf8' }}>{player.team === 'RED' ? 'Đỏ' : 'Xanh'}</b>
                          {player.streak > 0 && <span style={{ color: '#fde047', marginLeft: '6px' }}>🔥 Chuỗi {player.streak}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Stats depending on Game Mode */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                      {activeTab === 'BELL' && (
                        <>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Số mạng</div>
                            <div style={{ fontSize: '13.5px', fontWeight: 900 }}>
                              {player.eliminated ? (
                                <span style={{ color: '#ef4444' }}>💀 Đã bị loại</span>
                              ) : (
                                <span>{'❤️'.repeat(Math.max(1, player.lives))} ({player.lives})</span>
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Đúng / Sai</div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#34d399' }}>
                              {player.correct}đ / <span style={{ color: '#f87171' }}>{player.wrongTotal || 0}s</span>
                            </div>
                          </div>
                        </>
                      )}

                      {activeTab === 'FAST' && (
                        <>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Điểm tốc độ</div>
                            <div style={{ fontSize: '15px', fontWeight: 900, color: '#38bdf8' }}>
                              {player.fastScore || 0}đ
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Số câu đúng</div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#34d399' }}>
                              {player.correct} câu
                            </div>
                          </div>
                        </>
                      )}

                      {activeTab === 'BOSS' && (
                        <>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Sát thương Boss</div>
                            <div style={{ fontSize: '14px', fontWeight: 900, color: '#f87171' }}>
                              💥 {player.correct * 100 + player.streak * 25} HP
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Đúng</div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#34d399' }}>
                              {player.correct} câu
                            </div>
                          </div>
                        </>
                      )}

                      {/* Converted Grade */}
                      <div style={{
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid #f59e0b',
                        borderRadius: '10px',
                        padding: '4px 10px',
                        textAlign: 'center',
                        minWidth: '70px'
                      }}>
                        <div style={{ fontSize: '10px', color: '#fbbf24', fontWeight: 900 }}>QUY ĐỔI</div>
                        <div style={{ fontSize: '16px', fontWeight: 900, color: '#fde047' }}>
                          {gradeInfo.grade}đ
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '12px 18px',
          background: '#090d16',
          borderTop: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            💡 Điểm số được tự động đồng bộ theo thời gian thực (Realtime).
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onDownloadCSV}
              style={{
                padding: '8px 14px',
                borderRadius: '11px',
                border: '1.5px solid #34d399',
                background: 'linear-gradient(135deg, #059669, #047857)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📊 Xuất Bảng Điểm (.CSV)
            </button>
            {onPrintPDFEvidence && (
              <button
                onClick={onPrintPDFEvidence}
                style={{
                  padding: '8px 14px',
                  borderRadius: '11px',
                  border: '1.5px solid #818cf8',
                  background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🖨️ In Minh Chứng
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '11px',
                border: '1px solid #64748b',
                background: '#334155',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '12.5px',
                cursor: 'pointer'
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
