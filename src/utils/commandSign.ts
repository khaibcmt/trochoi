/**
 * Đợt 8 (4C.2): CHỮ KÝ LỆNH ĐIỀU KHIỂN BẰNG KHOÁ PHÒNG — HMAC-SHA256.
 *
 * Bối cảnh: broker MQTT là broker CÔNG CỘNG không xác thực, topic phòng đoán được
 * (thptmangthit_kc3d_<mã 5 số>) nên bất kỳ ai cũng publish được lệnh giả kiểu
 * CLEAR_ALL_STUDENTS / MATCH_ENDED để phá phòng. Chốt chặn thực dụng: khi tạo phòng,
 * host sinh một KHOÁ PHÒNG ngẫu nhiên, nhúng vào link QR của học sinh (tham số &k=...).
 * Mọi lệnh điều khiển nhạy cảm đều được host KÝ bằng khoá này trước khi publish;
 * phía HS kiểm tra chữ ký TRƯỚC khi thi hành — lệnh sai/thiếu chữ ký (khi HS có khoá)
 * bị bỏ qua. Phòng tạo từ bản cũ (host không ký, HS không có khoá trong link) thì
 * hành vi giữ nguyên như trước (tương thích ngược).
 *
 * THIẾT KẾ CHUỖI KÝ (canonical): ký trên type + các trường CỐT LÕI của lệnh theo thứ
 * tự cố định CANONICAL_FIELDS bên dưới, mỗi trường serialize ổn định (stable stringify:
 * khoá object sắp xếp theo alphabet đệ quy). KHÔNG ký các trường meta thay đổi theo
 * lần phát: _mid, ts, serverTs, sig và mảng quiz (chỉ ký quizHash đại diện) — nhờ vậy
 * bản retained …/state (được network.ts tạo lại _mid) và bản phát lại từ hàng đợi
 * offline vẫn giữ chữ ký hợp lệ. Nội dung `question` cũng KHÔNG nằm trong chuỗi ký:
 * câu quá lớn (ảnh base64) bị network.ts tách khỏi gói lệnh để đi đường chunk riêng
 * (Đợt 3), ký cả question sẽ làm HS verify hỏng lệnh thật; nội dung câu được neo
 * gián tiếp bằng quizHash + qIndex/serverStartTime/durationSec đều đã ký.
 * GIỚI HẠN đã biết: chữ ký không kèm nonce/mốc tươi riêng nên một lệnh ĐÃ KÝ bị kẻ
 * tấn công ghi lại vẫn có thể bị PHÁT LẠI nguyên văn trong cùng phòng (replay);
 * cơ chế này chặn phá hoại tuỳ tiện (không có khoá thì không bịa được lệnh mới),
 * không thay thế được broker có xác thực.
 *
 * ĐỘNG CƠ KÝ: đường publish của network.ts là ĐỒNG BỘ nên chữ ký được tính bằng bản
 * cài HMAC-SHA256 thuần TS trong file này (signCommandSync/verifyCommandSync).
 * Cặp hàm bất đồng bộ signCommand/verifyCommand dùng Web Crypto (crypto.subtle) khi
 * khả dụng và TỰ rơi về bản thuần TS khi crypto.subtle không tồn tại — cả hai đường
 * cho cùng một kết quả (đã kiểm chứng bằng vector HMAC-SHA256 chuẩn trong script test).
 */

/** Các loại lệnh ĐIỀU KHIỂN nhạy cảm bắt buộc ký khi host có khoá phòng. */
export const SENSITIVE_COMMAND_TYPES = new Set<string>([
  'CLEAR_ALL_STUDENTS',
  'RESET_ROOM_SESSION',
  'MATCH_ENDED',
  'GAME_SWITCHED',
  'GAME_SWITCH',
  'QUESTION_START',
  'FORCE_START_MATCH',
  'MATCH_START',
  'FORCE_PULL_TO_WAITING',
  'PAUSE_TOGGLE'
]);

export function isSensitiveCommand(type: string | undefined | null): boolean {
  return Boolean(type && SENSITIVE_COMMAND_TYPES.has(type));
}

/** Thứ tự trường cốt lõi được ký — CỐ ĐỊNH, không đổi giữa các phiên bản đang chạy lẫn nhau. */
const CANONICAL_FIELDS = [
  'type',
  'roomId',
  'gameType',
  'status',
  'matchStatus',
  'globalQIndex',
  'qIndex',
  'currentRound',
  'forcePullTs',
  'serverStartTime',
  'durationSec',
  'winner',
  'subj',
  'quizHash',
  'worldEvent'
] as const;

/** Serialize ổn định: khoá object sắp xếp alphabet (đệ quy), mảng giữ nguyên thứ tự. */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(v => stableStringify(v)).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const parts: string[] = [];
    for (const k of keys) {
      const v = (value as Record<string, unknown>)[k];
      if (v === undefined) continue;
      parts.push(JSON.stringify(k) + ':' + stableStringify(v));
    }
    return '{' + parts.join(',') + '}';
  }
  return JSON.stringify(String(value));
}

/**
 * Chuỗi canonical được ký cho 1 lệnh: "field=value|field=value|..." theo CANONICAL_FIELDS,
 * chỉ gồm các trường THẬT SỰ có mặt (khác undefined/null) trong payload.
 */
export function canonicalCommandString(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const field of CANONICAL_FIELDS) {
    const raw = payload[field];
    if (raw === undefined || raw === null) continue;
    parts.push(field + '=' + stableStringify(raw));
  }
  return parts.join('|');
}

// ---------------------------------------------------------------------------
// SHA-256 thuần TS (FIPS 180-4) — động cơ đồng bộ + fallback khi thiếu Web Crypto
// ---------------------------------------------------------------------------

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

export function sha256Bytes(data: Uint8Array): Uint8Array {
  const H = new Int32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);
  const bitLenHi = Math.floor((data.length * 8) / 0x100000000);
  const bitLenLo = (data.length * 8) >>> 0;
  const paddedLen = (((data.length + 9 + 63) >> 6) << 6);
  const buf = new Uint8Array(paddedLen);
  buf.set(data);
  buf[data.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(paddedLen - 4, bitLenLo);
  view.setUint32(paddedLen - 8, bitLenHi);

  const w = new Int32Array(64);
  for (let block = 0; block < paddedLen; block += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getInt32(block + t * 4);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[t] + w[t]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setInt32(i * 4, H[i]);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function utf8Bytes(str: string): Uint8Array<ArrayBuffer> {
  // Ép kiểu ArrayBuffer để khớp chữ ký BufferSource của Web Crypto (crypto.subtle).
  return new TextEncoder().encode(str) as Uint8Array<ArrayBuffer>;
}

/** HMAC-SHA256 (RFC 2104) thuần TS trên chuỗi UTF-8 — trả hex. */
export function hmacSha256HexSync(key: string, message: string): string {
  const BLOCK = 64;
  let keyBytes: Uint8Array = utf8Bytes(key);
  if (keyBytes.length > BLOCK) {
    keyBytes = sha256Bytes(keyBytes);
  }
  const innerPad = new Uint8Array(BLOCK);
  const outerPad = new Uint8Array(BLOCK);
  for (let i = 0; i < BLOCK; i++) {
    const kb = i < keyBytes.length ? keyBytes[i] : 0;
    innerPad[i] = kb ^ 0x36;
    outerPad[i] = kb ^ 0x5c;
  }
  const msgBytes = utf8Bytes(message);
  const innerData = new Uint8Array(BLOCK + msgBytes.length);
  innerData.set(innerPad);
  innerData.set(msgBytes, BLOCK);
  const innerHash = sha256Bytes(innerData);
  const outerData = new Uint8Array(BLOCK + innerHash.length);
  outerData.set(outerPad);
  outerData.set(innerHash, BLOCK);
  return bytesToHex(sha256Bytes(outerData));
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// API ký / kiểm tra chữ ký lệnh
// ---------------------------------------------------------------------------

/** Ký 1 lệnh điều khiển (ĐỒNG BỘ, thuần TS) — dùng trên đường publish của network.ts. */
export function signCommandSync(key: string, payload: Record<string, unknown>): string {
  return hmacSha256HexSync(key, canonicalCommandString(payload));
}

/** Kiểm tra chữ ký 1 lệnh nhận được (ĐỒNG BỘ, thuần TS). Thiếu khoá/chữ ký → false. */
export function verifyCommandSync(
  key: string | null | undefined,
  payload: Record<string, unknown>,
  signature: string | null | undefined
): boolean {
  if (!key || !signature) return false;
  try {
    return constantTimeEqualHex(signCommandSync(key, payload), String(signature).toLowerCase());
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 🛡️ CHỐNG AI NGOÀI (18/11/2026): chữ ký cho tin BÁO CÁO VI PHẠM rời màn hình
// (SCREEN_LEAVE_REPORT, HS → host). Tin này KHÔNG phải lệnh điều khiển nên
// không nằm trong SENSITIVE_COMMAND_TYPES (tránh bị bộ đếm "lệnh lạ" phía
// host và cổng kiểm chữ ký phía HS đối xử như lệnh phá phòng); thay vào đó
// nó dùng CÙNG cơ chế HMAC-SHA256 + khoá phòng nhưng với danh sách trường
// canonical RIÊNG bên dưới — danh sách này không đụng vào CANONICAL_FIELDS
// của lệnh điều khiển nên chữ ký của mọi lệnh cũ giữ nguyên từng byte.
// Phía HS ký bằng khoá trích từ link QR (&k=...); phía host kiểm bằng khoá
// phòng của chính host trước khi ghi nhận vi phạm vào sổ.
// ---------------------------------------------------------------------------

/** Loại tin báo cáo vi phạm rời màn hình thi (HS → host). */
export const SCREEN_LEAVE_REPORT_TYPE = 'SCREEN_LEAVE_REPORT';

/** Trường cốt lõi được ký của báo cáo vi phạm — CỐ ĐỊNH, tách riêng khỏi CANONICAL_FIELDS. */
const VIOLATION_CANONICAL_FIELDS = [
  'type',
  'roomId',
  'playerId',
  'studentId',
  'globalQIndex',
  'awaySec',
  'awaySource',
  'violationSeq'
] as const;

/** Chuỗi canonical của 1 báo cáo vi phạm: "field=value|..." theo VIOLATION_CANONICAL_FIELDS. */
export function violationCanonicalString(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const field of VIOLATION_CANONICAL_FIELDS) {
    const raw = payload[field];
    if (raw === undefined || raw === null) continue;
    parts.push(field + '=' + stableStringify(raw));
  }
  return parts.join('|');
}

/** Ký 1 báo cáo vi phạm bằng khoá phòng (ĐỒNG BỘ, thuần TS — cùng động cơ HMAC của lệnh). */
export function signViolationReportSync(key: string, payload: Record<string, unknown>): string {
  return hmacSha256HexSync(key, violationCanonicalString(payload));
}

/** Kiểm tra chữ ký 1 báo cáo vi phạm nhận được. Thiếu khoá/chữ ký → false. */
export function verifyViolationReportSync(
  key: string | null | undefined,
  payload: Record<string, unknown>,
  signature: string | null | undefined
): boolean {
  if (!key || !signature) return false;
  try {
    return constantTimeEqualHex(
      signViolationReportSync(key, payload),
      String(signature).toLowerCase()
    );
  } catch {
    return false;
  }
}

/**
 * Lệnh điều khiển LẠ dưới mắt HOST (thuần): là lệnh nhạy cảm phát trên topic
 * phòng nhưng chữ ký KHÔNG đúng khoá phòng (giả mạo / sai khoá / thiếu chữ
 * ký). Tin nội bộ từ kênh HTTP của máy chủ (tiền tố _mid 'srv_') được miễn —
 * cùng quy ước phía HS đang dùng. Không có khoá phòng → không kết luận được
 * → false. Phía host dùng để ĐẾM thầm (chỉ báo nhỏ trên máy thầy); phía HS
 * KHÔNG hiển thị gì về việc này (chốt của thầy 17/11).
 */
export function isForeignControlCommand(
  payload: Record<string, unknown> & { type?: unknown; sig?: unknown; _mid?: unknown },
  roomKey: string | null | undefined
): boolean {
  if (!roomKey) return false;
  if (!isSensitiveCommand(typeof payload.type === 'string' ? payload.type : undefined)) return false;
  if (typeof payload._mid === 'string' && payload._mid.startsWith('srv_')) return false;
  return !verifyCommandSync(roomKey, payload, typeof payload.sig === 'string' ? payload.sig : undefined);
}

function subtleAvailable(): boolean {
  try {
    return (
      typeof globalThis !== 'undefined' &&
      Boolean((globalThis as any).crypto) &&
      Boolean((globalThis as any).crypto.subtle) &&
      typeof (globalThis as any).crypto.subtle.importKey === 'function'
    );
  } catch {
    return false;
  }
}

async function hmacSha256HexSubtle(key: string, message: string): Promise<string> {
  const subtle = (globalThis as any).crypto.subtle as SubtleCrypto;
  const cryptoKey = await subtle.importKey(
    'raw',
    utf8Bytes(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await subtle.sign('HMAC', cryptoKey, utf8Bytes(message));
  return bytesToHex(new Uint8Array(sig));
}

/**
 * Ký 1 lệnh điều khiển: dùng Web Crypto (crypto.subtle) khi khả dụng (trang chạy HTTPS
 * nên thường khả dụng), rơi về bản thuần TS đồng bộ khi crypto.subtle không tồn tại.
 */
export async function signCommand(key: string, payload: Record<string, unknown>): Promise<string> {
  const canonical = canonicalCommandString(payload);
  if (subtleAvailable()) {
    return hmacSha256HexSubtle(key, canonical);
  }
  return hmacSha256HexSync(key, canonical);
}

/** Kiểm tra chữ ký 1 lệnh: cùng cơ chế chọn động cơ như signCommand. */
export async function verifyCommand(
  key: string | null | undefined,
  payload: Record<string, unknown>,
  signature: string | null | undefined
): Promise<boolean> {
  if (!key || !signature) return false;
  try {
    const expected = await signCommand(key, payload);
    return constantTimeEqualHex(expected, String(signature).toLowerCase());
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Khoá phòng: sinh mới, lưu/đọc theo phòng (phía host), trích từ link (phía HS)
// ---------------------------------------------------------------------------

/** Sinh khoá phòng ngẫu nhiên 32 byte dạng hex (64 ký tự). */
export function generateRoomKey(): string {
  try {
    const c = (globalThis as any).crypto;
    if (c && typeof c.getRandomValues === 'function') {
      const arr = new Uint8Array(32);
      c.getRandomValues(arr);
      return bytesToHex(arr);
    }
  } catch {}
  // Fallback yếu hơn (chỉ khi môi trường không có CSPRNG): vẫn đủ dài/ngẫu nhiên thực dụng.
  let out = '';
  for (let i = 0; i < 64; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

export function roomKeyStorageKey(roomId: string): string {
  return `kc3d_room_key_${String(roomId || '').replace(/[^a-zA-Z0-9]/g, '')}`;
}

/**
 * Phía HOST: lấy khoá phòng đã lưu cho phòng này, chưa có thì sinh mới + lưu
 * (localStorage — khoá sống cùng phòng qua F5, link QR vì thế không đổi giữa chừng).
 */
export function getOrCreateRoomKey(roomId: string): string {
  const storageKey = roomKeyStorageKey(roomId);
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved && saved.length >= 32) return saved;
  } catch {}
  const fresh = generateRoomKey();
  try {
    localStorage.setItem(storageKey, fresh);
  } catch {}
  return fresh;
}

/** Phía HOST: đọc khoá đã có của phòng (không tự sinh) — null nếu phòng chưa từng có khoá. */
export function getStoredRoomKey(roomId: string): string | null {
  try {
    const saved = localStorage.getItem(roomKeyStorageKey(roomId));
    return saved && saved.length >= 32 ? saved : null;
  } catch {
    return null;
  }
}

/**
 * Phía HS: trích khoá phòng (tham số k) từ link — đọc CẢ query (?...) lẫn hash
 * (#r=...&k=...) giống cách đọc bk ở Đợt 1, vì link qua Zalo thường nằm trong hash.
 * Hàm thuần (nhận chuỗi search/hash) để test được.
 */
export function extractRoomKeyFromUrlParts(search: string, hash: string): string | null {
  try {
    const combined = new URLSearchParams(search || '');
    const hashStr = hash || '';
    if (hashStr.length > 1) {
      const qIdx = hashStr.indexOf('?');
      const hashQuery = qIdx !== -1 ? hashStr.substring(qIdx + 1) : hashStr.replace(/^#\/?/, '');
      const hashParams = new URLSearchParams(hashQuery);
      hashParams.forEach((val, key) => {
        if (!combined.has(key)) combined.set(key, val);
      });
    }
    const k = combined.get('k');
    return k && k.length >= 32 ? k : null;
  } catch {
    return null;
  }
}
