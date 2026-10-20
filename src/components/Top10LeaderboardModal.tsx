import React, { useState } from 'react';
import { Player, GamePlayType } from '../types';
import { getConvertedGradeByRank, getTeacherGradebookScore } from '../data/defaultSubjects';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  gameType: GamePlayType;
  allPlayers: Player[];
  activeRoomId: string;
  totalQuestions?: number;
  onDownloadCSV: () => void;
  onPrintPDFEvidence?: () => void;
}

export const Top10LeaderboardModal: React.FC<Props> = ({
  isOpen,
  onClose,
  gameType,
  allPlayers,
  activeRoomId,
  totalQuestions = 12,
  onDownloadCSV,
  onPrintPDFEvidence
}) => {
  const [boardViewMode, setBoardViewMode] = useState<'DUAL' | 'SCORE' | 'CORRECT'>('DUAL');

  if (!isOpen) return null;

  // 1. BẢNG XẾP HẠNG THEO TỔNG ĐIỂM THI ĐẤU (fastScore)
  // Trong trò Ai Nhanh Hơn (FAST) và Đánh Boss (BOSS): Chọn đúng +1000đ, chọn sai trừ -1000đ
  const scoreLeaderboard = [...allPlayers].sort((a, b) => {
    if (gameType === 'BELL') {
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

  // 2. BẢNG XẾP HẠNG THEO SỐ CÂU ĐÚNG (GHI SỔ ĐIỂM CỦA GIÁO VIÊN)
  // Tính theo số câu trả lời đúng (correct) để học sinh tham gia chơi có câu đúng vẫn có điểm ghi vào sổ điểm của giáo viên!
  const correctLeaderboard = [...allPlayers].sort((a, b) => {
    if ((b.correct || 0) !== (a.correct || 0)) {
      return (b.correct || 0) - (a.correct || 0);
    }
    if ((b.fastScore || 0) !== (a.fastScore || 0)) {
      return (b.fastScore || 0) - (a.fastScore || 0);
    }
    return (a.wrongTotal || 0) - (b.wrongTotal || 0);
  });

  const topScoreList = scoreLeaderboard.slice(0, 15);
  const topCorrectList = correctLeaderboard.slice(0, 15);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { medal: '🥇', label: 'Quán Quân', bg: 'linear-gradient(135deg, #fbbf24, #d97706)', text: '#78350f' };
    if (rank === 2) return { medal: '🥈', label: 'Á Quân', bg: 'linear-gradient(135deg, #e2e8f0, #94a3b8)', text: '#334155' };
    if (rank === 3) return { medal: '🥉', label: 'Hạng Ba', bg: 'linear-gradient(135deg, #fdba74, #ea580c)', text: '#7c2d12' };
    return { medal: `#${rank}`, label: `Hạng ${rank}`, bg: '#1e293b', text: '#94a3b8' };
  };

  const renderScoreBoardSection = () => (
    <div style={{
      background: 'rgba(15, 23, 42, 0.92)',
      border: '2px solid #f59e0b',
      borderRadius: '18px',
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1.5px solid rgba(245, 158, 11, 0.35)',
        paddingBottom: '8px',
        flexWrap: 'wrap',
        gap: '6px'
      }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 900, color: '#fde047' }}>
            🏆 BẢNG 1: XẾP HẠNG THEO TỔNG ĐIỂM THI ĐẤU
          </div>
          <div style={{ fontSize: '11.5px', color: '#cbd5e1', fontWeight: 700 }}>
            Đúng <b style={{ color: '#4ade80' }}>+1000 điểm</b> • Chọn sai ở Ai Nhanh Hơn & Đánh Boss <b style={{ color: '#f87171' }}>trừ -1000 điểm</b>
          </div>
        </div>
        <span style={{
          padding: '4px 10px',
          borderRadius: '999px',
          background: 'rgba(245, 158, 11, 0.2)',
          border: '1px solid #f59e0b',
          color: '#fef08a',
          fontSize: '11.5px',
          fontWeight: 900
        }}>
          Tính theo Tổng Điểm
        </span>
      </div>

      {topScoreList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 12px', color: '#94a3b8', fontWeight: 800 }}>
          Chưa có học sinh tham gia phòng {activeRoomId}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {topScoreList.map((player, idx) => {
            const rank = idx + 1;
            const badge = getRankBadge(rank);
            const scoreVal = player.fastScore || 0;
            const rankGrade = getConvertedGradeByRank(rank, scoreVal);

            return (
              <div
                key={`score-${player.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: '12px',
                  background: rank <= 3
                    ? 'linear-gradient(90deg, rgba(30, 41, 59, 0.96), rgba(51, 65, 85, 0.9))'
                    : 'rgba(15, 23, 42, 0.78)',
                  border: rank === 1 ? '1.5px solid #fbbf24' : '1px solid #334155'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: badge.bg,
                    color: badge.text,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: rank <= 3 ? '18px' : '13px',
                    fontWeight: 900,
                    flexShrink: 0
                  }}>
                    {badge.medal}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {player.label}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 700, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ color: '#4ade80' }}>✅ {player.correct || 0} đúng</span>
                      <span style={{ color: '#f87171' }}>❌ {player.wrongTotal || 0} sai</span>
                      {gameType === 'BELL' && (
                        <span style={{ color: '#fde047' }}>
                          {player.eliminated ? '📣 Khán giả' : `❤️ ${player.lives ?? 3} mạng`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: 900,
                    color: scoreVal < 0 ? '#f87171' : '#38bdf8'
                  }}>
                    {scoreVal} điểm
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#fde047', fontWeight: 800 }}>
                    Hạng #{rank} ({rankGrade.grade}đ)
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderTeacherGradebookSection = () => (
    <div style={{
      background: 'rgba(15, 23, 42, 0.92)',
      border: '2px solid #10b981',
      borderRadius: '18px',
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1.5px solid rgba(16, 185, 129, 0.35)',
        paddingBottom: '8px',
        flexWrap: 'wrap',
        gap: '6px'
      }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 900, color: '#6ee7b7' }}>
            📒 BẢNG 2: XẾP HẠNG THEO SỐ CÂU ĐÚNG (GHI SỔ ĐIỂM GV)
          </div>
          <div style={{ fontSize: '11.5px', color: '#cbd5e1', fontWeight: 700 }}>
            Tính theo <b style={{ color: '#4ade80' }}>Số câu trả lời đúng</b> — Học sinh chơi nhưng vẫn có điểm ghi vào Sổ điểm Giáo viên!
          </div>
        </div>
        <span style={{
          padding: '4px 10px',
          borderRadius: '999px',
          background: 'rgba(16, 185, 129, 0.2)',
          border: '1px solid #10b981',
          color: '#6ee7b7',
          fontSize: '11.5px',
          fontWeight: 900
        }}>
          Sổ Điểm Giáo Viên
        </span>
      </div>

      {topCorrectList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 12px', color: '#94a3b8', fontWeight: 800 }}>
          Chưa có học sinh tham gia phòng {activeRoomId}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {topCorrectList.map((player, idx) => {
            const rankByCorrect = idx + 1;
            const badge = getRankBadge(rankByCorrect);
            const gbInfo = getTeacherGradebookScore(player.correct || 0, totalQuestions, rankByCorrect);

            return (
              <div
                key={`correct-${player.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: '12px',
                  background: rankByCorrect <= 3
                    ? 'linear-gradient(90deg, rgba(6, 78, 59, 0.65), rgba(15, 23, 42, 0.92))'
                    : 'rgba(15, 23, 42, 0.78)',
                  border: rankByCorrect === 1 ? '1.5px solid #10b981' : '1px solid #334155'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: badge.bg,
                    color: badge.text,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: rankByCorrect <= 3 ? '18px' : '13px',
                    fontWeight: 900,
                    flexShrink: 0
                  }}>
                    {badge.medal}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {player.label}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#a7f3d0', fontWeight: 800, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span>✅ Đúng: <b>{player.correct || 0}/{totalQuestions} câu</b></span>
                      <span style={{ color: '#94a3b8' }}>• Điểm trò chơi: {player.fastScore || 0}đ</span>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    fontWeight: 900,
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)'
                  }}>
                    📒 {gbInfo.grade} điểm
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#6ee7b7', fontWeight: 800, marginTop: '2px' }}>
                    Ghi sổ điểm GV
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 7, 18, 0.88)',
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
        maxWidth: '1120px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#ffffff'
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px',
          background: 'linear-gradient(90deg, #78350f 0%, #b45309 50%, #78350f 100%)',
          borderBottom: '2px solid #fde047',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '30px' }}>🏆</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 900, color: '#fef08a', letterSpacing: '0.4px' }}>
                HỆ THỐNG KÉP 2 BẢNG XẾP HẠNG: TỔNG ĐIỂM THI ĐẤU & SỔ ĐIỂM GIÁO VIÊN
              </h2>
              <div style={{ fontSize: '12px', color: '#fed7aa', fontWeight: 700 }}>
                Phòng: <b>{activeRoomId}</b> • Tổng số: <b>{allPlayers.length} Học sinh</b> • Chơi vui kịch tính (-1000đ/câu sai) nhưng vẫn có Điểm Sổ Điểm Giáo Viên theo Số Câu Đúng!
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(0,0,0,0.35)',
              border: '1.5px solid #fde047',
              color: '#ffffff',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              fontSize: '16px',
              fontWeight: 900,
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          padding: '10px 16px',
          background: '#090d16',
          borderBottom: '1px solid #334155'
        }}>
          <button
            type="button"
            onClick={() => setBoardViewMode('DUAL')}
            style={{
              padding: '9px 12px',
              borderRadius: '12px',
              border: boardViewMode === 'DUAL' ? '2px solid #38bdf8' : '1px solid #334155',
              background: boardViewMode === 'DUAL' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : '#1e293b',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '12.5px',
              cursor: 'pointer'
            }}
          >
            📊 XEM SONG SONG CẢ 2 BẢNG XẾP HẠNG
          </button>

          <button
            type="button"
            onClick={() => setBoardViewMode('SCORE')}
            style={{
              padding: '9px 12px',
              borderRadius: '12px',
              border: boardViewMode === 'SCORE' ? '2px solid #fde047' : '1px solid #334155',
              background: boardViewMode === 'SCORE' ? 'linear-gradient(135deg, #d97706, #b45309)' : '#1e293b',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '12.5px',
              cursor: 'pointer'
            }}
          >
            🏆 BẢNG 1: XẾP HẠNG THEO TỔNG ĐIỂM (-1000Đ/SAI)
          </button>

          <button
            type="button"
            onClick={() => setBoardViewMode('CORRECT')}
            style={{
              padding: '9px 12px',
              borderRadius: '12px',
              border: boardViewMode === 'CORRECT' ? '2px solid #6ee7b7' : '1px solid #334155',
              background: boardViewMode === 'CORRECT' ? 'linear-gradient(135deg, #059669, #047857)' : '#1e293b',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '12.5px',
              cursor: 'pointer'
            }}
          >
            📒 BẢNG 2: XẾP HẠNG THEO SỐ CÂU ĐÚNG (GHI SỔ ĐIỂM GV)
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '14px 18px', overflowY: 'auto', flex: 1 }}>
          {boardViewMode === 'DUAL' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
              gap: '14px'
            }}>
              {renderScoreBoardSection()}
              {renderTeacherGradebookSection()}
            </div>
          ) : boardViewMode === 'SCORE' ? (
            renderScoreBoardSection()
          ) : (
            renderTeacherGradebookSection()
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '12px 20px',
          background: '#090d16',
          borderTop: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>
            💡 Bảng điểm CSV tải về có đầy đủ cả 2 cột: <b>Tổng Điểm Thi Đấu</b> và <b>Số Câu Đúng + Điểm Ghi Sổ Điểm Giáo Viên</b>.
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {onPrintPDFEvidence && (
              <button
                onClick={onPrintPDFEvidence}
                style={{
                  padding: '9px 14px',
                  borderRadius: '12px',
                  border: '1.5px solid #a5b4fc',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '12.5px',
                  cursor: 'pointer'
                }}
              >
                🖨️ IN HỒ SƠ MINH CHỨNG (PDF)
              </button>
            )}
            <button
              onClick={onDownloadCSV}
              style={{
                padding: '9px 16px',
                borderRadius: '12px',
                border: '1.5px solid #34d399',
                background: 'linear-gradient(135deg, #059669, #047857)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '12.5px',
                cursor: 'pointer'
              }}
            >
              📥 TẢI SỔ ĐIỂM GIÁO VIÊN (.CSV)
            </button>

            <button
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: '12px',
                border: '1px solid #475569',
                background: '#1e293b',
                color: '#cbd5e1',
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
