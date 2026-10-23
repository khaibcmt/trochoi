import { CloudBackupData, CloudSyncProfile, SubjectData, MatchSettings, QuizItem } from '../types';
import { parseHTMLToQuiz } from '../data/defaultSubjects';

const SYNC_PROFILE_KEY = 'thpt_cloud_sync_profile_v1';

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

export async function saveBackupToCloud(
  profile: CloudSyncProfile,
  backupData: CloudBackupData
): Promise<{ ok: boolean; message: string; lastUpdated?: number }> {
  try {
    const identifier = profile.type === 'GOOGLE' ? profile.googleEmail : profile.passwordKey;
    if (!identifier) {
      return { ok: false, message: 'Chưa có thông tin tài khoản Google hoặc Mật khẩu đồng bộ.' };
    }

    const res = await fetch('/api/sync/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        syncType: profile.type,
        identifier: identifier.trim(),
        backup: backupData,
        hint: profile.type === 'PASSWORD' ? (profile.passwordKey && profile.passwordKey.length > 2 ? profile.passwordKey.slice(0, 2) + '***' : '***') : undefined
      })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, message: data.error || 'Lỗi lưu bản sao lưu lên đám mây.' };
    }

    const updatedProfile: CloudSyncProfile = {
      ...profile,
      lastSyncedAt: data.lastUpdated || Date.now()
    };
    saveStoredSyncProfile(updatedProfile);

    return {
      ok: true,
      message: profile.type === 'GOOGLE'
        ? `Đã sao lưu thành công lên tài khoản Google (${profile.googleEmail})!`
        : `Đã sao lưu thành công với mật khẩu bí mật!`,
      lastUpdated: data.lastUpdated
    };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Lỗi mạng khi kết nối tới máy chủ sao lưu.' };
  }
}

export async function loadBackupFromCloud(
  syncType: 'GOOGLE' | 'PASSWORD',
  identifier: string
): Promise<{ ok: boolean; message: string; backup?: CloudBackupData; lastUpdated?: number }> {
  try {
    if (!identifier || !identifier.trim()) {
      return { ok: false, message: 'Vui lòng nhập email Google hoặc mật khẩu đồng bộ.' };
    }

    const res = await fetch('/api/sync/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        syncType,
        identifier: identifier.trim()
      })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, message: data.error || 'Không tìm thấy bản sao lưu.' };
    }

    return {
      ok: true,
      message: 'Tải dữ liệu từ đám mây thành công!',
      backup: data.backup,
      lastUpdated: data.lastUpdated
    };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Lỗi mạng khi tải bản sao lưu.' };
  }
}

export async function checkBackupStatus(
  syncType: 'GOOGLE' | 'PASSWORD',
  identifier: string
): Promise<{ exists: boolean; lastUpdated?: number; stats?: { totalSubjects: number; totalQuestions: number } }> {
  try {
    if (!identifier || !identifier.trim()) {
      return { exists: false };
    }
    const res = await fetch('/api/sync/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        syncType,
        identifier: identifier.trim()
      })
    });
    const data = await res.json();
    return data;
  } catch {
    return { exists: false };
  }
}
