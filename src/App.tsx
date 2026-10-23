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
import { TopAuthorBanner } from './components/TopAuthorBanner';
import { TeacherSetupView } from './components/TeacherSetupView';
import { HostArenaView } from './components/HostArenaView';
import { StudentMobileView } from './components/StudentMobileView';
import { GeminiKeyModal } from './components/GeminiKeyModal';
import { NationalJuryDossierModal } from './components/NationalJuryDossierModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { CloudBackupData } from './types';
import { getStoredSyncProfile, saveBackupToCloud, prepareBackupPayload } from './services/cloudSync';
import { exportColorfulPresentationHTML, printEvidenceColorfulPDF } from './utils/exportEvidence';

export const App: React.FC = () => {
  // Query parameters check
  const [urlParams] = useState(() => new URLSearchParams(window.location.search));
  const isDirectStudent = urlParams.get('role') === 'player' || urlParams.has('r') || urlParams.has('room');

  const [view, setView] = useState<'TEACHER_SETUP' | 'HOST_ARENA' | 'STUDENT_MOBILE'>(
    isDirectStudent ? 'STUDENT_MOBILE' : 'TEACHER_SETUP'
  );

  // Initial student params from URL
  const studentRoomParam = urlParams.get('r') || urlParams.get('room') || '12345';
  const studentTeamParam = (urlParams.get('t') === 'B' || urlParams.get('team') === 'BLUE') ? 'BLUE' : 'RED';
  const studentGmParam: GamePlayType = (urlParams.get('gm') === 'F' || urlParams.get('gm') === 'FAST')
    ? 'FAST'
    : (urlParams.get('gm') === 'B' || urlParams.get('gm') === 'BELL')
    ? 'BELL'
    : (urlParams.get('gm') === 'BOSS')
    ? 'BOSS'
    : 'TUG';
  const studentSubjParam = urlParams.get('subj') || 'ALL_SUBJ';

  // Teacher & Host state
  const [subjectsDB, setSubjectsDB] = useState<Record<string, SubjectData>>(() => getInitialSubjects());
  const [currentSubjectKey, setCurrentSubjectKey] = useState<string>('BIO');
  const [gameType, setGameType] = useState<GamePlayType>(studentGmParam);
  const [joinMode, setJoinMode] = useState<JoinMode>('AUTO_ALL');
  const [maxPerTeam, setMaxPerTeam] = useState<number>(5);
  const [activeRoomId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('kc3d_host_room_id') || sessionStorage.getItem('kc3d_host_room_id');
      if (saved && /^\d{5}$/.test(saved)) {
        localStorage.setItem('kc3d_host_room_id', saved);
        sessionStorage.setItem('kc3d_host_room_id', saved);
        return saved;
      }
      const generated = String(Math.floor(10000 + Math.random() * 90000));
      localStorage.setItem('kc3d_host_room_id', generated);
      sessionStorage.setItem('kc3d_host_room_id', generated);
      return generated;
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
    bossMaxHP: 1000
  });

  // Google Gemini API Key Modal & National Contest Dossier Modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showNationalDossier, setShowNationalDossier] = useState(false);

  // Cloud Sync & Backup Modal
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);
  const [cloudSyncInitialTab, setCloudSyncInitialTab] = useState<'GOOGLE' | 'PASSWORD'>('GOOGLE');

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

  const [matchState, setMatchState] = useState<MatchState>({
    gameType: 'TUG',
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
      bossMaxHP: 1000
    }
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

  const answeredQKeysRef = useRef<Set<string>>(new Set());
  const firstBloodByQRef = useRef<Set<number>>(new Set());
  const lastEnterAckMapRef = useRef<Record<string, number>>({});

  const handleSelectGameType = (newGameType: GamePlayType) => {
    answeredQKeysRef.current.clear();
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
        maxBossHP: matchSettings.bossMaxHP || 1000
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

  // Launch Arena (Chuẩn bị vào sàn đấu - Giữ nguyên mã phòng, giữ nguyên học sinh đã vào và đồng bộ đúng thứ tự câu hỏi của giáo viên)
  const handleLaunchArena = (parsedQuiz: QuizItem[]) => {
    answeredQKeysRef.current.clear();
    firstBloodByQRef.current.clear();
    const normalizedDeck: QuizItem[] = parsedQuiz.map((item, idx) => ({
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
        broadcastHeartbeatRef.current(nextMS, normalizedDeck, activeRoomId);
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

  // Broadcast host heartbeat
  const broadcastHeartbeat = (currentMS: MatchState, currentQ: QuizItem[], roomId: string) => {
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

    try {
      localStorage.setItem(
        `kc3d_live_sync_${roomId}`,
        JSON.stringify({
          roomId,
          gameType: currentMS.gameType,
          status: currentMS.status,
          globalQIndex: safeIdx,
          question: activeQWithMeta,
          quiz: activeDeck,
          subj: currentSubjectKeyRef.current,
          updatedAt: Date.now()
        })
      );
    } catch {}

    CloudNetwork.sendMessage({
      type: 'HOST_HEARTBEAT',
      gameType: currentMS.gameType,
      status: currentMS.status,
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
      question: activeQWithMeta,
      quiz: activeDeck
    });
  };

  const broadcastHeartbeatRef = useRef(broadcastHeartbeat);
  broadcastHeartbeatRef.current = broadcastHeartbeat;

  // Host incoming message handler
  const handleHostIncomingMessage = (d: CloudMessage) => {
    if (!d || !d.type) return;

    if (d.type === 'MATCH_START' || d.type === 'GAME_SWITCH' || d.type === 'GAME_SWITCHED') {
      answeredQKeysRef.current.clear();
      firstBloodByQRef.current.clear();
      return;
    }

    if (d.type === 'AUTO_ENTER_ARENA' || d.type === 'PLAYER_READY_ROPE' || d.type === 'PLAYER_FINISH_QUIZ') {
      const isReady = d.type === 'PLAYER_READY_ROPE' || d.type === 'PLAYER_FINISH_QUIZ';
      setMatchState(prev => {
        const existingRedIdx = prev.redPlayers.findIndex(x => x.id === d.playerId);
        const existingBlueIdx = prev.bluePlayers.findIndex(x => x.id === d.playerId);
        const existing = existingRedIdx !== -1 ? prev.redPlayers[existingRedIdx] : (existingBlueIdx !== -1 ? prev.bluePlayers[existingBlueIdx] : null);

        if (existing) {
          const incomingName = (d.playerName || '').trim();
          const isIncomingGeneric = !incomingName || incomingName === 'Học sinh' || /^HS\s+\d+$/i.test(incomingName);
          const hasRealExistingName = existing.label && existing.label !== 'Học sinh' && !/^HS\s+\d+$/i.test(existing.label);

          const nextLabel = (!isIncomingGeneric && incomingName)
            ? incomingName
            : (hasRealExistingName ? existing.label : (incomingName || existing.label));

          const nextReady = existing.ready || isReady;
          if (isReady && !existing.ready) {
            AudioFX.stepInRope();
          }

          const nextFastScore = d.type === 'PLAYER_FINISH_QUIZ' && typeof d.savedScore === 'number'
            ? d.savedScore
            : ((existing.correct || 0) > 0 || (existing.wrongTotal || 0) > 0
                ? existing.fastScore
                : (typeof d.savedScore === 'number' ? d.savedScore : existing.fastScore));
          const nextCorrect = Math.max(existing.correct || 0, typeof d.savedCorrect === 'number' ? d.savedCorrect : 0);

          const updatedPlayer: Player = {
            ...existing,
            label: nextLabel,
            avatar: d.avatar || existing.avatar,
            ready: nextReady,
            fastScore: nextFastScore,
            correct: nextCorrect
          };

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
            existing.correct !== nextCorrect;

          // Chỉ phản hồi ENTER_CONFIRMED khi có thay đổi hoặc cách nhau > 8 giây để không làm nghẽn mạng khi mở 40+ Tab
          if (d.type !== 'PLAYER_FINISH_QUIZ' && (playerChanged || now - lastAckAt > 8000)) {
            lastEnterAckMapRef.current[updatedPlayer.id] = now;
            CloudNetwork.sendMessage({
              type: 'ENTER_CONFIRMED',
              playerId: updatedPlayer.id,
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
              quiz: currentList,
              question: activeQWithMeta
            });
          }

          if (!playerChanged) {
            return prev;
          }

          const nextRed = existingRedIdx !== -1
            ? prev.redPlayers.map((p, idx) => idx === existingRedIdx ? updatedPlayer : p)
            : prev.redPlayers;
          const nextBlue = existingBlueIdx !== -1
            ? prev.bluePlayers.map((p, idx) => idx === existingBlueIdx ? updatedPlayer : p)
            : prev.bluePlayers;

          return {
            ...prev,
            redPlayers: nextRed,
            bluePlayers: nextBlue
          };
        }

        // Cho phép mở rộng dung lượng phòng lên tới 500+ học sinh để phục vụ test tải đa Tab / Ẩn Danh
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
          const totalNow = prev.redPlayers.length + prev.bluePlayers.length + 1;
          const defaultLabel = `HS ${totalNow}`;
          const finalName = (d.playerName && d.playerName.trim()) ? d.playerName.trim() : defaultLabel;
          const newP: Player = {
            id: d.playerId || 'hs_' + Math.random(),
            label: finalName,
            team: assignedTeam,
            ready: isReady,
            spawned: false,
            correct: typeof d.savedCorrect === 'number' ? d.savedCorrect : 0,
            freeze: 0,
            role: 'PULLER',
            lives: 3,
            wrongTotal: 0,
            streak: 0,
            eliminated: false,
            fastScore: typeof d.savedScore === 'number' ? d.savedScore : 0,
            avatar: d.avatar
          };

          const nextRed = assignedTeam === 'RED' ? [...prev.redPlayers, newP] : prev.redPlayers;
          const nextBlue = assignedTeam === 'BLUE' ? [...prev.bluePlayers, newP] : prev.bluePlayers;

          CloudNetwork.sendMessage({
            type: 'ENTER_CONFIRMED',
            playerId: newP.id,
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
            quiz: currentList,
            question: activeQWithMeta
          });

          return { ...prev, redPlayers: nextRed, bluePlayers: nextBlue };
        } else {
          CloudNetwork.sendMessage({
            type: 'ENTER_CONFIRMED',
            playerId: d.playerId,
            team: assignedTeam,
            role: 'SPECTATOR',
            label: d.playerName || 'Khán giả',
            gameType: prev.gameType,
            matchStatus: prev.status,
            globalQIndex: safeIdx,
            lives: 0,
            eliminated: true,
            quiz: currentList,
            question: activeQWithMeta
          });
          return { ...prev, spectators: prev.spectators + 1 };
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
        const pObj = allP.find(x => x.id === d.playerId);
        if (!pObj || (prev.gameType === 'BELL' && pObj.eliminated)) return prev;

        const targetQIdx = typeof d.globalQIndex === 'number' ? d.globalQIndex : prev.globalQIndex;
        const answerKey = `${pObj.id}_q_${targetQIdx}`;
        if (answeredQKeysRef.current.has(answerKey)) return prev;
        answeredQKeysRef.current.add(answerKey);

        // Kiểm tra Tia Chớp Đầu Tiên (First Blood) cho câu hỏi này
        const isFirstBlood = !firstBloodByQRef.current.has(targetQIdx);
        if (isFirstBlood) {
          firstBloodByQRef.current.add(targetQIdx);
          AudioFX.firstBloodStrike();
          pObj.firstBloodCount = (pObj.firstBloodCount || 0) + 1;
        } else {
          AudioFX.pullHeave();
        }

        pObj.correct = (pObj.correct || 0) + 1;
        if (typeof d.savedCorrect === 'number' && d.savedCorrect > pObj.correct) {
          pObj.correct = d.savedCorrect;
        }
        pObj.streak = (pObj.streak || 0) + 1;

        const studentElapsedSec = typeof d.elapsedSec === 'number' ? d.elapsedSec : 2.0;
        const wager = d.wagerLevel || 1;
        const firstBloodBonus = isFirstBlood ? 500 : 0;
        const worldEventMultiplier = prev.activeWorldEvent === 'GOLDEN_X2' ? 2 : 1;
        const baseGained = typeof d.gainedPts === 'number' && d.gainedPts > 0 ? d.gainedPts : 1000;
        const gainedScore = Math.round(baseGained * worldEventMultiplier) + firstBloodBonus;

        pObj.fastScore = typeof d.totalScore === 'number'
          ? d.totalScore + firstBloodBonus + (worldEventMultiplier > 1 ? baseGained : 0)
          : (pObj.fastScore || 0) + gainedScore;
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
        const pObj = allP.find(x => x.id === d.playerId);
        if (!pObj) return prev;

        const delta = typeof d.bonusScoreDelta === 'number' ? d.bonusScoreDelta : 0;
        pObj.fastScore = typeof d.totalScore === 'number' ? d.totalScore : (pObj.fastScore || 0) + delta;
        if (typeof d.lives === 'number' && prev.gameType === 'BELL') {
          pObj.lives = Math.min(5, d.lives);
        }

        // Nếu mở trúng Siêu Đạo Chích (STEAL_LEADER), hút 500đ từ người dẫn đầu đối phương
        if (d.powerUpUsed === ('STEAL_LEADER' as any)) {
          const others = allP.filter(x => x.id !== pObj.id && (x.fastScore || 0) > 0).sort((a, b) => (b.fastScore || 0) - (a.fastScore || 0));
          if (others.length > 0) {
            const leader = others[0];
            leader.fastScore = Math.max(0, (leader.fastScore || 0) - 500);
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
            text: `🎁 [RƯƠNG BÍ ẨN] ${pObj.label}: ${d.mysteryRewardText}`,
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
        const pObj = allP.find(x => x.id === d.playerId);
        if (!pObj || (prev.gameType === 'BELL' && pObj.eliminated)) return prev;

        const targetQIdx = typeof d.globalQIndex === 'number' ? d.globalQIndex : prev.globalQIndex;
        const answerKey = `${pObj.id}_q_${targetQIdx}`;
        if (answeredQKeysRef.current.has(answerKey)) return prev;
        answeredQKeysRef.current.add(answerKey);

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

        // CHỈ CÓ RUNG CHUÔNG VÀNG (BELL) mới bị mất mạng khi trả lời sai (Cược Tất Tay x2.5 mà sai thì mất 2 mạng!)
        if (prev.gameType === 'BELL') {
          AudioFX.freezeCrack();
          const lifeLoss = wager === 2.5 ? 2 : 1;
          pObj.lives = typeof d.lives === 'number' ? d.lives : Math.max(0, (pObj.lives ?? 3) - lifeLoss);
          pObj.lastDelta = 0;
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
          // TRÒ AI NHANH HƠN (FAST) VÀ ĐÁNH BOSS (BOSS): Trừ điểm theo mức cược (An toàn -1000, Liều lĩnh -1500, Tất tay -2000)
          AudioFX.freezeCrack();
          const penalty = wager === 2.5 ? 2000 : wager === 1.5 ? 1500 : 1000;
          pObj.lives = 3;
          pObj.eliminated = false;
          pObj.fastScore = typeof d.totalScore === 'number' ? d.totalScore : (pObj.fastScore || 0) - penalty;
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
          // Trò Kéo Co (TUG): Câu sai bị đóng băng (3s -> 6s tùy mức cược)
          pObj.lives = 3;
          pObj.eliminated = false;
          pObj.lastDelta = 0;
          if (prev.gameType === 'TUG') {
            AudioFX.freezeCrack();
            const freezeMs = wager === 2.5 ? 5500 : wager === 1.5 ? 4000 : 3000;
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

  // Connect cloud continuously when Teacher is in Setup or Host Arena so students never disconnect across game switches
  useEffect(() => {
    if (view === 'STUDENT_MOBILE') {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }

    CloudNetwork.connect(
      activeRoomId,
      (msg) => handleHostIncomingMessageRef.current(msg),
      () => {
        broadcastHeartbeatRef.current(matchStateRef.current, quizListRef.current, activeRoomId);
      }
    );

    heartbeatRef.current = setInterval(() => {
      broadcastHeartbeatRef.current(matchStateRef.current, quizListRef.current, activeRoomId);
    }, 1200);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [view === 'STUDENT_MOBILE', activeRoomId]);

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
        />
      )}

      {view === 'HOST_ARENA' && (
        <HostArenaView
          matchState={matchState}
          quizList={quizList}
          activeRoomId={activeRoomId}
          onUpdateMatchState={setMatchState}
          onUpdateQuizList={setQuizList}
          onSwitchGameType={handleSelectGameType}
          onReturnToSetup={() => setView('TEACHER_SETUP')}
          onToggleFullScreen={handleToggleFullScreen}
          onExportHTMLSlide={handleExportHTMLSlide}
          onPrintPDFEvidence={handlePrintPDFEvidence}
          onOpenKeyModal={() => setShowKeyModal(true)}
          onOpenNationalDossier={() => setShowNationalDossier(true)}
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
    </div>
  );
};
