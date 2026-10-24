import mqtt, { MqttClient } from 'mqtt';
import { CloudMessage } from '../types';

export type NetworkConnStatus = 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';

const PRIMARY_BROKERS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt',
  'wss://test.mosquitto.org:8081/mqtt'
];

class NetworkService {
  private client: MqttClient | null = null;
  private currentRoomTopic = '';
  private currentRoomId = '';
  private seenMsgIds = new Set<string>();
  private seenMsgQueue: string[] = [];
  private localBus: BroadcastChannel | null = null;
  private onMessageCallback: ((data: CloudMessage) => void) | null = null;
  private onConnectedCallback: (() => void) | null = null;
  private onStatusChangeCallback: ((status: NetworkConnStatus) => void) | null = null;

  private status: NetworkConnStatus = 'CONNECTED';
  private brokerIndex = 0;
  private offlineQueue: CloudMessage[] = [];
  private reconnectTimer: any = null;
  private httpPollTimer: any = null;
  private lastHttpSeq = 0;
  private lastHeartbeatMid = '';
  private httpHealthy = true;
  private consecutiveHttpFailures = 0;
  private isIntentionalDisconnect = false;
  private isPollingInFlight = false;

  constructor() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.localBus = new BroadcastChannel('tug_multi_v16_stream');
        this.localBus.onmessage = (ev) => {
          const data = ev.data as CloudMessage;
          this.deliverIncomingMessage(data);
        };
      }
    } catch (e) {}

    // Instant cross-tab localStorage event sync fallback & auto-reconnect when device comes back online or wakes up
    if (typeof window !== 'undefined') {
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
          this.pollHttpRoomNow();
          if (!this.httpHealthy && (!this.client || !this.client.connected)) {
            this.initMqttClient();
          }
        }
      });
    }
  }

  private deliverIncomingMessage(data: CloudMessage | null | undefined) {
    if (!data || !data.type) return;
    if (data._mid) {
      if (this.seenMsgIds.has(data._mid)) return;
      this.recordMsgId(data._mid);
    }
    if (this.onMessageCallback) {
      try {
        this.onMessageCallback(data);
      } catch (e) {}
    }
  }

  private setStatus(newStatus: NetworkConnStatus) {
    // Nếu kênh HTTP cùng tên miền đang hoạt động tốt thì luôn giữ trạng thái CONNECTED để học sinh yên tâm làm bài
    const effectiveStatus: NetworkConnStatus =
      newStatus !== 'CONNECTED' && this.httpHealthy && (typeof navigator === 'undefined' || navigator.onLine !== false)
        ? 'CONNECTED'
        : newStatus;

    if (this.status !== effectiveStatus) {
      this.status = effectiveStatus;
      if (this.onStatusChangeCallback) {
        try {
          this.onStatusChangeCallback(effectiveStatus);
        } catch (e) {}
      }
    }
  }

  public getStatus(): NetworkConnStatus {
    return this.status;
  }

  private recordMsgId(mid: string) {
    this.seenMsgIds.add(mid);
    this.seenMsgQueue.push(mid);
    if (this.seenMsgQueue.length > 5000) {
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
    }

    this.httpHealthy = true;
    this.consecutiveHttpFailures = 0;
    this.setStatus('CONNECTED');

    // Khởi chạy kênh HTTP Server cùng tên miền 100% xuyên tường lửa;
    // Chỉ kích hoạt MQTT dự phòng nếu chạy trên môi trường tĩnh không có backend HTTP (như GitHub Pages)
    this.startHttpPolling();
    if (typeof window !== 'undefined' && /github\.io$/i.test(window.location.hostname)) {
      this.initMqttClient();
    }

    // Đọc ngay dữ liệu đồng bộ trực tiếp trong localStorage nếu cùng thiết bị
    try {
      const localSaved = localStorage.getItem(`kc3d_live_sync_${cleanRoom}`);
      if (localSaved) {
        const parsed = JSON.parse(localSaved);
        if (parsed && parsed.quiz) {
          setTimeout(() => {
            this.deliverIncomingMessage({
              type: 'HOST_HEARTBEAT',
              gameType: parsed.gameType,
              status: parsed.status,
              globalQIndex: parsed.globalQIndex,
              question: parsed.question,
              quiz: parsed.quiz,
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
      }, 30);
    }
  }

  private startHttpPolling() {
    if (this.httpPollTimer) {
      clearInterval(this.httpPollTimer);
      this.httpPollTimer = null;
    }
    this.pollHttpRoomNow();
    this.httpPollTimer = setInterval(() => {
      this.pollHttpRoomNow();
    }, 750);
  }

  private async pollHttpRoomNow() {
    if (this.isIntentionalDisconnect || !this.currentRoomId || this.isPollingInFlight) return;
    this.isPollingInFlight = true;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 4000) : null;
    try {
      const res = await fetch(
        `/api/room/${encodeURIComponent(this.currentRoomId)}/poll?since=${this.lastHttpSeq}&hb=${encodeURIComponent(this.lastHeartbeatMid)}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
          signal: controller ? controller.signal : undefined
        }
      );
      if (res.ok) {
        const data = await res.json();
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

        // Nhận danh sách học sinh đã đăng ký trên server (đảm bảo Host luôn nhận đủ 100% học sinh)
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

        // Nhận các sự kiện tức thời
        if (Array.isArray(data.events)) {
          data.events.forEach((evMsg: CloudMessage) => {
            this.deliverIncomingMessage(evMsg);
          });
        }

        // Nhận nhịp tim mới nhất của Host
        if (data.latestHeartbeat && data.latestHeartbeat._mid !== this.lastHeartbeatMid) {
          this.lastHeartbeatMid = data.latestHeartbeat._mid || '';
          this.deliverIncomingMessage(data.latestHeartbeat);
        }
      } else {
        this.consecutiveHttpFailures++;
        if (this.consecutiveHttpFailures >= 3 && !this.client) {
          this.initMqttClient();
        }
      }
    } catch {
      this.consecutiveHttpFailures++;
      if (this.consecutiveHttpFailures >= 3 && !this.client) {
        this.initMqttClient();
      }
      if (this.consecutiveHttpFailures >= 18 && (!this.client || !this.client.connected)) {
        this.httpHealthy = false;
        this.setStatus('RECONNECTING');
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      this.isPollingInFlight = false;
    }
  }

  private async publishHttpMessage(payload: CloudMessage) {
    if (!this.currentRoomId) return;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 4000) : null;
    try {
      const res = await fetch(`/api/room/${encodeURIComponent(this.currentRoomId)}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      });
      if (res.ok) {
        this.httpHealthy = true;
        this.consecutiveHttpFailures = 0;
        if (this.status !== 'CONNECTED') {
          this.setStatus('CONNECTED');
        }
      }
    } catch {
      // Nếu rớt gói tin quan trọng, lưu vào hàng đợi gửi lại
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
          this.offlineQueue.push(payload);
        }
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Đóng kết nối MQTT an toàn: Hủy các listener dữ liệu ('connect', 'message', 'close')
   * nhưng luôn giữ 1 listener 'error' rỗng để ngăn EventEmitter ném lỗi Uncaught "connack timeout".
   */
  private safeCloseMqttClient() {
    if (!this.client) return;
    const oldClient = this.client;
    this.client = null;
    try {
      oldClient.removeAllListeners('connect');
      oldClient.removeAllListeners('message');
      oldClient.removeAllListeners('close');
      oldClient.removeAllListeners('reconnect');
      oldClient.removeAllListeners('offline');
      oldClient.removeAllListeners('error');
      // Bắt buộc giữ no-op error listener để mqtt.js không bao giờ ném Uncaught Error: connack timeout
      oldClient.on('error', () => {});
      oldClient.end(true);
    } catch (e) {}
  }

  private initMqttClient() {
    this.safeCloseMqttClient();

    const brokerUrl = PRIMARY_BROKERS[this.brokerIndex % PRIMARY_BROKERS.length];
    const clientId = 'kc3d_' + Math.random().toString(16).substring(2, 10);

    try {
      const client = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 15000,
        reconnectPeriod: 0, // Tắt auto-reconnect nội bộ của mqtt.js để quản lý chủ động và không bị connack timeout
        keepalive: 30
      });
      this.client = client;

      // Đăng ký trình bắt lỗi ngay lập tức để không bao giờ rò rỉ ngoại lệ connack timeout ra toàn cục
      client.on('error', (_err) => {
        if (!this.isIntentionalDisconnect && !this.httpHealthy) {
          this.switchBrokerFallback();
        }
      });

      client.on('connect', () => {
        if (!this.client || this.client !== client || !this.currentRoomTopic) return;
        client.subscribe(this.currentRoomTopic, { qos: 0 }, (err) => {
          if (!err) {
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
        } catch (e) {}
      });
    } catch (e) {
      if (!this.httpHealthy) {
        this.switchBrokerFallback();
      }
    }
  }

  private switchBrokerFallback() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.httpHealthy) return;
    const delay = 6000;
    this.reconnectTimer = setTimeout(() => {
      if (!this.isIntentionalDisconnect && this.currentRoomId && !this.httpHealthy) {
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
    this.pollHttpRoomNow();
    this.flushOfflineQueue();
    if (!this.httpHealthy && (!this.client || !this.client.connected)) {
      this.initMqttClient();
    }
  }

  private flushOfflineQueue() {
    if (this.offlineQueue.length === 0) return;
    const queued = [...this.offlineQueue];
    this.offlineQueue = [];
    queued.forEach(payload => {
      this.publishHttpMessage(payload);
      if (this.client && this.client.connected && this.currentRoomTopic) {
        try {
          this.client.publish(this.currentRoomTopic, JSON.stringify(payload), { qos: 0 });
        } catch {}
      }
    });
  }

  sendMessage(payload: CloudMessage) {
    if (!payload._mid) {
      payload._mid = 'm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }
    this.recordMsgId(payload._mid);

    // 1. Gửi tức thì qua BroadcastChannel + localStorage (0ms trên cùng thiết bị)
    if (this.localBus) {
      try {
        this.localBus.postMessage(payload);
      } catch (e) {}
    }
    try {
      localStorage.setItem('kc3d_instant_bus_v1', JSON.stringify(payload));
    } catch (e) {}

    // 2. Gửi qua Server HTTP cùng tên miền (100% không bị chặn bởi tường lửa hay rớt kết nối 4G)
    this.publishHttpMessage(payload);

    // 3. Gửi qua MQTT WebSocket
    if (this.client && this.client.connected && this.currentRoomTopic) {
      try {
        const raw = JSON.stringify(payload);
        this.client.publish(this.currentRoomTopic, raw, { qos: 0 });
      } catch (e) {}
    }
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
    this.safeCloseMqttClient();
    this.currentRoomTopic = '';
    this.currentRoomId = '';
    this.offlineQueue = [];
  }
}

export const CloudNetwork = new NetworkService();

