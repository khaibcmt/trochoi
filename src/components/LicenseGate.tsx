import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyValueStore,
  LicInfo,
  MachineRow,
  applyRemoteStatus,
  beginAdminSession,
  decidePw2Step,
  defaultFetch,
  endAdminSession,
  fbGet,
  fetchMachines,
  fetchRemotePwHash,
  gateAllows,
  getLocalPwHash,
  getMachineId,
  isAdminActive,
  readLocalActivation,
  saveRemotePwHash,
  setLocalPwHash,
  setMachineStatus,
  sha256Hex,
  shouldPromptEntryGate,
  submitRegistration,
  validateRegistration,
  verifyMasterCode,
  verifyPw2,
  writeLocalActivation,
  clearLocalActivation
} from '../utils/license';

/**
 * Cửa bản quyền Đấu Trường 3D — hook dùng trong TeacherSetupView:
 *  - Cổng điểm-vào (Chuyện 1): hook mount cùng TeacherSetupView = mỗi lần
 *    vào khu giáo viên; máy chưa kích hoạt + không phải Admin → tự hiện
 *    modal mời đăng ký sau khi đối chiếu xong trạng thái với Firebase.
 *    Đóng modal thì dùng tiếp đề có sẵn bình thường; lần vào sau mời lại.
 *  - guardAction(fn) (Chuyện 2): máy chưa kích hoạt (và không phải Admin)
 *    bấm 2 nút Thêm Đề Mới / Lưu Đề Này → mở modal đăng ký thay vì chạy fn;
 *    kích hoạt xong thì chạy fn đang chờ.
 *  - Cả 2 điểm trên dùng CHUNG một màn hình xác thực lớn "ĐẤU TRƯỜNG
 *    ONLINE PRO" (mẫu thầy chốt 17/11) — cùng component, cùng luồng gửi.
 *  - openAdmin(): đăng nhập Admin 2 khoá (mã chủ + mã cá nhân của thầy).
 *  - openMachines(): panel 🔐 Quản lý máy (chỉ Admin).
 *  - modals: JSX của cả 3 modal + toast — render một lần ở cuối màn hình.
 * Toàn bộ logic thuần nằm ở utils/license.ts (đã có test riêng).
 */

const safeStore: KeyValueStore = {
  getItem: (k: string) => {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  setItem: (k: string, v: string) => {
    try { localStorage.setItem(k, v); } catch { /* bỏ qua */ }
  },
  removeItem: (k: string) => {
    try { localStorage.removeItem(k); } catch { /* bỏ qua */ }
  }
};

export interface LicenseGateApi {
  machineId: string;
  activated: boolean;
  isAdmin: boolean;
  guardAction: (fn: () => void) => void;
  openAdmin: () => void;
  openMachines: () => void;
  modals: React.ReactNode;
}

type AdminStep =
  | { kind: 'master' }
  | { kind: 'create' }
  | { kind: 'pw2'; mode: 'local' | 'remote'; expectedHash: string };

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.72)', zIndex: 9990,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px'
};
const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(160deg, #111c33, #0b1220)', color: '#e2e8f0',
  width: '100%', maxWidth: '520px', borderRadius: '16px', border: '2px solid #6366f1',
  boxShadow: '0 18px 50px rgba(0,0,0,0.5)', maxHeight: '88vh', overflowY: 'auto', padding: '20px 22px'
};
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '9px',
  border: '1.5px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: '15px', fontWeight: 600
};
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '13.5px', fontWeight: 800, margin: '10px 0 4px', color: '#c7d2fe' };
const primaryBtn: React.CSSProperties = {
  padding: '11px 18px', border: 0, borderRadius: '10px', background: 'linear-gradient(135deg,#2e9e4f,#15803d)',
  color: '#fff', fontWeight: 900, fontSize: '15px', cursor: 'pointer'
};
const ghostBtn: React.CSSProperties = {
  padding: '11px 16px', border: '1.5px solid #475569', borderRadius: '10px', background: 'transparent',
  color: '#cbd5e1', fontWeight: 800, fontSize: '14.5px', cursor: 'pointer'
};

export function useLicenseGate(): LicenseGateApi {
  const [machineId] = useState<string>(() => getMachineId(safeStore));
  const [activated, setActivated] = useState<boolean>(() => readLocalActivation(safeStore).activated);
  const [memAdmin, setMemAdmin] = useState<boolean>(false);
  const [adminOn, setAdminOn] = useState<boolean>(() => isAdminActive(safeStore, false, Date.now()));
  const isAdmin = adminOn || memAdmin;

  const [toast, setToast] = useState<string>('');
  const toastTimer = useRef<any>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }, []);

  /* ----- Kiểm trạng thái kích hoạt với Firebase khi tải trang -----
   * statusSynced = đã đối chiếu xong (mọi kết cục, kể cả mất mạng) — cổng
   * điểm-vào chỉ quyết định sau mốc này để không mời nhầm máy đã kích hoạt
   * ở Firebase mà bộ nhớ máy vừa bị xoá, và để bắt cả ca bị khoá từ xa. */
  const [statusSynced, setStatusSynced] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let lic: any = undefined;
      try { lic = await fbGet(defaultFetch, 'kc3d_licenses/' + machineId); } catch { lic = undefined; }
      if (cancelled) return;
      if (lic !== undefined) { // mất mạng (undefined) → giữ trạng thái đã lưu
        const local = readLocalActivation(safeStore);
        const remote = !lic ? 'none' : lic.status === 'locked' ? 'locked' : 'active';
        const next = applyRemoteStatus(local.activated, remote as any);
        if (next && !local.activated && lic) {
          writeLocalActivation(safeStore, {
            email: lic.email || '', name: lic.name || '', school: lic.school || '', at: lic.at || Date.now()
          });
        }
        if (!next && local.activated) clearLocalActivation(safeStore);
        setActivated(next);
      }
      setStatusSynced(true);
    })();
    return () => { cancelled = true; };
  }, [machineId]);

  /* ----- Cửa đăng ký ----- */
  const [showReg, setShowReg] = useState(false);
  const [regDone, setRegDone] = useState(false);
  const [regBusy, setRegBusy] = useState(false);
  const [regError, setRegError] = useState('');
  const [regForm, setRegForm] = useState({ email: '', name: '', school: '' });
  const pendingAction = useRef<(() => void) | null>(null);

  const guardAction = useCallback(
    (fn: () => void) => {
      if (gateAllows({ isAdmin, activated })) { fn(); return; }
      pendingAction.current = fn;
      const info = readLocalActivation(safeStore).info;
      if (info) setRegForm({ email: info.email || '', name: info.name || '', school: info.school || '' });
      setRegDone(false);
      setRegError('');
      setShowReg(true);
    },
    [isAdmin, activated]
  );

  const handleRegSubmit = async () => {
    const err = validateRegistration(regForm);
    if (err) { setRegError('⚠️ ' + err); return; }
    setRegBusy(true);
    setRegError('');
    const res = await submitRegistration(
      { fetchFn: defaultFetch, store: safeStore, now: () => Date.now(), ua: (navigator as any)?.userAgent || '' },
      machineId,
      regForm
    );
    setRegBusy(false);
    if (!res.ok) { setRegError('❌ ' + res.message); return; }
    setActivated(true);
    setRegDone(true);
  };

  const closeRegAndRun = () => {
    setShowReg(false);
    const fn = pendingAction.current;
    pendingAction.current = null;
    if (fn) fn();
  };

  /* ----- Admin 2 khoá ----- */
  const [adminStep, setAdminStep] = useState<AdminStep | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [fMaster, setFMaster] = useState('');
  const [fPw2, setFPw2] = useState('');
  const [fPw2b, setFPw2b] = useState('');

  const finishAdminLogin = (remember: boolean) => {
    beginAdminSession(safeStore, remember, Date.now());
    if (!remember) setMemAdmin(true);
    setAdminOn(true);
    setAdminStep(null);
    setFMaster(''); setFPw2(''); setFPw2b('');
    showToast(remember
      ? '👑 Đã mở Admin — máy này đã ghi nhớ phiên Admin.'
      : '👑 Đã mở Admin cho lần mở trang này — máy lạ KHÔNG ghi nhớ, tải lại trang là khoá.');
  };

  const openAdmin = useCallback(() => {
    if (isAdmin) {
      if (window.confirm('Thoát chế độ Admin?')) {
        endAdminSession(safeStore);
        setMemAdmin(false);
        setAdminOn(false);
        showToast('🔒 Đã thoát Admin.');
      }
      return;
    }
    setAdminError('');
    setFMaster(''); setFPw2(''); setFPw2b('');
    setAdminStep({ kind: 'master' });
  }, [isAdmin, showToast]);

  const submitMaster = async () => {
    setAdminBusy(true);
    setAdminError('');
    const okMaster = await verifyMasterCode(fMaster);
    if (!okMaster) { setAdminBusy(false); setAdminError('❌ Sai mã chủ (KEY).'); return; }
    const localHash = getLocalPwHash(safeStore);
    if (localHash) {
      setAdminBusy(false);
      setAdminStep({ kind: 'pw2', mode: 'local', expectedHash: localHash });
      return;
    }
    const remote = await fetchRemotePwHash(defaultFetch);
    setAdminBusy(false);
    const step = decidePw2Step('', remote);
    if (step === 'blocked') {
      setAdminError('❌ Không đọc được máy chủ để kiểm mã Admin — kiểm tra mạng rồi thử lại.');
      return;
    }
    if (step === 'create') { setAdminStep({ kind: 'create' }); return; }
    setAdminStep({ kind: 'pw2', mode: 'remote', expectedHash: remote as string });
  };

  const submitCreatePw2 = async () => {
    if (fPw2.trim().length < 4) { setAdminError('⚠️ Mã Admin cần ít nhất 4 ký tự.'); return; }
    if (fPw2 !== fPw2b) { setAdminError('⚠️ Hai lần nhập mã Admin chưa khớp nhau.'); return; }
    setAdminBusy(true);
    setAdminError('');
    try {
      const hash = await sha256Hex(fPw2.trim());
      await saveRemotePwHash(defaultFetch, hash);
      setLocalPwHash(safeStore, hash);
    } catch {
      setAdminBusy(false);
      setAdminError('❌ Lưu mã Admin chưa được — kiểm tra mạng rồi thử lại.');
      return;
    }
    setAdminBusy(false);
    finishAdminLogin(true);
    showToast('🔑 Đã đặt mã Admin của thầy — từ nay mở Admin bằng mã chủ + mã này.');
  };

  const submitPw2 = async (step: { mode: 'local' | 'remote'; expectedHash: string }) => {
    setAdminBusy(true);
    setAdminError('');
    const okPw = await verifyPw2(fPw2, step.expectedHash);
    setAdminBusy(false);
    if (!okPw) { setAdminError('❌ Sai mã Admin của thầy.'); return; }
    finishAdminLogin(step.mode === 'local');
  };

  /* ----- Quản lý máy ----- */
  const [showMachines, setShowMachines] = useState(false);
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [machinesBusy, setMachinesBusy] = useState(false);
  const [machinesError, setMachinesError] = useState('');

  const loadMachines = useCallback(async () => {
    setMachinesBusy(true);
    setMachinesError('');
    try {
      setMachines(await fetchMachines(defaultFetch));
    } catch {
      setMachinesError('❌ Chưa tải được danh sách máy — kiểm tra mạng rồi thử lại.');
    }
    setMachinesBusy(false);
  }, []);

  const openMachines = useCallback(() => {
    setShowMachines(true);
    loadMachines();
  }, [loadMachines]);

  const toggleMachine = async (row: MachineRow) => {
    const next = row.status === 'active' ? 'locked' : 'active';
    if (next === 'locked' && !window.confirm('Khoá lại máy ' + row.mid + '? Máy đó sẽ mất quyền dùng 2 nút Thêm Đề Mới / Lưu Đề Này ở lần mở trang kế tiếp.')) return;
    setMachinesBusy(true);
    try {
      await setMachineStatus(defaultFetch, row.mid, next, Date.now());
      showToast(next === 'locked' ? '🔒 Đã khoá máy ' + row.mid : '✅ Đã mở lại máy ' + row.mid);
      await loadMachines();
    } catch {
      setMachinesError('❌ Đổi trạng thái chưa được — thử lại nhé.');
    }
    setMachinesBusy(false);
  };

  /* ----- Cổng điểm-vào khu giáo viên (Chuyện 1) -----
   * Hook mount cùng TeacherSetupView nên effect này chạy đúng MỘT lần mỗi
   * lần vào khu giáo viên (đã đối chiếu Firebase xong): chưa kích hoạt +
   * không phải Admin → mở modal mời đăng ký ở chế độ KHÔNG có hành động chờ
   * (đóng modal là dùng tiếp đề có sẵn; 2 nút vẫn bị guardAction chặn riêng
   * như cũ). Dùng chung state showReg với cửa ở 2 nút nên không bao giờ có
   * 2 modal chồng nhau. */
  const entryPromptedRef = useRef(false);
  useEffect(() => {
    if (!statusSynced || entryPromptedRef.current) return;
    if (showReg || adminStep || showMachines) return;
    if (!shouldPromptEntryGate({ isAdmin, activated })) return;
    entryPromptedRef.current = true;
    pendingAction.current = null;
    const info = readLocalActivation(safeStore).info;
    if (info) setRegForm({ email: info.email || '', name: info.name || '', school: info.school || '' });
    setRegDone(false);
    setRegError('');
    setShowReg(true);
  }, [statusSynced, isAdmin, activated, showReg, adminStep, showMachines]);

  /* ----- JSX các modal ----- */
  const fmtTime = (ts: number) => {
    if (!ts) return '';
    try { return new Date(ts).toLocaleString('vi-VN'); } catch { return ''; }
  };

  const modals = (
    <>
      {showReg && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setShowReg(false); }}>
          <div style={{ ...cardStyle, maxWidth: '560px', padding: '28px 30px' }}>
            {!regDone ? (
              <>
                <div style={{ textAlign: 'center', fontSize: '27px', fontWeight: 900, letterSpacing: '0.5px', color: '#facc15', lineHeight: 1.2 }}>
                  ĐẤU TRƯỜNG ONLINE PRO
                </div>
                <p style={{ textAlign: 'center', fontSize: '14.5px', color: '#c7d2fe', margin: '8px 0 0', lineHeight: 1.55 }}>
                  Xác thực thông tin Giáo viên để kích hoạt hệ thống điều khiển phòng thi 3D
                </p>
                <p style={{ fontSize: '14px', lineHeight: 1.6, margin: '14px 0 0' }}>
                  Đây là <b>lần điền đầu tiên và duy nhất</b> — hệ thống <b>tự động kích hoạt ngay</b> và
                  <b> ghi nhớ máy này vĩnh viễn</b>, lần sau vào thẳng, không hỏi lại. Kích hoạt xong sẽ mở
                  khoá 2 nút <b>➕ Thêm Đề Mới</b> và <b>💾 Lưu Đề Này</b>.
                </p>
                <p style={{ fontSize: '13.5px', lineHeight: 1.55, margin: '8px 0 0', color: '#94a3b8' }}>
                  Chưa kích hoạt vẫn <b>chơi / tổ chức thi bằng các bộ đề có sẵn như bình thường</b>.
                </p>
                <label style={labelStyle}>ĐỊA CHỈ GMAIL *</label>
                <input style={inputStyle} type="email" placeholder="vd: nguyenvana@gmail.com" value={regForm.email}
                  onChange={e => setRegForm({ ...regForm, email: e.target.value })} />
                <label style={labelStyle}>HỌ VÀ TÊN THẦY / CÔ *</label>
                <input style={inputStyle} type="text" placeholder="vd: Nguyễn Văn A" value={regForm.name}
                  onChange={e => setRegForm({ ...regForm, name: e.target.value })} />
                <label style={labelStyle}>TRƯỜNG CÔNG TÁC *</label>
                <input style={inputStyle} type="text" placeholder="vd: THPT Mang Thít" value={regForm.school}
                  onChange={e => setRegForm({ ...regForm, school: e.target.value })} />
                <p style={{ fontSize: '13px', margin: '12px 0 0', color: '#94a3b8' }}>
                  Mã máy của máy này (cố định): <b style={{ color: '#facc15', letterSpacing: '0.5px' }}>{machineId}</b>
                </p>
                {regError && <p style={{ color: '#fca5a5', fontWeight: 700, fontSize: '14px', margin: '10px 0 0' }}>{regError}</p>}
                <button type="button" disabled={regBusy} onClick={handleRegSubmit}
                  style={{ ...primaryBtn, width: '100%', marginTop: '18px', padding: '14px 18px', fontSize: '16.5px' }}>
                  {regBusy ? '⏳ Đang gửi...' : '🚀 VÀO ĐẤU TRƯỜNG ONLINE'}
                </button>
                <div style={{ textAlign: 'center', marginTop: '8px' }}>
                  <button type="button" onClick={() => setShowReg(false)}
                    style={{ background: 'transparent', border: 0, color: '#94a3b8', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: '6px 10px' }}>
                    Bỏ qua, dùng đề có sẵn →
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', fontSize: '21px', fontWeight: 900, color: '#4ade80' }}>🎉 KÍCH HOẠT THÀNH CÔNG!</div>
                <p style={{ fontSize: '15px', lineHeight: 1.65, margin: '12px 0 0', textAlign: 'center' }}>
                  Máy <b style={{ color: '#facc15' }}>{machineId}</b> đã được kích hoạt tự động.<br />
                  Hai nút <b>➕ Thêm Đề Mới</b> và <b>💾 Lưu Đề Này</b> đã mở khoá vĩnh viễn trên máy này.
                </p>
                <div style={{ display: 'flex', marginTop: '18px', justifyContent: 'center' }}>
                  <button type="button" style={primaryBtn} onClick={closeRegAndRun}>✔️ Dùng ngay</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {adminStep && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setAdminStep(null); }}>
          <div style={{ ...cardStyle, maxWidth: '440px' }}>
            <div style={{ textAlign: 'center', fontSize: '19px', fontWeight: 900, color: '#facc15' }}>🔑 ĐĂNG NHẬP ADMIN</div>
            {adminStep.kind === 'master' && (
              <>
                <p style={{ fontSize: '14.5px', margin: '10px 0 0' }}><b>Bước 1/2</b> — Nhập <b>mã chủ (KEY)</b> dùng chung các trang của thầy:</p>
                <label style={labelStyle}>Mã chủ</label>
                <input style={inputStyle} type="password" value={fMaster} autoFocus
                  onChange={e => setFMaster(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !adminBusy) submitMaster(); }} />
              </>
            )}
            {adminStep.kind === 'create' && (
              <>
                <p style={{ fontSize: '14.5px', margin: '10px 0 0', lineHeight: 1.6 }}>
                  <b>Bước 2/2</b> — Đây là <b>lần đầu</b> mở Admin: thầy <b>tự đặt mã Admin riêng</b> (khoá 2).
                  Mã này lưu dạng mã hoá ở máy chủ + tại máy này; từ nay mở Admin phải có đủ <b>mã chủ + mã này</b>.
                </p>
                <label style={labelStyle}>Đặt mã Admin (ít nhất 4 ký tự)</label>
                <input style={inputStyle} type="password" value={fPw2} autoFocus onChange={e => setFPw2(e.target.value)} />
                <label style={labelStyle}>Nhập lại mã Admin</label>
                <input style={inputStyle} type="password" value={fPw2b} onChange={e => setFPw2b(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !adminBusy) submitCreatePw2(); }} />
              </>
            )}
            {adminStep.kind === 'pw2' && (
              <>
                <p style={{ fontSize: '14.5px', margin: '10px 0 0', lineHeight: 1.6 }}>
                  <b>Bước 2/2</b> — Nhập <b>mã Admin của thầy</b> (khoá 2):
                  {adminStep.mode === 'remote'
                    ? ' Máy này là MÁY LẠ — mở được nhưng KHÔNG ghi nhớ, tải lại trang là khoá.'
                    : ' Máy này đã có mã Admin — mở được sẽ ghi nhớ phiên Admin.'}
                </p>
                <label style={labelStyle}>Mã Admin</label>
                <input style={inputStyle} type="password" value={fPw2} autoFocus
                  onChange={e => setFPw2(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !adminBusy) submitPw2(adminStep as any); }} />
              </>
            )}
            {adminError && <p style={{ color: '#fca5a5', fontWeight: 700, fontSize: '14px', margin: '10px 0 0' }}>{adminError}</p>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' }}>
              <button type="button" style={ghostBtn} onClick={() => setAdminStep(null)}>Huỷ</button>
              <button type="button" style={primaryBtn} disabled={adminBusy}
                onClick={() => {
                  if (adminStep.kind === 'master') submitMaster();
                  else if (adminStep.kind === 'create') submitCreatePw2();
                  else submitPw2(adminStep as any);
                }}>
                {adminBusy ? '⏳ Đang kiểm...' : '🔓 Mở Admin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMachines && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setShowMachines(false); }}>
          <div style={{ ...cardStyle, maxWidth: '640px' }}>
            <div style={{ fontSize: '19px', fontWeight: 900, color: '#facc15' }}>🔐 QUẢN LÝ MÁY ĐÃ KÍCH HOẠT (Admin)</div>
            <p style={{ fontSize: '13.5px', color: '#fbbf24', fontWeight: 700, margin: '8px 0 0', lineHeight: 1.55 }}>
              ⚡ Chế độ TỰ ĐỘNG DUYỆT đang bật: máy gửi đăng ký là kích hoạt ngay, thầy không cần duyệt tay.
              Muốn thu hồi máy nào thì bấm 🔒 Khoá lại — máy đó mất quyền ở lần mở trang kế tiếp.
            </p>
            {machinesError && <p style={{ color: '#fca5a5', fontWeight: 700, fontSize: '14px', margin: '10px 0 0' }}>{machinesError}</p>}
            {machinesBusy && <p style={{ fontSize: '14.5px', margin: '12px 0 0' }}>⏳ Đang tải danh sách...</p>}
            {!machinesBusy && machines.length === 0 && !machinesError && (
              <p style={{ fontSize: '14.5px', color: '#94a3b8', margin: '12px 0 0' }}>Chưa có máy nào đăng ký.</p>
            )}
            <div style={{ marginTop: '10px' }}>
              {machines.map(row => (
                <div key={row.mid} style={{ border: '1.5px solid #334155', borderRadius: '10px', padding: '9px 12px', margin: '7px 0', fontSize: '14px', lineHeight: 1.55 }}>
                  <b>{row.name || '?'}</b> — {row.school || '?'}<br />
                  ✉️ {row.email || '?'}<br />
                  🖥️ Mã máy: <b>{row.mid}</b>
                  {row.mid === machineId && <span style={{ color: '#4ade80', fontWeight: 800 }}> (Máy chủ — máy này)</span>}
                  {' • '}{fmtTime(row.at)}
                  {' • '}{row.status === 'active'
                    ? <span style={{ color: '#4ade80', fontWeight: 800 }}>✅ Đã kích hoạt</span>
                    : row.status === 'locked'
                      ? <span style={{ color: '#f87171', fontWeight: 800 }}>🔒 Đã khoá</span>
                      : <span style={{ color: '#fbbf24', fontWeight: 800 }}>⏳ Chờ kích hoạt</span>}
                  <br />
                  {row.status === 'locked' ? (
                    <button type="button" disabled={machinesBusy} onClick={() => toggleMachine(row)}
                      style={{ marginTop: '6px', padding: '7px 14px', border: 0, borderRadius: '8px', background: '#2e9e4f', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                      ✔️ Mở lại
                    </button>
                  ) : (
                    <button type="button" disabled={machinesBusy} onClick={() => toggleMachine(row)}
                      style={{ marginTop: '6px', padding: '7px 14px', border: 0, borderRadius: '8px', background: row.status === 'pending' ? '#2e9e4f' : '#dc2626', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                      {row.status === 'pending' ? '✔️ Mở khoá' : '🔒 Khoá lại'}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', justifyContent: 'flex-end' }}>
              <button type="button" style={ghostBtn} onClick={loadMachines}>↻ Tải lại</button>
              <button type="button" style={ghostBtn} onClick={() => setShowMachines(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', left: '50%', bottom: '22px', transform: 'translateX(-50%)', zIndex: 9995,
          background: '#1e293b', color: '#f8fafc', border: '1.5px solid #6366f1', borderRadius: '10px',
          padding: '10px 16px', fontSize: '14.5px', fontWeight: 700, boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
          maxWidth: '92vw', textAlign: 'center'
        }}>{toast}</div>
      )}
    </>
  );

  return { machineId, activated, isAdmin, guardAction, openAdmin, openMachines, modals };
}
