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
    roomCapacity: 50,
    max3DRenderCount: 20,
    questionDurationSec: 30,
    bossMaxHP: 1000
  });

  // Google Gemini API Key Modal & National Contest Dossier Modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showNationalDossier, setShowNationalDossier] = useState(false);

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
      roomCapacity: 50,
      max3DRenderCount: 20,
      questionDurationSec: 30,
      bossMaxHP: 1000
    }
  });

  const heartbeatRef = useRef<any>(null);

  // Save subjects database changes to localStorage
  const saveSubjects = (newDB: Record<string, SubjectData>) => {
    setSubjectsDB(newDB);
    try {
      localStorage.setItem('thpt_mangthit_subjects_v10', JSON.stringify(newDB));
    } catch (e) {}
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
  };

  const handleSelectGameType = (newGameType: GamePlayType) => {
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
    const rawActiveQ = activeDeck[currentMS.globalQIndex % (activeDeck.length || 1)];
    const activeQWithMeta = rawActiveQ ? {
      ...rawActiveQ,
      qIndex: currentMS.globalQIndex,
      totalQuestions: activeDeck.length
    } : undefined;

    try {
      localStorage.setItem(
        `kc3d_live_sync_${roomId}`,
        JSON.stringify({
          roomId,
          gameType: currentMS.gameType,
          status: currentMS.status,
          globalQIndex: currentMS.globalQIndex,
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
      globalQIndex: currentMS.globalQIndex,
      redDoneCount: currentMS.redAnsweredIds.length,
      redTotalMembers: Math.max(currentMS.redPlayers.length, 1),
      blueDoneCount: currentMS.blueAnsweredIds.length,
      blueTotalMembers: Math.max(currentMS.bluePlayers.length, 1),
      bellAliveCount: aliveCount,
      bellTotalCount: allP.length,
      bossHP: currentMS.bossHP,
      maxBossHP: currentMS.maxBossHP,
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

    if (d.type === 'AUTO_ENTER_ARENA' || d.type === 'PLAYER_READY_ROPE') {
      const isReady = d.type === 'PLAYER_READY_ROPE';
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

          const updatedPlayer: Player = {
            ...existing,
            label: nextLabel,
            avatar: d.avatar || existing.avatar,
            ready: nextReady,
            fastScore: (existing.correct || 0) > 0 || (existing.wrongTotal || 0) > 0
              ? existing.fastScore
              : (typeof d.savedScore === 'number' ? d.savedScore : existing.fastScore),
            correct: Math.max(existing.correct || 0, typeof d.savedCorrect === 'number' ? d.savedCorrect : 0)
          };

          const currentList = quizListRef.current && quizListRef.current.length > 0 ? quizListRef.current : quizList;
          const rawActiveQ = currentList[prev.globalQIndex % (currentList.length || 1)];
          const activeQWithMeta = rawActiveQ ? {
            ...rawActiveQ,
            qIndex: prev.globalQIndex,
            totalQuestions: currentList.length
          } : null;

          // Crucial: Send confirmation back to student so their phone restores full session & score
          CloudNetwork.sendMessage({
            type: 'ENTER_CONFIRMED',
            playerId: updatedPlayer.id,
            team: updatedPlayer.team,
            role: updatedPlayer.role,
            label: updatedPlayer.label,
            gameType: prev.gameType,
            matchStatus: prev.status,
            globalQIndex: prev.globalQIndex,
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

        // Check room capacity limit
        const totalP = prev.redPlayers.length + prev.bluePlayers.length;
        if (totalP >= (prev.settings?.roomCapacity || 50)) {
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
        const rawActiveQ = currentList[prev.globalQIndex % (currentList.length || 1)];
        const activeQWithMeta = rawActiveQ ? {
          ...rawActiveQ,
          qIndex: prev.globalQIndex,
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
            globalQIndex: prev.globalQIndex,
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
            globalQIndex: prev.globalQIndex,
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
        // Không cho phép nộp lại nếu đã trả lời câu hỏi này rồi
        if (prev.redAnsweredIds.includes(pObj.id) || prev.blueAnsweredIds.includes(pObj.id)) return prev;

        AudioFX.pullHeave();
        pObj.correct = (pObj.correct || 0) + 1;
        pObj.streak = (pObj.streak || 0) + 1;

        const studentElapsedSec = typeof d.elapsedSec === 'number' ? d.elapsedSec : 2.0;
        const gainedScore = typeof d.gainedPts === 'number' && d.gainedPts > 0 ? d.gainedPts : 1000;

        pObj.fastScore = (pObj.fastScore || 0) + gainedScore;
        pObj.lastDelta = gainedScore;
        pObj.lastTimeSec = studentElapsedSec;
        pObj.totalTimeMs = (pObj.totalTimeMs || 0) + Math.round(studentElapsedSec * 1000);

        // Record question rightCount in ref without re-triggering quizList effects mid-question
        const activeDeck = quizListRef.current && quizListRef.current.length > 0 ? quizListRef.current : quizList;
        const curQ = activeDeck[prev.globalQIndex % (activeDeck.length || 1)];
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
          const dmg = 150;
          const nextBossHP = Math.max(0, (prev.bossHP || 1000) - dmg);
          let nextStatus: MatchStatus = prev.status;

          if (nextBossHP <= 0) {
            AudioFX.winFanfare();
            nextStatus = 'ENDED';
          }

          return {
            ...prev,
            bossHP: nextBossHP,
            status: nextStatus,
            redAnsweredIds: nextRedAns,
            blueAnsweredIds: nextBlueAns,
            bossLastAttack: `Chiến binh ${pObj.label} gây -${dmg} HP Boss! (+${gainedScore}đ • Tổng: ${pObj.fastScore}đ)`,
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
            qIndex: prev.globalQIndex,
            isCorrect: true,
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
            redPlayers: [...prev.redPlayers],
            bluePlayers: [...prev.bluePlayers]
          };
        }

        // TUG mode (Kéo Co 3D): Kéo dây theo lực trả lời đúng, KHÔNG ngắt ngang đồng hồ 30 giây của câu hỏi đang chạy
        const pullPower = d.gainedPts && d.gainedPts >= 1500 ? 1.2 : 0.8;
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
        // Không cho phép chọn lại trên cùng 1 câu hỏi
        if (prev.redAnsweredIds.includes(pObj.id) || prev.blueAnsweredIds.includes(pObj.id)) return prev;

        pObj.wrongTotal = (pObj.wrongTotal || 0) + 1;
        pObj.streak = 0;

        const activeDeck = quizListRef.current && quizListRef.current.length > 0 ? quizListRef.current : quizList;
        const curQ = activeDeck[prev.globalQIndex % (activeDeck.length || 1)];
        if (curQ) {
          curQ.wrongCount = (curQ.wrongCount || 0) + 1;
        }

        const nextRedAns = pObj.team === 'RED' && !prev.redAnsweredIds.includes(pObj.id)
          ? [...prev.redAnsweredIds, pObj.id]
          : prev.redAnsweredIds;
        const nextBlueAns = pObj.team === 'BLUE' && !prev.blueAnsweredIds.includes(pObj.id)
          ? [...prev.blueAnsweredIds, pObj.id]
          : prev.blueAnsweredIds;

        // CHỈ CÓ RUNG CHUÔNG VÀNG (BELL) mới bị mất 1 mạng khi trả lời sai và hết 3 mạng thì rời cuộc chơi thành khán giả cổ vũ
        if (prev.gameType === 'BELL') {
          AudioFX.freezeCrack();
          pObj.lives = Math.max(0, (pObj.lives ?? 3) - 1);
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
          // TRÒ AI NHANH HƠN (FAST) VÀ ĐÁNH BOSS (BOSS): Mỗi câu chọn sai trừ 1000 điểm! (Số câu đúng ghi sổ điểm GV vẫn giữ nguyên)
          AudioFX.freezeCrack();
          pObj.lives = 3;
          pObj.eliminated = false;
          pObj.fastScore = (pObj.fastScore || 0) - 1000;
          pObj.lastDelta = -1000;

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
          // Trò Kéo Co (TUG): Câu sai không bị trừ điểm, không bị trừ mạng
          pObj.lives = 3;
          pObj.eliminated = false;
          pObj.lastDelta = 0;
          if (prev.gameType === 'TUG') {
            AudioFX.freezeCrack();
            pObj.freeze = Date.now() + 3000;
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
    </div>
  );
};
