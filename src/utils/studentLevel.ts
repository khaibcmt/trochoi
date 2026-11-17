/**
 * HỆ CẤP ĐỘ HỌC SINH THEO MÃ MÁY (yêu cầu của học sinh, thầy duyệt 17/11/2026).
 *
 * Nguyên tắc thầy chốt:
 *  - Định danh = MÃ MÁY của điện thoại học sinh (device id bền TOÀN CỤC, lưu
 *    localStorage một key riêng — KHÁC studentId theo phòng). Tên chỉ là nhãn:
 *    em nhập tên khác ở phòng khác thì cấp vẫn theo mã máy; bản ghi cập nhật
 *    tên mới nhất.
 *  - Lưu trữ: subtree MỚI kc3d_students/<deviceId> trên RTDB edumaster-online
 *    {name, xp, matches, correct, wrong, lastMatchId, updatedAt}. Cấp SUY RA
 *    từ xp bằng thang cấp dưới — không lưu cấp riêng. Không đụng
 *    kc3d_requests / kc3d_licenses / hlv_*.
 *  - Luật XP: đúng +10; sai −3 (không trả lời tính sai — sai = tổng số câu −
 *    số câu đúng, nhất quán sổ điểm GV); thưởng cuối trận theo BXH của host:
 *    hạng 1 +50, hạng 2 +30, hạng 3 +20. XP không âm (sàn 0); tụt dưới mốc
 *    thì tự hạ cấp.
 *
 * ZERO-TẢI (bài học sự cố nghẽn phòng sáng 17/11 — TUYỆT ĐỐI giữ):
 *  - Trong lúc thi: KHÔNG thêm bất kỳ loại tin MQTT nào, KHÔNG ghi Firebase.
 *    Lúc vào phòng HS chỉ tự đọc bản ghi của chính mình (1 GET theo deviceId)
 *    rồi gắn {deviceId, xp} vào payload ENTER sẵn có (PLAYER_READY_ROPE /
 *    PLAYER_FINISH_QUIZ). Host suy cấp từ xp đó để hiện icon trước tên.
 *  - Cuối trận: HOST (giữ sổ điểm chuẩn) mới ghi — mỗi HS 1 lần, rải theo lô
 *    nhỏ sau khi vào màn kết, fire-and-forget, lỗi thử lại tối đa 1 lần,
 *    không bao giờ chặn màn kết. Chống ghi đúp bằng lastMatchId: ghi lại
 *    cùng một trận (host F5 ở màn kết…) không cộng 2 lần.
 *
 * File này là LOGIC THUẦN + IO qua interface tiêm (store/fetch) như
 * utils/license.ts để kiểm chứng bằng test độc lập.
 */

import { cyrb53, fbGet, fbPut, type FetchFn, type KeyValueStore } from './license';

/* ================= Thang cấp ================= */

export interface StudentLevel {
  index: number;
  icon: string;
  name: string;
  minXp: number;
  /** Màu riêng của TÊN cấp (thầy duyệt 17/11) — đọc rõ trên nền tối. */
  color: string;
  /** Cấp cao nhất (👑 Huyền Thoại) phát sáng nhẹ. */
  glow?: boolean;
}

/** Thang cấp do thầy duyệt: mốc xp tối thiểu → icon + tên cấp + màu tên cấp. */
export const STUDENT_LEVELS: ReadonlyArray<{ icon: string; name: string; minXp: number; color: string; glow?: boolean }> = [
  { icon: '🌱', name: 'Tân Binh', minXp: 0, color: '#cbd5e1' },
  { icon: '🐣', name: 'Tập Sự', minXp: 100, color: '#fde047' },
  { icon: '🐥', name: 'Chiến Binh', minXp: 250, color: '#facc15' },
  { icon: '🦊', name: 'Lão Luyện', minXp: 450, color: '#fb923c' },
  { icon: '🐺', name: 'Thợ Săn', minXp: 700, color: '#38bdf8' },
  { icon: '🦅', name: 'Đại Bàng', minXp: 1000, color: '#818cf8' },
  { icon: '🐉', name: 'Rồng Con', minXp: 1400, color: '#4ade80' },
  { icon: '🔥', name: 'Hỏa Long', minXp: 1900, color: '#f87171' },
  { icon: '⚡', name: 'Thần Tốc', minXp: 2500, color: '#e879f9' },
  { icon: '👑', name: 'Huyền Thoại', minXp: 3200, color: '#fbbf24', glow: true }
];

/** Suy cấp từ xp (thuần): xp âm coi như 0. */
export function levelFromXp(xp: number): StudentLevel {
  const safe = Math.max(0, Math.floor(xp || 0));
  let idx = 0;
  for (let i = 0; i < STUDENT_LEVELS.length; i++) {
    if (safe >= STUDENT_LEVELS[i].minXp) idx = i;
    else break;
  }
  const lv = STUDENT_LEVELS[idx];
  return { index: idx, icon: lv.icon, name: lv.name, minXp: lv.minXp, color: lv.color, glow: lv.glow === true };
}

/** Màu tên cấp từ xp — mọi nơi tô màu tên cấp dùng chung hàm này. */
export function levelColor(xp: number | undefined | null): string {
  return levelFromXp(typeof xp === 'number' ? xp : 0).color;
}

/** Icon cấp để gắn trước tên (mọi nơi render tên dùng chung hàm này). */
export function levelIcon(xp: number | undefined | null): string {
  return levelFromXp(typeof xp === 'number' ? xp : 0).icon;
}

/** Nhãn cấp đầy đủ "🐺 Thợ Săn" — dùng ở những chỗ có đủ chỗ (modal Top 10, màn kết). */
export function levelLabel(xp: number | undefined | null): string {
  const lv = levelFromXp(typeof xp === 'number' ? xp : 0);
  return `${lv.icon} ${lv.name}`;
}

/* ================= Mã máy học sinh (định danh bền toàn cục) ================= */

export const LS_STUDENT_DEVICE_ID = 'kc3d_student_device_id';
export const LS_STUDENT_XP_CACHE = 'kc3d_student_xp_cache';

/** Sinh mã máy học sinh STU-XXXXXX-XXXX từ nguồn ngẫu nhiên + mốc thời gian (thuần — test được). */
export function studentDeviceIdFromParts(randomPart: string, timePart: string): string {
  const clean = (s: string) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const r = (clean(randomPart) + 'XXXXXX').slice(0, 6);
  const t = clean(timePart).slice(-4).padStart(4, 'X');
  return `STU-${r}-${t}`;
}

/**
 * Mã máy bền TOÀN CỤC của điện thoại học sinh: đã lưu thì dùng lại vĩnh viễn
 * (không theo phòng, không theo tab); chưa có thì sinh 1 lần rồi lưu.
 */
export function getOrCreateStudentDeviceId(store: KeyValueStore): string {
  try {
    const existing = store.getItem(LS_STUDENT_DEVICE_ID);
    if (existing && existing.startsWith('STU-')) return existing;
  } catch { /* rơi xuống sinh mới */ }
  const id = studentDeviceIdFromParts(
    Math.random().toString(36).substring(2, 8),
    Date.now().toString(36)
  );
  try { store.setItem(LS_STUDENT_DEVICE_ID, id); } catch { /* bỏ qua */ }
  return id;
}

/** XP đã biết gần nhất của chính máy này (cache tại máy để ENTER gắn ngay, GET nền làm tươi sau). */
export function readCachedStudentXp(store: KeyValueStore): number {
  try {
    const v = parseInt(store.getItem(LS_STUDENT_XP_CACHE) || '', 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch { return 0; }
}

export function writeCachedStudentXp(store: KeyValueStore, xp: number): void {
  try { store.setItem(LS_STUDENT_XP_CACHE, String(Math.max(0, Math.floor(xp || 0)))); } catch { /* bỏ qua */ }
}

/* ================= Bản ghi + luật XP ================= */

export interface StudentLevelRecord {
  name: string;
  xp: number;
  matches: number;
  correct: number;
  wrong: number;
  lastMatchId: string;
  updatedAt: number;
}

export const XP_PER_CORRECT = 10;
export const XP_PER_WRONG = -3;
/** Thưởng cuối trận theo hạng BXH của host: hạng 1/2/3. */
export const XP_RANK_BONUS: ReadonlyArray<number> = [50, 30, 20];

export function rankBonus(rank: number): number {
  return rank >= 1 && rank <= XP_RANK_BONUS.length ? XP_RANK_BONUS[rank - 1] : 0;
}

/**
 * Delta XP của 1 HS trong 1 trận (thuần):
 *  - wrong = tổng số câu − đúng (câu không trả lời tính sai, nhất quán sổ GV).
 *  - delta = đúng×10 − sai×3 + thưởng hạng.
 */
export function computeMatchXpDelta(input: { correct: number; totalQuestions: number; rank: number }): { delta: number; wrong: number } {
  const total = Math.max(0, Math.floor(input.totalQuestions || 0));
  const correct = Math.min(Math.max(0, Math.floor(input.correct || 0)), total > 0 ? total : Math.max(0, Math.floor(input.correct || 0)));
  const wrong = Math.max(0, total - correct);
  const delta = correct * XP_PER_CORRECT + wrong * XP_PER_WRONG + rankBonus(input.rank);
  return { delta, wrong };
}

/** Thứ tự BXH cuối trận cho thưởng XP — KHỚP comparator của GrandFinaleScreen (BXH điểm thi đấu). */
export interface XpRankPlayer {
  id: string;
  correct?: number;
  wrongTotal?: number;
  fastScore?: number;
  lives?: number;
  eliminated?: boolean;
}

export function rankPlayersForXp<T extends XpRankPlayer>(players: T[], gameType: string): T[] {
  return [...players].sort((a, b) => {
    if (gameType === 'BELL') {
      if (!a.eliminated && b.eliminated) return -1;
      if (a.eliminated && !b.eliminated) return 1;
      if ((b.lives || 0) !== (a.lives || 0)) return (b.lives || 0) - (a.lives || 0);
    }
    if ((b.fastScore || 0) !== (a.fastScore || 0)) return (b.fastScore || 0) - (a.fastScore || 0);
    if ((b.correct || 0) !== (a.correct || 0)) return (b.correct || 0) - (a.correct || 0);
    return (a.wrongTotal || 0) - (b.wrongTotal || 0);
  });
}

/** Một khoản cập nhật XP host cần ghi cho 1 HS sau trận. */
export interface StudentXpUpdate {
  deviceId: string;
  name: string;
  correct: number;
  wrong: number;
  delta: number;
}

/**
 * Dựng danh sách cập nhật XP từ danh sách người chơi cuối trận (thuần):
 * chỉ HS có deviceId (client cũ không gắn thì bỏ qua — không ghi bừa), hạng
 * tính theo BXH cuối trận của host.
 */
export function buildXpUpdates(
  players: Array<XpRankPlayer & { deviceId?: string; label?: string }>,
  gameType: string,
  totalQuestions: number
): StudentXpUpdate[] {
  const ranked = rankPlayersForXp(players, gameType);
  const out: StudentXpUpdate[] = [];
  ranked.forEach((p, idx) => {
    if (!p.deviceId) return;
    const { delta, wrong } = computeMatchXpDelta({ correct: p.correct || 0, totalQuestions, rank: idx + 1 });
    out.push({ deviceId: p.deviceId, name: (p.label || '').trim(), correct: p.correct || 0, wrong, delta });
  });
  return out;
}

/**
 * Áp 1 khoản cập nhật lên bản ghi hiện có (thuần) — TRÁI TIM chống ghi đúp:
 * bản ghi đã mang lastMatchId của chính trận này → trả null (bỏ qua, không
 * cộng lần 2). Tên lấy bản mới nhất; xp chặn sàn 0 (hạ cấp tự suy ra).
 */
export function applyXpToRecord(
  existing: StudentLevelRecord | null,
  update: StudentXpUpdate,
  matchId: string,
  now: number
): StudentLevelRecord | null {
  if (existing && existing.lastMatchId === matchId) return null;
  const base: StudentLevelRecord = existing || { name: '', xp: 0, matches: 0, correct: 0, wrong: 0, lastMatchId: '', updatedAt: 0 };
  return {
    name: update.name || base.name || '',
    xp: Math.max(0, (base.xp || 0) + update.delta),
    matches: (base.matches || 0) + 1,
    correct: (base.correct || 0) + update.correct,
    wrong: (base.wrong || 0) + update.wrong,
    lastMatchId: matchId,
    updatedAt: now
  };
}

/**
 * Mã trận tất định phía host (thuần): suy từ phòng + đội hình + kết quả từng
 * HS + độ dài đề + chế độ chơi. Host F5 ở màn kết khôi phục đúng dữ liệu đó
 * → cùng mã trận → lớp chống đúp (cờ tại máy + lastMatchId trên Firebase)
 * chặn ghi lại. Một trận khác thực tế không thể trùng mã này.
 */
export function computeMatchId(
  roomId: string,
  players: Array<XpRankPlayer & { deviceId?: string }>,
  totalQuestions: number,
  gameType: string
): string {
  const core = players
    .map(p => `${p.id}:${p.deviceId || ''}:${p.correct || 0}:${p.wrongTotal || 0}:${p.fastScore || 0}`)
    .sort()
    .join('|');
  const h = cyrb53(`${roomId}#${gameType}#${totalQuestions}#${core}`, 23).toString(36).toUpperCase();
  return `M-${h}`;
}

/* ================= IO Firebase (kc3d_students) ================= */

export function studentRecordPath(deviceId: string): string {
  return 'kc3d_students/' + deviceId;
}

/** Đọc bản ghi của CHÍNH học sinh (phía HS lúc vào phòng): null = chưa có / lỗi mạng. */
export async function fetchOwnStudentRecord(fetchFn: FetchFn, deviceId: string): Promise<StudentLevelRecord | null> {
  try {
    const v = await fbGet(fetchFn, studentRecordPath(deviceId));
    if (!v || typeof v !== 'object') return null;
    return {
      name: typeof v.name === 'string' ? v.name : '',
      xp: typeof v.xp === 'number' ? v.xp : 0,
      matches: typeof v.matches === 'number' ? v.matches : 0,
      correct: typeof v.correct === 'number' ? v.correct : 0,
      wrong: typeof v.wrong === 'number' ? v.wrong : 0,
      lastMatchId: typeof v.lastMatchId === 'string' ? v.lastMatchId : '',
      updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : 0
    };
  } catch {
    return null;
  }
}

/**
 * Ghi XP cho 1 HS (phía HOST cuối trận): đọc bản ghi hiện tại → chống đúp
 * theo lastMatchId → PUT bản ghi đã cộng. Trả 'written' | 'skipped' | 'failed'.
 */
export async function writeStudentXpOnce(
  fetchFn: FetchFn,
  update: StudentXpUpdate,
  matchId: string,
  now: number
): Promise<'written' | 'skipped' | 'failed'> {
  try {
    const existingRaw = await fbGet(fetchFn, studentRecordPath(update.deviceId));
    const existing: StudentLevelRecord | null = existingRaw && typeof existingRaw === 'object'
      ? {
          name: typeof existingRaw.name === 'string' ? existingRaw.name : '',
          xp: typeof existingRaw.xp === 'number' ? existingRaw.xp : 0,
          matches: typeof existingRaw.matches === 'number' ? existingRaw.matches : 0,
          correct: typeof existingRaw.correct === 'number' ? existingRaw.correct : 0,
          wrong: typeof existingRaw.wrong === 'number' ? existingRaw.wrong : 0,
          lastMatchId: typeof existingRaw.lastMatchId === 'string' ? existingRaw.lastMatchId : '',
          updatedAt: typeof existingRaw.updatedAt === 'number' ? existingRaw.updatedAt : 0
        }
      : null;
    const next = applyXpToRecord(existing, update, matchId, now);
    if (!next) return 'skipped';
    await fbPut(fetchFn, studentRecordPath(update.deviceId), next);
    return 'written';
  } catch {
    return 'failed';
  }
}

export interface FlushXpSummary {
  written: number;
  skipped: number;
  failed: number;
}

export interface FlushXpDeps {
  fetchFn: FetchFn;
  now: () => number;
  /** Chờ giữa các lô (tiêm để test chạy tức thì). Mặc định: setTimeout. */
  delay?: (ms: number) => Promise<void>;
  batchSize?: number;
  batchGapMs?: number;
}

const defaultDelay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Xả toàn bộ cập nhật XP của 1 trận (phía HOST): ghi rải theo lô nhỏ, mỗi
 * khoản lỗi thử lại tối đa 1 lần, KHÔNG bao giờ ném lỗi ra ngoài (màn kết
 * không được phép bị ảnh hưởng). Nơi gọi cứ fire-and-forget.
 */
export async function flushMatchXp(
  deps: FlushXpDeps,
  updates: StudentXpUpdate[],
  matchId: string
): Promise<FlushXpSummary> {
  const summary: FlushXpSummary = { written: 0, skipped: 0, failed: 0 };
  const delay = deps.delay || defaultDelay;
  const batchSize = Math.max(1, deps.batchSize || 5);
  const batchGapMs = typeof deps.batchGapMs === 'number' ? deps.batchGapMs : 200;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    await Promise.all(batch.map(async (u) => {
      let r = await writeStudentXpOnce(deps.fetchFn, u, matchId, deps.now());
      if (r === 'failed') {
        r = await writeStudentXpOnce(deps.fetchFn, u, matchId, deps.now());
      }
      if (r === 'written') summary.written++;
      else if (r === 'skipped') summary.skipped++;
      else summary.failed++;
    }));
    if (i + batchSize < updates.length && batchGapMs > 0) {
      await delay(batchGapMs);
    }
  }
  return summary;
}
