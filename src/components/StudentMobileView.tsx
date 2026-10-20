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

  // 30s Timer state (Bắt đầu đếm ngược ngay khi hiện câu hỏi, không bao giờ reset khi trả lời, hết 30s không chọn coi như sai)
  const [remSec, setRemSec] = useState<number>(30);
  const timerRef = useRef<any>(null);
  const startMsRef = useRef<number>(Date.now());
  const [hasAnsweredCurrentQ, setHasAnsweredCurrentQ] = useState(false);
  const hasAnsweredCurrentQRef = useRef<boolean>(false);
  const activeStudentTimerQIndexRef = useRef<number>(-1);

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

  // Track Teacher Match Status & whether student chose Waiting Room mode
  const [hostMatchStatus, setHostMatchStatus] = useState<'LOBBY' | 'PLAYING' | 'PAUSED' | 'ROUND_BREAK' | 'ENDED'>('PLAYING');
  const waitingRoomLockedRef = useRef<boolean>(false);

  // Keep refs in sync with latest profile & score so network callbacks NEVER use stale closure values
  const studentNameRef = useRef<string>(studentName);
  const teamRef = useRef<PlayerTeam>(team);
  const avatarRef = useRef<AvatarConfig>(avatar);
  const fastScoreRef = useRef<number>(fastScore);
  const myCorrectCountRef = useRef<number>(myCorrectCount);
  const hasConfirmedEnterRef = useRef<boolean>(hasConfirmedEnter);
  const hostMatchStatusRef = useRef<'LOBBY' | 'PLAYING' | 'PAUSED' | 'ROUND_BREAK' | 'ENDED'>(hostMatchStatus);

  useEffect(() => {
    studentNameRef.current = studentName;
  }, [studentName]);
  useEffect(() => {
    teamRef.current = team;
  }, [team]);
  useEffect(() => {
    avatarRef.current = avatar;
  }, [avatar]);
  useEffect(() => {
    fastScoreRef.current = fastScore;
  }, [fastScore]);
  useEffect(() => {
    myCorrectCountRef.current = myCorrectCount;
  }, [myCorrectCount]);
  useEffect(() => {
    hasConfirmedEnterRef.current = hasConfirmedEnter;
  }, [hasConfirmedEnter]);
  useEffect(() => {
    hostMatchStatusRef.current = hostMatchStatus;
  }, [hostMatchStatus]);

  // Save student name and avatar to localStorage
  const handleSaveProfile = (name: string, av: AvatarConfig) => {
    setStudentName(name);
    studentNameRef.current = name;
    setAvatar(av);
    avatarRef.current = av;
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

  const sendEnter = (overrideName?: string, overrideTeam?: PlayerTeam) => {
    const cleanName = (overrideName ?? studentNameRef.current ?? '').trim();
    // Chỉ gửi thông tin vào sàn đấu khi học sinh đã nhập tên hoặc đã bấm tham gia (tránh hiện "Học sinh" rỗng khi chưa nhập tên)
    if (!cleanName && !hasJoinedArenaRef.current) return;

    const finalName = cleanName || 'Học sinh';
    const finalTeam = overrideTeam || teamRef.current;

    CloudNetwork.sendMessage({
      type: hasJoinedArenaRef.current ? 'PLAYER_READY_ROPE' : 'AUTO_ENTER_ARENA',
      playerId: myPlayerId,
      preferredTeam: finalTeam,
      playerName: finalName,
      avatar: avatarRef.current,
      savedScore: fastScoreRef.current,
      savedCorrect: myCorrectCountRef.current
    });
  };

  // Connect to room with network status tracking
  useEffect(() => {
    CloudNetwork.connect(
      roomId,
      handleIncomingMessage,
      () => {
        setConnStatus(`🟢 Đã kết nối Phòng ${roomId}!`);
        setNetworkState('CONNECTED');
        if (hasJoinedArenaRef.current && studentNameRef.current.trim()) {
          sendEnter();
        }
      },
      (newStatus) => {
        setNetworkState(newStatus);
        if (newStatus === 'CONNECTED') {
          setConnStatus(`🟢 Đã kết nối Phòng ${roomId}!`);
          if (hasJoinedArenaRef.current && studentNameRef.current.trim()) {
            sendEnter();
          }
        } else if (newStatus === 'RECONNECTING') {
          setConnStatus(`🔄 Đang kết nối lại mạng...`);
        } else {
          setConnStatus(`⚠️ Mất kết nối mạng`);
        }
      }
    );

    const interval = setInterval(() => {
      if (hasJoinedArenaRef.current && !hasConfirmedEnterRef.current && studentNameRef.current.trim()) {
        sendEnter();
      }
    }, 1200);

    return () => {
      clearInterval(interval);
      CloudNetwork.disconnect();
    };
  }, [roomId]);

  const handleManualReconnect = () => {
    setConnStatus('🔄 Đang kết nối lại & khôi phục điểm số...');
    CloudNetwork.reconnectImmediate();
    setTimeout(() => {
      const cleanName = studentNameRef.current.trim() || 'Học sinh';
      CloudNetwork.sendMessage({
        type: 'PLAYER_READY_ROPE',
        playerId: myPlayerId,
        preferredTeam: teamRef.current,
        playerName: cleanName,
        avatar: avatarRef.current,
        savedScore: fastScoreRef.current,
        savedCorrect: myCorrectCountRef.current
      });
      setConnStatus(`🟢 Đã kết nối lại Phòng ${roomId} (Bảo lưu ${fastScoreRef.current}đ • ${myCorrectCountRef.current} câu đúng)`);
      triggerBonusToast(`✅ Đã kết nối lại thành công! Bảo lưu ${fastScoreRef.current} điểm (${myCorrectCountRef.current} câu đúng).`);
    }, 200);
  };

  // 30s Local countdown timer per question:
  // Bắt đầu tính giờ 30s ngay khi học sinh vào màn hình câu hỏi (QUIZ).
  // Khi học sinh ở Phòng chờ (WAITING), chỉ hiển thị câu hỏi chứ chưa đếm giờ và chưa cho trả lời.
  useEffect(() => {
    if (screen !== 'QUIZ' || eliminated) {
      activeStudentTimerQIndexRef.current = -1;
      if (screen === 'WAITING') {
        setRemSec(30);
      }
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // Chỉ khởi tạo lại đồng hồ 30s khi chuyển sang chỉ số câu hỏi mới hoặc vừa từ Phòng chờ mở khóa vào thi
    if (activeStudentTimerQIndexRef.current !== currentGlobalQIndex) {
      activeStudentTimerQIndexRef.current = currentGlobalQIndex;
      setRemSec(30);
      clearFreeze(); // Mở đóng băng khi hiện lên câu hỏi mới
      hasAnsweredCurrentQRef.current = false;
      setHasAnsweredCurrentQ(false);
      setIsAnswerLocked(false);
      setSelectedOptionOriginalIdx(null);
      setLastLockedResult(null);
      setEliminatedOptions([]);
      setShortAnswerInput('');
      setTfAnswers({ a: true, b: false, c: true, d: false });
      startMsRef.current = Date.now();
    }

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startMsRef.current) / 1000;
      const left = Math.max(0, 30 - elapsed);
      setRemSec(left);

      if (left <= 0) {
        clearInterval(timerRef.current);
        // Hết 30s mà học sinh không chọn đáp án -> Coi như trả lời SAI
        if (!hasAnsweredCurrentQRef.current) {
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
    if (hasAnsweredCurrentQRef.current || hasAnsweredCurrentQ || isAnswerLocked) return;
    hasAnsweredCurrentQRef.current = true;
    setHasAnsweredCurrentQ(true);
    setIsAnswerLocked(true);

    AudioFX.freezeCrack();
    setStreak(0);

    if (gameType === 'BELL') {
      // Chỉ có trò Rung Chuông Vàng khi trả lời sai / không chọn đáp án khi hết giờ mới bị mất 1 mạng; hết 3 mạng rời cuộc chơi thành Khán giả cổ vũ
      setLives(prev => {
        const nextL = Math.max(0, prev - 1);
        setLastLockedResult({
          isCorrect: false,
          text: nextL <= 0
            ? '⏰ HẾT 30 GIÂY! Không chọn đáp án coi như SAI • Bạn đã hết 3 ❤️ và chuyển sang làm Khán giả cổ vũ!'
            : `⏰ HẾT 30 GIÂY! Không chọn đáp án coi như SAI (0 điểm) • Mất 1 ❤️ Mạng (Còn ${nextL} ❤️)`
        });
        if (nextL <= 0) {
          setEliminated(true);
          setScreen('ELIMINATED');
        }
        return nextL;
      });
    } else {
      // Các trò chơi khác: Không chọn đáp án khi hết 30s coi như SAI (0 điểm câu này)
      setLastLockedResult({
        isCorrect: false,
        text: '⏰ HẾT 30 GIÂY! Không chọn đáp án coi như SAI (0 điểm) • Đang chuyển qua câu tiếp theo!'
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

    if (d.type === 'WELCOME_ACK' || d.type === 'HOST_STATE_SYNC') {
      if (d.status) {
        setHostMatchStatus(d.status);
        hostMatchStatusRef.current = d.status;
      }
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
      if (d.quiz && Array.isArray(d.quiz) && d.quiz.length > 0) {
        setQuizDeck(d.quiz);
      }
      if (d.status === 'PLAYING' && hasJoinedArenaRef.current && !eliminated) {
        waitingRoomLockedRef.current = false;
        setScreen('QUIZ');
      }
    }
    else if (d.type === 'ENTER_CONFIRMED' && d.playerId === myPlayerId) {
      setHasConfirmedEnter(true);
      if (d.team) setTeam(d.team);
      if (d.role) setRole(d.role);
      if (d.matchStatus) {
        setHostMatchStatus(d.matchStatus);
        hostMatchStatusRef.current = d.matchStatus;
      }
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
        waitingRoomLockedRef.current = false;
        setScreen('QUIZ');
      } else if (hasJoinedArenaRef.current && !waitingRoomLockedRef.current) {
        setScreen('QUIZ');
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
    else if (d.type === 'MATCH_START') {
      setHostMatchStatus('PLAYING');
      hostMatchStatusRef.current = 'PLAYING';
      waitingRoomLockedRef.current = false;
      activeStudentTimerQIndexRef.current = -1;
      startMsRef.current = Date.now();
      setRemSec(30);
      hasAnsweredCurrentQRef.current = false;
      setHasAnsweredCurrentQ(false);
      setIsAnswerLocked(false);
      setLastLockedResult(null);
      if (typeof d.qIndex === 'number') {
        currentGlobalQIndexRef.current = d.qIndex;
        setCurrentGlobalQIndex(d.qIndex);
      }
      if (d.question) {
        const qIdx = typeof d.qIndex === 'number' ? d.qIndex : 0;
        setBroadcastQuestionMap(prev => ({ ...prev, [qIdx]: d.question! }));
        setCurrentBroadcastQ({ ...d.question, qIndex: qIdx } as any);
      }
      if (d.quiz && Array.isArray(d.quiz) && d.quiz.length > 0) {
        setQuizDeck(d.quiz);
      }
      if (!eliminated && (hasJoinedArenaRef.current || screen !== 'LOBBY')) {
        setScreen('QUIZ');
        triggerBonusToast('🚀 GIÁO VIÊN ĐÃ BẤM BẮT ĐẦU! ĐÃ MỞ KHÓA ĐÁP ÁN ĐỂ EM TRẢ LỜI!');
      }
    }
    else if (d.type === 'PAUSE_TOGGLE') {
      if (d.status) {
        setHostMatchStatus(d.status);
        hostMatchStatusRef.current = d.status;
        if (d.status === 'PLAYING' && !eliminated && (hasJoinedArenaRef.current || screen !== 'LOBBY')) {
          waitingRoomLockedRef.current = false;
          activeStudentTimerQIndexRef.current = -1;
          startMsRef.current = Date.now();
          setScreen('QUIZ');
          triggerBonusToast('▶️ Giáo viên đã mở tiếp tục — Em có thể trả lời ngay!');
        } else if (d.status === 'PAUSED' && screen === 'QUIZ') {
          waitingRoomLockedRef.current = true;
          setScreen('WAITING');
          triggerBonusToast('⏸️ Giáo viên đang tạm dừng — Chuyển về Phòng chờ xem câu hỏi!');
        }
      }
    }
    else if (d.type === 'GAME_SWITCH' || d.type === 'GAME_SWITCHED') {
      // Giáo viên đổi trò chơi hoặc bấm Chuẩn bị sàn đấu: Học sinh đang chơi KHÔNG cần quét lại mã QR!
      if (d.gameType) setGameType(d.gameType);
      const nextStatus = d.status || 'LOBBY';
      setHostMatchStatus(nextStatus);
      hostMatchStatusRef.current = nextStatus;
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
      hasAnsweredCurrentQRef.current = false;
      setHasAnsweredCurrentQ(false);
      setIsAnswerLocked(false);
      setSelectedOptionOriginalIdx(null);
      setLastLockedResult(null);

      if (hasJoinedArenaRef.current || screen !== 'LOBBY') {
        hasJoinedArenaRef.current = true;
        if (!waitingRoomLockedRef.current || nextStatus === 'PLAYING') {
          activeStudentTimerQIndexRef.current = -1;
          startMsRef.current = Date.now();
          setRemSec(30);
          setScreen('QUIZ');
          triggerBonusToast('🎮 Đã đồng bộ bộ câu hỏi mới — Bắt đầu thi đấu ngay!');
        } else {
          setScreen('WAITING');
          triggerBonusToast('📣 Đã đồng bộ câu hỏi mới trong Phòng chờ!');
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
        setScreen(waitingRoomLockedRef.current ? 'WAITING' : 'QUIZ');
        triggerBonusToast("🛟 THẦY ĐÃ CỨU TRỢ HỒI SINH EM TRỞ LẠI SÀN ĐẤU! (❤️)");
      } else if (d.eliminated && gameType === 'BELL') {
        setScreen('ELIMINATED');
      }
    }
    else if (d.type === 'RESCUE_ALL_PLAYERS') {
      setEliminated(false);
      setIsFrozen(false);
      setLives(1);
      setScreen(waitingRoomLockedRef.current ? 'WAITING' : 'QUIZ');
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
      if (d.status) {
        setHostMatchStatus(d.status);
        hostMatchStatusRef.current = d.status;
      }
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
          waitingRoomLockedRef.current = false;
          setScreen('QUIZ');
        }
      }

      if (d.status === 'PLAYING' && !eliminated && screen === 'WAITING') {
        waitingRoomLockedRef.current = false;
        setScreen('QUIZ');
        triggerBonusToast('🚀 Giáo viên đã bắt đầu trận đấu — Đã mở khóa câu trả lời!');
      }
    }
    else if (d.type === 'QUESTION_START') {
      setHostMatchStatus('PLAYING');
      hostMatchStatusRef.current = 'PLAYING';
      waitingRoomLockedRef.current = false;
      if (typeof d.qIndex === 'number') {
        const isNewQuestion = d.qIndex !== currentGlobalQIndexRef.current || screen !== 'QUIZ';
        currentGlobalQIndexRef.current = d.qIndex;
        setCurrentGlobalQIndex(d.qIndex);
        if (isNewQuestion) {
          activeStudentTimerQIndexRef.current = -1;
          setLastCompletedQIndex(-1);
          clearFreeze(); // Tự động mở đóng băng khi hiện lên câu hỏi mới
          hasAnsweredCurrentQRef.current = false;
          setHasAnsweredCurrentQ(false);
          setIsAnswerLocked(false);
          setLastLockedResult(null);
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
    if (screen !== 'QUIZ' || isFrozen || eliminated || hasAnsweredCurrentQRef.current || hasAnsweredCurrentQ || isAnswerLocked) return;
    hasAnsweredCurrentQRef.current = true;
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
            : '❌ ĐÁP ÁN SAI! (0 điểm câu này • Đã khóa câu trả lời)')
    });

    processAnswerOutcome(isCorrect, isCorrect ? 1 : 0);
  };

  // Submit Answer for True/False (Dạng thức II: 4 ý a, b, c, d - Chỉ bấm nộp 1 lần duy nhất)
  const handleSubmitTrueFalse = () => {
    if (screen !== 'QUIZ' || isFrozen || eliminated || hasAnsweredCurrentQRef.current || hasAnsweredCurrentQ || isAnswerLocked) return;
    hasAnsweredCurrentQRef.current = true;
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
            : `❌ CHƯA TRỌN VẸN (${correctCount}/${items.length} ý đúng • 0 điểm) • Đã khóa câu trả lời`)
    });

    processAnswerOutcome(won, won ? correctCount : 0);
  };

  // Submit Answer for Short Answer / Fill-in (Dạng thức III: Chỉ bấm gửi 1 lần duy nhất)
  const handleSubmitShortAnswer = () => {
    if (screen !== 'QUIZ' || isFrozen || eliminated || hasAnsweredCurrentQRef.current || hasAnsweredCurrentQ || isAnswerLocked || !shortAnswerInput.trim()) return;
    hasAnsweredCurrentQRef.current = true;
    setHasAnsweredCurrentQ(true);
    setIsAnswerLocked(true);

    const correctVal = (resolvedCurrentQ.shortAnswer || resolvedCurrentQ.opts[0] || '')
      .replace(/^(?:Đáp\s*án|ĐA|KQ|Kết\s*quả|Đáp\s*số)\s*(?:đúng\s*)?(?:là\s*)?[:.=]?\s*/i, '')
      .replace(/\.+$/, '')
      .trim()
      .toLowerCase();
    const userVal = shortAnswerInput
      .replace(/^(?:Đáp\s*án|ĐA|KQ|Kết\s*quả|Đáp\s*số)\s*(?:đúng\s*)?(?:là\s*)?[:.=]?\s*/i, '')
      .replace(/\.+$/, '')
      .trim()
      .toLowerCase();

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
            : '❌ KẾT QUẢ SAI! (0 điểm câu này • Đã khóa câu trả lời)')
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

  // Vào trực tiếp phòng có câu hỏi (QUIZ) hoặc vào Phòng chờ (WAITING)
  const handleReadyInRope = (targetScreen: 'QUIZ' | 'WAITING' = 'QUIZ') => {
    const cleanName = (studentName || '').trim();
    if (!cleanName) {
      setShowNameAlert(true);
      return;
    }
    studentNameRef.current = cleanName;
    try {
      localStorage.setItem('student_saved_name', cleanName);
      localStorage.setItem('student_saved_avatar', JSON.stringify(avatar));
    } catch {}

    hasJoinedArenaRef.current = true;
    hasConfirmedEnterRef.current = false;
    setHasConfirmedEnter(false);
    waitingRoomLockedRef.current = targetScreen === 'WAITING';
    AudioFX.stepInRope();

    const joinPayload: CloudMessage = {
      type: 'PLAYER_READY_ROPE',
      playerId: myPlayerId,
      preferredTeam: team,
      playerName: cleanName,
      avatar,
      savedScore: fastScore,
      savedCorrect: myCorrectCount
    };

    // Gửi ngay tức thì + gửi lặp bảo đảm 100% hiển thị ngay lập tức trên màn hình chính
    CloudNetwork.sendMessage(joinPayload);
    setTimeout(() => CloudNetwork.sendMessage({ ...joinPayload }), 250);
    setTimeout(() => CloudNetwork.sendMessage({ ...joinPayload }), 800);

    if (targetScreen === 'QUIZ') {
      activeStudentTimerQIndexRef.current = -1;
      startMsRef.current = Date.now();
      setRemSec(30);
    }
    setScreen(targetScreen);
  };

  const currentQItem = resolvedCurrentQ;

  // Render Nhân Vật Chibi Dễ Thương (Full-body Kawaii Chibi) cho màn hình điện thoại học sinh
  const renderCuteChibiCharacter = (
    size: number = 84,
    mood: 'happy' | 'thinking' | 'cheering' | 'sad' | 'frozen' = 'happy'
  ) => {
    const outfitColor =
      avatar.costume === 'superhero'
        ? '#ef4444'
        : avatar.costume === 'aodai'
        ? '#ec4899'
        : avatar.costume === 'sport'
        ? '#10b981'
        : '#3b82f6';
    const accentColor = avatar.accessoryColor || '#f59e0b';

    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: `${Math.round(size * 0.28)}px`,
          background:
            mood === 'frozen'
              ? 'linear-gradient(145deg, #0284c7, #38bdf8)'
              : mood === 'cheering'
              ? 'linear-gradient(145deg, #065f46, #10b981)'
              : mood === 'sad'
              ? 'linear-gradient(145deg, #7f1d1d, #b91c1c)'
              : gameType === 'TUG'
              ? team === 'RED'
                ? 'linear-gradient(145deg, #dc2626, #7f1d1d)'
                : 'linear-gradient(145deg, #2563eb, #1e3a8a)'
              : 'linear-gradient(145deg, #312e81, #1e1b4b)',
          border: `2.5px solid ${accentColor}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: `0 6px 18px rgba(0,0,0,0.45), 0 0 12px ${accentColor}55`,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <svg
          width={Math.round(size * 0.9)}
          height={Math.round(size * 0.9)}
          viewBox="0 0 80 80"
          style={{
            animation: 'chibiGentleSway 2.4s ease-in-out infinite',
            transformOrigin: 'bottom center'
          }}
        >
          {/* Hào quang nền dưới chân Chibi */}
          <ellipse cx="40" cy="73" rx="18" ry="4" fill="rgba(255,255,255,0.22)" />

          {/* Áo choàng nếu là Siêu nhân */}
          {avatar.costume === 'superhero' && (
            <path d="M22 44 L14 68 L66 68 L58 44 Z" fill="#b91c1c" />
          )}

          {/* Chân & Giày Chibi dễ thương */}
          <rect x="29" y="61" width="8" height="10" rx="4" fill="#1e293b" />
          <rect x="43" y="61" width="8" height="10" rx="4" fill="#1e293b" />
          <ellipse cx="33" cy="71" rx="5.5" ry="3" fill="#f8fafc" />
          <ellipse cx="47" cy="71" rx="5.5" ry="3" fill="#f8fafc" />

          {/* Thân áo Chibi */}
          <rect x="23" y="42" width="34" height="22" rx="11" fill={outfitColor} stroke="#ffffff" strokeWidth="1.2" />

          {/* Họa tiết trang phục */}
          {avatar.costume === 'uniform' && (
            <>
              <polygon points="33,42 40,51 47,42" fill="#ffffff" />
              <polygon points="38.5,47 41.5,47 42.5,58 40,61 37.5,58" fill="#ef4444" />
            </>
          )}
          {avatar.costume === 'aodai' && (
            <>
              <path d="M32 43 Q40 49 48 43" stroke="#fef08a" strokeWidth="1.8" fill="none" />
              <circle cx="40" cy="53" r="3.5" fill="#fef08a" />
            </>
          )}
          {avatar.costume === 'superhero' && (
            <polygon points="40,46 42,51 47,51 43,54 44.5,59 40,56 35.5,59 37,54 33,51 38,51" fill="#fde047" />
          )}
          {avatar.costume === 'sport' && (
            <text x="40" y="57" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="900">10</text>
          )}

          {/* Hai tay Chibi (Giơ cao ăn mừng khi trả lời đúng, hoặc cầm đạo cụ dễ thương) */}
          {mood === 'cheering' ? (
            <>
              <rect x="13" y="34" width="9" height="16" rx="4.5" transform="rotate(-28 17 42)" fill={outfitColor} />
              <circle cx="13" cy="33" r="4" fill="#fde68a" />
              <rect x="58" y="34" width="9" height="16" rx="4.5" transform="rotate(28 63 42)" fill={outfitColor} />
              <circle cx="67" cy="33" r="4" fill="#fde68a" />
            </>
          ) : (
            <>
              <rect x="15" y="43" width="8" height="15" rx="4" transform="rotate(14 19 45)" fill={outfitColor} />
              <circle cx="17" cy="57" r="3.8" fill="#fde68a" />
              <rect x="57" y="43" width="8" height="15" rx="4" transform="rotate(-14 61 45)" fill={outfitColor} />
              <circle cx="63" cy="57" r="3.8" fill="#fde68a" />
            </>
          )}

          {/* Đạo cụ theo trò chơi (Bảng vàng Rung Chuông Vàng / Ngọc phép Diệt Boss / Tia chớp Đua Tốc Độ) */}
          {gameType === 'BELL' && (
            <g transform="translate(54, 46)">
              <rect x="0" y="0" width="16" height="14" rx="3" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
              <text x="8" y="10" textAnchor="middle" fill="#0f172a" fontSize="8" fontWeight="900">🔔</text>
            </g>
          )}
          {gameType === 'BOSS' && (
            <circle cx="65" cy="49" r="5.5" fill="#38bdf8" stroke="#bae6fd" strokeWidth="1.5" />
          )}

          {/* Tai & Khuôn mặt Chibi bầu bĩnh */}
          <circle cx="20" cy="29" r="4" fill="#fde68a" />
          <circle cx="60" cy="29" r="4" fill="#fde68a" />
          <circle cx="40" cy="28" r="19" fill="#fde68a" stroke="#fcd34d" strokeWidth="1" />

          {/* Má hồng Kawaii */}
          <ellipse cx="27" cy="32" rx="4.2" ry="2.4" fill="#fb7185" opacity="0.65" />
          <ellipse cx="53" cy="32" rx="4.2" ry="2.4" fill="#fb7185" opacity="0.65" />

          {/* Biểu cảm mắt & miệng theo trạng thái */}
          {mood === 'frozen' ? (
            <>
              <path d="M29 25 L35 31 M35 25 L29 31" stroke="#0f172a" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M45 25 L51 31 M51 25 L45 31" stroke="#0f172a" strokeWidth="2.6" strokeLinecap="round" />
              <rect x="35" y="35" width="10" height="4" rx="2" fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />
            </>
          ) : mood === 'cheering' ? (
            <>
              <path d="M27 28 Q31.5 22 36 28" stroke="#0f172a" strokeWidth="2.8" fill="none" strokeLinecap="round" />
              <path d="M44 28 Q48.5 22 53 28" stroke="#0f172a" strokeWidth="2.8" fill="none" strokeLinecap="round" />
              <path d="M33 34 Q40 42 47 34 Z" fill="#ef4444" stroke="#0f172a" strokeWidth="1.5" />
            </>
          ) : mood === 'sad' ? (
            <>
              <circle cx="31.5" cy="28" r="3.4" fill="#0f172a" />
              <circle cx="30.5" cy="26.8" r="1.2" fill="#ffffff" />
              <circle cx="48.5" cy="28" r="3.4" fill="#0f172a" />
              <circle cx="47.5" cy="26.8" r="1.2" fill="#ffffff" />
              {/* Giọt nước mắt chibi */}
              <path d="M26 31 Q24 35 26 37 Q28 35 26 31 Z" fill="#38bdf8" />
              <path d="M54 31 Q52 35 54 37 Q56 35 54 31 Z" fill="#38bdf8" />
              <path d="M34 37 Q40 33 46 37" stroke="#0f172a" strokeWidth="2.3" fill="none" strokeLinecap="round" />
            </>
          ) : (
            <>
              {/* Đôi mắt to tròn long lanh */}
              <circle cx="31.5" cy="27.5" r="3.8" fill="#0f172a" />
              <circle cx="30.2" cy="26.2" r="1.5" fill="#ffffff" />
              <circle cx="32.8" cy="28.8" r="0.8" fill="#ffffff" />
              <circle cx="48.5" cy="27.5" r="3.8" fill="#0f172a" />
              <circle cx="47.2" cy="26.2" r="1.5" fill="#ffffff" />
              <circle cx="49.8" cy="28.8" r="0.8" fill="#ffffff" />
              <path d="M34 34.5 Q40 39.5 46 34.5" stroke="#0f172a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            </>
          )}

          {/* Mũ / Tóc Chibi tùy chỉnh */}
          {avatar.hairStyle === 'crown' ? (
            <>
              <path d="M21 22 Q40 12 59 22 Q49 16 40 17 Q31 16 21 22 Z" fill="#1e293b" />
              <polygon points="23,17 29,6 40,14 51,6 57,17" fill="#facc15" stroke="#ca8a04" strokeWidth="1.6" />
              <circle cx="40" cy="11" r="2" fill="#ef4444" />
            </>
          ) : avatar.hairStyle === 'cap' ? (
            <>
              <path d="M20 20 Q40 5 60 20 Z" fill={accentColor} />
              <rect x="19" y="18" width="44" height="4.5" rx="2.2" fill={accentColor} stroke="#ffffff" strokeWidth="0.8" />
            </>
          ) : avatar.hairStyle === 'beret' ? (
            <>
              <ellipse cx="41" cy="13" rx="20" ry="7.5" transform="rotate(-8 41 13)" fill={accentColor} />
              <rect x="39" y="4" width="3" height="4" rx="1" fill={accentColor} />
            </>
          ) : avatar.hairStyle === 'cyber' ? (
            <>
              <path d="M20 26 Q20 8 40 8 Q60 8 60 26" stroke={accentColor} strokeWidth="4.5" fill="none" />
              <rect x="15" y="21" width="7" height="12" rx="3.5" fill={accentColor} stroke="#ffffff" strokeWidth="1" />
              <rect x="58" y="21" width="7" height="12" rx="3.5" fill={accentColor} stroke="#ffffff" strokeWidth="1" />
            </>
          ) : (
            <>
              <path d="M20 24 Q24 8 40 9 Q56 8 60 24 Q50 15 40 16 Q30 15 20 24 Z" fill="#1e293b" />
              <rect x="21" y="16" width="38" height="4.5" rx="2" fill={accentColor} />
            </>
          )}
        </svg>
      </div>
    );
  };

  return (
    <div id="student-view" style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: '#070b14', color: '#ffffff' }}>
      <style>{`
        @keyframes chibiGentleSway {
          0%, 100% { transform: rotate(-4deg) translateY(0px); }
          50% { transform: rotate(4deg) translateY(0px); }
        }
      `}</style>
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

      {/* Persistent Student Top Header: Logo & Tác giả Hồ Tấn Khải - Trường THPT Mang Thít */}
      <header
        style={{
          background: 'linear-gradient(90deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
          borderBottom: '2.5px solid #f59e0b',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap',
          position: 'sticky',
          top: 0,
          zIndex: 900,
          boxShadow: '0 4px 14px rgba(0,0,0,0.55)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg
            style={{ width: '34px', height: '34px', flexShrink: 0, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M32 4L8 14V30C8 46.5 18.2 57.6 32 62C45.8 57.6 56 46.5 56 30V14L32 4Z" fill="url(#studentShieldGrad)" stroke="#FEF08A" strokeWidth="3.5" />
            <path d="M14 32H50" stroke="#F59E0B" strokeWidth="5" strokeLinecap="round" />
            <circle cx="32" cy="32" r="7" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2.5" />
            <path d="M32 11L35 18H42L36.5 22.5L38.5 29.5L32 25L25.5 29.5L27.5 22.5L22 18H29L32 11Z" fill="#FEF08A" />
            <defs>
              <linearGradient id="studentShieldGrad" x1="8" y1="4" x2="56" y2="62" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0284C7" />
                <stop offset="0.5" stopColor="#1E1B4B" />
                <stop offset="1" stopColor="#E11D48" />
              </linearGradient>
            </defs>
          </svg>
          <div>
            <div style={{ fontSize: '12.5px', fontWeight: 900, color: '#fef08a', letterSpacing: '0.3px', lineHeight: 1.2 }}>
              ĐẤU TRƯỜNG 3D THPT
            </div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', lineHeight: 1.25 }}>
              👨‍🏫 Tác giả: <b style={{ color: '#ffffff' }}>Hồ Tấn Khải</b>
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, #b45309, #d97706)',
            border: '1.5px solid #fef08a',
            color: '#ffffff',
            padding: '4px 10px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 900,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 6px rgba(0,0,0,0.35)'
          }}
        >
          🏫 Trường THPT Mang Thít
        </div>
      </header>

      {/* Screen 1: Lobby & Avatar Customizer */}
      {screen === 'LOBBY' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '14px 14px 18px 14px' }}>
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <h1 style={{ fontSize: '21px', fontWeight: 900, color: 'var(--gold)', margin: '0 0 4px 0' }}>
              🌾 ĐẤU TRƯỜNG 3D THPT MANG THÍT
            </h1>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#fde047', marginBottom: '4px' }}>
              👨‍🏫 Tác giả: Thầy Hồ Tấn Khải • Trường THPT Mang Thít
            </div>
            <span style={{ fontSize: '12.5px', color: '#38bdf8', fontWeight: 800 }}>{connStatus}</span>
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

          {/* 3D Chibi Avatar Customization with Live Preview */}
          <div style={{ background: '#0f172a', border: '1.5px solid #6366f1', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px', background: 'rgba(99, 102, 241, 0.12)', padding: '12px', borderRadius: '14px', border: '1px solid rgba(99, 102, 241, 0.35)' }}>
              {renderCuteChibiCharacter(88, 'happy')}
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15.5px', color: '#fef08a', fontWeight: 900 }}>
                  ✨ Nhân Vật Chibi Của {studentName.trim() || 'Bạn'}
                </h3>
                <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.4 }}>
                  Hãy chọn kiểu mũ, trang phục và màu sắc yêu thích! Nhân vật Chibi sẽ đồng hành cùng bạn trong suốt trận đấu.
                </div>
              </div>
            </div>

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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => handleReadyInRope('QUIZ')}
              style={{
                width: '100%',
                padding: '15px 14px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '16px',
                border: '2px solid #6ee7b7',
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(16, 185, 129, 0.45)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px'
              }}
            >
              <span>🚀 VÀO TRỰC TIẾP PHÒNG CÓ CÂU HỎI (THI NGAY)</span>
              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#d1fae5' }}>
                (Hiện câu hỏi &amp; đáp án trả lời ngay lập tức)
              </span>
            </button>

            <button
              onClick={() => handleReadyInRope('WAITING')}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#0f172a',
                fontWeight: 900,
                fontSize: '14.5px',
                border: '2px solid #fef08a',
                cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(245, 158, 11, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px'
              }}
            >
              <span>🚪 BẤM VÀO PHÒNG CHỜ (CHỈ XEM CÂU HỎI)</span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b' }}>
                (Chỉ thấy câu hỏi • Khi nào Giáo viên bấm Bắt đầu mới mở trả lời)
              </span>
            </button>
          </div>

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

      {/* Screen 2: PHÒNG CHỜ THI ĐẤU (WAITING ROOM) — Học sinh chỉ thấy câu hỏi nhưng chưa được trả lời, khi nào Giáo viên bấm Bắt đầu mới mở khóa trả lời */}
      {screen === 'WAITING' && (
        <div style={{ maxWidth: '540px', margin: '0 auto', padding: '12px' }}>
          {/* Thanh thông tin Thí sinh & Nhân vật Chibi trong Phòng Chờ */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#0f172a',
            padding: '10px 12px',
            borderRadius: '16px',
            border: '1.5px solid #f59e0b',
            marginBottom: '10px',
            gap: '8px',
            flexWrap: 'wrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {renderCuteChibiCharacter(62, 'thinking')}
              <div>
                <div style={{ fontSize: '14.5px', fontWeight: 900, color: '#fef08a', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span>{studentName || 'Học sinh'}</span>
                  <span style={{ fontSize: '10.5px', padding: '2px 7px', borderRadius: '6px', background: '#1e293b', border: '1px solid #38bdf8', color: '#7dd3fc' }}>
                    Phòng {roomId}
                  </span>
                  {gameType === 'TUG' && (
                    <span style={{ fontSize: '10.5px', padding: '2px 7px', borderRadius: '6px', background: team === 'RED' ? '#dc2626' : '#0284c7', color: '#fff' }}>
                      {team === 'RED' ? 'Đội Đỏ' : 'Đội Xanh'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#4ade80', fontWeight: 800, marginTop: '2px' }}>
                  ⭐ Bảo lưu: {fastScore} điểm • ✅ {myCorrectCount} câu đúng
                </div>
                <div style={{ fontSize: '11px', color: '#fde047', fontWeight: 800, marginTop: '2px' }}>
                  💬 Chibi: &ldquo;Đọc kỹ câu hỏi trước nhé, chờ Thầy bấm Bắt đầu!&rdquo;
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={handleManualReconnect}
                style={{
                  background: '#1e293b',
                  border: '1.5px solid #38bdf8',
                  color: '#7dd3fc',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '11.5px',
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                🔄 Kết nối lại
              </button>
            </div>
          </div>

          {/* Banner Trạng Thái Phòng Chờ */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.12))',
            border: '2px solid #f59e0b',
            borderRadius: '14px',
            padding: '10px 14px',
            marginBottom: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '14px', fontWeight: 900, color: '#fef08a', marginBottom: '3px' }}>
              🚪 PHÒNG CHỜ THI ĐẤU • {gameType === 'TUG' ? '⚔️ KÉO CO 3D' : gameType === 'BELL' ? '🔔 RUNG CHUÔNG VÀNG' : gameType === 'FAST' ? '⚡ ĐUA TỐC ĐỘ' : '🐉 DIỆT BOSS'}
            </div>
            <div style={{ fontSize: '12.5px', color: '#fed7aa', fontWeight: 700, lineHeight: 1.4 }}>
              👀 Em đang ở Phòng chờ: <b>Chỉ thấy câu hỏi để đọc đề trước, chưa được trả lời</b>.<br />
              Khi nào Giáo viên bấm nút <b>&ldquo;🚀 BẮT ĐẦU THI&rdquo;</b> thì mới mở khóa đáp án!
            </div>
          </div>

          {/* KHUNG CÂU HỎI HIỂN THỊ TRONG PHÒNG CHỜ (CHỈ XEM CÂU HỎI, CHƯA TRẢ LỜI) */}
          <div style={{
            background: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
            border: '2.5px solid #38bdf8',
            borderRadius: '18px',
            padding: '16px',
            marginBottom: '14px',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.45)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{
                fontSize: '12px',
                background: currentQItem.format === 'TRUE_FALSE' ? '#f59e0b' : currentQItem.format === 'SHORT_ANSWER' ? '#10b981' : '#0284c7',
                color: currentQItem.format === 'TRUE_FALSE' ? '#0f172a' : '#ffffff',
                padding: '4px 10px',
                borderRadius: '8px',
                fontWeight: 900
              }}>
                📖 XEM TRƯỚC CÂU {currentGlobalQIndex + 1} • {currentQItem.format === 'TRUE_FALSE' ? 'DẠNG THỨC II: ĐÚNG / SAI (4 Ý)' : currentQItem.format === 'SHORT_ANSWER' ? 'DẠNG THỨC III: TRẢ LỜI NGẮN' : 'DẠNG THỨC I: 4 PHƯƠNG ÁN'}
              </span>
              <span style={{
                fontSize: '12px',
                fontWeight: 900,
                color: '#fde047',
                background: 'rgba(245, 158, 11, 0.18)',
                border: '1px solid #f59e0b',
                padding: '3px 9px',
                borderRadius: '999px'
              }}>
                ⏳ Chờ Giáo viên bắt đầu
              </span>
            </div>

            <div style={{ fontSize: '18px', fontWeight: 900, lineHeight: 1.45, color: '#ffffff' }}>
              <MathRenderer text={cleanQuestionTitleText(currentQItem.q)} />
            </div>

            {/* Nếu là Dạng thức II (Đúng/Sai), hiển thị nội dung 4 mệnh đề a, b, c, d ở chế độ chỉ đọc (không có nút bấm) để học sinh đọc đề */}
            {currentQItem.format === 'TRUE_FALSE' && currentQItem.tfItems && currentQItem.tfItems.length > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed #334155', paddingTop: '10px' }}>
                {currentQItem.tfItems.map(item => (
                  <div key={item.label} style={{ fontSize: '14px', color: '#cbd5e1', background: 'rgba(30, 41, 59, 0.6)', padding: '8px 12px', borderRadius: '10px', border: '1px solid #334155' }}>
                    <b style={{ color: '#38bdf8' }}>{item.label})</b> <MathRenderer text={item.text} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* KHUNG KHÓA TRẢ LỜI TRONG PHÒNG CHỜ */}
          <div style={{
            padding: '18px 16px',
            borderRadius: '18px',
            background: 'linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)',
            border: '2px dashed #f59e0b',
            textAlign: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
          }}>
            <div style={{ fontSize: '28px', marginBottom: '6px' }}>🔒</div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#fef08a', marginBottom: '6px' }}>
              CHƯA ĐƯỢC TRẢ LỜI TRONG PHÒNG CHỜ
            </div>
            <p style={{ fontSize: '13.5px', color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 14px 0' }}>
              Các nút chọn đáp án đang được khóa lại. Hãy đọc kỹ câu hỏi phía trên, ngay khi <b>Giáo viên bấm nút &ldquo;🚀 BẮT ĐẦU THI&rdquo;</b> trên màn hình chính, các đáp án sẽ tự động hiện ra để em trả lời!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '999px',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1.5px solid #f59e0b',
                color: '#fef08a',
                fontSize: '13.5px',
                fontWeight: 900
              }}>
                ⏳ Đang chờ Giáo viên bấm &ldquo;🚀 BẮT ĐẦU THI&rdquo; để tự động mở đáp án...
              </div>

              <button
                type="button"
                onClick={() => {
                  waitingRoomLockedRef.current = false;
                  activeStudentTimerQIndexRef.current = -1;
                  startMsRef.current = Date.now();
                  setRemSec(30);
                  setScreen('QUIZ');
                }}
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  border: '2px solid #6ee7b7',
                  fontWeight: 900,
                  fontSize: '14.5px',
                  cursor: 'pointer',
                  boxShadow: '0 6px 18px rgba(16, 185, 129, 0.4)'
                }}
              >
                🚀 VÀO TRỰC TIẾP PHÒNG CÓ CÂU HỎI (TRẢ LỜI NGAY)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen 3: Quiz Gameplay */}
      {screen === 'QUIZ' && (
        <div style={{ maxWidth: '540px', margin: '0 auto', padding: '10px 12px' }}>
          {/* Header HUD with Cute Swaying Chibi Character, Waiting Room Button & Reconnect Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '10px 12px', borderRadius: '16px', border: '1.5px solid #334155', marginBottom: '10px', gap: '8px', flexWrap: 'wrap', boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Nhân vật hoạt hình Chibi dễ thương trên điện thoại học sinh */}
              {renderCuteChibiCharacter(
                64,
                gameType === 'TUG' && isFrozen
                  ? 'frozen'
                  : (hasAnsweredCurrentQ || isAnswerLocked) && lastLockedResult
                  ? lastLockedResult.isCorrect
                    ? 'cheering'
                    : 'sad'
                  : 'happy'
              )}
              <div>
                <div style={{ fontSize: '14.5px', fontWeight: 900, color: '#fef08a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{studentName || 'Thí sinh'}</span>
                  {gameType === 'TUG' && (
                    <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '6px', background: team === 'RED' ? '#dc2626' : '#0284c7', color: '#fff' }}>
                      {team === 'RED' ? 'Đội Đỏ' : 'Đội Xanh'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#4ade80', fontWeight: 800, marginTop: '2px' }}>
                  ⭐ {fastScore} điểm • ✅ {myCorrectCount} câu đúng
                </div>
                <div style={{ fontSize: '11px', color: '#7dd3fc', fontWeight: 800, marginTop: '2px' }}>
                  {(hasAnsweredCurrentQ || isAnswerLocked) && lastLockedResult
                    ? lastLockedResult.isCorrect
                      ? '💬 Chibi: "Tuyệt vời! Chính xác luôn! 🎉"'
                      : '💬 Chibi: "Cố lên! Gỡ lại ở câu sau nhé! 💪"'
                    : remSec <= 8
                    ? '💬 Chibi: "Nhanh lên! Sắp hết 30 giây rồi! ⏰"'
                    : '💬 Chibi: "Bình tĩnh đọc kỹ đề nhé! ✨"'}
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
              {/* Nút bấm vào Phòng chờ (Chỉ xem câu hỏi, chưa trả lời) */}
              <button
                type="button"
                onClick={() => {
                  waitingRoomLockedRef.current = true;
                  setScreen('WAITING');
                }}
                title="Bấm để vào Phòng chờ (Chỉ xem câu hỏi, chờ Giáo viên bắt đầu)"
                style={{
                  background: 'rgba(245, 158, 11, 0.18)',
                  border: '1.5px solid #f59e0b',
                  color: '#fef08a',
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
                🚪 Phòng chờ
              </button>
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

          {(hasAnsweredCurrentQ || isAnswerLocked) && lastLockedResult ? (
            <div
              style={{
                padding: '22px 18px',
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
              <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>
                {renderCuteChibiCharacter(86, lastLockedResult.isCorrect ? 'cheering' : 'sad')}
              </div>
              <div style={{
                fontSize: '20px',
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
                🔒 Đã khóa câu #{currentGlobalQIndex + 1} • Tự động qua câu mới sau {Math.ceil(remSec)}s...
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

      {/* Screen 4: Eliminated in Golden Bell -> Chế Độ Khán Giả Cổ Vũ với Nhân Vật Chibi */}
      {screen === 'ELIMINATED' && (
        <div style={{ maxWidth: '480px', margin: '28px auto', padding: '22px', textAlign: 'center' }}>
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
            {renderCuteChibiCharacter(104, 'cheering')}
          </div>
          <h2 style={{ fontSize: '21px', color: '#fbbf24', fontWeight: 900, margin: '0 0 8px 0' }}>
            📣 BẠN ĐÃ TRỞ THÀNH KHÁN GIẢ CỔ VŨ!
          </h2>
          <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: 1.55, margin: '0 0 14px 0' }}>
            Trong trò <b>Rung Chuông Vàng</b>, bạn đã dùng hết 3 mạng (❤️❤️❤️) và rời sàn đấu.<br />
            Thành tích của bạn đã được bảo lưu: <b style={{ color: '#4ade80' }}>{fastScore} điểm ({myCorrectCount} câu đúng)</b>.
          </p>

          {/* Hộp tương tác cổ vũ đồng đội trên sàn đấu */}
          <div style={{ background: '#0f172a', border: '2px solid #f59e0b', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 900, color: '#fef08a', marginBottom: '10px' }}>
              🎉 CÙNG CHIBI CỔ VŨ CÁC BẠN ĐANG THI ĐẤU TRÊN SÂN:
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
