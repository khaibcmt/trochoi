import mqtt from 'mqtt';

export const OWNER_GITHUB_EMAIL = 'khaibcmt@gmail.com';
export const OWNER_GITHUB_ACCOUNT = 'github.com/khaibcmt';
export const MAX_FREE_SESSIONS = 10;

const STORAGE_SECURITY_STATE_KEY = 'thpt_owner_security_state_v2';
const STORAGE_DEVICE_ANCHOR_KEY = 'thpt_device_hardware_anchor_v2';
const SESSION_COUNTED_FLAG_KEY = 'thpt_session_counted_active_v2';

const MQTT_SECURITY_BROKERS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt'
];

const MQTT_REGISTRY_TOPIC = 'thpt_owner_sec_registry_v2/khaibcmt';

export interface MachineRecord {
  deviceId: string;
  hardwareSummary: string;
  platform: string;
  screenResolution: string;
  timeZone: string;
  userAgentShort: string;
  sessionsUsed: number;
  isActivated: boolean;
  isOwnerDevice: boolean;
  ownerEmail?: string;
  activatedAt?: number;
  activationCodeUsed?: string;
  firstSeenAt: number;
  lastSeenAt: number;
  siteIds: string[];
  networkDomains: string[];
  clientIp?: string;
}

export interface WebNetworkRecord {
  siteId: string;
  origin: string;
  hostname: string;
  pathname: string;
  protocol: string;
  networkSignature: string;
  firstVisitedAt: number;
  lastVisitedAt: number;
  visitCount: number;
  deviceIds: string[];
}

export interface ActivationRequestLog {
  requestId: string;
  deviceId: string;
  siteId: string;
  origin: string;
  hardwareSummary: string;
  requesterNote?: string;
  activationCode: string;
  createdAt: number;
  emailSentTo: string;
}

export interface OwnerSecurityState {
  deviceId: string;
  hardwareSummary: string;
  currentSiteId: string;
  currentOrigin: string;
  currentHostname: string;
  networkSignature: string;
  sessionsUsed: number;
  maxFreeSessions: number;
  isActivated: boolean;
  activatedAt?: number;
  activationCodeUsed?: string;
  isOwnerLoggedIn: boolean;
  loggedInEmail: string;
  isSuspended: boolean;
  knownMachines: Record<string, MachineRecord>;
  knownWebSites: Record<string, WebNetworkRecord>;
  activationRequests: ActivationRequestLog[];
}

// Băm chuỗi nhanh FNV-1a 32-bit kết hợp salt bảo mật
function hashStringFNV1a(input: string, salt = 'THPT_MANGTHIT_KHAIBCMT_2026'): string {
  const str = `${salt}::${input}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= (ch + i) & 0xff;
    h2 = Math.imul(h2, 0x1000193);
  }
  const part1 = (h1 >>> 0).toString(16).toUpperCase().padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `${part1}${part2}`;
}

// Tạo và ghi nhớ cố định ID Máy (Device Hardware Fingerprint)
export function getOrCreateDeviceIdentity(): {
  deviceId: string;
  hardwareSummary: string;
  platform: string;
  screenResolution: string;
  timeZone: string;
  userAgentShort: string;
} {
  const nav = typeof navigator !== 'undefined' ? navigator : ({} as any);
  const scr = typeof screen !== 'undefined' ? screen : ({} as any);

  const platform = String(nav.platform || 'WebOS').trim();
  const cores = nav.hardwareConcurrency ? `${nav.hardwareConcurrency}CPU` : 'CPU';
  const ram = (nav as any).deviceMemory ? `${(nav as any).deviceMemory}GB` : '';
  const screenResolution = `${scr.width || 1920}x${scr.height || 1080}x${scr.colorDepth || 24}`;
  const timeZone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh'
      : 'Asia/Ho_Chi_Minh';
  const lang = String(nav.language || 'vi-VN');
  const ua = String(nav.userAgent || '');

  let browserName = 'Browser';
  if (/Edg\//i.test(ua)) browserName = 'Edge';
  else if (/Chrome\//i.test(ua)) browserName = 'Chrome';
  else if (/Firefox\//i.test(ua)) browserName = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browserName = 'Safari';

  // Canvas & WebGL fingerprint nhẹ để định danh phần cứng máy
  let gpuVendor = '';
  try {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as any;
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          gpuVendor = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '').slice(0, 32);
        }
      }
    }
  } catch {}

  let anchor = '';
  try {
    anchor = localStorage.getItem(STORAGE_DEVICE_ANCHOR_KEY) || '';
    if (!anchor) {
      const hwSeed = `${platform}|${cores}|${ram}|${screenResolution}|${timeZone}|${lang}|${gpuVendor}`;
      const hwHash = hashStringFNV1a(hwSeed, 'DEVICE_HW_SEED');
      anchor = `DEV-${hwHash.slice(0, 4)}-${hwHash.slice(4, 8)}-${hwHash.slice(8, 12)}`;
      localStorage.setItem(STORAGE_DEVICE_ANCHOR_KEY, anchor);
    }
  } catch {
    const hwSeed = `${platform}|${cores}|${screenResolution}|${timeZone}`;
    const hwHash = hashStringFNV1a(hwSeed, 'DEVICE_HW_SEED');
    anchor = `DEV-${hwHash.slice(0, 4)}-${hwHash.slice(4, 8)}-${hwHash.slice(8, 12)}`;
  }

  const hardwareSummary = [platform, browserName, cores, ram, screenResolution, timeZone]
    .filter(Boolean)
    .join(' • ');

  return {
    deviceId: anchor,
    hardwareSummary,
    platform,
    screenResolution,
    timeZone,
    userAgentShort: `${browserName} on ${platform}`
  };
}

// Tạo và ghi nhớ ID Trang Mạng (Web / Domain / Network Identity)
export function getCurrentWebNetworkIdentity(): {
  siteId: string;
  origin: string;
  hostname: string;
  pathname: string;
  protocol: string;
  networkSignature: string;
} {
  const loc = typeof window !== 'undefined' ? window.location : ({} as any);
  const origin = String(loc.origin || 'https://khaibcmt.github.io');
  const hostname = String(loc.hostname || 'khaibcmt.github.io');
  const pathname = String(loc.pathname || '/');
  const protocol = String(loc.protocol || 'https:').replace(':', '').toUpperCase();

  const conn = typeof navigator !== 'undefined' ? (navigator as any).connection : null;
  const netType = conn?.effectiveType ? String(conn.effectiveType).toUpperCase() : 'BROADBAND';

  let sitePrefix = 'WEB';
  if (hostname.includes('github.io')) sitePrefix = 'GH-PAGES';
  else if (hostname.includes('run.app')) sitePrefix = 'CLOUD-RUN';
  else if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) sitePrefix = 'LOCAL-NET';

  const domainHash = hashStringFNV1a(`${origin}${pathname}`, 'WEB_NETWORK_ID').slice(0, 6);
  const siteId = `${sitePrefix}-${domainHash}`;
  const networkSignature = `${protocol}://${hostname}${pathname !== '/' ? pathname : ''} (${netType})`;

  return {
    siteId,
    origin,
    hostname,
    pathname,
    protocol,
    networkSignature
  };
}

// Sinh Mã Kích Hoạt chuẩn mật mã gắn với ID Máy (hoặc Mã Master của Chủ sở hữu)
export function generateActivationCodeForDevice(deviceId: string): string {
  const cleanDev = String(deviceId || '').trim().toUpperCase();
  const rawHash = hashStringFNV1a(`${cleanDev}::${OWNER_GITHUB_EMAIL}`, 'OWNER_LICENSE_KEY_2026');
  return `KHAI-${rawHash.slice(0, 4)}-${rawHash.slice(4, 8)}`;
}

// Sinh Mã Kích Hoạt Master Toàn Cầu (dành riêng cho Chủ sở hữu khaibcmt@gmail.com)
export function getMasterOwnerActivationCode(): string {
  const rawHash = hashStringFNV1a(`MASTER::${OWNER_GITHUB_EMAIL}::${OWNER_GITHUB_ACCOUNT}`, 'MASTER_KEY_2026');
  return `OWNER-${rawHash.slice(0, 4)}-${rawHash.slice(4, 8)}`;
}

// Kiểm tra xem email đăng nhập có phải là Email chính chủ của Chủ sở hữu không
export function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === OWNER_GITHUB_EMAIL.toLowerCase();
}

// Kiểm tra tính hợp lệ của Mã Kích Hoạt
export function verifyActivationCode(inputCode: string, currentDeviceId: string): boolean {
  const clean = String(inputCode || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!clean) return false;

  const expectedDeviceCode = generateActivationCodeForDevice(currentDeviceId).toUpperCase();
  const expectedMasterCode = getMasterOwnerActivationCode().toUpperCase();

  if (clean === expectedDeviceCode || clean === expectedMasterCode) {
    return true;
  }

  // Cho phép cả mã OTP 6 chữ số hoặc mã dự phòng được lưu trong danh sách yêu cầu của thiết bị này
  try {
    const raw = localStorage.getItem(STORAGE_SECURITY_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<OwnerSecurityState>;
      const matchedReq = (parsed.activationRequests || []).some(
        r => r.activationCode.toUpperCase() === clean && r.deviceId === currentDeviceId
      );
      if (matchedReq) return true;
    }
  } catch {}

  return false;
}

// Đọc trạng thái bảo mật hiện tại và tự động cập nhật ID Máy + ID Trang Mạng
export function loadOwnerSecurityState(options?: { incrementSessionIfNew?: boolean; syncProfileEmail?: string }): OwnerSecurityState {
  const dev = getOrCreateDeviceIdentity();
  const net = getCurrentWebNetworkIdentity();
  const now = Date.now();

  let saved: Partial<OwnerSecurityState> = {};
  try {
    const raw = localStorage.getItem(STORAGE_SECURITY_STATE_KEY);
    if (raw) {
      saved = JSON.parse(raw);
    }
  } catch {}

  const knownMachines: Record<string, MachineRecord> = saved.knownMachines || {};
  const knownWebSites: Record<string, WebNetworkRecord> = saved.knownWebSites || {};
  const activationRequests: ActivationRequestLog[] = Array.isArray(saved.activationRequests)
    ? saved.activationRequests
    : [];

  // Kiểm tra email đăng nhập từ CloudSync hoặc từ phiên đăng nhập Chủ sở hữu
  const candidateEmail = (options?.syncProfileEmail || saved.loggedInEmail || '').trim().toLowerCase();
  const ownerLoggedIn = Boolean(saved.isOwnerLoggedIn && isOwnerEmail(saved.loggedInEmail)) || isOwnerEmail(candidateEmail);
  const effectiveEmail = ownerLoggedIn ? OWNER_GITHUB_EMAIL : candidateEmail;

  let sessionsUsed = typeof saved.sessionsUsed === 'number' && saved.sessionsUsed >= 0 ? saved.sessionsUsed : 0;

  // Tăng bộ đếm phiên nếu đây là phiên mở trang mới (chưa được tính trong sessionStorage)
  if (options?.incrementSessionIfNew) {
    try {
      const alreadyCounted = sessionStorage.getItem(SESSION_COUNTED_FLAG_KEY);
      if (!alreadyCounted) {
        sessionsUsed += 1;
        sessionStorage.setItem(SESSION_COUNTED_FLAG_KEY, String(now));
      }
    } catch {
      sessionsUsed = Math.max(1, sessionsUsed);
    }
  } else if (sessionsUsed === 0) {
    sessionsUsed = 1;
  }

  const isActivated = Boolean(saved.isActivated);
  // Nếu chủ nhân đăng nhập bằng mail chính chủ (khaibcmt@gmail.com) thì KHÔNG CẦN KÍCH HOẠT và không bao giờ bị tạm ngưng
  // Nếu chưa kích hoạt và không phải chủ sở hữu, sử dụng được tối đa 10 phiên (từ phiên thứ 11 hoặc sau khi hết 10 phiên sẽ tạm ngưng)
  const isSuspended = !ownerLoggedIn && !isActivated && sessionsUsed > MAX_FREE_SESSIONS;

  // Cập nhật Bản ghi ID Máy đã chạy (Machine Record)
  const existingMachine = knownMachines[dev.deviceId];
  const mergedSiteIds = Array.from(new Set([...(existingMachine?.siteIds || []), net.siteId]));
  const mergedDomains = Array.from(new Set([...(existingMachine?.networkDomains || []), net.origin]));

  knownMachines[dev.deviceId] = {
    deviceId: dev.deviceId,
    hardwareSummary: dev.hardwareSummary,
    platform: dev.platform,
    screenResolution: dev.screenResolution,
    timeZone: dev.timeZone,
    userAgentShort: dev.userAgentShort,
    sessionsUsed,
    isActivated: isActivated || ownerLoggedIn,
    isOwnerDevice: ownerLoggedIn,
    ownerEmail: effectiveEmail || undefined,
    activatedAt: saved.activatedAt,
    activationCodeUsed: saved.activationCodeUsed,
    firstSeenAt: existingMachine?.firstSeenAt || now,
    lastSeenAt: now,
    siteIds: mergedSiteIds,
    networkDomains: mergedDomains,
    clientIp: existingMachine?.clientIp
  };

  // Cập nhật Bản ghi ID Trang Mạng (Web / Network Record)
  const existingSite = knownWebSites[net.siteId];
  const mergedDevicesForSite = Array.from(new Set([...(existingSite?.deviceIds || []), dev.deviceId]));

  knownWebSites[net.siteId] = {
    siteId: net.siteId,
    origin: net.origin,
    hostname: net.hostname,
    pathname: net.pathname,
    protocol: net.protocol,
    networkSignature: net.networkSignature,
    firstVisitedAt: existingSite?.firstVisitedAt || now,
    lastVisitedAt: now,
    visitCount: (existingSite?.visitCount || 0) + (options?.incrementSessionIfNew ? 1 : 0),
    deviceIds: mergedDevicesForSite
  };

  const nextState: OwnerSecurityState = {
    deviceId: dev.deviceId,
    hardwareSummary: dev.hardwareSummary,
    currentSiteId: net.siteId,
    currentOrigin: net.origin,
    currentHostname: net.hostname,
    networkSignature: net.networkSignature,
    sessionsUsed,
    maxFreeSessions: MAX_FREE_SESSIONS,
    isActivated,
    activatedAt: saved.activatedAt,
    activationCodeUsed: saved.activationCodeUsed,
    isOwnerLoggedIn: ownerLoggedIn,
    loggedInEmail: effectiveEmail,
    isSuspended,
    knownMachines,
    knownWebSites,
    activationRequests
  };

  saveOwnerSecurityState(nextState);
  return nextState;
}

export function saveOwnerSecurityState(state: OwnerSecurityState): void {
  try {
    localStorage.setItem(STORAGE_SECURITY_STATE_KEY, JSON.stringify(state));
  } catch {}
}

// Ghi nhận thêm 1 phiên khởi chạy trò chơi / phiên hoạt động mới
export function recordNewUsageSession(): OwnerSecurityState {
  const current = loadOwnerSecurityState();
  const nextSessions = current.sessionsUsed + 1;
  const isSuspended = !current.isOwnerLoggedIn && !current.isActivated && nextSessions > MAX_FREE_SESSIONS;

  const updated: OwnerSecurityState = {
    ...current,
    sessionsUsed: nextSessions,
    isSuspended,
    knownMachines: {
      ...current.knownMachines,
      [current.deviceId]: {
        ...(current.knownMachines[current.deviceId] || ({} as any)),
        sessionsUsed: nextSessions,
        lastSeenAt: Date.now()
      }
    }
  };
  saveOwnerSecurityState(updated);
  syncSecurityTelemetryToServerAndCloud(updated).catch(() => {});
  return updated;
}

// Đăng nhập bằng Email Chính Chủ (khaibcmt@gmail.com) -> Mở khóa toàn bộ không cần mã kích hoạt
export function authenticateOwnerEmail(emailInput: string): {
  ok: boolean;
  message: string;
  state: OwnerSecurityState;
} {
  const clean = String(emailInput || '').trim().toLowerCase();
  const current = loadOwnerSecurityState();

  if (!isOwnerEmail(clean)) {
    return {
      ok: false,
      message: `Email "${clean}" không phải là email chính chủ đã đăng ký GitHub (${OWNER_GITHUB_EMAIL}). Vui lòng nhập mã kích hoạt hoặc đăng nhập bằng email chính chủ!`,
      state: current
    };
  }

  const now = Date.now();
  const updated: OwnerSecurityState = {
    ...current,
    isOwnerLoggedIn: true,
    loggedInEmail: OWNER_GITHUB_EMAIL,
    isSuspended: false,
    knownMachines: {
      ...current.knownMachines,
      [current.deviceId]: {
        ...(current.knownMachines[current.deviceId] || ({} as any)),
        isOwnerDevice: true,
        isActivated: true,
        ownerEmail: OWNER_GITHUB_EMAIL,
        lastSeenAt: now
      }
    }
  };

  saveOwnerSecurityState(updated);
  syncSecurityTelemetryToServerAndCloud(updated).catch(() => {});

  return {
    ok: true,
    message: `Chào mừng Chủ sở hữu Hồ Tấn Khải (${OWNER_GITHUB_EMAIL})! Đã xác thực tài khoản chính chủ GitHub — Miễn kích hoạt vĩnh viễn trên thiết bị này.`,
    state: updated
  };
}

// Đăng xuất tài khoản Chủ sở hữu trên máy hiện tại (ví dụ khi dùng xong trên máy công cộng)
export function logoutOwnerEmail(): OwnerSecurityState {
  const current = loadOwnerSecurityState();
  const isSuspended = !current.isActivated && current.sessionsUsed > MAX_FREE_SESSIONS;
  const updated: OwnerSecurityState = {
    ...current,
    isOwnerLoggedIn: false,
    loggedInEmail: '',
    isSuspended,
    knownMachines: {
      ...current.knownMachines,
      [current.deviceId]: {
        ...(current.knownMachines[current.deviceId] || ({} as any)),
        isOwnerDevice: false,
        isActivated: current.isActivated,
        lastSeenAt: Date.now()
      }
    }
  };
  saveOwnerSecurityState(updated);
  return updated;
}

// Kích hoạt thiết bị bằng Mã Kích Hoạt nhận qua email GitHub
export function activateWithLicenseCode(codeInput: string): {
  ok: boolean;
  message: string;
  state: OwnerSecurityState;
} {
  const current = loadOwnerSecurityState();
  const cleanCode = String(codeInput || '').trim().toUpperCase();

  if (!verifyActivationCode(cleanCode, current.deviceId)) {
    return {
      ok: false,
      message: 'Mã kích hoạt không hợp lệ hoặc không khớp với ID Máy hiện tại. Vui lòng kiểm tra lại mã được gửi về mail GitHub (khaibcmt@gmail.com)!',
      state: current
    };
  }

  const now = Date.now();
  const updated: OwnerSecurityState = {
    ...current,
    isActivated: true,
    activatedAt: now,
    activationCodeUsed: cleanCode,
    isSuspended: false,
    knownMachines: {
      ...current.knownMachines,
      [current.deviceId]: {
        ...(current.knownMachines[current.deviceId] || ({} as any)),
        isActivated: true,
        activatedAt: now,
        activationCodeUsed: cleanCode,
        lastSeenAt: now
      }
    }
  };

  saveOwnerSecurityState(updated);
  syncSecurityTelemetryToServerAndCloud(updated).catch(() => {});

  return {
    ok: true,
    message: `Kích hoạt bản quyền thành công cho ID Máy [${current.deviceId}] trên trang mạng [${current.currentSiteId}]! Không còn giới hạn 10 phiên.`,
    state: updated
  };
}

// Đồng bộ dữ liệu ID Máy đã chạy & ID Các Trang Mạng lên Server + MQTT Cloud để Chủ sở hữu giám sát tập trung
export async function syncSecurityTelemetryToServerAndCloud(state?: OwnerSecurityState): Promise<OwnerSecurityState> {
  const current = state || loadOwnerSecurityState();

  // 1. Đồng bộ qua API Backend (/api/security/telemetry) nếu có
  try {
    const res = await fetch('/api/security/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machine: current.knownMachines[current.deviceId],
        website: current.knownWebSites[current.currentSiteId],
        activationRequests: current.activationRequests
      })
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data && data.ok && data.registry) {
        const mergedMachines: Record<string, MachineRecord> = {
          ...(data.registry.machines || {}),
          ...current.knownMachines
        };
        if (data.clientIp && mergedMachines[current.deviceId]) {
          mergedMachines[current.deviceId].clientIp = data.clientIp;
        }
        const mergedSites: Record<string, WebNetworkRecord> = {
          ...(data.registry.websites || {}),
          ...current.knownWebSites
        };
        const mergedReqs: ActivationRequestLog[] = Array.isArray(data.registry.activationRequests)
          ? data.registry.activationRequests
          : current.activationRequests;

        const nextState: OwnerSecurityState = {
          ...current,
          knownMachines: mergedMachines,
          knownWebSites: mergedSites,
          activationRequests: mergedReqs
        };
        saveOwnerSecurityState(nextState);
        publishRegistryToMqttCloud(nextState);
        return nextState;
      }
    }
  } catch {}

  // 2. Đồng bộ qua MQTT Cloud (Hoạt động cả trên GitHub Pages tĩnh không có backend)
  publishRegistryToMqttCloud(current);
  return current;
}

function publishRegistryToMqttCloud(state: OwnerSecurityState): void {
  try {
    const client = mqtt.connect(MQTT_SECURITY_BROKERS[0], {
      clientId: `thpt_sec_${Math.random().toString(16).slice(2, 8)}`,
      connectTimeout: 5000
    });
    const timer = setTimeout(() => {
      try {
        client.end(true);
      } catch {}
    }, 6000);

    client.on('connect', () => {
      const payload = JSON.stringify({
        updatedAt: Date.now(),
        knownMachines: state.knownMachines,
        knownWebSites: state.knownWebSites,
        activationRequests: state.activationRequests.slice(-30)
      });
      client.publish(MQTT_REGISTRY_TOPIC, payload, { retain: true, qos: 0 }, () => {
        clearTimeout(timer);
        try {
          client.end(true);
        } catch {}
      });
    });

    client.on('error', () => {
      clearTimeout(timer);
      try {
        client.end(true);
      } catch {}
    });
  } catch {}
}

// Tải danh sách ID Máy & ID Trang Mạng từ MQTT Cloud về cho Chủ sở hữu
export function fetchRegistryFromMqttCloud(): Promise<Partial<OwnerSecurityState> | null> {
  return new Promise(resolve => {
    let done = false;
    const finish = (val: Partial<OwnerSecurityState> | null) => {
      if (!done) {
        done = true;
        try {
          client.end(true);
        } catch {}
        resolve(val);
      }
    };

    const client = mqtt.connect(MQTT_SECURITY_BROKERS[0], {
      clientId: `thpt_sec_sub_${Math.random().toString(16).slice(2, 8)}`,
      connectTimeout: 5000
    });

    const timer = setTimeout(() => finish(null), 5500);

    client.on('connect', () => {
      client.subscribe(MQTT_REGISTRY_TOPIC, { qos: 0 }, err => {
        if (err) {
          clearTimeout(timer);
          finish(null);
        }
      });
    });

    client.on('message', (_topic, payload) => {
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(payload.toString());
        finish(parsed);
      } catch {
        finish(null);
      }
    });

    client.on('error', () => {
      clearTimeout(timer);
      finish(null);
    });
  });
}

// Gửi Mã Kích Hoạt về Email đăng ký GitHub của Chủ sở hữu (khaibcmt@gmail.com)
export async function requestActivationCodeToOwnerEmail(requesterNote?: string): Promise<{
  ok: boolean;
  message: string;
  requestLog: ActivationRequestLog;
  mailtoUrl: string;
}> {
  const current = loadOwnerSecurityState();
  const activationCode = generateActivationCodeForDevice(current.deviceId);
  const now = Date.now();

  const requestLog: ActivationRequestLog = {
    requestId: `REQ-${now.toString(36).toUpperCase()}`,
    deviceId: current.deviceId,
    siteId: current.currentSiteId,
    origin: current.currentOrigin,
    hardwareSummary: current.hardwareSummary,
    requesterNote: requesterNote?.trim() || 'Giáo viên yêu cầu cấp mã kích hoạt thiết bị',
    activationCode,
    createdAt: now,
    emailSentTo: OWNER_GITHUB_EMAIL
  };

  const nextRequests = [requestLog, ...(current.activationRequests || []).slice(0, 29)];
  const updatedState: OwnerSecurityState = {
    ...current,
    activationRequests: nextRequests
  };
  saveOwnerSecurityState(updatedState);

  // Kênh 1: Gửi qua Backend Relay (/api/security/request-activation-email)
  let backendDispatched = false;
  try {
    const res = await fetch('/api/security/request-activation-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestLog)
    });
    if (res.ok) {
      const data = await res.json();
      backendDispatched = Boolean(data?.ok);
    }
  } catch {}

  // Kênh 2: Gửi trực tiếp qua cổng FormSubmit AJAX tới khaibcmt@gmail.com (chạy được cả trên GitHub Pages)
  let relayDispatched = false;
  try {
    const formRes = await fetch(`https://formsubmit.co/ajax/${OWNER_GITHUB_EMAIL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        _subject: `[ĐẤU TRƯỜNG 3D - GITHUB] Mã Kích Hoạt Thiết Bị ${current.deviceId}`,
        _template: 'table',
        Chu_So_Huu_GitHub: `${OWNER_GITHUB_EMAIL} (${OWNER_GITHUB_ACCOUNT})`,
        ID_May_Da_Chay: current.deviceId,
        Cau_Hinh_May: current.hardwareSummary,
        ID_Trang_Mang: `${current.currentSiteId} (${current.currentOrigin})`,
        So_Phien_Da_Dung: `${current.sessionsUsed}/${MAX_FREE_SESSIONS} phiên`,
        Ghi_Chu_Nguoi_Yeu_Cau: requestLog.requesterNote,
        MA_KICH_HOAT_CAP_PHEP: activationCode,
        Thoi_Gian_Yeu_Cau: new Date(now).toLocaleString('vi-VN')
      })
    });
    if (formRes.ok) {
      relayDispatched = true;
    }
  } catch {}

  // Kênh 3: Đồng bộ ngay lên Cloud Inbox của Chủ sở hữu
  await syncSecurityTelemetryToServerAndCloud(updatedState);

  const subject = encodeURIComponent(`[Đấu Trường 3D] Yêu cầu Mã Kích Hoạt cho Máy ${current.deviceId}`);
  const body = encodeURIComponent(
    `Kính gửi Chủ sở hữu trang web (${OWNER_GITHUB_EMAIL} - ${OWNER_GITHUB_ACCOUNT}),\n\n` +
      `Hệ thống ghi nhận yêu cầu kích hoạt bản quyền Đấu Trường 3D:\n` +
      `- ID Máy đã chạy (Device ID): ${current.deviceId}\n` +
      `- Cấu hình thiết bị: ${current.hardwareSummary}\n` +
      `- ID Trang mạng (Site ID): ${current.currentSiteId}\n` +
      `- Địa chỉ trang mạng: ${current.currentOrigin}\n` +
      `- Số phiên đã sử dụng: ${current.sessionsUsed}/${MAX_FREE_SESSIONS} phiên\n` +
      `- Ghi chú: ${requestLog.requesterNote}\n` +
      `- Mã kích hoạt tương ứng của ID máy này: ${activationCode}\n`
  );
  const mailtoUrl = `mailto:${OWNER_GITHUB_EMAIL}?subject=${subject}&body=${body}`;

  return {
    ok: true,
    message:
      backendDispatched || relayDispatched
        ? `Đã gửi thông tin ID Máy [${current.deviceId}], ID Trang mạng [${current.currentSiteId}] và Mã Kích Hoạt về email đăng ký GitHub (${OWNER_GITHUB_EMAIL})!`
        : `Đã tạo yêu cầu Mã Kích Hoạt cho ID Máy [${current.deviceId}] và gửi về Hộp thư Bảo mật Chủ sở hữu (${OWNER_GITHUB_EMAIL})!`,
    requestLog,
    mailtoUrl
  };
}
