/**
 * Đợt 5 (Giai đoạn 4B) — LOGIC THUẦN về định danh bền, nhịp tim & giữ chỗ 90 giây,
 * gộp bản ghi theo studentId và dựng RESYNC_STATE.
 *
 * File này KHÔNG chạm React/storage/mạng: mọi hàm đều thuần (đầu vào → đầu ra) để
 * kiểm chứng bằng script độc lập và để cả host (App.tsx) lẫn phía HS
 * (StudentMobileView.tsx) dùng chung một quy tắc duy nhất.
 */
import {
  CloudMessage,
  GamePlayType,
  MatchState,
  MatchStatus,
  Player,
  PlayerTeam,
  QuizItem,
  StudentIdentity
} from '../types';

// ---------------------------------------------------------------------------
// Hằng số giữ chỗ (quyết định đã chốt: GIỮ CHỖ 90 GIÂY)
// ---------------------------------------------------------------------------
/** HS gửi PLAYER_PING mỗi 5 giây (gọn, tách khỏi tin gửi điểm). */
export const PLAYER_PING_INTERVAL_MS = 5000;
/** Quá 15s không thấy tín hiệu → hiển thị "mất kết nối" (xám) nhưng GIỮ chỗ/điểm/mạng. */
export const PLAYER_OFFLINE_AFTER_MS = 15000;
/** Quá 90s không quay lại → giải phóng chỗ, coi như rời ván hiện tại. */
export const PLAYER_HOLD_MS = 90000;
/** HS quay lại từ nền: mất kết nối (ẩn trang) quá 5s thì xin RESYNC tường minh. */
export const RESYNC_BACKGROUND_THRESHOLD_MS = 5000;

export type PresenceStatus = 'ONLINE' | 'HELD' | 'RELEASED';

/**
 * Quyết định trạng thái giữ chỗ theo lastSeen (đồng hồ phía HOST):
 * - chưa từng có lastSeen (undefined/<=0) → ONLINE (chưa có bằng chứng mất kết nối,
 *   không phạt oan — vd bản ghi vừa khôi phục từ snapshot sau khi host F5);
 * - tuổi < 15s → ONLINE;
 * - 15s ≤ tuổi ≤ 90s → HELD (mất kết nối hiển thị xám, giữ nguyên chỗ);
 * - tuổi > 90s → RELEASED (giải phóng chỗ theo luật từng chế độ chơi).
 * knownOffline = host đã nhận PLAYER_OFFLINE (Last-Will) → coi như HELD ngay dù
 * tuổi chưa tới 15s (nhưng RELEASED vẫn phải chờ đủ 90s tính từ lastSeen đóng băng).
 */
export function getPresenceStatus(
  lastSeen: number | undefined | null,
  now: number,
  knownOffline: boolean = false
): PresenceStatus {
  if (typeof lastSeen !== 'number' || !isFinite(lastSeen) || lastSeen <= 0) {
    return knownOffline ? 'HELD' : 'ONLINE';
  }
  const age = now - lastSeen;
  if (age > PLAYER_HOLD_MS) return 'RELEASED';
  if (age >= PLAYER_OFFLINE_AFTER_MS || knownOffline) return 'HELD';
  return 'ONLINE';
}

export function isPresenceHeld(lastSeen: number | undefined | null, now: number, knownOffline = false): boolean {
  return getPresenceStatus(lastSeen, now, knownOffline) === 'HELD';
}

export function shouldReleasePlayer(lastSeen: number | undefined | null, now: number, knownOffline = false): boolean {
  return getPresenceStatus(lastSeen, now, knownOffline) === 'RELEASED';
}

// ---------------------------------------------------------------------------
// Định danh bền phía HS (lớp lưu trữ do phía HS tự quản, ở đây chỉ có logic thuần)
// ---------------------------------------------------------------------------

export function studentStorageKey(roomId: string): string {
  return `kc3d_student_${String(roomId || '').replace(/[^a-zA-Z0-9]/g, '') || '12345'}`;
}

export function generateStudentId(): string {
  return 'hs_' + Date.now().toString(36).slice(-4) + '_' + Math.random().toString(36).substring(2, 7);
}

/** Parse chuỗi JSON đã lưu trong localStorage → StudentIdentity hợp lệ hoặc null. */
export function parseStudentIdentity(raw: string | null | undefined): StudentIdentity | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.studentId === 'string' && parsed.studentId.trim().length > 0) {
      return {
        studentId: parsed.studentId,
        name: typeof parsed.name === 'string' ? parsed.name : '',
        team: parsed.team === 'BLUE' ? 'BLUE' : 'RED'
      };
    }
  } catch {}
  return null;
}

export function serializeStudentIdentity(identity: StudentIdentity): string {
  return JSON.stringify({
    studentId: identity.studentId,
    name: identity.name || '',
    team: identity.team === 'BLUE' ? 'BLUE' : 'RED'
  });
}

/**
 * Chọn studentId cho HS khi vào một phòng:
 * 1) đã có định danh bền của đúng phòng đó → dùng lại (một người duy nhất);
 * 2) chưa có nhưng phiên tab hiện tại đã có playerId (bản ghi host có thể đã tồn tại
 *    từ trước đợt này) → nhận luôn playerId đó làm studentId để không đứt bản ghi cũ;
 * 3) hoàn toàn mới → sinh id mới (do nơi gọi cung cấp qua tham số generatedId để hàm thuần).
 */
export function resolveStudentId(
  stored: StudentIdentity | null,
  legacyTabPlayerId: string | null | undefined,
  generatedId: string
): string {
  if (stored && stored.studentId) return stored.studentId;
  if (legacyTabPlayerId && legacyTabPlayerId.trim().length > 0) return legacyTabPlayerId;
  return generatedId;
}

// ---------------------------------------------------------------------------
// Tìm & gộp bản ghi phía host theo studentId
// ---------------------------------------------------------------------------

/**
 * Tìm bản ghi HS trong 2 đội theo định danh: ưu tiên khớp studentId (định danh bền),
 * sau đó mới khớp playerId (mã phiên tab hiện tại). Nhờ thứ tự này, HS quay lại bằng
 * playerId MỚI nhưng studentId CŨ vẫn trúng đúng bản ghi cũ.
 */
export function findPlayerByIdentity(
  redPlayers: Player[],
  bluePlayers: Player[],
  playerId?: string | null,
  studentId?: string | null
): Player | null {
  const all = [...redPlayers, ...bluePlayers];
  if (studentId) {
    const byStudent = all.find(p => p.studentId && p.studentId === studentId);
    if (byStudent) return byStudent;
    // Bản ghi cũ (trước đợt 5) chưa có trường studentId nhưng id của nó chính là
    // studentId bền của HS (vì playerId cũ được nhận làm studentId) → khớp theo id.
    const byIdAsStudent = all.find(p => p.id === studentId);
    if (byIdAsStudent) return byIdAsStudent;
  }
  if (playerId) {
    const byPlayer = all.find(p => p.id === playerId);
    if (byPlayer) return byPlayer;
    const byStudentField = all.find(p => p.studentId && p.studentId === playerId);
    if (byStudentField) return byStudentField;
  }
  return null;
}

export interface IncomingPlayerIdentity {
  playerId?: string;
  studentId?: string;
  playerName?: string;
  preferredTeam?: PlayerTeam;
  savedScore?: number;
  savedCorrect?: number;
  avatar?: Player['avatar'];
  ready?: boolean;
}

/**
 * GỘP tin vào phòng của HS quay lại vào BẢN GHI CŨ phía host:
 * - giữ nguyên id bản ghi cũ (mã canonical mà host/đáp án đã tham chiếu),
 * - giữ điểm/mạng/streak/đội/vai trò/loại của bản ghi cũ; điểm & số câu đúng chỉ lấy
 *   giá trị CAO HƠN giữa cũ và phía HS báo lên (không bao giờ tụt điểm khi vào lại),
 * - tên: ưu tiên tên thật phía HS vừa gửi (nếu không phải tên placeholder),
 * - lastSeen = now, offline/holdReleased được xoá (HS đã quay lại thật).
 */
export function mergePlayerRecord(existing: Player, incoming: IncomingPlayerIdentity, now: number): Player {
  const incomingName = (incoming.playerName || '').trim();
  const hasRealIncomingName = incomingName.length > 0 && incomingName !== 'Chưa lưu tên';
  const hasRealExistingName = Boolean(existing.label) && existing.label !== 'Chưa lưu tên';
  return {
    ...existing,
    studentId: incoming.studentId || existing.studentId || incoming.playerId || existing.id,
    label: hasRealIncomingName ? incomingName : hasRealExistingName ? existing.label : incomingName || existing.label,
    avatar: incoming.avatar || existing.avatar,
    ready: existing.ready || incoming.ready === true,
    fastScore: Math.max(
      existing.fastScore || 0,
      typeof incoming.savedScore === 'number' ? incoming.savedScore : 0
    ),
    correct: Math.max(
      existing.correct || 0,
      typeof incoming.savedCorrect === 'number' ? incoming.savedCorrect : 0
    ),
    lastSeen: now,
    offline: false,
    holdReleased: false
  };
}

// ---------------------------------------------------------------------------
// Giải phóng chỗ sau 90s — theo luật sẵn có của từng chế độ chơi
// ---------------------------------------------------------------------------

/**
 * Áp luật rời ván hiện tại cho 1 HS đã quá hạn giữ chỗ:
 * - BELL (Rung Chuông Vàng): dùng đúng cơ chế LOẠI sẵn có — eliminated=true, về vai
 *   SPECTATOR, hết mạng; bản ghi còn ở lại cho bảng điểm/vinh danh cuối trận nhưng
 *   chỗ trên sàn đã được giải phóng (HostArena vốn ẩn người đã loại khỏi sàn).
 * - TUG / FAST / BOSS: không có cơ chế loại từng người — rời ván = dọn bản ghi khỏi
 *   danh sách (trả null), chỗ trống ngay; HS được vào lại từ ván sau (khi trận về
 *   LOBBY) như người chơi quay lại bình thường, điểm phía HS vẫn giữ ở máy HS.
 */
export function releasePlayerForMode(player: Player, gameType: GamePlayType): Player | null {
  if (gameType === 'BELL') {
    return {
      ...player,
      eliminated: true,
      role: 'SPECTATOR',
      lives: 0,
      streak: 0,
      offline: true,
      holdReleased: true
    };
  }
  return null;
}

/**
 * Quét giữ chỗ cho cả 2 đội tại thời điểm `now`:
 * - ONLINE → giữ nguyên (chỉ xoá cờ offline nếu trước đó đang xám);
 * - HELD → giữ nguyên chỗ/điểm/mạng, chỉ bật cờ offline để host hiển thị xám;
 * - RELEASED → áp releasePlayerForMode (BELL: loại giữ bản ghi; mode khác: dọn bản ghi
 *   và trả id vào releasedIds để host chặn vào lại giữa ván đang PLAYING).
 * lastSeenById (nếu có) là nguồn giờ-thấy-cuối đáng tin hơn trường trong bản ghi
 * (ping chỉ cập nhật ref phía host, không ghi state mỗi 5s để tránh re-render liên tục).
 * Bản ghi chưa từng có mốc nào (vừa khôi phục snapshot) được "ân hạn": coi như vừa
 * thấy lúc `now` thay vì bị giải phóng oan.
 */
export function sweepPlayerPresence(
  redPlayers: Player[],
  bluePlayers: Player[],
  gameType: GamePlayType,
  now: number,
  lastSeenById?: Map<string, number>
): { redPlayers: Player[]; bluePlayers: Player[]; releasedIds: string[]; changed: boolean } {
  const releasedIds: string[] = [];
  let changed = false;

  const sweepList = (list: Player[]): Player[] => {
    const next: Player[] = [];
    for (const p of list) {
      if (p.holdReleased) {
        next.push(p);
        continue;
      }
      const seen = lastSeenById?.get(p.id) ?? p.lastSeen;
      // Cờ offline trong bản ghi chỉ do PLAYER_OFFLINE (will) hoặc chính vòng quét này
      // đặt; ping/enter luôn xoá cờ ngay khi HS có tín hiệu lại nên không bị kẹt HELD.
      const status = getPresenceStatus(seen, now, p.offline === true);
      if (status === 'RELEASED') {
        changed = true;
        releasedIds.push(p.id);
        const released = releasePlayerForMode(p, gameType);
        if (released) next.push(released);
        continue;
      }
      if (status === 'HELD') {
        if (p.offline !== true || p.lastSeen !== seen) {
          changed = true;
          next.push({ ...p, offline: true, lastSeen: typeof seen === 'number' ? seen : p.lastSeen });
        } else {
          next.push(p);
        }
        continue;
      }
      // ONLINE
      if (p.offline !== false) {
        // Đang xám (hoặc cờ chưa từng được đặt) → chuẩn hoá về offline=false tường minh.
        changed = true;
        next.push({ ...p, offline: false, lastSeen: typeof seen === 'number' ? seen : now });
      } else if (typeof seen !== 'number') {
        // Chưa có mốc nào: ân hạn bằng mốc hiện tại, không coi là thay đổi cần render.
        if (lastSeenById) lastSeenById.set(p.id, now);
        next.push(p);
      } else {
        next.push(p);
      }
    }
    return next;
  };

  return {
    redPlayers: sweepList(redPlayers),
    bluePlayers: sweepList(bluePlayers),
    releasedIds,
    changed
  };
}

// ---------------------------------------------------------------------------
// RESYNC tường minh (4B.3)
// ---------------------------------------------------------------------------

export interface ResyncAnswerInfo {
  hasAnswered: boolean;
  isCorrect?: boolean | null;
  selectedOptionOriginalIdx?: number | null;
  tfAnswers?: Record<string, boolean>;
  shortAnswerInput?: string;
}

export interface ResyncContext {
  /** Câu hiện tại kèm meta (qIndex/totalQuestions) để HS dựng lại hiển thị. */
  question?: QuizItem & { qIndex?: number; totalQuestions?: number };
  /** Mốc host bắt đầu câu hiện tại + thời lượng câu (cơ chế deadline Đợt 1). */
  serverStartTime?: number;
  durationSec?: number;
  serverTs: number;
  answer: ResyncAnswerInfo;
  holdReleased: boolean;
}

/**
 * Dựng gói RESYNC_STATE (host → đúng HS vừa gửi RESYNC_REQUEST) từ trạng thái trận
 * thật phía host: trạng thái trận + chế độ chơi, câu hiện tại kèm deadline tuyệt đối,
 * trạng thái đã-trả-lời của chính HS ở câu hiện tại, và toàn bộ hồ sơ thi đấu của HS
 * (điểm/mạng/streak/đội/vai trò/loại) để HS khôi phục hiển thị KHÔNG phải đoán mò.
 * echoPlayerId là playerId HS dùng trong RESYNC_REQUEST (để HS nhận đúng gói của
 * mình); canonicalPlayerId là id bản ghi host đã gộp — khác nhau thì HS đổi sang
 * canonical cho mọi tin về sau.
 */
export function buildResyncStateMessage(
  match: Pick<MatchState, 'gameType' | 'status' | 'globalQIndex' | 'bossHP' | 'maxBossHP'>,
  player: Player | null,
  echoPlayerId: string,
  ctx: ResyncContext
): CloudMessage {
  const qIndex = match.globalQIndex;
  const msg: CloudMessage = {
    type: 'RESYNC_STATE',
    playerId: echoPlayerId,
    canonicalPlayerId: player ? player.id : undefined,
    studentId: player?.studentId,
    hasPlayer: Boolean(player),
    holdReleased: ctx.holdReleased,
    gameType: match.gameType,
    status: match.status,
    matchStatus: match.status as MatchStatus,
    globalQIndex: qIndex,
    qIndex,
    serverStartTime: ctx.serverStartTime,
    durationSec: ctx.durationSec,
    serverTs: ctx.serverTs,
    question: ctx.question,
    hasAnsweredCurrentQ: ctx.answer.hasAnswered,
    answeredIsCorrect: ctx.answer.hasAnswered ? (ctx.answer.isCorrect ?? null) : null,
    bossHP: match.bossHP,
    maxBossHP: match.maxBossHP
  };
  if (ctx.answer.hasAnswered) {
    if (typeof ctx.answer.selectedOptionOriginalIdx === 'number' || ctx.answer.selectedOptionOriginalIdx === null) {
      msg.selectedOptionOriginalIdx = ctx.answer.selectedOptionOriginalIdx ?? null;
    }
    if (ctx.answer.tfAnswers) msg.tfAnswers = ctx.answer.tfAnswers;
    if (typeof ctx.answer.shortAnswerInput === 'string') msg.shortAnswerInput = ctx.answer.shortAnswerInput;
  }
  if (player) {
    msg.team = player.team;
    msg.role = player.role;
    msg.label = player.label;
    msg.playerName = player.label;
    msg.lives = match.gameType === 'BELL' ? player.lives : 3;
    msg.streak = player.streak;
    msg.eliminated = match.gameType === 'BELL' ? player.eliminated : false;
    msg.fastScore = player.fastScore || 0;
    msg.totalScore = player.fastScore || 0;
    msg.savedCorrect = player.correct || 0;
    msg.avatar = player.avatar;
  }
  return msg;
}
