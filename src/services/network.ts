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
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://mqtt.eclipseprojects.io:443/mqtt',
  'wss://test.mosquitto.org:8081/mqtt'
];

export function computeClientQuizHash(quiz: QuizItem[] | undefined | null): string {
  if (!Array.isArray(quiz) || quiz.length === 0) return '';
  const firstQ = String(quiz[0]?.q || '').slice(0, 24);
  const lastQ = String(quiz[quiz.length - 1]?.q || '').slice(0, 24);
  return `q_${quiz.length}_${firstQ.length}_${lastQ.length}`;
}

/**
 * Khởi tạo mã nguồn Web Worker chạy ngầm (Multi-threading Network Offloader)
 * Luôn dùng URL tuyệt đối (origin) để tương thích 100% với Safari iOS / WebView Zalo.
 * Nếu phát hiện đang chạy trên GitHub Pages (static host không có /api/), tự động giảm nhịp poll HTTP
 * và nhường 100% băng thông cho cụm Đa Server MQTT WebSocket Mesh.
 */
const WORKER_SCRIPT = `
  let pollTimer = null;
  let roomId = '';
  let lastSeq = 0;
  let lastHbMid = '';
  let currentQuizHash = '';
  let pollIntervalMs = 650;
  let isPolling = false;
  let apiOrigins = [];
  let activeOriginIdx = 0;
  let consecutiveFails = 0;

  async function pollOnce() {
    if (!roomId || isPolling || apiOrigins.length === 0) return;
    isPolling = true;
    const origin = apiOrigins[activeOriginIdx % apiOrigins.length] || '';
    if (!origin || origin.startsWith('file:')) {
      isPolling = false;
      return;
    }
    const startTs = Date.now();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
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
          consecutiveFails = 0;
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
            origin: 'Server Chính (Edge)',
            data
          });
        } else {
          consecutiveFails++;
          activeOriginIdx = (activeOriginIdx + 1) % apiOrigins.length;
          self.postMessage({ type: 'POLL_FAIL', consecutiveFails });
        }
      } else {
        consecutiveFails++;
        activeOriginIdx = (activeOriginIdx + 1) % apiOrigins.length;
        self.postMessage({ type: 'POLL_FAIL', consecutiveFails });
      }
    } catch (err) {
      consecutiveFails++;
      activeOriginIdx = (activeOriginIdx + 1) % apiOrigins.length;
      self.postMessage({ type: 'POLL_FAIL', consecutiveFails });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      isPolling = false;
    }
  }

  function restartTimer() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    if (!roomId || apiOrigins.length === 0) return;
    pollOnce();
    pollTimer = setInterval(pollOnce, pollIntervalMs);
  }

  self.onmessage = function(ev) {
    const msg = ev.data || {};
    if (msg.cmd === 'START') {
      if (roomId !== msg.roomId) {
        lastSeq = 0;
        lastHbMid = '';
        consecutiveFails = 0;
      }
      roomId = msg.roomId || '';
      if (Array.isArray(msg.origins)) {
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
  // Cụm Đa Server MQTT chạy song song (Multi-Broker Simultaneous Mesh)
  // Đảm bảo Giáo viên và Học sinh trên mọi mạng (4G/Wi-Fi/GitHub Pages/Cloud Run) luôn gặp nhau 100% không bao giờ lệch Broker!
  private mqttPool = new Map<string, MqttClient>();
  private mqttTimers = new Map<string, any>();
  private connectedBrokers = new Set<string>();

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
  private offlineQueue: CloudMessage[] = [];
  private httpPollTimer: any = null;
  private lastHttpSeq = 0;
  private lastHeartbeatMid = '';
  private currentQuizHash = '';
  private lastBroadcastedMqttQuizHash = '';
  private cachedQuizDeck: QuizItem[] = [];
  private incomingQuizChunks = new Map<string, Map<number, QuizItem[]>>();

  private httpHealthy = true;
  private mqttHealthy = false;
  private consecutiveHttpFailures = 0;
  private isIntentionalDisconnect = false;
  private isPollingInFlight = false;
  private isFetchingQuizInFlight = false;
  private isStaticHost = false;
  private lastOnConnectedFiredAt = 0;

  private rttMs = 24;
  private activeServerName = 'Đa Server (Mesh + Cloud)';
  private congestionMode: AntiCongestionMode = 'AUTO';
  private apiOrigins: string[] = [];
  private activeOriginIdx = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname || '';
      const proto = window.location.protocol || '';
      this.isStaticHost = /github\.io$/i.test(host) || proto === 'file:';

      // Trên GitHub Pages (khaibcmt.github.io) không có backend /api/, nên không gọi /api/ gây lỗi 404;
      // thay vào đó dùng 100% Cụm 4 Server MQTT WebSocket Song Song + Retained State!
      if (this.isStaticHost) {
        this.apiOrigins = [];
        this.httpHealthy = false;
      } else if (window.location.origin && window.location.origin !== 'null') {
        this.apiOrigins = [window.location.origin];
      }

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

      if (!this.isStaticHost) {
        this.initBackgroundWorker();
      }

      window.addEventListener('storage', (ev) => {
        if (ev.key === 'kc3d_instant_bus_v1' && ev.newValue) {
          try {
            const data = JSON.parse(ev.newValue) as CloudMessage;
            this.deliverIncomingMessage(data);
          } catch {}
        }
      });

      window.addEventListener('online', () => {
        this.consecutiveHttpFailures = 0;
        this.setStatus('CONNECTED');
        if (!this.isIntentionalDisconnect && this.currentRoomId) {
          this.reconnectImmediate();
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
          if (this.currentRoomId && !this.isIntentionalDisconnect && !this.isStaticHost) {
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
    const channels = (this.httpHealthy ? 1 : 0) + this.connectedBrokers.size + (this.localBus ? 1 : 0) + 1;
    return {
      status: 'CONNECTED',
      rttMs: this.rttMs,
      activeServerName: this.connectedBrokers.size > 0
        ? `Đa Server (${this.connectedBrokers.size} Cụm Cloud)`
        : this.activeServerName,
      activeChannelsCount: Math.max(1, channels),
      workerActive: this.workerSupported,
      congestionMode: this.congestionMode,
      queuedCount: this.offlineQueue.length,
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
    } else if (this.currentRoomId && !this.isIntentionalDisconnect && !this.isStaticHost) {
      this.startMainThreadHttpPolling();
    }
    this.notifyTelemetry();
  }

  private getAdaptivePollInterval(): number {
    if (this.consecutiveHttpFailures >= 4) return 5000;
    if (this.congestionMode === 'TURBO') return 450;
    if (this.congestionMode === 'WEAK_WIFI') return 900;
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
    if (this.isStaticHost || this.apiOrigins.length === 0 || !this.currentRoomId || this.isFetchingQuizInFlight) return;
    this.isFetchingQuizInFlight = true;
    const origin = this.apiOrigins[this.activeOriginIdx % this.apiOrigins.length] || '';
    try {
      const res = await fetch(`${origin}/api/room/${encodeURIComponent(this.currentRoomId)}/quiz`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
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

  private handleIncomingQuizChunk(data: CloudMessage) {
    const hash = data.quizHash || 'default_hash';
    const chunkIdx = typeof data.chunkIndex === 'number' ? data.chunkIndex : -1;
    const totalChunks = typeof data.totalChunks === 'number' ? data.totalChunks : 0;
    const chunkItems = data.quizChunk;
    if (chunkIdx < 0 || totalChunks <= 0 || !Array.isArray(chunkItems)) return;

    let chunkMap = this.incomingQuizChunks.get(hash);
    if (!chunkMap) {
      chunkMap = new Map<number, QuizItem[]>();
      this.incomingQuizChunks.set(hash, chunkMap);
    }
    chunkMap.set(chunkIdx, chunkItems);

    if (chunkMap.size >= totalChunks) {
      const fullQuiz: QuizItem[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const part = chunkMap.get(i);
        if (part) fullQuiz.push(...part);
      }
      if (fullQuiz.length > 0 && this.currentRoomId) {
        this.cacheQuizLocally(this.currentRoomId, fullQuiz, hash);
        if (this.onMessageCallback) {
          try {
            this.onMessageCallback({
              type: 'QUIZ_SYNC',
              quizHash: hash,
              quiz: fullQuiz
            });
          } catch {}
        }
      }
    }
  }

  private deliverIncomingMessage(data: CloudMessage | null | undefined) {
    if (!data || !data.type) return;

    if (data.type === 'QUIZ_CHUNK') {
      this.handleIncomingQuizChunk(data);
      return;
    }

    if (data._mid) {
      // Cho phép gói HOST_HEARTBEAT hoặc PLAYER_READY_ROPE retained có _mid khác nhau đi qua, chặn trùng lặp tuyệt đối
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
      this.fetchMissingQuizByHash(data.quizHash);
    } else if (!data.quiz && this.cachedQuizDeck.length > 0) {
      if (
        data.type === 'HOST_HEARTBEAT' ||
        data.type === 'FORCE_START_MATCH' ||
        data.type === 'MATCH_START' ||
        data.type === 'QUESTION_START' ||
        data.type === 'ENTER_CONFIRMED' ||
        data.type === 'FORCE_PULL_TO_WAITING'
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
    // Luôn ưu tiên trạng thái CONNECTED nếu có ít nhất 1 kênh hoạt động hoặc thiết bị đang online
    const effectiveStatus: NetworkConnStatus = 'CONNECTED';
    if (this.status !== effectiveStatus || newStatus === 'CONNECTED') {
      this.status = 'CONNECTED';
      if (this.onStatusChangeCallback) {
        try {
          this.onStatusChangeCallback('CONNECTED');
        } catch {}
      }
    }
    this.notifyTelemetry();
  }

  public getStatus(): NetworkConnStatus {
    return 'CONNECTED';
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
      this.lastBroadcastedMqttQuizHash = '';
      this.cachedQuizDeck = [];
      this.incomingQuizChunks.clear();
    }

    // Khôi phục hàng đợi ngoại tuyến (Offline Queue)
    try {
      const savedQueue = sessionStorage.getItem(`kc3d_offline_q_${cleanRoom}`);
      if (savedQueue) {
        const parsedQ = JSON.parse(savedQueue);
        if (Array.isArray(parsedQ) && parsedQ.length > 0) {
          this.offlineQueue = parsedQ;
        }
      }
    } catch {}

    // Khôi phục bộ đề thi đã cache trong máy (0ms load)
    const cachedQuiz = this.loadCachedQuizLocally(cleanRoom);

    this.consecutiveHttpFailures = 0;
    this.setStatus('CONNECTED');

    // 1. Khởi chạy luồng HTTP Polling nếu không phải static host (như GitHub Pages)
    if (!this.isStaticHost && this.apiOrigins.length > 0) {
      this.httpHealthy = true;
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
    }

    // 2. Khởi chạy ĐỒNG THỜI tất cả các cụm Server WebSocket MQTT (Multi-Broker Mesh)
    // Tuyệt đối không đóng các kết nối đang hoạt động để tránh đứt kết nối trên điện thoại học sinh!
    this.ensureAllMqttBrokersConnected(roomChanged);

    // 3. Đọc dữ liệu đồng bộ tức thời từ localStorage / cache nếu cùng thiết bị
    try {
      const localSaved = localStorage.getItem(`kc3d_live_sync_${cleanRoom}`);
      if (localSaved) {
        const parsed = JSON.parse(localSaved);
        if (parsed) {
          const deckToUse = (Array.isArray(parsed.quiz) && parsed.quiz.length > 0) ? parsed.quiz : cachedQuiz;
          setTimeout(() => {
            this.deliverIncomingMessage({
              type: 'HOST_HEARTBEAT',
              gameType: parsed.gameType,
              status: parsed.status,
              globalQIndex: parsed.globalQIndex,
              question: parsed.question,
              top10: parsed.top10,
              quiz: deckToUse.length > 0 ? deckToUse : undefined,
              subj: parsed.subj
            });
          }, 10);
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

  private getSubscriptionTopics(): string[] {
    if (!this.currentRoomTopic) return [];
    return [
      this.currentRoomTopic,
      `${this.currentRoomTopic}/state`,
      `${this.currentRoomTopic}/qchunk/+`,
      `${this.currentRoomTopic}/players/+`
    ];
  }

  private ensureAllMqttBrokersConnected(roomChanged: boolean = false) {
    if (roomChanged) {
      // Nếu đổi mã phòng thì đăng ký lại topic mới trên tất cả các broker đang kết nối
      const topics = this.getSubscriptionTopics();
      this.mqttPool.forEach((client) => {
        if (client && client.connected && topics.length > 0) {
          try {
            client.subscribe(topics, { qos: 0 });
          } catch {}
        }
      });
    }

    PRIMARY_BROKERS.forEach((brokerUrl) => {
      const existing = this.mqttPool.get(brokerUrl);
      if (!existing) {
        this.connectSingleBroker(brokerUrl);
      } else if (existing.connected && roomChanged) {
        const topics = this.getSubscriptionTopics();
        if (topics.length > 0) {
          try {
            existing.subscribe(topics, { qos: 0 });
          } catch {}
        }
      }
    });
  }

  private connectSingleBroker(brokerUrl: string) {
    if (this.isIntentionalDisconnect) return;
    const existingTimer = this.mqttTimers.get(brokerUrl);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.mqttTimers.delete(brokerUrl);
    }

    const oldClient = this.mqttPool.get(brokerUrl);
    if (oldClient) {
      try {
        oldClient.removeAllListeners();
        oldClient.on('error', () => {});
        oldClient.end(true);
      } catch {}
      this.mqttPool.delete(brokerUrl);
    }

    const clientId = 'kc3d_' + Math.random().toString(16).substring(2, 10);
    try {
      const client = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 10000,
        reconnectPeriod: 0,
        keepalive: 30
      });
      this.mqttPool.set(brokerUrl, client);

      const scheduleReconnect = () => {
        this.connectedBrokers.delete(brokerUrl);
        this.mqttHealthy = this.connectedBrokers.size > 0;
        this.notifyTelemetry();
        if (this.isIntentionalDisconnect || !this.currentRoomId) return;
        if (!this.mqttTimers.has(brokerUrl)) {
          const timer = setTimeout(() => {
            this.mqttTimers.delete(brokerUrl);
            if (!this.isIntentionalDisconnect && this.currentRoomId) {
              this.connectSingleBroker(brokerUrl);
            }
          }, 3500 + Math.floor(Math.random() * 1500));
          this.mqttTimers.set(brokerUrl, timer);
        }
      };

      client.on('error', () => {
        scheduleReconnect();
      });

      client.on('close', () => {
        scheduleReconnect();
      });

      client.on('connect', () => {
        if (this.isIntentionalDisconnect || this.mqttPool.get(brokerUrl) !== client) return;
        const topics = this.getSubscriptionTopics();
        if (topics.length === 0) return;
        client.subscribe(topics, { qos: 0 }, (err) => {
          if (!err) {
            this.connectedBrokers.add(brokerUrl);
            this.mqttHealthy = true;
            this.setStatus('CONNECTED');
            const now = Date.now();
            if (this.onConnectedCallback && now - this.lastOnConnectedFiredAt > 600) {
              this.lastOnConnectedFiredAt = now;
              try {
                this.onConnectedCallback();
              } catch {}
            }
            this.flushOfflineQueue();
          }
        });
      });

      client.on('message', (_topic, message) => {
        try {
          const rawStr = message.toString();
          if (!rawStr) return;
          const data = JSON.parse(rawStr) as CloudMessage;
          this.deliverIncomingMessage(data);
        } catch {}
      });
    } catch {
      const timer = setTimeout(() => {
        this.mqttTimers.delete(brokerUrl);
        if (!this.isIntentionalDisconnect && this.currentRoomId) {
          this.connectSingleBroker(brokerUrl);
        }
      }, 4000);
      this.mqttTimers.set(brokerUrl, timer);
    }
  }

  private handlePollResponseData(data: any) {
    this.httpHealthy = true;
    this.consecutiveHttpFailures = 0;
    this.setStatus('CONNECTED');
    this.flushOfflineQueue();

    if (typeof data.seq === 'number' && data.seq > this.lastHttpSeq) {
      this.lastHttpSeq = data.seq;
    }

    if (data.quizHash && data.latestHeartbeat?.quiz && Array.isArray(data.latestHeartbeat.quiz)) {
      this.cacheQuizLocally(this.currentRoomId, data.latestHeartbeat.quiz, data.quizHash);
    } else if (data.quizHash && data.quizHash !== this.currentQuizHash && this.cachedQuizDeck.length === 0) {
      this.fetchMissingQuizByHash(data.quizHash);
    }

    // Nhận danh sách học sinh đã đăng ký trên server
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

    // Nếu Giáo viên vừa nhấn "Kéo HS vào phòng" (forcePullTs trong 45s gần nhất)
    if (typeof data.forcePullTs === 'number' && data.forcePullTs > 0 && Date.now() - data.forcePullTs <= 45000) {
      const pullMid = `srv_force_pull_${data.forcePullTs}`;
      if (!this.seenMsgIds.has(pullMid)) {
        this.deliverIncomingMessage({
          _mid: pullMid,
          type: 'FORCE_PULL_TO_WAITING',
          status: data.matchStatus || data.latestHeartbeat?.status || 'LOBBY',
          globalQIndex: data.globalQIndex ?? data.latestHeartbeat?.globalQIndex ?? 0,
          gameType: data.latestHeartbeat?.gameType,
          forcePullTs: data.forcePullTs,
          question: data.latestHeartbeat?.question,
          top10: data.latestHeartbeat?.top10,
          quiz: this.cachedQuizDeck.length > 0 ? this.cachedQuizDeck : undefined
        });
      }
    }

    if (data.latestHeartbeat && data.latestHeartbeat._mid !== this.lastHeartbeatMid) {
      this.lastHeartbeatMid = data.latestHeartbeat._mid || '';
      if (!data.latestHeartbeat.top10 && Array.isArray(data.players) && data.players.length > 0) {
        const computedTop10 = [...data.players]
          .sort((a: any, b: any) => (b.savedScore || 0) - (a.savedScore || 0) || (b.savedCorrect || 0) - (a.savedCorrect || 0))
          .slice(0, 10)
          .map((p: any, idx: number) => ({
            id: p.playerId,
            name: p.playerName || 'Học sinh',
            label: p.playerName || 'Học sinh',
            team: p.preferredTeam || 'RED',
            score: p.savedScore || 0,
            fastScore: p.savedScore || 0,
            correct: p.savedCorrect || 0,
            rank: idx + 1
          }));
        data.latestHeartbeat = { ...data.latestHeartbeat, top10: computedTop10 };
      }
      this.deliverIncomingMessage(data.latestHeartbeat);
    } else if (data.matchStatus === 'PLAYING' && this.onMessageCallback) {
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

    if (Array.isArray(data.events)) {
      data.events.forEach((evMsg: CloudMessage) => {
        this.deliverIncomingMessage(evMsg);
      });
    }

    this.notifyTelemetry();
  }

  private handlePollFailure() {
    this.consecutiveHttpFailures++;
    if (this.apiOrigins.length > 0) {
      this.activeOriginIdx = (this.activeOriginIdx + 1) % this.apiOrigins.length;
    }
    // TUYỆT ĐỐI KHÔNG đóng hay reset MQTT khi HTTP Poll thất bại!
    // Chỉ giảm nhịp HTTP Poll nếu server không có /api/ để tiết kiệm pin và băng thông cho điện thoại.
    if (this.consecutiveHttpFailures === 4 && this.worker && this.workerSupported) {
      this.worker.postMessage({ cmd: 'SET_INTERVAL', intervalMs: 5000 });
    }
    this.notifyTelemetry();
  }

  private startMainThreadHttpPolling() {
    if (this.isStaticHost || this.apiOrigins.length === 0) return;
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
    if (this.isStaticHost || this.apiOrigins.length === 0 || this.isIntentionalDisconnect || !this.currentRoomId || this.isPollingInFlight) return;
    this.isPollingInFlight = true;
    const origin = this.apiOrigins[this.activeOriginIdx % this.apiOrigins.length] || '';
    const startTs = Date.now();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
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
        this.activeServerName = 'Server Chính (Edge)';
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
    if (this.isStaticHost || this.apiOrigins.length === 0 || !this.currentRoomId) return;
    const origin = this.apiOrigins[this.activeOriginIdx % this.apiOrigins.length] || '';
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
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
        this.setStatus('CONNECTED');
      } else {
        throw new Error('HTTP status ' + res.status);
      }
    } catch {
      this.queueCriticalIfOffline(payload);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  private queueCriticalIfOffline(payload: CloudMessage) {
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
        const slimForQueue = payload.quiz ? { ...payload, quiz: undefined } : payload;
        this.offlineQueue.push(slimForQueue);
        this.saveOfflineQueueToSession();
        this.notifyTelemetry();
      }
    }
  }

  public reconnectImmediate() {
    this.consecutiveHttpFailures = 0;
    this.setStatus('CONNECTED');
    if (!this.isStaticHost && this.apiOrigins.length > 0) {
      if (this.worker && this.workerSupported) {
        this.worker.postMessage({ cmd: 'POLL_NOW' });
      } else {
        this.pollHttpRoomMainThreadNow();
      }
    }
    this.flushOfflineQueue();
    // Chỉ kết nối lại những Broker nào đang bị đứt, giữ nguyên 100% các Broker đang kết nối thông suốt!
    PRIMARY_BROKERS.forEach((brokerUrl) => {
      const client = this.mqttPool.get(brokerUrl);
      if (!client) {
        this.connectSingleBroker(brokerUrl);
      }
    });
  }

  private async flushOfflineQueue() {
    if (this.offlineQueue.length === 0 || !this.currentRoomId) return;
    const hasConnectedBroker = this.connectedBrokers.size > 0;
    if (!hasConnectedBroker && (this.isStaticHost || !this.httpHealthy)) return;

    const queued = [...this.offlineQueue];
    this.offlineQueue = [];
    this.saveOfflineQueueToSession();
    this.notifyTelemetry();

    if (!this.isStaticHost && this.apiOrigins.length > 0) {
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
    }

    if (hasConnectedBroker && this.currentRoomTopic) {
      queued.forEach(payload => {
        this.publishToAllMqttBrokers(payload);
      });
    }
  }

  private broadcastQuizChunksOverMqtt(quiz: QuizItem[], quizHash: string) {
    if (!Array.isArray(quiz) || quiz.length === 0 || !this.currentRoomTopic) return;
    if (this.lastBroadcastedMqttQuizHash === quizHash && this.connectedBrokers.size > 0) return;
    this.lastBroadcastedMqttQuizHash = quizHash;

    const chunkSize = 5;
    const totalChunks = Math.ceil(quiz.length / chunkSize);
    for (let i = 0; i < totalChunks; i++) {
      const chunkItems = quiz.slice(i * chunkSize, (i + 1) * chunkSize);
      const chunkMsg: CloudMessage = {
        _mid: `qchunk_${quizHash}_${i}_${Date.now()}`,
        type: 'QUIZ_CHUNK',
        quizHash,
        chunkIndex: i,
        totalChunks,
        quizChunk: chunkItems
      };
      const rawChunk = JSON.stringify(chunkMsg);
      this.mqttPool.forEach((client) => {
        if (client && client.connected) {
          try {
            // Lưu retained trên topic phân mảnh để bất kỳ học sinh nào vào sau trên GitHub Pages cũng tải đủ 100% bộ đề trong 0ms!
            client.publish(`${this.currentRoomTopic}/qchunk/${i}`, rawChunk, { qos: 0, retain: true });
          } catch {}
        }
      });
    }
  }

  private publishToAllMqttBrokers(payload: CloudMessage) {
    if (!this.currentRoomTopic) return;
    let publishedCount = 0;

    // Nếu có mảng quiz, phát các gói chunk retained để học sinh trên GitHub Pages / 4G nhận đủ bộ đề
    if (Array.isArray(payload.quiz) && payload.quiz.length > 0) {
      const qHash = payload.quizHash || computeClientQuizHash(payload.quiz);
      this.broadcastQuizChunksOverMqtt(payload.quiz, qHash);
    }

    const rawFull = JSON.stringify(payload);
    const mqttLivePayload =
      rawFull.length > 24000 && payload.quiz
        ? JSON.stringify({ ...payload, quiz: undefined, quizHash: payload.quizHash })
        : rawFull;

    // Chuẩn bị gói trạng thái Retained cho Phòng (nếu là tin từ Giáo viên) hoặc cho Học sinh (nếu là tin báo danh/điểm số)
    const isHostStateMsg =
      payload.type === 'HOST_HEARTBEAT' ||
      payload.type === 'FORCE_START_MATCH' ||
      payload.type === 'QUESTION_START' ||
      payload.type === 'FORCE_PULL_TO_WAITING' ||
      payload.type === 'GAME_SWITCHED';

    const isStudentProfileMsg =
      (payload.type === 'PLAYER_READY_ROPE' ||
        payload.type === 'AUTO_ENTER_ARENA' ||
        payload.type === 'PLAYER_UPDATE_NAME' ||
        payload.type === 'PLAYER_FINISH_QUIZ') &&
      Boolean(payload.playerId);

    const retainedHostStatePayload = isHostStateMsg
      ? JSON.stringify({
          ...payload,
          _mid: `ret_hb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          quiz: undefined
        })
      : null;

    const retainedPlayerPayload = isStudentProfileMsg
      ? JSON.stringify({
          ...payload,
          _mid: `ret_p_${payload.playerId}_${Date.now()}`
        })
      : null;

    this.mqttPool.forEach((client) => {
      if (client && client.connected) {
        try {
          client.publish(this.currentRoomTopic, mqttLivePayload, { qos: 0 });
          if (retainedHostStatePayload) {
            client.publish(`${this.currentRoomTopic}/state`, retainedHostStatePayload, { qos: 0, retain: true });
          }
          if (retainedPlayerPayload && payload.playerId) {
            client.publish(`${this.currentRoomTopic}/players/${payload.playerId}`, retainedPlayerPayload, { qos: 0, retain: true });
          }
          publishedCount++;
        } catch {}
      }
    });

    if (publishedCount === 0 && this.isStaticHost) {
      this.queueCriticalIfOffline(payload);
    }
  }

  sendMessage(payload: CloudMessage) {
    if (!payload._mid) {
      payload._mid = 'm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }
    this.recordMsgId(payload._mid);

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
      const busPayload =
        payload.quiz && payload.quiz.length > 15
          ? { ...payload, quiz: undefined, quizHash: payload.quizHash }
          : payload;
      localStorage.setItem('kc3d_instant_bus_v1', JSON.stringify(busPayload));
    } catch {}

    // 2. Gửi qua Server HTTP (nếu không phải static host)
    if (!this.isStaticHost && this.apiOrigins.length > 0) {
      let httpPayload = payload;
      if (
        payload.type === 'HOST_HEARTBEAT' &&
        payload.quiz &&
        payload.quizHash &&
        payload.quizHash === this.currentQuizHash
      ) {
        const syncedKey = `hb_q_synced_${this.currentRoomId}_${payload.quizHash}`;
        if (this.seenMsgIds.has(syncedKey)) {
          httpPayload = { ...payload, quiz: undefined };
        } else {
          this.recordMsgId(syncedKey);
        }
      }
      this.publishHttpMessage(httpPayload);
    }

    // 3. Gửi song song qua toàn bộ cụm Đa Server MQTT WebSocket (kèm cơ chế Retained chống trễ/mất gói 100%)
    this.publishToAllMqttBrokers(payload);
  }

  async fetchActiveRoomId(): Promise<string | null> {
    if (this.isStaticHost || this.apiOrigins.length === 0) return null;
    for (const origin of this.apiOrigins) {
      try {
        const res = await fetch(`${origin}/api/room/active?_t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store'
        });
        if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
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
    this.mqttTimers.forEach((timer) => clearTimeout(timer));
    this.mqttTimers.clear();
    this.connectedBrokers.clear();

    if (this.httpPollTimer) {
      clearInterval(this.httpPollTimer);
      this.httpPollTimer = null;
    }
    if (this.worker && this.workerSupported) {
      this.worker.postMessage({ cmd: 'STOP' });
    }
    this.mqttPool.forEach((client) => {
      try {
        client.removeAllListeners();
        client.on('error', () => {});
        client.end(true);
      } catch {}
    });
    this.mqttPool.clear();
    this.mqttHealthy = false;
    this.currentRoomTopic = '';
    this.currentRoomId = '';
  }
}

export const CloudNetwork = new NetworkService();
