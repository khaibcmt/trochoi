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
  initialQuizList?: QuizItem[];
  onExitToSetup?: () => void;
}

export const StudentMobileView: React.FC<Props> = ({
  initialRoomId,
  initialTeam,
  initialGameType,
  initialSubjectKey,
  initialQuizList,
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
  const hasJoinedArenaRef = useRef<boolean>(false);

  // Questions deck & pointers - Đồng bộ câu hỏi trực tiếp từ Host màn hình chính theo đúng chỉ số qIndex
  const [quizDeck, setQuizDeck] = useState<QuizItem[]>(() => {
    if (initialQuizList && initialQuizList.length > 0) return initialQuizList;
    try {
      const savedCustom = localStorage.getItem('custom_Active_Quiz_V31');
      if (savedCustom) {
        const parsed = JSON.parse(savedCustom);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return getPresetQuizBySubject(initialSubjectKey || 'ALL_SUBJ');
  });
  const [broadcastQuestionMap, setBroadcastQuestionMap] = useState<Record<number, QuizItem>>({});
  const [currentBroadcastQ, setCurrentBroadcastQ] = useState<QuizItem | null>(null);
  const [currentGlobalQIndex, setCurrentGlobalQIndex] = useState(0);
  const currentGlobalQIndexRef = useRef(0);
  const [lastCompletedQIndex, setLastCompletedQIndex] = useState(-1);

  // Sync initialQuizList whenever parent updates it
  useEffect(() => {
    if (initialQuizList && initialQuizList.length > 0) {
      setQuizDeck(initialQuizList);
    }
  }, [initialQuizList]);

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
  const lastShuffledKeyRef = useRef<string>('');

  // Persistent score & correct count in sessionStorage/localStorage to preserve on reconnect
  const [fastScore, setFastScore] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(`kc3d_score_${roomId}`) || localStorage.getItem(`kc3d_score_${roomId}`);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });
  const [myCorrectCount, setMyCorrectCount] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(`kc3d_correct_${roomId}`) || localStorage.getItem(`kc3d_correct_${roomId}`);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });
  const [fastRank, setFastRank] = useState(0);
  const [fastAnswerFeedback, setFastAnswerFeedback] = useState<string | null>(null);
  const [cheerMessage, setCheerMessage] = useState<string | null>(null);

  // Save score and correct count to storage whenever updated
  useEffect(() => {
    try {
      sessionStorage.setItem(`kc3d_score_${roomId}`, String(fastScore));
      localStorage.setItem(`kc3d_score_${roomId}`, String(fastScore));
    } catch {}
  }, [fastScore, roomId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(`kc3d_correct_${roomId}`, String(myCorrectCount));
      localStorage.setItem(`kc3d_correct_${roomId}`, String(myCorrectCount));
    } catch {}
  }, [myCorrectCount, roomId]);

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
      avatar,
      savedScore: fastScore,
      savedCorrect: myCorrectCount
    });
  };

  const handleManualReconnect = () => {
    setConnStatus('🔄 Đang kết nối lại & khôi phục điểm số...');
    CloudNetwork.reconnectImmediate();
    setTimeout(() => {
      CloudNetwork.sendMessage({
        type: 'AUTO_ENTER_ARENA',
        playerId: myPlayerId,
        preferredTeam: team,
        playerName: studentName || 'Học sinh',
        avatar,
        savedScore: fastScore,
        savedCorrect: myCorrectCount
      });
      if (hasJoinedArenaRef.current || screen !== 'LOBBY') {
        CloudNetwork.sendMessage({
          type: 'PLAYER_READY_ROPE',
          playerId: myPlayerId,
          preferredTeam: team,
          playerName: studentName || 'Học sinh',
          avatar,
          savedScore: fastScore,
          savedCorrect: myCorrectCount
        });
      }
      setConnStatus(`🟢 Đã kết nối lại Phòng ${roomId} (Bảo lưu ${fastScore}đ • ${myCorrectCount} câu đúng)`);
      triggerBonusToast(`✅ Đã kết nối lại thành công! Bảo lưu ${fastScore} điểm (${myCorrectCount} câu đúng).`);
    }, 250);
  };

  // 30s Local countdown timer per question (Không reset trạng thái khóa đáp án khi hết đóng băng)
  useEffect(() => {
    if (screen !== 'QUIZ' || eliminated) {
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
  }, [screen, currentGlobalQIndex, eliminated]);

  const resolvedCurrentQ: QuizItem = broadcastQuestionMap[currentGlobalQIndex] ||
    (currentBroadcastQ && (currentBroadcastQ as any).qIndex === currentGlobalQIndex ? currentBroadcastQ : null) ||
    (quizDeck && quizDeck.length > 0 ? quizDeck[currentGlobalQIndex % quizDeck.length] : null) || {
      qid: 0,
      q: 'Đang tải câu hỏi...',
      opts: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
      correct: 0,
      format: 'MULTIPLE_CHOICE'
    };

  // Xáo trộn thứ tự đáp án của học sinh ĐÚNG 1 LẦN DUY NHẤT khi câu hỏi xuất hiện rồi ĐỨNG IM hoàn toàn (không bao giờ nhảy lại)
  const resolvedQSignature = `${currentGlobalQIndex}::${resolvedCurrentQ?.q || ''}::${(resolvedCurrentQ?.opts || []).join('|')}`;
  useEffect(() => {
    if (!resolvedCurrentQ || !resolvedCurrentQ.opts || resolvedCurrentQ.opts.length === 0) {
      setShuffledOpts([]);
      return;
    }
    if (lastShuffledKeyRef.current === resolvedQSignature && shuffledOpts.length > 0) {
      return;
    }
    lastShuffledKeyRef.current = resolvedQSignature;

    const baseItems = resolvedCurrentQ.opts.map((rawText, idx) => ({
      originalIndex: idx,
      cleanText: String(rawText || '').replace(/^[A-D][\.\:\)]\s*/i, '').trim() || String(rawText || '')
    }));

    // Deterministic seed per student + question index so it shuffles once and stays 100% locked
    const seedStr = `${myPlayerId}_q_${currentGlobalQIndex}_${resolvedCurrentQ.q}`;
    let hash = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
      hash ^= seedStr.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    let seed = Math.abs(hash) || 1234567;
    const nextRand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const copy = [...baseItems];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(nextRand() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }

    const finalItems: StudentShuffledOption[] = copy.map((item, pos) => ({
      originalIndex: item.originalIndex,
      letter: String.fromCharCode(65 + pos),
      text: item.cleanText
    }));

    setShuffledOpts(finalItems);
  }, [resolvedQSignature, myPlayerId, currentGlobalQIndex]);

  const handleTimeoutFail = () => {
    if (hasAnsweredCurrentQ || isAnswerLocked) return;
    setHasAnsweredCurrentQ(true);
    setIsAnswerLocked(true);

    AudioFX.freezeCrack();
    setStreak(0);

    if (gameType === 'BELL') {
      // Chỉ có trò Rung Chuông Vàng khi trả lời sai / hết giờ mới bị mất 1 mạng; hết 3 mạng rời cuộc chơi thành Khán giả cổ vũ
      setLives(prev => {
        const nextL = Math.max(0, prev - 1);
        setLastLockedResult({
          isCorrect: false,
          text: nextL <= 0
            ? '⏰ HẾT GIỜ! Bạn đã hết cả 3 ❤️ Mạng và chuyển sang làm Khán giả cổ vũ!'
            : `⏰ HẾT GIỜ! Tính câu SAI • Mất 1 ❤️ Mạng (Còn ${nextL} ❤️)`
        });
        if (nextL <= 0) {
          setEliminated(true);
          setScreen('ELIMINATED');
        }
        return nextL;
      });
    } else {
      // Các trò chơi khác: câu sai / hết giờ không bị phạt điểm hay mất mạng
      setLastLockedResult({
        isCorrect: false,
        text: '⏰ HẾT GIỜ! Chưa ghi nhận đáp án ở câu này (Không bị trừ điểm) • Chờ câu tiếp theo!'
      });
    }

    CloudNetwork.sendMessage({
      type: 'FREEZE_WRONG',
      playerId: myPlayerId,
      team,
      globalQIndex: currentGlobalQIndex
    });
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
      if (typeof d.globalQIndex === 'number') {
        currentGlobalQIndexRef.current = d.globalQIndex;
        setCurrentGlobalQIndex(d.globalQIndex);
      }
      if (d.question) {
        const qIdx = typeof (d.question as any).qIndex === 'number'
          ? (d.question as any).qIndex
          : (typeof d.globalQIndex === 'number' ? d.globalQIndex : currentGlobalQIndexRef.current);
        setBroadcastQuestionMap(prev => ({ ...prev, [qIdx]: d.question! }));
        setCurrentBroadcastQ({ ...d.question, qIndex: qIdx } as any);
      }
      if (d.quiz && Array.isArray(d.quiz) && d.quiz.length > 0) setQuizDeck(d.quiz);
      if (typeof d.lives === 'number') setLives(d.lives);
      if (typeof d.streak === 'number') setStreak(d.streak);
      if (typeof d.eliminated === 'boolean') setEliminated(d.eliminated);
      if (typeof d.fastScore === 'number' && d.fastScore > 0) {
        setFastScore(prev => Math.max(prev, d.fastScore!));
      }

      if (d.matchStatus === 'PLAYING' && hasJoinedArenaRef.current) {
        setScreen('QUIZ');
      } else if (d.matchStatus === 'LOBBY' && hasJoinedArenaRef.current) {
        setScreen('WAITING');
      }
    }
    else if (d.type === 'QUIZ_SYNC') {
      if (d.quiz && Array.isArray(d.quiz) && d.quiz.length > 0) {
        setQuizDeck(d.quiz);
        setBroadcastQuestionMap({});
      }
      if (d.question) {
        const qIdx = typeof d.qIndex === 'number' ? d.qIndex : currentGlobalQIndexRef.current;
        setBroadcastQuestionMap(prev => ({ ...prev, [qIdx]: d.question! }));
        setCurrentBroadcastQ({ ...d.question, qIndex: qIdx } as any);
      }
    }
    else if (d.type === 'GAME_SWITCH' || d.type === 'GAME_SWITCHED') {
      // Giáo viên đổi trò chơi hoặc bấm Chuẩn bị sàn đấu: Học sinh đang chơi KHÔNG cần quét lại mã QR!
      if (d.gameType) setGameType(d.gameType);
      if (d.quiz && Array.isArray(d.quiz) && d.quiz.length > 0) {
        setQuizDeck(d.quiz);
        setBroadcastQuestionMap({});
      }
      if (d.question) {
        setBroadcastQuestionMap({ 0: d.question });
        setCurrentBroadcastQ({ ...d.question, qIndex: 0 } as any);
      }
      const nextQIdx = d.qIndex ?? d.globalQIndex ?? 0;
      currentGlobalQIndexRef.current = nextQIdx;
      setCurrentGlobalQIndex(nextQIdx);
      setLastCompletedQIndex(-1);
      lastShuffledKeyRef.current = '';
      clearFreeze();
      setEliminated(false);
      setLives(3);
      setStreak(0);
      setFastScore(0);
      setMyCorrectCount(0);
      setHasAnsweredCurrentQ(false);
      setIsAnswerLocked(false);
      setSelectedOptionOriginalIdx(null);
      setLastLockedResult(null);

      if (hasJoinedArenaRef.current || screen !== 'LOBBY') {
        hasJoinedArenaRef.current = true;
        if (d.status === 'PLAYING') {
          setScreen('QUIZ');
          triggerBonusToast('🎮 Đã chuyển sang trò chơi mới — Bắt đầu thi đấu ngay!');
        } else {
          setScreen('WAITING');
          triggerBonusToast('📣 Giáo viên đang chuẩn bị sàn đấu / đổi trò chơi — Không cần quét lại QR!');
        }
      }
    }
    else if (d.type === 'PLAYER_LIVES_SYNC' && d.playerId === myPlayerId) {
      if (typeof d.lives === 'number') setLives(d.lives);
      if (typeof d.streak === 'number') setStreak(d.streak);
      if (typeof d.eliminated === 'boolean') setEliminated(d.eliminated);

      if (d.bonusAwarded && gameType === 'TUG') {
        awardRandomPowerUp();
        triggerBonusToast("🔥 ĐÚNG 3 CÂU LIÊN TIẾP! NHẬN THẺ KỸ NĂNG KÉO CO!");
      }
      if (d.rescuedNow) {
        setEliminated(false);
        setIsFrozen(false);
        setScreen('QUIZ');
        triggerBonusToast("🛟 THẦY ĐÃ CỨU TRỢ HỒI SINH EM TRỞ LẠI SÀN ĐẤU! (❤️)");
      } else if (d.eliminated && gameType === 'BELL') {
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
    else if (d.type === 'OPPONENT_FROZEN' && d.targetPlayerId === myPlayerId && gameType === 'TUG') {
      // Chỉ có trò Kéo Co (TUG) mới bị các hiệu ứng kỹ năng đóng băng
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

      if (d.quiz && Array.isArray(d.quiz) && d.quiz.length > 0) {
        setQuizDeck(d.quiz);
      }
      if (d.question) {
        const qIdx = typeof (d.question as any).qIndex === 'number'
          ? (d.question as any).qIndex
          : (typeof d.globalQIndex === 'number' ? d.globalQIndex : currentGlobalQIndexRef.current);
        setBroadcastQuestionMap(prev => {
          const existing = prev[qIdx];
          if (existing && existing.q === d.question!.q && JSON.stringify(existing.opts) === JSON.stringify(d.question!.opts)) {
            return prev;
          }
          return { ...prev, [qIdx]: d.question! };
        });
        setCurrentBroadcastQ(prev => {
          if (prev && (prev as any).qIndex === qIdx && prev.q === d.question!.q) return prev;
          return { ...d.question!, qIndex: qIdx } as any;
        });
      }

      if (typeof d.globalQIndex === 'number' && d.globalQIndex !== currentGlobalQIndexRef.current) {
        currentGlobalQIndexRef.current = d.globalQIndex;
        setCurrentGlobalQIndex(d.globalQIndex);
        setLastCompletedQIndex(-1);
        clearFreeze(); // Tự động mở đóng băng khi hiện lên câu hỏi mới
        if (d.status === 'PLAYING' && !eliminated && (hasJoinedArenaRef.current || screen !== 'LOBBY')) {
          setScreen('QUIZ');
        }
      }

      if (d.status === 'LOBBY' && screen !== 'LOBBY') {
        setEliminated(false);
        setScreen('WAITING');
      } else if (d.status === 'PLAYING' && !eliminated && screen === 'WAITING') {
        setScreen('QUIZ');
      } else if ((d.status === 'ENDED' || d.status === 'ROUND_BREAK') && screen !== 'LOBBY') {
        setScreen('WAITING');
      }
    }
    else if (d.type === 'QUESTION_START') {
      if (typeof d.qIndex === 'number') {
        currentGlobalQIndexRef.current = d.qIndex;
        setCurrentGlobalQIndex(d.qIndex);
        setLastCompletedQIndex(-1);
        clearFreeze(); // Tự động mở đóng băng khi hiện lên câu hỏi mới
        if (d.serverStartTime) {
          startMsRef.current = d.serverStartTime;
        } else {
          startMsRef.current = Date.now();
        }
        if (d.question) {
          setBroadcastQuestionMap(prev => ({ ...prev, [d.qIndex!]: d.question! }));
          setCurrentBroadcastQ({ ...d.question, qIndex: d.qIndex } as any);
        }
        if (d.quiz && Array.isArray(d.quiz) && d.quiz.length > 0) {
          setQuizDeck(d.quiz);
        }
        if (!eliminated && (hasJoinedArenaRef.current || screen !== 'LOBBY')) {
          setScreen('QUIZ');
        }
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

  // Submit Answer for Multiple Choice (Dạng thức I: Chỉ bấm 1 lần duy nhất trên 1 câu)
  const handleSelectMultipleChoice = (origIdx: number) => {
    if (isFrozen || eliminated || hasAnsweredCurrentQ || isAnswerLocked) return;
    setHasAnsweredCurrentQ(true);
    setIsAnswerLocked(true);
    setSelectedOptionOriginalIdx(origIdx);

    const isCorrect = Number(origIdx) === Number(resolvedCurrentQ.correct);

    setLastLockedResult({
      isCorrect,
      text: isCorrect
        ? '✅ CHÍNH XÁC! Bạn đã chọn ĐÚNG đáp án (+100 điểm)'
        : (gameType === 'BELL'
            ? '❌ ĐÁP ÁN SAI! Bạn bị mất 1 ❤️ Mạng ở câu này'
            : '❌ ĐÁP ÁN SAI! (Không bị trừ điểm • Đã khóa câu trả lời)')
    });

    processAnswerOutcome(isCorrect, isCorrect ? 1 : 0);
  };

  // Submit Answer for True/False (Dạng thức II: 4 ý a, b, c, d - Chỉ bấm nộp 1 lần duy nhất)
  const handleSubmitTrueFalse = () => {
    if (isFrozen || eliminated || hasAnsweredCurrentQ || isAnswerLocked) return;
    setHasAnsweredCurrentQ(true);
    setIsAnswerLocked(true);

    const items = resolvedCurrentQ.tfItems || [];

    let correctCount = 0;
    items.forEach(item => {
      const userChoice = tfAnswers[item.label] ?? false;
      if (userChoice === item.isCorrect) {
        correctCount++;
      }
    });

    const won = items.length > 0 && correctCount === items.length;

    setLastLockedResult({
      isCorrect: won,
      text: won
        ? `✅ XUẤT SẮC! Bạn trả lời ĐÚNG cả ${correctCount}/${items.length} mệnh đề (+${correctCount * 100} điểm)`
        : (gameType === 'BELL'
            ? `❌ CHƯA CHÍNH XÁC (${correctCount}/${items.length} ý đúng) • Bạn bị mất 1 ❤️ Mạng`
            : `❌ CHƯA TRỌN VẸN (${correctCount}/${items.length} ý đúng) • Đã khóa câu trả lời`)
    });

    processAnswerOutcome(won, won ? correctCount : 0);
  };

  // Submit Answer for Short Answer / Fill-in (Dạng thức III: Chỉ bấm gửi 1 lần duy nhất)
  const handleSubmitShortAnswer = () => {
    if (isFrozen || eliminated || hasAnsweredCurrentQ || isAnswerLocked || !shortAnswerInput.trim()) return;
    setHasAnsweredCurrentQ(true);
    setIsAnswerLocked(true);

    const correctVal = (resolvedCurrentQ.shortAnswer || resolvedCurrentQ.opts[0] || '').trim().toLowerCase();
    const userVal = shortAnswerInput.trim().toLowerCase();

    // Check numerical or string equivalence (support comma/dot decimal)
    const normCorrect = correctVal.replace(',', '.');
    const normUser = userVal.replace(',', '.');
    const isNumEqual = !isNaN(Number(normCorrect)) && !isNaN(Number(normUser)) && Number(normCorrect) === Number(normUser);
    const isStrEqual = correctVal === userVal;
    const isCorrect = isNumEqual || isStrEqual;

    setLastLockedResult({
      isCorrect,
      text: isCorrect
        ? `✅ CHÍNH XÁC! Kết quả "${shortAnswerInput.trim()}" hoàn toàn ĐÚNG (+100 điểm)`
        : (gameType === 'BELL'
            ? '❌ KẾT QUẢ SAI! Bạn bị mất 1 ❤️ Mạng ở câu này'
            : '❌ KẾT QUẢ SAI! (Không bị trừ điểm • Đã khóa câu trả lời)')
    });

    processAnswerOutcome(isCorrect, isCorrect ? 1 : 0);
  };

  // Common answer processor
  const processAnswerOutcome = (isCorrect: boolean, factor: number) => {
    const elapsedSec = (Date.now() - startMsRef.current) / 1000;

    if (isCorrect) {
      AudioFX.pullHeave();
      const nextStreak = streak + 1;
      setStreak(nextStreak);

      const powerMultiplier = (gameType === 'TUG' && doublePowerActive) ? 2 : 1;
      if (doublePowerActive) setDoublePowerActive(false);

      const gainedPts = Math.max(100, factor * powerMultiplier * 100);
      setFastScore(prev => prev + gainedPts);
      setMyCorrectCount(prev => prev + 1);

      // Chỉ có trò Kéo Co (TUG) mới có hiệu ứng thẻ kỹ năng
      if (gameType === 'TUG' && nextStreak >= 3) {
        awardRandomPowerUp();
        triggerBonusToast('🔥 CHUỖI 3 CÂU ĐÚNG! NHẬN 1 THẺ KỸ NĂNG KÉO CO!');
      }

      CloudNetwork.sendMessage({
        type: 'PULL_CORRECT',
        playerId: myPlayerId,
        team,
        globalQIndex: currentGlobalQIndex,
        elapsedSec,
        correctCountInTF: factor,
        gainedPts
      });
    } else {
      AudioFX.freezeCrack();
      setStreak(0);

      // Chỉ có trò Rung Chuông Vàng (BELL) khi trả lời sai mới mất 1 mạng, hết 3 mạng rời cuộc chơi thành Khán giả cổ vũ
      if (gameType === 'BELL') {
        setLives(prev => {
          const nextL = Math.max(0, prev - 1);
          if (nextL <= 0) {
            setEliminated(true);
            setScreen('ELIMINATED');
          }
          return nextL;
        });
      }

      CloudNetwork.sendMessage({
        type: 'FREEZE_WRONG',
        playerId: myPlayerId,
        team,
        globalQIndex: currentGlobalQIndex
      });
    }

    setLastCompletedQIndex(currentGlobalQIndex);
  };

  // Ready in Arena - Bắt buộc học sinh phải ghi tên
  const handleReadyInRope = () => {
    if (!studentName || !studentName.trim()) {
      setShowNameAlert(true);
      return;
    }
    hasJoinedArenaRef.current = true;
    AudioFX.stepInRope();
    CloudNetwork.sendMessage({
      type: 'PLAYER_READY_ROPE',
      playerId: myPlayerId,
      preferredTeam: team,
      playerName: studentName.trim(),
      avatar,
      savedScore: fastScore,
      savedCorrect: myCorrectCount
    });
    setScreen('WAITING');
  };

  const currentQItem = resolvedCurrentQ;

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
            <span>MẤT KẾT NỐI MẠNG - BẤM KẾT NỐI LẠI ĐỂ THI TIẾP!</span>
          </div>
          <div style={{ fontSize: '12.5px', color: '#fef08a', marginTop: '4px', fontWeight: 700 }}>
            🛡️ Điểm số ({fastScore}đ • {myCorrectCount} câu đúng) của bạn được bảo lưu 100%!
          </div>
          <button
            onClick={handleManualReconnect}
            style={{
              marginTop: '8px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#0f172a',
              border: 'none',
              borderRadius: '8px',
              padding: '7px 16px',
              fontWeight: 900,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
          >
            ⚡ KẾT NỐI LẠI ĐỂ THI TIẾP (BẢO LƯU ĐIỂM)
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
        <div style={{ maxWidth: '480px', margin: '36px auto', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '42px', marginBottom: '12px' }}>⏳</div>
          <h2 style={{ fontSize: '20px', color: '#fef08a', margin: '0 0 10px 0' }}>
            ĐÃ SẴN SÀNG TRÊN SÀN ĐẤU!
          </h2>
          <div style={{ display: 'inline-block', background: 'linear-gradient(135deg, #0284c7, #0369a1)', padding: '6px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 900, color: '#ffffff', marginBottom: '12px', border: '1.5px solid #7dd3fc' }}>
            {gameType === 'TUG' ? '⚔️ KÉO CO 3D (CHIA 2 ĐỘI)' : gameType === 'BELL' ? '🔔 RUNG CHUÔNG VÀNG 3D' : gameType === 'FAST' ? '⚡ ĐUA TỐC ĐỘ 3D (CÁ NHÂN)' : '🐉 DIỆT BOSS KIẾN THỨC'}
          </div>
          <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: 1.5 }}>
            Thí sinh: <b>{studentName || 'Học sinh'}</b> • Phòng <b>{roomId}</b><br />
            Thành tích bảo lưu: <b style={{ color: '#4ade80' }}>{fastScore} điểm ({myCorrectCount} câu đúng)</b><br />
            {matchStatText}
          </p>
          <div style={{ marginTop: '16px', padding: '14px', background: '#0f172a', borderRadius: '12px', border: '1.5px solid #10b981' }}>
            <div style={{ fontSize: '13.5px', color: '#6ee7b7', fontWeight: 800, marginBottom: '4px' }}>
              ✅ Đã giữ kết nối cố định trong phòng {roomId} (Không cần quét lại mã QR khi đổi trò chơi)
            </div>
            <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
              Đang chờ giáo viên tập hợp đủ học sinh và bấm Bắt đầu thi đấu trên màn hình chính...
            </span>
          </div>
          <button
            onClick={handleManualReconnect}
            style={{
              marginTop: '14px',
              padding: '10px 18px',
              borderRadius: '10px',
              background: '#1e293b',
              border: '1.5px solid #38bdf8',
              color: '#38bdf8',
              fontWeight: 900,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            🔄 Kết Nối Lại & Đồng Bộ Điểm ({fastScore}đ)
          </button>
        </div>
      )}

      {/* Screen 3: Quiz Gameplay */}
      {screen === 'QUIZ' && (
        <div style={{ maxWidth: '540px', margin: '0 auto', padding: '10px 12px' }}>
          <style>{`
            @keyframes chibiGentleSway {
              0%, 100% { transform: rotate(-4deg) translateY(0px); }
              50% { transform: rotate(4deg) translateY(0px); }
            }
          `}</style>
          {/* Header HUD with Cute Swaying Chibi Character & Reconnect Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '8px 12px', borderRadius: '14px', border: '1.5px solid #334155', marginBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Nhân vật hoạt hình Chibi đứng im chỉ lắc qua lắc lại */}
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: (gameType === 'TUG' && isFrozen)
                    ? 'linear-gradient(135deg, #0284c7, #38bdf8)'
                    : gameType === 'TUG'
                    ? (team === 'RED' ? 'linear-gradient(135deg, #dc2626, #991b1b)' : 'linear-gradient(135deg, #2563eb, #1e40af)')
                    : 'linear-gradient(135deg, #4f46e5, #3730a3)',
                  border: `2px solid ${avatar.accessoryColor || '#fef08a'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                }}
              >
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 64 64"
                  style={{
                    animation: 'chibiGentleSway 2.4s ease-in-out infinite',
                    transformOrigin: 'bottom center'
                  }}
                >
                  <rect
                    x="18"
                    y="40"
                    width="28"
                    height="18"
                    rx="9"
                    fill={
                      avatar.costume === 'superhero'
                        ? '#ef4444'
                        : avatar.costume === 'aodai'
                        ? '#ec4899'
                        : avatar.costume === 'sport'
                        ? '#10b981'
                        : '#3b82f6'
                    }
                  />
                  <path d="M26 40 L32 47 L38 40 Z" fill="#ffffff" />
                  <circle cx="32" cy="25" r="15" fill="#fde68a" />
                  <ellipse cx="22" cy="28" rx="3" ry="1.8" fill="#f87171" opacity="0.6" />
                  <ellipse cx="42" cy="28" rx="3" ry="1.8" fill="#f87171" opacity="0.6" />
                  {(gameType === 'TUG' && isFrozen) ? (
                    <>
                      <path d="M23 23 L27 27 M27 23 L23 27" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
                      <path d="M37 23 L41 27 M41 23 L37 27" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
                    </>
                  ) : (
                    <>
                      <circle cx="25" cy="25" r="2.8" fill="#0f172a" />
                      <circle cx="24" cy="24" r="1" fill="#ffffff" />
                      <circle cx="39" cy="25" r="2.8" fill="#0f172a" />
                      <circle cx="38" cy="24" r="1" fill="#ffffff" />
                    </>
                  )}
                  {(gameType === 'TUG' && isFrozen) ? (
                    <circle cx="32" cy="32" r="2.5" fill="#0284c7" />
                  ) : (
                    <path d="M27 30 Q32 35 37 30" stroke="#0f172a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                  )}
                  {avatar.hairStyle === 'crown' ? (
                    <polygon points="18,14 23,6 32,12 41,6 46,14" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
                  ) : avatar.hairStyle === 'cap' ? (
                    <>
                      <path d="M16 18 Q32 6 48 18 Z" fill={avatar.accessoryColor || '#f59e0b'} />
                      <rect x="16" y="16" width="35" height="4" rx="2" fill={avatar.accessoryColor || '#f59e0b'} />
                    </>
                  ) : (
                    <>
                      <path d="M16 22 Q20 8 32 9 Q44 8 48 22 Q40 14 32 15 Q24 14 16 22 Z" fill="#1e293b" />
                      <rect x="17" y="15" width="30" height="3.5" rx="1.5" fill={avatar.accessoryColor || '#f59e0b'} />
                    </>
                  )}
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#fef08a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{studentName || 'Thí sinh'}</span>
                  {gameType === 'TUG' && (
                    <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '6px', background: team === 'RED' ? '#dc2626' : '#0284c7', color: '#fff' }}>
                      {team === 'RED' ? 'Đội Đỏ' : 'Đội Xanh'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11.5px', color: '#4ade80', fontWeight: 800 }}>
                  ⭐ {fastScore} điểm • ✅ {myCorrectCount} câu đúng
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {/* Chỉ hiển thị mạng ❤️ trong trò Rung Chuông Vàng */}
              {gameType === 'BELL' && (
                <div style={{ fontSize: '14px', color: '#ef4444', fontWeight: 900, background: 'rgba(239,68,68,0.15)', padding: '3px 8px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.4)' }}>
                  {lives > 0 ? '❤️'.repeat(lives) : '💀 0 ❤️'}
                </div>
              )}
              {gameType === 'TUG' && activeShield && (
                <div style={{ fontSize: '11.5px', background: '#3b82f6', color: '#fff', padding: '2px 7px', borderRadius: '8px', fontWeight: 900 }}>
                  🛡️ Khiên
                </div>
              )}
              {gameType === 'TUG' && doublePowerActive && (
                <div style={{ fontSize: '11.5px', background: '#eab308', color: '#000', padding: '2px 7px', borderRadius: '8px', fontWeight: 900 }}>
                  ⚡ x2 Kéo
                </div>
              )}
              {gameType === 'TUG' && isFrozen && (
                <div style={{ fontSize: '11.5px', background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#fff', border: '1px solid #38bdf8', padding: '2px 7px', borderRadius: '8px', fontWeight: 900 }}>
                  ❄️ {freezeSeconds}s
                </div>
              )}
              {/* Nút kết nối lại để thi tiếp và bảo lưu số điểm */}
              <button
                type="button"
                onClick={handleManualReconnect}
                title="Bấm để kết nối lại mạng ngay lập tức và bảo lưu toàn bộ điểm số"
                style={{
                  background: '#1e293b',
                  border: '1.5px solid #38bdf8',
                  color: '#7dd3fc',
                  borderRadius: '8px',
                  padding: '4px 8px',
                  fontSize: '11.5px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                🔄 Kết nối lại
              </button>
            </div>
          </div>

          {/* Boss HP Bar if Boss Mode */}
          {gameType === 'BOSS' && (
            <div style={{ background: '#450a0a', border: '1.5px solid #ef4444', borderRadius: '12px', padding: '7px 12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 900, color: '#fca5a5', marginBottom: '4px' }}>
                <span>🐉 QUÁI VẬT BOSS KIẾN THỨC</span>
                <span>{bossHP}/{maxBossHP} HP</span>
              </div>
              <div style={{ height: '7px', background: '#1c1917', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, (bossHP / maxBossHP) * 100))}%`, background: 'linear-gradient(90deg, #ef4444, #f97316)' }} />
              </div>
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

          {/* Khung Câu Hỏi Nổi Bật Chuẩn 3 Dạng Thức THPT 2018 */}
          <div style={{
            background: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
            border: '2px solid #38bdf8',
            borderRadius: '18px',
            padding: '16px',
            marginBottom: '14px',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.45)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{
                fontSize: '12px',
                background: currentQItem.format === 'TRUE_FALSE' ? '#f59e0b' : currentQItem.format === 'SHORT_ANSWER' ? '#10b981' : '#0284c7',
                color: currentQItem.format === 'TRUE_FALSE' ? '#0f172a' : '#ffffff',
                padding: '3px 10px',
                borderRadius: '8px',
                fontWeight: 900
              }}>
                CÂU {currentGlobalQIndex + 1} • {currentQItem.format === 'TRUE_FALSE' ? 'DẠNG THỨC II: ĐÚNG / SAI (4 Ý)' : currentQItem.format === 'SHORT_ANSWER' ? 'DẠNG THỨC III: TRẢ LỜI NGẮN' : 'DẠNG THỨC I: 4 PHƯƠNG ÁN'}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 900, color: remSec <= 5 ? '#f87171' : '#fde047' }}>
                ⏱️ {Math.ceil(remSec)}s
              </span>
            </div>
            <div style={{ fontSize: '17.5px', fontWeight: 900, lineHeight: 1.42, color: '#ffffff' }}>
              <MathRenderer text={cleanQuestionTitleText(currentQItem.q)} />
            </div>
          </div>

          {/* KHI THÍ SINH ĐÃ BẤM CHỌN (CHỈ THAO TÁC 1 LẦN BẤM TRÊN 1 CÂU):
              - Chọn ĐÚNG: thông báo ĐÚNG rực rỡ, khóa mọi thao tác khác.
              - Chọn SAI: thông báo SAI và toàn bộ các nút đáp án BIẾN MẤT hoàn toàn, không cho thao tác gì khác! */}
          {(hasAnsweredCurrentQ || isAnswerLocked) && lastLockedResult ? (
            <div
              style={{
                padding: '26px 20px',
                borderRadius: '20px',
                background: lastLockedResult.isCorrect
                  ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)'
                  : 'linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%)',
                border: lastLockedResult.isCorrect ? '3px solid #4ade80' : '3px solid #f87171',
                textAlign: 'center',
                boxShadow: lastLockedResult.isCorrect
                  ? '0 12px 35px rgba(16, 185, 129, 0.45)'
                  : '0 12px 35px rgba(239, 68, 68, 0.45)',
                userSelect: 'none',
                pointerEvents: 'none'
              }}
            >
              <div style={{ fontSize: '52px', marginBottom: '10px' }}>
                {lastLockedResult.isCorrect ? '🎉' : '❌'}
              </div>
              <div style={{
                fontSize: '21px',
                fontWeight: 900,
                color: lastLockedResult.isCorrect ? '#a7f3d0' : '#fecaca',
                marginBottom: '8px',
                lineHeight: 1.35
              }}>
                {lastLockedResult.text}
              </div>
              <div style={{
                display: 'inline-block',
                marginTop: '6px',
                padding: '6px 14px',
                borderRadius: '999px',
                background: 'rgba(15, 23, 42, 0.55)',
                color: '#fef08a',
                fontSize: '13px',
                fontWeight: 800
              }}>
                🔒 Đã khóa thao tác câu #{currentGlobalQIndex + 1} (Chỉ bấm 1 lần/câu) • Đang chờ câu tiếp theo...
              </div>
            </div>
          ) : (
            <>
              {/* Dạng thức I: Trắc nghiệm 4 phương án A, B, C, D */}
              {(!currentQItem.format || currentQItem.format === 'MULTIPLE_CHOICE') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                  {(shuffledOpts.length > 0 ? shuffledOpts : (currentQItem.opts || []).map((o, idx) => ({ originalIndex: idx, letter: String.fromCharCode(65 + idx), text: o }))).map((optItem, pos) => {
                    const isEliminated = eliminatedOptions.includes(optItem.originalIndex);
                    if (isEliminated) return null;

                    const colors = [
                      'linear-gradient(135deg, #dc2626, #991b1b)',
                      'linear-gradient(135deg, #0284c7, #0369a1)',
                      'linear-gradient(135deg, #d97706, #b45309)',
                      'linear-gradient(135deg, #059669, #047857)'
                    ];
                    const isDisabled = hasAnsweredCurrentQ || isAnswerLocked || (gameType === 'TUG' && isFrozen);

                    return (
                      <button
                        key={`${optItem.originalIndex}_${pos}`}
                        disabled={isDisabled}
                        onClick={() => handleSelectMultipleChoice(optItem.originalIndex)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          padding: '16px 18px',
                          borderRadius: '16px',
                          background: colors[pos % 4],
                          color: '#ffffff',
                          border: (gameType === 'TUG' && isFrozen) ? '2px dashed #38bdf8' : '2px solid rgba(255,255,255,0.22)',
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          textAlign: 'left',
                          fontSize: '16.5px',
                          fontWeight: 900,
                          boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
                          opacity: isDisabled ? 0.55 : 1,
                          transition: 'transform 0.12s ease'
                        }}
                      >
                        <span style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '10px',
                          background: 'rgba(15, 23, 42, 0.45)',
                          border: '1.5px solid #fef08a',
                          color: '#fef08a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '17px',
                          fontWeight: 900,
                          flexShrink: 0
                        }}>
                          {optItem.letter}
                        </span>
                        <span style={{ flex: 1, lineHeight: 1.35 }}>
                          <MathRenderer text={optItem.text} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Dạng thức II: Trắc nghiệm Đúng/Sai (4 ý a, b, c, d) */}
              {currentQItem.format === 'TRUE_FALSE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(currentQItem.tfItems || []).map(item => {
                    const currentVal = tfAnswers[item.label] ?? false;
                    const isDisabled = hasAnsweredCurrentQ || isAnswerLocked || (gameType === 'TUG' && isFrozen);
                    return (
                      <div
                        key={item.label}
                        style={{
                          background: '#0f172a',
                          border: '1.5px solid #334155',
                          borderRadius: '14px',
                          padding: '12px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '10px'
                        }}
                      >
                        <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#f8fafc', flex: 1, lineHeight: 1.35 }}>
                          <b style={{ color: '#38bdf8' }}>{item.label})</b> <MathRenderer text={item.text} />
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button
                            disabled={isDisabled}
                            onClick={() => setTfAnswers(prev => ({ ...prev, [item.label]: true }))}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '10px',
                              fontSize: '13px',
                              fontWeight: 900,
                              background: currentVal === true ? '#10b981' : '#1e293b',
                              color: currentVal === true ? '#ffffff' : '#94a3b8',
                              border: currentVal === true ? '2px solid #6ee7b7' : '1px solid #334155',
                              cursor: isDisabled ? 'not-allowed' : 'pointer'
                            }}
                          >
                            Đúng
                          </button>
                          <button
                            disabled={isDisabled}
                            onClick={() => setTfAnswers(prev => ({ ...prev, [item.label]: false }))}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '10px',
                              fontSize: '13px',
                              fontWeight: 900,
                              background: currentVal === false ? '#ef4444' : '#1e293b',
                              color: currentVal === false ? '#ffffff' : '#94a3b8',
                              border: currentVal === false ? '2px solid #fca5a5' : '1px solid #334155',
                              cursor: isDisabled ? 'not-allowed' : 'pointer'
                            }}
                          >
                            Sai
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    disabled={hasAnsweredCurrentQ || isAnswerLocked || (gameType === 'TUG' && isFrozen)}
                    onClick={handleSubmitTrueFalse}
                    style={{
                      marginTop: '6px',
                      padding: '15px',
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '16px',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 6px 18px rgba(99, 102, 241, 0.4)'
                    }}
                  >
                    🚀 CHỐT ĐÁP ÁN 4 Ý ĐÚNG/SAI (BẤM 1 LẦN)
                  </button>
                </div>
              )}

              {/* Dạng thức III: Trắc nghiệm Trả lời ngắn */}
              {currentQItem.format === 'SHORT_ANSWER' && (
                <div style={{ background: '#0f172a', border: '2px solid #10b981', borderRadius: '16px', padding: '18px' }}>
                  <label style={{ display: 'block', fontSize: '13.5px', color: '#6ee7b7', fontWeight: 900, marginBottom: '8px' }}>
                    ✍️ Nhập kết quả số hoặc từ khóa (Dạng thức III - THPT 2018):
                  </label>
                  <input
                    type="text"
                    disabled={hasAnsweredCurrentQ || isAnswerLocked || (gameType === 'TUG' && isFrozen)}
                    placeholder="VD: 3 hoặc 12.5..."
                    value={shortAnswerInput}
                    onChange={e => setShortAnswerInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '12px',
                      border: '2px solid #475569',
                      background: '#1e293b',
                      color: '#fef08a',
                      fontSize: '18px',
                      fontWeight: 900,
                      textAlign: 'center',
                      boxSizing: 'border-box',
                      marginBottom: '12px'
                    }}
                  />
                  <button
                    disabled={hasAnsweredCurrentQ || isAnswerLocked || (gameType === 'TUG' && isFrozen) || !shortAnswerInput.trim()}
                    onClick={handleSubmitShortAnswer}
                    style={{
                      width: '100%',
                      padding: '15px',
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '16px',
                      border: 'none',
                      cursor: (!shortAnswerInput.trim()) ? 'not-allowed' : 'pointer',
                      opacity: (!shortAnswerInput.trim()) ? 0.6 : 1
                    }}
                  >
                    🚀 GỬI CÂU TRẢ LỜI NGẮN (BẤM 1 LẦN)
                  </button>
                </div>
              )}
            </>
          )}

          {/* Chỉ trò Kéo Co (TUG) mới hiển thị Túi kỹ năng */}
          {gameType === 'TUG' && inventory.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '6px 10px', background: '#1e1b4b', borderRadius: '12px', border: '1px solid #6366f1', marginTop: '14px', overflowX: 'auto' }}>
              <span style={{ fontSize: '11px', fontWeight: 900, color: '#c7d2fe', whiteSpace: 'nowrap' }}>Túi kỹ năng Kéo Co:</span>
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
        </div>
      )}

      {/* Screen 4: Eliminated in Golden Bell -> Chế Độ Khán Giả Cổ Vũ */}
      {screen === 'ELIMINATED' && (
        <div style={{ maxWidth: '480px', margin: '28px auto', padding: '22px', textAlign: 'center' }}>
          <div style={{ fontSize: '52px', marginBottom: '8px' }}>📣</div>
          <h2 style={{ fontSize: '21px', color: '#fbbf24', fontWeight: 900, margin: '0 0 8px 0' }}>
            BẠN ĐÃ TRỞ THÀNH KHÁN GIẢ CỔ VŨ!
          </h2>
          <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: 1.55, margin: '0 0 14px 0' }}>
            Trong trò <b>Rung Chuông Vàng</b>, bạn đã dùng hết 3 mạng (❤️❤️❤️) và rời sàn đấu.<br />
            Thành tích của bạn đã được bảo lưu: <b style={{ color: '#4ade80' }}>{fastScore} điểm ({myCorrectCount} câu đúng)</b>.
          </p>

          {/* Hộp tương tác cổ vũ đồng đội trên sàn đấu */}
          <div style={{ background: '#0f172a', border: '2px solid #f59e0b', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 900, color: '#fef08a', marginBottom: '10px' }}>
              🎉 BẤM CỔ VŨ CÁC BẠN ĐANG THI ĐẤU TRÊN SÂN:
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                { label: '👏 Vỗ tay cổ vũ!', msg: '👏 Bạn vừa gửi tràng pháo tay cổ vũ nồng nhiệt lên sàn đấu!' },
                { label: '🔥 Tiếp lửa!', msg: '🔥 Bạn vừa tiếp lửa tinh thần cho các sĩ tử trên sàn đấu!' },
                { label: '🥁 Đánh trống!', msg: '🥁 Tiếng trống cổ vũ Rung Chuông Vàng vang dội!' }
              ].map((btn, i) => (
                <button
                  key={i}
                  onClick={() => {
                    AudioFX.pullHeave();
                    setCheerMessage(btn.msg);
                    setTimeout(() => setCheerMessage(null), 3000);
                  }}
                  style={{
                    padding: '9px 14px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#0f172a',
                    border: 'none',
                    fontWeight: 900,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
            {cheerMessage && (
              <div style={{ marginTop: '10px', fontSize: '13px', color: '#4ade80', fontWeight: 800 }}>
                {cheerMessage}
              </div>
            )}
          </div>

          <div style={{ padding: '14px', background: '#0f172a', borderRadius: '12px', border: '1.5px dashed #10b981' }}>
            <span style={{ fontSize: '13px', color: '#6ee7b7', fontWeight: 800 }}>
              🛟 Hãy chú ý màn hình chính: Giáo viên có thể tung Phao Cứu Trợ hồi sinh bạn trở lại thi đấu bất cứ lúc nào!
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
