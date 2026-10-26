import React, { useState, useEffect } from 'react';
import {
  OwnerSecurityState,
  OWNER_GITHUB_EMAIL,
  OWNER_GITHUB_ACCOUNT,
  MAX_FREE_SESSIONS,
  authenticateOwnerEmail,
  logoutOwnerEmail,
  activateWithLicenseCode,
  requestActivationCodeToOwnerEmail,
  generateActivationCodeForDevice,
  getMasterOwnerActivationCode,
  syncSecurityTelemetryToServerAndCloud,
  fetchRegistryFromMqttCloud,
  saveOwnerSecurityState
} from '../services/ownerSecurity';

interface Props {
  isOpen: boolean;
  isForcedLock: boolean;
  securityState: OwnerSecurityState;
  onUpdateSecurityState: (next: OwnerSecurityState) => void;
  onClose: () => void;
}

export const OwnerSecurityModal: React.FC<Props> = ({
  isOpen,
  isForcedLock,
  securityState,
  onUpdateSecurityState,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'ACTIVATE' | 'OWNER_LOGIN' | 'REGISTRY'>('ACTIVATE');
  const [activationInput, setActivationInput] = useState('');
  const [ownerEmailInput, setOwnerEmailInput] = useState(
    securityState.isOwnerLoggedIn ? securityState.loggedInEmail : ''
  );
  const [requesterNote, setRequesterNote] = useState('');
  const [customDeviceIdForKey, setCustomDeviceIdForKey] = useState(securityState.deviceId);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [syncingRegistry, setSyncingRegistry] = useState(false);
  const [lastMailtoUrl, setLastMailtoUrl] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen || isForcedLock) {
      setStatusMsg(null);
      setCustomDeviceIdForKey(securityState.deviceId);
      if (securityState.isOwnerLoggedIn) {
        setOwnerEmailInput(securityState.loggedInEmail || OWNER_GITHUB_EMAIL);
      }
      handleRefreshRegistrySilent();
    }
  }, [isOpen, isForcedLock]);

  const handleRefreshRegistrySilent = async () => {
    setSyncingRegistry(true);
    try {
      const synced = await syncSecurityTelemetryToServerAndCloud(securityState);
      const mqttData = await fetchRegistryFromMqttCloud();
      if (mqttData) {
        const merged: OwnerSecurityState = {
          ...synced,
          knownMachines: {
            ...(mqttData.knownMachines || {}),
            ...synced.knownMachines
          },
          knownWebSites: {
            ...(mqttData.knownWebSites || {}),
            ...synced.knownWebSites
          },
          activationRequests: Array.isArray(mqttData.activationRequests)
            ? [
                ...synced.activationRequests,
                ...mqttData.activationRequests.filter(
                  r => !synced.activationRequests.some(ex => ex.requestId === r.requestId)
                )
              ].slice(0, 40)
            : synced.activationRequests
        };
        saveOwnerSecurityState(merged);
        onUpdateSecurityState(merged);
      } else {
        onUpdateSecurityState(synced);
      }
    } catch {}
    setSyncingRegistry(false);
  };

  if (!isOpen && !isForcedLock) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedText(label);
      setTimeout(() => setCopiedText(null), 2500);
    }).catch(() => {});
  };

  const handleActivateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationInput.trim()) {
      setStatusMsg({ type: 'error', text: 'Vui lòng nhập Mã Kích Hoạt được gửi về email đăng ký GitHub!' });
      return;
    }
    const res = activateWithLicenseCode(activationInput);
    onUpdateSecurityState(res.state);
    setStatusMsg({
      type: res.ok ? 'success' : 'error',
      text: res.message
    });
    if (res.ok) {
      setActivationInput('');
    }
  };

  const handleSendEmailRequest = async () => {
    setSendingEmail(true);
    setStatusMsg({
      type: 'info',
      text: `Đang tạo Mã Kích Hoạt cho ID Máy [${securityState.deviceId}] và gửi về mail GitHub (${OWNER_GITHUB_EMAIL})...`
    });
    const res = await requestActivationCodeToOwnerEmail(requesterNote);
    setSendingEmail(false);
    setLastMailtoUrl(res.mailtoUrl);
    const refreshed = await syncSecurityTelemetryToServerAndCloud();
    onUpdateSecurityState(refreshed);
    setStatusMsg({
      type: 'success',
      text: res.message
    });
  };

  const handleOwnerLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerEmailInput.trim()) {
      setStatusMsg({ type: 'error', text: 'Vui lòng nhập địa chỉ email chính chủ!' });
      return;
    }
    const res = authenticateOwnerEmail(ownerEmailInput);
    onUpdateSecurityState(res.state);
    setStatusMsg({
      type: res.ok ? 'success' : 'error',
      text: res.message
    });
  };

  const handleOwnerLogout = () => {
    const next = logoutOwnerEmail();
    onUpdateSecurityState(next);
    setOwnerEmailInput('');
    setStatusMsg({
      type: 'info',
      text: 'Đã đăng xuất chế độ Chủ sở hữu trên thiết bị này.'
    });
  };

  const formatTime = (ts?: number) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const machinesList = Object.values(securityState.knownMachines || {}).sort(
    (a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0)
  );
  const websitesList = Object.values(securityState.knownWebSites || {}).sort(
    (a, b) => (b.lastVisitedAt || 0) - (a.lastVisitedAt || 0)
  );

  const remainingSessions = Math.max(0, MAX_FREE_SESSIONS - securityState.sessionsUsed);
  const isUnlimited = securityState.isOwnerLoggedIn || securityState.isActivated;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border-2 border-amber-500/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isForcedLock
              ? 'bg-gradient-to-r from-rose-950 via-red-900 to-slate-900 border-rose-500/50'
              : 'bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 border-amber-500/40'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner border ${
                isForcedLock
                  ? 'bg-rose-600/30 border-rose-400 text-rose-200'
                  : 'bg-amber-500/20 border-amber-400/60 text-amber-300'
              }`}
            >
              {isForcedLock ? '🔒' : securityState.isOwnerLoggedIn ? '👑' : '🛡️'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-wide">
                  {isForcedLock
                    ? 'TẠM NGƯNG HOẠT ĐỘNG — YÊU CẦU XÁC THỰC BẢN QUYỀN CHỦ SỞ HỮU'
                    : 'TRUNG TÂM BẢO MẬT CHỦ SỞ HỮU & QUẢN LÝ THIẾT BỊ'}
                </h2>
                {securityState.isOwnerLoggedIn ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/25 text-amber-300 border border-amber-400/50 font-black">
                    👑 CHỦ SỞ HỮU CHÍNH CHỦ (MIỄN KÍCH HOẠT)
                  </span>
                ) : securityState.isActivated ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 font-black">
                    ✅ ĐÃ KÍCH HOẠT VĨNH VIỄN
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/25 text-rose-200 border border-rose-400/50 font-black">
                    ⏳ DÙNG THỬ: {Math.min(securityState.sessionsUsed, MAX_FREE_SESSIONS)}/{MAX_FREE_SESSIONS} PHIÊN
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Chủ sở hữu GitHub: <b className="text-amber-300">{OWNER_GITHUB_EMAIL}</b> ({OWNER_GITHUB_ACCOUNT}) • ID Máy:{' '}
                <code className="text-sky-300 font-bold">{securityState.deviceId}</code> • ID Trang mạng:{' '}
                <code className="text-emerald-300 font-bold">{securityState.currentSiteId}</code>
              </p>
            </div>
          </div>

          {!isForcedLock && (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-lg transition-colors border border-slate-700 cursor-pointer"
              title="Đóng"
            >
              ✕
            </button>
          )}
        </div>

        {/* Cảnh báo khi vượt quá 10 phiên */}
        {isForcedLock && (
          <div className="px-6 py-3 bg-rose-950/90 border-b border-rose-500/40 text-rose-100 text-xs sm:text-sm flex items-center justify-between gap-3 flex-wrap">
            <div>
              ⚠️ <b>Thiết bị [{securityState.deviceId}] đã sử dụng hết {MAX_FREE_SESSIONS}/{MAX_FREE_SESSIONS} phiên miễn phí</b> trên trang mạng{' '}
              <b>[{securityState.currentSiteId}]</b>. Hệ thống tạm ngưng cho đến khi nhập <b>Mã Kích Hoạt</b> (gửi về mail đăng ký GitHub{' '}
              <b className="text-amber-300">{OWNER_GITHUB_EMAIL}</b>) hoặc <b>Đăng nhập bằng Mail Chính Chủ</b>!
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/80 p-1.5 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('ACTIVATE');
              setStatusMsg(null);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'ACTIVATE'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-600/30 border border-amber-400/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>🔑</span>
            <span>Mã Kích Hoạt (Mail GitHub)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('OWNER_LOGIN');
              setStatusMsg(null);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'OWNER_LOGIN'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>👑</span>
            <span>Đăng Nhập Mail Chính Chủ</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('REGISTRY');
              setStatusMsg(null);
              handleRefreshRegistrySilent();
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'REGISTRY'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30 border border-emerald-400/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>🖥️</span>
            <span>ID Máy Đã Chạy ({machinesList.length}) &amp; ID Trang Mạng ({websitesList.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-200 text-sm sleek-scrollbar flex-1">
          {statusMsg && (
            <div
              className={`p-3.5 rounded-2xl border text-sm font-semibold flex items-start gap-3 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200'
                  : statusMsg.type === 'error'
                  ? 'bg-rose-950/70 border-rose-500/60 text-rose-200'
                  : 'bg-blue-950/70 border-blue-500/60 text-blue-200'
              }`}
            >
              <span className="text-lg">
                {statusMsg.type === 'success' ? '✅' : statusMsg.type === 'error' ? '⚠️' : 'ℹ️'}
              </span>
              <div className="flex-1 leading-relaxed">{statusMsg.text}</div>
            </div>
          )}

          {/* Thông tin Định danh Máy hiện tại & Trang mạng hiện tại */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>🖥️ ID Máy Đang Chạy</span>
                <button
                  type="button"
                  onClick={() => handleCopy(securityState.deviceId, 'DEV_ID')}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold cursor-pointer"
                >
                  {copiedText === 'DEV_ID' ? 'Đã chép' : 'Sao chép'}
                </button>
              </div>
              <div className="text-base font-black text-sky-400 font-mono mt-1">{securityState.deviceId}</div>
              <div className="text-[11px] text-slate-400 mt-1 truncate" title={securityState.hardwareSummary}>
                {securityState.hardwareSummary}
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>🌐 ID Trang Mạng Hiện Tại</span>
                <button
                  type="button"
                  onClick={() => handleCopy(`${securityState.currentSiteId} (${securityState.currentOrigin})`, 'SITE_ID')}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold cursor-pointer"
                >
                  {copiedText === 'SITE_ID' ? 'Đã chép' : 'Sao chép'}
                </button>
              </div>
              <div className="text-base font-black text-emerald-400 font-mono mt-1">{securityState.currentSiteId}</div>
              <div className="text-[11px] text-slate-400 mt-1 truncate" title={securityState.currentOrigin}>
                {securityState.currentOrigin}
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                📊 Trạng Thái Phiên Sử Dụng
              </div>
              {isUnlimited ? (
                <>
                  <div className="text-base font-black text-amber-300 mt-1">
                    {securityState.isOwnerLoggedIn ? 'Vĩnh Viễn (Chủ Sở Hữu)' : 'Vĩnh Viễn (Đã Kích Hoạt)'}
                  </div>
                  <div className="text-[11px] text-emerald-400 mt-1 font-semibold">
                    Đã chạy {securityState.sessionsUsed} phiên • Không giới hạn
                  </div>
                </>
              ) : (
                <>
                  <div className="text-base font-black text-rose-400 mt-1">
                    Đã dùng {securityState.sessionsUsed} / {MAX_FREE_SESSIONS} phiên
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full transition-all ${
                        remainingSessions <= 2 ? 'bg-rose-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, (securityState.sessionsUsed / MAX_FREE_SESSIONS) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {remainingSessions > 0
                      ? `Còn ${remainingSessions} phiên trước khi tạm ngưng`
                      : 'Đã hết 10 phiên miễn phí — Đang tạm ngưng'}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* TAB 1: NHẬP MÃ KÍCH HOẠT & GỬI YÊU CẦU VỀ MAIL GITHUB */}
          {activeTab === 'ACTIVATE' && (
            <div className="space-y-4">
              <div className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-base font-black text-amber-300 flex items-center gap-2">
                      <span>📩</span>
                      <span>Bước 1: Gửi Mã Kích Hoạt Về Mail Đăng Ký GitHub Của Chủ Sở Hữu</span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Khi bấm nút bên dưới, hệ thống sẽ tự động đóng gói <b>ID Máy ({securityState.deviceId})</b>,{' '}
                      <b>ID Trang mạng ({securityState.currentSiteId})</b> kèm <b>Mã Kích Hoạt</b> tương ứng và gửi thẳng về địa chỉ email đăng ký GitHub của Chủ sở hữu:{' '}
                      <b className="text-amber-300">{OWNER_GITHUB_EMAIL}</b>.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={requesterNote}
                    onChange={e => setRequesterNote(e.target.value)}
                    placeholder="Ghi chú tên Giáo viên / Trường học (ví dụ: Thầy Khải - THPT Mang Thít)..."
                    className="flex-1 bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-2.5 text-white text-xs sm:text-sm focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSendEmailRequest}
                    disabled={sendingEmail}
                    className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {sendingEmail ? '⏳ Đang gửi về Mail GitHub...' : `📨 Gửi Mã Kích Hoạt Về ${OWNER_GITHUB_EMAIL}`}
                  </button>
                </div>

                {lastMailtoUrl && (
                  <div className="pt-1 flex items-center justify-between gap-2 flex-wrap text-xs text-amber-200/90">
                    <span>💡 Nếu mạng trường học chặn cổng SMTP tự động, Thầy/Cô có thể bấm gửi trực tiếp qua ứng dụng Mail:</span>
                    <a
                      href={lastMailtoUrl}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 hover:bg-amber-500/30 font-bold"
                    >
                      ✉️ Mở Ứng Dụng Email Gửi Ngay
                    </a>
                  </div>
                )}
              </div>

              <form onSubmit={handleActivateSubmit} className="bg-slate-950/90 border border-emerald-500/30 rounded-2xl p-5 space-y-4">
                <div>
                  <h3 className="text-base font-black text-emerald-300 flex items-center gap-2">
                    <span>🔑</span>
                    <span>Bước 2: Nhập Mã Kích Hoạt Để Mở Khóa Vĩnh Viễn Thiết Bị Này</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Nhập mã kích hoạt định dạng <code className="text-emerald-300 font-bold">KHAI-XXXX-XXXX</code> nhận được trong email{' '}
                    <b>{OWNER_GITHUB_EMAIL}</b> để gỡ bỏ giới hạn 10 phiên trên máy <b>{securityState.deviceId}</b>.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={activationInput}
                    onChange={e => setActivationInput(e.target.value.toUpperCase())}
                    placeholder="Nhập mã kích hoạt (VD: KHAI-XXXX-XXXX)..."
                    className="flex-1 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-3 text-white font-mono font-black tracking-widest text-sm uppercase focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-600/30 cursor-pointer whitespace-nowrap"
                  >
                    ✅ Xác Nhận Mã Kích Hoạt
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: ĐĂNG NHẬP MAIL CHÍNH CHỦ (MIỄN KÍCH HOẠT) */}
          {activeTab === 'OWNER_LOGIN' && (
            <div className="space-y-4">
              <div className="bg-slate-950/90 border border-indigo-500/40 rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-base font-black text-indigo-300 flex items-center gap-2">
                      <span>👑</span>
                      <span>Đặc Quyền Chủ Sở Hữu Trang Web (Đăng Nhập Bằng Mail Chính Chủ GitHub)</span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Nếu Chủ nhân trang web đăng nhập bằng đúng email chính chủ đã đăng ký GitHub (
                      <b className="text-amber-300">{OWNER_GITHUB_EMAIL}</b>), hệ thống sẽ{' '}
                      <b className="text-emerald-300">TỰ ĐỘNG MỞ KHÓA VĨNH VIỄN MÀ KHÔNG CẦN NHẬP MÃ KÍCH HOẠT</b>, đồng thời mở khóa bảng cấp mã kích hoạt cho các máy khác.
                    </p>
                  </div>
                </div>

                {securityState.isOwnerLoggedIn ? (
                  <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/50 flex items-center justify-between flex-wrap gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-black text-emerald-300 flex items-center gap-2">
                        <span>👑 Đã đăng nhập tài khoản Chủ sở hữu Chính chủ:</span>
                        <span className="font-mono text-amber-300">{securityState.loggedInEmail}</span>
                      </div>
                      <div className="text-xs text-slate-300">
                        Trạng thái: <b>Miễn kích hoạt 100%</b> • Không giới hạn số phiên sử dụng • Toàn quyền quản trị ID Máy &amp; ID Trang mạng.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleOwnerLogout}
                      className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-200 border border-rose-500/40 font-bold text-xs cursor-pointer"
                    >
                      Đăng xuất Chủ sở hữu
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleOwnerLoginSubmit} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      value={ownerEmailInput}
                      onChange={e => setOwnerEmailInput(e.target.value)}
                      placeholder="Nhập email chính chủ GitHub (khaibcmt@gmail.com)..."
                      className="flex-1 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-white font-medium text-sm focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="py-3 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black text-sm shadow-lg shadow-indigo-600/30 cursor-pointer whitespace-nowrap"
                    >
                      👑 Đăng Nhập Chủ Sở Hữu (Miễn Kích Hoạt)
                    </button>
                  </form>
                )}
              </div>

              {/* Bảng công cụ cấp mã kích hoạt dành riêng khi Chủ sở hữu đã đăng nhập */}
              {securityState.isOwnerLoggedIn && (
                <div className="bg-slate-950/90 border border-amber-500/40 rounded-2xl p-5 space-y-4">
                  <h4 className="text-sm font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                    <span>🔐</span>
                    <span>Trình Quản Lý &amp; Cấp Mã Kích Hoạt Dành Riêng Cho Chủ Sở Hữu ({OWNER_GITHUB_EMAIL})</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="text-xs text-slate-400 font-bold">
                        1. Tra cứu / Tạo Mã Kích Hoạt theo ID Máy bất kỳ:
                      </div>
                      <input
                        type="text"
                        value={customDeviceIdForKey}
                        onChange={e => setCustomDeviceIdForKey(e.target.value.toUpperCase())}
                        placeholder="Nhập ID Máy (VD: DEV-XXXX-XXXX-XXXX)"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-sky-300"
                      />
                      <div className="flex items-center justify-between bg-slate-950 px-3 py-2 rounded-lg border border-emerald-500/30">
                        <div>
                          <span className="text-[11px] text-slate-400 mr-2">Mã Kích Hoạt:</span>
                          <code className="text-sm font-black text-emerald-400 font-mono">
                            {generateActivationCodeForDevice(customDeviceIdForKey || securityState.deviceId)}
                          </code>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              generateActivationCodeForDevice(customDeviceIdForKey || securityState.deviceId),
                              'GEN_KEY'
                            )
                          }
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                        >
                          {copiedText === 'GEN_KEY' ? '✅ Đã chép' : '📋 Copy Mã'}
                        </button>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="text-xs text-slate-400 font-bold">
                          2. Mã Kích Hoạt Master Toàn Cầu (Mở khóa mọi thiết bị):
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Dùng trong trường hợp Chủ sở hữu muốn kích hoạt nhanh bất kỳ máy chiếu nào tại trường.
                        </p>
                      </div>
                      <div className="flex items-center justify-between bg-slate-950 px-3 py-2.5 rounded-lg border border-amber-500/30">
                        <code className="text-sm font-black text-amber-300 font-mono">
                          {getMasterOwnerActivationCode()}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopy(getMasterOwnerActivationCode(), 'MASTER_KEY')}
                          className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs cursor-pointer"
                        >
                          {copiedText === 'MASTER_KEY' ? '✅ Đã chép' : '📋 Copy Master'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: NHẬT KÝ ID MÁY ĐÃ CHẠY & ID CÁC TRANG MẠNG */}
          {activeTab === 'REGISTRY' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs text-slate-300">
                  Hệ thống tự động ghi nhớ <b>ID mọi máy tính/thiết bị đã chạy</b> và <b>ID các trang mạng/tên miền</b> đã khởi chạy ứng dụng.
                </div>
                <button
                  type="button"
                  onClick={handleRefreshRegistrySilent}
                  disabled={syncingRegistry}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-bold text-xs cursor-pointer"
                >
                  {syncingRegistry ? '🔄 Đang đồng bộ đám mây...' : '🔄 Làm mới danh sách ID'}
                </button>
              </div>

              {/* BẢNG 1: GHI NHỚ ID MÁY ĐÃ CHẠY */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                  <span className="font-black text-xs sm:text-sm text-sky-300 flex items-center gap-2">
                    <span>🖥️</span>
                    <span>DANH SÁCH GHI NHỚ ID MÁY ĐÃ CHẠY ({machinesList.length} thiết bị)</span>
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900/60 text-slate-400 border-b border-slate-800">
                        <th className="py-2.5 px-3 font-bold">ID Máy (Device ID)</th>
                        <th className="py-2.5 px-3 font-bold">Cấu Hình &amp; Hệ Điều Hành</th>
                        <th className="py-2.5 px-3 font-bold">ID Trang Mạng Đã Chạy</th>
                        <th className="py-2.5 px-3 font-bold">Số Phiên</th>
                        <th className="py-2.5 px-3 font-bold">Trạng Thái</th>
                        <th className="py-2.5 px-3 font-bold">Hoạt Động Cuối</th>
                        {securityState.isOwnerLoggedIn && (
                          <th className="py-2.5 px-3 font-bold text-right">Mã Kích Hoạt Máy</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {machinesList.map(m => {
                        const isThisDevice = m.deviceId === securityState.deviceId;
                        const devCode = generateActivationCodeForDevice(m.deviceId);
                        return (
                          <tr key={m.deviceId} className={isThisDevice ? 'bg-sky-950/25' : 'hover:bg-slate-900/40'}>
                            <td className="py-2.5 px-3 font-mono font-black text-sky-300 whitespace-nowrap">
                              {m.deviceId}
                              {isThisDevice && (
                                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-200 border border-sky-400/30">
                                  Máy này
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">
                              <div>{m.hardwareSummary}</div>
                              {m.clientIp && <div className="text-[10px] text-slate-500">IP/Net: {m.clientIp}</div>}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-emerald-300">
                              {(m.siteIds || []).join(', ') || securityState.currentSiteId}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-amber-300 whitespace-nowrap">
                              {m.sessionsUsed} phiên
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {m.isOwnerDevice ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 font-bold text-[11px]">
                                  👑 Máy Chủ Sở Hữu
                                </span>
                              ) : m.isActivated ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-bold text-[11px]">
                                  ✅ Đã kích hoạt
                                </span>
                              ) : m.sessionsUsed > MAX_FREE_SESSIONS ? (
                                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/40 font-bold text-[11px]">
                                  🔒 Đã tạm ngưng
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-bold text-[11px]">
                                  ⏳ Dùng thử ({m.sessionsUsed}/{MAX_FREE_SESSIONS})
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{formatTime(m.lastSeenAt)}</td>
                            {securityState.isOwnerLoggedIn && (
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleCopy(devCode, m.deviceId)}
                                  className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 font-mono font-bold text-[11px] cursor-pointer"
                                >
                                  {copiedText === m.deviceId ? '✅ Đã chép' : `📋 ${devCode}`}
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* BẢNG 2: GHI NHỚ ID CÁC TRANG MẠNG */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                  <span className="font-black text-xs sm:text-sm text-emerald-300 flex items-center gap-2">
                    <span>🌐</span>
                    <span>DANH SÁCH GHI NHỚ ID CÁC TRANG MẠNG ({websitesList.length} trang mạng)</span>
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900/60 text-slate-400 border-b border-slate-800">
                        <th className="py-2.5 px-3 font-bold">ID Trang Mạng (Site ID)</th>
                        <th className="py-2.5 px-3 font-bold">Địa Chỉ Mạng / Tên Miền (Origin)</th>
                        <th className="py-2.5 px-3 font-bold">Giao Thức &amp; Hạ Tầng</th>
                        <th className="py-2.5 px-3 font-bold">Số Máy Kết Nối</th>
                        <th className="py-2.5 px-3 font-bold">Lượt Phiên</th>
                        <th className="py-2.5 px-3 font-bold">Truy Cập Cuối</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {websitesList.map(w => {
                        const isCurrentSite = w.siteId === securityState.currentSiteId;
                        return (
                          <tr key={w.siteId} className={isCurrentSite ? 'bg-emerald-950/25' : 'hover:bg-slate-900/40'}>
                            <td className="py-2.5 px-3 font-mono font-black text-emerald-300 whitespace-nowrap">
                              {w.siteId}
                              {isCurrentSite && (
                                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                                  Đang mở
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-200">{w.origin}</td>
                            <td className="py-2.5 px-3 text-slate-400">{w.networkSignature}</td>
                            <td className="py-2.5 px-3 text-sky-300 font-mono">
                              {(w.deviceIds || []).length} máy ({(w.deviceIds || []).join(', ')})
                            </td>
                            <td className="py-2.5 px-3 font-bold text-amber-300">{w.visitCount || 1}</td>
                            <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                              {formatTime(w.lastVisitedAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-slate-400">
            🔒 Bảo mật Bản quyền Chủ sở hữu: <b className="text-amber-300">Hồ Tấn Khải</b> ({OWNER_GITHUB_EMAIL}) • Trường THPT Mang Thít
          </div>
          {!isForcedLock && (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer"
            >
              Đóng Cửa Sổ
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
