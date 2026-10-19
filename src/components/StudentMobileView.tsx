import React, { useState, useEffect, useRef } from 'react';
import { GamePlayType, PlayerRole, PlayerTeam, QuizItem, CloudMessage, AvatarConfig, PowerUpType, QuestionFormat } from '../types';
import { AudioFX } from '../services/audio';
import { CloudNetwork, NetworkConnStatus } from '../services/network';
import {
  cleanQuestionTitleText,
  getStableShuffledQuestion,
  FASTEST_Q_DURATION_SEC,
  getPresetQuizBySubject
} from '../data/defaultSubjects';
import { MathRenderer } from '../utils/katexHelper';

interface Props {
  initialRoomId: string;
  initialTeam: PlayerTeam;
  initialGameType: GamePlayType;
  initialSubjectKey: string;
  onExitToSetup?: () => void;
}

export const StudentMobileView: React.FC<Props> = ({
  initialRoomId,
  initialTeam,
  initialGameType,
  initialSubjectKey,
  onExitToSetup
}) => {
  const [roomId, setRoomId] = useState(initialRoomId || '12345');
  const [studentName, setStudentName] = useState(() => localStorage.getItem('student_saved_name') || '');
  const [team, setTeam] = useState<PlayerTeam>(initialTeam || 'RED');
  const [gameType, setGameType] = useState<GamePlayType>(initialGameType || 'TUG');
  const [role, setRole] = useState<PlayerRole>('PULLER');

  // Avatar Customization State
  const [avatar, setAvatar] = useState<AvatarConfig>(() => {
    try {
      const saved = localStorage.getItem('student_saved_avatar');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      hairStyle: 'cap',
      costume: 'uniform',
      accessoryColor: '#f59e0b',
      expression: 'happy'
    };
  });

  // Power-up Inventory
  const [inventory, setInventory] = useState<PowerUpType[]>([]);
  const [activeShield, setActiveShield] = useState<boolean>(false);
  const [doublePowerActive, setDoublePowerActive] = useState<boolean>(false);
  const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([]);

  // True/False answers state for current question: { a: boolean, b: boolean, c: boolean, d: boolean }
  const [tfAnswers, setTfAnswers] = useState<Record<string, boolean>>({
    a: true,
    b: false,
    c: true,
    d: false
  });

  // Short answer text state
  const [shortAnswerInput, setShortAnswerInput] = useState<string>('');

  // Connection & Screen state
  const [connStatus, setConnStatus] = useState('🔄 Đang kết nối sân đấu 3D...');
  const [networkState, setNetworkState] = useState<NetworkConnStatus>('CONNECTED');
  const [screen, setScreen] = useState<'LOBBY' | 'WAITING' | 'QUIZ' | 'ELIMINATED'>('LOBBY');
  const [hasConfirmedEnter, setHasConfirmedEnter] = useState(false);

  // Gameplay state - Persistent student player ID per room to avoid losing score on disconnect/refresh
  const [myPlayerId] = useState(() => {
    try {
      const key = `kc3d_pid_${roomId}`;
      const saved = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (saved) return saved;
      const newId = 'hs_' + Math.random().toString(36).substring(2, 8);
      sessionStorage.setItem(key, newId);
      localStorage.setItem(key, newId);
      return newId;
    } catch {
      return 'hs_' + Math.random().toString(36).substring(2, 8);
    }
  });

  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [eliminated, setEliminated] = useState(false);
  const [matchStatText, setMatchStatText] = useState('Đang chờ trận đấu bắt đầu...');

  // Questions deck & pointers
  const [quizDeck, setQuizDeck] = useState<QuizItem[]>(() => getPresetQuizBySubject(initialSubjectKey || 'ALL_SUBJ'));
  const [currentGlobalQIndex, setCurrentGlobalQIndex] = useState(0);
  const [lastCompletedQIndex, setLastCompletedQIndex] = useState(-1);

  // Freeze state (20 seconds freeze on wrong answer, auto-unfrozen on new question)
  const [isFrozen, setIsFrozen] = useState(false);
  const [freezeSeconds, setFreezeSeconds] = useState(20);
  const freezeIntervalRef = useRef<any>(null);

  // Mandatory student name validation modal
  const [showNameAlert, setShowNameAlert] = useState(false);

  // Toast message
  const [bonusToastMsg, setBonusToastMsg] = useState<string | null>(null);

  // 30s Timer state
  const [remSec, setRemSec] = useState<number>(30);
  const timerRef = useRef<any>(null);
  const startMsRef = useRef<number>(Date.now());
  const [hasAnsweredCurrentQ, setHasAnsweredCurrentQ] = useState(false);

  // Stable shuffled options state (Shuffled once per question and frozen in place)
  interface StudentShuffledOption {
    originalIndex: number;
    letter: string;
    text: string;
  }
  const [shuffledOpts, setShuffledOpts] = useState<StudentShuffledOption[]>([]);
  const [selectedOptionOriginalIdx, setSelectedOptionOriginalIdx] = useState<number | null>(null);
  const [isAnswerLocked, setIsAnswerLocked] = useState<boolean>(false);
  const [lastLockedResult, setLastLockedResult] = useState<{ isCorrect: boolean; text: string } | null>(null);
  const lastShuffledQIndexRef = useRef<number>(-1);

  // FAST mode state - Persistent score in sessionStorage
  const [fastScore, setFastScore] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(`kc3d_score_${roomId}`);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });
  const [fastRank, setFastRank] = useState(0);
  const [fastAnswerFeedback, setFastAnswerFeedback] = useState<string | null>(null);

  // Save score to storage whenever updated
  useEffect(() => {
    try {
      sessionStorage.setItem(`kc3d_score_${roomId}`, String(fastScore));
    } catch {}
  }, [fastScore, roomId]);

  // Boss Mode state
  const [bossHP, setBossHP] = useState<number>(1000);
  const [maxBossHP, setMaxBossHP] = useState<number>(1000);

  // Tab switch anti-cheat warning
  const [tabWarning, setTabWarning] = useState<string | null>(null);

  // Save student name and avatar to localStorage
  const handleSaveProfile = (name: string, av: AvatarConfig) => {
    setStudentName(name);
    setAvatar(av);
    try {
      localStorage.setItem('student_saved_name', name);
      localStorage.setItem('student_saved_avatar', JSON.stringify(av));
    } catch {}
  };

  // Anti-cheat visibility listener
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && screen === 'QUIZ') {
        setTabWarning('⚠️ Chú ý: Phát hiện em chuyển tab! Hãy tập trung làm bài để đạt điểm cao!');
        setTimeout(() => setTabWarning(null), 4000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [screen]);

  // Connect to room with network status tracking
  useEffect(() => {
    CloudNetwork.connect(
      roomId,
      handleIncomingMessage,
      () => {
        setConnStatus(`🟢 Đã kết nối Phòng ${roomId}!`);
        setNetworkState('CONNECTED');
        sendEnter();
      },
      (newStatus) => {
        setNetworkState(newStatus);
        if (newStatus === 'CONNECTED') {
          setConnStatus(`🟢 Đã kết nối Phòng ${roomId}!`);
          sendEnter();
        } else if (newStatus === 'RECONNECTING') {
          setConnStatus(`🔄 Đang kết nối lại mạng...`);
        } else {
          setConnStatus(`⚠️ Mất kết nối mạng`);
        }
      }
    );

    const interval = setInterval(() => {
      if (!hasConfirmedEnter) {
        sendEnter();
      }
    }, 1800);

    return () => {
      clearInterval(interval);
      CloudNetwork.disconnect();
    };
  }, [roomId]);

  const sendEnter = () => {
    CloudNetwork.sendMessage({
      type: 'AUTO_ENTER_ARENA',
      playerId: myPlayerId,
      preferredTeam: team,
      playerName: studentName || 'Học sinh',
      avatar
    });
  };

  // 30s Local countdown timer per question
  useEffect(() => {
    if (screen !== 'QUIZ' || isFrozen || eliminated) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setRemSec(30);
    clearFreeze(); // Mở đóng băng khi hiện lên câu hỏi mới
    setHasAnsweredCurrentQ(false);
    setIsAnswerLocked(false);
    setSelectedOptionOriginalIdx(null);
    setLastLockedResult(null);
    setEliminatedOptions([]);
    setShortAnswerInput('');
    setTfAnswers({ a: true, b: false, c: true, d: false });
    startMsRef.current = Date.now();

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startMsRef.current) / 1000;
      const left = Math.max(0, 30 - elapsed);
      setRemSec(left);

      if (left <= 0) {
        clearInterval(timerRef.current);
        // Time expired and user didn't answer -> Treated as WRONG
        if (!hasAnsweredCurrentQ) {
          handleTimeoutFail();
        }
      }
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [screen, currentGlobalQIndex, isFrozen, eliminated]);

  // Xáo trộn đáp án ngẫu nhiên đúng 1 lần duy nhất cho mỗi câu hỏi và giữ cố định tuyệt đối tránh nhảy vị trí
  useEffect(() => {
    if (lastShuffledQIndexRef.current === currentGlobalQIndex && shuffledOpts.length > 0) {
      return;
    }
    const rawQ = quizDeck[currentGlobalQIndex % (quizDeck.length || 1)];
    if (!rawQ || !rawQ.opts || rawQ.opts.length === 0) {
      setShuffledOpts([]);
      return;
    }
    const items: StudentShuffledOption[] = rawQ.opts.map((text, idx) => ({
      originalIndex: idx,
      letter: String.fromCharCode(65 + idx),
      text
    }));
    // Fisher-Yates shuffle ngẫu nhiên đúng 1 lần
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    // Gán nhãn A, B, C, D cố định theo thứ tự hiển thị
    const finalized = items.map((it, pos) => ({
      ...it,
      letter: String.fromCharCode(65 + pos)
    }));
    lastShuffledQIndexRef.current = currentGlobalQIndex;
    setShuffledOpts(finalized);
  }, [currentGlobalQIndex]);

  const handleTimeoutFail = () => {
    if (activeShield) {
      setActiveShield(false);
      triggerBonusToast('🛡️ KHIÊN ĐÃ CHẶN ĐÒN PHẠT HẾT GIỜ!');
      return;
    }
    AudioFX.freezeCrack();
    triggerBonusToast('⌛ HẾT GIỜ! Chưa nộp câu trả lời bị tính là SAI!');
    CloudNetwork.sendMessage({
      type: 'FREEZE_WRONG',
      playerId: myPlayerId,
      team,
      globalQIndex: currentGlobalQIndex
    });
    setStreak(0);
    triggerFreeze(3);
  };

  const handleIncomingMessage = (d: CloudMessage) => {
    if (!d || !d.type) return;

    if (d.gameType) {
      setGameType(d.gameType);
    }
    if (d.quiz && Array.isArray(d.quiz) && d.quiz.length > 0) {
      setQuizDeck(d.quiz);
    }
    if (typeof d.bossHP === 'number') {
      setBossHP(d.bossHP);
    }
    if (typeof d.maxBossHP === 'number') {
      setMaxBossHP(d.maxBossHP);
    }

    if (d.type === 'ENTER_CONFIRMED' && d.playerId === myPlayerId) {
      setHasConfirmedEnter(true);
      if (d.team) setTeam(d.team);
      if (d.role) setRole(d.role);
      if (typeof d.globalQIndex === 'number') setCurrentGlobalQIndex(d.globalQIndex);
      if (typeof d.lives === 'number') setLives(d.lives);
      if (typeof d.streak === 'number') setStreak(d.streak);
      if (typeof d.eliminated === 'boolean') setEliminated(d.eliminated);
      if (typeof d.fastScore === 'number' && d.fastScore > 0) {
        setFastScore(d.fastScore);
        try {
          sessionStorage.setItem(`kc3d_score_${roomId}`, String(d.fastScore));
        } catch {}
      }

      if (d.matchStatus === 'PLAYING') {
        setScreen('QUIZ');
      }
    }
    else if (d.type === 'PLAYER_LIVES_SYNC' && d.playerId === myPlayerId) {
      if (typeof d.lives === 'number') setLives(d.lives);
      if (typeof d.streak === 'number') setStreak(d.streak);
      if (typeof d.eliminated === 'boolean') setEliminated(d.eliminated);

      if (d.bonusAwarded) {
        awardRandomPowerUp();
        triggerBonusToast("🔥 ĐÚNG 3 CÂU LIÊN TIẾP! CỘNG +1 ❤️ VÀ NHẬN THẺ KỸ NĂNG!");
      }
      if (d.rescuedNow) {
        setEliminated(false);
        setIsFrozen(false);
        setScreen('QUIZ');
        triggerBonusToast("🛟 THẦY ĐÃ CỨU TRỢ HỒI SINH EM TRỞ LẠI SÀN ĐẤU! (❤️)");
      } else if (d.eliminated) {
        setScreen('ELIMINATED');
      }
    }
    else if (d.type === 'RESCUE_ALL_PLAYERS') {
      setEliminated(false);
      setIsFrozen(false);
      setLives(1);
      setScreen('QUIZ');
      triggerBonusToast("🛟 TOÀN BỘ HỌC SINH ĐÃ ĐƯỢC CỨU TRỢ HỒI SINH! (❤️)");
    }
    else if (d.type === 'OPPONENT_FROZEN' && d.targetPlayerId === myPlayerId) {
      if (activeShield) {
        setActiveShield(false);
        triggerBonusToast('🛡️ KHIÊN BẢO VỆ ĐÃ CHẶN ĐÒN ĐÓNG BĂNG TỪ ĐỐI THỦ!');
      } else {
        triggerFreeze(3);
        triggerBonusToast('❄️ BẠN BỊ ĐỐI THỦ ĐÓNG BĂNG 3 GIÂY!');
      }
    }
    else if (d.type === 'HOST_HEARTBEAT') {
      if (d.gameType === 'BOSS') {
        const hp = d.bossHP ?? 1000;
        const maxHp = d.maxBossHP ?? 1000;
        setBossHP(hp);
        setMaxBossHP(maxHp);
        setMatchStatText(`🐉 Boss Máu: ${hp}/${maxHp} HP • Câu ${d.globalQIndex !== undefined ? d.globalQIndex + 1 : 1}`);
      } else if (d.gameType === 'BELL') {
        setMatchStatText(`Còn trụ: ${d.bellAliveCount || 0}/${d.bellTotalCount || 0} HS`);
      } else if (d.gameType === 'FAST') {
        setMatchStatText(`⚡ Đua Tốc Độ • Câu #${(d.globalQIndex || 0) + 1}`);
      } else {
        setMatchStatText(`Tỉ số kéo: Đỏ ${d.redRoundWins || 0} - Xanh ${d.blueRoundWins || 0}`);
      }

      if (typeof d.globalQIndex === 'number' && d.globalQIndex !== currentGlobalQIndex) {
        setCurrentGlobalQIndex(d.globalQIndex);
        setLastCompletedQIndex(-1);
        clearFreeze(); // Tự động mở đóng băng khi hiện lên câu hỏi mới
        if (d.status === 'PLAYING' && !eliminated) {
          setScreen('QUIZ');
        }
      }

      if (d.status === 'LOBBY' && screen !== 'LOBBY') {
        setScreen('WAITING');
      } else if (d.status === 'PLAYING' && !eliminated && screen !== 'QUIZ') {
        setScreen('QUIZ');
      } else if (d.status === 'ENDED' || d.status === 'ROUND_BREAK') {
        setScreen('WAITING');
      }
    }
    else if (d.type === 'QUESTION_START') {
      if (typeof d.qIndex === 'number') {
        setCurrentGlobalQIndex(d.qIndex);
        setLastCompletedQIndex(-1);
        clearFreeze(); // Tự động mở đóng băng khi hiện lên câu hỏi mới
        if (!eliminated) setScreen('QUIZ');
      }
    }
  };

  const awardRandomPowerUp = () => {
    const list: PowerUpType[] = ['SHIELD', 'FREEZE_OPPONENT', 'FIFTY_FIFTY', 'DOUBLE_POWER'];
    const chosen = list[Math.floor(Math.random() * list.length)];
    setInventory(prev => [...prev, chosen]);
  };

  const usePowerUp = (item: PowerUpType) => {
    setInventory(prev => {
      const idx = prev.indexOf(item);
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });

    if (item === 'SHIELD') {
      setActiveShield(true);
      triggerBonusToast('🛡️ Đã kích hoạt Khiên Bảo Vệ cho câu này!');
    } else if (item === 'DOUBLE_POWER') {
      setDoublePowerActive(true);
      triggerBonusToast('⚡ Đã kích hoạt Nhân Đôi Sức Kéo (x2 Power) nếu đúng câu này!');
    } else if (item === 'FREEZE_OPPONENT') {
      CloudNetwork.sendMessage({
        type: 'USE_POWERUP',
        playerId: myPlayerId,
        team,
        powerUpUsed: 'FREEZE_OPPONENT'
      });
      triggerBonusToast('❄️ Đã phóng băng giá đóng băng đối thủ 3 giây!');
    } else if (item === 'FIFTY_FIFTY') {
      // 50/50: remove 2 wrong options
      const curQ = quizDeck[currentGlobalQIndex % (quizDeck.length || 1)];
      if (curQ && curQ.opts.length > 2) {
        const wrongIndices = curQ.opts.map((_, i) => i).filter(i => i !== curQ.correct);
        const shuffled = [...wrongIndices].sort(() => 0.5 - Math.random());
        setEliminatedOptions(shuffled.slice(0, 2));
        triggerBonusToast('💡 Thẻ 50/50: Đã loại bỏ 2 phương án sai!');
      }
    }
  };

  const triggerBonusToast = (msg: string) => {
    setBonusToastMsg(msg);
    setTimeout(() => setBonusToastMsg(null), 3800);
  };

  const clearFreeze = () => {
    if (freezeIntervalRef.current) {
      clearInterval(freezeIntervalRef.current);
      freezeIntervalRef.current = null;
    }
    setIsFrozen(false);
    setFreezeSeconds(0);
  };

  const triggerFreeze = (sec: number = 20) => {
    clearFreeze();
    setIsFrozen(true);
    setFreezeSeconds(sec);
    freezeIntervalRef.current = setInterval(() => {
      setFreezeSeconds(prev => {
        if (prev <= 1) {
          clearFreeze();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Submit Answer for Multiple Choice
  const handleSelectMultipleChoice = (origIdx: number) => {
    if (isFrozen || eliminated || hasAnsweredCurrentQ || isAnswerLocked) return;
    setHasAnsweredCurrentQ(true);
    setIsAnswerLocked(true);
    setSelectedOptionOriginalIdx(origIdx);

    const rawQ = quizDeck[currentGlobalQIndex % (quizDeck.length || 1)];
    const isCorrect = origIdx === rawQ.correct;

    setLastLockedResult({
      isCorrect,
      text: isCorrect
        ? '✨ CHÍNH XÁC! Em được ưu tiên chuyển sang câu tiếp theo (Đáp án đã khóa an toàn)'
        : '❌ CHƯA CHÍNH XÁC! (Đáp án đã khóa)'
    });

    processAnswerOutcome(isCorrect, 1);
  };

  // Submit Answer for True/False (4 items)
  const handleSubmitTrueFalse = () => {
    if (isFrozen || eliminated || hasAnsweredCurrentQ || isAnswerLocked) return;
    setHasAnsweredCurrentQ(true);
    setIsAnswerLocked(true);

    const rawQ = quizDeck[currentGlobalQIndex % (quizDeck.length || 1)];
    const items = rawQ.tfItems || [];

    let correctCount = 0;
    items.forEach(item => {
      const userChoice = tfAnswers[item.label] ?? false;
      if (userChoice === item.isCorrect) {
        correctCount++;
      }
    });

    const isFullyCorrect = correctCount === items.length;
    const isMostlyCorrect = correctCount >= Math.ceil(items.length * 0.75);
    const won = isFullyCorrect || isMostlyCorrect;

    setLastLockedResult({
      isCorrect: won,
      text: won
        ? `✨ XUẤT SẮC! Đúng ${correctCount}/${items.length} ý! Em được ưu tiên mở câu tiếp theo`
        : `❌ Đúng ${correctCount}/${items.length} ý (Đáp án đã khóa)`
    });

    processAnswerOutcome(won, correctCount);
  };

  // Submit Answer for Short Answer / Fill-in
  const handleSubmitShortAnswer = () => {
    if (isFrozen || eliminated || hasAnsweredCurrentQ || isAnswerLocked || !shortAnswerInput.trim()) return;
    setHasAnsweredCurrentQ(true);
    setIsAnswerLocked(true);

    const rawQ = quizDeck[currentGlobalQIndex % (quizDeck.length || 1)];
    const correctVal = (rawQ.shortAnswer || rawQ.opts[0] || '').trim().toLowerCase();
    const userVal = shortAnswerInput.trim().toLowerCase();

    // Check numerical or string equivalence
    const isNumEqual = !isNaN(Number(correctVal)) && !isNaN(Number(userVal)) && Number(correctVal) === Number(userVal);
    const isStrEqual = correctVal === userVal;
    const isCorrect = isNumEqual || isStrEqual;

    processAnswerOutcome(isCorrect, 1);
  };

  // Common answer processor
  const processAnswerOutcome = (isCorrect: boolean, factor: number) => {
    const elapsedSec = (Date.now() - startMsRef.current) / 1000;

    if (isCorrect) {
      AudioFX.pullHeave();
      setStreak(prev => prev + 1);

      // Streak rewards
      if (streak + 1 >= 3) {
        awardRandomPowerUp();
        triggerBonusToast('🔥 CHUỖI 3 CÂU ĐÚNG! BẠN NHẬN ĐƯỢC 1 THẺ KỸ NĂNG!');
      }

      const powerMultiplier = doublePowerActive ? 2 : 1;
      setDoublePowerActive(false);

      CloudNetwork.sendMessage({
        type: 'PULL_CORRECT',
        playerId: myPlayerId,
        team,
        globalQIndex: currentGlobalQIndex,
        elapsedSec,
        correctCountInTF: factor,
        gainedPts: factor * powerMultiplier * 100
      });

      triggerBonusToast(doublePowerActive ? '⚡ X2 LỰC KÉO! CÂU TRẢ LỜI CHÍNH XÁC!' : '✨ CHÍNH XÁC! TUYỆT VỜI!');
    } else {
      if (activeShield) {
        setActiveShield(false);
        triggerBonusToast('🛡️ KHIÊN BẢO VỆ ĐÃ ĐỠ ĐÒN PHẠT CHO BẠN!');
      } else {
        AudioFX.freezeCrack();
        setStreak(0);
        CloudNetwork.sendMessage({
          type: 'FREEZE_WRONG',
          playerId: myPlayerId,
          team,
          globalQIndex: currentGlobalQIndex
        });
        triggerFreeze(20);
      }
    }

    setLastCompletedQIndex(currentGlobalQIndex);
  };

  // Ready in Tug Rope - Bắt buộc học sinh phải ghi tên, nếu không ghi hiện bảng thông báo
  const handleReadyInRope = () => {
    if (!studentName || !studentName.trim()) {
      setShowNameAlert(true);
      return;
    }
    AudioFX.stepInRope();
    CloudNetwork.sendMessage({
      type: 'PLAYER_READY_ROPE',
      playerId: myPlayerId,
      preferredTeam: team,
      playerName: studentName.trim(),
      avatar
    });
    setScreen('WAITING');
  };

  const currentQItem = quizDeck[currentGlobalQIndex % (quizDeck.length || 1)] || {
    qid: 0,
    q: 'Đang tải câu hỏi...',
    opts: ['A', 'B', 'C', 'D'],
    correct: 0,
    format: 'MULTIPLE_CHOICE'
  };

  return (
    <div id="student-view" style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: '#070b14', color: '#ffffff' }}>
      {/* Network reconnecting status banner avoiding loss of points */}
      {networkState !== 'CONNECTED' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 99999,
          background: 'linear-gradient(135deg, #7f1d1d, #991b1b)',
          color: '#ffffff',
          padding: '12px 16px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          borderBottom: '3px solid #fbbf24',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 900 }}>
            <span style={{ display: 'inline-block', fontSize: '18px' }}>🔄</span>
            <span>MẤT KẾT NỐI - ĐANG TỰ ĐỘNG KẾT NỐI LẠI...</span>
          </div>
          <div style={{ fontSize: '12.5px', color: '#fef08a', marginTop: '4px', fontWeight: 700 }}>
            🛡️ Điểm số ({fastScore}đ) và tiến trình thi đấu của bạn đã được bảo lưu an toàn tránh mất điểm!
          </div>
          <button
            onClick={() => CloudNetwork.reconnectImmediate()}
            style={{
              marginTop: '8px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#0f172a',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 14px',
              fontWeight: 900,
              fontSize: '12.5px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
          >
            ⚡ Thử Kết Nối Lại Ngay
          </button>
        </div>
      )}

      {/* Tab switch anti-cheat warning banner */}
      {tabWarning && (
        <div style={{ position: 'fixed', top: networkState !== 'CONNECTED' ? '88px' : 0, left: 0, right: 0, background: '#ef4444', color: '#fff', padding: '10px', textAlign: 'center', fontWeight: 900, zIndex: 1000 }}>
          {tabWarning}
        </div>
      )}

      {/* Screen 1: Lobby & Avatar Customizer */}
      {screen === 'LOBBY' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '18px 14px' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <h1 style={{ fontSize: '23px', fontWeight: 900, color: 'var(--gold)', margin: '0 0 6px 0' }}>
              🌾 ĐẤU TRƯỜNG 3D THPT
            </h1>
            <span style={{ fontSize: '13px', color: '#38bdf8' }}>{connStatus}</span>
          </div>

          <div style={{ background: '#0f172a', border: '1.5px solid #334155', borderRadius: '16px', padding: '16px', marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, marginBottom: '6px', color: '#cbd5e1' }}>
              Mã phòng đấu:
            </label>
            <input
              type="text"
              value={roomId}
              onChange={e => setRoomId(e.target.value.trim())}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #475569', background: '#1e293b', color: '#fef08a', fontSize: '16px', fontWeight: 900, textAlign: 'center', boxSizing: 'border-box' }}
            />

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, margin: '12px 0 6px 0', color: showNameAlert ? '#fca5a5' : '#cbd5e1' }}>
              Họ và tên học sinh / Số báo danh: {showNameAlert && <span style={{ color: '#ef4444', fontWeight: 900 }}>* (BẮT BUỘC)</span>}
            </label>
            <input
              id="student-name-input"
              type="text"
              placeholder="VD: Nguyễn Văn An - 12A1"
              value={studentName}
              onChange={e => {
                setShowNameAlert(false);
                handleSaveProfile(e.target.value, avatar);
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: showNameAlert ? '2px solid #ef4444' : '1.5px solid #475569',
                background: showNameAlert ? '#450a0a' : '#1e293b',
                color: '#ffffff',
                fontSize: '14.5px',
                fontWeight: 800,
                boxSizing: 'border-box'
              }}
            />
            {showNameAlert && (
              <div style={{ color: '#f87171', fontSize: '12px', marginTop: '5px', fontWeight: 800 }}>
                ⚠️ Bạn bắt buộc phải ghi tên trước khi vào phòng thi đấu!
              </div>
            )}
          </div>

          {/* 3D Chibi Avatar Customization */}
          <div style={{ background: '#0f172a', border: '1.5px solid #6366f1', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🎨 Tùy Chỉnh Nhân Vật Chibi 3D
            </h3>

            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>Kiểu mũ / Tóc:</span>
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'cap', label: '🧢 Mũ lưỡi trai' },
                  { id: 'headband', label: '🥋 Băng đô' },
                  { id: 'crown', label: '👑 Vương miện' },
                  { id: 'beret', label: '🎨 Mũ nồi' },
                  { id: 'cyber', label: '🎧 Tai nghe' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleSaveProfile(studentName, { ...avatar, hairStyle: item.id as any })}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      background: avatar.hairStyle === item.id ? '#6366f1' : '#1e293b',
                      color: '#fff',
                      border: '1px solid #475569',
                      cursor: 'pointer'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>Trang phục:</span>
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'uniform', label: '👕 Đồng phục' },
                  { id: 'aodai', label: '🌸 Áo dài' },
                  { id: 'superhero', label: '🦸 Siêu nhân' },
                  { id: 'sport', label: '🏃 Thể thao' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleSaveProfile(studentName, { ...avatar, costume: item.id as any })}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      background: avatar.costume === item.id ? '#10b981' : '#1e293b',
                      color: '#fff',
                      border: '1px solid #475569',
                      cursor: 'pointer'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>Màu sắc phụ kiện:</span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                {['#f59e0b', '#ef4444', '#0284c7', '#10b981', '#8b5cf6', '#ec4899'].map(c => (
                  <div
                    key={c}
                    onClick={() => handleSaveProfile(studentName, { ...avatar, accessoryColor: c })}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: c,
                      border: avatar.accessoryColor === c ? '2.5px solid #ffffff' : '1px solid rgba(255,255,255,0.3)',
                      cursor: 'pointer',
                      transform: avatar.accessoryColor === c ? 'scale(1.2)' : 'none'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Team Selector if Tug */}
          {gameType === 'TUG' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <button
                onClick={() => setTeam('RED')}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: team === 'RED' ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : '#1e293b',
                  color: '#fff',
                  border: team === 'RED' ? '2px solid #fca5a5' : '1px solid #475569',
                  fontWeight: 900,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                🔴 ĐỘI ĐỎ
              </button>
              <button
                onClick={() => setTeam('BLUE')}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: team === 'BLUE' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : '#1e293b',
                  color: '#fff',
                  border: team === 'BLUE' ? '2px solid #7dd3fc' : '1px solid #475569',
                  fontWeight: 900,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                🔵 ĐỘI XANH
              </button>
            </div>
          )}

          <button
            onClick={handleReadyInRope}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#0f172a',
              fontWeight: 900,
              fontSize: '16px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(245, 158, 11, 0.4)'
            }}
          >
            🚀 BẮT ĐẦU VÀO SÂN ĐẤU 3D
          </button>

          {/* Bảng thông báo bắt buộc học sinh phải ghi tên */}
          {showNameAlert && (
            <div style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 999999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}>
              <div style={{
                background: 'linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)',
                border: '3px solid #ef4444',
                borderRadius: '22px',
                padding: '24px 20px',
                maxWidth: '420px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 20px 50px rgba(239, 68, 68, 0.45)',
                color: '#ffffff',
                animation: 'bounceIn 0.35s ease-out'
              }}>
                <div style={{ fontSize: '50px', marginBottom: '8px' }}>⚠️</div>
                <h3 style={{ fontSize: '19px', fontWeight: 900, color: '#fca5a5', margin: '0 0 10px 0' }}>
                  BẮT BUỘC PHẢI GHI TÊN!
                </h3>
                <p style={{ fontSize: '14px', color: '#e2e8f0', lineHeight: 1.55, margin: '0 0 18px 0' }}>
                  Học sinh vào phòng thi đấu <b>bắt buộc phải ghi Họ và tên</b> hoặc <b>Số báo danh</b> để hệ thống và giáo viên ghi nhận kết quả, vinh danh thành tích!<br />
                  <span style={{ color: '#fef08a', fontSize: '13px' }}>Vui lòng nhập tên của bạn trước khi vào phòng.</span>
                </p>
                <button
                  onClick={() => {
                    setShowNameAlert(false);
                    setTimeout(() => {
                      const inputEl = document.getElementById('student-name-input');
                      if (inputEl) inputEl.focus();
                    }, 100);
                  }}
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: '15px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)'
                  }}
                >
                  ✏️ ĐÃ HIỂU - NHẬP TÊN NGAY
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Screen 2: Waiting screen */}
      {screen === 'WAITING' && (
        <div style={{ maxWidth: '480px', margin: '40px auto', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '42px', marginBottom: '12px' }}>⏳</div>
          <h2 style={{ fontSize: '20px', color: '#fef08a', margin: '0 0 10px 0' }}>
            ĐÃ SẴN SÀNG TRÊN SÀN ĐẤU!
          </h2>
          <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: 1.5 }}>
            Thí sinh: <b>{studentName || 'Học sinh'}</b> • Phòng <b>{roomId}</b><br />
            {matchStatText}
          </p>
          <div style={{ marginTop: '24px', padding: '14px', background: '#0f172a', borderRadius: '12px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>
              Chờ giáo viên bấm Bắt đầu thi đấu trên màn hình chính...
            </span>
          </div>
        </div>
      )}

      {/* Screen 3: Quiz Gameplay */}
      {screen === 'QUIZ' && (
        <div style={{ maxWidth: '520px', margin: '0 auto', padding: '12px' }}>
          {/* Header HUD */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '10px 14px', borderRadius: '14px', border: '1px solid #334155', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 900, color: '#fef08a' }}>
                {studentName || 'Thí sinh'}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                {matchStatText}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {(gameType === 'BELL' || gameType === 'BOSS') && (
                <div style={{ fontSize: '14px', color: '#ef4444' }}>
                  {'❤️'.repeat(Math.max(0, lives))}
                </div>
              )}
              {streak > 0 && (
                <div style={{ fontSize: '12px', background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontWeight: 900 }}>
                  🔥 x{streak}
                </div>
              )}
              {activeShield && (
                <div style={{ fontSize: '12px', background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontWeight: 900 }}>
                  🛡️ Khiên
                </div>
              )}
            </div>
          </div>

          {/* Boss HP Bar if Boss Mode */}
          {gameType === 'BOSS' && (
            <div style={{ background: '#450a0a', border: '1.5px solid #ef4444', borderRadius: '12px', padding: '8px 12px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 900, color: '#fca5a5', marginBottom: '4px' }}>
                <span>🐉 BOSS KIẾN THỨC</span>
                <span>{bossHP}/{maxBossHP} HP</span>
              </div>
              <div style={{ height: '8px', background: '#1c1917', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, (bossHP / maxBossHP) * 100))}%`, background: 'linear-gradient(90deg, #ef4444, #f97316)' }} />
              </div>
            </div>
          )}

          {/* Power-up Inventory Bar */}
          {inventory.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '6px 10px', background: '#1e1b4b', borderRadius: '12px', border: '1px solid #6366f1', marginBottom: '10px', overflowX: 'auto' }}>
              <span style={{ fontSize: '11px', fontWeight: 900, color: '#c7d2fe', whiteSpace: 'nowrap' }}>Túi kỹ năng:</span>
              {inventory.map((item, idx) => {
                const label = item === 'SHIELD' ? '🛡️ Khiên' : item === 'FREEZE_OPPONENT' ? '❄️ Đóng băng' : item === 'FIFTY_FIFTY' ? '💡 50/50' : '⚡ x2 Kéo';
                return (
                  <button
                    key={idx}
                    onClick={() => usePowerUp(item)}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: 900,
                      background: 'linear-gradient(135deg, #4f46e5, #3730a3)',
                      color: '#ffffff',
                      border: '1px solid #818cf8',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* 30s Countdown Bar */}
          <div style={{ height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
            <div
              style={{
                height: '100%',
                width: `${(remSec / 30) * 100}%`,
                background: remSec > 10 ? '#10b981' : remSec > 5 ? '#f59e0b' : '#ef4444',
                transition: 'width 0.1s linear'
              }}
            />
          </div>

          {/* Bonus Toast Notification */}
          {bonusToastMsg && (
            <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', padding: '10px 14px', borderRadius: '10px', fontWeight: 900, fontSize: '13px', textAlign: 'center', marginBottom: '10px' }}>
              {bonusToastMsg}
            </div>
          )}

          {/* Question Text with KaTeX */}
          <div style={{ background: '#0f172a', border: '1.5px solid #334155', borderRadius: '16px', padding: '14px', marginBottom: '12px' }}>
            <div style={{ fontSize: '11.5px', color: '#38bdf8', fontWeight: 800, marginBottom: '6px' }}>
              Câu hỏi #{currentGlobalQIndex + 1} • {currentQItem.format === 'TRUE_FALSE' ? 'Phần II: Đúng / Sai' : currentQItem.format === 'SHORT_ANSWER' ? 'Phần III: Trả Lời Ngắn' : 'Phần I: Trắc Nghiệm'}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, lineHeight: 1.4, color: '#ffffff' }}>
              <MathRenderer text={cleanQuestionTitleText(currentQItem.q)} />
            </div>
          </div>

          {/* Freeze overlay */}
          {isFrozen ? (
            <div style={{
              padding: '28px 16px',
              background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.25), rgba(2, 132, 199, 0.35))',
              border: '2.5px solid #38bdf8',
              borderRadius: '18px',
              textAlign: 'center',
              boxShadow: '0 8px 30px rgba(14, 165, 233, 0.35)'
            }}>
              <div style={{ fontSize: '46px', marginBottom: '8px' }}>❄️</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#bae6fd' }}>
                BẠN ĐÃ BỊ ĐÓNG BĂNG 20 GIÂY VÌ TRẢ LỜI SAI!
              </div>
              <div style={{ fontSize: '14px', color: '#fef08a', marginTop: '8px', fontWeight: 800 }}>
                ❌ Bạn đã mất lượt và không thể thao tác trong câu hỏi này.
              </div>
              <div style={{ fontSize: '15px', color: '#ffffff', marginTop: '8px', fontWeight: 900 }}>
                ⏳ Thời gian đóng băng còn lại: <span style={{ color: '#38bdf8', fontSize: '22px' }}>{freezeSeconds}s</span>
              </div>
              <div style={{ fontSize: '12.5px', color: '#a5f3fc', marginTop: '10px', background: 'rgba(15, 23, 42, 0.7)', padding: '6px 12px', borderRadius: '10px', display: 'inline-block' }}>
                🔓 Hệ thống sẽ tự động rã đông ngay khi xuất hiện câu hỏi mới!
              </div>
            </div>
          ) : (
            <>
              {/* Answer Locked Status Banner */}
              {isAnswerLocked && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '14px',
                  background: lastLockedResult?.isCorrect
                    ? 'linear-gradient(135deg, rgba(6, 78, 59, 0.95), rgba(4, 120, 87, 0.95))'
                    : 'linear-gradient(135deg, rgba(127, 29, 29, 0.95), rgba(153, 27, 27, 0.95))',
                  border: lastLockedResult?.isCorrect ? '2px solid #34d399' : '2px solid #f87171',
                  color: '#ffffff',
                  marginBottom: '10px',
                  textAlign: 'center',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.4)'
                }}>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: lastLockedResult?.isCorrect ? '#fef08a' : '#fca5a5' }}>
                    {lastLockedResult?.text}
                  </div>
                  {lastLockedResult?.isCorrect && (
                    <div style={{ fontSize: '12px', marginTop: '4px', color: '#d1fae5' }}>
                      🔒 Đáp án đã được khóa an toàn để tránh bấm nhầm. Hệ thống sẽ tự động mở khóa ngay khi câu hỏi mới bắt đầu!
                    </div>
                  )}
                </div>
              )}

              {/* Format 1: MULTIPLE_CHOICE (Stationary Shuffled Options) */}
              {(!currentQItem.format || currentQItem.format === 'MULTIPLE_CHOICE') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                  {(shuffledOpts.length > 0 ? shuffledOpts : (currentQItem.opts || []).map((o, idx) => ({ originalIndex: idx, letter: String.fromCharCode(65 + idx), text: o }))).map((optItem, pos) => {
                    const isEliminated = eliminatedOptions.includes(optItem.originalIndex);
                    if (isEliminated) return null;

                    const isSelected = selectedOptionOriginalIdx === optItem.originalIndex;
                    const colors = [
                      'linear-gradient(135deg, #ef4444, #b91c1c)',
                      'linear-gradient(135deg, #0284c7, #0369a1)',
                      'linear-gradient(135deg, #f59e0b, #d97706)',
                      'linear-gradient(135deg, #10b981, #047857)'
                    ];

                    return (
                      <button
                        key={`${optItem.originalIndex}_${pos}`}
                        disabled={hasAnsweredCurrentQ || isAnswerLocked}
                        onClick={() => handleSelectMultipleChoice(optItem.originalIndex)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '14px 16px',
                          borderRadius: '14px',
                          background: isSelected
                            ? (lastLockedResult?.isCorrect ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #b91c1c, #dc2626)')
                            : colors[pos % 4],
                          color: '#ffffff',
                          border: isSelected ? '3px solid #fef08a' : 'none',
                          cursor: (hasAnsweredCurrentQ || isAnswerLocked) ? 'not-allowed' : 'pointer',
                          textAlign: 'left',
                          fontSize: '15px',
                          fontWeight: 800,
                          boxShadow: isSelected ? '0 0 18px rgba(254, 240, 138, 0.8)' : '0 4px 12px rgba(0,0,0,0.3)',
                          opacity: (hasAnsweredCurrentQ || isAnswerLocked) ? (isSelected ? 1 : 0.45) : 1,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: isSelected ? '#ffffff' : 'rgba(255,255,255,0.25)', color: isSelected ? '#0f172a' : '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 900, flexShrink: 0 }}>
                          {isSelected ? (lastLockedResult?.isCorrect ? '✓' : '✗') : optItem.letter}
                        </span>
                        <span style={{ flex: 1 }}>
                          <MathRenderer text={optItem.text} />
                        </span>
                        {isSelected && (
                          <span style={{ fontSize: '12px', fontWeight: 900, color: '#fef08a' }}>
                            🔒 Đã chọn
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Format 2: TRUE_FALSE (4 items a, b, c, d) */}
              {currentQItem.format === 'TRUE_FALSE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(currentQItem.tfItems || []).map(item => {
                    const currentVal = tfAnswers[item.label] ?? false;
                    return (
                      <div
                        key={item.label}
                        style={{
                          background: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '12px',
                          padding: '10px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '10px'
                        }}
                      >
                        <div style={{ fontSize: '13.5px', color: '#e2e8f0', flex: 1 }}>
                          <b>{item.label})</b> <MathRenderer text={item.text} />
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          <button
                            disabled={hasAnsweredCurrentQ}
                            onClick={() => setTfAnswers(prev => ({ ...prev, [item.label]: true }))}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 900,
                              background: currentVal === true ? '#10b981' : '#1e293b',
                              color: currentVal === true ? '#ffffff' : '#94a3b8',
                              border: '1px solid #334155',
                              cursor: 'pointer'
                            }}
                          >
                            Đúng
                          </button>
                          <button
                            disabled={hasAnsweredCurrentQ}
                            onClick={() => setTfAnswers(prev => ({ ...prev, [item.label]: false }))}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 900,
                              background: currentVal === false ? '#ef4444' : '#1e293b',
                              color: currentVal === false ? '#ffffff' : '#94a3b8',
                              border: '1px solid #334155',
                              cursor: 'pointer'
                            }}
                          >
                            Sai
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    disabled={hasAnsweredCurrentQ}
                    onClick={handleSubmitTrueFalse}
                    style={{
                      marginTop: '6px',
                      padding: '14px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '15px',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: hasAnsweredCurrentQ ? 0.6 : 1
                    }}
                  >
                    {hasAnsweredCurrentQ ? '✓ ĐÃ NỘP BÀI' : '🚀 XÁC NHẬN NỘP BÀI (ĐÚNG/SAI)'}
                  </button>
                </div>
              )}

              {/* Format 3: SHORT_ANSWER (Fill-in) */}
              {currentQItem.format === 'SHORT_ANSWER' && (
                <div style={{ background: '#0f172a', border: '1.5px solid #6366f1', borderRadius: '16px', padding: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#a5b4fc', fontWeight: 800, marginBottom: '8px' }}>
                    Nhập con số hoặc từ khóa trả lời:
                  </label>
                  <input
                    type="text"
                    disabled={hasAnsweredCurrentQ}
                    placeholder="VD: 3 hoặc 12.5 hoặc ADN..."
                    value={shortAnswerInput}
                    onChange={e => setShortAnswerInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1.5px solid #475569',
                      background: '#1e293b',
                      color: '#ffffff',
                      fontSize: '16px',
                      fontWeight: 900,
                      textAlign: 'center',
                      boxSizing: 'border-box',
                      marginBottom: '12px'
                    }}
                  />
                  <button
                    disabled={hasAnsweredCurrentQ || !shortAnswerInput.trim()}
                    onClick={handleSubmitShortAnswer}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '15px',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: hasAnsweredCurrentQ ? 0.6 : 1
                    }}
                  >
                    {hasAnsweredCurrentQ ? '✓ ĐÃ GỬI CÂU TRẢ LỜI' : '🚀 GỬI CÂU TRẢ LỜI'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Screen 4: Eliminated Screen */}
      {screen === 'ELIMINATED' && (
        <div style={{ maxWidth: '480px', margin: '40px auto', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>💀</div>
          <h2 style={{ fontSize: '22px', color: '#ef4444', margin: '0 0 10px 0' }}>
            BẠN ĐÃ BỊ LOẠI KHỎI SÀN ĐẤU!
          </h2>
          <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: 1.5 }}>
            Bạn đã dùng hết 3 lượt chơi (❤️❤️❤️).<br />
            Hãy chú ý theo dõi màn hình lớn, <b>Thầy có thể tung phao cứu trợ hồi sinh bạn bất cứ lúc nào!</b>
          </p>
          <div style={{ marginTop: '20px', padding: '14px', background: '#0f172a', borderRadius: '12px', border: '1px dashed #ef4444' }}>
            <span style={{ fontSize: '13px', color: '#fca5a5' }}>
              🛟 Chờ tín hiệu Cứu Trợ từ Giáo Viên...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
