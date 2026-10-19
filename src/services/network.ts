import mqtt, { MqttClient } from 'mqtt';
import { CloudMessage } from '../types';

export type NetworkConnStatus = 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';

const PRIMARY_BROKERS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt'
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
  
  private status: NetworkConnStatus = 'DISCONNECTED';
  private brokerIndex = 0;
  private offlineQueue: CloudMessage[] = [];
  private reconnectTimer: any = null;
  private isIntentionalDisconnect = false;

  constructor() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.localBus = new BroadcastChannel('tug_multi_v16_stream');
        this.localBus.onmessage = (ev) => {
          const data = ev.data as CloudMessage;
          if (data && data._mid && this.seenMsgIds.has(data._mid)) return;
          if (data && data._mid) this.recordMsgId(data._mid);
          if (this.onMessageCallback) {
            this.onMessageCallback(data);
          }
        };
      }
    } catch (e) {}

    // Instant cross-tab localStorage event sync fallback & auto-reconnect when device comes back online
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (ev) => {
        if (ev.key === 'kc3d_instant_bus_v1' && ev.newValue) {
          try {
            const data = JSON.parse(ev.newValue) as CloudMessage;
            if (data && data._mid && !this.seenMsgIds.has(data._mid)) {
              this.recordMsgId(data._mid);
              if (this.onMessageCallback) {
                this.onMessageCallback(data);
              }
            }
          } catch {}
        }
      });

      window.addEventListener('online', () => {
        if (!this.isIntentionalDisconnect && this.currentRoomId && this.status !== 'CONNECTED') {
          this.reconnectImmediate();
        }
      });
      window.addEventListener('offline', () => {
        this.setStatus('DISCONNECTED');
      });
    }
  }

  private setStatus(newStatus: NetworkConnStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      if (this.onStatusChangeCallback) {
        try {
          this.onStatusChangeCallback(newStatus);
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
    if (this.seenMsgQueue.length > 300) {
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
    this.currentRoomId = roomId;
    this.onMessageCallback = onMessage;
    if (onConnected) this.onConnectedCallback = onConnected;
    if (onStatusChange) this.onStatusChangeCallback = onStatusChange;

    const cleanRoom = String(roomId).replace(/[^a-zA-Z0-9]/g, '');
    this.currentRoomTopic = `thptmangthit_kc3d_${cleanRoom}`;

    this.initMqttClient();
  }

  private initMqttClient() {
    if (this.client) {
      try {
        this.client.end(true);
      } catch (e) {}
      this.client = null;
    }

    this.setStatus(this.status === 'CONNECTED' ? 'RECONNECTING' : 'RECONNECTING');

    const brokerUrl = PRIMARY_BROKERS[this.brokerIndex % PRIMARY_BROKERS.length];
    const clientId = 'kc3d_' + Math.random().toString(16).substring(2, 9);

    try {
      this.client = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 2000,
        keepalive: 30
      });

      this.client.on('connect', () => {
        if (!this.client || !this.currentRoomTopic) return;
        this.client.subscribe(this.currentRoomTopic, { qos: 0 }, (err) => {
          if (!err) {
            this.setStatus('CONNECTED');
            if (this.onConnectedCallback) {
              this.onConnectedCallback();
            }
            this.flushOfflineQueue();
          }
        });
      });

      this.client.on('reconnect', () => {
        this.setStatus('RECONNECTING');
      });

      this.client.on('close', () => {
        if (!this.isIntentionalDisconnect && this.status === 'CONNECTED') {
          this.setStatus('RECONNECTING');
        }
      });

      this.client.on('error', (_err) => {
        if (!this.isIntentionalDisconnect) {
          this.setStatus('RECONNECTING');
          this.switchBrokerFallback();
        }
      });

      this.client.on('message', (_topic, message) => {
        try {
          const data = JSON.parse(message.toString()) as CloudMessage;
          if (data._mid && this.seenMsgIds.has(data._mid)) return;
          if (data._mid) this.recordMsgId(data._mid);
          if (this.onMessageCallback) {
            this.onMessageCallback(data);
          }
        } catch (e) {}
      });
    } catch (e) {
      this.setStatus('RECONNECTING');
      this.switchBrokerFallback();
    }
  }

  private switchBrokerFallback() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.isIntentionalDisconnect && this.currentRoomId) {
        this.brokerIndex++;
        this.initMqttClient();
      }
    }, 2500);
  }

  public reconnectImmediate() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.initMqttClient();
  }

  private flushOfflineQueue() {
    if (this.offlineQueue.length === 0) return;
    const queued = [...this.offlineQueue];
    this.offlineQueue = [];
    queued.forEach(payload => {
      this.sendMessage(payload);
    });
  }

  sendMessage(payload: CloudMessage) {
    if (!payload._mid) {
      payload._mid = 'm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    }
    this.recordMsgId(payload._mid);

    // Send via BroadcastChannel + localStorage storage event for 0-latency same-device sync
    if (this.localBus) {
      try {
        this.localBus.postMessage(payload);
      } catch (e) {}
    }
    try {
      localStorage.setItem('kc3d_instant_bus_v1', JSON.stringify(payload));
    } catch (e) {}

    // If connected to MQTT, publish immediately
    if (this.client && this.client.connected && this.currentRoomTopic) {
      try {
        const raw = JSON.stringify(payload);
        this.client.publish(this.currentRoomTopic, raw, { qos: 0 });
      } catch (e) {
        this.offlineQueue.push(payload);
      }
    } else {
      // If currently reconnecting or connecting, queue critical messages so student join & name are NEVER lost
      const isCritical = [
        'PULL_CORRECT',
        'FREEZE_WRONG',
        'AUTO_ENTER_ARENA',
        'PLAYER_READY_ROPE',
        'ENTER_CONFIRMED',
        'QUESTION_START',
        'GAME_SWITCH',
        'GAME_SWITCHED'
      ].includes(payload.type);
      if (isCritical) {
        if (this.offlineQueue.length < 100) {
          this.offlineQueue.push(payload);
        }
      }
    }
  }

  disconnect() {
    this.isIntentionalDisconnect = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.client) {
      try {
        this.client.end(true);
      } catch (e) {}
      this.client = null;
    }
    this.setStatus('DISCONNECTED');
    this.currentRoomTopic = '';
    this.currentRoomId = '';
    this.offlineQueue = [];
  }
}

export const CloudNetwork = new NetworkService();
