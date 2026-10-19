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
}

export interface SubjectData {
  name: string;
  html: string;
  color: string;
  fixed: boolean;
}

export type PowerUpType = 'SHIELD' | 'FREEZE_OPPONENT' | 'FIFTY_FIFTY' | 'DOUBLE_POWER';

export interface AvatarConfig {
  hairStyle: 'cap' | 'headband' | 'crown' | 'beret' | 'cyber';
  costume: 'uniform' | 'aodai' | 'superhero' | 'sport';
  accessoryColor: string;
  expression: 'happy' | 'determined' | 'celebrate' | 'sad';
}

export interface Player {
  id: string;
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
  doublePowerActive?: boolean;
  tabSwitchCount?: number;
}

export interface MatchSettings {
  roomCapacity: number; // e.g. 50
  max3DRenderCount: number; // default 20
  questionDurationSec: number; // default 30s
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
  // Settings
  settings: MatchSettings;
}

export interface CloudMessage {
  _mid?: string;
  type: string;
  playerId?: string;
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
  question?: QuizItem;
  emoji?: string;
  winner?: string;
  durationSec?: number;
  serverStartTime?: number;
  isCorrect?: boolean;
  correctCountInTF?: number;
  gainedPts?: number;
  elapsedSec?: number;
  totalScore?: number;
  rank?: number;
  grade?: number;
  remainingSec?: number;
  top10?: any[];
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
}

