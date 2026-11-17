/**
 * Đợt 5 (Giai đoạn 4B) — LOGIC THUẦN về định danh bền, nhịp tim & giữ chỗ 5 phút,
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
// Hằng số giữ chỗ (quyết định đã chốt: GIỮ CHỖ 5 PHÚT)
// ---------------------------------------------------------------------------
/** HS gửi PLAYER_PING mỗi 5 giây (gọn, tách khỏi tin gửi điểm). */
export const PLAYER_PING_INTERVAL_MS = 5000;
/** Quá 15s không thấy tín hiệu → hiển thị "mất kết nối" (xám) nhưng GIỮ chỗ/điểm/mạng. */
export const PLAYER_OFFLINE_AFTER_MS = 15000;
/** Quá 5 phút (300s) không quay lại → giải phóng chỗ, coi như rời ván hiện tại. */
export const PLAYER_HOLD_MS = 300000;
/** Host không nhận được BẤT KỲ tin nào quá 45s → nghi host đang mất thu (wifi/broker
 * chập chờn), KHÔNG phải cả lớp cùng rời — vòng quét giữ chỗ phải dừng giải phóng oan. */
export const HOST_RX_OUTAGE_MS = 45000;
/** HS quay lại từ nền: mất kết nối (ẩn trang) quá 5s thì xin RESYNC tường minh. */
export const RESYNC_BACKGROUND_THRESHOLD_MS = 5000;

// ---------------------------------------------------------------------------
// Đợt GIA CỐ TẢI (17/11/2026): thời gian hiện diện THÍCH ỨNG theo quy mô phòng.
// Mục tiêu thiết kế 200 HS/phòng (nấc thật ở trường ~60): phòng càng đông, ping
// càng thưa để tổng lưu lượng ping vào host/broker/wifi KHÔNG tăng tuyến tính
// theo số HS; ngưỡng hiển thị "mất kết nối" co giãn theo đúng nhịp ping mới
// (≈3 nhịp ping + biên an toàn) để không xám oan; giữ chỗ vẫn 5 PHÚT theo đồng
// hồ tường (≥20 nhịp ping ở mọi nấc) và van mất-thu phía host ≥ 3 nhịp ping.
// ---------------------------------------------------------------------------
export interface PresenceTiming {
  /** Nhịp PLAYER_PING cơ sở của 1 HS (trước jitter theo định danh). */
  pingIntervalMs: number;
  /** Im lặng quá bấy lâu → hiển thị "mất kết nối" (HELD) nhưng giữ chỗ. */
  offlineAfterMs: number;
  /** Im lặng quá bấy lâu → giải phóng chỗ theo luật chế độ chơi. */
  holdMs: number;
  /** Host không nhận BẤT KỲ tin nào quá bấy lâu → nghi host mất thu, dừng quét. */
  outageMs: number;
  /** Chu kỳ HS gửi lại hồ sơ đầy đủ (sendEnter) khi không có gì thay đổi. */
  profileResyncMs: number;
}

/** Bộ thời gian hiện diện cho phòng có `playerCount` người chơi (bản ghi phía host). */
export function presenceTimingForRoomSize(playerCount: number): PresenceTiming {
  const n = typeof playerCount === 'number' && isFinite(playerCount) && playerCount > 0 ? Math.floor(playerCount) : 0;
  if (n <= 30) {
    // Nấc lớp thường: GIỮ NGUYÊN hành vi đã chốt các đợt trước (5s / 15s / 5 phút).
    return { pingIntervalMs: 5000, offlineAfterMs: 15000, holdMs: PLAYER_HOLD_MS, outageMs: HOST_RX_OUTAGE_MS, profileResyncMs: 20000 };
  }
  if (n <= 80) {
    // Nấc thật ở trường (lớp đông nhất 48 HS + dự giờ ≈ 60): ping 8s → ~7,5 ping/s.
    return { pingIntervalMs: 8000, offlineAfterMs: 25000, holdMs: PLAYER_HOLD_MS, outageMs: HOST_RX_OUTAGE_MS, profileResyncMs: 30000 };
  }
  if (n <= 150) {
    return { pingIntervalMs: 12000, offlineAfterMs: 40000, holdMs: PLAYER_HOLD_MS, outageMs: 60000, profileResyncMs: 45000 };
  }
  // Nấc thiết kế 200: ping 15s → ~13 ping/s vào host dù phòng có 200 người.
  return { pingIntervalMs: 15000, offlineAfterMs: 50000, holdMs: PLAYER_HOLD_MS, outageMs: 60000, profileResyncMs: 60000 };
}

/**
 * Giãn nhịp ping theo ĐỊNH DANH từng HS (xác định, không ngẫu nhiên mỗi lần):
 * cộng thêm 0–40% của nhịp cơ sở theo hàm băm của identityKey. Nhờ đó 200 HS
 * không ping DỒN CÙNG MỘT MỐC sau khi host phát tín hiệu chung (chống dồn dập
 * đồng loạt), mà rải đều trong cửa sổ nhịp; cùng một HS luôn giữ cùng độ lệch
 * nên nhịp của em đó ổn định, không tự dồn vào nhau theo thời gian.
 */
export function pingIntervalWithJitter(baseMs: number, identityKey: string): number {
  const base = typeof baseMs === 'number' && isFinite(baseMs) && baseMs > 0 ? baseMs : PLAYER_PING_INTERVAL_MS;
  const key = String(identityKey || '');
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  const spreadPct = Math.abs(h) % 41; // 0..40 (%)
  return base + Math.floor((base * spreadPct) / 100);
}

/**
 * Ước lượng quy mô phòng từ các trường HOST_HEARTBEAT mang theo: ưu tiên danh
 * sách playerIds khi nhịp tim kèm roster đầy đủ; nhịp rút gọn (top10Unchanged)
 * vẫn luôn mang tổng thành viên 2 đội / tổng người chế độ BELL nên vẫn ước
 * lượng được. Trả 0 khi không có tín hiệu nào (phía HS giữ nguyên ước lượng cũ).
 */
export function estimateRoomSize(sig: {
  playerIds?: unknown;
  redTotalMembers?: number;
  blueTotalMembers?: number;
  bellTotalCount?: number;
}): number {
  if (Array.isArray(sig.playerIds) && sig.playerIds.length > 0) return sig.playerIds.length;
  const teams =
    (typeof sig.redTotalMembers === 'number' && isFinite(sig.redTotalMembers) ? sig.redTotalMembers : 0) +
    (typeof sig.blueTotalMembers === 'number' && isFinite(sig.blueTotalMembers) ? sig.blueTotalMembers : 0);
  if (teams > 0) return teams;
  if (typeof sig.bellTotalCount === 'number' && isFinite(sig.bellTotalCount) && sig.bellTotalCount > 0) {
    return sig.bellTotalCount;
  }
  return 0;
}

export type PresenceStatus = 'ONLINE' | 'HELD' | 'RELEASED';

/**
 * Quyết định trạng thái giữ chỗ theo lastSeen (đồng hồ phía HOST):
 * - chưa từng có lastSeen (undefined/<=0) → ONLINE (chưa có bằng chứng mất kết nối,
 *   không phạt oan — vd bản ghi vừa khôi phục từ snapshot sau khi host F5);
 * - tuổi < 15s → ONLINE;
 * - 15s ≤ tuổi ≤ 300s → HELD (mất kết nối hiển thị xám, giữ nguyên chỗ);
 * - tuổi > 300s → RELEASED (giải phóng chỗ theo luật từng chế độ chơi).
 * knownOffline = host đã nhận PLAYER_OFFLINE (Last-Will) → coi như HELD ngay dù
 * tuổi chưa tới 15s (nhưng RELEASED vẫn phải chờ đủ 5 phút tính từ lastSeen đóng băng).
 */
export function getPresenceStatus(
  lastSeen: number | undefined | null,
  now: number,
  knownOffline: boolean = false,
  timing?: PresenceTiming
): PresenceStatus {
  if (typeof lastSeen !== 'number' || !isFinite(lastSeen) || lastSeen <= 0) {
    return knownOffline ? 'HELD' : 'ONLINE';
  }
  const holdMs = timing?.holdMs ?? PLAYER_HOLD_MS;
  const offlineAfterMs = timing?.offlineAfterMs ?? PLAYER_OFFLINE_AFTER_MS;
  const age = now - lastSeen;
  if (age > holdMs) return 'RELEASED';
  if (age >= offlineAfterMs || knownOffline) return 'HELD';
  return 'ONLINE';
}

export function isPresenceHeld(
  lastSeen: number | undefined | null,
  now: number,
  knownOffline = false,
  timing?: PresenceTiming
): boolean {
  return getPresenceStatus(lastSeen, now, knownOffline, timing) === 'HELD';
}

export function shouldReleasePlayer(
  lastSeen: number | undefined | null,
  now: number,
  knownOffline = false,
  timing?: PresenceTiming
): boolean {
  return getPresenceStatus(lastSeen, now, knownOffline, timing) === 'RELEASED';
}

/**
 * Host có đang MẤT THU hay không: lastRxAt là mốc host nhận tin gần nhất (bất kỳ loại
 * tin nào từ HS). Chỉ kết luận mất thu khi có mốc hợp lệ (> 0, hữu hạn) và đã quá
 * HOST_RX_OUTAGE_MS không có tin mới; chưa từng nhận tin nào (0/undefined/không hợp
 * lệ) → false, không phạt oan lúc host vừa khởi động.
 */
export function isHostReceptionOutage(
  lastRxAt: number | undefined | null,
  now: number,
  outageMs: number = HOST_RX_OUTAGE_MS
): boolean {
  if (typeof lastRxAt !== 'number' || !isFinite(lastRxAt) || lastRxAt <= 0) return false;
  const threshold = typeof outageMs === 'number' && isFinite(outageMs) && outageMs > 0 ? outageMs : HOST_RX_OUTAGE_MS;
  return now - lastRxAt > threshold;
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
 * Khoá khử trùng đáp án phía host: MỖI BẢN GHI HS × MỖI CÂU HỎI chỉ được ghi nhận
 * ĐÚNG MỘT LẦN trong cả trận. Mọi đường ghi điểm (PULL_CORRECT / FREEZE_WRONG /
 * RESYNC) PHẢI dùng chung hàm này để khoá không bao giờ lệch nhau giữa các handler.
 */
export function answerKeyFor(playerRecordId: string, qIndex: number): string {
  return `${playerRecordId}_q_${qIndex}`;
}

/**
 * GỘP tin vào phòng của HS quay lại vào BẢN GHI CŨ phía host:
 * - giữ nguyên id bản ghi cũ (mã canonical mà host/đáp án đã tham chiếu),
 * - giữ điểm/mạng/streak/đội/vai trò/loại của bản ghi cũ. Điểm & số câu đúng là số
 *   liệu DO HOST ghi sổ (mỗi HS × mỗi câu tính đúng 1 lần qua answerKeyFor) nên
 *   TUYỆT ĐỐI không nhận giá trị phía HS báo lên (savedScore/savedCorrect): máy HS
 *   có thể mang tổng cũ của trận/phòng trước (sessionStorage theo tab) — nhận vào
 *   là BXH phình ngay (sự cố 17/11/2026: mới câu 15 đã có HS "24 câu đúng").
 *   HS vào lại vẫn không tụt điểm vì bản ghi host còn nguyên; phía HS cũng tự đồng
 *   bộ lại theo savedCorrect/savedScore mà ENTER_CONFIRMED của host trả về.
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
    fastScore: existing.fastScore || 0,
    correct: existing.correct || 0,
    lastSeen: now,
    offline: false,
    holdReleased: false
  };
}

// ---------------------------------------------------------------------------
// Giải phóng chỗ sau 5 phút — theo luật sẵn có của từng chế độ chơi
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
  lastSeenById?: Map<string, number>,
  timing?: PresenceTiming
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
      const status = getPresenceStatus(seen, now, p.offline === true, timing);
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
  /** Đang TẠM DỪNG theo câu tại thời điểm resync + số giây còn lại đã chốt lúc
   * dừng — HS vào lại giữa lúc dừng phải thấy đúng trạng thái đông cứng này. */
  questionPaused?: boolean;
  remainingSec?: number;
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
    questionPaused: ctx.questionPaused === true,
    remainingSec: ctx.questionPaused ? ctx.remainingSec : undefined,
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
