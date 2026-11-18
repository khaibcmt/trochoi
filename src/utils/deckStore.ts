/**
 * 💾 KHO ĐỀ BỀN (18/11/2026) — sửa lỗi "tạo đề mới + lưu, mở lại thì mất".
 *
 * NGUYÊN NHÂN GỐC của lỗi cũ (đã kiểm chứng trong code): toàn bộ kho đề chỉ
 * sống trong localStorage ở khoá 'thpt_mangthit_subjects_v10', và hàm lưu
 * (App.saveSubjects) nuốt MỌI lỗi ghi bằng `catch (e) {}` trong khi nút Lưu
 * vẫn báo "✅ Đã lưu thành công" vô điều kiện. Đề nhập từ Word mang ảnh
 * base64 làm JSON kho đề phình rất nhanh (đo thật: 1 ảnh ~800KB base64 làm
 * kho phình ~0,76MB, nội dung ảnh còn bị nhân bản sang khoá quiz đang mở
 * 'custom_Active_Quiz_V31') → vượt quota ~5MB của localStorage → setItem
 * ném QuotaExceededError bị nuốt im lặng → mở lại đọc trúng bản cũ → đề
 * mới "mất tiêu". Đường CloudSync cũ cũng không cứu được: nó đồng bộ qua
 * MQTT theo profile email/mật khẩu, chỉ chạy khi đã cấu hình, và lỗi của
 * nó cũng bị nuốt (.catch(() => {})).
 *
 * THIẾT KẾ MỚI:
 * 1) Kho chính = IndexedDB (quota lớn hơn localStorage hàng chục lần, chịu
 *    được đề nhiều ảnh). Mỗi bộ đề là 1 record { subject, updatedAt } để
 *    hợp nhất theo thời gian sửa. Mọi lỗi ghi đều NÉM ra cho phía gọi báo
 *    cho giáo viên — module này KHÔNG nuốt lỗi nào.
 * 2) Bản sao dự phòng tự động lên Firebase edumaster-online, subtree
 *    riêng của trochoi: kc3d_decks/<MÃ MÁY KC3D>/... (khoá theo mã máy
 *    giáo viên đã đăng ký kích hoạt — không cần đăng nhập tài khoản nào).
 *    Mở app: tải về + HỢP NHẤT với bản máy (bản mới hơn theo updatedAt
 *    thắng; hợp nhất không xoá bộ đề nào — chỉ dấu xoá tường minh
 *    (tombstone) mới hơn mới làm một bộ đề biến mất).
 * 3) HỢP NHẤT UNION cho hệ đồng bộ 3 chế độ sẵn có của app (Google /
 *    Mật khẩu ẩn danh / Mã & file .json trong modal Sao Lưu & Đồng Bộ):
 *    các hàm hợp nhất thuần ở đây (mergeDeckSnapshots,
 *    unionMergeBackupData, mergeBackupIntoCurrent) được App.tsx và
 *    services/cloudSync.ts dùng chung cho MỌI đường nạp/đẩy: khớp theo id
 *    bộ đề + updatedAt (mới hơn thắng), không nhân đôi, phía đích có bộ đề
 *    mà phía nguồn không có thì GIỮ LẠI — một lần đồng bộ không bao giờ
 *    làm kho của phía nhận ít đi trong im lặng.
 *
 * Module này thuần logic + backend trừu tượng (IndexedDB cho trình duyệt,
 * bộ nhớ cho test) để kiểm chứng được bằng test Node.
 */
import type { CloudBackupData, SubjectData } from '../types';
import { fbGet, fbPatch, type FetchFn } from './license';

export interface DeckRecord {
  subject: SubjectData;
  updatedAt: number;
}

export interface DeckSnapshot {
  decks: Record<string, DeckRecord>;
  /** key → thời điểm xoá tường minh (ms). Chỉ tombstone MỚI HƠN updatedAt của bộ đề mới làm bộ đề biến mất. */
  tombstones: Record<string, number>;
}

export const EMPTY_SNAPSHOT: DeckSnapshot = { decks: {}, tombstones: {} };

/** Backend lưu trữ tối thiểu cho kho đề (IndexedDB thật / bộ nhớ cho test). */
export interface DeckStorageBackend {
  loadAll(): Promise<DeckSnapshot>;
  putDeck(key: string, rec: DeckRecord): Promise<void>;
  removeDeck(key: string): Promise<void>;
  putTombstone(key: string, deletedAt: number): Promise<void>;
}

/**
 * 🔥 LUẬT SỐNG/CHẾT của bộ đề (HOTFIX 18/11/2026): một bộ đề CHỈ chết khi
 * có tombstone TƯỜNG MINH cho nó và tombstone đó thắng (≥) updatedAt của
 * nó. KHÔNG có tombstone → bộ đề luôn sống, KỂ CẢ updatedAt = 0.
 *
 * Bối cảnh: bản 09:26 đóng dấu 0 cho toàn bộ kho di trú từ localStorage
 * legacy, trong khi luật cũ là "sống khi updatedAt > tombstone (mặc định
 * 0)" → 0 > 0 = sai → MỌI bộ đề legacy bị coi như đã xoá: màn hình hiện
 * 0 môn • 0 câu, bản chụp rỗng bị ghi xuống IndexedDB và đẩy diff xoá lên
 * mây (kc3d_decks chỉ còn node "meta"). Dấu 0 nghĩa là "bản legacy chưa có
 * dấu thời gian", KHÔNG phải "đã xoá lúc 0 giờ" — tombstone thật luôn là
 * mốc Date.now() khi giáo viên bấm xoá.
 */
export function isDeckAlive(rec: DeckRecord, tombstone: number | undefined): boolean {
  return tombstone === undefined || rec.updatedAt > tombstone;
}

/** Áp tombstone: bộ đề còn "sống" khi chưa có tombstone thắng nó (xem isDeckAlive). */
export function resolveVisibleDecks(snap: DeckSnapshot): Record<string, SubjectData> {
  const out: Record<string, SubjectData> = {};
  for (const [key, rec] of Object.entries(snap.decks)) {
    if (isDeckAlive(rec, snap.tombstones[key])) out[key] = rec.subject;
  }
  return out;
}

/** updatedAt theo từng bộ đề của các bộ đề đang sống (để phát hiện thay đổi + đóng dấu khi xuất file). */
export function visibleUpdatedAtMap(snap: DeckSnapshot): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, rec] of Object.entries(snap.decks)) {
    if (isDeckAlive(rec, snap.tombstones[key])) out[key] = rec.updatedAt;
  }
  return out;
}

/**
 * Chuẩn hoá một bản chụp trước khi áp vào app: loại hẳn các bộ đề đã chết
 * theo luật isDeckAlive (chỉ giữ tombstone của chúng) — bộ đề đã xoá tường
 * minh không hồi sinh, bộ đề legacy dấu 0 KHÔNG bị loại oan. App.tsx dùng
 * hàm này trong applyMergedDeckSnapshot (trước đây bộ lọc chép tay tại đó
 * dùng luật `updatedAt > (tombstone || 0)` chính là chỗ làm mất kho).
 */
export function pruneDeadDecks(snap: DeckSnapshot): DeckSnapshot {
  const decks: Record<string, DeckRecord> = {};
  for (const [key, rec] of Object.entries(snap.decks)) {
    if (isDeckAlive(rec, snap.tombstones[key])) decks[key] = rec;
  }
  return { decks, tombstones: { ...snap.tombstones } };
}

/**
 * HỢP NHẤT 2 bản chụp kho đề (thuần): theo từng bộ đề, bản có updatedAt
 * lớn hơn thắng; tombstone lấy thời điểm lớn hơn; bộ đề chỉ biến mất khi
 * tombstone thắng updatedAt của nó. KHÔNG BAO GIỜ tự xoá một bộ đề chỉ vì
 * phía bên kia không có nó (hợp nhất = hợp tập + mới-thắng).
 */
export function mergeDeckSnapshots(a: DeckSnapshot, b: DeckSnapshot): DeckSnapshot {
  const decks: Record<string, DeckRecord> = {};
  const tombstones: Record<string, number> = {};
  const keys = new Set<string>([
    ...Object.keys(a.decks),
    ...Object.keys(b.decks),
    ...Object.keys(a.tombstones),
    ...Object.keys(b.tombstones)
  ]);
  for (const key of keys) {
    const ra = a.decks[key];
    const rb = b.decks[key];
    const rec = ra && rb ? (rb.updatedAt > ra.updatedAt ? rb : ra) : ra || rb;
    if (rec) decks[key] = rec;
    const del = Math.max(a.tombstones[key] || 0, b.tombstones[key] || 0);
    if (del > 0) tombstones[key] = del;
  }
  return { decks, tombstones };
}

/** Chênh lệch cần ghi xuống backend/mây để biến `prev` thành `next` (so theo updatedAt + nội dung). */
export function diffDeckSnapshots(
  prev: DeckSnapshot,
  next: DeckSnapshot
): { upserts: Record<string, DeckRecord>; removes: string[]; tombstones: Record<string, number> } {
  const upserts: Record<string, DeckRecord> = {};
  const removes: string[] = [];
  const tombstones: Record<string, number> = {};
  for (const [key, rec] of Object.entries(next.decks)) {
    const old = prev.decks[key];
    if (!old || old.updatedAt !== rec.updatedAt || old.subject !== rec.subject) {
      upserts[key] = rec;
    }
  }
  for (const key of Object.keys(prev.decks)) {
    if (!next.decks[key]) removes.push(key);
  }
  for (const [key, del] of Object.entries(next.tombstones)) {
    if ((prev.tombstones[key] || 0) !== del) tombstones[key] = del;
  }
  return { upserts, removes, tombstones };
}

/** Ghi một bản chụp (phần chênh lệch) xuống backend — lỗi NÉM ra, không nuốt. */
export async function persistSnapshotDiff(
  backend: DeckStorageBackend,
  prev: DeckSnapshot,
  next: DeckSnapshot
): Promise<void> {
  const diff = diffDeckSnapshots(prev, next);
  for (const [key, rec] of Object.entries(diff.upserts)) {
    await backend.putDeck(key, rec);
  }
  for (const key of diff.removes) {
    await backend.removeDeck(key);
  }
  for (const [key, del] of Object.entries(diff.tombstones)) {
    await backend.putTombstone(key, del);
  }
}

/* ================= Backend bộ nhớ (cho test — mô phỏng tải lại trang) ================= */

/** Backend dùng Map dùng chung: tạo instance mới trên cùng Map = mô phỏng "tải lại trang". */
export function createMemoryBackend(shared?: {
  decks: Map<string, DeckRecord>;
  tombstones: Map<string, number>;
}): DeckStorageBackend & { shared: { decks: Map<string, DeckRecord>; tombstones: Map<string, number> } } {
  const state = shared || { decks: new Map(), tombstones: new Map() };
  return {
    shared: state,
    async loadAll() {
      const decks: Record<string, DeckRecord> = {};
      state.decks.forEach((v, k) => (decks[k] = v));
      const tombstones: Record<string, number> = {};
      state.tombstones.forEach((v, k) => (tombstones[k] = v));
      return { decks, tombstones };
    },
    async putDeck(key, rec) {
      state.decks.set(key, rec);
    },
    async removeDeck(key) {
      state.decks.delete(key);
    },
    async putTombstone(key, deletedAt) {
      state.tombstones.set(key, deletedAt);
    }
  };
}

/* ================= Backend IndexedDB (trình duyệt) ================= */

const IDB_NAME = 'kc3d_deck_store';
const IDB_VERSION = 1;

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('decks')) db.createObjectStore('decks');
      if (!db.objectStoreNames.contains('tombstones')) db.createObjectStore('tombstones');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Không mở được IndexedDB'));
  });
}

function idbTx<T>(storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return idbOpen().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const req = run(tx.objectStore(storeName));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('Lỗi ghi IndexedDB'));
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error || new Error('Lỗi giao dịch IndexedDB'));
      })
  );
}

function idbGetAll(storeName: string): Promise<[string, any][]> {
  return idbOpen().then(
    db =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const keysReq = store.getAllKeys();
        const valsReq = store.getAll();
        tx.oncomplete = () => {
          db.close();
          const keys = (keysReq.result || []).map(String);
          const vals = valsReq.result || [];
          resolve(keys.map((k, i) => [k, vals[i]] as [string, any]));
        };
        tx.onerror = () => reject(tx.error || new Error('Lỗi đọc IndexedDB'));
      })
  );
}

/** Backend IndexedDB thật — quota lớn, chịu được đề nhiều ảnh base64. */
export function createIndexedDbBackend(): DeckStorageBackend {
  return {
    async loadAll() {
      const [deckRows, tombRows] = await Promise.all([idbGetAll('decks'), idbGetAll('tombstones')]);
      const decks: Record<string, DeckRecord> = {};
      for (const [k, v] of deckRows) {
        if (v && v.subject && typeof v.updatedAt === 'number') decks[k] = v as DeckRecord;
      }
      const tombstones: Record<string, number> = {};
      for (const [k, v] of tombRows) {
        if (typeof v === 'number') tombstones[k] = v;
      }
      return { decks, tombstones };
    },
    async putDeck(key, rec) {
      await idbTx('decks', 'readwrite', store => store.put(rec, key));
    },
    async removeDeck(key) {
      await idbTx('decks', 'readwrite', store => store.delete(key));
    },
    async putTombstone(key, deletedAt) {
      await idbTx('tombstones', 'readwrite', store => store.put(deletedAt, key));
    }
  };
}

/* ================= Đồng bộ mây theo MÃ MÁY (bản sao dự phòng tự động) ================= */

/** Đường dẫn Firebase của kho đề theo mã máy (chỉ gồm chữ/số/gạch ngang — an toàn làm khoá Firebase). */
export function cloudDeckPath(machineId: string): string {
  return 'kc3d_decks/' + machineId;
}

function sanitizeCloudSnapshot(raw: any): DeckSnapshot {
  const decks: Record<string, DeckRecord> = {};
  const tombstones: Record<string, number> = {};
  if (raw && typeof raw === 'object') {
    const rawDecks = raw.decks && typeof raw.decks === 'object' ? raw.decks : {};
    for (const [k, v] of Object.entries<any>(rawDecks)) {
      if (v && v.subject && typeof v.updatedAt === 'number') {
        decks[k] = { subject: v.subject as SubjectData, updatedAt: v.updatedAt };
      }
    }
    const rawTombs = raw.tombstones && typeof raw.tombstones === 'object' ? raw.tombstones : {};
    for (const [k, v] of Object.entries<any>(rawTombs)) {
      if (typeof v === 'number') tombstones[k] = v;
    }
  }
  return { decks, tombstones };
}

/** Tải bản chụp kho đề từ mây (theo mã máy). Chưa có gì trên mây → bản chụp rỗng. Lỗi mạng → NÉM ra. */
export async function fetchCloudDecks(fetchFn: FetchFn, machineId: string): Promise<DeckSnapshot> {
  const raw = await fbGet(fetchFn, cloudDeckPath(machineId));
  return sanitizeCloudSnapshot(raw);
}

/** Đẩy phần chênh lệch lên mây (PATCH — không ghi đè phần còn lại). Lỗi mạng → NÉM ra. */
export async function pushDeckDiffToCloud(
  fetchFn: FetchFn,
  machineId: string,
  prev: DeckSnapshot,
  next: DeckSnapshot
): Promise<void> {
  const diff = diffDeckSnapshots(prev, next);
  // Không có chênh lệch thật → không ghi gì lên mây (kể cả node "meta"):
  // tránh các lần đẩy rỗng lúc boot tạo node mây trống vô nghĩa.
  if (
    Object.keys(diff.upserts).length === 0 &&
    diff.removes.length === 0 &&
    Object.keys(diff.tombstones).length === 0
  ) {
    return;
  }
  const patch: Record<string, any> = { meta: { updatedAt: Date.now() } };
  if (Object.keys(diff.upserts).length > 0) patch.decks = diff.upserts;
  if (Object.keys(diff.tombstones).length > 0) patch.tombstones = diff.tombstones;
  if (diff.removes.length > 0) {
    // Xoá record trên mây phải ghi null theo từng khoá (PATCH lồng nhau của RTDB).
    patch.decks = patch.decks || {};
    for (const key of diff.removes) patch.decks[key] = null;
  }
  if (!patch.decks && !patch.tombstones) return;
  await fbPatch(fetchFn, cloudDeckPath(machineId), patch);
}

/* ================= HỢP NHẤT UNION cho CloudBackupData (3 chế độ đồng bộ) ================= */

/** Dựng bản chụp từ 1 kho đề + bản đồ thời gian sửa (thiếu dấu → 0). */
export function snapshotFromSubjects(
  db: Record<string, SubjectData>,
  updatedAtByKey: Record<string, number>,
  tombstones: Record<string, number> = {}
): DeckSnapshot {
  const decks: Record<string, DeckRecord> = {};
  for (const [key, subject] of Object.entries(db)) {
    decks[key] = { subject, updatedAt: updatedAtByKey[key] || 0 };
  }
  return { decks, tombstones: { ...tombstones } };
}

/**
 * Dựng bản chụp từ 1 bản sao lưu đồng bộ. Bản sao lưu MỚI có deckUpdatedAt
 * riêng từng bộ; bản CŨ (trước đợt gia cố) không có → mọi bộ đề mang dấu
 * thời gian của cả bản sao lưu (lastUpdated).
 */
export function snapshotFromBackupData(backup: CloudBackupData): DeckSnapshot {
  const decks: Record<string, DeckRecord> = {};
  const fallback = typeof backup.lastUpdated === 'number' ? backup.lastUpdated : 0;
  for (const [key, subject] of Object.entries(backup.subjectsDB || {})) {
    const stamped = backup.deckUpdatedAt?.[key];
    decks[key] = { subject, updatedAt: typeof stamped === 'number' ? stamped : fallback };
  }
  return { decks, tombstones: {} };
}

export interface UnionMergeResult {
  subjectsDB: Record<string, SubjectData>;
  deckUpdatedAt: Record<string, number>;
  /** Số bộ chỉ có ở phía EXISTING (được giữ lại nhờ hợp nhất). */
  keptOnlyInExisting: number;
  /** Số bộ chỉ có ở phía INCOMING. */
  addedFromIncoming: number;
  /** Số bộ có ở cả hai phía mà phía INCOMING thắng (mới hơn). */
  updatedFromIncoming: number;
}

/**
 * HỢP NHẤT UNION 2 bản sao lưu (thuần): dùng cho đường ĐẨY lên mây — bản
 * đang có trên mây (existing) hợp nhất với bản sắp đẩy (incoming) để lần
 * sao lưu không bao giờ làm kho mây ít đi trong im lặng: bộ đề chỉ có trên
 * mây được GIỮ LẠI, bộ đề hai phía đều có thì bản mới hơn theo updatedAt
 * thắng.
 */
export function unionMergeBackupData(existing: CloudBackupData, incoming: CloudBackupData): UnionMergeResult {
  const snapA = snapshotFromBackupData(existing);
  const snapB = snapshotFromBackupData(incoming);
  const merged = mergeDeckSnapshots(snapA, snapB);
  let keptOnlyInExisting = 0;
  let addedFromIncoming = 0;
  let updatedFromIncoming = 0;
  for (const key of Object.keys(merged.decks)) {
    const inA = Boolean(snapA.decks[key]);
    const inB = Boolean(snapB.decks[key]);
    if (inA && !inB) keptOnlyInExisting++;
    else if (!inA && inB) addedFromIncoming++;
    else if (inA && inB && snapB.decks[key].updatedAt > snapA.decks[key].updatedAt) updatedFromIncoming++;
  }
  return {
    subjectsDB: resolveVisibleDecks(merged),
    deckUpdatedAt: visibleUpdatedAtMap(merged),
    keptOnlyInExisting,
    addedFromIncoming,
    updatedFromIncoming
  };
}

export interface ApplyMergeReport {
  merged: DeckSnapshot;
  /** Số bộ MỚI nạp vào (máy này chưa có). */
  added: number;
  /** Số bộ được CẬP NHẬT (bản nạp mới hơn bản máy). */
  updated: number;
  /** Số bộ CHỈ CÓ trên máy này (được giữ nguyên nhờ hợp nhất). */
  keptLocalOnly: number;
}

/**
 * HỢP NHẤT 1 bản sao lưu NẠP VÀO (từ mây/mã/file) với kho hiện tại của máy
 * (thuần): khớp id + updatedAt, mới hơn thắng; bộ đề máy đã XOÁ tường minh
 * (tombstone mới hơn) không bị hồi sinh bởi bản nạp cũ; bộ chỉ có trên máy
 * được giữ nguyên. Dùng cho handleApplyBackup — điểm chung của cả 4 đường
 * nạp trong modal đồng bộ.
 */
export function mergeBackupIntoCurrent(current: DeckSnapshot, backup: CloudBackupData): ApplyMergeReport {
  const incoming = snapshotFromBackupData(backup);
  let added = 0;
  let updated = 0;
  const visibleBefore = resolveVisibleDecks(current);
  for (const [key, rec] of Object.entries(incoming.decks)) {
    const cur = current.decks[key];
    const curVisible = cur && isDeckAlive(cur, current.tombstones[key]) ? cur : undefined;
    if (!curVisible) {
      if (isDeckAlive(rec, current.tombstones[key])) added++;
    } else if (rec.updatedAt > curVisible.updatedAt) {
      updated++;
    }
  }
  const merged = mergeDeckSnapshots(current, incoming);
  const keptLocalOnly = Object.keys(visibleBefore).filter(k => !incoming.decks[k]).length;
  return { merged, added, updated, keptLocalOnly };
}

/* ================= KHO LEGACY localStorage + LUẬT AN TOÀN BOOT (HOTFIX 18/11/2026) ================= */

/** Khoá localStorage của kho đề THỜI TRƯỚC (mọi bản app cũ đều đọc/ghi khoá này). */
export const LEGACY_SUBJECTS_STORAGE_KEY = 'thpt_mangthit_subjects_v10';

/** Tối thiểu của Web Storage mà các hàm dưới cần (localStorage thật / giả lập cho test). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Parse một JSON kho đề (đúng cấu trúc Record<key, SubjectData>): chỉ giữ
 * các mục có `html` dạng chuỗi. Không phải JSON / không phải object / không
 * còn mục hợp lệ nào → null (coi như không có kho).
 */
export function parseSubjectsDbJson(raw: string | null): Record<string, SubjectData> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const db: Record<string, SubjectData> = {};
    for (const [k, v] of Object.entries<any>(parsed)) {
      if (v && typeof v === 'object' && typeof v.html === 'string') db[k] = v as SubjectData;
    }
    return Object.keys(db).length > 0 ? db : null;
  } catch {
    return null;
  }
}

/**
 * Đọc THẲNG kho đề legacy từ localStorage (không qua state/ref của React)
 * và dựng bản chụp với updatedAt = 0 ("chưa có dấu thời gian" — mọi bản
 * mới hơn đều thắng khi hợp nhất, và theo luật isDeckAlive thì bộ đề dấu 0
 * không có tombstone vẫn SỐNG). Không có kho / kho hỏng → null.
 */
export function readLegacySubjectsSnapshot(storage: KeyValueStorage): DeckSnapshot | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(LEGACY_SUBJECTS_STORAGE_KEY);
  } catch {
    return null;
  }
  const db = parseSubjectsDbJson(raw);
  if (!db) return null;
  return snapshotFromSubjects(db, {});
}

/**
 * Dựng bản chụp kho đề cho lúc BOOT bằng hợp nhất UNION mọi nguồn đang có:
 * IndexedDB + kho legacy localStorage + state khởi tạo + bản sao mây theo
 * mã máy. LUẬT AN TOÀN TUYỆT ĐỐI: legacy LUÔN là một nguồn trong mọi lần
 * boot (không chỉ lần đầu) — không đường code nào được để một trạng thái
 * rỗng/ít hơn ghi đè hay làm mất dữ liệu legacy; bộ đề chỉ biến mất khi có
 * tombstone tường minh thắng nó.
 */
export function buildBootMergedSnapshot(sources: {
  idb?: DeckSnapshot | null;
  legacy?: DeckSnapshot | null;
  initial?: DeckSnapshot | null;
  cloud?: DeckSnapshot | null;
}): DeckSnapshot {
  let merged: DeckSnapshot = EMPTY_SNAPSHOT;
  for (const s of [sources.idb, sources.initial, sources.legacy, sources.cloud]) {
    if (s) merged = mergeDeckSnapshots(merged, s);
  }
  return merged;
}

/**
 * 🌱 LÀM MỚI BỘ MẶC ĐỊNH THEO PHIÊN BẢN SEED (chuẩn hoá 18/11/2026 — thuần):
 * qua nhiều lần nâng cấp, nội dung các bộ mặc định cài sẵn bị méo (lệch số
 * câu, có câu sai). Cơ chế: mã nguồn mang bản chuẩn + DEFAULT_SEED_VERSION;
 * bản đang lưu của CHÍNH một bộ mặc định mà có seedVersion NHỎ HƠN (hoặc
 * chưa có — dữ liệu thời trước) thì được thay bằng bản chuẩn và đóng dấu
 * `now` để ghi bền + đẩy mây thắng các bản cũ.
 *
 * RANH GIỚI AN TOÀN:
 * - Chỉ áp cho các khoá có trong `defaults` (12 môn + ALL_SUBJ) — bộ đề
 *   giáo viên tự tạo (khoá SUBJ_...) TUYỆT ĐỐI không bị đụng.
 * - Bộ mặc định đã bị XOÁ tường minh (tombstone thắng bản đang lưu, hoặc
 *   chỉ còn tombstone) thì KHÔNG hồi sinh, KHÔNG gieo lại.
 * - Bộ mặc định đã ở đúng phiên bản seed thì giữ nguyên (kể cả khi giáo
 *   viên đã sửa nội dung của nó sau lần làm mới gần nhất).
 */
export function applyDefaultSeedRefresh(
  snap: DeckSnapshot,
  defaults: Record<string, SubjectData>,
  seedVersion: number,
  now: number
): DeckSnapshot {
  const decks: Record<string, DeckRecord> = { ...snap.decks };
  for (const [key, def] of Object.entries(defaults)) {
    const tomb = snap.tombstones[key];
    const rec = snap.decks[key];
    if (rec) {
      if (!isDeckAlive(rec, tomb)) continue; // đã xoá tường minh → không hồi sinh
      if ((rec.subject.seedVersion ?? 0) >= seedVersion) continue; // đã ở bản chuẩn
      decks[key] = { subject: def, updatedAt: now };
    } else {
      if (tomb !== undefined) continue; // chỉ còn tombstone → đã xoá, không gieo lại
      decks[key] = { subject: def, updatedAt: now };
    }
  }
  return { decks, tombstones: { ...snap.tombstones } };
}

/**
 * Ghi bản GƯƠNG kho đề xuống localStorage CÓ LUẬT BẢO VỆ: không bao giờ
 * ghi một kho có ÍT bộ đề hơn kho đang lưu trong localStorage (theo số bộ
 * đề) — bản gương nhỏ hơn chỉ có thể là dấu hiệu state đang thiếu dữ liệu
 * (ví dụ phiên bị lỗi), ghi đè sẽ chôn mất bản legacy đầy đủ hơn. Trả
 * 'written' khi đã ghi, 'skipped-smaller' khi bị luật chặn. Lỗi ghi thật
 * (quota...) vẫn NÉM ra cho phía gọi xử lý/báo cáo.
 */
export function writeSubjectsMirrorGuarded(
  storage: KeyValueStorage,
  db: Record<string, SubjectData>
): 'written' | 'skipped-smaller' {
  let existingCount = 0;
  try {
    const existing = parseSubjectsDbJson(storage.getItem(LEGACY_SUBJECTS_STORAGE_KEY));
    existingCount = existing ? Object.keys(existing).length : 0;
  } catch {
    existingCount = 0;
  }
  if (Object.keys(db).length < existingCount) return 'skipped-smaller';
  storage.setItem(LEGACY_SUBJECTS_STORAGE_KEY, JSON.stringify(db));
  return 'written';
}

/* ================= BẢN GƯƠNG localStorage — KÊNH PHỤ, LẶNG LẼ (HOTFIX 18/11/2026) ================= */

/** Storage có liệt kê được khoá (localStorage thật có; giả lập test cũng vậy). */
export interface EnumerableStorage extends KeyValueStorage {
  readonly length: number;
  key(index: number): string | null;
}

/**
 * Ngân sách ký tự TỔNG cho toàn bộ localStorage khi tính cả bản gương sắp
 * ghi. localStorage của Chrome chạm trần thực tế quanh ~2,6 triệu ký tự
 * (quota ~5MB tính theo UTF-16, lại còn phải chia cho các khoá khác như
 * bản đệm mây thpt_cloud_cache_* và quiz đang mở) — giữ biên an toàn ở
 * 2,4 triệu: vượt là bản gương tự bỏ qua, khỏi thử ghi rồi ăn lỗi quota.
 */
export const MIRROR_SAFE_TOTAL_CHARS = 2_400_000;

export type MirrorAttemptResult = 'written' | 'skipped-too-big' | 'skipped-smaller' | 'failed';

/**
 * Thử ghi bản GƯƠNG kho đề xuống localStorage — kênh PHỤ phục vụ đường
 * đọc cũ, đứng sau kho chính IndexedDB. Ba luật:
 *  1) Không ghi kho ÍT bộ đề hơn kho đang lưu (luật chống chôn legacy).
 *  2) ĐO TRƯỚC tổng dung lượng localStorage sau khi ghi (mọi khoá hiện
 *     có + bản gương mới): vượt ngân sách an toàn → BỎ QUA lặng lẽ,
 *     KHÔNG thử ghi (thử ghi là ăn QuotaExceededError vô ích — đúng cảnh
 *     báo gây rối trên máy thầy sáng 18/11: kho chính đã lưu thành công
 *     mà alert lưu vẫn dính lỗi thô của bản gương).
 *  3) Ghi thật mà vẫn lỗi (quota do khoá khác phình bất ngờ...) → trả
 *     'failed', TUYỆT ĐỐI không ném lỗi ra ngoài: phía gọi phải nuốt lặng
 *     kết quả này, không đưa vào bất kỳ thông báo nào cho giáo viên.
 */
export function attemptSubjectsMirror(
  storage: EnumerableStorage,
  db: Record<string, SubjectData>
): MirrorAttemptResult {
  const json = JSON.stringify(db);
  // Luật 1: chống ghi kho nhỏ hơn đè kho lớn hơn.
  let existingCount = 0;
  try {
    const existing = parseSubjectsDbJson(storage.getItem(LEGACY_SUBJECTS_STORAGE_KEY));
    existingCount = existing ? Object.keys(existing).length : 0;
  } catch {
    existingCount = 0;
  }
  if (Object.keys(db).length < existingCount) return 'skipped-smaller';
  // Luật 2: đo trước tổng dung lượng sau khi ghi.
  try {
    let projected = LEGACY_SUBJECTS_STORAGE_KEY.length + json.length;
    const n = typeof storage.length === 'number' ? storage.length : 0;
    for (let i = 0; i < n; i++) {
      const k = storage.key(i);
      if (!k || k === LEGACY_SUBJECTS_STORAGE_KEY) continue;
      const v = storage.getItem(k);
      projected += k.length + (v ? v.length : 0);
    }
    if (projected > MIRROR_SAFE_TOTAL_CHARS) return 'skipped-too-big';
  } catch {
    // Không đo được (storage lạ) → cứ thử ghi ở luật 3, lỗi thì lặng lẽ.
  }
  // Luật 3: ghi thật, lỗi → 'failed' (không ném).
  try {
    storage.setItem(LEGACY_SUBJECTS_STORAGE_KEY, json);
    return 'written';
  } catch {
    return 'failed';
  }
}
