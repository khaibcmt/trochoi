import React, { useState, useEffect, useRef } from 'react';
import {
  MatchState,
  GamePlayType,
  JoinMode,
  SubjectData,
  QuizItem,
  Player,
  CloudMessage,
  MatchStatus,
  MatchSettings
} from './types';
import {
  getInitialSubjects,
  getPresetQuizBySubject,
  parseHTMLToQuiz,
  shuffleQuestionOrder,
  calculateFastestPoints,
  getConvertedGradeByRank,
  cleanQuestionTitleText
} from './data/defaultSubjects';
import { AudioFX } from './services/audio';
import { CloudNetwork } from './services/network';
import { getOrCreateRoomKey } from './utils/commandSign';
import {
  answerKeyFor,
  buildResyncStateMessage,
  findPlayerByIdentity,
  isHostReceptionOutage,
  mergePlayerRecord,
  presenceTimingForRoomSize,
  sweepPlayerPresence
} from './utils/presence';
import { questionDurationFor } from './utils/questionTiming';
import { TopAuthorBanner } from './components/TopAuthorBanner';
import { TeacherSetupView } from './components/TeacherSetupView';
import { HostArenaView } from './components/HostArenaView';
import { StudentMobileView } from './components/StudentMobileView';
import { GeminiKeyModal } from './components/GeminiKeyModal';
import { NationalJuryDossierModal } from './components/NationalJuryDossierModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { BuyMeCoffeeModal } from './components/BuyMeCoffeeModal';
import { CloudBackupData } from './types';
import { getStoredSyncProfile, saveBackupToCloud, prepareBackupPayload } from './services/cloudSync';
import { exportColorfulPresentationHTML, printEvidenceColorfulPDF } from './utils/exportEvidence';

export const App: React.FC = () => {
  // Query & Hash parameters check (Hỗ trợ cả ?r=12345 và #r=12345 khi quét QR hoặc mở qua Zalo/iFrame)
  const [urlParams] = useState(() => {
    const combined = new URLSearchParams(window.location.search);
    const hashStr = window.location.hash || '';
    if (hashStr.length > 1) {
      const qIdx = hashStr.indexOf('?');
      const hashQuery = qIdx !== -1 ? hashStr.substring(qIdx + 1) : hashStr.replace(/^#\/?/, '');
      const hashSearchParams = new URLSearchParams(hashQuery);
      hashSearchParams.forEach((val, key) => {
        if (!combined.has(key)) {
          combined.set(key, val);
        }
      });
    }
    return combined;
  });

  const isDirectStudent =
    urlParams.get('role') === 'player' ||
    urlParams.has('r') ||
    urlParams.has('room') ||
    /[?#&](?:r|room)=\d+/i.test(window.location.href);

  // Phân biệt chính xác giữa 2 tình huống:
  // 1. Thoát trình duyệt mở phiên mới: sessionStorage hoàn toàn trống -> Tự động sinh phòng 5 số mới toanh.
  // 2. Đang chơi lỡ bấm F5 hoặc làm mới nền: sessionStorage vẫn bảo lưu 'kc3d_host_session_active' -> Giữ nguyên phòng & 100% học sinh.
  const isHostReloadSession = (() => {
    try {
      return !isDirectStudent && sessionStorage.getItem('kc3d_host_session_active') === '1';
    } catch {
      return false;
    }
  })();

  const [view, setView] = useState<'TEACHER_SETUP' | 'HOST_ARENA' | 'STUDENT_MOBILE'>(() => {
    if (isDirectStudent) {
      try {
        sessionStorage.setItem('kc3d_active_view_mode', 'STUDENT_MOBILE');
      } catch {}
      return 'STUDENT_MOBILE';
    }
    // Nếu là F5 hoặc làm mới trong phiên đang mở, bảo lưu đúng màn hình đang đứng (Setup hoặc 3D Arena)
    if (isHostReloadSession) {
      try {
        const savedView = sessionStorage.getItem('kc3d_host_view');
        if (savedView === 'HOST_ARENA' || savedView === 'TEACHER_SETUP') {
          return savedView;
        }
      } catch {}
    }
    try {
      sessionStorage.removeItem('kc3d_active_view_mode');
    } catch {}
    return 'TEACHER_SETUP';
  });

  // Đảm bảo ẩn hoàn toàn modal xác thực Giáo viên nếu đang ở chế độ Học sinh (STUDENT_MOBILE)
  useEffect(() => {
    const authOverlay = document.getElementById('dautruong-auth-overlay');
    if (view === 'STUDENT_MOBILE') {
      if (isDirectStudent) {
        try {
          sessionStorage.setItem('kc3d_active_view_mode', 'STUDENT_MOBILE');
        } catch {}
      }
      if (authOverlay) {
        authOverlay.classList.remove('active');
        authOverlay.style.display = 'none';
      }
    } else {
      try {
        sessionStorage.removeItem('kc3d_active_view_mode');
      } catch {}
    }
  }, [view, isDirectStudent]);

  // Initial student params from URL
  const studentRoomParam = urlParams.get('r') || urlParams.get('room') || '12345';
  const studentTeamParam = (urlParams.get('t') === 'B' || urlParams.get('team') === 'BLUE') ? 'BLUE' : 'RED';
  const studentGmParam: GamePlayType = (urlParams.get('gm') === 'TUG')
    ? 'TUG'
    : (urlParams.get('gm') === 'B' || urlParams.get('gm') === 'BELL')
    ? 'BELL'
    : (urlParams.get('gm') === 'BOSS')
    ? 'BOSS'
    : 'FAST';
  const studentSubjParam = urlParams.get('subj') || 'ALL_SUBJ';

  // Teacher & Host state
  const [subjectsDB, setSubjectsDB] = useState<Record<string, SubjectData>>(() => getInitialSubjects());
  const [currentSubjectKey, setCurrentSubjectKey] = useState<string>('BIO');
  const [gameType, setGameType] = useState<GamePlayType>(() => {
    if (urlParams.get('gm')) return studentGmParam;
    return 'FAST';
  });
  const [joinMode, setJoinMode] = useState<JoinMode>('AUTO_ALL');
  const [maxPerTeam, setMaxPerTeam] = useState<number>(5);
  const [activeRoomId, setActiveRoomId] = useState<string>(() => {
    try {
      const sessionRoom = sessionStorage.getItem('kc3d_host_room_id');

      // Tình huống 1: F5 / Làm mới nền trong phiên đang hoạt động -> Giữ nguyên mã phòng hiện tại
      if (isHostReloadSession && sessionRoom && /^\d{5}$/.test(sessionRoom)) {
        return sessionRoom;
      }

      // Tình huống 2: Thoát trình duyệt mở phiên mới -> Tự động sinh mã phòng 5 số mới toanh
      const freshRoomId = String(Math.floor(10000 + Math.random() * 90000));
      sessionStorage.setItem('kc3d_host_session_active', '1');
      sessionStorage.setItem('kc3d_host_room_id', freshRoomId);
      localStorage.setItem('kc3d_host_room_id', freshRoomId);
      // Xóa bỏ triệt để cache của phòng mới này nếu có dấu vết cũ
      sessionStorage.removeItem('kc3d_host_saved_state_' + freshRoomId);
      localStorage.removeItem('kc3d_host_saved_state_' + freshRoomId);
      return freshRoomId;
    } catch {
      return String(Math.floor(10000 + Math.random() * 90000));
    }
  });
  const [quizList, setQuizList] = useState<QuizItem[]>(() => {
    const initDB = getInitialSubjects();
    const parsed = initDB['BIO'] ? parseHTMLToQuiz(initDB['BIO'].html) : [];
    return parsed.length > 0 ? parsed : getPresetQuizBySubject('BIO');
  });

  // 4 Core Match Settings
  const [matchSettings, setMatchSettings] = useState<MatchSettings>({
    roomCapacity: 200,
    max3DRenderCount: 10,
    questionDurationSec: 30,
    questionDurationTfSec: 60,
    questionDurationSaSec: 60,
    bossMaxHP: 1000
  });

  // Google Gemini API Key Modal & National Contest Dossier Modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showNationalDossier, setShowNationalDossier] = useState(false);

  // Cloud Sync & Backup Modal
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);
  const [cloudSyncInitialTab, setCloudSyncInitialTab] = useState<'GOOGLE' | 'PASSWORD'>('GOOGLE');

  // Mời Tác Giả Ly Cà Phê (VietQR) Modal
  const [showCoffeeModal, setShowCoffeeModal] = useState(false);

  const handleOpenCloudSync = (tab: 'GOOGLE' | 'PASSWORD' = 'GOOGLE') => {
    setCloudSyncInitialTab(tab);
    setShowCloudSyncModal(true);
  };

  const triggerAutoCloudSync = (newDB: Record<string, SubjectData>, currentKey: string, activeQuiz?: QuizItem[]) => {
    try {
      const prof = getStoredSyncProfile();
      if (prof.autoSyncEnabled && (prof.googleEmail || prof.passwordKey)) {
        const payload = prepareBackupPayload(newDB, currentKey, matchSettings, activeQuiz);
        saveBackupToCloud(prof, payload).catch(() => {});
      }
    } catch {}
  };

  const handleApplyBackup = (backup: CloudBackupData) => {
    if (backup.subjectsDB && Object.keys(backup.subjectsDB).length > 0) {
      setSubjectsDB(backup.subjectsDB);
      try {
        localStorage.setItem('thpt_mangthit_subjects_v10', JSON.stringify(backup.subjectsDB));
      } catch (e) {}
    }
    if (backup.currentSubjectKey && backup.subjectsDB && backup.subjectsDB[backup.currentSubjectKey]) {
      setCurrentSubjectKey(backup.currentSubjectKey);
      currentSubjectKeyRef.current = backup.currentSubjectKey;
    }
    if (backup.matchSettings) {
      setMatchSettings(backup.matchSettings);
    }
    if (backup.activeQuizList && backup.activeQuizList.length > 0) {
      const normalized = backup.activeQuizList.map((q, idx) => ({ ...q, qid: idx, rightCount: 0, wrongCount: 0 }));
      setQuizList(normalized);
      quizListRef.current = normalized;
      try {
        localStorage.setItem('custom_Active_Quiz_V31', JSON.stringify(normalized));
      } catch {}
      setTimeout(() => {
        broadcastHeartbeatRef.current(matchStateRef.current, normalized, activeRoomId);
      }, 50);
    } else if (backup.currentSubjectKey && backup.subjectsDB && backup.subjectsDB[backup.currentSubjectKey]) {
      const parsed = parseHTMLToQuiz(backup.subjectsDB[backup.currentSubjectKey].html);
      if (parsed.length > 0) {
        const normalized = parsed.map((q, idx) => ({ ...q, qid: idx, rightCount: 0, wrongCount: 0 }));
        setQuizList(normalized);
        quizListRef.current = normalized;
        setTimeout(() => {
          broadcastHeartbeatRef.current(matchStateRef.current, normalized, activeRoomId);
        }, 50);
      }
    }
  };

  // Bộ chống trùng đáp án phía host — khai báo TRƯỚC matchState để initializer khôi phục
  // được answeredQKeys từ snapshot kc3d_host_saved_state_<room> khi F5.
  const answeredQKeysRef = useRef<Set<string>>(new Set());
  // Đợt 5 (4B.3): chi tiết lựa chọn của từng đáp án đã ghi (khoá như answeredQKeys) để
  // host trả đúng lựa chọn trong RESYNC_STATE; khôi phục cùng snapshot với answeredQKeys.
  const answeredDetailsRef = useRef<Map<string, { isCorrect: boolean; selectedOptionOriginalIdx?: number | null; tfAnswers?: Record<string, boolean>; shortAnswerInput?: string }>>(new Map());
  // Đợt 5 (4B.2): lastSeen theo đồng hồ HOST cho từng bản ghi — PLAYER_PING chỉ cập nhật
  // ref này (không ghi state mỗi 5s để tránh re-render liên tục với 50+ HS); vòng quét
  // giữ chỗ 5s đọc ref này để bật/tắt cờ offline và giải phóng chỗ sau 5 phút.
  const lastSeenByIdRef = useRef<Map<string, number>>(new Map());
  // Van an toàn mất-thu phía host: mốc nhận tin gần nhất (bất kỳ loại tin nào) +
  // trạng thái đang mất thu — vòng quét giữ chỗ dùng để không giải phóng oan cả lớp
  // khi chính host đang điếc (wifi thầy chập chờn / broker hiccup).
  const lastHostRxAtRef = useRef<number>(Date.now());
  const rxOutageRef = useRef<boolean>(false);
  const rxOutageSinceRef = useRef<number>(0);
  // Đợt 5 (4B.2): khoá định danh (studentId/playerId) đã bị giải phóng chỗ ở ván hiện
  // tại (chế độ không phải BELL — bản ghi đã bị dọn): còn đang PLAYING thì chưa cho
  // vào lại, trận về LOBBY (ván sau) mới vào lại bình thường.
  const releasedHoldKeysRef = useRef<Set<string>>(new Set());
  // Đợt GIA CỐ TẢI: định danh KHÁN GIẢ (vai SPECTATOR — giáo viên dự giờ / HS vào
  // khi 2 đội đã đầy ở chế độ LIMITED_VS) đã được ĐẾM vào matchState.spectators.
  // Khán giả KHÔNG có bản ghi người chơi (không chiếm chỗ, không bị quét giữ chỗ);
  // client khán giả vẫn gửi lại tin vào phòng theo vòng đồng bộ nên host phải đếm
  // MỘT LẦN cho mỗi định danh, tránh số khán giả phình vô hạn sau mỗi ~20s.
  const spectatorKeysRef = useRef<Set<string>>(new Set());

  const [matchState, setMatchState] = useState<MatchState>(() => {
    const defaultState: MatchState = {
      gameType: 'FAST',
      status: 'LOBBY',
      currentRound: 1,
      redRoundWins: 0,
      blueRoundWins: 0,
      ropeScore: 0,
      redTotalCorrect: 0,
      blueTotalCorrect: 0,
      globalQIndex: 0,
      redAnsweredIds: [],
      blueAnsweredIds: [],
      redPlayers: [],
      bluePlayers: [],
      spectators: 0,
      bossHP: 1000,
      maxBossHP: 1000,
      settings: {
        roomCapacity: 200,
        max3DRenderCount: 10,
        questionDurationSec: 30,
        questionDurationTfSec: 60,
        questionDurationSaSec: 60,
        bossMaxHP: 1000
      }
    };

    // Nếu lỡ bấm F5 hoặc làm mới nền trong phiên đang chơi: Khôi phục 100% học sinh và điểm số
    if (isHostReloadSession) {
      try {
        const sessionRoom = sessionStorage.getItem('kc3d_host_room_id');
        if (sessionRoom) {
          const savedStr = sessionStorage.getItem('kc3d_host_saved_state_' + sessionRoom) ||
                           localStorage.getItem('kc3d_host_saved_state_' + sessionRoom);
          if (savedStr) {
            const parsed = JSON.parse(savedStr);
            // Tách answeredQKeys khỏi dữ liệu trận: khôi phục vào ref chống trùng đáp án,
            // không để lọt vào matchState.
            const { answeredQKeys: savedAnsweredQKeys, answeredDetails: savedAnsweredDetails, ...parsedState } = parsed;
            if (Array.isArray(savedAnsweredQKeys)) {
              answeredQKeysRef.current = new Set(
                savedAnsweredQKeys.filter((k: any) => typeof k === 'string')
              );
            }
            // Đợt 5 (4B.3): khôi phục chi tiết đáp án đã lưu kèm snapshot (cho RESYNC_STATE).
            if (Array.isArray(savedAnsweredDetails)) {
              savedAnsweredDetails.forEach((entry: any) => {
                if (Array.isArray(entry) && typeof entry[0] === 'string' && entry[1] && typeof entry[1] === 'object') {
                  answeredDetailsRef.current.set(entry[0], entry[1]);
                }
              });
            }
            // Đợt 5 (4B.2): host vừa F5/tải lại — ÂN HẠN lastSeen cho mọi HS khôi phục
            // từ snapshot bằng mốc hiện tại; ping 5s của HS sẽ làm tươi lại ngay, tránh
            // việc vòng quét đầu tiên giải phóng oan cả lớp vì mốc cũ trong snapshot.
            const graceNow = Date.now();
            [...(parsedState.redPlayers || []), ...(parsedState.bluePlayers || [])].forEach((p: any) => {
              if (p && p.id) lastSeenByIdRef.current.set(p.id, graceNow);
            });
            return {
              ...defaultState,
              ...parsedState,
              redPlayers: Array.isArray(parsedState.redPlayers) ? parsedState.redPlayers : [],
              bluePlayers: Array.isArray(parsedState.bluePlayers) ? parsedState.bluePlayers : [],
              status: parsedState.status || 'LOBBY',
              gameType: parsedState.gameType || 'FAST',
              globalQIndex: typeof parsedState.globalQIndex === 'number' ? parsedState.globalQIndex : 0,
              ropeScore: typeof parsedState.ropeScore === 'number' ? parsedState.ropeScore : 0,
              redTotalCorrect: typeof parsedState.redTotalCorrect === 'number' ? parsedState.redTotalCorrect : 0,
              blueTotalCorrect: typeof parsedState.blueTotalCorrect === 'number' ? parsedState.blueTotalCorrect : 0,
              redRoundWins: typeof parsedState.redRoundWins === 'number' ? parsedState.redRoundWins : 0,
              blueRoundWins: typeof parsedState.blueRoundWins === 'number' ? parsedState.blueRoundWins : 0,
              bossHP: typeof parsedState.bossHP === 'number' ? parsedState.bossHP : 1000,
              maxBossHP: typeof parsedState.maxBossHP === 'number' ? parsedState.maxBossHP : 1000
            };
          }
        }
      } catch {}
    }

    return defaultState;
  });

  const heartbeatRef = useRef<any>(null);

  // Save subjects database changes to localStorage & sync to cloud
  const saveSubjects = (newDB: Record<string, SubjectData>) => {
    setSubjectsDB(newDB);
    try {
      localStorage.setItem('thpt_mangthit_subjects_v10', JSON.stringify(newDB));
    } catch (e) {}
    triggerAutoCloudSync(newDB, currentSubjectKeyRef.current, quizListRef.current);
  };

  const handleSelectSubject = (key: string) => {
    if (subjectsDB[key]) {
      setCurrentSubjectKey(key);
      currentSubjectKeyRef.current = key;
      const parsed = parseHTMLToQuiz(subjectsDB[key].html);
      if (parsed.length > 0) {
        const normalized = parsed.map((q, idx) => ({ ...q, qid: idx, rightCount: 0, wrongCount: 0 }));
        setQuizList(normalized);
        quizListRef.current = normalized;
        setTimeout(() => {
          broadcastHeartbeatRef.current(matchStateRef.current, normalized, activeRoomId);
        }, 20);
      }
    }
  };

  const handleSyncQuizLive = (parsedQuiz: QuizItem[]) => {
    if (!parsedQuiz || parsedQuiz.length === 0) return;
    const normalized = parsedQuiz.map((q, idx) => ({ ...q, qid: idx, rightCount: 0, wrongCount: 0 }));
    setQuizList(normalized);
    quizListRef.current = normalized;
    const safeIdx = Math.min(Math.max(0, matchStateRef.current.globalQIndex), Math.max(0, normalized.length - 1));
    const curQ = normalized[safeIdx] ? { ...normalized[safeIdx], qIndex: safeIdx, totalQuestions: normalized.length } : undefined;
    CloudNetwork.sendMessage({
      type: 'QUIZ_SYNC',
      qIndex: safeIdx,
      question: curQ,
      quiz: normalized
    });
  };

  const firstBloodByQRef = useRef<Set<number>>(new Set());
  const lastEnterAckMapRef = useRef<Record<string, number>>({});
  // Đợt 5 (4B.3): mốc host bắt đầu câu hiện tại (để RESYNC_STATE trả serverStartTime +
  // durationSec cho HS dựng lại deadline theo cơ chế Đợt 1) + chống spam RESYNC_STATE.
  const questionTimingRef = useRef<{ qIndex: number; serverStartTime?: number; durationSec?: number }>({ qIndex: -1 });
  const questionTimingKeyRef = useRef<string>('');
  const lastResyncAtRef = useRef<Record<string, number>>({});

  const handleSelectGameType = (newGameType: GamePlayType) => {
    answeredQKeysRef.current.clear();
    answeredDetailsRef.current.clear();
    releasedHoldKeysRef.current.clear();
    spectatorKeysRef.current.clear();
    firstBloodByQRef.current.clear();
    setGameType(newGameType);
    setMatchState(prev => {
      const resetPlayer = (p: Player): Player => ({
        ...p,
        ready: true,
        correct: 0,
        freeze: 0,
        lives: 3,
        wrongTotal: 0,
        streak: 0,
        eliminated: false,
        fastScore: 0,
        lastDelta: 0,
        lastTimeSec: null
      });
      const nextMS: MatchState = {
        ...prev,
        gameType: newGameType,
        status: 'LOBBY',
        currentRound: 1,
        redRoundWins: 0,
        blueRoundWins: 0,
        ropeScore: 0,
        redTotalCorrect: 0,
        blueTotalCorrect: 0,
        globalQIndex: 0,
        redAnsweredIds: [],
        blueAnsweredIds: [],
        redPlayers: prev.redPlayers.map(resetPlayer),
        bluePlayers: prev.bluePlayers.map(resetPlayer),
        bossHP: matchSettings.bossMaxHP || 1000,
        maxBossHP: matchSettings.bossMaxHP || 1000,
        // Đổi trò chơi = trận mới: xoá dấu tạm dừng / mốc đoạn của trận trước.
        questionPause: null,
        currentTiming: null
      };
      matchStateRef.current = nextMS;
      setTimeout(() => {
        const activeDeck = quizListRef.current;
        const firstQ = activeDeck[0] ? { ...activeDeck[0], qIndex: 0, totalQuestions: activeDeck.length } : undefined;
        CloudNetwork.sendMessage({
          type: 'GAME_SWITCHED',
          gameType: newGameType,
          status: 'LOBBY',
          globalQIndex: 0,
          lives: 3,
          eliminated: false,
          bossHP: nextMS.bossHP,
          maxBossHP: nextMS.maxBossHP,
          subj: currentSubjectKeyRef.current,
          quiz: activeDeck,
          question: firstQ
        });
        broadcastHeartbeatRef.current(nextMS, activeDeck, activeRoomId);
      }, 20);
      return nextMS;
    });
  };

  const handleAddSubject = () => {
    const name = prompt("Nhập tên Môn học hoặc Bài dạy mới (VD: Chuyên đề Sinh 11, Ôn tập Học kỳ...):");
    if (!name || !name.trim()) return;
    const newKey = 'SUBJ_' + Date.now();
    const colors = ['#0284c7', '#8b5cf6', '#ec4899', '#14b8a6', '#e11d48'];
    const color = colors[Object.keys(subjectsDB).length % colors.length];
    const newSubj: SubjectData = {
      name: '📘 ' + name.trim(),
      html: `<div>Câu 1: Nhập câu hỏi thứ nhất của bài ${name.trim()}?</div><div><u>A</u>. Phương án đúng thứ nhất</div><div>B. Phương án thứ hai</div><div>C. Phương án thứ ba</div><div>D. Phương án thứ tư</div>`,
      color,
      fixed: false
    };
    const nextDB = { ...subjectsDB, [newKey]: newSubj };
    saveSubjects(nextDB);
    setCurrentSubjectKey(newKey);
    currentSubjectKeyRef.current = newKey;
    const parsed = parseHTMLToQuiz(newSubj.html);
    if (parsed.length > 0) {
      setQuizList(parsed);
      quizListRef.current = parsed;
    }
  };

  const handleSaveCurrentQuizToSubject = (parsedQuiz: QuizItem[], html: string, silent?: boolean) => {
    const current = subjectsDB[currentSubjectKey];
    if (!current) return;
    const normalized = parsedQuiz.map((q, idx) => ({ ...q, qid: idx, rightCount: 0, wrongCount: 0 }));
    setQuizList(normalized);
    quizListRef.current = normalized;
    const baseName = current.name.replace(/\s*\(\d+\s*câu\)/i, '');
    const updatedSubj: SubjectData = {
      ...current,
      html,
      name: `${baseName} (${parsedQuiz.length} câu)`
    };
    const nextDB = { ...subjectsDB, [currentSubjectKey]: updatedSubj };
    saveSubjects(nextDB);
    const safeIdx = Math.min(Math.max(0, matchStateRef.current.globalQIndex), Math.max(0, normalized.length - 1));
    const curQ = normalized[safeIdx] ? { ...normalized[safeIdx], qIndex: safeIdx, totalQuestions: normalized.length } : undefined;
    CloudNetwork.sendMessage({
      type: 'QUIZ_SYNC',
      qIndex: safeIdx,
      question: curQ,
      quiz: normalized
    });
    setTimeout(() => {
      broadcastHeartbeatRef.current(matchStateRef.current, normalized, activeRoomId);
    }, 20);
    if (!silent) {
      alert(`✅ Đã lưu và đồng bộ thành công ${parsedQuiz.length} câu hỏi vào môn "${updatedSubj.name}"!`);
    }
  };

  const handleDeleteCurrentSubject = () => {
    if (subjectsDB[currentSubjectKey]?.fixed) return;
    if (!confirm(`Bạn có chắc muốn xóa môn "${subjectsDB[currentSubjectKey]?.name}" không?`)) return;
    const nextDB = { ...subjectsDB };
    delete nextDB[currentSubjectKey];
    saveSubjects(nextDB);
    setCurrentSubjectKey('BIO');
    currentSubjectKeyRef.current = 'BIO';
  };

  // 1. Tạo Phiên Mới / Đổi sang Lớp Khác: Cấp Mã Phòng 5 số mới toanh và xóa sạch 100% học sinh cũ
  const handleCreateNewSession = (customRoomId?: string) => {
    const oldRoom = activeRoomId;
    const newRoom = customRoomId && /^\d{5}$/.test(customRoomId)
      ? customRoomId
      : String(Math.floor(10000 + Math.random() * 90000));

    // Gửi tín hiệu CLEAR_ALL_STUDENTS vào phòng cũ để học sinh lớp cũ bị đăng xuất ngay
    CloudNetwork.sendMessage({
      type: 'CLEAR_ALL_STUDENTS',
      roomId: oldRoom
    });
    CloudNetwork.resetRoomSession(oldRoom);
    CloudNetwork.clearRoomCache(oldRoom);

    // Lưu mã phòng mới và xóa sạch snapshot cũ của cả 2 phòng
    try {
      localStorage.setItem('kc3d_host_room_id', newRoom);
      sessionStorage.setItem('kc3d_host_room_id', newRoom);
      sessionStorage.setItem('kc3d_host_session_active', '1');
      sessionStorage.removeItem('kc3d_host_saved_state_' + oldRoom);
      sessionStorage.removeItem('kc3d_host_saved_state_' + newRoom);
      localStorage.removeItem('kc3d_host_saved_state_' + oldRoom);
      localStorage.removeItem('kc3d_host_saved_state_' + newRoom);
    } catch {}

    answeredQKeysRef.current.clear();
    answeredDetailsRef.current.clear();
    releasedHoldKeysRef.current.clear();
    firstBloodByQRef.current.clear();
    lastEnterAckMapRef.current = {};
    releasedHoldKeysRef.current.clear();
    lastSeenByIdRef.current.clear();

    setMatchState(prev => ({
      ...prev,
      status: 'LOBBY',
      currentRound: 1,
      redRoundWins: 0,
      blueRoundWins: 0,
      ropeScore: 0,
      redTotalCorrect: 0,
      blueTotalCorrect: 0,
      globalQIndex: 0,
      redAnsweredIds: [],
      blueAnsweredIds: [],
      redPlayers: [],
      bluePlayers: [],
      spectators: 0,
      liveFeed: [],
      firstBloodPlayerId: null,
      firstBloodPlayerName: null,
      bossHP: matchSettings.bossMaxHP || 1000,
      maxBossHP: matchSettings.bossMaxHP || 1000
    }));

    setActiveRoomId(newRoom);
    CloudNetwork.resetRoomSession(newRoom);
    CloudNetwork.clearRoomCache(newRoom);
    AudioFX.bonusLifeChime();
    alert(`🎉 ĐÃ TẠO PHIÊN MỚI THÀNH CÔNG!\n\n• Mã phòng mới: ${newRoom}\n• Đã xóa sạch toàn bộ danh sách học sinh cũ.\n• Mã QR và liên kết phòng mới đã sẵn sàng cho lớp học mới tham gia!`);
  };

  // 2. Làm Mới Lớp Hiện Tại: Giữ nguyên mã phòng nhưng xóa sạch toàn bộ học sinh cũ
  const handleResetCurrentClass = () => {
    CloudNetwork.sendMessage({
      type: 'CLEAR_ALL_STUDENTS',
      roomId: activeRoomId
    });
    CloudNetwork.resetRoomSession(activeRoomId);
    CloudNetwork.clearRoomCache(activeRoomId);

    try {
      sessionStorage.removeItem('kc3d_host_saved_state_' + activeRoomId);
      localStorage.removeItem('kc3d_host_saved_state_' + activeRoomId);
    } catch {}

    answeredQKeysRef.current.clear();
    answeredDetailsRef.current.clear();
    releasedHoldKeysRef.current.clear();
    firstBloodByQRef.current.clear();
    lastEnterAckMapRef.current = {};
    releasedHoldKeysRef.current.clear();
    lastSeenByIdRef.current.clear();

    setMatchState(prev => ({
      ...prev,
      status: 'LOBBY',
      currentRound: 1,
      redRoundWins: 0,
      blueRoundWins: 0,
      ropeScore: 0,
      redTotalCorrect: 0,
      blueTotalCorrect: 0,
      globalQIndex: 0,
      redAnsweredIds: [],
      blueAnsweredIds: [],
      redPlayers: [],
      bluePlayers: [],
      spectators: 0,
      liveFeed: [],
      firstBloodPlayerId: null,
      firstBloodPlayerName: null,
      bossHP: matchSettings.bossMaxHP || 1000,
      maxBossHP: matchSettings.bossMaxHP || 1000
    }));

    AudioFX.bonusLifeChime();
    alert(`🧹 ĐÃ LÀM MỚI PHÒNG ${activeRoomId} THÀNH CÔNG!\n\n• Toàn bộ học sinh cũ đã được xóa sạch.\n• Sẵn sàng để học sinh lớp mới điểm danh vào phòng.`);
  };

  // Launch Arena (Chuẩn bị vào sàn đấu - Giữ nguyên mã phòng, giữ nguyên học sinh đã vào và đồng bộ đúng thứ tự câu hỏi của giáo viên: Phần I ➔ Phần II ➔ Phần III)
  const handleLaunchArena = (parsedQuiz: QuizItem[]) => {
    answeredQKeysRef.current.clear();
    answeredDetailsRef.current.clear();
    releasedHoldKeysRef.current.clear();
    firstBloodByQRef.current.clear();
    const orderedAndShuffled = shuffleQuestionOrder(parsedQuiz);
    const normalizedDeck: QuizItem[] = orderedAndShuffled.map((item, idx) => ({
      ...item,
      qid: idx,
      rightCount: 0,
      wrongCount: 0
    }));
    setQuizList(normalizedDeck);
    quizListRef.current = normalizedDeck;

    setMatchState(prev => {
      const resetPlayerForNewGame = (p: Player): Player => ({
        ...p,
        ready: true,
        correct: 0,
        freeze: 0,
        lives: 3,
        wrongTotal: 0,
        streak: 0,
        eliminated: false,
        fastScore: 0,
        lastDelta: 0,
        lastTimeSec: null
      });
      const nextMS: MatchState = {
        ...prev,
        gameType,
        status: 'LOBBY',
        currentRound: 1,
        redRoundWins: 0,
        blueRoundWins: 0,
        ropeScore: 0,
        redTotalCorrect: 0,
        blueTotalCorrect: 0,
        globalQIndex: 0,
        redAnsweredIds: [],
        blueAnsweredIds: [],
        redPlayers: prev.redPlayers.map(resetPlayerForNewGame),
        bluePlayers: prev.bluePlayers.map(resetPlayerForNewGame),
        bossHP: matchSettings.bossMaxHP || 1000,
        maxBossHP: matchSettings.bossMaxHP || 1000,
        settings: matchSettings
      };
      matchStateRef.current = nextMS;
      setTimeout(() => {
        const firstQ = normalizedDeck[0] ? { ...normalizedDeck[0], qIndex: 0, totalQuestions: normalizedDeck.length } : undefined;
        const pullTs = Date.now();
        CloudNetwork.sendMessage({
          type: 'GAME_SWITCHED',
          gameType,
          status: 'LOBBY',
          globalQIndex: 0,
          lives: 3,
          eliminated: false,
          bossHP: nextMS.bossHP,
          maxBossHP: nextMS.maxBossHP,
          subj: currentSubjectKeyRef.current,
          quiz: normalizedDeck,
          question: firstQ
        });
        CloudNetwork.sendMessage({
          type: 'FORCE_PULL_TO_WAITING',
          roomId: activeRoomId,
          gameType,
          status: 'LOBBY',
          globalQIndex: 0,
          forcePullTs: pullTs,
          question: firstQ
        });
        broadcastHeartbeatRef.current(nextMS, normalizedDeck, activeRoomId);
        CloudNetwork.reconnectImmediate();
      }, 20);
      return nextMS;
    });

    setView('HOST_ARENA');
  };

  const quizListRef = useRef<QuizItem[]>(quizList);
  quizListRef.current = quizList;

  const matchStateRef = useRef<MatchState>(matchState);
  matchStateRef.current = matchState;

  const currentSubjectKeyRef = useRef<string>(currentSubjectKey);
  currentSubjectKeyRef.current = currentSubjectKey;

  const viewRef = useRef<'TEACHER_SETUP' | 'HOST_ARENA' | 'STUDENT_MOBILE'>(view);
  viewRef.current = view;

  // Đợt 8 (4D): DEBOUNCE ghi snapshot — matchState đổi liên tục khi HS trả lời, ghi
  // JSON.stringify vào 2 storage mỗi lần đổi làm host giật. Nay gom tối đa 1 lần/500ms;
  // bản ghi NGAY LẬP TỨC vẫn còn ở effect beforeunload/pagehide bên dưới + flush khi
  // effect dọn dẹp, nên F5/đóng tab không mất dữ liệu.
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeHostSnapshot = (state: MatchState, roomId: string, currentView: string) => {
    try {
      // Lưu kèm answeredQKeys để F5 không mất bộ chống trùng đáp án phía host
      const payload = JSON.stringify({
        ...state,
        answeredQKeys: Array.from(answeredQKeysRef.current),
        answeredDetails: Array.from(answeredDetailsRef.current.entries())
      });
      sessionStorage.setItem('kc3d_host_saved_state_' + roomId, payload);
      localStorage.setItem('kc3d_host_saved_state_' + roomId, payload);
      sessionStorage.setItem('kc3d_host_session_active', '1');
      sessionStorage.setItem('kc3d_host_room_id', roomId);
      sessionStorage.setItem('kc3d_host_view', currentView);
    } catch {}
  };

  // Tự động lưu snapshot phòng và danh sách học sinh liên tục để bảo toàn 100% khi bấm F5 hoặc làm mới trang
  useEffect(() => {
    if (!activeRoomId || isDirectStudent) return;
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = setTimeout(() => {
      snapshotTimerRef.current = null;
      writeHostSnapshot(matchStateRef.current, activeRoomId, viewRef.current);
    }, 500);
    // KHÔNG flush trong cleanup của effect này (cleanup chạy mỗi lần matchState đổi
    // sẽ huỷ tác dụng debounce) — việc xả ghi khi đổi phòng/unmount do effect riêng
    // ngay dưới đảm nhận, còn F5/đóng tab do beforeunload/pagehide đảm nhận.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchState, activeRoomId, view, isDirectStudent]);

  // Đợt 8 (4D): xả bản ghi snapshot đang chờ debounce NGAY khi đổi phòng/unmount —
  // ghi cho PHÒNG CŨ (closure giữ activeRoomId cũ) trước khi phòng mới ghi đè.
  useEffect(() => {
    return () => {
      if (snapshotTimerRef.current) {
        clearTimeout(snapshotTimerRef.current);
        snapshotTimerRef.current = null;
        if (activeRoomId && !isDirectStudent) {
          writeHostSnapshot(matchStateRef.current, activeRoomId, viewRef.current);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId, isDirectStudent]);

  // Bắt sự kiện beforeunload / pagehide để lưu snapshot ngay lập tức trước khi trình duyệt reload
  useEffect(() => {
    if (isDirectStudent) return;
    const saveSnapshotSync = () => {
      try {
        if (activeRoomId && matchStateRef.current) {
          const payload = JSON.stringify({
            ...matchStateRef.current,
            answeredQKeys: Array.from(answeredQKeysRef.current),
            answeredDetails: Array.from(answeredDetailsRef.current.entries())
          });
          sessionStorage.setItem('kc3d_host_saved_state_' + activeRoomId, payload);
          localStorage.setItem('kc3d_host_saved_state_' + activeRoomId, payload);
          sessionStorage.setItem('kc3d_host_session_active', '1');
          sessionStorage.setItem('kc3d_host_room_id', activeRoomId);
          sessionStorage.setItem('kc3d_host_view', viewRef.current);
        }
      } catch {}
    };

    window.addEventListener('beforeunload', saveSnapshotSync);
    window.addEventListener('pagehide', saveSnapshotSync);
    return () => {
      window.removeEventListener('beforeunload', saveSnapshotSync);
      window.removeEventListener('pagehide', saveSnapshotSync);
    };
  }, [activeRoomId, isDirectStudent]);

  // Nếu là phiên phục hồi sau F5, đối soát danh sách học sinh với server để không bỏ sót bạn nào
  useEffect(() => {
    if (!isHostReloadSession || isDirectStudent || !activeRoomId) return;
    const recoverFromServer = async () => {
      try {
        const res = await fetch(`/api/room/${encodeURIComponent(activeRoomId)}/poll?since=0`);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.players) && data.players.length > 0) {
            setMatchState(prev => {
              const redMap = new Map(prev.redPlayers.map(p => [p.id, p]));
              const blueMap = new Map(prev.bluePlayers.map(p => [p.id, p]));
              let hasChanges = false;
              data.players.forEach((sp: any) => {
                if (!sp || !sp.id) return;
                const pItem: Player = {
                  id: sp.id,
                  label: sp.name || sp.label || 'Học sinh',
                  team: sp.team === 'BLUE' ? 'BLUE' : 'RED',
                  role: sp.role || 'ROPE_PULLER',
                  ready: true,
                  correct: typeof sp.savedCorrect === 'number' ? sp.savedCorrect : 0,
                  freeze: 0,
                  lives: typeof sp.lives === 'number' ? sp.lives : 3,
                  wrongTotal: 0,
                  streak: 0,
                  eliminated: Boolean(sp.eliminated),
                  fastScore: typeof sp.savedScore === 'number' ? sp.savedScore : 0,
                  avatar: sp.avatar,
                  lastDelta: 0,
                  lastTimeSec: null
                };
                if (pItem.team === 'BLUE') {
                  const exist = blueMap.get(pItem.id);
                  if (!exist) {
                    blueMap.set(pItem.id, pItem);
                    hasChanges = true;
                  } else if ((pItem.fastScore || 0) > (exist.fastScore || 0) || (pItem.correct || 0) > (exist.correct || 0)) {
                    blueMap.set(pItem.id, { ...exist, fastScore: Math.max(exist.fastScore || 0, pItem.fastScore || 0), correct: Math.max(exist.correct || 0, pItem.correct || 0) });
                    hasChanges = true;
                  }
                } else {
                  const exist = redMap.get(pItem.id);
                  if (!exist) {
                    redMap.set(pItem.id, pItem);
                    hasChanges = true;
                  } else if ((pItem.fastScore || 0) > (exist.fastScore || 0) || (pItem.correct || 0) > (exist.correct || 0)) {
                    redMap.set(pItem.id, { ...exist, fastScore: Math.max(exist.fastScore || 0, pItem.fastScore || 0), correct: Math.max(exist.correct || 0, pItem.correct || 0) });
                    hasChanges = true;
                  }
                }
              });
              if (!hasChanges) return prev;
              const nextState = {
                ...prev,
                redPlayers: Array.from(redMap.values()),
                bluePlayers: Array.from(blueMap.values())
              };
              matchStateRef.current = nextState;
              return nextState;
            });
          }
        }
      } catch {}
    };
    recoverFromServer();
  }, [activeRoomId, isDirectStudent, isHostReloadSession]);

  const lastSyncedQuizSigRef = useRef<string>('');
  // Đợt 8 (4D): chữ ký roster (top10 + playerIds) của nhịp tim trước — không đổi thì
  // nhịp kế tiếp gửi bản RÚT GỌN (bỏ top10/playerIds, đặt top10Unchanged) cho nhẹ gói.
  const lastHeartbeatRosterSigRef = useRef<string>('');

  // Broadcast host heartbeat (Tối ưu chống nghẽn mạng: chỉ đính kèm full mảng quiz khi đề thi thay đổi, còn lại gửi nhẹ < 1KB)
  const broadcastHeartbeat = (currentMS: MatchState, currentQ: QuizItem[], roomId: string, forceFullQuiz: boolean = false) => {
    const activeDeck = quizListRef.current && quizListRef.current.length > 0 ? quizListRef.current : currentQ;
    const allP = [...currentMS.redPlayers, ...currentMS.bluePlayers];
    const aliveCount = allP.filter(x => !x.eliminated).length;
    const safeIdx = Math.min(Math.max(0, currentMS.globalQIndex), Math.max(0, (activeDeck.length || 1) - 1));
    const rawActiveQ = activeDeck[safeIdx];
    const activeQWithMeta = rawActiveQ ? {
      ...rawActiveQ,
      qIndex: safeIdx,
      totalQuestions: activeDeck.length
    } : undefined;

    const top10List = [...allP]
      .sort((a, b) => {
        if (currentMS.gameType === 'BELL') {
          if (!a.eliminated && b.eliminated) return -1;
          if (a.eliminated && !b.eliminated) return 1;
          if ((b.lives || 0) !== (a.lives || 0)) return (b.lives || 0) - (a.lives || 0);
        }
        if ((b.fastScore || 0) !== (a.fastScore || 0)) return (b.fastScore || 0) - (a.fastScore || 0);
        return (b.correct || 0) - (a.correct || 0);
      })
      .slice(0, 10)
      .map((p, idx) => ({
        id: p.id,
        name: p.label,
        label: p.label,
        team: p.team,
        score: p.fastScore || 0,
        fastScore: p.fastScore || 0,
        correct: p.correct || 0,
        lives: p.lives ?? 3,
        eliminated: Boolean(p.eliminated),
        rank: idx + 1
      }));

    const playerIds = allP.map(p => p.id);

    const quizSig = `${roomId}_${activeDeck.length}_${activeDeck[0]?.q?.slice(0, 20) || ''}`;
    const shouldIncludeFullQuiz = forceFullQuiz || lastSyncedQuizSigRef.current !== quizSig;
    if (shouldIncludeFullQuiz && activeDeck.length > 0) {
      lastSyncedQuizSigRef.current = quizSig;
    }

    try {
      localStorage.setItem(
        `kc3d_live_sync_${roomId}`,
        JSON.stringify({
          roomId,
          gameType: currentMS.gameType,
          status: currentMS.status,
          globalQIndex: safeIdx,
          question: activeQWithMeta,
          top10: top10List,
          playerIds,
          quiz: activeDeck.length <= 30 ? activeDeck : undefined,
          subj: currentSubjectKeyRef.current,
          updatedAt: Date.now()
        })
      );
    } catch {}

    // Đợt 8 (4D): roster (top10 + playerIds) KHÔNG đổi so với nhịp trước và nhịp này
    // không kèm full quiz → gửi bản RÚT GỌN: bỏ top10/playerIds, đặt top10Unchanged.
    // Phía HS giữ nguyên top10/danh sách cũ khi thấy cờ này (xem StudentMobileView).
    const rosterSig =
      top10List.map(p => `${p.id}:${p.score}:${p.correct}:${p.lives}:${p.eliminated ? 1 : 0}`).join(',') +
      '|' +
      playerIds.join(',');
    const rosterUnchanged = !shouldIncludeFullQuiz && rosterSig === lastHeartbeatRosterSigRef.current;
    lastHeartbeatRosterSigRef.current = rosterSig;

    CloudNetwork.sendMessage({
      type: 'HOST_HEARTBEAT',
      gameType: currentMS.gameType,
      status: currentMS.status,
      serverTs: Date.now(),
      // Thời lượng của CHÍNH câu đang chiếu, tính theo phần của câu đó (Phần 1/2/3).
      durationSec: questionDurationFor(currentMS.settings, rawActiveQ),
      // Trạng thái TẠM DỪNG theo câu + số giây còn lại đã chốt: HS nào lỡ gói
      // PAUSE_TOGGLE vẫn đông cứng đúng theo nhịp tim.
      questionPaused: Boolean(currentMS.questionPause && currentMS.questionPause.qIndex === safeIdx),
      remainingSec:
        currentMS.questionPause && currentMS.questionPause.qIndex === safeIdx
          ? currentMS.questionPause.remainingSec
          : undefined,
      ttsStudentEnabled: currentMS.settings?.ttsStudentEnabled === true,
      currentRound: currentMS.currentRound,
      redRoundWins: currentMS.redRoundWins,
      blueRoundWins: currentMS.blueRoundWins,
      ropeScore: currentMS.ropeScore,
      globalQIndex: safeIdx,
      redDoneCount: currentMS.redAnsweredIds.length,
      redTotalMembers: Math.max(currentMS.redPlayers.length, 1),
      blueDoneCount: currentMS.blueAnsweredIds.length,
      blueTotalMembers: Math.max(currentMS.bluePlayers.length, 1),
      bellAliveCount: aliveCount,
      bellTotalCount: allP.length,
      bossHP: currentMS.bossHP,
      maxBossHP: currentMS.maxBossHP,
      worldEvent: currentMS.activeWorldEvent || 'NONE',
      worldEventTitle: currentMS.worldEventTitle || '',
      subj: currentSubjectKeyRef.current,
      ...(rosterUnchanged ? { top10Unchanged: true } : { top10: top10List, playerIds }),
      question: activeQWithMeta,
      quiz: shouldIncludeFullQuiz ? activeDeck : undefined
    });
  };

  const broadcastHeartbeatRef = useRef(broadcastHeartbeat);
  broadcastHeartbeatRef.current = broadcastHeartbeat;

  // Đợt 5 (4B.3): ghi lại mốc bắt đầu câu hiện tại phía host mỗi khi (trạng thái PLAYING,
  // chỉ số câu) thay đổi — cùng thời điểm HostArenaView phát QUESTION_START — để
  // RESYNC_STATE trả đúng serverStartTime/durationSec cho HS quay lại giữa câu.
  useEffect(() => {
    if (isDirectStudent) return;
    if (matchState.status !== 'PLAYING') return;
    const key = `PLAYING_${matchState.currentRound}_${matchState.globalQIndex}`;
    if (questionTimingKeyRef.current !== key) {
      questionTimingKeyRef.current = key;
      questionTimingRef.current = {
        qIndex: matchState.globalQIndex,
        serverStartTime: Date.now(),
        durationSec: questionDurationFor(matchState.settings, quizListRef.current[matchState.globalQIndex])
      };
    }
  }, [matchState.status, matchState.globalQIndex, matchState.currentRound, matchState.settings?.questionDurationSec, matchState.settings?.questionDurationTfSec, matchState.settings?.questionDurationSaSec, isDirectStudent]);

  // Đợt 5 (4B.2): VÒNG QUÉT GIỮ CHỖ mỗi 5s — quá 15s không tín hiệu: bật cờ offline
  // (host hiển thị xám "mất kết nối") nhưng giữ nguyên chỗ/điểm/mạng; quá 5 phút: giải
  // phóng chỗ theo luật từng chế độ (BELL: loại khỏi sàn giữ bản ghi khán giả;
  // TUG/FAST/BOSS: dọn bản ghi + khoá định danh tới hết ván đang PLAYING).
  useEffect(() => {
    if (isDirectStudent) return;
    const sweepTimer = setInterval(() => {
      const ms = matchStateRef.current;
      if (!ms || ms.status === 'ENDED') return;
      if (ms.redPlayers.length === 0 && ms.bluePlayers.length === 0) return;
      const now = Date.now();
      // Đợt GIA CỐ TẢI: ngưỡng quét co giãn theo quy mô phòng hiện tại — phòng
      // càng đông, HS ping càng thưa (8–15s) nên mốc "mất kết nối" và van mất-thu
      // phải nới tương ứng, nếu không cả lớp bị xám/giải phóng oan dù vẫn đang
      // ping đúng nhịp mới. Giữ chỗ vẫn 5 phút ở mọi nấc (timing.holdMs).
      const timing = presenceTimingForRoomSize(ms.redPlayers.length + ms.bluePlayers.length);
      const rxOutage = isHostReceptionOutage(lastHostRxAtRef.current, now, timing.outageMs);
      if (rxOutage) {
        if (!rxOutageRef.current) { rxOutageRef.current = true; rxOutageSinceRef.current = lastHostRxAtRef.current; }
        if (now - rxOutageSinceRef.current <= timing.holdMs) return; // host đang điếc: không giải phóng ai oan
        rxOutageRef.current = false; // mất thu quá cả thời gian giữ chỗ → quay lại quét bình thường
      } else if (rxOutageRef.current) {
        rxOutageRef.current = false;
        // Vừa hồi phục thu: ân hạn — làm mới lastSeen cho mọi bản ghi CHƯA bị will đánh dấu offline và chưa bị giải phóng
        [...ms.redPlayers, ...ms.bluePlayers].forEach(p => { if (p.offline !== true && !p.holdReleased) lastSeenByIdRef.current.set(p.id, now); });
      }
      const result = sweepPlayerPresence(ms.redPlayers, ms.bluePlayers, ms.gameType, now, lastSeenByIdRef.current, timing);
      if (result.releasedIds.length > 0) {
        const allBefore = [...ms.redPlayers, ...ms.bluePlayers];
        result.releasedIds.forEach(id => {
          releasedHoldKeysRef.current.add(id);
          const rec = allBefore.find(p => p.id === id);
          if (rec?.studentId) releasedHoldKeysRef.current.add(rec.studentId);
        });
      }
      if (result.changed) {
        const nextState = { ...ms, redPlayers: result.redPlayers, bluePlayers: result.bluePlayers };
        matchStateRef.current = nextState;
        setMatchState(nextState);
      }
    }, 5000);
    return () => clearInterval(sweepTimer);
  }, [isDirectStudent]);

  // Wrapper cập nhật đồng bộ matchStateRef ngay lập tức (0ms) để chống Race Condition khi Giáo viên bấm BẮT ĐẦU THI
  const handleUpdateMatchStateSync: React.Dispatch<React.SetStateAction<MatchState>> = (updater) => {
    setMatchState(prev => {
      const next = typeof updater === 'function' ? (updater as (p: MatchState) => MatchState)(prev) : updater;
      const statusOrQChanged = next.status !== prev.status || next.globalQIndex !== prev.globalQIndex;
      matchStateRef.current = next;
      if (statusOrQChanged) {
        setTimeout(() => {
          broadcastHeartbeatRef.current(next, quizListRef.current, activeRoomId, false);
        }, 5);
      }
      return next;
    });
  };

  // Host incoming message handler
  const handleHostIncomingMessage = (d: CloudMessage) => {
    if (!d || !d.type) return;
    lastHostRxAtRef.current = Date.now();

    if (d.type === 'QUIZ_CHUNK_REQUEST') {
      // Đợt 3 (2.3): HS xin phát lại gói đề thiếu — tầng mạng (network.ts) đã tự phát lại
      // đúng các gói đó từ bản đồ chunk theo quizHash, host không cần xử lý thêm ở đây.
      return;
    }

    if (d.type === 'PLAYER_PING') {
      // Đợt 5 (4B.2): nhịp tim gọn mỗi 5s — CHỈ ghi lastSeen (đồng hồ host) vào ref,
      // ping không bao giờ tạo bản ghi mới và không phát ENTER_CONFIRMED. Chỉ khi HS
      // đang bị đánh dấu offline mà ping lại được mới cần ghi state để gỡ màu xám.
      if (!d.playerId) return;
      const pingNow = Date.now();
      const pingTarget = findPlayerByIdentity(
        matchStateRef.current.redPlayers,
        matchStateRef.current.bluePlayers,
        d.playerId,
        d.studentId
      );
      if (!pingTarget) return;
      lastSeenByIdRef.current.set(pingTarget.id, pingNow);
      if (pingTarget.offline && !pingTarget.holdReleased) {
        setMatchState(prev => {
          const upd = (p: Player): Player =>
            p.id === pingTarget.id ? { ...p, offline: false, lastSeen: pingNow } : p;
          const nextState = {
            ...prev,
            redPlayers: prev.redPlayers.map(upd),
            bluePlayers: prev.bluePlayers.map(upd)
          };
          matchStateRef.current = nextState;
          return nextState;
        });
      }
      return;
    }

    if (d.type === 'PLAYER_OFFLINE') {
      // Đợt 5 (4B.2): Last-Will của HS vừa bắn (rớt hẳn) — ĐÓNG BĂNG lastSeen tại thời
      // điểm host nhận tin và bật cờ offline ngay, KHÔNG xoá bản ghi: vòng quét giữ
      // chỗ sẽ đếm đủ 5 phút từ mốc đóng băng này mới giải phóng chỗ.
      if (!d.playerId) return;
      const offlineNow = Date.now();
      setMatchState(prev => {
        const target = findPlayerByIdentity(prev.redPlayers, prev.bluePlayers, d.playerId, d.studentId);
        if (!target || target.holdReleased) return prev;
        lastSeenByIdRef.current.set(target.id, offlineNow);
        if (target.offline && target.lastSeen === offlineNow) return prev;
        const upd = (p: Player): Player =>
          p.id === target.id ? { ...p, offline: true, lastSeen: offlineNow } : p;
        const nextState = {
          ...prev,
          redPlayers: prev.redPlayers.map(upd),
          bluePlayers: prev.bluePlayers.map(upd)
        };
        matchStateRef.current = nextState;
        return nextState;
      });
      return;
    }

    if (d.type === 'RESYNC_REQUEST') {
      // Đợt 5 (4B.3): HS xin đồng bộ tường minh sau reconnect/F5/quay lại từ nền —
      // trả RESYNC_STATE dựng từ trạng thái thật phía host (không qua heartbeat đoán mò).
      if (!d.playerId) return;
      const resyncNow = Date.now();
      const lastResyncAt = lastResyncAtRef.current[d.playerId] || 0;
      if (resyncNow - lastResyncAt < 800) return; // chống bão resync khi nhiều kênh cùng nối lại
      lastResyncAtRef.current[d.playerId] = resyncNow;

      const ms = matchStateRef.current;
      const player = findPlayerByIdentity(ms.redPlayers, ms.bluePlayers, d.playerId, d.studentId);
      if (player) {
        lastSeenByIdRef.current.set(player.id, resyncNow);
        if (player.offline && !player.holdReleased) {
          setMatchState(prev => {
            const upd = (p: Player): Player =>
              p.id === player.id ? { ...p, offline: false, lastSeen: resyncNow } : p;
            const nextState = {
              ...prev,
              redPlayers: prev.redPlayers.map(upd),
              bluePlayers: prev.bluePlayers.map(upd)
            };
            matchStateRef.current = nextState;
            return nextState;
          });
        }
      }

      const qIdx = Math.min(Math.max(0, ms.globalQIndex), Math.max(0, (quizListRef.current.length || 1) - 1));
      const deck = quizListRef.current;
      const rawQ = deck[qIdx];
      const question = rawQ ? { ...rawQ, qIndex: qIdx, totalQuestions: deck.length } : undefined;
      // Đang TẠM DỪNG ở chính câu này: RESYNC trả trạng thái đông cứng + số giây
      // còn lại, KHÔNG trả deadline đang chạy. Ngoài lúc dừng: ưu tiên mốc đoạn
      // host đã công bố (currentTiming — gồm cả đoạn Tiếp tục sau tạm dừng), rồi
      // tới mốc ghi ở effect, cuối cùng mới tính theo phần của câu.
      const pausedForQ =
        ms.questionPause && ms.questionPause.qIndex === ms.globalQIndex ? ms.questionPause : null;
      const timing = pausedForQ
        ? { serverStartTime: undefined, durationSec: undefined as number | undefined }
        : ms.currentTiming && ms.currentTiming.qIndex === ms.globalQIndex
          ? ms.currentTiming
          : questionTimingRef.current.qIndex === ms.globalQIndex
            ? questionTimingRef.current
            : { serverStartTime: undefined, durationSec: questionDurationFor(ms.settings, rawQ) };

      let answer: { hasAnswered: boolean; isCorrect?: boolean | null; selectedOptionOriginalIdx?: number | null; tfAnswers?: Record<string, boolean>; shortAnswerInput?: string } = { hasAnswered: false };
      if (player) {
        const key = answerKeyFor(player.id, ms.globalQIndex);
        const altKey = answerKeyFor(d.playerId, ms.globalQIndex);
        const has = answeredQKeysRef.current.has(key) || answeredQKeysRef.current.has(altKey);
        const det = answeredDetailsRef.current.get(key) || answeredDetailsRef.current.get(altKey);
        answer = {
          hasAnswered: has,
          isCorrect: det ? det.isCorrect : null,
          selectedOptionOriginalIdx: det && typeof det.selectedOptionOriginalIdx !== 'undefined' ? det.selectedOptionOriginalIdx : null,
          tfAnswers: det?.tfAnswers,
          shortAnswerInput: det?.shortAnswerInput
        };
      }

      const holdReleased = player
        ? Boolean(player.holdReleased)
        : Boolean(
            (d.studentId && releasedHoldKeysRef.current.has(d.studentId)) ||
            releasedHoldKeysRef.current.has(d.playerId)
          );

      CloudNetwork.sendMessage(
        buildResyncStateMessage(ms, player, d.playerId, {
          question,
          serverStartTime: timing.serverStartTime,
          durationSec: timing.durationSec || (pausedForQ ? undefined : questionDurationFor(ms.settings, rawQ)),
          questionPaused: Boolean(pausedForQ),
          remainingSec: pausedForQ ? pausedForQ.remainingSec : undefined,
          serverTs: resyncNow,
          answer,
          holdReleased
        })
      );
      return;
    }

    if (d.type === 'MATCH_START' || d.type === 'GAME_SWITCH' || d.type === 'GAME_SWITCHED') {
      answeredQKeysRef.current.clear();
      answeredDetailsRef.current.clear();
      releasedHoldKeysRef.current.clear();
      firstBloodByQRef.current.clear();
      return;
    }

    if (d.type === 'AUTO_ENTER_ARENA' || d.type === 'PLAYER_READY_ROPE' || d.type === 'PLAYER_FINISH_QUIZ' || d.type === 'PLAYER_UPDATE_NAME') {
      if (!d.playerId) return;
      const isReady = d.type === 'PLAYER_READY_ROPE' || d.type === 'PLAYER_FINISH_QUIZ' || d.type === 'PLAYER_UPDATE_NAME';
      setMatchState(prev => {
        // Đợt 5 (4B.1): tìm bản ghi theo ĐỊNH DANH BỀN trước (studentId), rồi mới theo
        // playerId phiên tab — HS quay lại bằng playerId mới vẫn trúng bản ghi cũ.
        const existingByIdentity = findPlayerByIdentity(prev.redPlayers, prev.bluePlayers, d.playerId, d.studentId);
        const existingRedIdx = existingByIdentity ? prev.redPlayers.findIndex(x => x.id === existingByIdentity.id) : -1;
        const existingBlueIdx = existingByIdentity ? prev.bluePlayers.findIndex(x => x.id === existingByIdentity.id) : -1;
        const existing = existingByIdentity;

        const incomingName = (d.playerName || '').trim();
        const isIncomingGeneric =
          !incomingName ||
          incomingName === 'Chưa lưu tên';

        if (existing) {
          // Đợt 5 (4B.2): bản ghi đã bị giải phóng chỗ ở ván này (BELL đã loại) và ván
          // còn đang PLAYING → KHÔNG hồi sinh giữa ván; trả RESYNC_STATE báo giữ chỗ
          // đã hết để HS chờ ván sau. Trận về LOBBY thì gộp/hồi sinh bình thường.
          if (existing.holdReleased && prev.status === 'PLAYING') {
            const nowR = Date.now();
            const lastR = lastResyncAtRef.current[d.playerId!] || 0;
            if (nowR - lastR >= 800) {
              lastResyncAtRef.current[d.playerId!] = nowR;
              const deckR = quizListRef.current;
              const safeIdxR = Math.min(Math.max(0, prev.globalQIndex), Math.max(0, (deckR.length || 1) - 1));
              const rawQR = deckR[safeIdxR];
              CloudNetwork.sendMessage(
                buildResyncStateMessage(prev, existing, d.playerId!, {
                  question: rawQR ? { ...rawQR, qIndex: safeIdxR, totalQuestions: deckR.length } : undefined,
                  serverStartTime: questionTimingRef.current.qIndex === prev.globalQIndex ? questionTimingRef.current.serverStartTime : undefined,
                  durationSec: questionDurationFor(prev.settings, rawQR),
                  questionPaused: Boolean(prev.questionPause && prev.questionPause.qIndex === prev.globalQIndex),
                  remainingSec:
                    prev.questionPause && prev.questionPause.qIndex === prev.globalQIndex
                      ? prev.questionPause.remainingSec
                      : undefined,
                  serverTs: nowR,
                  answer: { hasAnswered: answeredQKeysRef.current.has(answerKeyFor(existing.id, prev.globalQIndex)) },
                  holdReleased: true
                })
              );
            }
            return prev;
          }

          const nextReady = existing.ready || isReady;
          if (isReady && !existing.ready) {
            AudioFX.stepInRope();
          }

          // Đợt 5 (4B.1) + HOTFIX 1.1: GỘP vào bản ghi cũ theo studentId — giữ nguyên
          // id/đội/vai trò/mạng/streak của bản ghi cũ, điểm & số câu đúng lấy giá trị
          // cao hơn (không bao giờ reset điểm về 0 khi rớt mạng vào lại), lastSeen mới.
          const updatedPlayer: Player = mergePlayerRecord(
            existing,
            {
              playerId: d.playerId,
              studentId: d.studentId,
              playerName: d.playerName,
              savedScore: d.savedScore,
              savedCorrect: d.savedCorrect,
              avatar: d.avatar,
              ready: isReady
            },
            Date.now()
          );
          lastSeenByIdRef.current.set(updatedPlayer.id, updatedPlayer.lastSeen || Date.now());
          const nextLabel = updatedPlayer.label;
          const nextFastScore = updatedPlayer.fastScore || 0;
          const nextCorrect = updatedPlayer.correct || 0;
          const nextAvatar = updatedPlayer.avatar;
          const avatarChanged = JSON.stringify(existing.avatar || null) !== JSON.stringify(nextAvatar || null);

          const currentList = quizListRef.current && quizListRef.current.length > 0 ? quizListRef.current : quizList;
          const safeIdx = Math.min(Math.max(0, prev.globalQIndex), Math.max(0, (currentList.length || 1) - 1));
          const rawActiveQ = currentList[safeIdx];
          const activeQWithMeta = rawActiveQ ? {
            ...rawActiveQ,
            qIndex: safeIdx,
            totalQuestions: currentList.length
          } : null;

          const now = Date.now();
          const lastAckAt = lastEnterAckMapRef.current[updatedPlayer.id] || 0;
          const playerChanged =
            existing.label !== nextLabel ||
            existing.ready !== nextReady ||
            existing.fastScore !== nextFastScore ||
            existing.correct !== nextCorrect ||
            avatarChanged ||
            existing.offline !== updatedPlayer.offline ||
            existing.studentId !== updatedPlayer.studentId ||
            (existingRedIdx !== -1 && existingBlueIdx !== -1);

          // Chỉ phản hồi ENTER_CONFIRMED nhẹ (< 1KB, không đính kèm cả mảng quiz nặng) khi có thay đổi hoặc cách nhau > 8 giây để không làm nghẽn mạng khi 50+ HS cùng kết nối
          if (d.type !== 'PLAYER_FINISH_QUIZ' && (playerChanged || now - lastAckAt > 8000)) {
            lastEnterAckMapRef.current[updatedPlayer.id] = now;
            CloudNetwork.sendMessage({
              type: 'ENTER_CONFIRMED',
              playerId: updatedPlayer.id,
              studentId: updatedPlayer.studentId,
              team: updatedPlayer.team,
              role: updatedPlayer.role,
              label: updatedPlayer.label,
              gameType: prev.gameType,
              matchStatus: prev.status,
              globalQIndex: safeIdx,
              lives: prev.gameType === 'BELL' ? updatedPlayer.lives : 3,
              streak: updatedPlayer.streak,
              eliminated: prev.gameType === 'BELL' ? updatedPlayer.eliminated : false,
              fastScore: updatedPlayer.fastScore || 0,
              savedCorrect: updatedPlayer.correct || 0,
              bossHP: prev.bossHP,
              maxBossHP: prev.maxBossHP,
              question: activeQWithMeta || undefined
            });
          }

          if (!playerChanged) {
            return prev;
          }

          // Đảm bảo không bao giờ bị trùng playerId ở cả 2 mảng redPlayers và bluePlayers
          const nextRed = existingRedIdx !== -1
            ? prev.redPlayers.map((p, idx) => idx === existingRedIdx ? updatedPlayer : p)
            : prev.redPlayers.filter(p => p.id !== updatedPlayer.id);
          const nextBlue = existingRedIdx === -1 && existingBlueIdx !== -1
            ? prev.bluePlayers.map((p, idx) => idx === existingBlueIdx ? updatedPlayer : p)
            : prev.bluePlayers.filter(p => p.id !== updatedPlayer.id);

          const nextState = {
            ...prev,
            redPlayers: nextRed,
            bluePlayers: nextBlue
          };
          matchStateRef.current = nextState;
          setTimeout(() => {
            broadcastHeartbeatRef.current(nextState, quizListRef.current, activeRoomId, false);
          }, 15);
          return nextState;
        }

        // Bắt buộc học sinh phải nhập tên hợp lệ mới được vào phòng thi
        if (isIncomingGeneric) {
          return prev;
        }

        // Đợt 5 (4B.2): định danh này đã bị GIẢI PHÓNG CHỖ ở ván hiện tại (bản ghi đã
        // dọn) — ván còn đang PLAYING thì chưa vào lại được (trả RESYNC_STATE báo
        // holdReleased để HS chờ); trận về LOBBY/ENDED là ván sau → gỡ khoá, vào lại
        // như người chơi quay lại bình thường.
        const holdKeyHit =
          (d.studentId ? releasedHoldKeysRef.current.has(d.studentId) : false) ||
          (d.playerId ? releasedHoldKeysRef.current.has(d.playerId) : false);
        if (holdKeyHit && prev.status === 'PLAYING') {
          const nowH = Date.now();
          const lastH = lastResyncAtRef.current[d.playerId!] || 0;
          if (nowH - lastH >= 800) {
            lastResyncAtRef.current[d.playerId!] = nowH;
            const deckH = quizListRef.current;
            const safeIdxH = Math.min(Math.max(0, prev.globalQIndex), Math.max(0, (deckH.length || 1) - 1));
            const rawQH = deckH[safeIdxH];
            CloudNetwork.sendMessage(
              buildResyncStateMessage(prev, null, d.playerId!, {
                question: rawQH ? { ...rawQH, qIndex: safeIdxH, totalQuestions: deckH.length } : undefined,
                serverStartTime: questionTimingRef.current.qIndex === prev.globalQIndex ? questionTimingRef.current.serverStartTime : undefined,
                durationSec: questionDurationFor(prev.settings, rawQH),
                questionPaused: Boolean(prev.questionPause && prev.questionPause.qIndex === prev.globalQIndex),
                remainingSec:
                  prev.questionPause && prev.questionPause.qIndex === prev.globalQIndex
                    ? prev.questionPause.remainingSec
                    : undefined,
                serverTs: nowH,
                answer: { hasAnswered: false },
                holdReleased: true
              })
            );
          }
          return prev;
        }
        if (holdKeyHit) {
          if (d.studentId) releasedHoldKeysRef.current.delete(d.studentId);
          if (d.playerId) releasedHoldKeysRef.current.delete(d.playerId);
        }

        // Cho phép mở rộng dung lượng phòng lên tới 500+ học sinh
        const totalP = prev.redPlayers.length + prev.bluePlayers.length;
        const maxAllowed = Math.max(500, prev.settings?.roomCapacity || 500);
        if (totalP >= maxAllowed) {
          return prev;
        }

        // New player registration
        let assignedTeam = d.preferredTeam || 'RED';
        let role: 'PULLER' | 'SPECTATOR' = 'PULLER';

        if (joinMode === 'AUTO_ALL') {
          if (prev.redPlayers.length < prev.bluePlayers.length) assignedTeam = 'RED';
          else if (prev.bluePlayers.length < prev.redPlayers.length) assignedTeam = 'BLUE';
        } else if (joinMode === 'LIMITED_VS') {
          const count = assignedTeam === 'RED' ? prev.redPlayers.length : prev.bluePlayers.length;
          if (count >= maxPerTeam) {
            const otherCount = assignedTeam === 'RED' ? prev.bluePlayers.length : prev.redPlayers.length;
            if (otherCount < maxPerTeam) assignedTeam = assignedTeam === 'RED' ? 'BLUE' : 'RED';
            else role = 'SPECTATOR';
          }
        }

        const currentList = quizListRef.current && quizListRef.current.length > 0 ? quizListRef.current : quizList;
        const safeIdx = Math.min(Math.max(0, prev.globalQIndex), Math.max(0, (currentList.length || 1) - 1));
        const rawActiveQ = currentList[safeIdx];
        const activeQWithMeta = rawActiveQ ? {
          ...rawActiveQ,
          qIndex: safeIdx,
          totalQuestions: currentList.length
        } : null;

        if (role === 'PULLER') {
          AudioFX.spawnPop();
          const finalName = incomingName;
          const newP: Player = {
            id: d.playerId || 'hs_' + Math.random(),
            // Đợt 5 (4B.1/4B.2): gắn định danh bền + lastSeen ngay từ bản ghi đầu tiên.
            studentId: d.studentId || d.playerId,
            lastSeen: Date.now(),
            offline: false,
            label: finalName,
            team: assignedTeam,
            ready: isReady,
            spawned: false,
            // Sổ điểm của HOST bắt đầu từ 0 cho bản ghi mới — không khởi tạo từ
            // savedCorrect/savedScore phía HS báo lên (có thể là tổng cũ của
            // trận/phòng trước còn lưu trên máy HS; sự cố BXH 17/11/2026).
            correct: 0,
            freeze: 0,
            role: 'PULLER',
            lives: 3,
            wrongTotal: 0,
            streak: 0,
            eliminated: false,
            fastScore: 0,
            avatar: d.avatar
          };
          lastSeenByIdRef.current.set(newP.id, newP.lastSeen || Date.now());

          const nextRed = assignedTeam === 'RED' ? [...prev.redPlayers, newP] : prev.redPlayers;
          const nextBlue = assignedTeam === 'BLUE' ? [...prev.bluePlayers, newP] : prev.bluePlayers;

          CloudNetwork.sendMessage({
            type: 'ENTER_CONFIRMED',
            playerId: newP.id,
            studentId: newP.studentId,
            team: newP.team,
            role: 'PULLER',
            label: newP.label,
            gameType: prev.gameType,
            matchStatus: prev.status,
            globalQIndex: safeIdx,
            lives: newP.lives,
            streak: newP.streak,
            eliminated: newP.eliminated,
            fastScore: newP.fastScore || 0,
            savedCorrect: newP.correct || 0,
            bossHP: prev.bossHP,
            maxBossHP: prev.maxBossHP,
            question: activeQWithMeta || undefined
          });

          const nextState = { ...prev, redPlayers: nextRed, bluePlayers: nextBlue };
          matchStateRef.current = nextState;
          setTimeout(() => {
            broadcastHeartbeatRef.current(nextState, quizListRef.current, activeRoomId, false);
          }, 15);
          return nextState;
        } else {
          // KHÁN GIẢ (dự giờ / vào khi 2 đội đã đầy): KHÔNG tạo bản ghi người
          // chơi → không chiếm chỗ, không bị tính vào các ngưỡng người chơi,
          // không bị vòng quét giữ chỗ đụng tới. ENTER_CONFIRMED vẫn trả mỗi
          // lần khán giả gửi lại tin vào phòng (đề phòng gói xác nhận đầu bị
          // rớt) nhưng số khán giả chỉ ĐẾM MỘT LẦN cho mỗi định danh.
          const specKey = d.studentId || d.playerId || '';
          const alreadyCountedSpectator = specKey ? spectatorKeysRef.current.has(specKey) : false;
          if (specKey) spectatorKeysRef.current.add(specKey);
          CloudNetwork.sendMessage({
            type: 'ENTER_CONFIRMED',
            playerId: d.playerId,
            studentId: d.studentId,
            team: assignedTeam,
            role: 'SPECTATOR',
            label: d.playerName || 'Khán giả',
            gameType: prev.gameType,
            matchStatus: prev.status,
            globalQIndex: safeIdx,
            lives: 0,
            eliminated: true,
            question: activeQWithMeta || undefined
          });
          if (alreadyCountedSpectator) {
            return prev;
          }
          const nextState = { ...prev, spectators: prev.spectators + 1 };
          matchStateRef.current = nextState;
          return nextState;
        }
      });
    }
    else if (d.type === 'USE_POWERUP') {
      // Chỉ có trò Kéo Co (TUG) mới chia đội và có hiệu ứng kỹ năng lên đối thủ
      if (d.powerUpUsed === 'FREEZE_OPPONENT') {
        setMatchState(prev => {
          if (prev.gameType !== 'TUG') return prev;
          const opponentTeam = d.team === 'RED' ? prev.bluePlayers : prev.redPlayers;
          const activeOpponents = opponentTeam.filter(x => !x.eliminated && x.id !== d.playerId);
          if (activeOpponents.length > 0) {
            const target = activeOpponents[Math.floor(Math.random() * activeOpponents.length)];
            CloudNetwork.sendMessage({
              type: 'OPPONENT_FROZEN',
              targetPlayerId: target.id
            });
          }
          return prev;
        });
      }
    }
    else if (d.type === 'PULL_CORRECT') {
      setMatchState(prev => {
        if (prev.status === 'ENDED') return prev;
        const allP = [...prev.redPlayers, ...prev.bluePlayers];
        // Đợt 5 (4B.1): đáp án cũng mang studentId — tra bản ghi theo định danh bền
        // trước để đáp án của HS quay lại (playerId mới) vẫn cộng vào đúng bản ghi cũ.
        let pObj = findPlayerByIdentity(prev.redPlayers, prev.bluePlayers, d.playerId, d.studentId) || undefined;
        if (!pObj && d.playerId && d.playerName && d.playerName.trim().length >= 1) {
          const assignedTeam: 'RED' | 'BLUE' = d.team || (prev.redPlayers.length <= prev.bluePlayers.length ? 'RED' : 'BLUE');
          pObj = {
            id: d.playerId,
            studentId: d.studentId || d.playerId,
            lastSeen: Date.now(),
            label: d.playerName.trim(),
            team: assignedTeam,
            ready: true,
            spawned: false,
            correct: 0,
            freeze: 0,
            role: 'PULLER',
            lives: 3,
            wrongTotal: 0,
            streak: 0,
            eliminated: false,
            fastScore: 0,
            avatar: d.avatar
          };
          if (assignedTeam === 'RED') prev.redPlayers = [...prev.redPlayers, pObj];
          else prev.bluePlayers = [...prev.bluePlayers, pObj];
        }
        if (!pObj || (prev.gameType === 'BELL' && pObj.eliminated)) return prev;

        const targetQIdx = typeof d.globalQIndex === 'number' ? d.globalQIndex : prev.globalQIndex;
        const answerKey = answerKeyFor(pObj.id, targetQIdx);
        if (answeredQKeysRef.current.has(answerKey)) return prev;
        answeredQKeysRef.current.add(answerKey);
        // Đợt 5 (4B.2/4B.3): đáp án là bằng chứng HS đang sống + lưu lựa chọn để RESYNC.
        lastSeenByIdRef.current.set(pObj.id, Date.now());
        answeredDetailsRef.current.set(answerKey, {
          isCorrect: true,
          selectedOptionOriginalIdx: typeof d.selectedOptionOriginalIdx !== 'undefined' ? d.selectedOptionOriginalIdx : null,
          tfAnswers: d.tfAnswers,
          shortAnswerInput: d.shortAnswerInput
        });

        // Kiểm tra Tia Chớp Đầu Tiên (First Blood) cho câu hỏi này
        const isFirstBlood = !firstBloodByQRef.current.has(targetQIdx);
        if (isFirstBlood) {
          firstBloodByQRef.current.add(targetQIdx);
          AudioFX.firstBloodStrike();
          pObj.firstBloodCount = (pObj.firstBloodCount || 0) + 1;
        } else {
          AudioFX.pullHeave();
        }

        // Sổ HOST là nguồn sự thật duy nhất: đáp án đã qua khử trùng ở trên nên
        // mỗi HS × mỗi câu cộng ĐÚNG 1 lần. TUYỆT ĐỐI không nhận d.savedCorrect /
        // d.totalScore phía HS báo lên — máy HS có thể mang tổng cũ của trận trước
        // (sự cố 17/11/2026: câu 15 đã có HS "24 đúng", điểm cũng bị nhận theo).
        pObj.correct = (pObj.correct || 0) + 1;
        pObj.streak = (pObj.streak || 0) + 1;

        const studentElapsedSec = typeof d.elapsedSec === 'number' ? d.elapsedSec : 2.0;
        const wager = d.wagerLevel || 1;
        const firstBloodBonus = isFirstBlood ? 500 : 0;
        const worldEventMultiplier = prev.activeWorldEvent === 'GOLDEN_X2' ? 2 : 1;
        const baseGained = typeof d.gainedPts === 'number' && d.gainedPts > 0 ? d.gainedPts : 1000;
        const gainedScore = Math.round(baseGained * worldEventMultiplier) + firstBloodBonus;

        pObj.fastScore = (pObj.fastScore || 0) + gainedScore;
        pObj.lastDelta = gainedScore;
        pObj.lastTimeSec = studentElapsedSec;
        pObj.totalTimeMs = (pObj.totalTimeMs || 0) + Math.round(studentElapsedSec * 1000);

        // Bảng tin kịch tính thời gian thực (Live Kill-Feed)
        const nextFeed = [...(prev.liveFeed || [])];
        const pushFeed = (text: string, type: 'FIRST_BLOOD' | 'JACKPOT' | 'STREAK' | 'WAGER_WIN' | 'BOSS_CRIT' | 'WORLD_EVENT') => {
          nextFeed.unshift({
            id: `lf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            text,
            type,
            timestamp: Date.now()
          });
          if (nextFeed.length > 6) nextFeed.length = 6;
        };

        if (isFirstBlood) {
          pushFeed(`⚡ [TIA CHỚP ĐẦU TIÊN] ${pObj.label} trả lời đúng nhanh nhất câu #${targetQIdx + 1} (${studentElapsedSec.toFixed(1)}s • +${gainedScore}đ)!`, 'FIRST_BLOOD');
          CloudNetwork.sendMessage({
            type: 'DRAMA_EVENT',
            playerId: pObj.id,
            playerName: pObj.label,
            isFirstBlood: true,
            bonusScoreDelta: firstBloodBonus,
            totalScore: pObj.fastScore,
            dramaAnnouncement: `⚡ TIA CHỚP ĐẦU TIÊN: ${pObj.label} mở điểm câu #${targetQIdx + 1} siêu tốc (+500đ thưởng)!`
          });
        } else if (wager === 2.5) {
          pushFeed(`💎 [TẤT TAY x2.5] ${pObj.label} đặt cược All-In bản lĩnh và thắng lớn +${gainedScore}đ!`, 'WAGER_WIN');
        } else if (pObj.streak >= 3 && pObj.streak % 2 === 1) {
          pushFeed(`🔥 [CHUỖI ${pObj.streak} LIÊN TIẾP] ${pObj.label} đang Bốc Lửa trên bảng vàng!`, 'STREAK');
        }

        // Record question rightCount in ref without re-triggering quizList effects mid-question
        const activeDeck = quizListRef.current && quizListRef.current.length > 0 ? quizListRef.current : quizList;
        const safeQIdx = Math.min(Math.max(0, targetQIdx), Math.max(0, (activeDeck.length || 1) - 1));
        const curQ = activeDeck[safeQIdx];
        if (curQ) {
          curQ.rightCount = (curQ.rightCount || 0) + 1;
        }

        const nextRedAns = pObj.team === 'RED' && !prev.redAnsweredIds.includes(pObj.id)
          ? [...prev.redAnsweredIds, pObj.id]
          : prev.redAnsweredIds;
        const nextBlueAns = pObj.team === 'BLUE' && !prev.blueAnsweredIds.includes(pObj.id)
          ? [...prev.blueAnsweredIds, pObj.id]
          : prev.blueAnsweredIds;

        // BOSS Mode: Deal damage to Boss & rank individuals by score/correct
        if (prev.gameType === 'BOSS') {
          const isRageCrit = prev.activeWorldEvent === 'BOSS_RAGE_CRIT' || wager === 2.5 || isFirstBlood;
          const dmg = Math.round(150 * wager * (prev.activeWorldEvent === 'BOSS_RAGE_CRIT' ? 2 : 1) * (isFirstBlood ? 1.3 : 1));
          const rawNextHP = (prev.bossHP || 1000) - dmg;
          const baseMaxHP = prev.maxBossHP || 1000;
          let nextBossHP = Math.max(0, rawNextHP);
          let nextMaxHP = baseMaxHP;
          let attackMsg = `${isRageCrit ? '💥 BẠO KÍCH! ' : ''}Chiến binh ${pObj.label} gây -${dmg} HP Boss! (+${gainedScore}đ • Tổng: ${pObj.fastScore}đ)`;

          if (rawNextHP <= 0) {
            AudioFX.winFanfare();
            nextMaxHP = baseMaxHP + 1000;
            nextBossHP = nextMaxHP;
            attackMsg = `🔥 ${pObj.label} ĐÃ KẾT LIỄU BOSS! Boss Tiến Hóa Cấp Mới (${nextMaxHP} HP) — Thưởng nóng toàn sàn!`;
            pushFeed(`🐉 [KẾT LIỄU BOSS] ${pObj.label} tung đòn chí mạng hạ gục Boss!`, 'BOSS_CRIT');
          }

          return {
            ...prev,
            bossHP: nextBossHP,
            maxBossHP: nextMaxHP,
            redAnsweredIds: nextRedAns,
            blueAnsweredIds: nextBlueAns,
            bossLastAttack: attackMsg,
            firstBloodPlayerId: isFirstBlood ? pObj.id : prev.firstBloodPlayerId,
            firstBloodPlayerName: isFirstBlood ? pObj.label : prev.firstBloodPlayerName,
            liveFeed: nextFeed,
            redPlayers: [...prev.redPlayers],
            bluePlayers: [...prev.bluePlayers]
          };
        }

        if (prev.gameType === 'FAST') {
          const ranked = [...allP].sort((a, b) => (b.fastScore || 0) - (a.fastScore || 0));
          const myRank = ranked.findIndex(x => x.id === pObj.id) + 1;

          CloudNetwork.sendMessage({
            type: 'FAST_ANSWER_RESULT',
            playerId: pObj.id,
            qIndex: targetQIdx,
            isCorrect: true,
            isFirstBlood,
            gainedPts: gainedScore,
            elapsedSec: studentElapsedSec,
            totalScore: pObj.fastScore,
            rank: myRank,
            grade: getConvertedGradeByRank(myRank, pObj.fastScore).grade
          });

          return {
            ...prev,
            redAnsweredIds: nextRedAns,
            blueAnsweredIds: nextBlueAns,
            firstBloodPlayerId: isFirstBlood ? pObj.id : prev.firstBloodPlayerId,
            firstBloodPlayerName: isFirstBlood ? pObj.label : prev.firstBloodPlayerName,
            liveFeed: nextFeed,
            redPlayers: [...prev.redPlayers],
            bluePlayers: [...prev.bluePlayers]
          };
        }

        if (prev.gameType === 'BELL') {
          let bonusAwarded = false;
          if (pObj.streak >= 3) {
            pObj.lives = Math.min(5, (pObj.lives || 3) + 1);
            pObj.streak = 0;
            bonusAwarded = true;
            AudioFX.bonusLifeChime();
            pushFeed(`🔔 [THƯỞNG MẠNG VÀNG] ${pObj.label} đạt chuỗi 3 câu đúng liên tiếp • Nhận +1 ❤️ Mạng!`, 'STREAK');
          }

          CloudNetwork.sendMessage({
            type: 'PLAYER_LIVES_SYNC',
            playerId: pObj.id,
            lives: pObj.lives,
            streak: pObj.streak,
            eliminated: pObj.eliminated,
            fastScore: pObj.fastScore,
            bonusAwarded
          });

          return {
            ...prev,
            redAnsweredIds: nextRedAns,
            blueAnsweredIds: nextBlueAns,
            firstBloodPlayerId: isFirstBlood ? pObj.id : prev.firstBloodPlayerId,
            firstBloodPlayerName: isFirstBlood ? pObj.label : prev.firstBloodPlayerName,
            liveFeed: nextFeed,
            redPlayers: [...prev.redPlayers],
            bluePlayers: [...prev.bluePlayers]
          };
        }

        // TUG mode (Kéo Co 3D): Lực kéo tăng theo Mức Cược (wager), Tốc độ (First Blood) và Sự Kiện Phản Công (UNDERDOG_BOOST)
        const isTeamUnderdog =
          (pObj.team === 'RED' && prev.ropeScore > 0.8) ||
          (pObj.team === 'BLUE' && prev.ropeScore < -0.8);
        const underdogMult = prev.activeWorldEvent === 'UNDERDOG_BOOST' && isTeamUnderdog ? 1.75 : 1;
        const basePull = d.gainedPts && d.gainedPts >= 1500 ? 1.15 : 0.8;
        const pullPower = basePull * wager * underdogMult * (isFirstBlood ? 1.25 : 1);
        const rawNextRope = prev.ropeScore + (pObj.team === 'BLUE' ? pullPower : -pullPower);
        const nextRope = Math.max(-6, Math.min(6, rawNextRope));
        const nextRedTotalCorrect = pObj.team === 'RED' ? prev.redTotalCorrect + 1 : prev.redTotalCorrect;
        const nextBlueTotalCorrect = pObj.team === 'BLUE' ? prev.blueTotalCorrect + 1 : prev.blueTotalCorrect;

        return {
          ...prev,
          ropeScore: nextRope,
          redRoundWins: nextRedTotalCorrect,
          blueRoundWins: nextBlueTotalCorrect,
          redAnsweredIds: nextRedAns,
          blueAnsweredIds: nextBlueAns,
          redTotalCorrect: nextRedTotalCorrect,
          blueTotalCorrect: nextBlueTotalCorrect,
          firstBloodPlayerId: isFirstBlood ? pObj.id : prev.firstBloodPlayerId,
          firstBloodPlayerName: isFirstBlood ? pObj.label : prev.firstBloodPlayerName,
          liveFeed: nextFeed,
          redPlayers: [...prev.redPlayers],
          bluePlayers: [...prev.bluePlayers]
        };
      });
    }
    else if (d.type === 'MYSTERY_CHEST_CLAIMED') {
      setMatchState(prev => {
        const allP = [...prev.redPlayers, ...prev.bluePlayers];
        const pObj = findPlayerByIdentity(prev.redPlayers, prev.bluePlayers, d.playerId, d.studentId);
        if (!pObj) return prev;
        lastSeenByIdRef.current.set(pObj.id, Date.now());

        const delta = typeof d.bonusScoreDelta === 'number' ? d.bonusScoreDelta : 0;
        // Cộng PHẦN THƯỞNG do host tự cộng dồn — không nhận d.totalScore tuyệt đối
        // phía HS (cùng lý do sự cố BXH 17/11/2026).
        pObj.fastScore = (pObj.fastScore || 0) + delta;
        if (typeof d.lives === 'number' && prev.gameType === 'BELL') {
          pObj.lives = Math.min(5, d.lives);
          if (pObj.lives > 0) {
            pObj.eliminated = false;
            pObj.role = 'PULLER';
          }
        }

        // Nếu mở trúng Đạo Chích (STEAL_LEADER): +900đ và hút 500đ của bạn đang dẫn đầu Top 1
        if (d.powerUpUsed === ('STEAL_LEADER' as any)) {
          const others = allP.filter(x => x.id !== pObj.id && (x.fastScore || 0) > 0).sort((a, b) => (b.fastScore || 0) - (a.fastScore || 0));
          if (others.length > 0) {
            const leader = others[0];
            const stolen = Math.min(500, leader.fastScore || 0);
            leader.fastScore = Math.max(0, (leader.fastScore || 0) - stolen);
            CloudNetwork.sendMessage({
              type: 'PLAYER_LIVES_SYNC',
              playerId: leader.id,
              fastScore: leader.fastScore,
              lives: leader.lives,
              streak: leader.streak,
              eliminated: leader.eliminated
            });
          }
        }

        let nextRope = prev.ropeScore;
        if (prev.gameType === 'TUG' && delta >= 1000) {
          const yank = pObj.team === 'BLUE' ? 0.9 : -0.9;
          nextRope = Math.max(-6, Math.min(6, prev.ropeScore + yank));
        }

        let nextBossHP = prev.bossHP;
        if (prev.gameType === 'BOSS' && delta >= 1000) {
          nextBossHP = Math.max(10, (prev.bossHP || 1000) - 250);
        }

        const nextFeed = [...(prev.liveFeed || [])];
        if (d.mysteryRewardText) {
          nextFeed.unshift({
            id: `lf_mc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            text: `🎁 [RƯƠNG ĐỊNH MỆNH 5 STREAK] ${pObj.label}: ${d.mysteryRewardText}`,
            type: 'JACKPOT',
            timestamp: Date.now()
          });
          if (nextFeed.length > 6) nextFeed.length = 6;
        }

        return {
          ...prev,
          ropeScore: nextRope,
          bossHP: nextBossHP,
          liveFeed: nextFeed,
          redPlayers: [...prev.redPlayers],
          bluePlayers: [...prev.bluePlayers]
        };
      });
    }
    else if (d.type === 'FREEZE_WRONG') {
      setMatchState(prev => {
        const allP = [...prev.redPlayers, ...prev.bluePlayers];
        // Đợt 5 (4B.1): tra theo định danh bền trước, như PULL_CORRECT.
        const pObj = findPlayerByIdentity(prev.redPlayers, prev.bluePlayers, d.playerId, d.studentId);
        if (!pObj || (prev.gameType === 'BELL' && pObj.eliminated)) return prev;

        const targetQIdx = typeof d.globalQIndex === 'number' ? d.globalQIndex : prev.globalQIndex;
        const answerKey = answerKeyFor(pObj.id, targetQIdx);
        if (answeredQKeysRef.current.has(answerKey)) return prev;
        answeredQKeysRef.current.add(answerKey);
        // Đợt 5 (4B.2/4B.3): đáp án sai cũng là tín hiệu sống + lưu lựa chọn cho RESYNC.
        lastSeenByIdRef.current.set(pObj.id, Date.now());
        answeredDetailsRef.current.set(answerKey, {
          isCorrect: false,
          selectedOptionOriginalIdx: typeof d.selectedOptionOriginalIdx !== 'undefined' ? d.selectedOptionOriginalIdx : null,
          tfAnswers: d.tfAnswers,
          shortAnswerInput: d.shortAnswerInput
        });

        pObj.wrongTotal = (pObj.wrongTotal || 0) + 1;
        pObj.streak = 0;
        const wager = d.wagerLevel || 1;

        const activeDeck = quizListRef.current && quizListRef.current.length > 0 ? quizListRef.current : quizList;
        const safeQIdx = Math.min(Math.max(0, targetQIdx), Math.max(0, (activeDeck.length || 1) - 1));
        const curQ = activeDeck[safeQIdx];
        if (curQ) {
          curQ.wrongCount = (curQ.wrongCount || 0) + 1;
        }

        const nextRedAns = pObj.team === 'RED' && !prev.redAnsweredIds.includes(pObj.id)
          ? [...prev.redAnsweredIds, pObj.id]
          : prev.redAnsweredIds;
        const nextBlueAns = pObj.team === 'BLUE' && !prev.blueAnsweredIds.includes(pObj.id)
          ? [...prev.blueAnsweredIds, pObj.id]
          : prev.blueAnsweredIds;

        // Mức phạt chuẩn cược bản lĩnh:
        // • An Toàn (x1): 0đ (không trừ)
        // • Liều Lĩnh (x1.5): trừ 300đ
        // • Tất Tay (x2.5): trừ 800đ
        const penalty = wager === 2.5 ? 800 : wager === 1.5 ? 300 : 0;

        if (prev.gameType === 'BELL') {
          AudioFX.freezeCrack();
          pObj.lives = typeof d.lives === 'number' ? d.lives : Math.max(0, (pObj.lives ?? 3) - 1);
          // Trừ phạt trên sổ HOST — không nhận d.totalScore phía HS (sự cố 17/11/2026).
          pObj.fastScore = Math.max(0, (pObj.fastScore || 0) - penalty);
          pObj.lastDelta = -penalty;
          if (pObj.lives <= 0) {
            pObj.eliminated = true;
            pObj.role = 'SPECTATOR';
          }

          CloudNetwork.sendMessage({
            type: 'PLAYER_LIVES_SYNC',
            playerId: pObj.id,
            lives: pObj.lives,
            streak: 0,
            eliminated: pObj.eliminated,
            fastScore: pObj.fastScore,
            bonusAwarded: false
          });
        } else if (prev.gameType === 'FAST' || prev.gameType === 'BOSS') {
          AudioFX.freezeCrack();
          pObj.lives = 3;
          pObj.eliminated = false;
          // Trừ phạt trên sổ HOST — không nhận d.totalScore phía HS (sự cố 17/11/2026).
          pObj.fastScore = (pObj.fastScore || 0) - penalty;
          pObj.lastDelta = -penalty;

          CloudNetwork.sendMessage({
            type: 'PLAYER_LIVES_SYNC',
            playerId: pObj.id,
            lives: 3,
            streak: 0,
            eliminated: false,
            fastScore: pObj.fastScore,
            bonusAwarded: false
          });
        } else {
          // Trò Kéo Co (TUG)
          pObj.lives = 3;
          pObj.eliminated = false;
          // Trừ phạt trên sổ HOST — không nhận d.totalScore phía HS (sự cố 17/11/2026).
          pObj.fastScore = (pObj.fastScore || 0) - penalty;
          pObj.lastDelta = -penalty;
          if (prev.gameType === 'TUG') {
            AudioFX.freezeCrack();
            const freezeMs = wager === 2.5 ? 4000 : wager === 1.5 ? 3000 : 2000;
            pObj.freeze = Date.now() + freezeMs;
          }
        }

        return {
          ...prev,
          redAnsweredIds: nextRedAns,
          blueAnsweredIds: nextBlueAns,
          redPlayers: [...prev.redPlayers],
          bluePlayers: [...prev.bluePlayers]
        };
      });
    }
  };

  const handleHostIncomingMessageRef = useRef(handleHostIncomingMessage);
  handleHostIncomingMessageRef.current = handleHostIncomingMessage;

  // Connect cloud continuously when Teacher is in Setup, Host Arena, or testing Student mode (Thử HS) so students never disconnect
  useEffect(() => {
    if (isDirectStudent) {
      CloudNetwork.setHostMessageListener(null);
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }

    CloudNetwork.setHostMessageListener((msg) => handleHostIncomingMessageRef.current(msg));

    // Đợt 8 (4C): phía HOST là phía duy nhất quyết định broker (công bố broker epoch)
    // và ký lệnh điều khiển bằng KHOÁ PHÒNG của phòng này (sinh 1 lần, lưu theo phòng;
    // link QR nhúng &k=<khoá> để HS kiểm tra chữ ký). Đặt TRƯỚC connect/gửi lệnh.
    CloudNetwork.setBrokerRole('HOST');
    CloudNetwork.setRoomKey(getOrCreateRoomKey(activeRoomId));

    if (view !== 'STUDENT_MOBILE') {
      CloudNetwork.connect(
        activeRoomId,
        (msg) => handleHostIncomingMessageRef.current(msg),
        () => {
          broadcastHeartbeatRef.current(matchStateRef.current, quizListRef.current, activeRoomId);
        }
      );
    }

    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    heartbeatRef.current = setInterval(() => {
      broadcastHeartbeatRef.current(matchStateRef.current, quizListRef.current, activeRoomId);
    }, 1200);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [view, activeRoomId, isDirectStudent]);

  // Toggle fullscreen helper
  const handleToggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Export presentation slide
  const handleExportHTMLSlide = () => {
    const curSubj = subjectsDB[currentSubjectKey];
    exportColorfulPresentationHTML(quizList, curSubj ? curSubj.name : 'Đấu Trường 3D');
  };

  // Print PDF evidence
  const handlePrintPDFEvidence = () => {
    const curSubj = subjectsDB[currentSubjectKey];
    printEvidenceColorfulPDF(quizList, curSubj ? curSubj.name : 'Đấu Trường 3D');
  };

  // Export JSON
  // Đợt 6 (2.2) ĐÃ KIỂM CHỨNG: serialize NGUYÊN mảng QuizItem, không qua bước lọc trường nào
  // -> imageUri/audioUri/explanation (và mọi trường khác của QuizItem) có trong dữ liệu xuất
  // mỗi khi câu hỏi mang các trường đó. Đừng thêm bước map/lọc ở đây kẻo làm rơi trường.
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(quizList, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `DeThi_${currentSubjectKey}_GDPT2018.json`);
    dlAnchorElem.click();
  };

  // Import JSON
  const handleImportJSON = (imported: QuizItem[]) => {
    const normalized = imported.map((it, idx) => ({ ...it, qid: idx, rightCount: 0, wrongCount: 0 }));
    setQuizList(normalized);
    quizListRef.current = normalized;
    const cur = subjectsDB[currentSubjectKey];
    if (cur) {
      const nextDB = {
        ...subjectsDB,
        [currentSubjectKey]: {
          ...cur,
          html: imported.map((it, i) => `<div>Câu ${i + 1}: ${it.q}</div>` + it.opts.map((o, oi) => oi === it.correct ? `<div><u>${String.fromCharCode(65 + oi)}</u>. ${o}</div>` : `<div>${String.fromCharCode(65 + oi)}. ${o}</div>`).join('')).join('<br>')
        }
      };
      saveSubjects(nextDB);
    }
  };

  const effectiveStudentRoom = urlParams.get('r') || urlParams.get('room') || activeRoomId;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {view === 'TEACHER_SETUP' && (
        <TopAuthorBanner
          onToggleFullScreen={handleToggleFullScreen}
          onOpenKeyModal={() => setShowKeyModal(true)}
          onOpenNationalDossier={() => setShowNationalDossier(true)}
          onOpenCloudSync={() => handleOpenCloudSync('GOOGLE')}
          onOpenCoffeeModal={() => setShowCoffeeModal(true)}
        />
      )}

      {view === 'TEACHER_SETUP' && (
        <TeacherSetupView
          subjectsDB={subjectsDB}
          currentSubjectKey={currentSubjectKey}
          gameType={gameType}
          joinMode={joinMode}
          maxPerTeam={maxPerTeam}
          matchSettings={matchSettings}
          onUpdateSettings={setMatchSettings}
          onSelectSubject={handleSelectSubject}
          onSelectGameType={handleSelectGameType}
          onSetJoinMode={setJoinMode}
          onSetMaxPerTeam={setMaxPerTeam}
          onAddSubject={handleAddSubject}
          onSaveCurrentQuizToSubject={handleSaveCurrentQuizToSubject}
          onSyncQuizLive={handleSyncQuizLive}
          onDeleteCurrentSubject={handleDeleteCurrentSubject}
          onLaunchArena={handleLaunchArena}
          onSwitchToStudentMode={() => setView('STUDENT_MOBILE')}
          onExportHTMLSlide={handleExportHTMLSlide}
          onPrintPDFEvidence={handlePrintPDFEvidence}
          onExportJSON={handleExportJSON}
          onImportJSON={handleImportJSON}
          onOpenKeyModal={() => setShowKeyModal(true)}
          onOpenCloudSync={handleOpenCloudSync}
          onOpenNationalDossier={() => setShowNationalDossier(true)}
          activeRoomId={activeRoomId}
          connectedStudentCount={matchState.redPlayers.length + matchState.bluePlayers.length}
          connectedPlayers={[...matchState.redPlayers, ...matchState.bluePlayers]}
          onNewSession={handleCreateNewSession}
          onResetClass={handleResetCurrentClass}
          onOpenCoffeeModal={() => setShowCoffeeModal(true)}
        />
      )}

      {view === 'HOST_ARENA' && (
        <HostArenaView
          matchState={matchState}
          quizList={quizList}
          activeRoomId={activeRoomId}
          onUpdateMatchState={handleUpdateMatchStateSync}
          onUpdateQuizList={setQuizList}
          onSwitchGameType={handleSelectGameType}
          onReturnToSetup={() => setView('TEACHER_SETUP')}
          onToggleFullScreen={handleToggleFullScreen}
          onExportHTMLSlide={handleExportHTMLSlide}
          onPrintPDFEvidence={handlePrintPDFEvidence}
          onOpenKeyModal={() => setShowKeyModal(true)}
          onOpenNationalDossier={() => setShowNationalDossier(true)}
          onNewSession={handleCreateNewSession}
          onResetClass={handleResetCurrentClass}
        />
      )}

      {view === 'STUDENT_MOBILE' && (
        <StudentMobileView
          initialRoomId={effectiveStudentRoom}
          initialTeam={studentTeamParam}
          initialGameType={gameType}
          initialSubjectKey={currentSubjectKey}
          initialQuizList={quizList}
          onExitToSetup={() => setView('TEACHER_SETUP')}
        />
      )}

      {/* Google Gemini API Key Configuration Modal */}
      <GeminiKeyModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
      />

      {/* Hồ Sơ Thuyết Minh & Phân Tích Ma Trận Cấp Quốc Gia */}
      <NationalJuryDossierModal
        isOpen={showNationalDossier}
        onClose={() => setShowNationalDossier(false)}
        quizList={quizList}
        matchState={matchState}
        subjectName={subjectsDB[currentSubjectKey]?.name || 'Đấu Trường 3D'}
        activeRoomId={activeRoomId}
        onExportHTMLSlide={handleExportHTMLSlide}
        onPrintPDFEvidence={handlePrintPDFEvidence}
      />

      {/* Trung Tâm Đồng Bộ & Sao Lưu Đám Mây (Google Account & Mật Khẩu Ẩn Danh) */}
      <CloudSyncModal
        isOpen={showCloudSyncModal}
        onClose={() => setShowCloudSyncModal(false)}
        subjectsDB={subjectsDB}
        currentSubjectKey={currentSubjectKey}
        matchSettings={matchSettings}
        activeQuizList={quizList}
        onApplyBackup={handleApplyBackup}
        initialTab={cloudSyncInitialTab}
      />

      {/* Hộp Thoại Popup Mời Thầy Khải Ly Cà Phê (Chỉ hiện ở màn hình cài đặt) */}
      <BuyMeCoffeeModal
        isOpen={view === 'TEACHER_SETUP' && showCoffeeModal}
        onClose={() => setShowCoffeeModal(false)}
      />
    </div>
  );
};
