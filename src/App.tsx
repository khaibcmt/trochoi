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
  const [activeRoomId, setActiveRoomId] = useState<string>(() => String(Math.floor(10000 + Math.random() * 90000)));
  const [quizList, setQuizList] = useState<QuizItem[]>(() => getPresetQuizBySubject('BIO'));

  // 4 Core Match Settings
  const [matchSettings, setMatchSettings] = useState<MatchSettings>({
    roomCapacity: 50,
    max3DRenderCount: 20,
    questionDurationSec: 30,
    bossMaxHP: 1000
  });

  // Google Gemini API Key Modal
  const [showKeyModal, setShowKeyModal] = useState(false);

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
      localStorage.setItem('thpt_mangthit_subjects_v9', JSON.stringify(newDB));
    } catch (e) {}
  };

  const handleSelectSubject = (key: string) => {
    if (subjectsDB[key]) {
      setCurrentSubjectKey(key);
    }
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
  };

  const handleSaveCurrentQuizToSubject = (parsedQuiz: QuizItem[], html: string) => {
    const current = subjectsDB[currentSubjectKey];
    if (!current) return;
    const baseName = current.name.replace(/\s*\(\d+\s*câu\)/i, '');
    const updatedSubj: SubjectData = {
      ...current,
      html,
      name: `${baseName} (${parsedQuiz.length} câu)`
    };
    const nextDB = { ...subjectsDB, [currentSubjectKey]: updatedSubj };
    saveSubjects(nextDB);
    alert(`✅ Đã lưu thành công ${parsedQuiz.length} câu hỏi vào môn "${updatedSubj.name}"!`);
  };

  const handleDeleteCurrentSubject = () => {
    if (subjectsDB[currentSubjectKey]?.fixed) return;
    if (!confirm(`Bạn có chắc muốn xóa môn "${subjectsDB[currentSubjectKey]?.name}" không?`)) return;
    const nextDB = { ...subjectsDB };
    delete nextDB[currentSubjectKey];
    saveSubjects(nextDB);
    setCurrentSubjectKey('BIO');
  };

  // Launch Arena
  const handleLaunchArena = (parsedQuiz: QuizItem[]) => {
    const shuffled = shuffleQuestionOrder(parsedQuiz);
    setQuizList(shuffled);
    const newRoom = String(Math.floor(10000 + Math.random() * 90000));
    setActiveRoomId(newRoom);

    setMatchState({
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
      redPlayers: [],
      bluePlayers: [],
      spectators: 0,
      bossHP: matchSettings.bossMaxHP || 1000,
      maxBossHP: matchSettings.bossMaxHP || 1000,
      settings: matchSettings
    });

    setView('HOST_ARENA');
  };

  // Broadcast host heartbeat
  const broadcastHeartbeat = (currentMS: MatchState, currentQ: QuizItem[], roomId: string) => {
    const allP = [...currentMS.redPlayers, ...currentMS.bluePlayers];
    const aliveCount = allP.filter(x => !x.eliminated).length;
    const activeQ = currentQ[currentMS.globalQIndex % (currentQ.length || 1)];

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
      subj: currentSubjectKey,
      quiz: currentQ,
      question: activeQ
    });
  };

  // Connect cloud when entering HOST_ARENA
  useEffect(() => {
    if (view !== 'HOST_ARENA') {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }

    CloudNetwork.connect(
      activeRoomId,
      handleHostIncomingMessage,
      () => {
        broadcastHeartbeat(matchState, quizList, activeRoomId);
      }
    );

    heartbeatRef.current = setInterval(() => {
      setMatchState(latestMS => {
        broadcastHeartbeat(latestMS, quizList, activeRoomId);
        return latestMS;
      });
    }, 1800);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      CloudNetwork.disconnect();
    };
  }, [view, activeRoomId]);

  // Host incoming message handler
  const handleHostIncomingMessage = (d: CloudMessage) => {
    if (!d || !d.type) return;

    if (d.type === 'AUTO_ENTER_ARENA' || d.type === 'PLAYER_READY_ROPE') {
      const isReady = d.type === 'PLAYER_READY_ROPE';
      setMatchState(prev => {
        let existing = prev.redPlayers.find(x => x.id === d.playerId) || prev.bluePlayers.find(x => x.id === d.playerId);
        if (existing) {
          let updated = false;
          if (d.playerName && d.playerName.trim() && existing.label !== d.playerName.trim()) {
            existing.label = d.playerName.trim();
            updated = true;
          }
          if (d.avatar) {
            existing.avatar = d.avatar;
            updated = true;
          }
          if (isReady && !existing.ready) {
            existing.ready = true;
            AudioFX.stepInRope();
            updated = true;
          }

          // Crucial: Send confirmation back to student so their phone restores full session & score
          CloudNetwork.sendMessage({
            type: 'ENTER_CONFIRMED',
            playerId: existing.id,
            team: existing.team,
            role: existing.role,
            label: existing.label,
            gameType: prev.gameType,
            matchStatus: prev.status,
            globalQIndex: prev.globalQIndex,
            lives: existing.lives,
            streak: existing.streak,
            eliminated: existing.eliminated,
            fastScore: existing.fastScore || 0,
            bossHP: prev.bossHP,
            maxBossHP: prev.maxBossHP,
            quiz: quizList
          });

          if (updated) {
            return {
              ...prev,
              redPlayers: [...prev.redPlayers],
              bluePlayers: [...prev.bluePlayers]
            };
          }
          return prev;
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
            correct: 0,
            freeze: 0,
            role: 'PULLER',
            lives: 3,
            wrongTotal: 0,
            streak: 0,
            eliminated: false,
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
            bossHP: prev.bossHP,
            maxBossHP: prev.maxBossHP,
            quiz: quizList
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
            quiz: quizList
          });
          return { ...prev, spectators: prev.spectators + 1 };
        }
      });
    }
    else if (d.type === 'USE_POWERUP') {
      if (d.powerUpUsed === 'FREEZE_OPPONENT') {
        setMatchState(prev => {
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
        if (prev.status !== 'PLAYING') return prev;
        const allP = [...prev.redPlayers, ...prev.bluePlayers];
        const pObj = allP.find(x => x.id === d.playerId);
        if (!pObj || pObj.eliminated) return prev;

        AudioFX.pullHeave();
        pObj.correct++;
        pObj.streak = (pObj.streak || 0) + 1;

        // Record question rightCount
        const curQ = quizList[prev.globalQIndex % (quizList.length || 1)];
        if (curQ) curQ.rightCount = (curQ.rightCount || 0) + 1;

        // BOSS Mode: Deal damage to Boss
        if (prev.gameType === 'BOSS') {
          const dmg = typeof d.gainedPts === 'number' ? d.gainedPts : 50;
          const nextBossHP = Math.max(0, (prev.bossHP || 1000) - dmg);
          let nextStatus: MatchStatus = prev.status;

          if (nextBossHP <= 0) {
            AudioFX.winFanfare();
            nextStatus = 'ENDED';
          }

          const nextRedAns = pObj.team === 'RED' && !prev.redAnsweredIds.includes(pObj.id)
            ? [...prev.redAnsweredIds, pObj.id]
            : prev.redAnsweredIds;
          const nextBlueAns = pObj.team === 'BLUE' && !prev.blueAnsweredIds.includes(pObj.id)
            ? [...prev.blueAnsweredIds, pObj.id]
            : prev.blueAnsweredIds;

          return {
            ...prev,
            bossHP: nextBossHP,
            status: nextStatus,
            redAnsweredIds: nextRedAns,
            blueAnsweredIds: nextBlueAns,
            bossLastAttack: `Chiến binh ${pObj.label} giáng đòn chí mạng gây -${dmg} HP Boss!`,
            redPlayers: [...prev.redPlayers],
            bluePlayers: [...prev.bluePlayers]
          };
        }

        if (prev.gameType === 'FAST') {
          const studentElapsedSec = typeof d.elapsedSec === 'number' ? d.elapsedSec : 2.0;
          const orderIdx = prev.redAnsweredIds.length + prev.blueAnsweredIds.length;
          const gainedPts = calculateFastestPoints(studentElapsedSec, orderIdx);

          pObj.fastScore = (pObj.fastScore || 0) + gainedPts;
          pObj.lastDelta = gainedPts;
          pObj.lastTimeSec = studentElapsedSec;
          pObj.totalTimeMs = (pObj.totalTimeMs || 0) + Math.round(studentElapsedSec * 1000);

          const nextRedAns = pObj.team === 'RED' && !prev.redAnsweredIds.includes(pObj.id)
            ? [...prev.redAnsweredIds, pObj.id]
            : prev.redAnsweredIds;
          const nextBlueAns = pObj.team === 'BLUE' && !prev.blueAnsweredIds.includes(pObj.id)
            ? [...prev.blueAnsweredIds, pObj.id]
            : prev.blueAnsweredIds;

          const ranked = [...allP].sort((a, b) => (b.fastScore || 0) - (a.fastScore || 0));
          const myRank = ranked.findIndex(x => x.id === pObj.id) + 1;

          CloudNetwork.sendMessage({
            type: 'FAST_ANSWER_RESULT',
            playerId: pObj.id,
            qIndex: prev.globalQIndex,
            isCorrect: true,
            gainedPts: gainedPts,
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
            pObj.lives = (pObj.lives || 3) + 1;
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
            bonusAwarded
          });

          const nextRedAns = pObj.team === 'RED' && !prev.redAnsweredIds.includes(pObj.id)
            ? [...prev.redAnsweredIds, pObj.id]
            : prev.redAnsweredIds;
          const nextBlueAns = pObj.team === 'BLUE' && !prev.blueAnsweredIds.includes(pObj.id)
            ? [...prev.blueAnsweredIds, pObj.id]
            : prev.blueAnsweredIds;

          // Hết 30 giây mới chuyển sang câu mới theo yêu cầu: không tự động chuyển câu sớm khi làm bài xong
          return {
            ...prev,
            redAnsweredIds: nextRedAns,
            blueAnsweredIds: nextBlueAns,
            redPlayers: [...prev.redPlayers],
            bluePlayers: [...prev.bluePlayers]
          };
        }

        // TUG mode
        let nextRope = prev.ropeScore + (pObj.team === 'BLUE' ? 1 : -1);
        let nextRedWins = prev.redRoundWins;
        let nextBlueWins = prev.blueRoundWins;
        let nextStatus: MatchStatus = prev.status;

        if (nextRope >= 3) {
          nextBlueWins++;
          AudioFX.winFanfare();
          if (nextBlueWins >= 2) nextStatus = 'ENDED';
          else nextStatus = 'ROUND_BREAK';
        } else if (nextRope <= -3) {
          nextRedWins++;
          AudioFX.winFanfare();
          if (nextRedWins >= 2) nextStatus = 'ENDED';
          else nextStatus = 'ROUND_BREAK';
        }

        const nextRedAns = pObj.team === 'RED' && !prev.redAnsweredIds.includes(pObj.id)
          ? [...prev.redAnsweredIds, pObj.id]
          : prev.redAnsweredIds;
        const nextBlueAns = pObj.team === 'BLUE' && !prev.blueAnsweredIds.includes(pObj.id)
          ? [...prev.blueAnsweredIds, pObj.id]
          : prev.blueAnsweredIds;

        // Hết 30 giây mới chuyển sang câu mới: giữ nguyên globalQIndex cho đến khi hết 30s trên Host
        return {
          ...prev,
          ropeScore: nextRope,
          redRoundWins: nextRedWins,
          blueRoundWins: nextBlueWins,
          status: nextStatus,
          redAnsweredIds: nextRedAns,
          blueAnsweredIds: nextBlueAns,
          redTotalCorrect: pObj.team === 'RED' ? prev.redTotalCorrect + 1 : prev.redTotalCorrect,
          blueTotalCorrect: pObj.team === 'BLUE' ? prev.blueTotalCorrect + 1 : prev.blueTotalCorrect,
          redPlayers: [...prev.redPlayers],
          bluePlayers: [...prev.bluePlayers]
        };
      });
    }
    else if (d.type === 'FREEZE_WRONG') {
      setMatchState(prev => {
        const allP = [...prev.redPlayers, ...prev.bluePlayers];
        const pObj = allP.find(x => x.id === d.playerId);
        if (!pObj || pObj.eliminated) return prev;

        AudioFX.freezeCrack();
        pObj.freeze++;
        pObj.wrongTotal = (pObj.wrongTotal || 0) + 1;
        pObj.streak = 0;

        // HS làm sai không được chọn lại đáp án khác, câu đó tính sai 0 điểm và mất 1 mạng
        pObj.lives = Math.max(0, (pObj.lives || 3) - 1);
        if (pObj.lives <= 0) {
          pObj.eliminated = true;
        }

        const curQ = quizList[prev.globalQIndex % (quizList.length || 1)];
        if (curQ) curQ.wrongCount = (curQ.wrongCount || 0) + 1;

        const nextRedAns = pObj.team === 'RED' && !prev.redAnsweredIds.includes(pObj.id)
          ? [...prev.redAnsweredIds, pObj.id]
          : prev.redAnsweredIds;
        const nextBlueAns = pObj.team === 'BLUE' && !prev.blueAnsweredIds.includes(pObj.id)
          ? [...prev.blueAnsweredIds, pObj.id]
          : prev.blueAnsweredIds;

        // Đồng bộ mạng và trạng thái loại về máy học sinh
        CloudNetwork.sendMessage({
          type: 'PLAYER_LIVES_SYNC',
          playerId: pObj.id,
          lives: pObj.lives,
          streak: pObj.streak,
          eliminated: pObj.eliminated,
          bonusAwarded: false
        });

        if (prev.gameType === 'BOSS') {
          // Boss retaliates
          const nextBossHP = Math.min(prev.settings?.bossMaxHP || 1000, (prev.bossHP || 1000) + 50);
          return {
            ...prev,
            bossHP: nextBossHP,
            bossLastAttack: `Boss phản đòn trúng ${pObj.label}, Quái vật hồi +50 HP!`,
            redAnsweredIds: nextRedAns,
            blueAnsweredIds: nextBlueAns,
            redPlayers: [...prev.redPlayers],
            bluePlayers: [...prev.bluePlayers]
          };
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
    setQuizList(imported);
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

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <TopAuthorBanner
        onToggleFullScreen={handleToggleFullScreen}
        onOpenKeyModal={() => setShowKeyModal(true)}
      />

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
          onSelectGameType={setGameType}
          onSetJoinMode={setJoinMode}
          onSetMaxPerTeam={setMaxPerTeam}
          onAddSubject={handleAddSubject}
          onSaveCurrentQuizToSubject={handleSaveCurrentQuizToSubject}
          onDeleteCurrentSubject={handleDeleteCurrentSubject}
          onLaunchArena={handleLaunchArena}
          onSwitchToStudentMode={() => setView('STUDENT_MOBILE')}
          onExportHTMLSlide={handleExportHTMLSlide}
          onPrintPDFEvidence={handlePrintPDFEvidence}
          onExportJSON={handleExportJSON}
          onImportJSON={handleImportJSON}
          onOpenKeyModal={() => setShowKeyModal(true)}
          activeRoomId={activeRoomId}
        />
      )}

      {view === 'HOST_ARENA' && (
        <HostArenaView
          matchState={matchState}
          quizList={quizList}
          activeRoomId={activeRoomId}
          onUpdateMatchState={setMatchState}
          onUpdateQuizList={setQuizList}
          onReturnToSetup={() => setView('TEACHER_SETUP')}
          onToggleFullScreen={handleToggleFullScreen}
          onExportHTMLSlide={handleExportHTMLSlide}
          onPrintPDFEvidence={handlePrintPDFEvidence}
          onOpenKeyModal={() => setShowKeyModal(true)}
        />
      )}

      {view === 'STUDENT_MOBILE' && (
        <StudentMobileView
          initialRoomId={studentRoomParam}
          initialTeam={studentTeamParam}
          initialGameType={studentGmParam}
          initialSubjectKey={studentSubjParam}
          onExitToSetup={() => setView('TEACHER_SETUP')}
        />
      )}

      {/* Google Gemini API Key Configuration Modal */}
      <GeminiKeyModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
      />
    </div>
  );
};
