import React, { useState, useEffect, useRef } from 'react';
import { GamePlayType, PlayerRole, PlayerTeam, QuizItem, CloudMessage, AvatarConfig, PowerUpType, QuestionFormat, WagerLevel, WorldEventType } from '../types';
import { AudioFX } from '../services/audio';
import { CloudNetwork, NetworkConnStatus, NetworkTelemetry, AntiCongestionMode } from '../services/network';
import {
  cleanQuestionTitleText,
  cleanTFStatementText,
  cleanText,
  repairQuizItemIfCorrupted,
  getStableShuffledQuestion,
  getTeacherGradebookScore,
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

export const isPlaceholderOrEmptyName = (name: string): boolean => {
  const trimmed = (name || '').trim();
  if (trimmed.length < 2) return true;
  if (/^(thí sinh|học sinh|hs|player|chưa lưu tên)(\s*#?\d*)?$/i.test(trimmed)) return true;
  if (/^thí sinh/i.test(trimmed)) return true;
  if (/^học sinh/i.test(trimmed)) return true;
  if (/^chưa lưu tên/i.test(trimmed)) return true;
  if (/^vô danh/i.test(trimmed)) return true;
  return false;
};

export const StudentMobileView: React.FC<Props> = ({
  initialRoomId,
  initialTeam,
  initialGameType,
  initialSubjectKey,
  initialQuizList,
  onExitToSetup
}) => {
  // Khóa phiên độc lập cho từng Tab trình duyệt (Cho phép cùng 1 máy tính / cùng IP mạng ở Chế độ Ẩn Danh hoặc Bình thường
  // mở không giới hạn số lượng Tab, kể cả bấm "Nhân đôi Tab / Duplicate Tab", mỗi Tab tạo 1 nhân vật học sinh độc lập).
  // Khi học sinh bấm F5 tải lại đúng Tab đang thi thì vẫn khôi phục 100% phiên của chính Tab đó.
  const [tabSessionId, setTabSessionId] = useState<string>(() => {
    try {
      const existingTabId = sessionStorage.getItem('kc3d_tab_session_id');
      const reloadTs = parseInt(sessionStorage.getItem('kc3d_tab_reload_ts') || '0', 10);
      sessionStorage.removeItem('kc3d_tab_reload_ts');
      const winName = typeof window !== 'undefined' ? window.name : '';

      // Nếu window.name khớp với existingTabId (cùng 1 Tab đang hoạt động hoặc vừa remount/F5 trên điện thoại)
      // hoặc vừa F5 reload lại Tab -> Giữ nguyên 100% phiên làm bài, tuyệt đối không bao giờ văng ra!
      if (existingTabId && (winName === existingTabId || (reloadTs > 0 && Date.now() - reloadTs < 120000))) {
        if (typeof window !== 'undefined') window.name = existingTabId;
        return existingTabId;
      }

      // Trường hợp mở Tab mới hoặc bấm "Duplicate Tab / Nhân đôi Tab" (window.name rỗng hoặc khác) -> Tạo ID nhân vật độc lập mới
      const freshTabId = 'tab_' + Date.now().toString(36).slice(-4) + '_' + Math.random().toString(36).substring(2, 7);
      sessionStorage.setItem('kc3d_tab_session_id', freshTabId);
      if (typeof window !== 'undefined') window.name = freshTabId;
      return freshTabId;
    } catch {
      return 'tab_' + Math.random().toString(36).substring(2, 8);
    }
  });

  // Đánh dấu khi Tab thực sự F5 / Reload để bảo toàn tuyệt đối phiên làm bài của học sinh
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && tabSessionId) {
        window.name = tabSessionId;
      }
    } catch {}
    const handleBeforeUnload = () => {
      try {
        sessionStorage.setItem('kc3d_tab_reload_ts', String(Date.now()));
      } catch {}
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [tabSessionId]);

  const [roomId, setRoomId] = useState(initialRoomId || '12345');

  // Nếu mở Tab ở chế độ Ẩn Danh hoặc chưa truyền ?r= trên URL, tự động hỏi Server định kỳ để bắt đúng Mã Phòng đang mở của Giáo viên
  useEffect(() => {
    let mounted = true;
    const syncActiveRoom = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        if (!params.has('r') && !params.has('room')) {
          const activeId = await CloudNetwork.fetchActiveRoomId();
          if (mounted && activeId && String(activeId) !== roomId) {
            setRoomId(String(activeId));
          }
        }
      } catch {}
    };
    syncActiveRoom();
    const roomSyncTimer = setInterval(syncActiveRoom, 3000);
    return () => {
      mounted = false;
      clearInterval(roomSyncTimer);
    };
  }, [roomId]);

  const [studentName, setStudentName] = useState(() => {
    try {
      const joined = sessionStorage.getItem(`kc3d_joined_${tabSessionId}`);
      const saved = sessionStorage.getItem(`kc3d_name_${tabSessionId}`) || '';
      if (joined === '1' && saved && !isPlaceholderOrEmptyName(saved)) return saved;
      return '';
    } catch {
      return '';
    }
  });
  const [tempInputName, setTempInputName] = useState<string>(studentName);
  const [team, setTeam] = useState<PlayerTeam>(initialTeam || 'RED');
  const [gameType, setGameType] = useState<GamePlayType>(initialGameType || 'TUG');
  const [role, setRole] = useState<PlayerRole>('PULLER');
  const [top10List, setTop10List] = useState<{ id: string; name: string; team: PlayerTeam; score: number; correct: number }[]>(() => {
    try {
      const savedLive = localStorage.getItem(`kc3d_live_sync_${initialRoomId || '12345'}`);
      if (savedLive) {
        const parsed = JSON.parse(savedLive);
        if (parsed && Array.isArray(parsed.top10)) return parsed.top10;
      }
    } catch {}
    return [];
  });

  // Avatar Customization State (Hỗ trợ chọn Nhân vật Nam / Nhân vật Nữ độc lập trên từng Tab)
  const [avatar, setAvatar] = useState<AvatarConfig>(() => {
    try {
      const saved = sessionStorage.getItem(`kc3d_avatar_${tabSessionId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          gender: parsed.gender === 'female' ? 'female' : 'male',
          hairStyle: parsed.hairStyle || 'cap',
          costume: parsed.costume || 'uniform',
          accessoryColor: parsed.accessoryColor || '#f59e0b',
          expression: parsed.expression || 'happy'
        };
      }
    } catch {}
    return {
      gender: Math.random() > 0.5 ? 'female' : 'male',
      hairStyle: 'cap',
      costume: 'uniform',
      accessoryColor: '#f59e0b',
      expression: 'happy'
    };
  });

  // Power-up Inventory + Wager Mode + Mystery Chest + World Event state
  const [inventory, setInventory] = useState<PowerUpType[]>([]);
  const [activeShield, setActiveShield] = useState<boolean>(false);
  const [doublePowerActive, setDoublePowerActive] = useState<boolean>(false);
  const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([]);
  const [wagerLevel, setWagerLevel] = useState<WagerLevel>(1);
  const [activeWorldEvent, setActiveWorldEvent] = useState<WorldEventType>('NONE');
  const [worldEventTitle, setWorldEventTitle] = useState<string>('');

  // Cơ chế Cược Bản Lĩnh chỉ dùng 1 lần duy nhất trong tất cả các trò chơi
  const [hasUsedSpecialWager, setHasUsedSpecialWager] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(`kc3d_wager_used_${tabSessionId}`) === 'true';
    } catch {
      return false;
    }
  });

  // Cơ chế Mở Rương Bí Ẩn Định Mệnh (Bắt buộc đúng 5 câu liên tiếp, 4 giây chọn 1 rương, dùng 1 lần duy nhất)
  const [hasOpenedMysteryChest, setHasOpenedMysteryChest] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(`kc3d_chest_opened_${tabSessionId}`) === 'true';
    } catch {
      return false;
    }
  });
  const [hasImmunityShield, setHasImmunityShield] = useState<boolean>(false);
  const [mysteryChestsAvailable, setMysteryChestsAvailable] = useState<boolean>(false);
  const [chestCountdown, setChestCountdown] = useState<number>(4);
  const chestTimerRef = useRef<any>(null);
  const [claimedChestResult, setClaimedChestResult] = useState<{ icon: string; title: string; desc: string } | null>(null);

  // True/False answers state for current question: { a: boolean, b: boolean, c: boolean, d: boolean }
  const [tfAnswers, setTfAnswers] = useState<Record<string, boolean>>({
    a: true,
    b: false,
    c: true,
    d: false
  });

  // Short answer text state
  const [shortAnswerInput, setShortAnswerInput] = useState<string>('');

  // Connection & Screen state (Khôi phục riêng theo từng Tab khi F5, còn mở Tab mới bắt buộc nhập tên ở LOBBY)
  const [connStatus, setConnStatus] = useState('🟢 Đã kết nối thông suốt sân đấu 3D!');
  const [networkState, setNetworkState] = useState<NetworkConnStatus>('CONNECTED');
  const [netTelemetry, setNetTelemetry] = useState<NetworkTelemetry>(() => CloudNetwork.getTelemetry());
  useEffect(() => {
    const unsub = CloudNetwork.subscribeTelemetry((t) => setNetTelemetry(t));
    return () => unsub();
  }, []);
  const handleToggleAntiCongestion = () => {
    const modes: AntiCongestionMode[] = ['AUTO', 'WEAK_WIFI', 'TURBO'];
    const next = modes[(modes.indexOf(netTelemetry.congestionMode) + 1) % modes.length];
    CloudNetwork.setAntiCongestionMode(next);
    if (next === 'WEAK_WIFI') {
      triggerBonusToast('🛡️ Đã bật Chế độ Chống Nghẽn Wi-Fi Yếu / 3G-4G (Nén gói tin & chống văng tuyệt đối)!');
    } else if (next === 'TURBO') {
      triggerBonusToast('⚡ Đã bật Chế độ Đa Server Siêu Tốc (Phản hồi tức thì)!');
    } else {
      triggerBonusToast('🟢 Đã bật Chế độ Đa Luồng Tự Động Thích Ứng Mạng!');
    }
  };
  const [screen, setScreen] = useState<'LOBBY' | 'WAITING' | 'QUIZ' | 'ELIMINATED' | 'ENDED'>(() => {
    try {
      const savedName = (sessionStorage.getItem(`kc3d_name_${tabSessionId}`) || '').trim();
      const joined = sessionStorage.getItem(`kc3d_joined_${tabSessionId}`);
      const savedScr = sessionStorage.getItem(`kc3d_screen_${tabSessionId}`);
      if (savedName && !isPlaceholderOrEmptyName(savedName) && joined === '1') {
        if (savedScr === 'ENDED' || savedScr === 'QUIZ' || savedScr === 'WAITING' || savedScr === 'ELIMINATED') {
          return savedScr;
        }
        return 'WAITING';
      }
    } catch {}
    return 'LOBBY';
  });
  const [hasConfirmedEnter, setHasConfirmedEnter] = useState(false);

  // Gameplay state - Mỗi Tab có 1 mã học sinh (myPlayerId) riêng biệt 100%, không bao giờ bị trùng giữa các Tab ẩn danh
  const [myPlayerId, setMyPlayerId] = useState(() => {
    try {
      const key = `kc3d_pid_${tabSessionId}`;
      const saved = sessionStorage.getItem(key);
      if (saved) return saved;
      const newId = 'hs_' + Date.now().toString(36).slice(-4) + '_' + Math.random().toString(36).substring(2, 7);
      sessionStorage.setItem(key, newId);
      return newId;
    } catch {
      return 'hs_' + Date.now().toString(36).slice(-4) + '_' + Math.random().toString(36).substring(2, 7);
    }
  });

  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [eliminated, setEliminated] = useState(false);
  const [matchStatText, setMatchStatText] = useState('Đang kết nối thông suốt...');
  const hasJoinedArenaRef = useRef<boolean>((() => {
    try {
      const savedName = (sessionStorage.getItem(`kc3d_name_${tabSessionId}`) || '').trim();
      const joined = sessionStorage.getItem(`kc3d_joined_${tabSessionId}`);
      if (savedName && !isPlaceholderOrEmptyName(savedName) && joined === '1') return true;
      return false;
    } catch {
      return false;
    }
  })());
  const hasFinishedAllQuestionsRef = useRef<boolean>((() => {
    try {
      const savedScr = sessionStorage.getItem(`kc3d_screen_${tabSessionId}`);
      return savedScr === 'ENDED';
    } catch {
      return false;
    }
  })());

  // Questions deck & pointers - Đồng bộ câu hỏi trực tiếp từ Host màn hình chính theo đúng chỉ số qIndex
  const [quizDeck, setQuizDeck] = useState<QuizItem[]>(() => {
    if (initialQuizList && initialQuizList.length > 0) return initialQuizList;
    try {
      const savedLive = localStorage.getItem(`kc3d_live_sync_${initialRoomId || '12345'}`);
      if (savedLive) {
        const parsedLive = JSON.parse(savedLive);
        if (parsedLive && Array.isArray(parsedLive.quiz) && parsedLive.quiz.length > 0) {
          return parsedLive.quiz;
        }
      }
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
  const [currentGlobalQIndex, setCurrentGlobalQIndex] = useState<number>(() => {
    try {
      const savedQ = sessionStorage.getItem(`kc3d_qidx_${tabSessionId}`);
      const parsed = savedQ ? parseInt(savedQ, 10) : 0;
      return !isNaN(parsed) && parsed >= 0 ? parsed : 0;
    } catch {
      return 0;
    }
  });
  const currentGlobalQIndexRef = useRef<number>(currentGlobalQIndex);
  const maxReachedQIndexRef = useRef<number>(currentGlobalQIndex);
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
  // HOTFIX 1.3: Cơ chế Lock State tạm thời khi đang đồng bộ trạng thái (syncState) để chống bấm đúp đáp án do lag mạng
  const [isSyncingState, setIsSyncingState] = useState<boolean>(false);
  const syncLockTimerRef = useRef<any>(null);
  const triggerSyncStateLock = (durationMs: number = 350) => {
    setIsSyncingState(true);
    if (syncLockTimerRef.current) clearTimeout(syncLockTimerRef.current);
    syncLockTimerRef.current = setTimeout(() => {
      setIsSyncingState(false);
      syncLockTimerRef.current = null;
    }, durationMs);
  };
  const [lastLockedResult, setLastLockedResult] = useState<{ isCorrect: boolean; text: string } | null>(null);
  const lastShuffledKeyRef = useRef<string>('');

  // Persistent score & correct count in sessionStorage scoped to this tab
  const [fastScore, setFastScore] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(`kc3d_score_${tabSessionId}`);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });
  const [myCorrectCount, setMyCorrectCount] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(`kc3d_correct_${tabSessionId}`);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });
  const [fastRank, setFastRank] = useState(0);
  const [fastAnswerFeedback, setFastAnswerFeedback] = useState<string | null>(null);
  const [cheerMessage, setCheerMessage] = useState<string | null>(null);

  // Save score and correct count to per-tab sessionStorage whenever updated
  useEffect(() => {
    try {
      sessionStorage.setItem(`kc3d_score_${tabSessionId}`, String(fastScore));
    } catch {}
  }, [fastScore, tabSessionId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(`kc3d_correct_${tabSessionId}`, String(myCorrectCount));
    } catch {}
  }, [myCorrectCount, tabSessionId]);

  // Boss Mode state
  const [bossHP, setBossHP] = useState<number>(1000);
  const [maxBossHP, setMaxBossHP] = useState<number>(1000);

  // Tab switch anti-cheat warning
  const [tabWarning, setTabWarning] = useState<string | null>(null);

  // Track Teacher Match Status & whether student chose Waiting Room mode (Mặc định LOBBY để khóa/che đáp án khi GV chưa bấm Bắt đầu)
  const [hostMatchStatus, setHostMatchStatus] = useState<'LOBBY' | 'PLAYING' | 'PAUSED' | 'ROUND_BREAK' | 'ENDED'>(() => {
    try {
      const savedLive = localStorage.getItem(`kc3d_live_sync_${initialRoomId || '12345'}`);
      if (savedLive) {
        const parsed = JSON.parse(savedLive);
        if (parsed && parsed.status === 'PLAYING') return 'PLAYING';
      }
    } catch {}
    return 'LOBBY';
  });
  const waitingRoomLockedRef = useRef<boolean>((() => {
    try {
      const savedScr = sessionStorage.getItem(`kc3d_screen_${tabSessionId}`);
      if (savedScr === 'WAITING') return true;
    } catch {}
    return false;
  })());

  // Keep refs in sync with latest profile & score so network callbacks NEVER use stale closure values
  const studentNameRef = useRef<string>(studentName);
  const tempInputNameRef = useRef<string>(tempInputName);
  const lastForceStartTsRef = useRef<number>(0);
  const lastForcePullTsRef = useRef<number>(0);
  const teamRef = useRef<PlayerTeam>(team);
  const avatarRef = useRef<AvatarConfig>(avatar);
  const fastScoreRef = useRef<number>(fastScore);
  const myCorrectCountRef = useRef<number>(myCorrectCount);
  const hasConfirmedEnterRef = useRef<boolean>(hasConfirmedEnter);
  const hostMatchStatusRef = useRef<'LOBBY' | 'PLAYING' | 'PAUSED' | 'ROUND_BREAK' | 'ENDED'>(hostMatchStatus);
  const screenRef = useRef<'LOBBY' | 'WAITING' | 'QUIZ' | 'ELIMINATED' | 'ENDED'>(screen);
  const eliminatedRef = useRef<boolean>(eliminated);
  const gameTypeRef = useRef<GamePlayType>(gameType);
  const quizDeckRef = useRef<QuizItem[]>(quizDeck);
  const finishTransitionTimerRef = useRef<any>(null);

  useEffect(() => {
    studentNameRef.current = studentName;
  }, [studentName]);
  useEffect(() => {
    tempInputNameRef.current = tempInputName;
  }, [tempInputName]);
  useEffect(() => {
    teamRef.current = team;
    if (hasJoinedArenaRef.current && !isPlaceholderOrEmptyName(studentNameRef.current)) {
      sendEnter(undefined, team);
    }
  }, [team]);
  useEffect(() => {
    avatarRef.current = avatar;
    if (hasJoinedArenaRef.current && !isPlaceholderOrEmptyName(studentNameRef.current)) {
      sendEnter();
    }
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
  useEffect(() => {
    screenRef.current = screen;
    try {
      sessionStorage.setItem(`kc3d_screen_${tabSessionId}`, screen);
      if (screen !== 'LOBBY' && !isPlaceholderOrEmptyName(studentNameRef.current)) {
        hasJoinedArenaRef.current = true;
        sessionStorage.setItem(`kc3d_joined_${tabSessionId}`, '1');
      }
    } catch {}
  }, [screen, tabSessionId]);
  useEffect(() => {
    currentGlobalQIndexRef.current = currentGlobalQIndex;
    if (currentGlobalQIndex > maxReachedQIndexRef.current) {
      maxReachedQIndexRef.current = currentGlobalQIndex;
    }
    try {
      sessionStorage.setItem(`kc3d_qidx_${tabSessionId}`, String(currentGlobalQIndex));
    } catch {}
  }, [currentGlobalQIndex, tabSessionId]);
  useEffect(() => {
    eliminatedRef.current = eliminated;
  }, [eliminated]);
  useEffect(() => {
    gameTypeRef.current = gameType;
  }, [gameType]);
  useEffect(() => {
    quizDeckRef.current = quizDeck;
  }, [quizDeck]);

  // Cập nhật tên và nhân vật trên state (Chỉ gửi lên phòng khi đã vào phòng với tên hợp lệ)
  const handleSaveProfile = (name: string, av: AvatarConfig) => {
    setStudentName(name);
    studentNameRef.current = name;
    setTempInputName(name);
    tempInputNameRef.current = name;
    setAvatar(av);
    avatarRef.current = av;
    try {
      sessionStorage.setItem(`kc3d_avatar_${tabSessionId}`, JSON.stringify(av));
      if (hasJoinedArenaRef.current && !isPlaceholderOrEmptyName(name)) {
        sessionStorage.setItem(`kc3d_name_${tabSessionId}`, name.trim());
      }
    } catch {}
    if (hasJoinedArenaRef.current && !isPlaceholderOrEmptyName(name)) {
      sendEnter(name.trim());
    }
  };

  const myPlayerIdRef = useRef<string>(myPlayerId);
  useEffect(() => {
    myPlayerIdRef.current = myPlayerId;
  }, [myPlayerId]);

  // Kiểm tra tên học sinh hợp lệ (Bắt buộc học sinh phải nhập tên mới được vào phòng, tuyệt đối không tự sinh tên ảo SBD)
  const ensureValidStudentNameForMatchStart = (): string => {
    const curSaved = (studentNameRef.current || '').trim();
    if (!isPlaceholderOrEmptyName(curSaved)) {
      return curSaved;
    }
    const curTyped = (tempInputNameRef.current || '').trim();
    if (!isPlaceholderOrEmptyName(curTyped)) {
      studentNameRef.current = curTyped;
      setStudentName(curTyped);
      setTempInputName(curTyped);
      setShowNameAlert(false);
      try {
        sessionStorage.setItem(`kc3d_name_${tabSessionId}`, curTyped);
        sessionStorage.setItem(`kc3d_joined_${tabSessionId}`, '1');
      } catch {}
      return curTyped;
    }
    return '';
  };

  const sendEnter = (overrideName?: string, overrideTeam?: PlayerTeam) => {
    const cleanName = (overrideName ?? studentNameRef.current ?? tempInputNameRef.current ?? '').trim();
    if (!cleanName || isPlaceholderOrEmptyName(cleanName)) {
      return;
    }
    if (!hasJoinedArenaRef.current && !overrideName) {
      return;
    }

    const finalTeam = overrideTeam || teamRef.current;

    CloudNetwork.sendMessage({
      type: hasFinishedAllQuestionsRef.current
        ? 'PLAYER_FINISH_QUIZ'
        : 'PLAYER_READY_ROPE',
      playerId: myPlayerIdRef.current,
      preferredTeam: finalTeam,
      playerName: cleanName,
      avatar: avatarRef.current,
      savedScore: fastScoreRef.current,
      savedCorrect: myCorrectCountRef.current
    });
  };

  // Chuyển sang câu hỏi tiếp theo hoặc DỪNG & THÔNG BÁO KẾT QUẢ CUỐI CÙNG khi đã làm hết câu hỏi (tuyệt đối không chạy lại câu 1)
  const advanceStudentQuestionOrFinish = (fromIndex?: number) => {
    if (finishTransitionTimerRef.current) {
      clearTimeout(finishTransitionTimerRef.current);
      finishTransitionTimerRef.current = null;
    }
    const totalCount = Math.max(1, quizDeckRef.current.length || 1);
    const curIdx = typeof fromIndex === 'number' ? fromIndex : currentGlobalQIndexRef.current;

    if (curIdx + 1 >= totalCount) {
      // ĐÃ LÀM HẾT CÂU HỎI CUỐI CÙNG -> NGỪNG NGAY VÀ HIỂN THỊ KẾT QUẢ CUỐI CÙNG (KHÔNG CHẠY LẠI CÂU 1)
      hasFinishedAllQuestionsRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      AudioFX.winFanfare();
      const validName = (studentNameRef.current || '').trim();
      if (!isPlaceholderOrEmptyName(validName)) {
        CloudNetwork.sendMessage({
          type: 'PLAYER_FINISH_QUIZ',
          playerId: myPlayerId,
          preferredTeam: teamRef.current,
          playerName: validName,
          avatar: avatarRef.current,
          savedScore: fastScoreRef.current,
          savedCorrect: myCorrectCountRef.current
        });
      }
      setScreen('ENDED');
      return;
    }

    const nextIdx = curIdx + 1;
    currentGlobalQIndexRef.current = nextIdx;
    if (nextIdx > maxReachedQIndexRef.current) {
      maxReachedQIndexRef.current = nextIdx;
    }
    setCurrentGlobalQIndex(nextIdx);
  };

  const handleManualReconnect = () => {
    setConnStatus('🟢 Đang đồng bộ kết nối & bảo lưu điểm số...');
    CloudNetwork.reconnectImmediate();
    setTimeout(() => {
      const cleanName = (studentNameRef.current || '').trim();
      if (!isPlaceholderOrEmptyName(cleanName) && hasJoinedArenaRef.current) {
        CloudNetwork.sendMessage({
          type: hasFinishedAllQuestionsRef.current ? 'PLAYER_FINISH_QUIZ' : 'PLAYER_READY_ROPE',
          playerId: myPlayerId,
          preferredTeam: teamRef.current,
          playerName: cleanName,
          avatar: avatarRef.current,
          savedScore: fastScoreRef.current,
          savedCorrect: myCorrectCountRef.current
        });
      }
      setNetworkState('CONNECTED');
      setConnStatus(`🟢 Đã kết nối Phòng ${roomId}`);
    }, 100);
  };

  // 30s Local countdown timer per question:
  // Chỉ chạy khi Giáo viên đã bấm Bắt đầu (hostMatchStatus === 'PLAYING') và học sinh đã lưu tên thật.
  useEffect(() => {
    if (
      screen !== 'QUIZ' ||
      hostMatchStatus !== 'PLAYING' ||
      isPlaceholderOrEmptyName(studentName) ||
      eliminated ||
      hasFinishedAllQuestionsRef.current
    ) {
      activeStudentTimerQIndexRef.current = -1;
      if (screen === 'WAITING' || hostMatchStatus !== 'PLAYING') {
        setRemSec(30);
      }
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const totalCount = Math.max(1, quizDeckRef.current.length || quizDeck.length || 1);
    if (currentGlobalQIndex >= totalCount) {
      advanceStudentQuestionOrFinish(totalCount - 1);
      return;
    }

    // Chỉ khởi tạo lại đồng hồ 30s khi chuyển sang chỉ số câu hỏi mới hoặc vừa mở khóa thi đấu
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
      setWagerLevel(1);
      setMysteryChestsAvailable(false);
      setClaimedChestResult(null);
      if (chestTimerRef.current) {
        clearInterval(chestTimerRef.current);
        chestTimerRef.current = null;
      }
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
  }, [screen, hostMatchStatus, studentName, currentGlobalQIndex, eliminated]);

  const safeTotalDeckCount = Math.max(1, quizDeck.length || 1);
  const clampedQIndex = Math.min(Math.max(0, currentGlobalQIndex), safeTotalDeckCount - 1);
  const resolvedCurrentQ: QuizItem = broadcastQuestionMap[clampedQIndex] ||
    (currentBroadcastQ && (currentBroadcastQ as any).qIndex === clampedQIndex ? currentBroadcastQ : null) ||
    (quizDeck && quizDeck.length > 0 ? quizDeck[clampedQIndex] : null) || {
      qid: 0,
      q: 'Đang tải câu hỏi...',
      opts: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
      correct: 0,
      format: 'MULTIPLE_CHOICE'
    };

  // Xáo trộn thứ tự đáp án của học sinh ĐÚNG 1 LẦN DUY NHẤT khi câu hỏi xuất hiện rồi ĐỨNG IM hoàn toàn (không bao giờ nhảy lại)
  const resolvedQSignature = `${clampedQIndex}::${resolvedCurrentQ?.q || ''}::${(resolvedCurrentQ?.opts || []).join('|')}`;
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
    const seedStr = `${myPlayerId}_q_${clampedQIndex}_${resolvedCurrentQ.q}`;
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
  }, [resolvedQSignature, myPlayerId, clampedQIndex]);

  const handleTimeoutFail = () => {
    if (hasAnsweredCurrentQRef.current || hasAnsweredCurrentQ || isAnswerLocked) return;
    hasAnsweredCurrentQRef.current = true;
    setHasAnsweredCurrentQ(true);
    setIsAnswerLocked(true);

    AudioFX.freezeCrack();
    setStreak(0);

    const activeGM = gameTypeRef.current;
    const curIdx = currentGlobalQIndexRef.current;
    const totalCount = Math.max(1, quizDeckRef.current.length || 1);
    const isFinalQ = curIdx + 1 >= totalCount;
    let nextScoreAfterTimeout = fastScoreRef.current;

    if (activeGM === 'BELL') {
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
    } else if (activeGM === 'FAST' || activeGM === 'BOSS') {
      nextScoreAfterTimeout = fastScoreRef.current - 1000;
      fastScoreRef.current = nextScoreAfterTimeout;
      setFastScore(nextScoreAfterTimeout);
      setLastLockedResult({
        isCorrect: false,
        text: isFinalQ
          ? '⏰ HẾT 30 GIÂY CÂU CUỐI! Không chọn đáp án coi như SAI (-1000 điểm) • Đang tổng kết kết quả cuối cùng!'
          : '⏰ HẾT 30 GIÂY! Không chọn đáp án coi như SAI • Trừ -1000 điểm (Số câu đúng ghi sổ điểm vẫn bảo lưu)!'
      });
    } else {
      setLastLockedResult({
        isCorrect: false,
        text: isFinalQ
          ? '⏰ HẾT 30 GIÂY CÂU CUỐI! Không chọn đáp án coi như SAI (0 điểm) • Đang tổng kết kết quả cuối cùng!'
          : '⏰ HẾT 30 GIÂY! Không chọn đáp án coi như SAI (0 điểm) • Đang chuyển qua câu tiếp theo!'
      });
    }

    CloudNetwork.sendMessage({
      type: 'FREEZE_WRONG',
      playerId: myPlayerId,
      team: teamRef.current,
      globalQIndex: curIdx,
      totalScore: nextScoreAfterTimeout,
      savedCorrect: myCorrectCountRef.current
    });

    if (isFinalQ) {
      if (finishTransitionTimerRef.current) clearTimeout(finishTransitionTimerRef.current);
      finishTransitionTimerRef.current = setTimeout(() => {
        if (!eliminatedRef.current) {
          advanceStudentQuestionOrFinish(curIdx);
        }
      }, 1200);
    }
  };

  const syncTop10State = (
    incomingList?: any[],
    peerUpdate?: { id: string; name: string; team: PlayerTeam; score: number; correct: number }
  ) => {
    setTop10List(prev => {
      const map = new Map<string, { id: string; name: string; team: PlayerTeam; score: number; correct: number }>();

      const sourceBase = Array.isArray(incomingList) && incomingList.length > 0 ? incomingList : prev;
      sourceBase.forEach((raw: any) => {
        if (!raw) return;
        const pid = String(raw.id || raw.playerId || '');
        const pname = String(raw.name || raw.label || raw.playerName || '').trim();
        if (!pid || !pname || isPlaceholderOrEmptyName(pname)) return;
        const pscore = typeof raw.score === 'number' ? raw.score : typeof raw.fastScore === 'number' ? raw.fastScore : 0;
        const pcorrect = typeof raw.correct === 'number' ? raw.correct : typeof raw.savedCorrect === 'number' ? raw.savedCorrect : 0;
        map.set(pid, {
          id: pid,
          name: pname,
          team: raw.team || raw.preferredTeam || 'RED',
          score: pscore,
          correct: pcorrect
        });
      });

      if (peerUpdate && peerUpdate.id && !isPlaceholderOrEmptyName(peerUpdate.name)) {
        const ex = map.get(peerUpdate.id);
        map.set(peerUpdate.id, {
          id: peerUpdate.id,
          name: peerUpdate.name,
          team: peerUpdate.team || ex?.team || 'RED',
          score: Math.max(ex?.score ?? 0, peerUpdate.score),
          correct: Math.max(ex?.correct ?? 0, peerUpdate.correct)
        });
      }

      const myName = (studentNameRef.current || '').trim();
      if (hasJoinedArenaRef.current && !isPlaceholderOrEmptyName(myName)) {
        const exMe = map.get(myPlayerIdRef.current);
        map.set(myPlayerIdRef.current, {
          id: myPlayerIdRef.current,
          name: myName,
          team: teamRef.current,
          score: Math.max(exMe?.score ?? 0, fastScoreRef.current),
          correct: Math.max(exMe?.correct ?? 0, myCorrectCountRef.current)
        });
      }

      return Array.from(map.values())
        .sort((a, b) => b.score - a.score || b.correct - a.correct)
        .slice(0, 10);
    });
  };

  const handleIncomingMessage = (d: CloudMessage) => {
    if (!d || !d.type) return;

    if (d.gameType) {
      setGameType(d.gameType);
      gameTypeRef.current = d.gameType;
    }
    if (d.quiz && Array.isArray(d.quiz) && d.quiz.length > 0) {
      setQuizDeck(d.quiz);
      quizDeckRef.current = d.quiz;
    }
    if (Array.isArray(d.top10)) {
      syncTop10State(d.top10);
    }
    if (
      (d.type === 'PLAYER_READY_ROPE' ||
        d.type === 'AUTO_ENTER_ARENA' ||
        d.type === 'PLAYER_UPDATE_NAME' ||
        d.type === 'PLAYER_FINISH_QUIZ') &&
      d.playerId &&
      d.playerName &&
      !isPlaceholderOrEmptyName(d.playerName)
    ) {
      syncTop10State(undefined, {
        id: d.playerId,
        name: d.playerName.trim(),
        team: d.preferredTeam || d.team || 'RED',
        score: typeof d.savedScore === 'number' ? d.savedScore : 0,
        correct: typeof d.savedCorrect === 'number' ? d.savedCorrect : 0
      });
    }
    if (typeof d.bossHP === 'number') {
      setBossHP(d.bossHP);
    }
    if (typeof d.maxBossHP === 'number') {
      setMaxBossHP(d.maxBossHP);
    }

    if (d.type === 'FORCE_PULL_TO_WAITING') {
      if (typeof d.forcePullTs === 'number' && d.forcePullTs > 0) {
        lastForcePullTsRef.current = d.forcePullTs;
      } else {
        lastForcePullTsRef.current = Date.now();
      }
      setNetworkState('CONNECTED');
      setConnStatus(`🟢 Đã kết nối Phòng ${roomId}!`);
      if (d.question) {
        const qIdx = typeof d.globalQIndex === 'number' ? d.globalQIndex : currentGlobalQIndexRef.current;
        setBroadcastQuestionMap(prev => ({ ...prev, [qIdx]: d.question! }));
        setCurrentBroadcastQ({ ...d.question, qIndex: qIdx } as any);
      }
      const validName = ensureValidStudentNameForMatchStart();
      if (!validName) {
        setScreen('LOBBY');
        setShowNameAlert(true);
        return;
      }
      hasJoinedArenaRef.current = true;
      setShowNameAlert(false);
      const isCurrentlyPlaying = d.status === 'PLAYING' || hostMatchStatusRef.current === 'PLAYING';
      if (isCurrentlyPlaying && !eliminatedRef.current && !hasFinishedAllQuestionsRef.current) {
        waitingRoomLockedRef.current = false;
        setScreen('QUIZ');
        AudioFX.pullHeave();
        triggerBonusToast('🚀 Thầy/Cô đã kéo bạn quay lại phòng thi đang diễn ra!');
      } else if (screenRef.current === 'LOBBY' || screenRef.current === 'WAITING') {
        waitingRoomLockedRef.current = true;
        setScreen('WAITING');
        AudioFX.bonusLifeChime();
        triggerBonusToast(`🧲 Thầy/Cô đã kéo bạn (${validName}) vào phòng thi!`);
      }
      sendEnter(validName);
      setTimeout(() => sendEnter(validName), 200);
      setTimeout(() => sendEnter(validName), 650);
      return;
    }

    // Chỉ khi Giáo viên chủ động bấm KẾT THÚC TRẬN (MATCH_ENDED) mới dừng toàn phòng;
    // Không để trạng thái ENDED cũ trong nhịp tim làm văng học sinh vừa mới vào phòng hoặc đang làm dở câu hỏi!
    if (d.type === 'MATCH_ENDED') {
      setHostMatchStatus('ENDED');
      hostMatchStatusRef.current = 'ENDED';
      if (hasJoinedArenaRef.current || screenRef.current !== 'LOBBY') {
        hasFinishedAllQuestionsRef.current = true;
        if (timerRef.current) clearInterval(timerRef.current);
        setScreen('ENDED');
      }
      return;
    }

    if (d.type === 'FAST_ANSWER_RESULT' && d.playerId === myPlayerId) {
      if (typeof d.rank === 'number' && d.rank > 0) {
        setFastRank(d.rank);
      }
      if (d.isFirstBlood) {
        AudioFX.firstBloodStrike();
        triggerBonusToast('⚡ TIA CHỚP ĐẦU TIÊN! Bạn trả lời đúng nhanh nhất câu này (+500đ thưởng)!');
      }
      return;
    }

    if (d.type === 'DRAMA_EVENT') {
      if (d.playerId === myPlayerId && d.isFirstBlood) {
        AudioFX.firstBloodStrike();
        if (typeof d.totalScore === 'number' && d.totalScore > fastScoreRef.current) {
          fastScoreRef.current = d.totalScore;
          setFastScore(d.totalScore);
        }
        triggerBonusToast('⚡ BẠN GIÀNH TIA CHỚP ĐẦU TIÊN (FIRST BLOOD): +500 ĐIỂM TỐC ĐỘ!');
      } else if (d.dramaAnnouncement) {
        triggerBonusToast(d.dramaAnnouncement);
      }
      return;
    }

    if (d.type === 'WORLD_EVENT_TRIGGERED') {
      AudioFX.worldEventSiren();
      if (d.worldEvent) setActiveWorldEvent(d.worldEvent);
      if (d.worldEventTitle) {
        setWorldEventTitle(d.worldEventTitle);
        triggerBonusToast(d.worldEventTitle);
      }
      if (d.worldEvent === 'MIRACLE_BLESSING') {
        setEliminated(false);
        eliminatedRef.current = false;
        setLives(prev => Math.max(prev, 1));
        const nextPts = fastScoreRef.current + 500;
        fastScoreRef.current = nextPts;
        setFastScore(nextPts);
        if (screenRef.current === 'ELIMINATED') {
          setScreen(hasFinishedAllQuestionsRef.current ? 'ENDED' : 'QUIZ');
        }
      } else if (d.worldEvent === 'UNDERDOG_BOOST' && typeof d.bonusScoreDelta === 'number' && d.bonusScoreDelta > 0) {
        const nextPts = fastScoreRef.current + d.bonusScoreDelta;
        fastScoreRef.current = nextPts;
        setFastScore(nextPts);
      }
      return;
    }

    if (d.type === 'WELCOME_ACK' || d.type === 'HOST_STATE_SYNC') {
      // HOTFIX 1.3: Khóa tạm thời nút bấm khi nhận gói đồng bộ trạng thái (syncState)
      triggerSyncStateLock(260);
      if (d.status) {
        if (d.status === 'PLAYING') {
          lastForceStartTsRef.current = Date.now();
        }
        if (!(d.status === 'LOBBY' && Date.now() - lastForceStartTsRef.current < 12000)) {
          setHostMatchStatus(d.status);
          hostMatchStatusRef.current = d.status;
        }
      }
      if (typeof d.globalQIndex === 'number' && d.status === 'PLAYING') {
        currentGlobalQIndexRef.current = d.globalQIndex;
        maxReachedQIndexRef.current = d.globalQIndex;
        setCurrentGlobalQIndex(d.globalQIndex);
      }
      if (d.question) {
        const qIdx = typeof (d.question as any).qIndex === 'number'
          ? (d.question as any).qIndex
          : (typeof d.globalQIndex === 'number' ? d.globalQIndex : currentGlobalQIndexRef.current);
        setBroadcastQuestionMap(prev => ({ ...prev, [qIdx]: d.question! }));
        setCurrentBroadcastQ({ ...d.question, qIndex: qIdx } as any);
      }
      if (d.status === 'PLAYING' && !eliminatedRef.current && !hasFinishedAllQuestionsRef.current) {
        const validName = ensureValidStudentNameForMatchStart();
        if (validName) {
          hasJoinedArenaRef.current = true;
          waitingRoomLockedRef.current = false;
          setScreen('QUIZ');
          sendEnter(validName);
        }
      }
    }
    else if (d.type === 'ENTER_CONFIRMED' && d.playerId === myPlayerId) {
      setHasConfirmedEnter(true);
      hasConfirmedEnterRef.current = true;
      setNetworkState('CONNECTED');
      if (d.team) setTeam(d.team);
      if (d.role) setRole(d.role);
      if (d.matchStatus) {
        if (d.matchStatus === 'PLAYING') {
          lastForceStartTsRef.current = Date.now();
        }
        if (!(d.matchStatus === 'LOBBY' && Date.now() - lastForceStartTsRef.current < 12000)) {
          setHostMatchStatus(d.matchStatus);
          hostMatchStatusRef.current = d.matchStatus;
        }
      }
      if (typeof d.globalQIndex === 'number' && d.matchStatus === 'PLAYING') {
        currentGlobalQIndexRef.current = d.globalQIndex;
        maxReachedQIndexRef.current = d.globalQIndex;
        setCurrentGlobalQIndex(d.globalQIndex);
      }
      if (d.question) {
        const qIdx = typeof (d.question as any).qIndex === 'number'
          ? (d.question as any).qIndex
          : (typeof d.globalQIndex === 'number' ? d.globalQIndex : currentGlobalQIndexRef.current);
        setBroadcastQuestionMap(prev => ({ ...prev, [qIdx]: d.question! }));
        setCurrentBroadcastQ({ ...d.question, qIndex: qIdx } as any);
      }
      if (typeof d.lives === 'number') setLives(d.lives);
      if (typeof d.streak === 'number') setStreak(d.streak);
      if (typeof d.eliminated === 'boolean' && gameTypeRef.current === 'BELL') {
        setEliminated(d.eliminated);
        eliminatedRef.current = d.eliminated;
      }
      if (typeof d.fastScore === 'number' && d.fastScore > fastScoreRef.current) {
        setFastScore(d.fastScore);
        fastScoreRef.current = d.fastScore;
      }
      if (typeof d.savedCorrect === 'number' && d.savedCorrect > myCorrectCountRef.current) {
        setMyCorrectCount(d.savedCorrect);
        myCorrectCountRef.current = d.savedCorrect;
      }

      if (hasFinishedAllQuestionsRef.current) {
        setScreen('ENDED');
      } else if (d.matchStatus === 'PLAYING') {
        const validName = ensureValidStudentNameForMatchStart();
        if (validName) {
          hasJoinedArenaRef.current = true;
          waitingRoomLockedRef.current = false;
          setScreen('QUIZ');
        }
      }
    }
    else if (d.type === 'QUIZ_SYNC') {
      if (d.quiz && Array.isArray(d.quiz) && d.quiz.length > 0) {
        setQuizDeck(d.quiz);
        quizDeckRef.current = d.quiz;
        setBroadcastQuestionMap({});
      }
      if (d.question) {
        const qIdx = typeof d.qIndex === 'number' ? d.qIndex : currentGlobalQIndexRef.current;
        setBroadcastQuestionMap(prev => ({ ...prev, [qIdx]: d.question! }));
        setCurrentBroadcastQ({ ...d.question, qIndex: qIdx } as any);
      }
    }
    else if (d.type === 'FORCE_START_MATCH' || d.type === 'MATCH_START') {
      lastForceStartTsRef.current = Date.now();
      triggerSyncStateLock(260);
      hasFinishedAllQuestionsRef.current = false;
      maxReachedQIndexRef.current = 0;
      setHostMatchStatus('PLAYING');
      hostMatchStatusRef.current = 'PLAYING';
      waitingRoomLockedRef.current = false;
      activeStudentTimerQIndexRef.current = -1;
      startMsRef.current = Date.now();
      setRemSec(30);
      hasAnsweredCurrentQRef.current = false;
      setHasAnsweredCurrentQ(false);
      setIsAnswerLocked(false);
      setSelectedOptionOriginalIdx(null);
      setLastLockedResult(null);
      setEliminatedOptions([]);
      setWagerLevel(1);
      const startIdx = typeof d.qIndex === 'number' ? d.qIndex : 0;
      currentGlobalQIndexRef.current = startIdx;
      maxReachedQIndexRef.current = startIdx;
      setCurrentGlobalQIndex(startIdx);
      if (d.question) {
        setBroadcastQuestionMap(prev => ({ ...prev, [startIdx]: d.question! }));
        setCurrentBroadcastQ({ ...d.question, qIndex: startIdx } as any);
      }
      if (d.quiz && Array.isArray(d.quiz) && d.quiz.length > 0) {
        setQuizDeck(d.quiz);
        quizDeckRef.current = d.quiz;
      }
      const validName = ensureValidStudentNameForMatchStart();
      if (!validName) {
        setScreen('LOBBY');
        setShowNameAlert(true);
        return;
      }
      hasJoinedArenaRef.current = true;
      if (!eliminatedRef.current) {
        setScreen('QUIZ');
        sendEnter(validName);
        AudioFX.pullHeave();
        triggerBonusToast('🚀 GIÁO VIÊN ĐÃ BẮT ĐẦU! ĐÃ MỞ KHÓA ĐÁP ÁN & ĐỒNG BỘ CÂU HỎI TOÀN LỚP!');
      }
    }
    else if (d.type === 'PAUSE_TOGGLE') {
      if (d.status) {
        setHostMatchStatus(d.status);
        hostMatchStatusRef.current = d.status;
        if (d.status === 'PLAYING' && !eliminatedRef.current && !hasFinishedAllQuestionsRef.current && hasJoinedArenaRef.current) {
          waitingRoomLockedRef.current = false;
          activeStudentTimerQIndexRef.current = -1;
          startMsRef.current = Date.now();
          setScreen('QUIZ');
          triggerBonusToast('▶️ Giáo viên đã mở tiếp tục — Em có thể trả lời ngay!');
        } else if (d.status === 'PAUSED' && screenRef.current === 'QUIZ') {
          waitingRoomLockedRef.current = true;
          setScreen('WAITING');
          triggerBonusToast('⏸️ Giáo viên đang tạm dừng — Chuyển về Phòng chờ!');
        }
      }
    }
    else if (d.type === 'GAME_SWITCH' || d.type === 'GAME_SWITCHED') {
      // Giáo viên đổi trò chơi hoặc bấm Chuẩn bị sàn đấu: Học sinh đang chơi KHÔNG cần quét lại mã QR!
      if (d.gameType) {
        setGameType(d.gameType);
        gameTypeRef.current = d.gameType;
      }
      const nextStatus = d.status || 'LOBBY';
      setHostMatchStatus(nextStatus);
      hostMatchStatusRef.current = nextStatus;
      if (d.quiz && Array.isArray(d.quiz) && d.quiz.length > 0) {
        setQuizDeck(d.quiz);
        quizDeckRef.current = d.quiz;
        setBroadcastQuestionMap({});
      }
      if (d.question) {
        setBroadcastQuestionMap({ 0: d.question });
        setCurrentBroadcastQ({ ...d.question, qIndex: 0 } as any);
      }
      const nextQIdx = d.qIndex ?? d.globalQIndex ?? 0;
      hasFinishedAllQuestionsRef.current = false;
      currentGlobalQIndexRef.current = nextQIdx;
      maxReachedQIndexRef.current = nextQIdx;
      setCurrentGlobalQIndex(nextQIdx);
      setLastCompletedQIndex(-1);
      lastShuffledKeyRef.current = '';
      clearFreeze();
      setEliminated(false);
      eliminatedRef.current = false;
      setLives(3);
      setStreak(0);
      setFastScore(0);
      fastScoreRef.current = 0;
      setMyCorrectCount(0);
      myCorrectCountRef.current = 0;
      hasAnsweredCurrentQRef.current = false;
      setHasAnsweredCurrentQ(false);
      setIsAnswerLocked(false);
      setSelectedOptionOriginalIdx(null);
      setLastLockedResult(null);

      if (hasJoinedArenaRef.current && !isPlaceholderOrEmptyName(studentNameRef.current)) {
        if (nextStatus === 'PLAYING') {
          waitingRoomLockedRef.current = false;
          activeStudentTimerQIndexRef.current = -1;
          startMsRef.current = Date.now();
          setRemSec(30);
          setScreen('QUIZ');
          triggerBonusToast('🎮 Đã đồng bộ bộ câu hỏi mới — Bắt đầu thi đấu ngay!');
        } else {
          waitingRoomLockedRef.current = true;
          setScreen('WAITING');
          triggerBonusToast('📣 Đã đồng bộ trò chơi mới trong Phòng thi (Đợi Giáo viên bấm Bắt đầu)!');
        }
      }
    }
    else if (d.type === 'PLAYER_LIVES_SYNC' && d.playerId === myPlayerId) {
      if (typeof d.lives === 'number') setLives(d.lives);
      if (typeof d.streak === 'number') setStreak(d.streak);
      if (typeof d.eliminated === 'boolean') {
        setEliminated(d.eliminated);
        eliminatedRef.current = d.eliminated;
      }
      if (typeof d.fastScore === 'number') {
        setFastScore(d.fastScore);
        fastScoreRef.current = d.fastScore;
      }

      if (d.bonusAwarded && gameTypeRef.current === 'TUG') {
        awardRandomPowerUp();
        triggerBonusToast("🔥 ĐÚNG 3 CÂU LIÊN TIẾP! NHẬN THẺ KỸ NĂNG KÉO CO!");
      }
      if (d.rescuedNow) {
        setEliminated(false);
        eliminatedRef.current = false;
        setIsFrozen(false);
        setScreen(hasFinishedAllQuestionsRef.current ? 'ENDED' : hostMatchStatusRef.current === 'PLAYING' ? 'QUIZ' : 'WAITING');
        triggerBonusToast("🛟 THẦY ĐÃ CỨU TRỢ HỒI SINH EM TRỞ LẠI SÀN ĐẤU! (❤️)");
      } else if (d.eliminated && gameTypeRef.current === 'BELL') {
        setScreen('ELIMINATED');
      }
    }
    else if (d.type === 'RESCUE_ALL_PLAYERS') {
      setEliminated(false);
      eliminatedRef.current = false;
      setIsFrozen(false);
      setLives(1);
      if (hasJoinedArenaRef.current && !isPlaceholderOrEmptyName(studentNameRef.current)) {
        setScreen(hasFinishedAllQuestionsRef.current ? 'ENDED' : hostMatchStatusRef.current === 'PLAYING' ? 'QUIZ' : 'WAITING');
      }
      triggerBonusToast("🛟 TOÀN BỘ HỌC SINH ĐÃ ĐƯỢC CỨU TRỢ HỒI SINH! (❤️)");
    }
    else if (d.type === 'OPPONENT_FROZEN' && d.targetPlayerId === myPlayerId && gameTypeRef.current === 'TUG') {
      if (activeShield) {
        setActiveShield(false);
        triggerBonusToast('🛡️ KHIÊN BẢO VỆ ĐÃ CHẶN ĐÒN ĐÓNG BĂNG TỪ ĐỐI THỦ!');
      } else {
        triggerFreeze(3);
        triggerBonusToast('❄️ BẠN BỊ ĐỐI THỦ ĐÓNG BĂNG 3 GIÂY!');
      }
    }
    else if (d.type === 'HOST_HEARTBEAT') {
      setNetworkState('CONNECTED');
      // Chống gói nhịp tim cũ (trễ mạng) mang status 'LOBBY' ghi đè làm khóa đáp án sau khi Giáo viên vừa bấm Bắt đầu
      const isStaleLobbyHeartbeat =
        d.status === 'LOBBY' &&
        (Date.now() - lastForceStartTsRef.current < 12000 || hostMatchStatusRef.current === 'PLAYING');

      const effectiveHeartbeatStatus = isStaleLobbyHeartbeat ? 'PLAYING' : d.status;

      if (effectiveHeartbeatStatus) {
        if (effectiveHeartbeatStatus === 'PLAYING') {
          lastForceStartTsRef.current = Date.now();
        }
        setHostMatchStatus(effectiveHeartbeatStatus);
        hostMatchStatusRef.current = effectiveHeartbeatStatus;
      }
      if (d.gameType === 'BOSS') {
        const hp = d.bossHP ?? 1000;
        const maxHp = d.maxBossHP ?? 1000;
        setBossHP(hp);
        setMaxBossHP(maxHp);
        setMatchStatText(`🐉 Boss Máu: ${hp}/${maxHp} HP • Câu ${currentGlobalQIndexRef.current + 1}`);
      } else if (d.gameType === 'BELL') {
        setMatchStatText(`Còn trụ: ${d.bellAliveCount || 0}/${d.bellTotalCount || 0} HS`);
      } else if (d.gameType === 'FAST') {
        setMatchStatText(`⚡ Đua Tốc Độ • Câu #${currentGlobalQIndexRef.current + 1}`);
      } else {
        setMatchStatText(`Tỉ số kéo: Đỏ ${d.redRoundWins || 0} - Xanh ${d.blueRoundWins || 0}`);
      }

      if (d.worldEvent) {
        setActiveWorldEvent(d.worldEvent);
        setWorldEventTitle(d.worldEventTitle || '');
      }
      if (d.quiz && Array.isArray(d.quiz) && d.quiz.length > 0) {
        setQuizDeck(d.quiz);
        quizDeckRef.current = d.quiz;
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

      // Đồng bộ 100% câu hỏi giữa Giáo viên và Học sinh theo nhịp tim
      if (
        !hasFinishedAllQuestionsRef.current &&
        typeof d.globalQIndex === 'number' &&
        d.globalQIndex !== currentGlobalQIndexRef.current
      ) {
        const totalCount = Math.max(1, (d.quiz && d.quiz.length) || quizDeckRef.current.length || 1);
        if (d.globalQIndex >= totalCount && effectiveHeartbeatStatus === 'PLAYING') {
          advanceStudentQuestionOrFinish(totalCount - 1);
          return;
        }
        currentGlobalQIndexRef.current = d.globalQIndex;
        maxReachedQIndexRef.current = d.globalQIndex;
        setCurrentGlobalQIndex(d.globalQIndex);
        activeStudentTimerQIndexRef.current = -1;
        setLastCompletedQIndex(-1);
        clearFreeze();
        hasAnsweredCurrentQRef.current = false;
        setHasAnsweredCurrentQ(false);
        setIsAnswerLocked(false);
        setSelectedOptionOriginalIdx(null);
        setLastLockedResult(null);
        setEliminatedOptions([]);
        setWagerLevel(1);
        setRemSec(30);
        startMsRef.current = Date.now();
      }

      // Nếu Giáo viên vừa bấm "Kéo HS Vào Phòng Chờ" (forcePullTs trong 45s gần nhất), lập tức kéo học sinh quay lại phòng thi!
      if (
        typeof d.forcePullTs === 'number' &&
        d.forcePullTs > lastForcePullTsRef.current &&
        Date.now() - d.forcePullTs <= 45000
      ) {
        lastForcePullTsRef.current = d.forcePullTs;
        const validName = ensureValidStudentNameForMatchStart();
        if (!validName) {
          setScreen('LOBBY');
          setShowNameAlert(true);
        } else {
          hasJoinedArenaRef.current = true;
          setShowNameAlert(false);
          if (effectiveHeartbeatStatus === 'PLAYING' && !eliminatedRef.current && !hasFinishedAllQuestionsRef.current) {
            waitingRoomLockedRef.current = false;
            setScreen('QUIZ');
          } else if (screenRef.current === 'LOBBY') {
            waitingRoomLockedRef.current = true;
            setScreen('WAITING');
            AudioFX.bonusLifeChime();
            triggerBonusToast(`🧲 Thầy/Cô đã kéo bạn (${validName}) vào phòng thi!`);
          }
          sendEnter(validName);
        }
      }

      // Nếu Học sinh đã vào phòng mà trên danh sách playerIds của Giáo viên chưa có ID của học sinh này -> lập tức gửi báo danh lại ngay!
      if (hasJoinedArenaRef.current && !isPlaceholderOrEmptyName(studentNameRef.current)) {
        if (!Array.isArray(d.playerIds) || !d.playerIds.includes(myPlayerIdRef.current)) {
          sendEnter(studentNameRef.current);
        }
      }

      // Kéo học sinh đã nhập tên từ Phòng chờ vào phòng thi và mở đáp án ngay khi Giáo viên đang PLAYING
      if (effectiveHeartbeatStatus === 'PLAYING' && !eliminatedRef.current && !hasFinishedAllQuestionsRef.current && (screenRef.current === 'WAITING' || (screenRef.current === 'LOBBY' && hasJoinedArenaRef.current))) {
        const validName = ensureValidStudentNameForMatchStart();
        if (validName) {
          hasJoinedArenaRef.current = true;
          waitingRoomLockedRef.current = false;
          setScreen('QUIZ');
          sendEnter(validName);
          triggerBonusToast('🚀 Giáo viên đã bắt đầu trận đấu — Đã mở khóa câu trả lời đồng loạt!');
        }
      }
    }
    else if (d.type === 'QUESTION_START') {
      if (hasFinishedAllQuestionsRef.current && (d.qIndex ?? 0) > 0) {
        return;
      }
      lastForceStartTsRef.current = Date.now();
      setHostMatchStatus('PLAYING');
      hostMatchStatusRef.current = 'PLAYING';
      waitingRoomLockedRef.current = false;
      const validName = ensureValidStudentNameForMatchStart();
      if (typeof d.qIndex === 'number') {
        const totalCount = Math.max(1, (d.quiz && d.quiz.length) || quizDeckRef.current.length || 1);
        if (d.qIndex >= totalCount) {
          advanceStudentQuestionOrFinish(totalCount - 1);
          return;
        }

        const isNewQuestion = d.qIndex !== currentGlobalQIndexRef.current || screenRef.current !== 'QUIZ';
        currentGlobalQIndexRef.current = d.qIndex;
        maxReachedQIndexRef.current = d.qIndex;
        setCurrentGlobalQIndex(d.qIndex);
        if (isNewQuestion || d.qIndex === 0) {
          // HOTFIX 1.3: Khóa tạm thời nút bấm khi chuyển sang câu hỏi mới đồng bộ từ giáo viên
          triggerSyncStateLock(260);
          activeStudentTimerQIndexRef.current = -1;
          setLastCompletedQIndex(-1);
          clearFreeze();
          hasAnsweredCurrentQRef.current = false;
          setHasAnsweredCurrentQ(false);
          setIsAnswerLocked(false);
          setSelectedOptionOriginalIdx(null);
          setLastLockedResult(null);
          setEliminatedOptions([]);
          setWagerLevel(1);
          setRemSec(30);
          startMsRef.current = Date.now();
        }
        if (d.question) {
          setBroadcastQuestionMap(prev => ({ ...prev, [d.qIndex!]: d.question! }));
          setCurrentBroadcastQ({ ...d.question, qIndex: d.qIndex } as any);
        }
        if (d.worldEvent) {
          setActiveWorldEvent(d.worldEvent);
          setWorldEventTitle(d.worldEventTitle || '');
        } else {
          setActiveWorldEvent('NONE');
          setWorldEventTitle('');
        }
        if (d.quiz && Array.isArray(d.quiz) && d.quiz.length > 0) {
          setQuizDeck(d.quiz);
          quizDeckRef.current = d.quiz;
        }
        if (!validName) {
          setScreen('LOBBY');
          setShowNameAlert(true);
          return;
        }
        hasJoinedArenaRef.current = true;
        if (!eliminatedRef.current) {
          setScreen('QUIZ');
          sendEnter(validName);
        }
      }
    }
  };

  const handleIncomingMessageRef = useRef(handleIncomingMessage);
  handleIncomingMessageRef.current = handleIncomingMessage;

  // Connect to room with network status tracking (Luôn dùng ref mới nhất, giữ kết nối xuyên suốt 100%)
  useEffect(() => {
    CloudNetwork.connect(
      roomId,
      (msg) => handleIncomingMessageRef.current(msg),
      () => {
        setConnStatus(`🟢 Đã kết nối Phòng ${roomId}!`);
        setNetworkState('CONNECTED');
        // Gửi ngay thông tin nhân vật lên Server/Host ngay cả khi học sinh đang ở Sảnh (LOBBY) để hiện nhân vật 3D tức thì!
        sendEnter();
      },
      (newStatus) => {
        setNetworkState(newStatus);
        if (newStatus === 'CONNECTED') {
          setConnStatus(`🟢 Đã kết nối Phòng ${roomId}!`);
          sendEnter();
        }
      }
    );

    // Đồng bộ định kỳ chống rớt mạng / chống văng và đảm bảo nhân vật 3D luôn xuất hiện trên màn hình Giáo viên
    let lastSyncTs = Date.now();
    let lastSyncedScore = fastScoreRef.current;
    const interval = setInterval(() => {
      const now = Date.now();
      const scoreChanged = fastScoreRef.current !== lastSyncedScore;
      const neededDelay = hasConfirmedEnterRef.current ? 4500 : 2000;
      if (scoreChanged || now - lastSyncTs >= neededDelay) {
        lastSyncTs = now;
        lastSyncedScore = fastScoreRef.current;
        sendEnter();
      }
    }, 1500);

    return () => {
      // HOTFIX 1.2: Dọn dẹp toàn bộ timer và kết nối mạng khi component unmount để chống Memory Leak
      clearInterval(interval);
      if (timerRef.current) clearInterval(timerRef.current);
      if (freezeIntervalRef.current) clearInterval(freezeIntervalRef.current);
      if (chestTimerRef.current) clearInterval(chestTimerRef.current);
      if (finishTransitionTimerRef.current) clearTimeout(finishTransitionTimerRef.current);
      if (syncLockTimerRef.current) clearTimeout(syncLockTimerRef.current);
      CloudNetwork.disconnect();
    };
  }, [roomId]);

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
    if (screen !== 'QUIZ' || isSyncingState || isFrozen || eliminated || hasAnsweredCurrentQRef.current || hasAnsweredCurrentQ || isAnswerLocked) return;
    hasAnsweredCurrentQRef.current = true;
    setHasAnsweredCurrentQ(true);
    setIsAnswerLocked(true);
    setSelectedOptionOriginalIdx(origIdx);

    // HOTFIX 2.3: So khớp linh hoạt chuẩn hóa cùng kiểu dữ liệu (Number chỉ số 0-3 HOẶC String cleanText())
    const normalizedSelectedIdx = Number(origIdx);
    const normalizedCorrectIdx =
      typeof resolvedCurrentQ.correct === 'number' && !isNaN(resolvedCurrentQ.correct)
        ? Number(resolvedCurrentQ.correct)
        : typeof resolvedCurrentQ.correct === 'string' && /^[A-Da-d]$/.test(String(resolvedCurrentQ.correct).trim())
        ? String(resolvedCurrentQ.correct).trim().toUpperCase().charCodeAt(0) - 65
        : Number(resolvedCurrentQ.correct);

    const isIndexMatch =
      normalizedSelectedIdx >= 0 &&
      normalizedSelectedIdx <= 3 &&
      normalizedSelectedIdx === normalizedCorrectIdx;

    const selectedTextClean = cleanText(resolvedCurrentQ.opts?.[normalizedSelectedIdx] ?? '');
    const correctTextClean = cleanText(
      resolvedCurrentQ.opts?.[normalizedCorrectIdx] ??
      (typeof resolvedCurrentQ.correct === 'string' ? resolvedCurrentQ.correct : '')
    );
    const isCleanTextMatch =
      selectedTextClean.length > 0 &&
      correctTextClean.length > 0 &&
      selectedTextClean === correctTextClean;

    const isCorrect = isIndexMatch || isCleanTextMatch;
    processAnswerOutcome(isCorrect, isCorrect ? 1 : 0);
  };

  // Submit Answer for True/False (Dạng thức II: 4 ý a, b, c, d - Chỉ bấm nộp 1 lần duy nhất)
  const handleSubmitTrueFalse = () => {
    if (screen !== 'QUIZ' || isSyncingState || isFrozen || eliminated || hasAnsweredCurrentQRef.current || hasAnsweredCurrentQ || isAnswerLocked) return;
    hasAnsweredCurrentQRef.current = true;
    setHasAnsweredCurrentQ(true);
    setIsAnswerLocked(true);

    const repairedQ = repairQuizItemIfCorrupted(resolvedCurrentQ);
    const items = repairedQ.tfItems || [];

    let correctCount = 0;
    items.forEach(item => {
      const userChoice = Boolean(tfAnswers[item.label] ?? false);
      if (userChoice === Boolean(item.isCorrect)) {
        correctCount++;
      }
    });

    const won = items.length > 0 && correctCount === items.length;
    processAnswerOutcome(won, won ? 1 : 0, `${correctCount}/${items.length} mệnh đề đúng`);
  };

  // Submit Answer for Short Answer / Fill-in (Dạng thức III: Chỉ bấm gửi 1 lần duy nhất)
  const handleSubmitShortAnswer = () => {
    if (screen !== 'QUIZ' || isSyncingState || isFrozen || eliminated || hasAnsweredCurrentQRef.current || hasAnsweredCurrentQ || isAnswerLocked || !shortAnswerInput.trim()) return;
    hasAnsweredCurrentQRef.current = true;
    setHasAnsweredCurrentQ(true);
    setIsAnswerLocked(true);

    // HOTFIX 2.3: So khớp linh hoạt bằng hàm chuẩn hóa cleanText() và ép kiểu Number
    const correctVal = cleanText(resolvedCurrentQ.shortAnswer || resolvedCurrentQ.opts[0] || '');
    const userVal = cleanText(shortAnswerInput);

    // Check numerical or string equivalence (support comma/dot decimal)
    const normCorrect = correctVal.replace(',', '.');
    const normUser = userVal.replace(',', '.');
    const isNumEqual =
      normCorrect.length > 0 &&
      normUser.length > 0 &&
      !isNaN(Number(normCorrect)) &&
      !isNaN(Number(normUser)) &&
      Number(normCorrect) === Number(normUser);
    const isStrEqual = correctVal.length > 0 && correctVal === userVal;
    const isCorrect = isNumEqual || isStrEqual;

    processAnswerOutcome(isCorrect, isCorrect ? 1 : 0, `Kết quả "${shortAnswerInput.trim()}"`);
  };

  // Mở Rương Bí Ẩn Định Mệnh (Bắt buộc trả lời đúng liên tiếp 5 câu - Dùng 1 lần duy nhất cả trận)
  const handleOpenMysteryChest = (chestIndex: number) => {
    if (!mysteryChestsAvailable || claimedChestResult) return;
    if (chestTimerRef.current) {
      clearInterval(chestTimerRef.current);
      chestTimerRef.current = null;
    }
    setHasOpenedMysteryChest(true);
    try {
      sessionStorage.setItem(`kc3d_chest_opened_${tabSessionId}`, 'true');
    } catch {}

    AudioFX.jackpotSpin();

    const roll = Math.random();
    let icon = '💎';
    let title = 'NỔ HŨ KIM CƯƠNG (+1.500Đ)!';
    let desc = 'Bạn mở trúng Nổ Hũ Kim Cương: Thưởng nóng ngay +1.500 điểm thưởng!';
    let bonusDelta = 1500;
    let specialPower: string | undefined = undefined;
    let nextLives = lives;

    if (roll < 0.25) {
      // 1. 💎 Nổ Hũ Kim Cương: +1.500 điểm thưởng
      icon = '💎';
      title = 'NỔ HŨ KIM CƯƠNG (+1.500Đ)!';
      desc = `Rương Kho Báu #${chestIndex + 1} phát nổ Kim Cương: Thưởng nóng ngay +1.500 điểm thưởng!`;
      bonusDelta = 1500;
    } else if (roll < 0.50) {
      // 2. 🥷 Đạo Chích: +900đ và hút 500đ của bạn đang dẫn đầu Top 1
      icon = '🥷';
      title = 'ĐẠO CHÍCH (+900Đ & HÚT 500Đ TOP 1)!';
      desc = `Rương #${chestIndex + 1}: Kích hoạt Đạo Chích +900đ và xuất chiêu hút 500đ từ đối thủ đang dẫn đầu Top 1!`;
      bonusDelta = 900;
      specialPower = 'STEAL_LEADER';
    } else if (roll < 0.75) {
      // 3. 💖 Tim Vàng: +1 Mạng hồi sinh trong Rung Chuông Vàng
      icon = '💖';
      title = 'TIM VÀNG (+1 MẠNG HỒI SINH & +500Đ)!';
      desc = `Rương #${chestIndex + 1}: Nhận ngay +1 ❤️ Mạng hồi sinh quý giá trong Rung Chuông Vàng và +500 điểm!`;
      bonusDelta = 500;
      nextLives = Math.min(5, lives + 1);
      setLives(nextLives);
      if (eliminatedRef.current) {
        setEliminated(false);
        eliminatedRef.current = false;
        if (screenRef.current === 'ELIMINATED') {
          setScreen('QUIZ');
        }
      }
    } else {
      // 4. 🛡️ Khiên Bất Tử: Bảo vệ bạn không bị phạt nếu câu sau sai!
      icon = '🛡️';
      title = 'KHIÊN BẤT TỬ BẢO VỆ CÂU TIẾP THEO!';
      desc = `Rương #${chestIndex + 1}: Kích hoạt Khiên Bất Tử bảo vệ bạn tuyệt đối không bị phạt điểm / mất mạng nếu câu sau sai!`;
      bonusDelta = 300;
      setHasImmunityShield(true);
      setActiveShield(true);
    }

    const updatedScore = fastScoreRef.current + bonusDelta;
    fastScoreRef.current = updatedScore;
    setFastScore(updatedScore);
    setClaimedChestResult({ icon, title, desc });
    setMysteryChestsAvailable(false);

    CloudNetwork.sendMessage({
      type: 'MYSTERY_CHEST_CLAIMED',
      playerId: myPlayerId,
      team,
      bonusScoreDelta: bonusDelta,
      totalScore: updatedScore,
      lives: nextLives,
      powerUpUsed: specialPower as any,
      mysteryRewardText: `${icon} ${title}`,
      hasOpenedMysteryChest: true
    });

    // Chỉ tự động chuyển nếu là câu cuối cùng để kết thúc; các câu khác đợi Giáo viên chuyển đồng bộ cùng cả lớp!
    const totalCount = Math.max(1, quizDeckRef.current.length || quizDeck.length || 1);
    if (!eliminatedRef.current && currentGlobalQIndexRef.current + 1 >= totalCount) {
      if (finishTransitionTimerRef.current) clearTimeout(finishTransitionTimerRef.current);
      const answeredIdx = currentGlobalQIndexRef.current;
      finishTransitionTimerRef.current = setTimeout(() => {
        if (!eliminatedRef.current) {
          advanceStudentQuestionOrFinish(answeredIdx);
        }
      }, 1400);
    }
  };

  // Common answer processor (Tích hợp Tốc độ Phản xạ + Mức Cược Bản Lĩnh + Chuỗi Bốc Lửa + Rương Bí Ẩn)
  const processAnswerOutcome = (isCorrect: boolean, factor: number, detailNote?: string) => {
    const elapsedSec = Math.max(0.2, (Date.now() - startMsRef.current) / 1000);
    const totalCount = Math.max(1, quizDeckRef.current.length || quizDeck.length || 1);
    const isFinalQuestion = currentGlobalQIndexRef.current + 1 >= totalCount;
    const activeWager = wagerLevel || 1;
    const isGoldenEvent = activeWorldEvent === 'GOLDEN_X2';

    // Đánh dấu đã dùng lượt cược bản lĩnh duy nhất nếu chọn Liều Lĩnh (1.5x) hoặc Tất Tay (2.5x)
    if (activeWager > 1) {
      setHasUsedSpecialWager(true);
      try {
        sessionStorage.setItem(`kc3d_wager_used_${tabSessionId}`, 'true');
      } catch {}
    }

    if (isCorrect) {
      AudioFX.pullHeave();
      const nextStreak = streak + 1;
      setStreak(nextStreak);

      const powerMultiplier = (gameType === 'TUG' && doublePowerActive) ? 2 : 1;
      if (doublePowerActive) setDoublePowerActive(false);

      // Điểm thưởng tốc độ phản xạ (Nhanh <= 5s: +300đ, <= 10s: +150đ)
      const speedBonus = elapsedSec <= 5 ? 300 : elapsedSec <= 10 ? 150 : 0;
      // Điểm thưởng chuỗi Bốc Lửa (Streak >= 3: +200đ, Streak >= 5: +400đ)
      const streakBonus = nextStreak >= 5 ? 400 : nextStreak >= 3 ? 200 : 0;

      // Điểm cơ bản theo mức cược bản lĩnh
      // • 🛡️ An Toàn (x1): 1000đ
      // • ⚡ Liều Lĩnh (x1.5): 1500đ (nhân 1.5x điểm)
      // • 🔥 Tất Tay (x2.5): 2500đ (nhân 2.5x điểm)
      const basePts = activeWager === 2.5
        ? Math.round(2500 * factor * powerMultiplier)
        : activeWager === 1.5
        ? Math.round(1500 * factor * powerMultiplier)
        : Math.round(1000 * factor * powerMultiplier);

      const gainedPts = basePts + speedBonus + streakBonus;
      const effectiveHostPts = isGoldenEvent ? gainedPts * 2 : gainedPts;

      const nextTotalScore = fastScoreRef.current + effectiveHostPts;
      const nextCorrectCount = myCorrectCountRef.current + 1;
      fastScoreRef.current = nextTotalScore;
      myCorrectCountRef.current = nextCorrectCount;
      setFastScore(nextTotalScore);
      setMyCorrectCount(nextCorrectCount);

      // Riêng cơ chế 4. Mở Rương Bí Ẩn Định Mệnh: Bắt buộc phải trả lời đúng liên tiếp 5 câu (Streak = 5) mới được mở rương (Chỉ mở 1 lần duy nhất cả trận)
      const unlockMysteryChest = !isFinalQuestion && !hasOpenedMysteryChest && nextStreak === 5;
      if (unlockMysteryChest) {
        setMysteryChestsAvailable(true);
        setClaimedChestResult(null);
        setChestCountdown(4);
        if (chestTimerRef.current) clearInterval(chestTimerRef.current);
        let rem = 4;
        chestTimerRef.current = setInterval(() => {
          rem -= 1;
          setChestCountdown(rem);
          if (rem <= 0) {
            if (chestTimerRef.current) {
              clearInterval(chestTimerRef.current);
              chestTimerRef.current = null;
            }
            handleOpenMysteryChest(Math.floor(Math.random() * 3));
          }
        }, 1000);
      } else {
        setMysteryChestsAvailable(false);
        setClaimedChestResult(null);
      }

      // Chỉ có trò Kéo Co (TUG) mới có hiệu ứng thẻ kỹ năng
      if (gameType === 'TUG' && nextStreak >= 3) {
        awardRandomPowerUp();
      }

      const speedTag = elapsedSec <= 5 ? ` • ⚡ Phản xạ thần tốc ${elapsedSec.toFixed(1)}s (+300đ)` : elapsedSec <= 10 ? ` • ⚡ Tốc độ nhanh (+150đ)` : '';
      const wagerTag = activeWager === 2.5 ? ' • 💎 Thắng Cược Tất Tay x2.5 (+2500đ)!' : activeWager === 1.5 ? ' • ⚡ Thắng Cược Liều Lĩnh x1.5 (+1500đ)!' : '';
      const streakTag = nextStreak >= 5 ? ` • 🔥 Chuỗi 5 Bốc Lửa (Mở Rương Định Mệnh)!` : nextStreak >= 3 ? ` • 🔥 Chuỗi ${nextStreak} Bốc Lửa` : '';
      const goldenTag = isGoldenEvent ? ' • 🌟 Nhân đôi Giờ Vàng X2!' : '';

      setLastLockedResult({
        isCorrect: true,
        text: `✅ CHÍNH XÁC! ${detailNote ? `(${detailNote}) ` : ''}+${effectiveHostPts} điểm${wagerTag}${speedTag}${streakTag}${goldenTag}`
      });

      CloudNetwork.sendMessage({
        type: 'PULL_CORRECT',
        playerId: myPlayerId,
        playerName: studentNameRef.current,
        avatar: avatarRef.current,
        team,
        globalQIndex: currentGlobalQIndexRef.current,
        elapsedSec,
        correctCountInTF: factor,
        wagerLevel: activeWager,
        gainedPts,
        totalScore: nextTotalScore,
        savedCorrect: nextCorrectCount,
        hasUsedSpecialWager: activeWager > 1
      });

      syncTop10State(undefined, {
        id: myPlayerId,
        name: studentNameRef.current,
        team,
        score: nextTotalScore,
        correct: nextCorrectCount
      });

      setLastCompletedQIndex(currentGlobalQIndexRef.current);

      // Chỉ tự động chuyển nếu là câu cuối cùng; các câu trước đó đợi Giáo viên chuyển câu đồng bộ cùng cả lớp!
      if (!eliminatedRef.current && isFinalQuestion) {
        if (finishTransitionTimerRef.current) clearTimeout(finishTransitionTimerRef.current);
        const answeredIdx = currentGlobalQIndexRef.current;
        finishTransitionTimerRef.current = setTimeout(() => {
          if (!eliminatedRef.current) {
            advanceStudentQuestionOrFinish(answeredIdx);
          }
        }, 1400);
      }
    } else {
      AudioFX.freezeCrack();
      setStreak(0);
      setMysteryChestsAvailable(false);
      setClaimedChestResult(null);
      if (chestTimerRef.current) {
        clearInterval(chestTimerRef.current);
        chestTimerRef.current = null;
      }

      // Kiểm tra Khiên Bất Tử (từ Rương Bí Ẩn) hoặc Khiên Bảo Vệ
      const isProtectedByShield = hasImmunityShield || activeShield;
      if (hasImmunityShield) setHasImmunityShield(false);
      if (activeShield) setActiveShield(false);

      // Mức trừ điểm theo đúng quy tắc cược bản lĩnh:
      // • 🛡️ An Toàn (x1): Sai không bị trừ điểm (penalty = 0)
      // • ⚡ Liều Lĩnh (x1.5): Sai bị trừ -300đ
      // • 🔥 Tất Tay (x2.5): Sai bị trừ -800đ
      let penaltyPts = 0;
      if (activeWager === 2.5) {
        penaltyPts = 800;
      } else if (activeWager === 1.5) {
        penaltyPts = 300;
      } else {
        penaltyPts = 0;
      }

      let nextTotalScore = fastScoreRef.current;
      let nextLivesVal = lives;

      if (isProtectedByShield) {
        // Được Khiên Bất Tử bảo vệ -> Tuyệt đối không bị trừ điểm và không mất mạng!
        setLastLockedResult({
          isCorrect: false,
          text: '🛡️ KHIÊN BẤT TỬ ĐÃ BẢO VỆ BẠN! Câu này trả lời sai nhưng bạn hoàn toàn không bị phạt điểm / mất mạng!'
        });
      } else if (gameType === 'BELL') {
        // Rung Chuông Vàng: Mất 1 mạng, kèm trừ điểm nếu chọn cược Liều Lĩnh / Tất Tay
        nextLivesVal = Math.max(0, lives - 1);
        setLives(nextLivesVal);
        if (nextLivesVal <= 0) {
          setEliminated(true);
          eliminatedRef.current = true;
          setScreen('ELIMINATED');
        }
        if (penaltyPts > 0) {
          nextTotalScore = fastScoreRef.current - penaltyPts;
          fastScoreRef.current = nextTotalScore;
          setFastScore(nextTotalScore);
        }
        setLastLockedResult({
          isCorrect: false,
          text: activeWager === 2.5
            ? '❌ ĐÁP ÁN SAI! Cược Tất Tay x2.5 thất bại: Mất 1 ❤️ và bị phạt -800đ!'
            : activeWager === 1.5
            ? '❌ ĐÁP ÁN SAI! Cược Liều Lĩnh x1.5 thất bại: Mất 1 ❤️ và bị phạt -300đ!'
            : '❌ ĐÁP ÁN SAI! Mức cược An Toàn (x1): Mất 1 ❤️ (Không bị phạt điểm)!'
        });
      } else if (gameType === 'FAST' || gameType === 'BOSS') {
        // Đua Tốc Độ / Diệt Boss
        if (penaltyPts > 0) {
          nextTotalScore = fastScoreRef.current - penaltyPts;
          fastScoreRef.current = nextTotalScore;
          setFastScore(nextTotalScore);
        }
        setLastLockedResult({
          isCorrect: false,
          text: activeWager === 2.5
            ? '❌ ĐÁP ÁN SAI! Cược Tất Tay x2.5 thất bại: Trừ -800 điểm!'
            : activeWager === 1.5
            ? '❌ ĐÁP ÁN SAI! Cược Liều Lĩnh x1.5 thất bại: Trừ -300 điểm!'
            : '❌ ĐÁP ÁN SAI! Mức cược An Toàn (x1): Bạn không bị trừ điểm!'
        });
      } else {
        // Kéo Co (TUG)
        if (penaltyPts > 0) {
          nextTotalScore = fastScoreRef.current - penaltyPts;
          fastScoreRef.current = nextTotalScore;
          setFastScore(nextTotalScore);
        }
        setLastLockedResult({
          isCorrect: false,
          text: activeWager === 2.5
            ? '❌ ĐÁP ÁN SAI! Cược Tất Tay thất bại: Trừ -800đ & đóng băng!'
            : activeWager === 1.5
            ? '❌ ĐÁP ÁN SAI! Cược Liều Lĩnh thất bại: Trừ -300đ & đóng băng!'
            : '❌ ĐÁP ÁN SAI! Mức cược An Toàn (x1): Không bị trừ điểm • Đã khóa câu trả lời!'
        });
      }

      CloudNetwork.sendMessage({
        type: 'FREEZE_WRONG',
        playerId: myPlayerId,
        playerName: studentNameRef.current,
        avatar: avatarRef.current,
        team,
        globalQIndex: currentGlobalQIndexRef.current,
        wagerLevel: activeWager,
        lives: nextLivesVal,
        totalScore: nextTotalScore,
        savedCorrect: myCorrectCountRef.current,
        hasUsedSpecialWager: activeWager > 1
      });

      syncTop10State(undefined, {
        id: myPlayerId,
        name: studentNameRef.current,
        team,
        score: nextTotalScore,
        correct: myCorrectCountRef.current
      });

      setLastCompletedQIndex(currentGlobalQIndexRef.current);

      if (!eliminatedRef.current && isFinalQuestion) {
        if (finishTransitionTimerRef.current) clearTimeout(finishTransitionTimerRef.current);
        const answeredIdx = currentGlobalQIndexRef.current;
        finishTransitionTimerRef.current = setTimeout(() => {
          if (!eliminatedRef.current) {
            advanceStudentQuestionOrFinish(answeredIdx);
          }
        }, 1300);
      }
    }
  };

  // Cập nhật Họ và Tên trực tiếp ngay trong Phòng chờ hoặc khi được kéo vào thi đấu (Bắt buộc điền tên thật!)
  const handleUpdateNameInWaiting = (nameToSave?: string) => {
    const finalName = (nameToSave ?? tempInputName ?? '').trim();
    if (isPlaceholderOrEmptyName(finalName)) {
      triggerBonusToast('⚠️ BẮT BUỘC: Vui lòng nhập Họ và Tên thật của bạn (tối thiểu 2 ký tự) rồi bấm Lưu lại!');
      return;
    }
    setStudentName(finalName);
    studentNameRef.current = finalName;
    setTempInputName(finalName);
    setShowNameAlert(false);
    try {
      sessionStorage.setItem(`kc3d_name_${tabSessionId}`, finalName);
      localStorage.setItem('kc3d_last_name', finalName);
      sessionStorage.setItem(`kc3d_joined_${tabSessionId}`, '1');
    } catch {}

    sendEnter(finalName);
    CloudNetwork.sendMessage({
      type: 'PLAYER_UPDATE_NAME',
      playerId: myPlayerId,
      playerName: finalName,
      preferredTeam: teamRef.current,
      avatar: avatarRef.current,
      savedScore: fastScoreRef.current,
      savedCorrect: myCorrectCountRef.current
    });
    AudioFX.bonusLifeChime();
    triggerBonusToast(`✅ Đã lưu Họ và Tên: "${finalName}"!`);
  };

  // Vào Phòng chờ (WAITING) - Bắt buộc học sinh phải điền tên và Lưu lại mới được chơi!
  const handleReadyInRope = (
    targetScreen: 'QUIZ' | 'WAITING' = 'WAITING',
    overrideName?: string,
    overrideAvatar?: AvatarConfig,
    overrideTeam?: PlayerTeam
  ) => {
    const cleanName = (overrideName ?? studentName ?? tempInputName ?? '').trim();
    if (isPlaceholderOrEmptyName(cleanName)) {
      setShowNameAlert(true);
      return;
    }
    const finalAv = overrideAvatar || avatar;
    const finalTm = overrideTeam || team;

    setStudentName(cleanName);
    studentNameRef.current = cleanName;
    setTempInputName(cleanName);
    setAvatar(finalAv);
    avatarRef.current = finalAv;
    setTeam(finalTm);
    teamRef.current = finalTm;

    try {
      sessionStorage.setItem(`kc3d_name_${tabSessionId}`, cleanName);
      localStorage.setItem('kc3d_last_name', cleanName);
      sessionStorage.setItem(`kc3d_avatar_${tabSessionId}`, JSON.stringify(finalAv));
      sessionStorage.setItem(`kc3d_joined_${tabSessionId}`, '1');
    } catch {}

    hasJoinedArenaRef.current = true;
    hasFinishedAllQuestionsRef.current = false;
    hasConfirmedEnterRef.current = false;
    setHasConfirmedEnter(false);
    const effectiveScreen = hostMatchStatusRef.current === 'PLAYING' ? 'QUIZ' : 'WAITING';
    waitingRoomLockedRef.current = effectiveScreen === 'WAITING';
    AudioFX.stepInRope();

    const joinPayload: CloudMessage = {
      type: 'PLAYER_READY_ROPE',
      playerId: myPlayerId,
      preferredTeam: finalTm,
      playerName: cleanName,
      avatar: finalAv,
      savedScore: fastScoreRef.current,
      savedCorrect: myCorrectCountRef.current
    };

    // Cập nhật ngay chính học sinh vào Bảng Top 10 trên màn hình của mình và phát tín hiệu báo danh đa luồng
    syncTop10State(undefined, {
      id: myPlayerId,
      name: cleanName,
      team: finalTm,
      score: fastScoreRef.current,
      correct: myCorrectCountRef.current
    });

    CloudNetwork.sendMessage(joinPayload);
    setTimeout(() => CloudNetwork.sendMessage({ ...joinPayload }), 250);
    setTimeout(() => CloudNetwork.sendMessage({ ...joinPayload }), 800);

    if (effectiveScreen === 'QUIZ') {
      activeStudentTimerQIndexRef.current = -1;
      startMsRef.current = Date.now();
      setRemSec(30);
    }
    setScreen(effectiveScreen);
  };

  // Tạo nhanh Nhân vật ngẫu nhiên (Hỗ trợ Giáo viên mở nhiều Tab Ẩn Danh test tải Server siêu tốc)
  const handleQuickRandomCharacter = (autoEnterQuiz: boolean = false) => {
    const lastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
    const middleMale = ['Văn', 'Minh', 'Quốc', 'Gia', 'Đức', 'Tuấn', 'Hoàng', 'Anh'];
    const firstMale = ['An', 'Bảo', 'Khôi', 'Đạt', 'Hùng', 'Khang', 'Phúc', 'Quân', 'Tài', 'Thịnh', 'Long', 'Nam'];
    const middleFemale = ['Thị', 'Ngọc', 'Phương', 'Thanh', 'Bảo', 'Ánh', 'Mỹ', 'Khánh'];
    const firstFemale = ['Anh', 'Châu', 'Hà', 'Linh', 'Mai', 'My', 'Ngân', 'Nhi', 'Quỳnh', 'Thảo', 'Trang', 'Vy'];
    const classes = ['10A1', '10A2', '11A1', '11A3', '12A1', '12A2', '12A5'];
    const hairs: AvatarConfig['hairStyle'][] = ['cap', 'headband', 'crown', 'beret', 'cyber'];
    const costumes: AvatarConfig['costume'][] = ['uniform', 'aodai', 'superhero', 'sport'];
    const colors = ['#f59e0b', '#ef4444', '#0284c7', '#10b981', '#8b5cf6', '#ec4899'];

    const isFemale = Math.random() > 0.5;
    const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
    const mn = isFemale
      ? middleFemale[Math.floor(Math.random() * middleFemale.length)]
      : middleMale[Math.floor(Math.random() * middleMale.length)];
    const fn = isFemale
      ? firstFemale[Math.floor(Math.random() * firstFemale.length)]
      : firstMale[Math.floor(Math.random() * firstMale.length)];
    const cls = classes[Math.floor(Math.random() * classes.length)];
    const randNum = Math.floor(10 + Math.random() * 90);
    const randomName = `${ln} ${mn} ${fn} - ${cls} (#${randNum})`;

    const randomAv: AvatarConfig = {
      gender: isFemale ? 'female' : 'male',
      hairStyle: hairs[Math.floor(Math.random() * hairs.length)],
      costume: costumes[Math.floor(Math.random() * costumes.length)],
      accessoryColor: colors[Math.floor(Math.random() * colors.length)],
      expression: 'happy'
    };
    const randomTeam: PlayerTeam = Math.random() > 0.5 ? 'RED' : 'BLUE';

    setShowNameAlert(false);
    handleSaveProfile(randomName, randomAv);
    setTeam(randomTeam);
    teamRef.current = randomTeam;

    if (autoEnterQuiz) {
      handleReadyInRope('QUIZ', randomName, randomAv, randomTeam);
    }
  };

  // Tạo nhân vật mới hoàn toàn ngay trên Tab hiện tại (cấp ID mới độc lập)
  const handleCreateNewCharacterInTab = () => {
    const freshTabId = 'tab_' + Date.now().toString(36).slice(-4) + '_' + Math.random().toString(36).substring(2, 7);
    const freshPlayerId = 'hs_' + Date.now().toString(36).slice(-4) + '_' + Math.random().toString(36).substring(2, 7);
    try {
      sessionStorage.setItem('kc3d_tab_session_id', freshTabId);
      sessionStorage.setItem(`kc3d_pid_${freshTabId}`, freshPlayerId);
    } catch {}
    setTabSessionId(freshTabId);
    setMyPlayerId(freshPlayerId);
    setStudentName('');
    studentNameRef.current = '';
    setFastScore(0);
    fastScoreRef.current = 0;
    setMyCorrectCount(0);
    myCorrectCountRef.current = 0;
    setCurrentGlobalQIndex(0);
    currentGlobalQIndexRef.current = 0;
    maxReachedQIndexRef.current = 0;
    hasJoinedArenaRef.current = false;
    hasFinishedAllQuestionsRef.current = false;
    setHasAnsweredCurrentQ(false);
    hasAnsweredCurrentQRef.current = false;
    setIsAnswerLocked(false);
    setLastLockedResult(null);
    setEliminated(false);
    eliminatedRef.current = false;
    setLives(3);
    setStreak(0);
    setScreen('LOBBY');
    triggerBonusToast(`✨ Đã tạo phiên nhân vật mới (${freshPlayerId}) trên Tab này!`);
  };

  // Bắn thêm +5 Học Sinh Ảo vào phòng để test độ chịu tải của Server ngay lập tức
  const handleSpawnLoadTestBots = (count: number = 5) => {
    const lastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Đặng'];
    const firstNames = ['An', 'Bình', 'Châu', 'Dũng', 'Giang', 'Hải', 'Khánh', 'Linh', 'Minh', 'Ngọc', 'Phúc', 'Quân', 'Thảo', 'Trang', 'Vy'];
    const hairs: AvatarConfig['hairStyle'][] = ['cap', 'headband', 'crown', 'beret', 'cyber'];
    const costumes: AvatarConfig['costume'][] = ['uniform', 'aodai', 'superhero', 'sport'];
    const colors = ['#f59e0b', '#ef4444', '#0284c7', '#10b981', '#8b5cf6', '#ec4899'];

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const isFemale = Math.random() > 0.5;
        const botId = 'hs_bot_' + Date.now().toString(36).slice(-4) + '_' + Math.random().toString(36).substring(2, 7);
        const botName = `${lastNames[Math.floor(Math.random() * lastNames.length)]} ${firstNames[Math.floor(Math.random() * firstNames.length)]} (Test #${Math.floor(100 + Math.random() * 900)})`;
        const botTeam: PlayerTeam = i % 2 === 0 ? 'RED' : 'BLUE';
        const botScore = Math.floor(Math.random() * 4) * 1000;
        const botCorrect = Math.floor(botScore / 1000);
        CloudNetwork.sendMessage({
          type: 'PLAYER_READY_ROPE',
          playerId: botId,
          preferredTeam: botTeam,
          playerName: botName,
          avatar: {
            gender: isFemale ? 'female' : 'male',
            hairStyle: hairs[Math.floor(Math.random() * hairs.length)],
            costume: costumes[Math.floor(Math.random() * costumes.length)],
            accessoryColor: colors[Math.floor(Math.random() * colors.length)],
            expression: 'happy'
          },
          savedScore: botScore,
          savedCorrect: botCorrect
        });
      }, i * 90);
    }
    triggerBonusToast(`🚀 Đã tạo thêm +${count} Nhân vật Học sinh vào Phòng ${roomId} để test tải Server!`);
  };

  const currentQItem = repairQuizItemIfCorrupted(resolvedCurrentQ);

  // Render Nhân Vật Chibi Dễ Thương (Full-body Kawaii Chibi Nam / Nữ) cho màn hình điện thoại học sinh
  const renderCuteChibiCharacter = (
    size: number = 84,
    mood: 'happy' | 'thinking' | 'cheering' | 'sad' | 'frozen' = 'happy'
  ) => {
    const isFemale = avatar.gender === 'female';
    const outfitColor =
      avatar.costume === 'superhero'
        ? '#ef4444'
        : avatar.costume === 'aodai'
        ? '#ec4899'
        : avatar.costume === 'sport'
        ? '#10b981'
        : isFemale
        ? '#ec4899'
        : '#3b82f6';
    const accentColor = avatar.accessoryColor || (isFemale ? '#ec4899' : '#f59e0b');

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
              : isFemale
              ? 'linear-gradient(145deg, #831843, #312e81)'
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
          width={Math.round(size * 0.92)}
          height={Math.round(size * 0.92)}
          viewBox="0 0 80 80"
          style={{
            animation: 'chibiGentleSway 2.4s ease-in-out infinite',
            transformOrigin: 'bottom center'
          }}
        >
          {/* Hào quang nền dưới chân Chibi */}
          <ellipse cx="40" cy="73" rx="18" ry="4" fill="rgba(255,255,255,0.22)" />

          {/* Hai bím tóc dài hai bên nếu là Nhân vật Nữ (👧 Nữ) */}
          {isFemale && (
            <>
              <path
                d="M21 25 C11 28, 9 43, 15 52 C19 49, 20 38, 22 30 Z"
                fill="#1e293b"
                stroke="#334155"
                strokeWidth="1"
              />
              <path
                d="M59 25 C69 28, 71 43, 65 52 C61 49, 60 38, 58 30 Z"
                fill="#1e293b"
                stroke="#334155"
                strokeWidth="1"
              />
            </>
          )}

          {/* Áo choàng nếu là Siêu nhân */}
          {avatar.costume === 'superhero' && (
            <path d="M22 44 L14 68 L66 68 L58 44 Z" fill="#b91c1c" />
          )}

          {/* Chân & Giày Chibi dễ thương */}
          <rect x="29" y="61" width="8" height="10" rx="4" fill={isFemale ? '#fde68a' : '#1e293b'} />
          <rect x="43" y="61" width="8" height="10" rx="4" fill={isFemale ? '#fde68a' : '#1e293b'} />
          {isFemale && (
            <>
              <rect x="29" y="65" width="8" height="5" rx="2" fill="#ffffff" />
              <rect x="43" y="65" width="8" height="5" rx="2" fill="#ffffff" />
            </>
          )}
          <ellipse cx="33" cy="71" rx="5.5" ry="3" fill={isFemale ? '#f43f5e' : '#f8fafc'} />
          <ellipse cx="47" cy="71" rx="5.5" ry="3" fill={isFemale ? '#f43f5e' : '#f8fafc'} />

          {/* Thân áo Chibi (Nhân vật Nữ có thêm chân váy xếp ly xinh xắn) */}
          <rect x="23" y="42" width="34" height="21" rx="10" fill={outfitColor} stroke="#ffffff" strokeWidth="1.2" />
          {isFemale && (
            <polygon
              points="24,56 56,56 60,64 20,64"
              fill={avatar.costume === 'uniform' ? '#1e3a8a' : outfitColor}
              stroke="#ffffff"
              strokeWidth="1"
            />
          )}

          {/* Họa tiết trang phục */}
          {avatar.costume === 'uniform' && (
            <>
              <polygon points="33,42 40,51 47,42" fill="#ffffff" />
              {isFemale ? (
                <>
                  {/* Nơ cổ nữ sinh dễ thương */}
                  <polygon points="40,48 34,45 34,51" fill="#f43f5e" />
                  <polygon points="40,48 46,45 46,51" fill="#f43f5e" />
                  <circle cx="40" cy="48" r="2" fill="#fef08a" />
                </>
              ) : (
                /* Cà vạt nam sinh */
                <polygon points="38.5,47 41.5,47 42.5,58 40,61 37.5,58" fill="#ef4444" />
              )}
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
            <text x="40" y="56" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="900">10</text>
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

          {/* Đạo cụ theo trò chơi (Bảng vàng Rung Chuông Vàng / Ngọc phép Diệt Boss) */}
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
          <ellipse cx="27" cy="32" rx={isFemale ? '4.8' : '4.0'} ry="2.5" fill="#fb7185" opacity={isFemale ? '0.8' : '0.6'} />
          <ellipse cx="53" cy="32" rx={isFemale ? '4.8' : '4.0'} ry="2.5" fill="#fb7185" opacity={isFemale ? '0.8' : '0.6'} />

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
              <path d="M26 31 Q24 35 26 37 Q28 35 26 31 Z" fill="#38bdf8" />
              <path d="M54 31 Q52 35 54 37 Q56 35 54 31 Z" fill="#38bdf8" />
              <path d="M34 37 Q40 33 46 37" stroke="#0f172a" strokeWidth="2.3" fill="none" strokeLinecap="round" />
            </>
          ) : (
            <>
              {/* Đôi mắt to tròn long lanh */}
              <circle cx="31.5" cy="27.5" r="3.9" fill="#0f172a" />
              <circle cx="30.2" cy="26.2" r="1.5" fill="#ffffff" />
              <circle cx="32.8" cy="28.8" r="0.8" fill="#ffffff" />
              <circle cx="48.5" cy="27.5" r="3.9" fill="#0f172a" />
              <circle cx="47.2" cy="26.2" r="1.5" fill="#ffffff" />
              <circle cx="49.8" cy="28.8" r="0.8" fill="#ffffff" />
              {/* Lông mi cong dễ thương nếu là Nhân vật Nữ */}
              {isFemale && (
                <>
                  <path d="M27.5 25 L25.5 23.2" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M52.5 25 L54.5 23.2" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" />
                </>
              )}
              <path d="M34 34.5 Q40 39.5 46 34.5" stroke={isFemale ? '#e11d48' : '#0f172a'} strokeWidth="2.4" fill="none" strokeLinecap="round" />
            </>
          )}

          {/* Mái tóc trước trán theo giới tính Nam / Nữ */}
          {isFemale ? (
            <path d="M21 23 Q30 14 40 20 Q50 14 59 23 Q53 11 40 11 Q27 11 21 23 Z" fill="#1e293b" />
          ) : (
            <path d="M21 23 L26 17 L31 22 L38 15 L44 22 L51 16 L59 23 Q52 10 40 10 Q28 10 21 23 Z" fill="#1e293b" />
          )}

          {/* Hai nơ cài tóc xinh xắn cho Nhân vật Nữ */}
          {isFemale && (
            <>
              <circle cx="20" cy="23" r="3.6" fill="#f43f5e" stroke="#ffffff" strokeWidth="0.9" />
              <circle cx="60" cy="23" r="3.6" fill="#f43f5e" stroke="#ffffff" strokeWidth="0.9" />
            </>
          )}

          {/* Mũ / Phụ kiện đầu tùy chỉnh */}
          {avatar.hairStyle === 'crown' ? (
            <>
              <polygon points="24,16 30,5 40,13 50,5 56,16" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
              <circle cx="40" cy="10" r="2" fill="#ef4444" />
            </>
          ) : avatar.hairStyle === 'cap' ? (
            <>
              <path d="M21 19 Q40 5 59 19 Z" fill={accentColor} />
              <rect x="19" y="17" width="43" height="4" rx="2" fill={accentColor} stroke="#ffffff" strokeWidth="0.8" />
            </>
          ) : avatar.hairStyle === 'beret' ? (
            <>
              <ellipse cx="41" cy="12" rx="19" ry="7" transform="rotate(-8 41 12)" fill={accentColor} />
              <rect x="39" y="4" width="3" height="4" rx="1" fill={accentColor} />
            </>
          ) : avatar.hairStyle === 'cyber' ? (
            <>
              <path d="M20 26 Q20 8 40 8 Q60 8 60 26" stroke={accentColor} strokeWidth="4" fill="none" />
              <rect x="15" y="21" width="6.5" height="11" rx="3" fill={accentColor} stroke="#ffffff" strokeWidth="1" />
              <rect x="58.5" y="21" width="6.5" height="11" rx="3" fill={accentColor} stroke="#ffffff" strokeWidth="1" />
            </>
          ) : (
            <rect x="22" y="15" width="36" height="4" rx="2" fill={accentColor} />
          )}
        </svg>
      </div>
    );
  };

  // Nút chuyển nhanh Nhân Vật Nam / Nhân Vật Nữ ngay trên màn hình điện thoại học sinh
  const renderGenderQuickSelector = (compact: boolean = false) => {
    const isFemale = avatar.gender === 'female';
    return (
      <div style={{ display: 'inline-flex', gap: '5px', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => handleSaveProfile(studentName, { ...avatar, gender: 'male' })}
          style={{
            padding: compact ? '4px 8px' : '8px 14px',
            borderRadius: compact ? '8px' : '10px',
            fontSize: compact ? '11px' : '13px',
            fontWeight: 900,
            background: !isFemale ? 'linear-gradient(135deg, #0284c7, #2563eb)' : '#1e293b',
            color: '#ffffff',
            border: !isFemale ? '2px solid #7dd3fc' : '1px solid #475569',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: !isFemale ? '0 3px 10px rgba(37, 99, 235, 0.4)' : 'none'
          }}
        >
          👦 {compact ? 'Nam' : 'Nhân vật Nam'}
        </button>
        <button
          type="button"
          onClick={() => handleSaveProfile(studentName, { ...avatar, gender: 'female' })}
          style={{
            padding: compact ? '4px 8px' : '8px 14px',
            borderRadius: compact ? '8px' : '10px',
            fontSize: compact ? '11px' : '13px',
            fontWeight: 900,
            background: isFemale ? 'linear-gradient(135deg, #ec4899, #db2777)' : '#1e293b',
            color: '#ffffff',
            border: isFemale ? '2px solid #fbcfe8' : '1px solid #475569',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: isFemale ? '0 3px 10px rgba(236, 72, 153, 0.4)' : 'none'
          }}
        >
          👧 {compact ? 'Nữ' : 'Nhân vật Nữ'}
        </button>
      </div>
    );
  };

  const gameTitleDisplay =
    gameType === 'BELL'
      ? '🔔 RUNG CHUÔNG VÀNG 3D'
      : gameType === 'FAST'
      ? '⚡ ĐUA TỐC ĐỘ 3D'
      : gameType === 'BOSS'
      ? '🐉 DIỆT BOSS KIẾN THỨC 3D'
      : '⚔️ ĐẤU TRƯỜNG KÉO CO 3D';

  const renderTop10Board = () => (
    <div
      style={{
        background: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
        border: '2px solid #f59e0b',
        borderRadius: '18px',
        padding: '14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1.5px solid rgba(245, 158, 11, 0.35)',
          paddingBottom: '8px',
          marginBottom: '10px'
        }}
      >
        <span style={{ fontSize: '15px', fontWeight: 900, color: '#fef08a' }}>
          🏆 BẢNG XẾP HẠNG TOP 10
        </span>
        <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#38bdf8' }}>
          Phòng {roomId}
        </span>
      </div>

      {top10List.length === 0 ? (
        <div
          style={{
            padding: '18px 12px',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: '13px',
            fontWeight: 700
          }}
        >
          Chưa có dữ liệu xếp hạng. Bảng Top 10 sẽ cập nhật trực tiếp khi thi đấu!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {top10List.slice(0, 10).map((item, idx) => {
            const isMe = item.id === myPlayerId;
            const rankBadge = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
            return (
              <div
                key={item.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  background: isMe
                    ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.28), rgba(15, 23, 42, 0.95))'
                    : idx < 3
                    ? 'rgba(30, 41, 59, 0.9)'
                    : 'rgba(15, 23, 42, 0.75)',
                  border: isMe
                    ? '1.5px solid #fef08a'
                    : idx === 0
                    ? '1px solid rgba(250, 204, 21, 0.5)'
                    : '1px solid #1e293b'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: idx < 3 ? '16px' : '12.5px',
                      fontWeight: 900,
                      color: idx === 0 ? '#facc15' : idx === 1 ? '#e2e8f0' : idx === 2 ? '#fb923c' : '#94a3b8',
                      minWidth: '26px',
                      textAlign: 'center'
                    }}
                  >
                    {rankBadge}
                  </span>
                  <span
                    style={{
                      fontSize: '13.5px',
                      fontWeight: 800,
                      color: isMe ? '#fef08a' : '#f8fafc',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {item.name || (item as any).label || 'Học sinh'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#4ade80' }}>
                    {item.correct ?? (item as any).savedCorrect ?? 0} đúng
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 900,
                      color: '#38bdf8',
                      background: 'rgba(2, 132, 199, 0.18)',
                      padding: '2px 8px',
                      borderRadius: '8px',
                      border: '1px solid rgba(56, 189, 248, 0.35)'
                    }}
                  >
                    {item.score ?? (item as any).fastScore ?? 0}đ
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div id="student-view" style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: '#070b14', color: '#ffffff' }}>
      <style>{`
        @keyframes chibiGentleSway {
          0%, 100% { transform: rotate(-4deg) translateY(0px); }
          50% { transform: rotate(4deg) translateY(0px); }
        }
      `}</style>

      {/* Tab switch anti-cheat warning banner */}
      {tabWarning && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#ef4444', color: '#fff', padding: '10px', textAlign: 'center', fontWeight: 900, zIndex: 1000 }}>
          {tabWarning}
        </div>
      )}

      {/* Persistent Student Top Header: Clean Game Title */}
      <header
        style={{
          background: 'linear-gradient(90deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
          borderBottom: '2.5px solid #f59e0b',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          position: 'sticky',
          top: 0,
          zIndex: 900,
          boxShadow: '0 4px 14px rgba(0,0,0,0.55)'
        }}
      >
        <div style={{ fontSize: '15px', fontWeight: 900, color: '#fef08a', letterSpacing: '0.3px' }}>
          {gameTitleDisplay}
        </div>
        <div
          style={{
            background: 'rgba(2, 132, 199, 0.22)',
            border: '1.5px solid #38bdf8',
            color: '#7dd3fc',
            padding: '4px 10px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 900,
            whiteSpace: 'nowrap'
          }}
        >
          Phòng {roomId}
        </div>
      </header>

      {/* Screen 1: LOBBY — Tối ưu hóa: Chỉ hiện Tên trò chơi, ô nhập tên trống hoàn toàn, nút VÀO PHÒNG THI và Bảng Top 10 */}
      {screen === 'LOBBY' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px 14px 24px 14px' }}>
          <div
            style={{
              textAlign: 'center',
              marginBottom: '14px',
              padding: '14px 12px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
              border: '2px solid #38bdf8',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
            }}
          >
            <h1 style={{ fontSize: '21px', fontWeight: 900, color: '#fef08a', margin: '0 0 4px 0' }}>
              {gameTitleDisplay}
            </h1>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#7dd3fc' }}>
              Mã phòng thi: <b style={{ color: '#4ade80' }}>{roomId}</b>
            </div>
          </div>

          <div style={{ background: '#0f172a', border: '1.5px solid #334155', borderRadius: '18px', padding: '16px', marginBottom: '16px' }}>
            <label
              htmlFor="student-name-input"
              style={{ display: 'block', fontSize: '13.5px', fontWeight: 900, marginBottom: '8px', color: showNameAlert ? '#fca5a5' : '#e2e8f0' }}
            >
              Tên học sinh: {showNameAlert && <span style={{ color: '#ef4444' }}>* (Bắt buộc nhập tên)</span>}
            </label>
            <input
              id="student-name-input"
              type="text"
              placeholder=""
              autoComplete="off"
              value={studentName}
              onChange={e => {
                setShowNameAlert(false);
                setStudentName(e.target.value);
                studentNameRef.current = e.target.value;
                setTempInputName(e.target.value);
                tempInputNameRef.current = e.target.value;
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleReadyInRope('WAITING');
                }
              }}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: showNameAlert ? '2px solid #ef4444' : '1.5px solid #475569',
                background: showNameAlert ? '#450a0a' : '#1e293b',
                color: '#ffffff',
                fontSize: '15.5px',
                fontWeight: 800,
                boxSizing: 'border-box',
                marginBottom: '12px',
                outline: 'none'
              }}
            />

            {gameType === 'TUG' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <button
                  type="button"
                  onClick={() => setTeam('RED')}
                  style={{
                    padding: '11px',
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
                  type="button"
                  onClick={() => setTeam('BLUE')}
                  style={{
                    padding: '11px',
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
              type="button"
              onClick={() => handleReadyInRope('WAITING')}
              style={{
                width: '100%',
                padding: '15px 14px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#0f172a',
                fontWeight: 900,
                fontSize: '16.5px',
                border: '2px solid #fef08a',
                cursor: 'pointer',
                boxShadow: '0 8px 22px rgba(245, 158, 11, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span>🚪 VÀO PHÒNG THI</span>
            </button>
          </div>

          {/* Bảng Top 10 hiển thị trực tiếp */}
          {renderTop10Board()}

          {/* Bảng thông báo bắt buộc học sinh phải nhập tên mới được vào phòng */}
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
                color: '#ffffff'
              }}>
                <div style={{ fontSize: '50px', marginBottom: '8px' }}>⚠️</div>
                <h3 style={{ fontSize: '19px', fontWeight: 900, color: '#fca5a5', margin: '0 0 10px 0' }}>
                  THÔNG BÁO: BẮT BUỘC NHẬP TÊN!
                </h3>
                <p style={{ fontSize: '14px', color: '#e2e8f0', lineHeight: 1.55, margin: '0 0 18px 0' }}>
                  Học sinh <b>bắt buộc phải nhập tên</b> vào khung tên học sinh trước khi nhấn <b>Vào phòng thi</b>!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowNameAlert(false);
                    setTimeout(() => {
                      const inputEl = document.getElementById('student-name-input');
                      if (inputEl) inputEl.focus();
                    }, 80);
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
                  ĐÃ HIỂU - NHẬP TÊN NGAY
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Screen 2: PHÒNG THI ĐANG CHỜ BẮT ĐẦU (WAITING) — Tối ưu hóa chỉ hiện Tên trò chơi và Bảng Top 10 */}
      {screen === 'WAITING' && (
        <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px 14px 24px 14px' }}>
          <div
            style={{
              textAlign: 'center',
              marginBottom: '14px',
              padding: '16px 14px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
              border: '2px solid #38bdf8',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
            }}
          >
            <h1 style={{ fontSize: '21px', fontWeight: 900, color: '#fef08a', margin: '0 0 6px 0' }}>
              {gameTitleDisplay}
            </h1>
            <div style={{ fontSize: '14.5px', fontWeight: 900, color: '#4ade80', marginBottom: '4px' }}>
              ✅ Thí sinh: {studentName}
            </div>
            <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#fde047' }}>
              ⏳ Đã vào phòng thi • Đang chờ Giáo viên bấm Bắt đầu
            </div>
          </div>

          {renderTop10Board()}
        </div>
      )}

      {/* Screen 3: Quiz Gameplay */}
      {screen === 'QUIZ' && (
        <div style={{ maxWidth: '540px', margin: '0 auto', padding: '10px 12px' }}>
          {/* Header HUD gọn gàng */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '10px 12px', borderRadius: '16px', border: '1.5px solid #334155', marginBottom: '10px', gap: '8px', flexWrap: 'wrap', boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                {renderCuteChibiCharacter(
                  60,
                  gameType === 'TUG' && isFrozen
                    ? 'frozen'
                    : (hasAnsweredCurrentQ || isAnswerLocked) && lastLockedResult
                    ? lastLockedResult.isCorrect
                      ? 'cheering'
                      : 'sad'
                    : 'happy'
                )}
              </div>
              <div>
                <div style={{ fontSize: '14.5px', fontWeight: 900, color: '#fef08a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{studentName}</span>
                  {gameType === 'TUG' && (
                    <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '6px', background: team === 'RED' ? '#dc2626' : '#0284c7', color: '#fff' }}>
                      {team === 'RED' ? 'Đội Đỏ' : 'Đội Xanh'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#4ade80', fontWeight: 800, marginTop: '2px' }}>
                  ⭐ {fastScore} điểm • ✅ {myCorrectCount} câu đúng
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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

          {/* Banner Sự Kiện Đặc Biệt Toàn Sân / Câu Hỏi Vàng X2 (Nếu có) */}
          {worldEventTitle && (
            <div style={{
              background: 'linear-gradient(90deg, rgba(124, 58, 237, 0.92), rgba(219, 39, 119, 0.92))',
              border: '1.5px solid #fef08a',
              borderRadius: '12px',
              padding: '7px 12px',
              marginBottom: '8px',
              color: '#fef08a',
              fontSize: '12px',
              fontWeight: 900,
              textAlign: 'center',
              boxShadow: '0 4px 14px rgba(236, 72, 153, 0.4)'
            }}>
              {worldEventTitle}
            </div>
          )}

          {/* Khung Câu Hỏi Nổi Bật Chuẩn 3 Dạng Thức THPT 2018 */}
          <div style={{
            background: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
            border: activeWorldEvent === 'GOLDEN_X2' ? '2.5px solid #facc15' : '2px solid #38bdf8',
            borderRadius: '18px',
            padding: '16px',
            marginBottom: '12px',
            boxShadow: activeWorldEvent === 'GOLDEN_X2' ? '0 8px 25px rgba(250, 204, 21, 0.35)' : '0 8px 25px rgba(0, 0, 0, 0.45)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
                {streak >= 2 && (
                  <span style={{
                    fontSize: '11.5px',
                    background: 'linear-gradient(135deg, #f97316, #dc2626)',
                    color: '#fff',
                    padding: '3px 8px',
                    borderRadius: '8px',
                    fontWeight: 900
                  }}>
                    🔥 Chuỗi {streak} Đúng
                  </span>
                )}
              </div>
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
                padding: '20px 16px',
                borderRadius: '20px',
                background: lastLockedResult.isCorrect
                  ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)'
                  : 'linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%)',
                border: lastLockedResult.isCorrect ? '3px solid #4ade80' : '3px solid #f87171',
                textAlign: 'center',
                boxShadow: lastLockedResult.isCorrect
                  ? '0 12px 35px rgba(16, 185, 129, 0.45)'
                  : '0 12px 35px rgba(239, 68, 68, 0.45)',
                userSelect: 'none'
              }}
            >
              <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>
                {renderCuteChibiCharacter(86, lastLockedResult.isCorrect ? 'cheering' : 'sad')}
              </div>
              <div style={{
                fontSize: '18.5px',
                fontWeight: 900,
                color: lastLockedResult.isCorrect ? '#a7f3d0' : '#fecaca',
                marginBottom: '8px',
                lineHeight: 1.35
              }}>
                {lastLockedResult.text}
              </div>

              {/* 🎁 RƯƠNG BÍ ẨN ĐỊNH MỆNH (BẮT BUỘC ĐÚNG LIÊN TIẾP 5 CÂU - 4 GIÂY CHỌN 1 RƯƠNG NGẪU NHIÊN - DÙNG 1 LẦN DUY NHẤT) */}
              {mysteryChestsAvailable && !claimedChestResult && (
                <div style={{
                  margin: '14px 0',
                  padding: '16px 14px',
                  borderRadius: '18px',
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 27, 75, 0.96))',
                  border: '2.5px solid #facc15',
                  boxShadow: '0 10px 30px rgba(250, 204, 21, 0.45)',
                  animation: 'pulse 1.5s infinite'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ fontSize: '14.5px', fontWeight: 900, color: '#fef08a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🎁 MỞ RƯƠNG BÍ ẨN ĐỊNH MỆNH</span>
                      <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '999px', background: '#dc2626', color: '#fff' }}>
                        1 Lần Duy Nhất
                      </span>
                    </div>
                    <span style={{
                      fontSize: '13.5px',
                      fontWeight: 900,
                      color: chestCountdown <= 2 ? '#ef4444' : '#fde047',
                      background: 'rgba(0,0,0,0.5)',
                      padding: '3px 9px',
                      borderRadius: '8px',
                      border: '1.5px solid ' + (chestCountdown <= 2 ? '#ef4444' : '#facc15')
                    }}>
                      ⏳ Còn {chestCountdown}s
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '12px', lineHeight: 1.5 }}>
                    🔥 Chúc mừng chuỗi <b>5 câu đúng liên tiếp</b>! Bạn có <b>4 giây</b> để chọn 1 rương ngẫu nhiên:<br />
                    • 💎 <b>Nổ Hũ Kim Cương:</b> +1.500đ &nbsp;|&nbsp; • 🥷 <b>Đạo Chích:</b> +900đ &amp; hút 500đ Top 1<br />
                    • 💖 <b>Tim Vàng:</b> +1 Mạng hồi sinh &nbsp;|&nbsp; • 🛡️ <b>Khiên Bất Tử:</b> Bảo vệ câu sau sai!
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {[0, 1, 2].map(cIdx => (
                      <button
                        key={cIdx}
                        type="button"
                        onClick={() => handleOpenMysteryChest(cIdx)}
                        style={{
                          padding: '12px 6px',
                          borderRadius: '14px',
                          background: 'linear-gradient(135deg, #f59e0b, #b45309)',
                          border: '2px solid #fef08a',
                          color: '#0f172a',
                          fontWeight: 900,
                          fontSize: '13.5px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 6px 16px rgba(245, 158, 11, 0.5)'
                        }}
                      >
                        <span style={{ fontSize: '30px' }}>🎁</span>
                        <span>Rương #{cIdx + 1}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Kết quả sau khi khui Rương Bí Ẩn */}
              {claimedChestResult && (
                <div style={{
                  margin: '12px 0',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '2px solid #facc15',
                  color: '#fef08a'
                }}>
                  <div style={{ fontSize: '15px', fontWeight: 900 }}>
                    {claimedChestResult.icon} {claimedChestResult.title}
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#e2e8f0', marginTop: '3px', fontWeight: 700 }}>
                    {claimedChestResult.desc}
                  </div>
                </div>
              )}

              <div style={{
                display: 'inline-block',
                marginTop: '8px',
                padding: '10px 16px',
                borderRadius: '14px',
                background: 'rgba(15, 23, 42, 0.72)',
                border: '1.5px solid #fef08a',
                color: '#fef08a',
                fontSize: '13px',
                fontWeight: 800
              }}>
                {currentGlobalQIndex + 1 >= safeTotalDeckCount
                  ? `🏁 Đã hoàn thành câu cuối cùng (${currentGlobalQIndex + 1}/${safeTotalDeckCount}) • Đang tổng kết kết quả...`
                  : `⏳ Đã chốt đáp án câu #${currentGlobalQIndex + 1}/${safeTotalDeckCount} • Đang đợi Thầy/Cô chuyển sang câu #${currentGlobalQIndex + 2} đồng bộ cùng cả lớp...`}
              </div>
              {currentGlobalQIndex + 1 >= safeTotalDeckCount && (
                <div style={{ marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => advanceStudentQuestionOrFinish(currentGlobalQIndex)}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: '#0f172a',
                      fontWeight: 900,
                      fontSize: '14px',
                      border: '2px solid #fef08a',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.35)'
                    }}
                  >
                    🏆 XEM KẾT QUẢ CUỐI CÙNG NGAY
                  </button>
                </div>
              )}
            </div>
          ) : hostMatchStatus !== 'PLAYING' ? (
            /* KHI GIÁO VIÊN CHƯA BẮT ĐẦU: TẤT CẢ CÁC ĐÁP ÁN ĐỀU BỊ CHE VÀ KHÓA LẠI */
            <div style={{
              margin: '14px 0',
              padding: '24px 18px',
              borderRadius: '20px',
              background: 'linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)',
              border: '2.5px dashed #f59e0b',
              textAlign: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}>
              <div style={{ fontSize: '42px', marginBottom: '8px' }}>🔒</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#fef08a', marginBottom: '8px' }}>
                ĐÁP ÁN ĐANG ĐƯỢC CHE VÀ KHÓA LẠI
              </div>
              <p style={{ fontSize: '13.5px', color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 14px 0' }}>
                Thầy/Cô chưa bấm nút <b>&ldquo;🚀 BẮT ĐẦU TRẬN ĐẤU&rdquo;</b>.<br />
                Toàn bộ đáp án của tất cả thí sinh đang được che và khóa an toàn để đảm bảo công bằng tuyệt đối.
              </p>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '999px',
                background: 'rgba(245, 158, 11, 0.18)',
                border: '1.5px solid #f59e0b',
                color: '#fef08a',
                fontSize: '13px',
                fontWeight: 900
              }}>
                <span>⏳</span>
                <span>Ngay khi Thầy/Cô bấm Bắt đầu, toàn bộ đáp án sẽ tự động mở đồng loạt!</span>
              </div>
            </div>
          ) : (
            <>
              {/* 🎲 THANH ĐẶT CƯỢC BẢN LĨNH (MỖI HỌC SINH CHỈ DÙNG 1 LẦN DUY NHẤT TRONG CẢ TRẬN) */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.94)',
                border: '1.5px solid #475569',
                borderRadius: '16px',
                padding: '10px 12px',
                marginBottom: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 900, color: '#fef08a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🎲 Cược Bản Lĩnh Trước Khi Chốt</span>
                    <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '6px', background: hasUsedSpecialWager ? '#475569' : '#dc2626', color: '#fff' }}>
                      {hasUsedSpecialWager ? 'Đã dùng 1 lần duy nhất' : 'Mỗi bạn chỉ dùng 1 lần'}
                    </span>
                  </span>
                  {hasImmunityShield && (
                    <span style={{ fontSize: '11px', background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: '999px', fontWeight: 900 }}>
                      🛡️ Khiên Bất Tử Đang Bật (Bảo vệ câu này)
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {/* An Toàn (x1) */}
                  <button
                    type="button"
                    onClick={() => setWagerLevel(1)}
                    style={{
                      padding: '7px 4px',
                      borderRadius: '10px',
                      background: wagerLevel === 1 ? 'linear-gradient(135deg, #0284c7, #0369a1)' : '#1e293b',
                      color: '#ffffff',
                      border: wagerLevel === 1 ? '2px solid #7dd3fc' : '1px solid #334155',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      boxShadow: wagerLevel === 1 ? '0 3px 10px rgba(2, 132, 199, 0.5)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '11.5px', fontWeight: 900 }}>🛡️ An Toàn (x1)</span>
                    <span style={{ fontSize: '9.5px', color: '#93c5fd', fontWeight: 700 }}>Sai: 0đ (không trừ)</span>
                  </button>

                  {/* Liều Lĩnh (x1.5) */}
                  <button
                    type="button"
                    disabled={hasUsedSpecialWager}
                    onClick={() => {
                      if (!hasUsedSpecialWager) setWagerLevel(1.5);
                    }}
                    style={{
                      padding: '7px 4px',
                      borderRadius: '10px',
                      background: wagerLevel === 1.5 ? 'linear-gradient(135deg, #d97706, #b45309)' : '#1e293b',
                      color: hasUsedSpecialWager ? '#64748b' : '#ffffff',
                      border: wagerLevel === 1.5 ? '2px solid #fde047' : '1px solid #334155',
                      cursor: hasUsedSpecialWager ? 'not-allowed' : 'pointer',
                      opacity: hasUsedSpecialWager ? 0.45 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      boxShadow: wagerLevel === 1.5 ? '0 3px 10px rgba(217, 119, 6, 0.5)' : 'none'
                    }}
                    title={hasUsedSpecialWager ? 'Bạn đã dùng lượt cược bản lĩnh duy nhất của trận đấu' : 'Đúng nhân 1.5x điểm, sai trừ -300đ'}
                  >
                    <span style={{ fontSize: '11.5px', fontWeight: 900 }}>⚡ Liều Lĩnh (x1.5)</span>
                    <span style={{ fontSize: '9.5px', color: '#fcd34d', fontWeight: 700 }}>
                      {hasUsedSpecialWager ? 'Đã dùng' : 'Đúng 1.5x • Sai -300đ'}
                    </span>
                  </button>

                  {/* Tất Tay (x2.5) */}
                  <button
                    type="button"
                    disabled={hasUsedSpecialWager}
                    onClick={() => {
                      if (!hasUsedSpecialWager) setWagerLevel(2.5);
                    }}
                    style={{
                      padding: '7px 4px',
                      borderRadius: '10px',
                      background: wagerLevel === 2.5 ? 'linear-gradient(135deg, #e11d48, #9f1239)' : '#1e293b',
                      color: hasUsedSpecialWager ? '#64748b' : '#ffffff',
                      border: wagerLevel === 2.5 ? '2px solid #fda4af' : '1px solid #334155',
                      cursor: hasUsedSpecialWager ? 'not-allowed' : 'pointer',
                      opacity: hasUsedSpecialWager ? 0.45 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      boxShadow: wagerLevel === 2.5 ? '0 3px 10px rgba(225, 29, 72, 0.5)' : 'none'
                    }}
                    title={hasUsedSpecialWager ? 'Bạn đã dùng lượt cược bản lĩnh duy nhất của trận đấu' : 'Đúng nhân 2.5x điểm, sai trừ -800đ (dành cho bạn tự tin 100% để lật kèo)'}
                  >
                    <span style={{ fontSize: '11.5px', fontWeight: 900 }}>🔥 Tất Tay (x2.5)</span>
                    <span style={{ fontSize: '9.5px', color: '#fca5a5', fontWeight: 700 }}>
                      {hasUsedSpecialWager ? 'Đã dùng' : 'Đúng 2.5x • Sai -800đ'}
                    </span>
                  </button>
                </div>
              </div>

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
                    const isDisabled = hasAnsweredCurrentQ || isAnswerLocked || isSyncingState || (gameType === 'TUG' && isFrozen);

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
                    const isDisabled = hasAnsweredCurrentQ || isAnswerLocked || isSyncingState || (gameType === 'TUG' && isFrozen);
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
                          <b style={{ color: '#38bdf8' }}>{item.label})</b> <MathRenderer text={cleanTFStatementText(item.text)} />
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
                    disabled={hasAnsweredCurrentQ || isAnswerLocked || isSyncingState || (gameType === 'TUG' && isFrozen)}
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
                    disabled={hasAnsweredCurrentQ || isAnswerLocked || isSyncingState || (gameType === 'TUG' && isFrozen)}
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
                    disabled={hasAnsweredCurrentQ || isAnswerLocked || isSyncingState || (gameType === 'TUG' && isFrozen) || !shortAnswerInput.trim()}
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

      {/* Screen 5: ENDED -> Màn hình Tổng Kết Kết Quả Cuối Cùng (Ngừng hoàn toàn khi hết câu hỏi, tuyệt đối không chạy lại câu 1) */}
      {screen === 'ENDED' && (
        <div style={{ maxWidth: '500px', margin: '24px auto', padding: '22px 18px', textAlign: 'center' }}>
          <div
            style={{
              background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 100%)',
              border: '3px solid #f59e0b',
              borderRadius: '24px',
              padding: '24px 18px',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)'
            }}
          >
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
              {renderCuteChibiCharacter(108, 'cheering')}
            </div>

            <div
              style={{
                display: 'inline-block',
                padding: '5px 14px',
                borderRadius: '999px',
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1.5px solid #34d399',
                color: '#6ee7b7',
                fontSize: '12.5px',
                fontWeight: 900,
                marginBottom: '10px'
              }}
            >
              🏁 ĐÃ HOÀN THÀNH TOÀN BỘ {safeTotalDeckCount} CÂU HỎI
            </div>

            <h2 style={{ fontSize: '23px', color: '#fef08a', fontWeight: 900, margin: '0 0 6px 0' }}>
              🏆 KẾT QUẢ CUỐI CÙNG CỦA BẠN
            </h2>
            <p style={{ fontSize: '14.5px', color: '#e2e8f0', fontWeight: 800, margin: '0 0 18px 0' }}>
              Học sinh: <b style={{ color: '#38bdf8' }}>{studentName || 'Học sinh'}</b> • Phòng <b style={{ color: '#4ade80' }}>{roomId}</b>
            </p>

            {/* Bảng thông số kết quả */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                marginBottom: '18px'
              }}
            >
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '2px solid #38bdf8',
                  borderRadius: '16px',
                  padding: '12px 8px'
                }}
              >
                <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 800 }}>TỔNG ĐIỂM</div>
                <div style={{ fontSize: '21px', color: '#38bdf8', fontWeight: 900, marginTop: '4px' }}>
                  {fastScore}đ
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '2px solid #4ade80',
                  borderRadius: '16px',
                  padding: '12px 8px'
                }}
              >
                <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 800 }}>SỐ CÂU ĐÚNG</div>
                <div style={{ fontSize: '21px', color: '#4ade80', fontWeight: 900, marginTop: '4px' }}>
                  {myCorrectCount}/{safeTotalDeckCount}
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '2px solid #f59e0b',
                  borderRadius: '16px',
                  padding: '12px 8px'
                }}
              >
                <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 800 }}>ĐIỂM HỆ 10</div>
                <div style={{ fontSize: '21px', color: '#fef08a', fontWeight: 900, marginTop: '4px' }}>
                  {getTeacherGradebookScore(myCorrectCount, safeTotalDeckCount).grade}đ
                </div>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(6, 95, 70, 0.35)',
                border: '1.5px solid #10b981',
                borderRadius: '14px',
                padding: '12px 14px',
                color: '#d1fae5',
                fontSize: '13.5px',
                fontWeight: 800,
                lineHeight: 1.5,
                marginBottom: '18px'
              }}
            >
              ✅ Kết quả của em đã được gửi và lưu trực tiếp lên Bảng Vàng & Sổ Điểm của Giáo viên!<br />
              Em hãy giữ màn hình này để đối chiếu hoặc chờ Giáo viên phát động vòng thi mới.
            </div>

            <div style={{ textAlign: 'left', marginTop: '10px' }}>
              {renderTop10Board()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
