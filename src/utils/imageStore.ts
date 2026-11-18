/**
 * 🖼️ KHO HÌNH TÁCH RIÊNG (18/11/2026) — tách ảnh khỏi nội dung kho đề để kho
 * đề nhẹ, bền, dùng được nhiều năm.
 *
 * VẤN ĐỀ: trước đây mọi ảnh trong đề đều nhét thẳng vào `SubjectData.html`
 * dạng `<img src="data:image/...;base64,...">`. Phần chữ của cả kho 744 câu
 * chỉ ~1–2 MB — phần phình toàn là ảnh base64, lại còn bị NHÂN BẢN khi cùng
 * một ảnh dùng ở nhiều bộ đề/câu hỏi. Đó là gốc của vụ kho vượt quota
 * localStorage tối 17/11/2026.
 *
 * THIẾT KẾ:
 * 1) Mỗi ảnh duy nhất chỉ lưu ĐÚNG 1 bản vật lý, định danh bằng SHA-256 của
 *    chính chuỗi data URL của nó. Nơi chứa: IndexedDB riêng `kc3d_img_store`
 *    (store `images`, khoá = hash) + bản sao Firebase ở subtree riêng
 *    `kc3d_images/<MÃ MÁY KC3D>/<hash>` — nhất quán cách `kc3d_decks` vận
 *    hành. Cùng một ảnh xuất hiện ở N bộ đề → vẫn chỉ 1 bản (khử trùng theo
 *    hash nội dung).
 * 2) Bản ghi bộ đề chỉ giữ THAM CHIẾU `imgref:<hash>` ở thuộc tính src của
 *    thẻ <img>. Mọi đường HIỂN THỊ / PHÁT ĐỀ / XUẤT FILE đều phải qua hàm
 *    resolve (nhúng lại data URL thật từ bộ đệm trong RAM) TRƯỚC khi parse
 *    hoặc gửi đi — đặc biệt đường phát đề xuống máy học sinh qua MQTT:
 *    payload trên dây mang data URL thật y hệt trước đây, máy học sinh
 *    không bao giờ thấy tham chiếu trần và không cần kho hình của máy thầy.
 * 3) DI TRÚ TẠI CHỖ lúc boot (sau hợp nhất union + làm mới seed, trong
 *    applyMergedDeckSnapshot của App): quét các bộ đề, ảnh data: nào chưa
 *    phải tham chiếu thì đưa vào kho hình rồi thay bằng tham chiếu. Chạy
 *    lại nhiều lần không đổi gì thêm (idempotent); tôn trọng tombstone —
 *    bộ đề đã xoá tường minh được prune TRƯỚC khi di trú nên không hồi
 *    sinh; updatedAt của bộ đề được GIỮ NGUYÊN (tách hình là thay đổi cách
 *    lưu trữ, không phải sửa nội dung — không được làm bộ đề "thắng" hợp
 *    nhất oan).
 *
 * Module này thuần logic + backend trừu tượng (IndexedDB cho trình duyệt,
 * bộ nhớ cho test) theo đúng khuôn utils/deckStore.ts để kiểm chứng được
 * bằng test Node.
 */
import type { SubjectData } from '../types';
import type { DeckSnapshot } from './deckStore';
import { fbGet, fbPatch, type FetchFn } from './license';

/* ================= SHA-256 thuần (đồng bộ, chạy mọi nơi) ================= */

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

function rotr32(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** Mã hoá UTF-8 một chuỗi JS thành mảng byte (đúng cả ký tự ngoài BMP). */
function utf8Bytes(input: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        const cp = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        bytes.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f)
        );
        i++;
      } else {
        bytes.push(0xef, 0xbf, 0xbd);
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      bytes.push(0xef, 0xbf, 0xbd);
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return bytes;
}

/**
 * SHA-256 (hex, 64 ký tự) của một chuỗi — thuần JS, đồng bộ, không phụ
 * thuộc crypto.subtle (vốn bất đồng bộ và vắng mặt ở một số ngữ cảnh).
 * Đã kiểm chứng bằng vector chuẩn + đối chiếu Node crypto trong test.
 */
export function sha256Hex(input: string): string {
  const bytes = utf8Bytes(input);
  const len = bytes.length;
  const bitLenLo = (len % 0x20000000) * 8;
  const bitLenHi = Math.floor(len / 0x20000000);
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 3; i >= 0; i--) bytes.push((bitLenHi >>> (i * 8)) & 0xff);
  for (let i = 3; i >= 0; i--) bytes.push((bitLenLo >>> (i * 8)) & 0xff);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Array<number>(64);
  for (let block = 0; block < bytes.length; block += 64) {
    for (let t = 0; t < 16; t++) {
      const j = block + t * 4;
      w[t] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) | 0;
    }
    for (let t = 16; t < 64; t++) {
      const s0 = (rotr32(w[t - 15], 7) ^ rotr32(w[t - 15], 18) ^ (w[t - 15] >>> 3)) | 0;
      const s1 = (rotr32(w[t - 2], 17) ^ rotr32(w[t - 2], 19) ^ (w[t - 2] >>> 10)) | 0;
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let t = 0; t < 64; t++) {
      const s1 = (rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25)) | 0;
      const ch = ((e & f) ^ (~e & g)) | 0;
      const temp1 = (h + s1 + ch + SHA256_K[t] + w[t]) | 0;
      const s0 = (rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22)) | 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) | 0;
      const temp2 = (s0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map(x => (x >>> 0).toString(16).padStart(8, '0'))
    .join('');
}

/* ================= Định dạng tham chiếu ================= */

/** Tiền tố tham chiếu hình trong thuộc tính src của thẻ <img>: `imgref:<sha256-hex>`. */
export const IMGREF_PREFIX = 'imgref:';

const IMGREF_PATTERN = /^imgref:([0-9a-f]{64})$/;

/** Hash định danh của một ảnh = SHA-256 của chính chuỗi data URL của nó. */
export function hashImageDataUrl(dataUrl: string): string {
  return sha256Hex(dataUrl);
}

/** Trích hash từ một src dạng tham chiếu; không phải tham chiếu → null. */
export function hashFromImageRef(src: string): string | null {
  const m = IMGREF_PATTERN.exec(src || '');
  return m ? m[1] : null;
}

export function isDataImageSrc(src: string): boolean {
  return typeof src === 'string' && src.startsWith('data:image/');
}

/* ================= Tách / resolve / thu thập tham chiếu (thuần) ================= */

const IMG_TAG_PATTERN = /<img\b[^>]*>/gi;
const SRC_ATTR_PATTERN = /(\bsrc\s*=\s*)("[^"]*"|'[^']*')/i;

function readSrcAttr(tag: string): { prefix: string; quote: string; src: string } | null {
  const m = SRC_ATTR_PATTERN.exec(tag);
  if (!m) return null;
  const quoted = m[2];
  return { prefix: m[1], quote: quoted.charAt(0), src: quoted.slice(1, -1) };
}

function writeSrcAttr(tag: string, prefix: string, quote: string, value: string): string {
  return tag.replace(SRC_ATTR_PATTERN, () => `${prefix}${quote}${value}${quote}`);
}

/**
 * TÁCH HÌNH khỏi một chuỗi html (thuần): mọi `<img src="data:image/...">`
 * được thay src bằng `imgref:<hash>`; ảnh thu về trong Map hash → data URL
 * (ảnh trùng nội dung chỉ xuất hiện 1 lần trong Map). Html không có ảnh
 * data: → trả NGUYÊN chuỗi cũ, Map rỗng.
 */
export function extractImagesFromHtml(html: string): { html: string; images: Map<string, string> } {
  const images = new Map<string, string>();
  if (!html || html.indexOf('data:image/') === -1) return { html, images };
  const out = html.replace(IMG_TAG_PATTERN, tag => {
    const attr = readSrcAttr(tag);
    if (!attr || !isDataImageSrc(attr.src)) return tag;
    const hash = hashImageDataUrl(attr.src);
    if (!images.has(hash)) images.set(hash, attr.src);
    return writeSrcAttr(tag, attr.prefix, attr.quote, IMGREF_PREFIX + hash);
  });
  return { html: out, images };
}

/** Tra cứu data URL theo hash (đồng bộ — từ bộ đệm trong RAM). */
export type ImageLookup = (hash: string) => string | undefined;

/**
 * RESOLVE tham chiếu trong một chuỗi html (thuần): src dạng `imgref:<hash>`
 * được nhúng lại data URL thật khi tra cứu thấy; không thấy thì GIỮ NGUYÊN
 * tham chiếu và ghi vào `unresolved` (phía gọi quyết định xử lý — tuyệt đối
 * không bịa ảnh thay thế). Không có thay đổi nào → trả nguyên chuỗi cũ.
 */
export function resolveImagesInHtml(
  html: string,
  lookup: ImageLookup
): { html: string; unresolved: string[] } {
  if (!html || html.indexOf(IMGREF_PREFIX) === -1) return { html, unresolved: [] };
  const unresolved: string[] = [];
  const out = html.replace(IMG_TAG_PATTERN, tag => {
    const attr = readSrcAttr(tag);
    if (!attr) return tag;
    const hash = hashFromImageRef(attr.src);
    if (!hash) return tag;
    const data = lookup(hash);
    if (data === undefined) {
      unresolved.push(hash);
      return tag;
    }
    return writeSrcAttr(tag, attr.prefix, attr.quote, data);
  });
  return { html: out, unresolved };
}

/** Mọi hash tham chiếu đang có trong một chuỗi html (theo thứ tự xuất hiện, có thể trùng). */
export function collectImageRefsInHtml(html: string): string[] {
  if (!html || html.indexOf(IMGREF_PREFIX) === -1) return [];
  const refs: string[] = [];
  const tags = html.match(IMG_TAG_PATTERN) || [];
  for (const tag of tags) {
    const attr = readSrcAttr(tag);
    if (!attr) continue;
    const hash = hashFromImageRef(attr.src);
    if (hash) refs.push(hash);
  }
  return refs;
}

/** Tách hình khỏi 1 bộ đề: không có ảnh data: → trả NGUYÊN object cũ (giữ tham chiếu). */
export function extractImagesFromSubject(
  subject: SubjectData
): { subject: SubjectData; images: Map<string, string> } {
  const { html, images } = extractImagesFromHtml(subject.html || '');
  if (images.size === 0) return { subject, images };
  return { subject: { ...subject, html }, images };
}

/**
 * Tách hình khỏi toàn bộ kho đề (thuần): bộ đề không đổi giữ NGUYÊN object
 * (để phép so sánh tham chiếu của saveSubjects còn đúng); không bộ nào đổi
 * → trả NGUYÊN Record cũ.
 */
export function extractImagesFromDB(db: Record<string, SubjectData>): {
  db: Record<string, SubjectData>;
  images: Map<string, string>;
} {
  const images = new Map<string, string>();
  let changed = false;
  const out: Record<string, SubjectData> = {};
  for (const [key, subject] of Object.entries(db)) {
    const r = extractImagesFromSubject(subject);
    out[key] = r.subject;
    if (r.subject !== subject) changed = true;
    r.images.forEach((v, k) => {
      if (!images.has(k)) images.set(k, v);
    });
  }
  return { db: changed ? out : db, images };
}

/**
 * Tách hình khỏi một bản chụp kho đề (thuần): giữ NGUYÊN updatedAt và giữ
 * nguyên record của bộ đề không đổi; tombstone giữ nguyên. Đây là bước di
 * trú biểu diễn lưu trữ — KHÔNG phải sửa nội dung.
 */
export function extractImagesFromSnapshot(snap: DeckSnapshot): {
  snap: DeckSnapshot;
  images: Map<string, string>;
} {
  const images = new Map<string, string>();
  let changed = false;
  const decks: DeckSnapshot['decks'] = {};
  for (const [key, rec] of Object.entries(snap.decks)) {
    const r = extractImagesFromSubject(rec.subject);
    decks[key] = r.subject === rec.subject ? rec : { subject: r.subject, updatedAt: rec.updatedAt };
    if (r.subject !== rec.subject) changed = true;
    r.images.forEach((v, k) => {
      if (!images.has(k)) images.set(k, v);
    });
  }
  if (!changed) return { snap, images };
  return { snap: { decks, tombstones: { ...snap.tombstones } }, images };
}

/** Resolve tham chiếu trong toàn bộ kho đề (thuần): bộ đề không đổi giữ nguyên object. */
export function resolveImagesInDB(
  db: Record<string, SubjectData>,
  lookup: ImageLookup
): Record<string, SubjectData> {
  let changed = false;
  const out: Record<string, SubjectData> = {};
  for (const [key, subject] of Object.entries(db)) {
    const { html } = resolveImagesInHtml(subject.html || '', lookup);
    if (html !== subject.html) {
      out[key] = { ...subject, html };
      changed = true;
    } else {
      out[key] = subject;
    }
  }
  return changed ? out : db;
}

/** Mọi hash tham chiếu đang được dùng trong toàn bộ kho đề. */
export function collectImageRefsInDB(db: Record<string, SubjectData>): Set<string> {
  const refs = new Set<string>();
  for (const subject of Object.values(db)) {
    for (const h of collectImageRefsInHtml(subject.html || '')) refs.add(h);
  }
  return refs;
}

/** Mọi hash tham chiếu đang được dùng trong một bản chụp kho đề. */
export function collectImageRefsInSnapshot(snap: DeckSnapshot): Set<string> {
  const refs = new Set<string>();
  for (const rec of Object.values(snap.decks)) {
    for (const h of collectImageRefsInHtml(rec.subject.html || '')) refs.add(h);
  }
  return refs;
}

/* ================= Backend lưu trữ ================= */

/** Backend tối thiểu cho kho hình (IndexedDB thật / bộ nhớ cho test). */
export interface ImageStorageBackend {
  loadAll(): Promise<Map<string, string>>;
  get(hash: string): Promise<string | undefined>;
  put(hash: string, dataUrl: string): Promise<void>;
}

/** Backend bộ nhớ (cho test — Map dùng chung giữa các instance = mô phỏng tải lại trang). */
export function createMemoryImageBackend(shared?: Map<string, string>): ImageStorageBackend & {
  shared: Map<string, string>;
} {
  const state = shared || new Map<string, string>();
  return {
    shared: state,
    async loadAll() {
      return new Map(state);
    },
    async get(hash) {
      return state.get(hash);
    },
    async put(hash, dataUrl) {
      state.set(hash, dataUrl);
    }
  };
}

/* ---- Backend IndexedDB (trình duyệt) — DB RIÊNG, không đụng DB kho đề ---- */

const IMG_IDB_NAME = 'kc3d_img_store';
const IMG_IDB_VERSION = 1;
const IMG_IDB_STORE = 'images';

function imgIdbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IMG_IDB_NAME, IMG_IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IMG_IDB_STORE)) db.createObjectStore(IMG_IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Không mở được IndexedDB kho hình'));
  });
}

function imgIdbTx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return imgIdbOpen().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(IMG_IDB_STORE, mode);
        const req = run(tx.objectStore(IMG_IDB_STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('Lỗi ghi IndexedDB kho hình'));
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error || new Error('Lỗi giao dịch IndexedDB kho hình'));
      })
  );
}

/** Backend IndexedDB thật cho kho hình — mỗi ảnh 1 record, khoá là hash nội dung. */
export function createIndexedDbImageBackend(): ImageStorageBackend {
  return {
    async loadAll() {
      const db = await imgIdbOpen();
      return new Promise<Map<string, string>>((resolve, reject) => {
        const tx = db.transaction(IMG_IDB_STORE, 'readonly');
        const store = tx.objectStore(IMG_IDB_STORE);
        const keysReq = store.getAllKeys();
        const valsReq = store.getAll();
        tx.oncomplete = () => {
          db.close();
          const out = new Map<string, string>();
          const keys = (keysReq.result || []).map(String);
          const vals = valsReq.result || [];
          keys.forEach((k, i) => {
            if (typeof vals[i] === 'string') out.set(k, vals[i]);
          });
          resolve(out);
        };
        tx.onerror = () => reject(tx.error || new Error('Lỗi đọc IndexedDB kho hình'));
      });
    },
    async get(hash) {
      const v = await imgIdbTx('readonly', store => store.get(hash));
      return typeof v === 'string' ? v : undefined;
    },
    async put(hash, dataUrl) {
      await imgIdbTx('readwrite', store => store.put(dataUrl, hash));
    }
  };
}

/* ================= Bộ đệm trong RAM (đường resolve đồng bộ) ================= */

const imageCache = new Map<string, string>();

/** Tra cứu đồng bộ từ bộ đệm — dùng làm ImageLookup cho mọi đường resolve. */
export function getCachedImage(hash: string): string | undefined {
  return imageCache.get(hash);
}

export function cacheImageData(hash: string, dataUrl: string): void {
  imageCache.set(hash, dataUrl);
}

/** Thống kê kho hình đang có trong bộ đệm (cho modal Đồng bộ hiển thị). */
export function getImageCacheStats(): { count: number; totalChars: number } {
  let totalChars = 0;
  imageCache.forEach(v => (totalChars += v.length));
  return { count: imageCache.size, totalChars };
}

/** Chỉ dành cho test: xoá sạch bộ đệm. */
export function clearImageCacheForTests(): void {
  imageCache.clear();
}

/** Nạp toàn bộ kho hình từ backend vào bộ đệm (lúc boot). Trả số ảnh đã nạp. */
export async function loadImageCacheFromBackend(backend: ImageStorageBackend): Promise<number> {
  const all = await backend.loadAll();
  all.forEach((v, k) => imageCache.set(k, v));
  return all.size;
}

/**
 * Lưu các ảnh vừa tách vào kho hình (bộ đệm + backend). Lỗi ghi backend
 * NÉM ra — phía gọi phải xử lý (không bao giờ để bộ đề mang tham chiếu mà
 * ảnh chưa nằm trong kho).
 */
export async function storeExtractedImages(
  backend: ImageStorageBackend,
  images: Map<string, string>
): Promise<void> {
  for (const [hash, dataUrl] of images) {
    imageCache.set(hash, dataUrl);
    await backend.put(hash, dataUrl);
  }
}

/* ================= Đồng bộ mây theo MÃ MÁY (subtree riêng kc3d_images) ================= */

/** Đường dẫn Firebase của kho hình theo mã máy (an toàn làm khoá Firebase). */
export function cloudImagesPath(machineId: string): string {
  return 'kc3d_images/' + machineId;
}

/** Tải 1 ảnh từ mây theo hash. Không có / dữ liệu lạ → undefined. Lỗi mạng → NÉM ra. */
export async function fetchCloudImage(
  fetchFn: FetchFn,
  machineId: string,
  hash: string
): Promise<string | undefined> {
  const raw = await fbGet(fetchFn, cloudImagesPath(machineId) + '/' + hash);
  return typeof raw === 'string' && isDataImageSrc(raw) ? raw : undefined;
}

/** Đẩy một lô ảnh lên mây (PATCH tại node mã máy — không đụng ảnh khác). Lỗi mạng → NÉM ra. */
export async function pushImagesToCloud(
  fetchFn: FetchFn,
  machineId: string,
  images: Map<string, string>
): Promise<void> {
  if (images.size === 0) return;
  const patch: Record<string, string> = {};
  images.forEach((v, k) => (patch[k] = v));
  await fbPatch(fetchFn, cloudImagesPath(machineId), patch);
}

/* ================= Điều phối: bảo đảm ảnh sẵn sàng + di trú ================= */

export interface ImageStoreDeps {
  backend: ImageStorageBackend;
  fetchFn?: FetchFn;
  machineId?: string;
}

/**
 * Bảo đảm mọi hash trong `refs` đều có mặt trong bộ đệm: bộ đệm → backend
 * máy → mây (theo mã máy; ảnh tải từ mây được lưu lại xuống backend máy).
 * Hash nào vẫn không tìm thấy thì trả về trong `missing` — KHÔNG ném lỗi,
 * KHÔNG bịa ảnh: phía hiển thị giữ nguyên tham chiếu cho hash đó.
 */
export async function ensureImagesForRefs(
  refs: Iterable<string>,
  deps: ImageStoreDeps
): Promise<{ missing: string[] }> {
  const missing: string[] = [];
  for (const hash of refs) {
    if (imageCache.has(hash)) continue;
    let data: string | undefined;
    try {
      data = await deps.backend.get(hash);
    } catch {
      data = undefined;
    }
    if (data !== undefined) {
      imageCache.set(hash, data);
      continue;
    }
    if (deps.fetchFn && deps.machineId) {
      try {
        data = await fetchCloudImage(deps.fetchFn, deps.machineId, hash);
      } catch {
        data = undefined;
      }
      if (data !== undefined) {
        imageCache.set(hash, data);
        try {
          await deps.backend.put(hash, data);
        } catch {
          /* lưu đệm xuống máy lỗi thì ảnh vẫn còn trong RAM phiên này */
        }
        continue;
      }
    }
    missing.push(hash);
  }
  return { missing };
}

/** Bảo đảm mọi ảnh mà một kho đề tham chiếu tới đều sẵn sàng trong bộ đệm. */
export async function ensureImagesForDB(
  db: Record<string, SubjectData>,
  deps: ImageStoreDeps
): Promise<{ missing: string[] }> {
  return ensureImagesForRefs(collectImageRefsInDB(db), deps);
}

/**
 * DI TRÚ + BẢO ĐẢM cho một bản chụp kho đề (dùng trong applyMergedDeckSnapshot):
 * 1) tách mọi ảnh data: còn sót trong các bộ đề vào kho hình, thay bằng
 *    tham chiếu (idempotent — bản chụp đã tách rồi thì bước này là no-op);
 *    ảnh vừa tách cũng được đẩy lên subtree mây kc3d_images theo mã máy
 *    (best-effort: lỗi đẩy mây KHÔNG làm hỏng di trú — kho máy là chính,
 *    lần tách sau hoặc máy khác tự kéo về theo hash khi cần);
 * 2) bảo đảm mọi tham chiếu của bản chụp đều tra cứu được trong bộ đệm
 *    (nạp từ backend máy / mây khi thiếu).
 * Lỗi ghi kho hình ở bước 1 NÉM ra để phía gọi lùi về bản chụp chưa tách
 * (dạng data: vẫn hiển thị/phát đề đúng như trước — di trú thử lại lần sau).
 */
export async function normalizeSnapshotImages(
  snap: DeckSnapshot,
  deps: ImageStoreDeps
): Promise<DeckSnapshot> {
  const { snap: extracted, images } = extractImagesFromSnapshot(snap);
  if (images.size > 0) {
    await storeExtractedImages(deps.backend, images);
    if (deps.fetchFn && deps.machineId) {
      try {
        await pushImagesToCloud(deps.fetchFn, deps.machineId, images);
      } catch {
        /* bản sao mây của kho hình là phụ trợ — máy khác thiếu ảnh nào
           sẽ tự kéo theo hash khi resolve, máy này đẩy bù ở lần tách sau */
      }
    }
  }
  const refs = collectImageRefsInSnapshot(extracted);
  if (refs.size > 0) {
    await ensureImagesForRefs(refs, deps);
  }
  return extracted;
}
