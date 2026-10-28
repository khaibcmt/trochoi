import mqtt, { MqttClient } from 'mqtt';
import { CloudMessage, QuizItem } from '../types';

export type NetworkConnStatus = 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';
export type AntiCongestionMode = 'AUTO' | 'WEAK_WIFI' | 'TURBO';

export interface NetworkTelemetry {
  status: NetworkConnStatus;
  rttMs: number;
  activeServerName: string;
  activeChannelsCount: number;
  workerActive: boolean;
  congestionMode: AntiCongestionMode;
  queuedCount: number;
  quizCached: boolean;
}

const PRIMARY_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://mqtt.eclipseprojects.io:443/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt'
];

const CLOUD_RUN_BACKUP_ORIGIN = 'https://ais-pre-26gapdbbveltobr2u7uoka-799945497821.asia-southeast1.run.app';

export function computeClientQuizHash(quiz: QuizItem[] | undefined | null): string {
  if (!Array.isArray(quiz) || quiz.length === 0) return '';
  const firstQ = String(quiz[0]?.q || '').slice(0, 24);
  const lastQ = String(quiz[quiz.length - 1]?.q || '').slice(0, 24);
  return `q_${quiz.length}_${firstQ.length}_${lastQ.length}`;
}

/**
 * Khởi tạo mã nguồn Web Worker chạy ngầm (Multi-threading Network Offloader)
 * Giúp tách toàn bộ việc gọi HTTP Polling, JSON.parse/stringify và gom gói tin (Batching)
 * sang luồng phụ để luồng chính (UI + 3D WebGL + Cảm ứng điện thoại) luôn mượt 60FPS, không bao giờ đơ/lag.
 */
const WORKER_SCRIPT = `
  let pollTimer = null;
  let roomId = '';
  let lastSeq = 0;
  let lastHbMid = '';
  let currentQuizHash = '';
  let pollIntervalMs = 650;
  let isPolling = false;
  let apiOrigins = [''];
  let activeOriginIdx = 0;

  async function pollOnce() {
    if (!roomId || isPolling) return;
    isPolling = true;
    const origin = apiOrigins[activeOriginIdx % apiOrigins.length] || '';
    const startTs = Date.now();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 9500) : null;
    try {
      const url = origin + '/api/room/' + encodeURIComponent(roomId) + '/poll?since=' + lastSeq + '&hb=' + encodeURIComponent(lastHbMid) + '&qh=' + encodeURIComponent(currentQuizHash);
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
        signal: controller ? controller.signal : undefined
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          const rtt = Math.max(8, Date.now() - startTs);
          if (typeof data.seq === 'number' && data.seq > lastSeq) {
            lastSeq = data.seq;
          }
          if (data.latestHeartbeat && data.latestHeartbeat._mid) {
            lastHbMid = data.latestHeartbeat._mid;
          }
          if (data.quizHash && data.latestHeartbeat && Array.isArray(data.latestHeartbeat.quiz) && data.latestHeartbeat.quiz.length > 0) {
            currentQuizHash = data.quizHash;
          }
          self.postMessage({
            type: 'POLL_SUCCESS',
            rtt,
            origin: origin || 'Server Chính (Edge)',
            data
          });
        } else {
          activeOriginIdx = (activeOriginIdx + 1) % apiOrigins.length;
          self.postMessage({ type: 'POLL_FAIL' });
        }
      } else {
        activeOriginIdx = (activeOriginIdx + 1) % apiOrigins.length;
        self.postMessage({ type: 'POLL_FAIL' });
      }
    } catch (err) {
      activeOriginIdx = (activeOriginIdx + 1) % apiOrigins.length;
      self.postMessage({ type: 'POLL_FAIL' });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      isPolling = false;
    }
  }

  function restartTimer() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    if (!roomId) return;
    pollOnce();
    pollTimer = setInterval(pollOnce, pollIntervalMs);
  }

  self.onmessage = function(ev) {
    const msg = ev.data || {};
    if (msg.cmd === 'START') {
      if (roomId !== msg.roomId) {
        lastSeq = 0;
        lastHbMid = '';
      }
      roomId = msg.roomId || '';
      if (Array.isArray(msg.origins) && msg.origins.length > 0) {
        apiOrigins = msg.origins;
      }
      if (msg.quizHash) {
        currentQuizHash = msg.quizHash;
      }
      if (typeof msg.intervalMs === 'number') {
        pollIntervalMs = msg.intervalMs;
      }
      restartTimer();
    } else if (msg.cmd === 'SET_INTERVAL') {
      if (typeof msg.intervalMs === 'number' && msg.intervalMs !== pollIntervalMs) {
        pollIntervalMs = msg.intervalMs;
        restartTimer();
      }
    } else if (msg.cmd === 'SET_QUIZ_HASH') {
      currentQuizHash = msg.quizHash || '';
    } else if (msg.cmd === 'POLL_NOW') {
      pollOnce();
    } else if (msg.cmd === 'STOP') {
      roomId = '';
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    }
  };
`;

class NetworkService {
  private client: MqttClient | null = null;
  private currentRoomTopic = '';
  private currentRoomId = '';
  private seenMsgIds = new Set<string>();
  private seenMsgQueue: string[] = [];
  private localBus: BroadcastChannel | null = null;
  private worker: Worker | null = null;
  private workerSupported = false;

  private onMessageCallback: ((data: CloudMessage) => void) | null = null;
  private onConnectedCallback: (() => void) | null = null;
  private onStatusChangeCallback: ((status: NetworkConnStatus) => void) | null = null;
  private telemetryListeners = new Set<(t: NetworkTelemetry) => void>();

  private status: NetworkConnStatus = 'CONNECTED';
  private brokerIndex = 0;
  private offlineQueue: CloudMessage[] = [];
  private batchOutbox: CloudMessage[] = [];
  private batchFlushTimer: any = null;
  private reconnectTimer: any = null;
  private httpPollTimer: any = null;
  private lastHttpSeq = 0;
  private lastHeartbeatMid = '';
  private currentQuizHash = '';
  private cachedQuizDeck: QuizItem[] = [];
  private httpHealthy = true;
  private mqttHealthy = false;
  private consecutiveHttpFailures = 0;
  private isIntentionalDisconnect = false;
  private isPollingInFlight = false;
  private isFetchingQuizInFlight = false;

  private rttMs = 24;
  private activeServerName = 'Đa Server (Edge + Cloud)';
  private congestionMode: AntiCongestionMode = 'AUTO';
  private apiOrigins: string[] = [''];
  private activeOriginIdx = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      // Cấu hình cụm Đa Server (Multi-Server Origins):
      // Nếu chạy trên GitHub Pages hoặc tên miền tĩnh, tự động nối song song về Cloud Run Server chính
      const isStaticHost = /github\.io$/i.test(window.location.hostname);
      this.apiOrigins = isStaticHost ? [CLOUD_RUN_BACKUP_ORIGIN, ''] : ['', CLOUD_RUN_BACKUP_ORIGIN];

      try {
        const savedMode = localStorage.getItem('kc3d_congestion_mode') as AntiCongestionMode | null;
        if (savedMode === 'AUTO' || savedMode === 'WEAK_WIFI' || savedMode === 'TURBO') {
          this.congestionMode = savedMode;
        }
      } catch {}

      try {
        if ('BroadcastChannel' in window) {
          this.localBus = new BroadcastChannel('tug_multi_v16_stream');
          this.localBus.onmessage = (ev) => {
            const data = ev.data as CloudMessage;
            this.deliverIncomingMessage(data);
          };
        }
      } catch {}

      this.initBackgroundWorker();

      window.addEventListener('storage', (ev) => {
        if (ev.key === 'kc3d_instant_bus_v1' && ev.newValue) {
          try {
            const data = JSON.parse(ev.newValue) as CloudMessage;
            this.deliverIncomingMessage(data);
          } catch {}
        }
      });

      window.addEventListener('online', () => {
        this.httpHealthy = true;
        this.consecutiveHttpFailures = 0;
        this.setStatus('CONNECTED');
        if (!this.isIntentionalDisconnect && this.currentRoomId) {
          this.reconnectImmediate();
        }
      });

      window.addEventListener('offline', () => {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          this.setStatus('RECONNECTING');
        }
      });

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !this.isIntentionalDisconnect && this.currentRoomId) {
          this.reconnectImmediate();
        }
      });
    }
  }

  private initBackgroundWorker() {
    try {
      if (typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
        const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const w = new Worker(url);
        w.onmessage = (ev) => {
          const msg = ev.data || {};
          if (msg.type === 'POLL_SUCCESS' && msg.data) {
            this.rttMs = typeof msg.rtt === 'number' ? msg.rtt : 35;
            this.activeServerName = msg.origin || 'Server Chính (Đa Luồng)';
            this.handlePollResponseData(msg.data);
          } else if (msg.type === 'POLL_FAIL') {
            this.handlePollFailure();
          }
        };
        w.onerror = () => {
          this.workerSupported = false;
          this.worker = null;
          if (this.currentRoomId && !this.isIntentionalDisconnect) {
            this.startMainThreadHttpPolling();
          }
        };
        this.worker = w;
        this.workerSupported = true;
      }
    } catch {
      this.workerSupported = false;
      this.worker = null;
    }
  }

  public getTelemetry(): NetworkTelemetry {
    const channels = (this.httpHealthy ? 1 : 0) + (this.mqttHealthy ? 1 : 0) + (this.localBus ? 1 : 0) + 1;
    return {
      status: this.status,
      rttMs: this.rttMs,
      activeServerName: this.activeServerName,
      activeChannelsCount: channels,
      workerActive: this.workerSupported,
      congestionMode: this.congestionMode,
      queuedCount: this.offlineQueue.length + this.batchOutbox.length,
      quizCached: this.cachedQuizDeck.length > 0
    };
  }

  public subscribeTelemetry(cb: (t: NetworkTelemetry) => void): () => void {
    this.telemetryListeners.add(cb);
    cb(this.getTelemetry());
    return () => {
      this.telemetryListeners.delete(cb);
    };
  }

  private notifyTelemetry() {
    const snapshot = this.getTelemetry();
    this.telemetryListeners.forEach(cb => {
      try {
        cb(snapshot);
      } catch {}
    });
  }

  public setAntiCongestionMode(mode: AntiCongestionMode) {
    this.congestionMode = mode;
    try {
      localStorage.setItem('kc3d_congestion_mode', mode);
    } catch {}
    const nextInterval = this.getAdaptivePollInterval();
    if (this.worker && this.workerSupported) {
      this.worker.postMessage({ cmd: 'SET_INTERVAL', intervalMs: nextInterval });
    } else if (this.currentRoomId && !this.isIntentionalDisconnect) {
      this.startMainThreadHttpPolling();
    }
    this.notifyTelemetry();
  }

  private getAdaptivePollInterval(): number {
    if (this.congestionMode === 'TURBO') return 450;
    if (this.congestionMode === 'WEAK_WIFI') return 900;
    // AUTO mode: tự động điều chỉnh theo độ trễ mạng thực tế (RTT)
    if (this.rttMs > 700) return 950;
    if (this.rttMs > 350) return 750;
    return 550;
  }

  private cacheQuizLocally(roomId: string, quiz: QuizItem[], quizHash?: string) {
    if (!Array.isArray(quiz) || quiz.length === 0) return;
    this.cachedQuizDeck = quiz;
    if (quizHash) {
      this.currentQuizHash = quizHash;
      if (this.worker && this.workerSupported) {
        this.worker.postMessage({ cmd: 'SET_QUIZ_HASH', quizHash });
      }
    }
    try {
      const cachePayload = JSON.stringify({
        quizHash: this.currentQuizHash,
        quiz,
        updatedAt: Date.now()
      });
      sessionStorage.setItem(`kc3d_quiz_cache_${roomId}`, cachePayload);
      localStorage.setItem(`kc3d_quiz_cache_${roomId}`, cachePayload);
    } catch {}
  }

  private loadCachedQuizLocally(roomId: string): QuizItem[] {
    try {
      const raw =
        sessionStorage.getItem(`kc3d_quiz_cache_${roomId}`) ||
        localStorage.getItem(`kc3d_quiz_cache_${roomId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.quiz) && parsed.quiz.length > 0) {
          this.cachedQuizDeck = parsed.quiz;
          if (parsed.quizHash) {
            this.currentQuizHash = parsed.quizHash;
          }
          return parsed.quiz;
        }
      }
    } catch {}
    return [];
  }

  private async fetchMissingQuizByHash(targetHash: string) {
    if (!this.currentRoomId || this.isFetchingQuizInFlight) return;
    this.isFetchingQuizInFlight = true;
    const origin = this.apiOrigins[this.activeOriginIdx % this.apiOrigins.length] || '';
    try {
      const res = await fetch(`${origin}/api/room/${encodeURIComponent(this.currentRoomId)}/quiz`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.quiz) && data.quiz.length > 0) {
          this.cacheQuizLocally(this.currentRoomId, data.quiz, data.quizHash || targetHash);
          this.deliverIncomingMessage({
            _mid: `qsync_${data.quizHash || Date.now()}`,
            type: 'QUIZ_SYNC',
            quizHash: data.quizHash || targetHash,
            quiz: data.quiz
          });
        }
      }
    } catch {} finally {
      this.isFetchingQuizInFlight = false;
    }
  }

  private deliverIncomingMessage(data: CloudMessage | null | undefined) {
    if (!data || !data.type) return;
    if (data._mid) {
      if (this.seenMsgIds.has(data._mid)) return;
      this.recordMsgId(data._mid);
    }

    // Nếu gói tin có đính kèm mảng quiz mới, lưu ngay vào bộ nhớ đệm (Cache)
    if (Array.isArray(data.quiz) && data.quiz.length > 0 && this.currentRoomId) {
      this.cacheQuizLocally(this.currentRoomId, data.quiz, data.quizHash);
    } else if (
      data.quizHash &&
      data.quizHash !== this.currentQuizHash &&
      this.cachedQuizDeck.length === 0
    ) {
      // Nếu gói tin chỉ chứa quizHash (do được tối ưu băng thông qua MQTT/HTTP) mà máy học sinh chưa có đề -> tải ngầm ngay
      this.fetchMissingQuizByHash(data.quizHash);
    } else if (!data.quiz && this.cachedQuizDeck.length > 0) {
      // Tự động gắn lại bộ đề đã cache trên máy để các hàm xử lý phía trên luôn có đủ 100% câu hỏi
      if (
        data.type === 'HOST_HEARTBEAT' ||
        data.type === 'FORCE_START_MATCH' ||
        data.type === 'MATCH_START' ||
        data.type === 'QUESTION_START' ||
        data.type === 'ENTER_CONFIRMED'
      ) {
        data = { ...data, quiz: this.cachedQuizDeck };
      }
    }

    if (this.onMessageCallback) {
      try {
        this.onMessageCallback(data);
      } catch {}
    }
  }

  private setStatus(newStatus: NetworkConnStatus) {
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    const effectiveStatus: NetworkConnStatus =
      newStatus !== 'CONNECTED' && (this.httpHealthy || this.mqttHealthy) && isOnline
        ? 'CONNECTED'
        : newStatus;

    if (this.status !== effectiveStatus) {
      this.status = effectiveStatus;
      if (this.onStatusChangeCallback) {
        try {
          this.onStatusChangeCallback(effectiveStatus);
        } catch {}
      }
    }
    this.notifyTelemetry();
  }

  public getStatus(): NetworkConnStatus {
    return this.status;
  }

  private recordMsgId(mid: string) {
    this.seenMsgIds.add(mid);
    this.seenMsgQueue.push(mid);
    if (this.seenMsgQueue.length > 6000) {
      const old = this.seenMsgQueue.shift();
      if (old) this.seenMsgIds.delete(old);
    }
  }

  connect(
    roomId: string,
    onMessage: (data: CloudMessage) => void,
    onConnected?: () => void,
    onStatusChange?: (status: NetworkConnStatus) => void
  ) {
    this.isIntentionalDisconnect = false;
    const cleanRoom = String(roomId || '12345').replace(/[^a-zA-Z0-9]/g, '') || '12345';
    const roomChanged = this.currentRoomId !== cleanRoom;
    this.currentRoomId = cleanRoom;
    this.currentRoomTopic = `thptmangthit_kc3d_${cleanRoom}`;
    this.onMessageCallback = onMessage;
    if (onConnected) this.onConnectedCallback = onConnected;
    if (onStatusChange) this.onStatusChangeCallback = onStatusChange;

    if (roomChanged) {
      this.lastHttpSeq = 0;
      this.lastHeartbeatMid = '';
      this.currentQuizHash = '';
      this.cachedQuizDeck = [];
    }

    // Khôi phục hàng đợi ngoại tuyến (Offline Queue) nếu học sinh vừa F5 trên mạng yếu
    try {
      const savedQueue = sessionStorage.getItem(`kc3d_offline_q_${cleanRoom}`);
      if (savedQueue) {
        const parsedQ = JSON.parse(savedQueue);
        if (Array.isArray(parsedQ) && parsedQ.length > 0) {
          this.offlineQueue = parsedQ;
        }
      }
    } catch {}

    // Khôi phục ngay lập tức bộ đề thi đã cache trong máy (0ms load)
    const cachedQuiz = this.loadCachedQuizLocally(cleanRoom);

    this.httpHealthy = true;
    this.consecutiveHttpFailures = 0;
    this.setStatus('CONNECTED');

    // 1. Khởi chạy luồng Worker Đa Luồng (hoặc Main-thread fallback) kết nối cụm HTTP Server
    const intervalMs = this.getAdaptivePollInterval();
    if (this.worker && this.workerSupported) {
      this.worker.postMessage({
        cmd: 'START',
        roomId: cleanRoom,
        origins: this.apiOrigins,
        quizHash: this.currentQuizHash,
        intervalMs
      });
    } else {
      this.startMainThreadHttpPolling();
    }

    // 2. Khởi chạy song song cụm Đa Server WebSocket (MQTT Multi-Broker trên cổng 443/8084/8884)
    // Giúp tín hiệu "BẮT ĐẦU THI" (FORCE_START_MATCH / QUESTION_START) truyền tới điện thoại học sinh trong < 50ms!
    if (!this.client || !this.client.connected || roomChanged) {
      this.initMqttClient();
    }

    // 3. Đọc dữ liệu đồng bộ tức thời từ localStorage / cache nếu có
    try {
      const localSaved = localStorage.getItem(`kc3d_live_sync_${cleanRoom}`);
      if (localSaved) {
        const parsed = JSON.parse(localSaved);
        if (parsed) {
          const deckToUse = (Array.isArray(parsed.quiz) && parsed.quiz.length > 0) ? parsed.quiz : cachedQuiz;
          if (deckToUse.length > 0) {
            setTimeout(() => {
              this.deliverIncomingMessage({
                type: 'HOST_HEARTBEAT',
                gameType: parsed.gameType,
                status: parsed.status,
                globalQIndex: parsed.globalQIndex,
                question: parsed.question,
                quiz: deckToUse,
                subj: parsed.subj
              });
            }, 10);
          }
        }
      }
    } catch {}

    if (this.onConnectedCallback) {
      setTimeout(() => {
        if (!this.isIntentionalDisconnect && this.onConnectedCallback) {
          this.onConnectedCallback();
        }
      }, 25);
    }
  }

  private handlePollResponseData(data: any) {
    this.httpHealthy = true;
    this.consecutiveHttpFailures = 0;
    if (this.status !== 'CONNECTED') {
      this.setStatus('CONNECTED');
      if (this.onConnectedCallback) this.onConnectedCallback();
    }
    this.flushOfflineQueue();

    if (typeof data.seq === 'number' && data.seq > this.lastHttpSeq) {
      this.lastHttpSeq = data.seq;
    }

    // Nếu Server báo có quizHash mới mà chưa gửi kèm quiz (hoặc cần tải riêng), lưu lại
    if (data.quizHash && data.latestHeartbeat?.quiz && Array.isArray(data.latestHeartbeat.quiz)) {
      this.cacheQuizLocally(this.currentRoomId, data.latestHeartbeat.quiz, data.quizHash);
    } else if (data.quizHash && data.quizHash !== this.currentQuizHash && this.cachedQuizDeck.length === 0) {
      this.fetchMissingQuizByHash(data.quizHash);
    }

    // Nhận danh sách học sinh đã đăng ký trên server (đảm bảo Host luôn nhận đủ 100% học sinh không sót ai)
    if (Array.isArray(data.players)) {
      data.players.forEach((p: any) => {
        if (p && p.playerId) {
          const synthMid = `srv_p_${p.playerId}_${encodeURIComponent(p.playerName || '')}_${p.ready ? 'R' : 'A'}_${p.savedScore || 0}_${p.savedCorrect || 0}`;
          if (!this.seenMsgIds.has(synthMid)) {
            this.recordMsgId(synthMid);
            if (this.onMessageCallback) {
              this.onMessageCallback({
                _mid: synthMid,
                type: p.ready ? 'PLAYER_READY_ROPE' : 'AUTO_ENTER_ARENA',
                playerId: p.playerId,
                playerName: p.playerName,
                preferredTeam: p.preferredTeam,
                avatar: p.avatar,
                savedScore: p.savedScore,
                savedCorrect: p.savedCorrect
              });
            }
          }
        }
      });
    }

    // Nhận nhịp tim mới nhất của Host TRƯỚC hoặc SAU sự kiện đều đảm bảo trạng thái chuẩn xác
    if (data.latestHeartbeat && data.latestHeartbeat._mid !== this.lastHeartbeatMid) {
      this.lastHeartbeatMid = data.latestHeartbeat._mid || '';
      this.deliverIncomingMessage(data.latestHeartbeat);
    } else if (data.matchStatus === 'PLAYING' && this.onMessageCallback) {
      // Bảo hiểm kép: Nếu Server đang ở trạng thái PLAYING (Giáo viên đã bấm Bắt đầu),
      // đảm bảo máy học sinh nhận được trạng thái PLAYING ngay cả khi heartbeat không đổi!
      const syncMid = `srv_playing_sync_${data.globalQIndex ?? 0}`;
      if (!this.seenMsgIds.has(syncMid)) {
        this.deliverIncomingMessage({
          _mid: syncMid,
          type: 'WELCOME_ACK',
          status: 'PLAYING',
          globalQIndex: data.globalQIndex ?? 0,
          quiz: this.cachedQuizDeck.length > 0 ? this.cachedQuizDeck : undefined
        });
      }
    }

    // Nhận các sự kiện tức thời
    if (Array.isArray(data.events)) {
      data.events.forEach((evMsg: CloudMessage) => {
        this.deliverIncomingMessage(evMsg);
      });
    }

    this.notifyTelemetry();
  }

  private handlePollFailure() {
    this.consecutiveHttpFailures++;
    this.activeOriginIdx = (this.activeOriginIdx + 1) % this.apiOrigins.length;
    if (this.consecutiveHttpFailures >= 2 && (!this.client || !this.client.connected)) {
      this.initMqttClient();
    }
    if (this.consecutiveHttpFailures >= 15 && !this.mqttHealthy) {
      this.httpHealthy = false;
      this.setStatus('RECONNECTING');
    } else {
      this.notifyTelemetry();
    }
  }

  private startMainThreadHttpPolling() {
    if (this.httpPollTimer) {
      clearInterval(this.httpPollTimer);
      this.httpPollTimer = null;
    }
    this.pollHttpRoomMainThreadNow();
    const interval = this.getAdaptivePollInterval();
    this.httpPollTimer = setInterval(() => {
      this.pollHttpRoomMainThreadNow();
    }, interval);
  }

  private async pollHttpRoomMainThreadNow() {
    if (this.isIntentionalDisconnect || !this.currentRoomId || this.isPollingInFlight) return;
    this.isPollingInFlight = true;
    const origin = this.apiOrigins[this.activeOriginIdx % this.apiOrigins.length] || '';
    const startTs = Date.now();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    // Tăng timeout lên 9.5 giây để mạng 3G/Wi-Fi yếu tải bộ câu hỏi dài/có ảnh không bao giờ bị ngắt giữa chừng
    const timeoutId = controller ? setTimeout(() => controller.abort(), 9500) : null;
    try {
      const res = await fetch(
        `${origin}/api/room/${encodeURIComponent(this.currentRoomId)}/poll?since=${this.lastHttpSeq}&hb=${encodeURIComponent(this.lastHeartbeatMid)}&qh=${encodeURIComponent(this.currentQuizHash)}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
          signal: controller ? controller.signal : undefined
        }
      );
      if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
        const data = await res.json();
        this.rttMs = Math.max(8, Date.now() - startTs);
        this.activeServerName = origin ? 'Cloud Server Dự Phòng' : 'Server Chính (Edge)';
        this.handlePollResponseData(data);
      } else {
        this.handlePollFailure();
      }
    } catch {
      this.handlePollFailure();
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      this.isPollingInFlight = false;
    }
  }

  private saveOfflineQueueToSession() {
    if (!this.currentRoomId) return;
    try {
      sessionStorage.setItem(
        `kc3d_offline_q_${this.currentRoomId}`,
        JSON.stringify(this.offlineQueue.slice(-60))
      );
    } catch {}
  }

  private async publishHttpMessage(payload: CloudMessage) {
    if (!this.currentRoomId) return;
    const origin = this.apiOrigins[this.activeOriginIdx % this.apiOrigins.length] || '';
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 9000) : null;
    try {
      const res = await fetch(`${origin}/api/room/${encodeURIComponent(this.currentRoomId)}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      });
      if (res.ok) {
        const respData = await res.json().catch(() => ({}));
        if (respData && respData.quizHash) {
          this.currentQuizHash = respData.quizHash;
          if (this.worker && this.workerSupported) {
            this.worker.postMessage({ cmd: 'SET_QUIZ_HASH', quizHash: respData.quizHash });
          }
        }
        this.httpHealthy = true;
        this.consecutiveHttpFailures = 0;
        if (this.status !== 'CONNECTED') {
          this.setStatus('CONNECTED');
        }
      } else {
        throw new Error('HTTP status ' + res.status);
      }
    } catch {
      const isCritical = [
        'PULL_CORRECT',
        'FREEZE_WRONG',
        'PLAYER_FINISH_QUIZ',
        'AUTO_ENTER_ARENA',
        'PLAYER_READY_ROPE',
        'PLAYER_UPDATE_NAME',
        'FORCE_PULL_TO_WAITING',
        'FORCE_START_MATCH',
        'ENTER_CONFIRMED',
        'QUESTION_START',
        'MATCH_START',
        'MATCH_ENDED',
        'GAME_SWITCH',
        'GAME_SWITCHED'
      ].includes(payload.type);
      if (isCritical && this.offlineQueue.length < 150) {
        if (!this.offlineQueue.some(x => x._mid === payload._mid)) {
          // Không lưu mảng quiz nặng vào sessionStorage queue để tránh tràn bộ nhớ trình duyệt
          const slimForQueue = payload.quiz ? { ...payload, quiz: undefined } : payload;
          this.offlineQueue.push(slimForQueue);
          this.saveOfflineQueueToSession();
          this.notifyTelemetry();
        }
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  private safeCloseMqttClient() {
    if (!this.client) return;
    const oldClient = this.client;
    this.client = null;
    this.mqttHealthy = false;
    try {
      oldClient.removeAllListeners('connect');
      oldClient.removeAllListeners('message');
      oldClient.removeAllListeners('close');
      oldClient.removeAllListeners('reconnect');
      oldClient.removeAllListeners('offline');
      oldClient.removeAllListeners('error');
      oldClient.on('error', () => {});
      oldClient.end(true);
    } catch {}
  }

  private initMqttClient() {
    this.safeCloseMqttClient();

    const brokerUrl = PRIMARY_BROKERS[this.brokerIndex % PRIMARY_BROKERS.length];
    const clientId = 'kc3d_' + Math.random().toString(16).substring(2, 10);

    try {
      const client = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 8000,
        reconnectPeriod: 0,
        keepalive: 30
      });
      this.client = client;

      client.on('error', () => {
        this.mqttHealthy = false;
        if (!this.isIntentionalDisconnect) {
          this.switchBrokerFallback();
        }
      });

      client.on('close', () => {
        this.mqttHealthy = false;
        if (!this.isIntentionalDisconnect) {
          this.switchBrokerFallback();
        }
      });

      client.on('connect', () => {
        if (!this.client || this.client !== client || !this.currentRoomTopic) return;
        client.subscribe(this.currentRoomTopic, { qos: 0 }, (err) => {
          if (!err) {
            this.mqttHealthy = true;
            this.setStatus('CONNECTED');
            if (this.onConnectedCallback) {
              this.onConnectedCallback();
            }
            this.flushOfflineQueue();
          }
        });
      });

      client.on('message', (_topic, message) => {
        try {
          const data = JSON.parse(message.toString()) as CloudMessage;
          this.deliverIncomingMessage(data);
        } catch {}
      });
    } catch {
      this.switchBrokerFallback();
    }
  }

  private switchBrokerFallback() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = this.httpHealthy ? 7000 : 2500;
    this.reconnectTimer = setTimeout(() => {
      if (!this.isIntentionalDisconnect && this.currentRoomId) {
        this.brokerIndex++;
        this.initMqttClient();
      }
    }, delay);
  }

  public reconnectImmediate() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.httpHealthy = true;
    this.consecutiveHttpFailures = 0;
    this.setStatus('CONNECTED');
    if (this.worker && this.workerSupported) {
      this.worker.postMessage({ cmd: 'POLL_NOW' });
    } else {
      this.pollHttpRoomMainThreadNow();
    }
    this.flushOfflineQueue();
    if (!this.client || !this.client.connected) {
      this.brokerIndex++;
      this.initMqttClient();
    }
  }

  private async flushOfflineQueue() {
    if (this.offlineQueue.length === 0 || !this.currentRoomId) return;
    const queued = [...this.offlineQueue];
    this.offlineQueue = [];
    this.saveOfflineQueueToSession();
    this.notifyTelemetry();

    // Gửi gộp đa luồng qua endpoint /batch để thông suốt ngay lập tức khi có mạng lại
    const origin = this.apiOrigins[this.activeOriginIdx % this.apiOrigins.length] || '';
    try {
      const res = await fetch(`${origin}/api/room/${encodeURIComponent(this.currentRoomId)}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: queued })
      });
      if (!res.ok) {
        queued.forEach(p => this.publishHttpMessage(p));
      }
    } catch {
      queued.forEach(p => this.publishHttpMessage(p));
    }

    if (this.client && this.client.connected && this.currentRoomTopic) {
      queued.forEach(payload => {
        try {
          const slim = payload.quiz ? { ...payload, quiz: undefined } : payload;
          this.client!.publish(this.currentRoomTopic, JSON.stringify(slim), { qos: 0 });
        } catch {}
      });
    }
  }

  sendMessage(payload: CloudMessage) {
    if (!payload._mid) {
      payload._mid = 'm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }
    this.recordMsgId(payload._mid);

    // Nếu gói gửi đi từ Giáo viên có mảng quiz, lưu cache & tính quizHash ngay
    if (Array.isArray(payload.quiz) && payload.quiz.length > 0 && this.currentRoomId) {
      const qHash = payload.quizHash || computeClientQuizHash(payload.quiz);
      payload.quizHash = qHash;
      this.cacheQuizLocally(this.currentRoomId, payload.quiz, qHash);
    }

    // 1. Gửi tức thì qua BroadcastChannel + localStorage (0ms trên cùng thiết bị)
    if (this.localBus) {
      try {
        this.localBus.postMessage(payload);
      } catch {}
    }
    try {
      // Không ghi mảng quiz khổng lồ vào kc3d_instant_bus_v1 để tránh vượt quota localStorage
      const busPayload =
        payload.quiz && payload.quiz.length > 15
          ? { ...payload, quiz: undefined, quizHash: payload.quizHash }
          : payload;
      localStorage.setItem('kc3d_instant_bus_v1', JSON.stringify(busPayload));
    } catch {}

    // 2. Gửi qua Server HTTP (Chỉ gửi kèm mảng quiz đầy đủ khi quizHash thay đổi hoặc là gói khởi tạo đề,
    // còn các gói HOST_HEARTBEAT định kỳ thì tự động lược bỏ mảng quiz trùng lặp để giảm 99% tải mạng!)
    let httpPayload = payload;
    if (
      payload.type === 'HOST_HEARTBEAT' &&
      payload.quiz &&
      payload.quizHash &&
      payload.quizHash === this.currentQuizHash
    ) {
      // Đánh dấu chỉ gửi full quiz ở nhịp tim đầu tiên, các nhịp tim sau gửi nhẹ (< 500 bytes)
      const syncedKey = `hb_q_synced_${this.currentRoomId}_${payload.quizHash}`;
      if (this.seenMsgIds.has(syncedKey)) {
        httpPayload = { ...payload, quiz: undefined };
      } else {
        this.recordMsgId(syncedKey);
      }
    }
    this.publishHttpMessage(httpPayload);

    // 3. Gửi qua cụm Đa Server MQTT WebSocket:
    // Luôn cắt gọn mảng quiz lớn khỏi gói MQTT để gói tin WebSocket < 2KB, bay tới điện thoại học sinh trong < 50ms mà không bao giờ gây nghẽn hay đứt kết nối!
    if (this.client && this.client.connected && this.currentRoomTopic) {
      try {
        const rawFull = JSON.stringify(payload);
        const mqttPayload =
          rawFull.length > 14000 && payload.quiz
            ? JSON.stringify({ ...payload, quiz: undefined, quizHash: payload.quizHash })
            : rawFull;
        this.client.publish(this.currentRoomTopic, mqttPayload, { qos: 0 });
      } catch {}
    }
  }

  async fetchActiveRoomId(): Promise<string | null> {
    for (const origin of this.apiOrigins) {
      try {
        const res = await fetch(`${origin}/api/room/active?_t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store'
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.roomId) {
            return String(data.roomId);
          }
        }
      } catch {}
    }
    return null;
  }

  disconnect() {
    this.isIntentionalDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.httpPollTimer) {
      clearInterval(this.httpPollTimer);
      this.httpPollTimer = null;
    }
    if (this.batchFlushTimer) {
      clearTimeout(this.batchFlushTimer);
      this.batchFlushTimer = null;
    }
    if (this.worker && this.workerSupported) {
      this.worker.postMessage({ cmd: 'STOP' });
    }
    this.safeCloseMqttClient();
    this.currentRoomTopic = '';
    this.currentRoomId = '';
  }
}

export const CloudNetwork = new NetworkService();
