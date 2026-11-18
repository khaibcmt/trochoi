import mqtt, { MqttClient } from 'mqtt';
import { CloudBackupData, CloudSyncProfile, SubjectData, MatchSettings, QuizItem } from '../types';
import { parseHTMLToQuiz } from '../data/defaultSubjects';
import { unionMergeBackupData } from '../utils/deckStore';
import { getCachedImage, resolveImagesInDB, resolveImagesInHtml } from '../utils/imageStore';
import { QUIZ_CHUNK_BUDGET_BYTES, serializedByteLength } from './network';

const SYNC_PROFILE_KEY = 'thpt_cloud_sync_profile_v1';

const MQTT_SYNC_BROKERS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt'
];

export function getStoredSyncProfile(): CloudSyncProfile {
  try {
    const raw = localStorage.getItem(SYNC_PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    type: 'NONE',
    autoSyncEnabled: true
  };
}

export function saveStoredSyncProfile(profile: CloudSyncProfile): void {
  try {
    localStorage.setItem(SYNC_PROFILE_KEY, JSON.stringify(profile));
  } catch {}
}

export function calculateBackupStats(subjectsDB: Record<string, SubjectData>) {
  let totalQuestions = 0;
  const totalSubjects = Object.keys(subjectsDB || {}).length;
  Object.values(subjectsDB || {}).forEach(s => {
    if (s && s.html) {
      try {
        // 🖼️ Đếm câu trên bản ĐÃ NHÚNG LẠI ẢNH THẬT: html lưu dạng tham
        // chiếu imgref:<hash> mà đem parse thẳng thì bộ parse sẽ loại thẻ
        // <img> lạ src → đếm lệch/sai cấu trúc câu có hình.
        const qList = parseHTMLToQuiz(resolveImagesInHtml(s.html, getCachedImage).html);
        totalQuestions += qList.length;
      } catch {}
    }
  });
  return { totalSubjects, totalQuestions };
}

export function prepareBackupPayload(
  subjectsDB: Record<string, SubjectData>,
  currentSubjectKey: string,
  matchSettings: MatchSettings,
  activeQuizList?: QuizItem[],
  deckUpdatedAt?: Record<string, number>
): CloudBackupData {
  const stats = calculateBackupStats(subjectsDB);
  return {
    version: 1,
    lastUpdated: Date.now(),
    deviceLabel: typeof navigator !== 'undefined' ? `${navigator.platform || 'Thiết bị'} (${new Date().toLocaleDateString('vi-VN')})` : 'Web',
    // 🖼️ MỌI bản sao lưu rời khỏi máy (mây MQTT / mã 1 chạm / file .json)
    // đều phải TỰ CHỨA ẢNH: kho đề trong máy chỉ giữ tham chiếu
    // imgref:<hash> nên tại đây nhúng lại data URL thật từ bộ đệm kho
    // hình. Máy nhận (kể cả bản app cũ) mở ra là đủ ảnh, không cần kho
    // hình của máy gửi; phía nạp sẽ tách + khử trùng trở lại khi áp vào.
    subjectsDB: resolveImagesInDB(subjectsDB, getCachedImage),
    currentSubjectKey,
    matchSettings,
    activeQuizList,
    deckUpdatedAt,
    stats
  };
}

// Băm mật khẩu hoặc email thành mã định danh an toàn (chạy được trên mọi trình duyệt)
export async function computeSyncKey(syncType: 'GOOGLE' | 'PASSWORD' | 'NONE' | string, rawIdentifier: string): Promise<string> {
  const clean = rawIdentifier.trim().toLowerCase();
  const prefix = syncType === 'GOOGLE' ? 'g_' : 'p_';
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const buffer = new TextEncoder().encode(clean);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
      const hex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 32);
      return `${prefix}${hex}`;
    } catch {}
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < clean.length; i++) {
    h ^= clean.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${prefix}${(h >>> 0).toString(16)}_${clean.replace(/[^a-z0-9]/g, '').slice(0, 8)}`;
}

// Helper fetch JSON an toàn: Không bao giờ bị crash bởi trang HTML 404 của GitHub Pages
async function safeFetchJson(url: string, options: RequestInit): Promise<any | null> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
}

// ============================================================================
// Đợt 6 (2.5): Sao lưu MQTT CHIA NHỎ theo môn + MANIFEST + báo cáo trung thực
// ----------------------------------------------------------------------------
// Trước đây toàn bộ kho đề bị nhét vào ĐÚNG 1 tin retained duy nhất
// (topic thpt_sync_v2/<key>) — kho có vài môn chứa ảnh là vượt giới hạn gói của
// broker công cộng, publish rớt lặng lẽ mà phía lưu vẫn tưởng đã sao lưu xong.
//
// Thiết kế mới (vẫn dùng retained + QoS 1 trên cùng broker):
//   thpt_sync_v2/<key>/manifest     : 1 tin mục lục — số môn, tổng dung lượng,
//                                     thời gian, và danh sách từng phần kèm
//                                     topic/số mảnh/dung lượng của nó.
//   thpt_sync_v2/<key>/meta         : phần thông tin chung (cài đặt trận, môn
//                                     đang chọn, danh sách câu đang mở, stats).
//   thpt_sync_v2/<key>/subject/<i>  : mỗi môn 1 tin riêng (i = thứ tự môn).
// Phần nào (meta hoặc 1 môn) vẫn vượt ngân sách byte thì bị cắt CHUỖI payload
// thành nhiều mảnh tại …/frag/<j> — dùng cùng ngân sách ~180KB/tin như chunk đề
// Đợt 3 (QUIZ_CHUNK_BUDGET_BYTES), trừ hao so với giới hạn ~256KB của broker.
// Thứ tự publish: các phần trước, MANIFEST CUỐI CÙNG — phía khôi phục thấy
// manifest là biết các phần của đúng lượt sao lưu đó (mỗi phần đều mang cùng
// lastUpdated với manifest; lệch lastUpdated = phần cũ sót lại -> coi như thiếu).
// TƯƠNG THÍCH NGƯỢC: bản sao lưu CŨ (1 tin duy nhất ở thpt_sync_v2/<key>) vẫn
// được đường khôi phục đọc theo nhánh fallback khi không có manifest.
// ============================================================================

const SYNC_TOPIC_ROOT = 'thpt_sync_v2';
const SYNC_PART_BUDGET_BYTES = QUIZ_CHUNK_BUDGET_BYTES;

interface SyncPartDescriptor {
  subjectKey: string | null; // null = phần meta (thông tin chung)
  name?: string; // tên môn (để báo lỗi thiếu cho dễ hiểu)
  topic: string; // topic đầy đủ của phần (chưa gồm hậu tố /frag/<j>)
  fragments: number; // 1 = payload nằm nguyên tại topic; >1 = cắt mảnh ở topic/frag/<j>
  bytes: number; // dung lượng byte của payload phần (trước khi cắt mảnh)
}

interface SyncManifest {
  kind: 'thpt_sync_manifest';
  version: 2;
  topicKey: string;
  lastUpdated: number;
  totalBytes: number;
  totalSubjects: number;
  meta: SyncPartDescriptor;
  subjects: SyncPartDescriptor[];
}

interface PlannedSyncMessage {
  topic: string;
  payload: string;
}

// Lên kế hoạch publish cho 1 phần: vừa ngân sách thì 1 tin; quá lớn thì cắt chuỗi
// payload thành nhiều mảnh, mỗi mảnh bọc envelope JSON vẫn nằm dưới ngân sách byte
// (ước lượng xấu nhất 3 byte/ký tự UTF-8 + chừa 1KB cho envelope).
function planPartMessages(fullTopic: string, payloadStr: string): { messages: PlannedSyncMessage[]; fragments: number; bytes: number } {
  const bytes = serializedByteLength(payloadStr);
  if (bytes <= SYNC_PART_BUDGET_BYTES) {
    return { messages: [{ topic: fullTopic, payload: payloadStr }], fragments: 1, bytes };
  }
  const sliceChars = Math.max(1024, Math.floor((SYNC_PART_BUDGET_BYTES - 1024) / 3));
  const slices: string[] = [];
  for (let i = 0; i < payloadStr.length; i += sliceChars) {
    slices.push(payloadStr.slice(i, i + sliceChars));
  }
  const messages = slices.map((data, j) => ({
    topic: `${fullTopic}/frag/${j}`,
    payload: JSON.stringify({ kind: 'thpt_sync_fragment', fragIndex: j, fragTotal: slices.length, data })
  }));
  return { messages, fragments: slices.length, bytes };
}

function publishRetained(client: MqttClient, topic: string, payload: string): Promise<boolean> {
  return new Promise((res) => {
    try {
      client.publish(topic, payload, { retain: true, qos: 1 }, (err) => res(!err));
    } catch {
      res(false);
    }
  });
}

// 1. Sao lưu qua MQTT Retained Message (Chạy 100% trên GitHub Pages & Máy trường học không cần backend)
// Đợt 6 (2.5): chia nhỏ theo môn + manifest như khối thiết kế ở trên. Chỉ resolve(true)
// khi MỌI phần và manifest đều được broker xác nhận (callback publish QoS 1 không lỗi).
function saveToMqttCloud(topicKey: string, backupData: CloudBackupData): Promise<boolean> {
  return new Promise((resolve) => {
    const lastUpdated = Date.now();
    const base = `${SYNC_TOPIC_ROOT}/${topicKey}`;

    // --- Dựng các phần: 1 phần meta + mỗi môn 1 phần ---
    const planned: PlannedSyncMessage[] = [];
    let totalBytes = 0;

    const metaTopic = `${base}/meta`;
    const metaPayloadStr = JSON.stringify({
      kind: 'thpt_sync_meta',
      topicKey,
      lastUpdated,
      meta: {
        version: backupData.version,
        deviceLabel: backupData.deviceLabel,
        currentSubjectKey: backupData.currentSubjectKey,
        matchSettings: backupData.matchSettings,
        activeQuizList: backupData.activeQuizList,
        deckUpdatedAt: backupData.deckUpdatedAt,
        stats: backupData.stats
      }
    });
    const metaPlan = planPartMessages(metaTopic, metaPayloadStr);
    planned.push(...metaPlan.messages);
    totalBytes += metaPlan.bytes;
    const metaDescriptor: SyncPartDescriptor = {
      subjectKey: null,
      topic: metaTopic,
      fragments: metaPlan.fragments,
      bytes: metaPlan.bytes
    };

    const subjectKeys = Object.keys(backupData.subjectsDB || {});
    const subjectDescriptors: SyncPartDescriptor[] = [];
    subjectKeys.forEach((subjectKey, idx) => {
      const subject = backupData.subjectsDB[subjectKey];
      const topic = `${base}/subject/${idx}`;
      const payloadStr = JSON.stringify({
        kind: 'thpt_sync_subject',
        topicKey,
        lastUpdated,
        subjectKey,
        subject
      });
      const plan = planPartMessages(topic, payloadStr);
      planned.push(...plan.messages);
      totalBytes += plan.bytes;
      subjectDescriptors.push({
        subjectKey,
        name: subject?.name,
        topic,
        fragments: plan.fragments,
        bytes: plan.bytes
      });
    });

    const manifest: SyncManifest = {
      kind: 'thpt_sync_manifest',
      version: 2,
      topicKey,
      lastUpdated,
      totalBytes,
      totalSubjects: subjectKeys.length,
      meta: metaDescriptor,
      subjects: subjectDescriptors
    };

    // --- Publish lần lượt từng phần, manifest cuối cùng ---
    let completed = false;
    const client = mqtt.connect(MQTT_SYNC_BROKERS[0], {
      clientId: `thpt_sync_pub_${Math.random().toString(16).slice(2, 8)}`,
      connectTimeout: 7000
    });

    const finish = (ok: boolean) => {
      if (!completed) {
        completed = true;
        try {
          client.end(true);
        } catch {}
        resolve(ok);
      }
    };

    const timer = setTimeout(() => finish(false), Math.min(120000, 12000 + planned.length * 5000));

    client.on('connect', async () => {
      try {
        for (const msg of planned) {
          const okPub = await publishRetained(client, msg.topic, msg.payload);
          if (!okPub) {
            clearTimeout(timer);
            finish(false);
            return;
          }
        }
        const okManifest = await publishRetained(client, `${base}/manifest`, JSON.stringify(manifest));
        clearTimeout(timer);
        finish(okManifest);
      } catch {
        clearTimeout(timer);
        finish(false);
      }
    });

    client.on('error', () => {
      clearTimeout(timer);
      finish(false);
    });
  });
}

interface MqttLoadResult {
  ok: boolean;
  backup?: CloudBackupData;
  lastUpdated?: number;
  // Đợt 6 (2.5): có manifest nhưng thiếu phần -> báo rõ thiếu phần/môn nào,
  // TUYỆT ĐỐI không khôi phục thầm lặng một bản thiếu.
  incomplete?: boolean;
  missingParts?: string[];
  // 💾 GIA CỐ (18/11/2026): true khi đã kết nối + đăng ký nhận tin THÀNH CÔNG
  // mà không thấy bản sao lưu nào — phân biệt "mây trống thật" với "mất mạng
  // nên không đọc được" để đường sao lưu hợp nhất an toàn (không ghi đè mù).
  reachable?: boolean;
}

// 2. Tải bản sao lưu qua MQTT Retained Message
// Đợt 6 (2.5): đọc manifest + từng phần theo manifest; thiếu phần thì trả
// incomplete kèm tên phần/môn thiếu. Không có manifest -> fallback đọc bản CŨ
// 1 tin duy nhất ở topic gốc (tương thích ngược với sao lưu trước Đợt 6).
function loadFromMqttCloud(topicKey: string): Promise<MqttLoadResult> {
  return new Promise((resolve) => {
    let completed = false;
    let subscribed = false;
    const base = `${SYNC_TOPIC_ROOT}/${topicKey}`;
    const received = new Map<string, string>();
    let legacyBackup: { backup: CloudBackupData; lastUpdated?: number } | null = null;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;

    const client = mqtt.connect(MQTT_SYNC_BROKERS[0], {
      clientId: `thpt_sync_sub_${Math.random().toString(16).slice(2, 8)}`,
      connectTimeout: 7000
    });

    const finish = (result: MqttLoadResult) => {
      if (!completed) {
        completed = true;
        if (graceTimer) clearTimeout(graceTimer);
        clearTimeout(timer);
        try {
          client.end(true);
        } catch {}
        resolve(result);
      }
    };

    const getManifest = (): SyncManifest | null => {
      const raw = received.get(`${base}/manifest`);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.kind === 'thpt_sync_manifest' && parsed.meta && Array.isArray(parsed.subjects)) {
          return parsed as SyncManifest;
        }
      } catch {}
      return null;
    };

    // Đọc 1 phần theo mô tả trong manifest: ghép các mảnh (nếu bị cắt) và kiểm
    // lastUpdated phải khớp manifest (phần cũ sót từ lượt sao lưu trước = thiếu).
    const readPartPayload = (desc: SyncPartDescriptor, expectedUpdated: number): any | null => {
      let payloadStr: string | null = null;
      if (desc.fragments <= 1) {
        payloadStr = received.get(desc.topic) ?? null;
      } else {
        let joined = '';
        for (let j = 0; j < desc.fragments; j++) {
          const raw = received.get(`${desc.topic}/frag/${j}`);
          if (raw === undefined) return null;
          try {
            const frag = JSON.parse(raw);
            if (!frag || typeof frag.data !== 'string') return null;
            joined += frag.data;
          } catch {
            return null;
          }
        }
        payloadStr = joined;
      }
      if (payloadStr === null) return null;
      try {
        const parsed = JSON.parse(payloadStr);
        if (!parsed || parsed.lastUpdated !== expectedUpdated) return null;
        return parsed;
      } catch {
        return null;
      }
    };

    // Đánh giá trạng thái hiện có: đủ bộ theo manifest / có manifest nhưng thiếu / chưa có gì dùng được
    const evaluateManifest = (): { state: 'complete'; backup: CloudBackupData; lastUpdated: number } | { state: 'incomplete'; missing: string[] } | { state: 'none' } => {
      const manifest = getManifest();
      if (!manifest) return { state: 'none' };
      const missing: string[] = [];

      const metaParsed = readPartPayload(manifest.meta, manifest.lastUpdated);
      if (!metaParsed || !metaParsed.meta) missing.push('phần thông tin chung (cài đặt & danh sách câu đang mở)');

      const subjectsDB: Record<string, SubjectData> = {};
      for (const desc of manifest.subjects) {
        const label = desc.name || desc.subjectKey || desc.topic;
        const parsed = readPartPayload(desc, manifest.lastUpdated);
        if (!parsed || !parsed.subject || !desc.subjectKey) {
          missing.push(`môn ${label}`);
        } else {
          subjectsDB[desc.subjectKey] = parsed.subject as SubjectData;
        }
      }

      if (missing.length > 0) return { state: 'incomplete', missing };

      const meta = metaParsed.meta;
      const backup: CloudBackupData = {
        version: typeof meta.version === 'number' ? meta.version : 2,
        lastUpdated: manifest.lastUpdated,
        deviceLabel: meta.deviceLabel,
        subjectsDB,
        currentSubjectKey: meta.currentSubjectKey,
        matchSettings: meta.matchSettings,
        activeQuizList: meta.activeQuizList,
        deckUpdatedAt: meta.deckUpdatedAt,
        stats: meta.stats
      };
      return { state: 'complete', backup, lastUpdated: manifest.lastUpdated };
    };

    const timer = setTimeout(() => {
      const ev = evaluateManifest();
      if (ev.state === 'complete') {
        finish({ ok: true, backup: ev.backup, lastUpdated: ev.lastUpdated });
      } else if (ev.state === 'incomplete') {
        finish({ ok: false, incomplete: true, missingParts: ev.missing });
      } else if (legacyBackup) {
        finish({ ok: true, backup: legacyBackup.backup, lastUpdated: legacyBackup.lastUpdated });
      } else {
        finish({ ok: false, reachable: subscribed });
      }
    }, 12000);

    client.on('connect', () => {
      // Topic gốc (bản CŨ 1 tin) + toàn bộ cây con (manifest/meta/subject/frag)
      client.subscribe([base, `${base}/#`], { qos: 1 }, (err) => {
        if (err) {
          finish({ ok: false });
        } else {
          subscribed = true;
        }
      });
    });

    client.on('message', (topic, payload) => {
      const text = payload.toString();
      if (topic === base) {
        // Tin ở topic gốc = bản sao lưu CŨ (trước Đợt 6) — giữ làm fallback
        try {
          const parsed = JSON.parse(text);
          if (parsed && parsed.backup) {
            legacyBackup = { backup: parsed.backup, lastUpdated: parsed.lastUpdated || Date.now() };
          }
        } catch {}
      } else {
        received.set(topic, text);
      }

      const ev = evaluateManifest();
      if (ev.state === 'complete') {
        finish({ ok: true, backup: ev.backup, lastUpdated: ev.lastUpdated });
        return;
      }

      // Ân hạn ngắn sau tin đầu tiên: nếu chỉ có bản CŨ (không manifest) thì chốt
      // luôn bằng bản cũ, khỏi chờ hết thời gian chờ tối đa.
      if (!graceTimer) {
        graceTimer = setTimeout(() => {
          if (completed) return;
          const ev2 = evaluateManifest();
          if (ev2.state === 'complete') {
            finish({ ok: true, backup: ev2.backup, lastUpdated: ev2.lastUpdated });
          } else if (ev2.state === 'none' && legacyBackup) {
            finish({ ok: true, backup: legacyBackup.backup, lastUpdated: legacyBackup.lastUpdated });
          }
          // Có manifest nhưng còn thiếu phần: tiếp tục chờ tới hết giờ ở timer chính
          // để các phần còn lại kịp về; hết giờ mà vẫn thiếu sẽ báo rõ ở timer chính.
        }, 3500);
      }
    });

    client.on('error', () => {
      finish({ ok: false });
    });
  });
}

export interface CloudSaveOutcome {
  ok: boolean;
  /** Kênh máy chủ /api/sync/* có tồn tại ở bản triển khai này không (response null = không có). */
  backendAvailable: boolean;
  /** Kênh bị phán là lỗi khi ok=false (để chọn thông điệp đúng bản chất). */
  failedVia: 'mqtt' | 'mqtt+backend' | null;
}

/**
 * Phán kết quả sao lưu từ kết quả từng kênh (THUẦN — test được):
 * - Chế độ TỰ ĐỘNG (auto): CHỈ phán theo kênh MQTT. Kênh "máy chủ"
 *   /api/sync/* là ĐƯỜNG CHẾT-BY-DESIGN trên GitHub Pages tĩnh (không có
 *   backend nào nghe ở đó — endpoint chỉ tồn tại khi tự chạy server.ts),
 *   nên bị loại hẳn khỏi tiêu chí phán lỗi của auto-sync: trước đây nó
 *   luôn "thất bại" và kéo cả lần sao lưu thành banner "cả 2 kênh đều
 *   thất bại" dù kênh MQTT mới là kênh thật duy nhất.
 * - Chế độ THỦ CÔNG (nút bấm trong modal): giữ nguyên — thành công khi
 *   MQTT hoặc backend (nếu thật sự có) xác nhận đã lưu.
 */
export function evaluateCloudSaveOutcome(
  mqttSuccess: boolean,
  backendData: any | null | undefined,
  auto: boolean
): CloudSaveOutcome {
  if (auto) {
    return { ok: mqttSuccess, backendAvailable: false, failedVia: mqttSuccess ? null : 'mqtt' };
  }
  const backendOk = !!(backendData && backendData.ok);
  const ok = mqttSuccess || backendOk;
  return {
    ok,
    backendAvailable: backendData !== null && backendData !== undefined,
    failedVia: ok ? null : 'mqtt+backend'
  };
}

// API CHÍNH: Sao lưu lên Đám mây (Đa kênh: MQTT Retained + HTTP Backend nếu có)
// opts.auto = đường TỰ ĐỘNG sau mỗi lần lưu: bỏ qua hẳn kênh máy chủ chết
// (xem evaluateCloudSaveOutcome) và thông điệp lỗi gọn theo kênh MQTT.
export async function saveBackupToCloud(
  profile: CloudSyncProfile,
  backupData: CloudBackupData,
  opts?: { auto?: boolean }
): Promise<{ ok: boolean; message: string; lastUpdated?: number; mergedBackup?: CloudBackupData }> {
  try {
    if (profile.type === 'NONE') {
      return { ok: false, message: 'Vui lòng chọn loại đồng bộ (Tài khoản Google hoặc Mật khẩu bí mật).' };
    }
    const identifier = profile.type === 'GOOGLE' ? profile.googleEmail : profile.passwordKey;
    if (!identifier || !identifier.trim()) {
      return { ok: false, message: 'Vui lòng nhập tài khoản Google hoặc Mật khẩu đồng bộ.' };
    }

    const topicKey = await computeSyncKey(profile.type, identifier);

    // 💾 GIA CỐ HỢP NHẤT UNION (18/11/2026): TRƯỚC khi đẩy, đọc bản mây hiện
    // tại rồi HỢP NHẤT với bản sắp đẩy (theo từng bộ đề, bản mới hơn theo
    // deckUpdatedAt thắng; bộ đề chỉ có trên mây được GIỮ LẠI). Nhờ vậy một
    // lần sao lưu từ máy cũ/máy đang thiếu đề KHÔNG BAO GIỜ làm kho mây ít
    // đi trong im lặng — đúng vụ 17/11: mây đang giữ 24 bộ, máy chỉ còn 23,
    // bấm Sao lưu ở máy 23 trước đây sẽ ghi đè mất bộ thứ 24 trên mây.
    // Không đọc được bản mây (mất mạng / bản mây thiếu phần) → HỦY lần sao
    // lưu này và báo rõ, tuyệt đối không ghi đè mù.
    let finalBackup = backupData;
    let unionKept = 0;
    const preLoad = await loadBackupFromCloud(profile.type as 'GOOGLE' | 'PASSWORD', identifier);
    if (preLoad.ok && preLoad.backup) {
      const u = unionMergeBackupData(preLoad.backup, backupData);
      unionKept = u.keptOnlyInExisting;
      finalBackup = {
        ...backupData,
        subjectsDB: u.subjectsDB,
        deckUpdatedAt: u.deckUpdatedAt,
        stats: calculateBackupStats(u.subjectsDB)
      };
    } else if (preLoad.incomplete) {
      return {
        ok: false,
        message:
          'Bản sao lưu trên mây đang THIẾU dữ liệu — em đã HỦY lần sao lưu này để tránh ghi đè làm mất bộ đề. Thầy/Cô kiểm tra mạng rồi bấm Sao lưu lại cho đủ.'
      };
    } else if (!preLoad.cloudReachable) {
      return {
        ok: false,
        message:
          'Chưa đọc được bản sao lưu mây hiện tại (kết nối đám mây chập chờn) — em đã HỦY lần sao lưu này để tránh ghi đè làm mất bộ đề đang có trên mây. Dữ liệu trên máy vẫn an toàn; Thầy/Cô kiểm tra mạng rồi bấm Sao lưu lại.'
      };
    }
    // (Đã kết nối được mà mây trống thật → đẩy thẳng bản hiện tại.)

    // Kênh 1: Sao lưu qua MQTT Đám Mây (Hoạt động hoàn hảo trên GitHub Pages không cần server)
    const mqttSuccess = await saveToMqttCloud(topicKey, finalBackup);

    // Kênh 2: Nếu có máy chủ Express Backend cùng tên miền thì lưu thêm vào server.ts.
    // 🔥 Chế độ TỰ ĐỘNG (opts.auto): BỎ QUA HẲN kênh này — trên GitHub
    // Pages tĩnh nó là đường chết-by-design (không có backend), gọi chỉ
    // tốn một request 404 vô ích và trước đây còn bị tính là một kênh
    // "thất bại" trong thông điệp lỗi (xem evaluateCloudSaveOutcome).
    let backendData: any = undefined;
    if (!opts?.auto) {
      backendData = await safeFetchJson('/api/sync/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncType: profile.type,
          identifier: identifier.trim(),
          backup: finalBackup
        })
      });
    }

    const now = Date.now();

    // Dù kênh cloud thành hay bại, luôn giữ 1 bản sao đệm nội bộ ngay trên máy này
    // (đây chính là "bản lưu trên máy này" được nhắc trong thông báo khi cloud fail).
    try {
      localStorage.setItem(`thpt_cloud_cache_${topicKey}`, JSON.stringify({ lastUpdated: now, backup: finalBackup }));
    } catch {}

    // Đợt 6 (2.5): TRUNG THỰC — chỉ báo thành công khi kênh cloud thật xác
    // nhận đã lưu (qua evaluateCloudSaveOutcome: thủ công = MQTT hoặc
    // backend có thật; tự động = chỉ MQTT). Trước đây cả 2 kênh đều fail
    // vẫn trả ok:true giả, giáo viên tưởng đề đã lên mây trong khi chưa hề.
    const outcome = evaluateCloudSaveOutcome(mqttSuccess, backendData, !!opts?.auto);
    if (outcome.ok) {
      const updatedProfile: CloudSyncProfile = {
        ...profile,
        lastSyncedAt: now
      };
      saveStoredSyncProfile(updatedProfile);
      return {
        ok: true,
        message:
          (profile.type === 'GOOGLE'
            ? `Đã sao lưu thành công lên tài khoản Google (${profile.googleEmail})!`
            : `Đã sao lưu thành công với Mật khẩu bí mật của Thầy/Cô!`) +
          (unionKept > 0
            ? ` (Hợp nhất an toàn: đã giữ lại ${unionKept} bộ đề chỉ có trên mây, không bộ nào bị mất.)`
            : ''),
        lastUpdated: now,
        mergedBackup: finalBackup
      };
    }

    // Không kênh cloud nào xác nhận đã lưu -> báo lỗi rõ ràng, KHÔNG ghi
    // lastSyncedAt. 🔥 HOTFIX 18/11/2026: phân biệt đúng bản chất từng
    // kênh — trên bản web tĩnh (GitHub Pages) KHÔNG tồn tại "kênh máy
    // chủ" (đường /api/sync/* chỉ có khi tự chạy server.ts); safeFetchJson
    // trả null nghĩa là kênh đó KHÔNG KHẢ DỤNG trên bản này chứ không
    // phải một kênh "thất bại". Thông điệp cũ gộp cả kênh không tồn tại
    // vào thành "cả 2 kênh đều thất bại" làm giáo viên hoang mang, trong
    // khi lỗi thật chỉ nằm ở chiều ĐẨY qua MQTT (mạng tại chỗ chập
    // chờn/chặn broker) — và chiều TẢI VỀ (Nhập/Đồng bộ về) là đường độc
    // lập, không hề bị ảnh hưởng bởi lần đẩy hỏng này.
    if (opts?.auto) {
      // Đường TỰ ĐỘNG: thông điệp gọn, chỉ nói về kênh MQTT thật — phía
      // gọi (triggerAutoCloudSync) chỉ ghi chú lặng trong modal Đồng bộ.
      return {
        ok: false,
        message:
          'Kênh đồng bộ trực tiếp (MQTT) chưa kết nối được — mạng tại chỗ có thể đang chặn hoặc chập chờn với máy chủ đồng bộ (broker).'
      };
    }
    return {
      ok: false,
      message: outcome.backendAvailable
        ? 'Chưa sao lưu được lên đám mây: cả kênh trực tiếp (MQTT) và kênh máy chủ đều chưa xác nhận đã lưu. Dữ liệu vẫn an toàn trên máy này — Thầy/Cô kiểm tra kết nối mạng rồi bấm Sao lưu lại nhé! (Việc TẢI VỀ/Nhập đồng bộ là đường riêng, không bị ảnh hưởng.)'
        : 'Chưa sao lưu được lên đám mây: kênh đồng bộ trực tiếp (MQTT) chưa kết nối được — thường do mạng tại chỗ chặn hoặc chập chờn. Dữ liệu vẫn an toàn trên máy này và trong bộ nhớ đệm của app; sang máy khác sẽ chưa thấy bản mới này. Thầy/Cô kiểm tra mạng rồi bấm Sao lưu lại nhé! (Việc TẢI VỀ/Nhập đồng bộ là đường riêng, không bị ảnh hưởng bởi lần đẩy này.)'
    };
  } catch (err: any) {
    return { ok: false, message: 'Lỗi mạng khi kết nối đám mây: ' + (err.message || '') };
  }
}

// API CHÍNH: Tải bản sao lưu từ Đám mây về máy hiện tại
export async function loadBackupFromCloud(
  syncType: 'GOOGLE' | 'PASSWORD',
  identifier: string
): Promise<{ ok: boolean; message: string; backup?: CloudBackupData; lastUpdated?: number; incomplete?: boolean; cloudReachable?: boolean }> {
  try {
    if (!identifier || !identifier.trim()) {
      return { ok: false, message: 'Vui lòng nhập email Google hoặc mật khẩu đồng bộ.' };
    }

    const topicKey = await computeSyncKey(syncType, identifier);

    // Thử kênh 1: HTTP Backend (nếu chạy local hoặc có server)
    const backendData = await safeFetchJson('/api/sync/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        syncType,
        identifier: identifier.trim()
      })
    });

    if (backendData && backendData.ok && backendData.backup) {
      return {
        ok: true,
        message: 'Tải dữ liệu từ đám mây thành công!',
        backup: backendData.backup,
        lastUpdated: backendData.lastUpdated
      };
    }

    // Thử kênh 2: MQTT Retained Message (Chạy trực tiếp trên GitHub Pages https://khaibcmt.github.io)
    const mqttResult = await loadFromMqttCloud(topicKey);
    if (mqttResult.ok && mqttResult.backup) {
      return {
        ok: true,
        message: 'Tải dữ liệu từ đám mây thành công qua kênh trực tiếp!',
        backup: mqttResult.backup,
        lastUpdated: mqttResult.lastUpdated
      };
    }

    // Đợt 6 (2.5): có bản sao lưu trên mây nhưng THIẾU phần — báo rõ thiếu môn/phần
    // nào và DỪNG ở đây, không lẳng lặng khôi phục bản thiếu hay bản đệm cũ.
    if (mqttResult.incomplete) {
      const missingList = (mqttResult.missingParts || []).join('; ');
      return {
        ok: false,
        incomplete: true,
        cloudReachable: true,
        message: `Bản sao lưu trên đám mây đang THIẾU dữ liệu: ${missingList}. Em chưa khôi phục để tránh làm mất đề — Thầy/Cô hãy mở máy đã sao lưu, kiểm tra mạng rồi bấm "Sao lưu" lại cho đủ, sau đó tải lại ở máy này.`
      };
    }

    // Thử kênh 3: Bộ nhớ đệm dự phòng nội bộ
    try {
      const cached = localStorage.getItem(`thpt_cloud_cache_${topicKey}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.backup) {
          return {
            ok: true,
            message: 'Đã khôi phục dữ liệu từ bộ nhớ sao lưu gần nhất!',
            backup: parsed.backup,
            lastUpdated: parsed.lastUpdated
          };
        }
      }
    } catch {}

    const hint = syncType === 'PASSWORD'
      ? 'Mật khẩu đồng bộ chưa chính xác hoặc chưa có dữ liệu nào được lưu với mật khẩu này. Vui lòng kiểm tra lại mật khẩu Thầy/Cô đã đặt ở máy trước.'
      : `Chưa tìm thấy dữ liệu sao lưu cho tài khoản Google [${identifier}]. Hãy đảm bảo Thầy/Cô đã bấm "Sao Lưu Lên Google" ở máy soạn bài.`;

    return {
      ok: false,
      // Đã kết nối + đăng ký nhận tin thành công mà không thấy gì = mây
      // trống thật; ngược lại là không đọc được (mạng/broker) — phía sao
      // lưu hợp nhất dựa vào cờ này để không ghi đè mù.
      cloudReachable: mqttResult.reachable === true,
      message: hint
    };
  } catch (err: any) {
    return { ok: false, message: 'Lỗi tải bản sao lưu: ' + (err.message || '') };
  }
}

// Kiểm tra trạng thái có bản sao lưu trên Đám mây hay chưa
export async function checkBackupStatus(
  syncType: 'GOOGLE' | 'PASSWORD',
  identifier: string
): Promise<{ exists: boolean; lastUpdated?: number; stats?: { totalSubjects: number; totalQuestions: number } }> {
  try {
    if (!identifier || !identifier.trim()) {
      return { exists: false };
    }

    const topicKey = await computeSyncKey(syncType, identifier);

    // Kiểm tra cache trước để phản hồi tức thì
    try {
      const cached = localStorage.getItem(`thpt_cloud_cache_${topicKey}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.backup) {
          return {
            exists: true,
            lastUpdated: parsed.lastUpdated,
            stats: parsed.backup.stats
          };
        }
      }
    } catch {}

    const backendData = await safeFetchJson('/api/sync/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        syncType,
        identifier: identifier.trim()
      })
    });

    if (backendData && backendData.exists) {
      return backendData;
    }

    return { exists: false };
  } catch {
    return { exists: false };
  }
}

// 3. Tính năng Sao Chép / Dán Mã Khôi Phục Nhanh (Dự phòng 100% khi không có internet)
export function exportSyncCodeString(backupData: CloudBackupData): string {
  try {
    const jsonStr = JSON.stringify(backupData);
    return btoa(unescape(encodeURIComponent(jsonStr)));
  } catch {
    return JSON.stringify(backupData);
  }
}

export function importSyncCodeString(codeStr: string): CloudBackupData | null {
  try {
    const trimmed = codeStr.trim();
    let jsonStr = trimmed;
    try {
      jsonStr = decodeURIComponent(escape(atob(trimmed)));
    } catch {}
    const parsed = JSON.parse(jsonStr);
    if (parsed && parsed.subjectsDB) {
      return parsed as CloudBackupData;
    }
  } catch {}
  return null;
}
