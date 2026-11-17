/**
 * BẢN QUYỀN ĐẤU TRƯỜNG 3D (nâng cấp 17/11/2026) — mẫu Học Liệu Vip Pro, subtree
 * RIÊNG kc3d_* trên cùng RTDB edumaster-online, tuyệt đối không đụng hlv_*.
 *
 * Quy tắc do thầy chốt:
 *  - Hai nút "➕ Thêm Đề Mới" và "💾 Lưu Đề Này" bị khoá bởi CỬA ĐĂNG KÝ: máy
 *    chưa kích hoạt nhấn vào → modal đăng ký (email, họ tên GV, trường) → ghi
 *    kc3d_requests/<mã máy> rồi TỰ ĐỘNG DUYỆT NGAY (ghi kc3d_licenses/<mã máy>
 *    status 'active', by 'auto') → mở khoá cả 2 nút vĩnh viễn trên máy đó.
 *    Thầy không duyệt tay; chỉ khoá lại khi cần ở panel Quản lý máy.
 *  - Mã máy bền KC3D-XXXX-XXXX: vân tay thiết bị + bộ nhớ đệm tại máy (như
 *    HLVM của Học Liệu).
 *  - Admin 2 khoá: khoá 1 = MÃ CHỦ dùng chung các trang của thầy (kiểm chứng
 *    bằng SHA-256 — cùng cơ chế + cùng giá trị hash như Học Liệu); khoá 2 =
 *    mã cá nhân thầy tự đặt lần đầu, lưu HASH ở Firebase (kc3d_admin/pwHash)
 *    + bản hash tại máy. Máy quen (có hash tại máy): đối chiếu tại máy, mở
 *    được thì ghi nhớ phiên. Máy lạ (không có hash tại máy): đối chiếu hash
 *    lấy từ Firebase và KHÔNG ghi nhớ gì (không lưu hash, không lưu phiên —
 *    đóng/tải lại trang là khoá).
 *  - Trạng thái kích hoạt được kiểm lại với Firebase khi tải trang: license
 *    'locked' → mất quyền; lỗi mạng/không có bản ghi → giữ trạng thái đã lưu
 *    tại máy, không khoá oan.
 *
 * File này là LOGIC THUẦN + IO qua interface tiêm (store/fetch) để kiểm chứng
 * bằng test độc lập; phần React nằm ở components/LicenseGate.tsx.
 */

/* ================= Băm ================= */

/** cyrb53 — cùng hàm Học Liệu dùng cho vân tay máy. */
export function cyrb53(str: string, seed: number): number {
  let h1 = 0xdeadbeef ^ (seed | 0);
  let h2 = 0x41c6ce57 ^ (seed | 0);
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

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

/** SHA-256 thuần JS (dự phòng khi crypto.subtle không có — vai trò như hlSha256Js của Học Liệu). */
export function sha256HexJs(input: string): string {
  const utf8 = unescape(encodeURIComponent(input));
  const bytes: number[] = [];
  for (let i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i) & 0xff);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  bytes.push(0, 0, 0, 0, (bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);
  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const w = new Array<number>(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let block = 0; block < bytes.length; block += 64) {
    for (let t = 0; t < 16; t++) {
      const o = block + t * 4;
      w[t] = (bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3];
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
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

/** SHA-256 hex: ưu tiên crypto.subtle (như hlSha256 của Học Liệu), dự phòng JS thuần. */
export async function sha256Hex(text: string): Promise<string> {
  try {
    const subtle = (globalThis as any).crypto?.subtle;
    if (subtle) {
      const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* rơi xuống JS thuần */ }
  return sha256HexJs(text);
}

/* ================= Mã máy ================= */

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const LS_MACHINE_ID = 'kc3d_machine_id';
export const LS_ACTIVATED = 'kc3d_activated';
export const LS_LIC_INFO = 'kc3d_lic_info';
export const LS_ADMIN_PW_HASH = 'kc3d_admin_pw_hash';
export const LS_ADMIN_UNTIL = 'kc3d_admin_until';

/** Sinh mã máy KC3D-XXXX-XXXX từ chuỗi vân tay thô (thuần — test được). */
export function machineIdFromFingerprint(fp: string): string {
  const raw = (cyrb53(fp, 11).toString(36) + cyrb53(fp, 97).toString(36))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const padded = (raw + 'XXXXXXXX').slice(0, 8);
  return 'KC3D-' + padded.slice(0, 4) + '-' + padded.slice(4, 8);
}

function deviceFingerprint(): string {
  const parts: string[] = [];
  try {
    const nav: any = (globalThis as any).navigator || {};
    const scr: any = (globalThis as any).screen || {};
    parts.push(nav.platform || '');
    parts.push(String(nav.userAgent || '').replace(/\d+(\.\d+)*/g, 'x'));
    parts.push((scr.width || 0) + 'x' + (scr.height || 0) + 'x' + (scr.colorDepth || 0));
    try { parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || ''); } catch { parts.push(''); }
    parts.push(String(nav.hardwareConcurrency || ''));
    parts.push(String(nav.deviceMemory || ''));
    parts.push(String(nav.maxTouchPoints || 0));
    parts.push(((nav.languages || []) as string[]).join(','));
    try {
      const cv = document.createElement('canvas');
      cv.width = 240; cv.height = 60;
      const cx = cv.getContext('2d');
      if (cx) {
        cx.font = '16px Arial'; cx.fillStyle = '#37a'; cx.fillText('DauTruong3D', 4, 22);
        cx.fillStyle = 'rgba(200,40,40,.6)'; cx.fillRect(30, 8, 90, 14);
        const du = cv.toDataURL();
        parts.push(du.length + ':' + cyrb53(du, 7));
      }
    } catch { /* bỏ qua */ }
  } catch { /* bỏ qua */ }
  return parts.join('|');
}

/** Mã máy bền của máy này: đã lưu thì dùng lại, chưa có thì sinh từ vân tay rồi lưu. */
export function getMachineId(store: KeyValueStore): string {
  let id = '';
  try { id = store.getItem(LS_MACHINE_ID) || ''; } catch { id = ''; }
  if (!id) {
    id = machineIdFromFingerprint(deviceFingerprint());
    try { store.setItem(LS_MACHINE_ID, id); } catch { /* bỏ qua */ }
  }
  return id;
}

/* ================= Kích hoạt tại máy ================= */

export interface LicInfo {
  email: string;
  name: string;
  school: string;
  at: number;
}

export function readLocalActivation(store: KeyValueStore): { activated: boolean; info: LicInfo | null } {
  try {
    if (store.getItem(LS_ACTIVATED) !== '1') return { activated: false, info: null };
    const raw = store.getItem(LS_LIC_INFO);
    return { activated: true, info: raw ? (JSON.parse(raw) as LicInfo) : null };
  } catch {
    return { activated: false, info: null };
  }
}

export function writeLocalActivation(store: KeyValueStore, info: LicInfo): void {
  try {
    store.setItem(LS_ACTIVATED, '1');
    store.setItem(LS_LIC_INFO, JSON.stringify(info));
  } catch { /* bỏ qua */ }
}

export function clearLocalActivation(store: KeyValueStore): void {
  try {
    store.removeItem(LS_ACTIVATED);
    store.removeItem(LS_LIC_INFO);
  } catch { /* bỏ qua */ }
}

/** Cửa đăng ký: Admin hoặc máy đã kích hoạt thì 2 nút chạy thẳng. */
export function gateAllows(opts: { isAdmin: boolean; activated: boolean }): boolean {
  return opts.isAdmin || opts.activated;
}

export type RemoteLicStatus = 'active' | 'locked' | 'none' | 'error';

/**
 * Áp trạng thái từ Firebase lên trạng thái đã lưu (thuần):
 *  - 'active' → kích hoạt; 'locked' → mất quyền (khoá từ xa có hiệu lực);
 *  - 'none' (chưa có bản ghi) / 'error' (mất mạng) → GIỮ trạng thái đã lưu,
 *    không khoá oan.
 */
export function applyRemoteStatus(localActivated: boolean, remote: RemoteLicStatus): boolean {
  if (remote === 'active') return true;
  if (remote === 'locked') return false;
  return localActivated;
}

/* ================= Firebase REST (RTDB edumaster-online) ================= */

export const FB_BASE = 'https://edumaster-online-default-rtdb.asia-southeast1.firebasedatabase.app';

export type FetchFn = (
  url: string,
  opts?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

export const defaultFetch: FetchFn = (url, opts) =>
  (globalThis as any).fetch(url, opts) as Promise<any>;

export function fbUrl(path: string): string {
  return FB_BASE + '/' + path + '.json';
}

export async function fbGet(fetchFn: FetchFn, path: string): Promise<any> {
  const res = await fetchFn(fbUrl(path), { method: 'GET' });
  if (!res.ok) throw new Error('FB GET ' + path + ' -> ' + res.status);
  return res.json();
}

export async function fbPut(fetchFn: FetchFn, path: string, data: any): Promise<void> {
  const res = await fetchFn(fbUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('FB PUT ' + path + ' -> ' + res.status);
}

export async function fbPatch(fetchFn: FetchFn, path: string, data: any): Promise<void> {
  const res = await fetchFn(fbUrl(path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('FB PATCH ' + path + ' -> ' + res.status);
}

/* ================= Đăng ký + tự động duyệt ================= */

export interface RegInfo {
  email: string;
  name: string;
  school: string;
}

export function validateRegistration(info: RegInfo): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email.trim())) return 'Nhập địa chỉ email đúng định dạng nhé';
  if (!info.name.trim()) return 'Thầy cô điền họ và tên giáo viên nhé';
  if (!info.school.trim()) return 'Thầy cô điền tên trường nhé';
  return null;
}

export interface LicDeps {
  fetchFn: FetchFn;
  store: KeyValueStore;
  now: () => number;
  ua?: string;
}

/**
 * Gửi đăng ký: ghi kc3d_requests/<mid> TRƯỚC, rồi tự động duyệt (ghi
 * kc3d_licenses/<mid> status 'active'), cuối cùng mới lưu kích hoạt tại máy.
 * Bất kỳ bước ghi nào lỗi → ok:false và KHÔNG mở khoá.
 */
export interface SubmitResult {
  ok: boolean;
  step?: 'request' | 'license';
  message?: string;
}

export async function submitRegistration(
  deps: LicDeps,
  mid: string,
  info: RegInfo
): Promise<SubmitResult> {
  const at = deps.now();
  const clean: RegInfo = { email: info.email.trim(), name: info.name.trim(), school: info.school.trim() };
  try {
    await fbPut(deps.fetchFn, 'kc3d_requests/' + mid, { ...clean, at, ua: (deps.ua || '').slice(0, 140) });
  } catch (e: any) {
    return { ok: false, step: 'request', message: 'Gửi đăng ký chưa được — kiểm tra mạng rồi thử lại nhé (' + (e?.message || e) + ')' };
  }
  try {
    await fbPut(deps.fetchFn, 'kc3d_licenses/' + mid, { status: 'active', ...clean, at, by: 'auto' });
  } catch (e: any) {
    return { ok: false, step: 'license', message: 'Đã ghi đăng ký nhưng kích hoạt chưa được — thử lại nhé (' + (e?.message || e) + ')' };
  }
  writeLocalActivation(deps.store, { ...clean, at });
  return { ok: true };
}

/** Đọc trạng thái license từ Firebase: 'error' khi mất mạng/hỏng — nơi gọi giữ trạng thái cũ. */
export async function fetchRemoteStatus(fetchFn: FetchFn, mid: string): Promise<RemoteLicStatus> {
  try {
    const lic = await fbGet(fetchFn, 'kc3d_licenses/' + mid);
    if (!lic) return 'none';
    return lic.status === 'locked' ? 'locked' : 'active';
  } catch {
    return 'error';
  }
}

/* ================= Admin 2 khoá ================= */

/**
 * Hash SHA-256 của MÃ CHỦ — CÙNG giá trị Học Liệu đang dùng để kiểm chứng
 * (HL_ADMIN_HASH / HL_ADMIN_HASH2 bên Học Liệu; bản thứ hai là biến thể gõ
 * thiếu dấu của cùng một mã, nhận cả hai cho khỏi nhầm). Chỉ lưu HASH.
 */
export const MASTER_HASHES: string[] = [
  'be7e5cf0fda9a345fc1ef61cb127b0db72fb8c915d72df043468d858d4c5ee3d',
  '0eb8de755cf51e222ac7049e90f664fd1f4e7be66fe654940992609056aaeee1'
];

export async function verifyMasterCode(input: string): Promise<boolean> {
  const h = await sha256Hex((input || '').trim());
  return MASTER_HASHES.indexOf(h) >= 0;
}

export async function verifyPw2(input: string, expectedHash: string): Promise<boolean> {
  if (!expectedHash) return false;
  const h = await sha256Hex((input || '').trim());
  return h === expectedHash;
}

/** Thời hạn ghi nhớ phiên Admin trên máy quen: 30 ngày (như hl_admin_until của Học Liệu). */
export const ADMIN_REMEMBER_MS = 30 * 24 * 3600 * 1000;

export function getLocalPwHash(store: KeyValueStore): string {
  try { return store.getItem(LS_ADMIN_PW_HASH) || ''; } catch { return ''; }
}

export function setLocalPwHash(store: KeyValueStore, hash: string): void {
  try { store.setItem(LS_ADMIN_PW_HASH, hash); } catch { /* bỏ qua */ }
}

/** Đọc hash mã 2 từ Firebase: null = chưa ai đặt; 'error' = không đọc được. */
export async function fetchRemotePwHash(fetchFn: FetchFn): Promise<string | null | 'error'> {
  try {
    const v = await fbGet(fetchFn, 'kc3d_admin/pwHash');
    return typeof v === 'string' && v ? v : null;
  } catch {
    return 'error';
  }
}

export async function saveRemotePwHash(fetchFn: FetchFn, hash: string): Promise<void> {
  await fbPut(fetchFn, 'kc3d_admin/pwHash', hash);
}

export type Pw2Step = 'create' | 'local' | 'remote' | 'blocked';

/**
 * Quyết định bước mã 2 sau khi mã chủ đã đúng (thuần):
 *  - Máy có hash tại máy → 'local' (đối chiếu tại máy, mở được thì ghi nhớ phiên).
 *  - Máy lạ + Firebase có hash → 'remote' (đối chiếu hash từ Firebase, KHÔNG ghi nhớ).
 *  - Chưa nơi nào có hash → 'create' (lần đầu thầy đặt mã 2).
 *  - Máy lạ + không đọc được Firebase → 'blocked' (không cho tạo mới — tránh
 *    ghi đè mã 2 đã có mà máy này chưa biết; cũng không cho vào).
 */
export function decidePw2Step(localHash: string, remoteHash: string | null | 'error'): Pw2Step {
  if (localHash) return 'local';
  if (remoteHash === 'error') return 'blocked';
  if (remoteHash) return 'remote';
  return 'create';
}

/** Phiên Admin còn hiệu lực? (phiên ghi nhớ tại máy HOẶC phiên trong bộ nhớ — máy lạ). */
export function isAdminActive(store: KeyValueStore, memSession: boolean, now: number): boolean {
  if (memSession) return true;
  try { return (+(store.getItem(LS_ADMIN_UNTIL) || 0) || 0) > now; } catch { return false; }
}

/**
 * Bắt đầu phiên Admin. remember=true (máy quen): ghi mốc hết hạn vào máy.
 * remember=false (máy lạ): KHÔNG ghi gì vào máy — nơi gọi chỉ giữ cờ trong bộ
 * nhớ, đóng/tải lại trang là khoá.
 */
export function beginAdminSession(store: KeyValueStore, remember: boolean, now: number): void {
  if (!remember) return;
  try { store.setItem(LS_ADMIN_UNTIL, String(now + ADMIN_REMEMBER_MS)); } catch { /* bỏ qua */ }
}

export function endAdminSession(store: KeyValueStore): void {
  try { store.removeItem(LS_ADMIN_UNTIL); } catch { /* bỏ qua */ }
}

/* ================= Quản lý máy (Admin) ================= */

export interface MachineRow {
  mid: string;
  email: string;
  name: string;
  school: string;
  at: number;
  status: 'active' | 'locked' | 'pending';
  hasLicense: boolean;
}

/** Gộp kc3d_requests + kc3d_licenses thành danh sách máy (thuần). */
export function mergeMachines(
  requests: Record<string, any> | null,
  licenses: Record<string, any> | null
): MachineRow[] {
  const mids = new Set<string>();
  Object.keys(requests || {}).forEach(k => mids.add(k));
  Object.keys(licenses || {}).forEach(k => mids.add(k));
  const rows: MachineRow[] = [];
  mids.forEach(mid => {
    const req = (requests || {})[mid] || {};
    const lic = (licenses || {})[mid] || null;
    const src = lic || req;
    rows.push({
      mid,
      email: src.email || '',
      name: src.name || '',
      school: src.school || '',
      at: src.at || req.at || 0,
      status: lic ? (lic.status === 'locked' ? 'locked' : 'active') : 'pending',
      hasLicense: !!lic
    });
  });
  rows.sort((a, b) => (b.at || 0) - (a.at || 0));
  return rows;
}

export async function fetchMachines(fetchFn: FetchFn): Promise<MachineRow[]> {
  const [requests, licenses] = await Promise.all([
    fbGet(fetchFn, 'kc3d_requests'),
    fbGet(fetchFn, 'kc3d_licenses')
  ]);
  return mergeMachines(requests, licenses);
}

/** Khoá lại / Mở lại một máy: PATCH trạng thái lên kc3d_licenses (giữ nguyên thông tin). */
export async function setMachineStatus(
  fetchFn: FetchFn,
  mid: string,
  status: 'active' | 'locked',
  now: number
): Promise<void> {
  await fbPatch(fetchFn, 'kc3d_licenses/' + mid, { status, updatedAt: now });
}
