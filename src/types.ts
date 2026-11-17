export type GamePlayType = 'TUG' | 'BELL' | 'FAST' | 'BOSS';
export type PlayerTeam = 'RED' | 'BLUE';
export type PlayerRole = 'PULLER' | 'SPECTATOR';
export type MatchStatus = 'LOBBY' | 'PLAYING' | 'PAUSED' | 'ROUND_BREAK' | 'ENDED';
export type JoinMode = 'AUTO_ALL' | 'LIMITED_VS';

export type QuestionFormat = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER';

export interface TrueFalseItem {
  label: string; // 'a' | 'b' | 'c' | 'd'
  text: string;
  isCorrect: boolean; // True or False
}

export interface QuizItem {
  qid: number;
  q: string;
  format?: QuestionFormat;
  opts: string[];
  correct: number; // For MULTIPLE_CHOICE
  tfItems?: TrueFalseItem[]; // For TRUE_FALSE (4 items)
  shortAnswer?: string; // For SHORT_ANSWER
  imageUri?: string;
  audioUri?: string;
  explanation?: string;
  rightCount?: number;
  wrongCount?: number;
  aiSelected?: boolean;
  parseWarning?: string;
  sourceLine?: number;
}

export interface SubjectData {
  name: string;
  html: string;
  color: string;
  fixed: boolean;
}

export type PowerUpType = 'SHIELD' | 'FREEZE_OPPONENT' | 'FIFTY_FIFTY' | 'DOUBLE_POWER';

export type WagerLevel = 1 | 1.5 | 2.5;

export type WorldEventType =
  | 'NONE'
  | 'GOLDEN_X2'
  | 'UNDERDOG_BOOST'
  | 'BOSS_RAGE_CRIT'
  | 'MIRACLE_BLESSING'
  | 'TUG_STORM';

export interface LiveFeedItem {
  id: string;
  text: string;
  type: 'FIRST_BLOOD' | 'JACKPOT' | 'STREAK' | 'WAGER_WIN' | 'BOSS_CRIT' | 'WORLD_EVENT';
  timestamp: number;
}

export interface AvatarConfig {
  gender?: 'male' | 'female';
  hairStyle: 'cap' | 'headband' | 'crown' | 'beret' | 'cyber';
  costume: 'uniform' | 'aodai' | 'superhero' | 'sport';
  accessoryColor: string;
  expression: 'happy' | 'determined' | 'celebrate' | 'sad';
}

export interface Player {
  id: string;
  // Đợt 5 (4B.1): định danh BỀN của học sinh (lưu localStorage theo phòng ở phía HS).
  // id là mã bản ghi phía host (thường trùng studentId khi HS vào bằng định danh bền);
  // studentId là khoá GỘP bản ghi: HS quay lại với playerId mới nhưng studentId cũ
  // vẫn được host gộp vào đúng bản ghi này, không tạo "người ma".
  studentId?: string;
  // Đợt 5 (4B.2): mốc host nhìn thấy HS lần cuối (ping/enter/đáp án — giờ phía HOST).
  // Quá 90s im lặng hoàn toàn → offline=true (xám "mất kết nối", giữ nguyên chỗ/điểm/mạng);
  // quá 300s (5 phút) → giải phóng chỗ theo luật từng chế độ (xem utils/presence.ts).
  lastSeen?: number;
  offline?: boolean;
  // Đã bị giải phóng chỗ sau 300s ở chế độ BELL (loại khỏi sàn, thành khán giả) —
  // bản ghi còn giữ cho bảng điểm cuối trận; các chế độ khác thì bản ghi bị dọn hẳn.
  holdReleased?: boolean;
  label: string;
  team: PlayerTeam;
  ready: boolean;
  spawned?: boolean;
  correct: number;
  freeze: number;
  role: PlayerRole;
  lives: number;
  wrongTotal: number;
  streak: number;
  eliminated: boolean;
  fastScore?: number;
  lastDelta?: number;
  lastTimeSec?: number | null;
  totalTimeMs?: number;
  avatar?: AvatarConfig;
  inventory?: PowerUpType[];
  activeShield?: boolean;
  hasImmunityShield?: boolean;
  doublePowerActive?: boolean;
  tabSwitchCount?: number;
  firstBloodCount?: number;
  hasUsedSpecialWager?: boolean;
  hasOpenedMysteryChest?: boolean;
}

export interface MatchSettings {
  roomCapacity: number; // e.g. 50
  max3DRenderCount: number; // default 10 — ô "🎮 Tối đa 3D trên sân" ở màn Cài Đặt GV; sân khấu + nhãn host đọc thẳng giá trị này
  // Thời gian trả lời theo TỪNG PHẦN câu hỏi (giây/câu) — giáo viên chỉnh trong
  // màn hình cài đặt: Phần 1 trắc nghiệm nhiều lựa chọn (MULTIPLE_CHOICE) mặc định
  // 30s, Phần 2 Đúng/Sai (TRUE_FALSE) mặc định 60s, Phần 3 trả lời ngắn
  // (SHORT_ANSWER) mặc định 60s. Xem utils/questionTiming.ts.
  questionDurationSec: number; // Phần 1 — MULTIPLE_CHOICE, default 30s
  questionDurationTfSec?: number; // Phần 2 — TRUE_FALSE, default 60s
  questionDurationSaSec?: number; // Phần 3 — SHORT_ANSWER, default 60s
  bossMaxHP: number; // default 1000
}

export interface MatchState {
  gameType: GamePlayType;
  status: MatchStatus;
  currentRound: number;
  redRoundWins: number;
  blueRoundWins: number;
  ropeScore: number;
  redTotalCorrect: number;
  blueTotalCorrect: number;
  globalQIndex: number;
  redAnsweredIds: string[];
  blueAnsweredIds: string[];
  redPlayers: Player[];
  bluePlayers: Player[];
  spectators: number;
  // Boss Raid state
  bossHP?: number;
  maxBossHP?: number;
  bossRage?: boolean;
  bossLastAttack?: string;
  // TẠM DỪNG theo câu (host bấm ⏸ Tạm dừng): số giây CÒN LẠI của câu hiện tại đã
  // được chốt tại thời điểm dừng; null/undefined = không đang dừng. Phía HS đông
  // cứng đồng hồ đúng số giây này và khoá gửi đáp án cho tới khi host Tiếp tục.
  questionPause?: { qIndex: number; remainingSec: number } | null;
  // Mốc thời gian của ĐOẠN câu hiện tại do host đã công bố cho HS (khi bắt đầu câu
  // và khi Tiếp tục sau tạm dừng: serverStartTime mới + durationSec = số giây còn
  // lại). RESYNC_STATE ưu tiên lấy từ đây để trả đúng deadline cho HS vào lại.
  currentTiming?: { qIndex: number; serverStartTime: number; durationSec: number } | null;
  // World-class Drama & Surprise Mechanics
  activeWorldEvent?: WorldEventType;
  worldEventTitle?: string;
  firstBloodPlayerId?: string | null;
  firstBloodPlayerName?: string | null;
  liveFeed?: LiveFeedItem[];
  // Settings
  settings: MatchSettings;
}

/**
 * Đợt 5 (4B.1): định danh bền của học sinh lưu ở localStorage theo khoá
 * `kc3d_student_<room>` — đóng tab / mở lại / F5 quá cửa sổ phiên tab cũ vẫn là MỘT người.
 * tabSessionId (sessionStorage theo tab) chỉ còn là lớp phụ (chống trùng giữa các tab
 * đang mở đồng thời trên cùng một máy khi giáo viên test), không quyết định danh tính.
 */
export interface StudentIdentity {
  studentId: string;
  name: string;
  team: PlayerTeam;
}

export interface CloudMessage {
  _mid?: string;
  type: string;
  // Đợt 8 (4C.2): chữ ký HMAC-SHA256 của lệnh ĐIỀU KHIỂN nhạy cảm, host ký bằng khoá
  // phòng (xem utils/commandSign.ts). Chỉ các type trong SENSITIVE_COMMAND_TYPES mới
  // mang trường này; phía HS có khoá thì bắt buộc kiểm tra trước khi thi hành.
  sig?: string;
  // Đợt 8 (4C.1): "broker epoch" do HOST công bố kèm tin state/heartbeat retained —
  // brokerId = chỉ số broker host đang dùng, epoch tăng dần mỗi lần host đổi broker.
  // Phía HS chỉ chuyển broker khi thấy epoch này thay đổi, không tự failover độc lập.
  brokerEpoch?: { brokerId: number; epoch: number };
  // Đợt 8 (4D): HOST_HEARTBEAT rút gọn — khi top10/playerIds không đổi so với nhịp
  // trước, host BỎ hai trường đó và đặt cờ này; phía HS giữ nguyên trạng thái cũ.
  top10Unchanged?: boolean;
  roomId?: string;
  playerId?: string;
  // Đợt 5 (4B.1): định danh bền đi kèm MỌI tin vào phòng / ping / đáp án của HS để
  // host gộp bản ghi theo studentId thay vì chỉ theo playerId của phiên tab.
  studentId?: string;
  tabSessionId?: string;
  // Đợt 5 (4B.2): mốc thời gian phía HS khi gửi PLAYER_PING / PLAYER_OFFLINE (chỉ tham
  // khảo — host luôn tính lastSeen bằng đồng hồ của chính host lúc nhận tin).
  ts?: number;
  // Đợt 5 (4B.3): RESYNC_REQUEST { playerId, studentId, lastQIndex } — lastQIndex là câu
  // HS đang xem trước khi mất kết nối/F5, host đối chiếu khi dựng RESYNC_STATE.
  lastQIndex?: number;
  // Đợt 5 (4B.3): các trường chỉ RESYNC_STATE mang theo (host → đúng HS xin resync):
  // canonicalPlayerId = id bản ghi host đã gộp (HS nhận làm playerId của mình nếu khác),
  // hasPlayer = host còn bản ghi của HS hay không, holdReleased = chỗ đã bị giải phóng
  // sau 300s ở ván hiện tại (chờ ván sau), trạng thái đã-trả-lời câu hiện tại của HS:
  canonicalPlayerId?: string;
  hasPlayer?: boolean;
  holdReleased?: boolean;
  hasAnsweredCurrentQ?: boolean;
  answeredIsCorrect?: boolean | null;
  selectedOptionOriginalIdx?: number | null;
  tfAnswers?: Record<string, boolean>;
  shortAnswerInput?: string;
  targetPlayerId?: string;
  team?: PlayerTeam;
  preferredTeam?: PlayerTeam;
  newTeam?: PlayerTeam;
  playerName?: string;
  role?: PlayerRole;
  label?: string;
  gameType?: GamePlayType;
  matchStatus?: MatchStatus;
  status?: MatchStatus;
  globalQIndex?: number;
  qIndex?: number;
  lives?: number;
  streak?: number;
  eliminated?: boolean;
  bonusAwarded?: boolean;
  rescuedNow?: boolean;
  currentRound?: number;
  redRoundWins?: number;
  blueRoundWins?: number;
  ropeScore?: number;
  redDoneCount?: number;
  redTotalMembers?: number;
  blueDoneCount?: number;
  blueTotalMembers?: number;
  bellAliveCount?: number;
  bellTotalCount?: number;
  subj?: string;
  quiz?: QuizItem[];
  quizHash?: string;
  question?: QuizItem;
  emoji?: string;
  winner?: string;
  durationSec?: number;
  serverStartTime?: number;
  serverTs?: number;
  forcePullTs?: number;
  isCorrect?: boolean;
  correctCountInTF?: number;
  gainedPts?: number;
  elapsedSec?: number;
  totalScore?: number;
  rank?: number;
  grade?: number;
  remainingSec?: number;
  // TẠM DỪNG theo câu: host công bố kèm HOST_HEARTBEAT / RESYNC_STATE — đang dừng
  // thì HS đông cứng đồng hồ ở remainingSec và khoá đáp án. Lệnh dừng/tiếp tục
  // chính thức đi qua PAUSE_TOGGLE (lệnh nhạy cảm, đã ký bằng khoá phòng — Đợt 8).
  questionPaused?: boolean;
  top10?: any[];
  playerIds?: string[];
  chunkIndex?: number;
  totalChunks?: number;
  quizChunk?: QuizItem[];
  // Đợt 3 (2.3–2.4): phân loại gói chunk — 'QUIZ' (mặc định, tương thích ngược) là chunk của
  // cả bộ đề; 'SINGLE_QUESTION' là chunk riêng chứa đúng 1 câu hỏi quá lớn (thường do ảnh
  // base64) được tách khỏi gói đơn/heartbeat, câu nằm ở quizChunk[0] và thuộc vị trí qIndex.
  chunkKind?: 'QUIZ' | 'SINGLE_QUESTION';
  // Đợt 3 (2.3): HS gửi QUIZ_CHUNK_REQUEST { quizHash, missingChunks } xin host phát lại
  // đúng các gói đề còn thiếu của bộ đề có quizHash tương ứng.
  missingChunks?: number[];
  // Đợt 3 (2.4): khi question đầy đủ đã bị rút khỏi gói (đi đường chunk riêng), gói chỉ còn
  // tham chiếu này — HS lấy câu thật từ bộ đề đã ghép theo quizHash + qIndex/globalQIndex.
  questionRefOnly?: boolean;
  allRanks?: any[];
  rankings?: any[];
  avatar?: AvatarConfig;
  powerUp?: PowerUpType;
  powerUpUsed?: PowerUpType;
  inventory?: PowerUpType[];
  bossHP?: number;
  maxBossHP?: number;
  bossDamageGained?: number;
  tabSwitched?: boolean;
  fastScore?: number;
  savedScore?: number;
  savedCorrect?: number;
  // Speed, Surprise & Risk/Luck fields
  wagerLevel?: WagerLevel;
  isFirstBlood?: boolean;
  mysteryRewardText?: string;
  bonusScoreDelta?: number;
  worldEvent?: WorldEventType;
  worldEventTitle?: string;
  dramaAnnouncement?: string;
  hasUsedSpecialWager?: boolean;
  hasOpenedMysteryChest?: boolean;
  hasImmunityShield?: boolean;
  victimPlayerId?: string;
  victimScoreDeduction?: number;
}

export interface CloudBackupData {
  version: number;
  lastUpdated: number;
  deviceLabel?: string;
  subjectsDB: Record<string, SubjectData>;
  currentSubjectKey: string;
  matchSettings: MatchSettings;
  activeQuizList?: QuizItem[];
  stats?: {
    totalSubjects: number;
    totalQuestions: number;
  };
}

export interface CloudSyncProfile {
  type: 'GOOGLE' | 'PASSWORD' | 'NONE';
  googleEmail?: string;
  googleName?: string;
  googleAvatar?: string;
  passwordKey?: string;
  lastSyncedAt?: number;
  autoSyncEnabled?: boolean;
}



