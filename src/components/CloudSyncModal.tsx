import React, { useState, useEffect } from 'react';
import { CloudSyncProfile, CloudBackupData, SubjectData, MatchSettings, QuizItem } from '../types';
import {
  getStoredSyncProfile,
  saveStoredSyncProfile,
  prepareBackupPayload,
  saveBackupToCloud,
  loadBackupFromCloud,
  checkBackupStatus,
  calculateBackupStats
} from '../services/cloudSync';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  subjectsDB: Record<string, SubjectData>;
  currentSubjectKey: string;
  matchSettings: MatchSettings;
  activeQuizList?: QuizItem[];
  onApplyBackup: (backup: CloudBackupData) => void;
  initialTab?: 'GOOGLE' | 'PASSWORD';
}

export const CloudSyncModal: React.FC<Props> = ({
  isOpen,
  onClose,
  subjectsDB,
  currentSubjectKey,
  matchSettings,
  activeQuizList,
  onApplyBackup,
  initialTab = 'GOOGLE'
}) => {
  const [activeTab, setActiveTab] = useState<'GOOGLE' | 'PASSWORD'>(initialTab);
  const [profile, setProfile] = useState<CloudSyncProfile>(() => getStoredSyncProfile());

  // Input fields
  const [googleEmailInput, setGoogleEmailInput] = useState(() => profile.googleEmail || 'khaibcmt@gmail.com');
  const [passwordInput, setPasswordInput] = useState(() => profile.passwordKey || '');
  const [showPassword, setShowPassword] = useState(false);
  const [autoSync, setAutoSync] = useState(() => profile.autoSyncEnabled ?? true);

  // Status & loading
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [cloudStatus, setCloudStatus] = useState<{ exists: boolean; lastUpdated?: number; stats?: any } | null>(null);

  // Local stats
  const localStats = calculateBackupStats(subjectsDB);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      const curProfile = getStoredSyncProfile();
      setProfile(curProfile);
      if (curProfile.googleEmail) setGoogleEmailInput(curProfile.googleEmail);
      if (curProfile.passwordKey) setPasswordInput(curProfile.passwordKey);
      setStatusMessage(null);
      checkCurrentStatus(curProfile, initialTab);
    }
  }, [isOpen, initialTab]);

  const checkCurrentStatus = async (curProfile: CloudSyncProfile, tab: 'GOOGLE' | 'PASSWORD') => {
    const ident = tab === 'GOOGLE' ? (curProfile.googleEmail || googleEmailInput) : (curProfile.passwordKey || passwordInput);
    if (!ident) {
      setCloudStatus(null);
      return;
    }
    const res = await checkBackupStatus(tab, ident);
    setCloudStatus(res);
  };

  if (!isOpen) return null;

  // 1. Sao lưu lên Đám mây theo tài khoản Google
  const handleSaveGoogle = async () => {
    if (!googleEmailInput.trim() || !googleEmailInput.includes('@')) {
      setStatusMessage({ type: 'error', text: 'Vui lòng nhập địa chỉ email Google hợp lệ (ví dụ: khaibcmt@gmail.com)!' });
      return;
    }
    setLoading(true);
    setStatusMessage({ type: 'info', text: 'Đang tải toàn bộ dữ liệu lên máy chủ đám mây...' });

    const newProfile: CloudSyncProfile = {
      ...profile,
      type: 'GOOGLE',
      googleEmail: googleEmailInput.trim().toLowerCase(),
      autoSyncEnabled: autoSync
    };
    setProfile(newProfile);
    saveStoredSyncProfile(newProfile);

    const payload = prepareBackupPayload(subjectsDB, currentSubjectKey, matchSettings, activeQuizList);
    const result = await saveBackupToCloud(newProfile, payload);

    setLoading(false);
    if (result.ok) {
      setStatusMessage({
        type: 'success',
        text: `✅ ${result.message} (${payload.stats?.totalSubjects} môn học, ${payload.stats?.totalQuestions} câu hỏi đã được bảo vệ).`
      });
      checkCurrentStatus(newProfile, 'GOOGLE');
    } else {
      setStatusMessage({ type: 'error', text: `❌ ${result.message}` });
    }
  };

  // 2. Tải & Đồng bộ từ Google về máy hiện tại
  const handleLoadGoogle = async () => {
    if (!googleEmailInput.trim() || !googleEmailInput.includes('@')) {
      setStatusMessage({ type: 'error', text: 'Vui lòng nhập địa chỉ email Google để tải dữ liệu!' });
      return;
    }
    setLoading(true);
    setStatusMessage({ type: 'info', text: 'Đang kết nối đám mây để tải dữ liệu của tài khoản Google...' });

    const result = await loadBackupFromCloud('GOOGLE', googleEmailInput.trim().toLowerCase());
    setLoading(false);

    if (result.ok && result.backup) {
      const newProfile: CloudSyncProfile = {
        ...profile,
        type: 'GOOGLE',
        googleEmail: googleEmailInput.trim().toLowerCase(),
        lastSyncedAt: result.lastUpdated || Date.now()
      };
      setProfile(newProfile);
      saveStoredSyncProfile(newProfile);

      onApplyBackup(result.backup);
      setStatusMessage({
        type: 'success',
        text: `🎉 Đồng bộ thành công! Đã khôi phục ${result.backup.stats?.totalSubjects || 0} môn học và ${result.backup.stats?.totalQuestions || 0} câu hỏi từ tài khoản Google.`
      });
      checkCurrentStatus(newProfile, 'GOOGLE');
    } else {
      setStatusMessage({ type: 'error', text: `❌ ${result.message}` });
    }
  };

  // 3. Sao lưu bằng Mật khẩu (Dành cho máy ở nhà)
  const handleSavePassword = async () => {
    if (!passwordInput.trim() || passwordInput.trim().length < 3) {
      setStatusMessage({ type: 'error', text: 'Vui lòng đặt mật khẩu đồng bộ có ít nhất 3 ký tự!' });
      return;
    }
    setLoading(true);
    setStatusMessage({ type: 'info', text: 'Đang mã hóa và sao lưu dữ liệu với mật khẩu của bạn...' });

    const newProfile: CloudSyncProfile = {
      ...profile,
      type: 'PASSWORD',
      passwordKey: passwordInput.trim(),
      autoSyncEnabled: autoSync
    };
    setProfile(newProfile);
    saveStoredSyncProfile(newProfile);

    const payload = prepareBackupPayload(subjectsDB, currentSubjectKey, matchSettings, activeQuizList);
    const result = await saveBackupToCloud(newProfile, payload);

    setLoading(false);
    if (result.ok) {
      setStatusMessage({
        type: 'success',
        text: `✅ ${result.message} Khi đến trường, Thầy/Cô chỉ cần nhập đúng mật khẩu này để tự động đồng bộ toàn bộ đề thi.`
      });
      checkCurrentStatus(newProfile, 'PASSWORD');
    } else {
      setStatusMessage({ type: 'error', text: `❌ ${result.message}` });
    }
  };

  // 4. Nhập Mật khẩu & Tải Đồng Bộ Về Máy Này (Dành cho máy ở trường / tab ẩn danh)
  const handleLoadPassword = async () => {
    if (!passwordInput.trim()) {
      setStatusMessage({ type: 'error', text: 'Vui lòng nhập mật khẩu đồng bộ đã tạo ở máy trước!' });
      return;
    }
    setLoading(true);
    setStatusMessage({ type: 'info', text: 'Đang kiểm tra mật khẩu và kéo dữ liệu về...' });

    const result = await loadBackupFromCloud('PASSWORD', passwordInput.trim());
    setLoading(false);

    if (result.ok && result.backup) {
      const newProfile: CloudSyncProfile = {
        ...profile,
        type: 'PASSWORD',
        passwordKey: passwordInput.trim(),
        lastSyncedAt: result.lastUpdated || Date.now()
      };
      setProfile(newProfile);
      saveStoredSyncProfile(newProfile);

      onApplyBackup(result.backup);
      setStatusMessage({
        type: 'success',
        text: `🎉 Đồng bộ thành công rực rỡ! Đã tải về ${result.backup.stats?.totalSubjects || 0} môn học và ${result.backup.stats?.totalQuestions || 0} câu hỏi.`
      });
      checkCurrentStatus(newProfile, 'PASSWORD');
    } else {
      setStatusMessage({ type: 'error', text: `❌ ${result.message}` });
    }
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return 'Chưa có bản lưu';
    return new Date(ts).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border-2 border-indigo-500/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-slate-900 to-sky-950 border-b border-indigo-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400/50 flex items-center justify-center text-2xl shadow-inner">
              ☁️
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-wide flex items-center gap-2">
                ĐỒNG BỘ & SAO LƯU ĐÁM MÂY
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  Đa Thiết Bị
                </span>
              </h2>
              <p className="text-xs text-indigo-200/80">
                Soạn đề ở nhà – Dạy trên máy chiếu trường học không lo mất dữ liệu
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-lg transition-colors border border-slate-700"
            title="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950/70 p-1.5 gap-2">
          <button
            onClick={() => {
              setActiveTab('GOOGLE');
              setStatusMessage(null);
              checkCurrentStatus(profile, 'GOOGLE');
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
              activeTab === 'GOOGLE'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-blue-400/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span className="text-base">🌐</span>
            <span>Tài Khoản Google</span>
            {profile.googleEmail && (
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('PASSWORD');
              setStatusMessage(null);
              checkCurrentStatus(profile, 'PASSWORD');
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
              activeTab === 'PASSWORD'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-600/30 border border-amber-400/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span className="text-base">🔑</span>
            <span>Mật Khẩu Đồng Bộ</span>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
              Ẩn Danh
            </span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-200 text-sm">
          {/* Status Alert Banner */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-2xl border text-sm font-medium flex items-start gap-3 animate-in fade-in ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                  : 'bg-blue-950/60 border-blue-500/50 text-blue-200'
              }`}
            >
              <span className="text-lg">
                {statusMessage.type === 'success' ? '🎉' : statusMessage.type === 'error' ? '⚠️' : 'ℹ️'}
              </span>
              <div className="flex-1 leading-relaxed">{statusMessage.text}</div>
            </div>
          )}

          {/* TAB 1: GOOGLE ACCOUNT SYNC */}
          {activeTab === 'GOOGLE' && (
            <div className="space-y-4">
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-indigo-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-xs uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    Địa chỉ Email Google của Giáo viên
                  </label>
                  <span className="text-xs text-slate-400 font-mono">Đồng bộ tự động qua đám mây</span>
                </div>

                <div className="relative">
                  <input
                    type="email"
                    value={googleEmailInput}
                    onChange={(e) => setGoogleEmailInput(e.target.value)}
                    placeholder="ví dụ: khaibcmt@gmail.com"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white font-medium placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-sm"
                  />
                  <div className="absolute right-3 top-2.5 text-slate-500 text-sm pointer-events-none">
                    ✉️
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-normal">
                  Chỉ cần nhập email Google này trên bất kỳ máy tính nào (ở nhà hoặc trường học), mọi ngân hàng đề thi 12 môn và câu hỏi tùy chỉnh sẽ được khôi phục nguyên vẹn.
                </p>
              </div>

              {/* Cloud Status Card */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  <div className="text-slate-400">Hiện tại trên máy này:</div>
                  <div className="text-sm font-bold text-indigo-300 mt-1">
                    {localStats.totalSubjects} môn học • {localStats.totalQuestions} câu hỏi
                  </div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  <div className="text-slate-400">Bản sao lưu trên Google:</div>
                  <div className="text-sm font-bold text-emerald-400 mt-1">
                    {cloudStatus?.exists
                      ? `${cloudStatus.stats?.totalSubjects || 0} môn • ${cloudStatus.stats?.totalQuestions || 0} câu`
                      : 'Chưa có bản lưu'}
                  </div>
                  {cloudStatus?.lastUpdated && (
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {formatTimestamp(cloudStatus.lastUpdated)}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={handleSaveGoogle}
                  disabled={loading}
                  className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white font-black text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <span className="text-lg">☁️</span>
                  <span>Sao Lưu Lên Google</span>
                </button>

                <button
                  onClick={handleLoadGoogle}
                  disabled={loading}
                  className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-black text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <span className="text-lg">🔄</span>
                  <span>Tải & Đồng Bộ Về Máy Này</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: PASSWORD SYNC (INCOGNITO / SCHOOL LAB COMPUTERS) */}
          {activeTab === 'PASSWORD' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-950/40 border border-amber-500/30 rounded-2xl text-xs text-amber-200/90 leading-relaxed flex items-start gap-2.5">
                <span className="text-base">💡</span>
                <div>
                  <strong className="text-amber-300 font-bold">Dành cho Chế độ Ẩn Danh / Máy tính Trường Học:</strong> Thầy/Cô không cần đăng nhập Google trên máy tính lạ để tránh lộ tài khoản cá nhân. Chỉ cần đặt một mật khẩu riêng ở máy nhà, khi đến trường nhập đúng mật khẩu là toàn bộ dữ liệu tự động đồng bộ ngay!
                </div>
              </div>

              <div className="bg-slate-950/80 p-4 rounded-2xl border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-xs uppercase tracking-wider text-amber-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    Mật khẩu Đồng Bộ Cá Nhân
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">Bảo mật mã hóa SHA-256</span>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="ví dụ: thpt-mangthit-co-lien hoặc gv123456"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl pl-4 pr-11 py-2.5 text-white font-medium placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white text-sm"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>

                <p className="text-xs text-slate-400 leading-normal">
                  Gợi ý: Hãy đặt mật khẩu gắn với tên hoặc mã giáo viên dễ nhớ (ví dụ: <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">thpt-sinh12</code>).
                </p>
              </div>

              {/* Password Cloud Status */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  <div className="text-slate-400">Dữ liệu trên máy này:</div>
                  <div className="text-sm font-bold text-amber-300 mt-1">
                    {localStats.totalSubjects} môn học • {localStats.totalQuestions} câu hỏi
                  </div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  <div className="text-slate-400">Đám mây với mật khẩu này:</div>
                  <div className="text-sm font-bold text-emerald-400 mt-1">
                    {cloudStatus?.exists
                      ? `${cloudStatus.stats?.totalSubjects || 0} môn • ${cloudStatus.stats?.totalQuestions || 0} câu`
                      : 'Chưa có bản lưu'}
                  </div>
                  {cloudStatus?.lastUpdated && (
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {formatTimestamp(cloudStatus.lastUpdated)}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={handleSavePassword}
                  disabled={loading}
                  className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 active:scale-[0.98] text-white font-black text-sm shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <span className="text-lg">🔒</span>
                  <span>Sao Lưu Bằng Mật Khẩu</span>
                </button>

                <button
                  onClick={handleLoadPassword}
                  disabled={loading}
                  className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-black text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <span className="text-lg">⚡</span>
                  <span>Nhập Mật Khẩu & Đồng Bộ</span>
                </button>
              </div>
            </div>
          )}

          {/* Auto-sync Option */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300 hover:text-white select-none">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => {
                  setAutoSync(e.target.checked);
                  const newProfile = { ...profile, autoSyncEnabled: e.target.checked };
                  setProfile(newProfile);
                  saveStoredSyncProfile(newProfile);
                }}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-900"
              />
              <span>Tự động cập nhật bản sao lưu đám mây khi Thầy/Cô lưu hoặc thêm đề mới</span>
            </label>

            {profile.lastSyncedAt && (
              <span className="text-[11px] text-slate-500">
                Đồng bộ gần nhất: {new Date(profile.lastSyncedAt).toLocaleTimeString('vi-VN')}
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Hệ thống đám mây mã hóa an toàn • Đảm bảo đồng bộ 100% giữa các thiết bị
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
