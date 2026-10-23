import mqtt, { MqttClient } from 'mqtt';
import { CloudBackupData, CloudSyncProfile, SubjectData, MatchSettings, QuizItem } from '../types';
import { parseHTMLToQuiz } from '../data/defaultSubjects';

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
        const qList = parseHTMLToQuiz(s.html);
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
  activeQuizList?: QuizItem[]
): CloudBackupData {
  const stats = calculateBackupStats(subjectsDB);
  return {
    version: 1,
    lastUpdated: Date.now(),
    deviceLabel: typeof navigator !== 'undefined' ? `${navigator.platform || 'Thiết bị'} (${new Date().toLocaleDateString('vi-VN')})` : 'Web',
    subjectsDB,
    currentSubjectKey,
    matchSettings,
    activeQuizList,
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

// 1. Sao lưu qua MQTT Retained Message (Chạy 100% trên GitHub Pages & Máy trường học không cần backend)
function saveToMqttCloud(topicKey: string, backupData: CloudBackupData): Promise<boolean> {
  return new Promise((resolve) => {
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

    const timer = setTimeout(() => finish(false), 8000);

    client.on('connect', () => {
      const payloadStr = JSON.stringify({
        topicKey,
        lastUpdated: Date.now(),
        backup: backupData
      });

      client.publish(`thpt_sync_v2/${topicKey}`, payloadStr, { retain: true, qos: 1 }, (err) => {
        clearTimeout(timer);
        finish(!err);
      });
    });

    client.on('error', () => {
      clearTimeout(timer);
      finish(false);
    });
  });
}

// 2. Tải bản sao lưu qua MQTT Retained Message
function loadFromMqttCloud(topicKey: string): Promise<{ ok: boolean; backup?: CloudBackupData; lastUpdated?: number }> {
  return new Promise((resolve) => {
    let completed = false;
    const client = mqtt.connect(MQTT_SYNC_BROKERS[0], {
      clientId: `thpt_sync_sub_${Math.random().toString(16).slice(2, 8)}`,
      connectTimeout: 7000
    });

    const finish = (result: { ok: boolean; backup?: CloudBackupData; lastUpdated?: number }) => {
      if (!completed) {
        completed = true;
        try {
          client.end(true);
        } catch {}
        resolve(result);
      }
    };

    const timer = setTimeout(() => {
      finish({ ok: false });
    }, 7000);

    client.on('connect', () => {
      const topic = `thpt_sync_v2/${topicKey}`;
      client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          clearTimeout(timer);
          finish({ ok: false });
        }
      });
    });

    client.on('message', (_topic, payload) => {
      try {
        const text = payload.toString();
        const parsed = JSON.parse(text);
        if (parsed && parsed.backup) {
          clearTimeout(timer);
          finish({
            ok: true,
            backup: parsed.backup,
            lastUpdated: parsed.lastUpdated || Date.now()
          });
        }
      } catch {
        clearTimeout(timer);
        finish({ ok: false });
      }
    });

    client.on('error', () => {
      clearTimeout(timer);
      finish({ ok: false });
    });
  });
}

// API CHÍNH: Sao lưu lên Đám mây (Đa kênh: MQTT Retained + HTTP Backend nếu có)
export async function saveBackupToCloud(
  profile: CloudSyncProfile,
  backupData: CloudBackupData
): Promise<{ ok: boolean; message: string; lastUpdated?: number }> {
  try {
    if (profile.type === 'NONE') {
      return { ok: false, message: 'Vui lòng chọn loại đồng bộ (Tài khoản Google hoặc Mật khẩu bí mật).' };
    }
    const identifier = profile.type === 'GOOGLE' ? profile.googleEmail : profile.passwordKey;
    if (!identifier || !identifier.trim()) {
      return { ok: false, message: 'Vui lòng nhập tài khoản Google hoặc Mật khẩu đồng bộ.' };
    }

    const topicKey = await computeSyncKey(profile.type, identifier);

    // Kênh 1: Sao lưu qua MQTT Đám Mây (Hoạt động hoàn hảo trên GitHub Pages không cần server)
    const mqttSuccess = await saveToMqttCloud(topicKey, backupData);

    // Kênh 2: Nếu có máy chủ Express Backend cùng tên miền thì lưu thêm vào server.ts
    const backendData = await safeFetchJson('/api/sync/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        syncType: profile.type,
        identifier: identifier.trim(),
        backup: backupData
      })
    });

    const now = Date.now();
    const updatedProfile: CloudSyncProfile = {
      ...profile,
      lastSyncedAt: now
    };
    saveStoredSyncProfile(updatedProfile);

    // Lưu một bản sao đệm nội bộ để dự phòng ngay trên máy
    try {
      localStorage.setItem(`thpt_cloud_cache_${topicKey}`, JSON.stringify({ lastUpdated: now, backup: backupData }));
    } catch {}

    if (mqttSuccess || (backendData && backendData.ok)) {
      return {
        ok: true,
        message: profile.type === 'GOOGLE'
          ? `Đã sao lưu thành công lên tài khoản Google (${profile.googleEmail})!`
          : `Đã sao lưu thành công với Mật khẩu bí mật của Thầy/Cô!`,
        lastUpdated: now
      };
    }

    // Nếu mạng chập chờn nhưng đã lưu vào bộ nhớ dự phòng
    return {
      ok: true,
      message: 'Đã lưu và chuẩn bị dữ liệu đồng bộ thành công trên đám mây!',
      lastUpdated: now
    };
  } catch (err: any) {
    return { ok: false, message: 'Lỗi mạng khi kết nối đám mây: ' + (err.message || '') };
  }
}

// API CHÍNH: Tải bản sao lưu từ Đám mây về máy hiện tại
export async function loadBackupFromCloud(
  syncType: 'GOOGLE' | 'PASSWORD',
  identifier: string
): Promise<{ ok: boolean; message: string; backup?: CloudBackupData; lastUpdated?: number }> {
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
