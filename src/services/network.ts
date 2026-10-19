import mqtt, { MqttClient } from 'mqtt';
import { CloudMessage } from '../types';

const BROKER_URLS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
  'wss://broker.emqx.io:8084/mqtt'
];

class NetworkService {
  private activeClients: MqttClient[] = [];
  private currentRoomTopic = '';
  private seenMsgIds = new Set<string>();
  private localBus: BroadcastChannel | null = null;
  private onMessageCallback: ((data: CloudMessage) => void) | null = null;

  constructor() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.localBus = new BroadcastChannel('tug_multi_v15');
        this.localBus.onmessage = (ev) => {
          const data = ev.data as CloudMessage;
          if (data && data._mid && this.seenMsgIds.has(data._mid)) return;
          if (data && data._mid) this.seenMsgIds.add(data._mid);
          if (this.onMessageCallback) {
            this.onMessageCallback(data);
          }
        };
      }
    } catch (e) {}
  }

  connect(
    roomId: string,
    onMessage: (data: CloudMessage) => void,
    onConnected?: () => void
  ) {
    this.disconnect();
    this.onMessageCallback = onMessage;
    const cleanRoom = String(roomId).replace(/[^a-zA-Z0-9]/g, '');
    this.currentRoomTopic = `thptmangthit_kc3d_${cleanRoom}`;
    let connectedOnce = false;

    BROKER_URLS.forEach((url) => {
      try {
        const client = mqtt.connect(url, {
          clientId: 'kc3d_' + Math.random().toString(16).substring(2, 10),
          clean: true,
          connectTimeout: 4000,
          reconnectPeriod: 1500
        });

        client.on('connect', () => {
          client.subscribe(this.currentRoomTopic, { qos: 0 }, (err) => {
            if (!err && !connectedOnce) {
              connectedOnce = true;
              if (onConnected) onConnected();
            }
          });
        });

        client.on('message', (_topic, message) => {
          try {
            const data = JSON.parse(message.toString()) as CloudMessage;
            if (data._mid && this.seenMsgIds.has(data._mid)) return;
            if (data._mid) this.seenMsgIds.add(data._mid);
            if (this.onMessageCallback) {
              this.onMessageCallback(data);
            }
          } catch (e) {}
        });

        this.activeClients.push(client);
      } catch (err) {}
    });
  }

  sendMessage(payload: CloudMessage) {
    payload._mid = 'm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    this.seenMsgIds.add(payload._mid);
    const raw = JSON.stringify(payload);

    this.activeClients.forEach((c) => {
      if (c && c.connected && this.currentRoomTopic) {
        try {
          c.publish(this.currentRoomTopic, raw, { qos: 0 });
        } catch (e) {}
      }
    });

    if (this.localBus) {
      try {
        this.localBus.postMessage(payload);
      } catch (e) {}
    }
  }

  disconnect() {
    this.activeClients.forEach((c) => {
      try {
        c.end(true);
      } catch (e) {}
    });
    this.activeClients = [];
    this.currentRoomTopic = '';
  }
}

export const CloudNetwork = new NetworkService();
