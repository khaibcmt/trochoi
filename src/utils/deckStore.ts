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

/** Áp tombstone: bộ đề còn "sống" khi updatedAt > deletedAt của nó. */
export function resolveVisibleDecks(snap: DeckSnapshot): Record<string, SubjectData> {
  const out: Record<string, SubjectData> = {};
  for (const [key, rec] of Object.entries(snap.decks)) {
    const del = snap.tombstones[key] || 0;
    if (rec.updatedAt > del) out[key] = rec.subject;
  }
  return out;
}

/** updatedAt theo từng bộ đề của các bộ đề đang sống (để phát hiện thay đổi + đóng dấu khi xuất file). */
export function visibleUpdatedAtMap(snap: DeckSnapshot): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, rec] of Object.entries(snap.decks)) {
    if (rec.updatedAt > (snap.tombstones[key] || 0)) out[key] = rec.updatedAt;
  }
  return out;
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
    const curVisible = cur && cur.updatedAt > (current.tombstones[key] || 0) ? cur : undefined;
    if (!curVisible) {
      if (rec.updatedAt > (current.tombstones[key] || 0)) added++;
    } else if (rec.updatedAt > curVisible.updatedAt) {
      updated++;
    }
  }
  const merged = mergeDeckSnapshots(current, incoming);
  const keptLocalOnly = Object.keys(visibleBefore).filter(k => !incoming.decks[k]).length;
  return { merged, added, updated, keptLocalOnly };
}
