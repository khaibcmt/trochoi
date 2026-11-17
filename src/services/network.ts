import mqtt, { MqttClient } from 'mqtt';
import { CloudMessage, QuizItem } from '../types';
import { isSensitiveCommand, signCommandSync } from '../utils/commandSign';
import { failoverBackoffMs } from '../utils/netTiming';

export interface BrokerEpochInfo {
  brokerId: number;
  epoch: number;
}

/**
 * Đợt 8 (4C.1): quyết định THUẦN về epoch broker — HS chỉ nhận epoch của host khi nó
 * MỚI hơn epoch đang giữ (epoch lớn hơn, hoặc bằng epoch nhưng brokerId khác — host
 * đổi broker luôn tăng epoch nên trường hợp bằng-epoch-khác-broker chỉ là lưới an
 * toàn). Epoch cũ hơn (tin retained "ma" trên broker cũ) bị bỏ qua.
 */
export function shouldAdoptBrokerEpoch(
  current: BrokerEpochInfo | null | undefined,
  incoming: BrokerEpochInfo | null | undefined
): boolean {
  if (!incoming || typeof incoming.brokerId !== 'number' || typeof incoming.epoch !== 'number') {
    return false;
  }
  if (!current) return true;
  if (incoming.epoch > current.epoch) return true;
  if (incoming.epoch === current.epoch && incoming.brokerId !== current.brokerId) return true;
  return false;
}

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
  // Đợt 3 (2.3): tiến độ ghép đề phía nhận — đã nhận quizChunksReceived/quizChunksTotal gói
  // của bộ đề đang ghép dở (0/0 = không có bộ đề nào đang ghép dở).
  quizChunksReceived: number;
  quizChunksTotal: number;
  // Đợt 3 (2.3): lỗi publish gần nhất (chunk/state) — publish thất bại KHÔNG còn im lặng nữa,
  // lỗi nổi lên telemetry này và qua callback onPublishError để phía host biết phát đề hỏng.
  lastPublishError: string | null;
  publishErrorCount: number;
}

export interface PublishErrorInfo {
  context: string;
  message: string;
  at: number;
}

/**
 * Đợt 5 (4B.4): QoS 1 (broker xác nhận đã nhận) cho các TIN SỐNG CÒN — đáp án của HS
 * (PULL_CORRECT / FREEZE_WRONG và các tin vào phòng / resync tương đương), trạng thái
 * phòng của host. Giữ QoS 0 cho nhịp tim (HOST_HEARTBEAT), PLAYER_PING và tin feed/drama
 * (rớt 1 gói vô hại vì gói sau bù ngay). PLAYER_OFFLINE do Last-Will phát cũng QoS 1.
 */
export const QOS1_MESSAGE_TYPES = new Set<string>([
  'PULL_CORRECT',
  'FREEZE_WRONG',
  'PLAYER_READY_ROPE',
  'AUTO_ENTER_ARENA',
  'PLAYER_FINISH_QUIZ',
  'PLAYER_UPDATE_NAME',
  'RESYNC_REQUEST',
  'RESYNC_STATE',
  'PLAYER_OFFLINE',
  'QUIZ_CHUNK_REQUEST',
  // HOST_HEARTBEAT cố ý KHÔNG nằm trong danh sách này: nhịp tim phát 1,2s/lần giữ QoS 0
  // (rớt 1 nhịp vô hại); chỉ BẢN RETAINED state của nó trên …/state mới đi QoS 1.
  'FORCE_START_MATCH',
  'QUESTION_START',
  // Lệnh Tạm dừng / Tiếp tục theo câu: sống còn cho đồng hồ của cả lớp (HS đông
  // cứng / chạy tiếp theo đúng gói này) — mất gói là lệch trạng thái dừng.
  'PAUSE_TOGGLE',
  'MATCH_START',
  'FORCE_PULL_TO_WAITING',
  'GAME_SWITCHED',
  'ENTER_CONFIRMED'
]);

export function qosForMessageType(type: string | undefined | null): 0 | 1 {
  return type && QOS1_MESSAGE_TYPES.has(type) ? 1 : 0;
}

// Đợt 3 (2.3): ngân sách byte cho MỖI chunk đề sau khi JSON.stringify — đặt 180KB, trừ hao
// an toàn so với giới hạn gói ~256KB của các broker MQTT công cộng.
export const QUIZ_CHUNK_BUDGET_BYTES = 180 * 1024;
// Ngưỡng an toàn (ký tự serialized) cho gói MQTT đơn — giữ nguyên mốc 24.000 đã dùng trước
// đây, nay áp cho CẢ question (câu chứa ảnh lớn) chứ không chỉ riêng mảng quiz.
export const MQTT_SAFE_PAYLOAD_CHARS = 24000;
// Đợt 3 (2.3): HS chờ bấy lâu sau gói chunk gần nhất mà vẫn thiếu gói thì xin phát lại,
// tối đa bấy nhiêu lần cho mỗi quizHash (chống vòng lặp xin vô hạn).
export const QUIZ_CHUNK_REQUEST_DELAY_MS = 3500;
export const QUIZ_CHUNK_REQUEST_MAX_ATTEMPTS = 5;

/** Độ dài byte UTF-8 thật của chuỗi serialized (base64 là ASCII nên = số ký tự; chữ Việt > 1 byte/ký tự). */
export function serializedByteLength(str: string): number {
  try {
    return new TextEncoder().encode(str).length;
  } catch {
    return str.length;
  }
}

/**
 * Dựng 1 gói QUIZ_CHUNK đúng định dạng hiện tại (topic retained …/qchunk/<i> ở phía publish,
 * header quizHash/chunkIndex/totalChunks giữ nguyên để phía nhận cũ vẫn hiểu).
 * chunkKind chỉ là trường MỞ RỘNG tuỳ chọn: vắng mặt = chunk của cả bộ đề như trước.
 */
export function buildQuizChunkMessage(
  quizHash: string,
  chunkIndex: number,
  totalChunks: number,
  items: QuizItem[],
  chunkKind?: 'QUIZ' | 'SINGLE_QUESTION',
  qIndex?: number,
  midSuffix?: string
): CloudMessage {
  const msg: CloudMessage = {
    _mid: `qchunk_${quizHash}_${chunkIndex}_${midSuffix !== undefined ? midSuffix : Date.now()}`,
    type: 'QUIZ_CHUNK',
    quizHash,
    chunkIndex,
    totalChunks,
    quizChunk: items
  };
  if (chunkKind && chunkKind !== 'QUIZ') msg.chunkKind = chunkKind;
  if (typeof qIndex === 'number') msg.qIndex = qIndex;
  return msg;
}

export interface PackedQuizChunk {
  chunkIndex: number;
  totalChunks: number;
  items: QuizItem[];
  message: CloudMessage;
  serialized: string;
  byteSize: number;
  /** Đúng 1 câu đơn lẻ đã vượt ngân sách — chunk riêng của nó được phép vượt ngân sách. */
  oversizedSingle: boolean;
}

/**
 * Đợt 3 (2.3): ĐÓNG GÓI ĐỀ THEO DUNG LƯỢNG thay cho chia cố định 5 câu/chunk.
 * Gom câu liên tiếp vào chunk cho tới khi serialized (JSON.stringify của đúng gói sẽ publish)
 * chạm ngân sách byte; 1 câu đơn lẻ vượt ngân sách thì thành chunk riêng của nó (không cắt
 * giữa câu). Ghép các chunk theo chunkIndex tăng dần cho lại đúng thứ tự đề gốc.
 * Khi đo thử, totalChunks được ước lượng ở mức tối đa (bằng số câu) nên kích thước đo luôn
 * >= kích thước gói thật — gói thật vì thế không bao giờ vượt ngân sách do header phình ra.
 */
export function packQuizIntoChunks(
  quiz: QuizItem[],
  quizHash: string,
  budgetBytes: number = QUIZ_CHUNK_BUDGET_BYTES
): PackedQuizChunk[] {
  if (!Array.isArray(quiz) || quiz.length === 0) return [];
  const measureBytes = (items: QuizItem[], idx: number): number =>
    serializedByteLength(
      JSON.stringify(buildQuizChunkMessage(quizHash, idx, quiz.length, items, 'QUIZ', undefined, '0'.repeat(13)))
    );

  const groups: QuizItem[][] = [];
  let current: QuizItem[] = [];
  for (const item of quiz) {
    if (current.length === 0) {
      current = [item];
      continue;
    }
    const candidate = [...current, item];
    if (measureBytes(candidate, groups.length) <= budgetBytes) {
      current = candidate;
    } else {
      groups.push(current);
      current = [item];
    }
  }
  if (current.length > 0) groups.push(current);

  const totalChunks = groups.length;
  return groups.map((items, i) => {
    const message = buildQuizChunkMessage(quizHash, i, totalChunks, items);
    const serialized = JSON.stringify(message);
    const byteSize = serializedByteLength(serialized);
    return {
      chunkIndex: i,
      totalChunks,
      items,
      message,
      serialized,
      byteSize,
      oversizedSingle: items.length === 1 && byteSize > budgetBytes
    };
  });
}

const PRIMARY_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
  'wss://mqtt.eclipseprojects.io:443/mqtt'
];

// Ưu tiên Retry kết nối lại vào Broker chính ít nhất 2 lần (mỗi lần 3.5s) trước khi chuyển Broker dự phòng
const MAX_RETRIES_PER_BROKER = 2;

/**
 * Chuẩn hóa đường dẫn chia sẻ cho Học sinh (QR Code & Copy Link):
 * Tự động chuyển ais-dev-* sang ais-pre-* (Shared App URL công khai) để điện thoại học sinh
 * hoặc Tab Ẩn Danh truy cập vào thẳng phòng thi mà không bị chặn xác thực Google.
 */
export function getStudentShareBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  let base = window.location.href.split('?')[0].split('#')[0];
  if (base.startsWith('file:')) {
    return 'https://khaibcmt.github.io/edu/';
  }
  if (base.includes('://ais-dev-')) {
    base = base.replace('://ais-dev-', '://ais-pre-');
  }
  return base;
}

/**
 * Hàm băm xác định broker duy nhất dựa trên Mã Phòng.
 * Cả Giáo viên và Học sinh trong cùng một phòng sẽ luôn trỏ về cùng một Broker duy nhất.
 */
export function hashRoomId(roomId: string): number {
  let h = 0;
  const s = String(roomId || '').trim();
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function computeClientQuizHash(quiz: QuizItem[] | undefined | null): string {
  if (!Array.isArray(quiz) || quiz.length === 0) return '';
  const firstQ = String(quiz[0]?.q || '').slice(0, 24);
  const lastQ = String(quiz[quiz.length - 1]?.q || '').slice(0, 24);
  return `q_${quiz.length}_${firstQ.length}_${lastQ.length}`;
}

/**
 * Web Worker chạy ngầm cho HTTP Polling khi chạy trên server chính
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
    const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;
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
  // KIẾN TRÚC ĐƯỜNG TRUYỀN (khôi phục cơ chế gốc 17/11/2026 theo chỉ đạo của
  // thầy, sau sự cố thực tế: bản 1-kết-nối sập ở câu 3 với 40 HS trong khi bản
  // gốc chạy 40 HS "tẹt ga"): MỖI MÁY GIỮ 2 KẾT NỐI MQTT SONG SONG — client
  // chính (theo Mã Phòng / epoch của host) + client MESH dự phòng ở broker
  // còn lại của cặp {emqx, hivemq}. Mọi publish đi qua mọi client đang sống,
  // mọi đường đều nhận (khử trùng _mid). Một broker chết/bị chặn thì đường
  // kia gánh ngay — đây là cơ chế chống nghẽn/vượt chặn chính của bản gốc.
  // Đợt gia cố tải trưa 17/11 từng cắt mesh để giảm số kết nối ở quy mô 200;
  // thực tế lớp học cho thấy đánh đổi đó gây sập ở quy mô 40 nên đã hoàn lại.
  // Các tối ưu KHÔNG thuộc đường truyền của đợt gia cố vẫn giữ: ping định
  // tuyến host-only (players/<id>), nhịp ping/hồ sơ thích ứng theo quy mô
  // phòng, HS không đăng ký players/+.
  private client: MqttClient | null = null;
  private secondaryClient: MqttClient | null = null;
  private activeBrokerUrl = '';
  private secondaryBrokerUrl = '';
  private failoverAttempt = 0;
  private currentBrokerRetries = 0;
  // Số lần failover LIÊN TIẾP chưa nối lại được — đầu vào cho backoff lũy thừa.
  private failoverStreak = 0;
  private pinnedBrokerIndex: number | null = null;
  private failoverTimer: any = null;
  private isConnectingMqtt = false;

  private currentRoomTopic = '';
  private currentRoomId = '';

  // Bộ lọc khử trùng lặp gói tin (Deduplication Guard)
  private seenMsgIds = new Set<string>();
  private seenMsgQueue: string[] = [];

  private localBus: BroadcastChannel | null = null;
  private worker: Worker | null = null;
  private workerSupported = false;

  private onMessageCallback: ((data: CloudMessage) => void) | null = null;
  private hostMessageListener: ((data: CloudMessage) => void) | null = null;
  private onConnectedCallback: (() => void) | null = null;
  private onStatusChangeCallback: ((status: NetworkConnStatus) => void) | null = null;
  private telemetryListeners = new Set<(t: NetworkTelemetry) => void>();

  private status: NetworkConnStatus = 'DISCONNECTED';
  private offlineQueue: CloudMessage[] = [];
  private httpPollTimer: any = null;
  private lastHttpSeq = 0;
  private lastHeartbeatMid = '';
  private currentQuizHash = '';
  private lastBroadcastedMqttQuizHash = '';
  private cachedQuizDeck: QuizItem[] = [];
  private incomingQuizChunks = new Map<string, Map<number, QuizItem[]>>();

  // Đợt 3 (2.3–2.4): phía HOST giữ bản đồ chunk đã đóng gói theo quizHash để phát lại đúng
  // gói HS xin (QUIZ_CHUNK_REQUEST); phía HS giữ tiến độ ghép đề + chống xin phát lại vô hạn.
  private broadcastChunksByHash = new Map<string, PackedQuizChunk[]>();
  private singleQuestionChunkByKey = new Map<string, CloudMessage>();
  private singleQuestionSentKeys = new Set<string>();
  private quizChunkProgressHash = '';
  private quizChunkProgressReceived = 0;
  private quizChunkProgressTotal = 0;
  private completedQuizChunkHashes = new Set<string>();
  private chunkRequestTimer: any = null;
  private chunkRequestAttemptsByHash = new Map<string, number>();
  private lastChunkResendAtByHash = new Map<string, number>();
  // Đợt 3 (2.3): lỗi publish chunk/state không còn bị nuốt — giữ ở đây để telemetry đọc.
  private publishErrorListeners = new Set<(info: PublishErrorInfo) => void>();
  private lastPublishError: string | null = null;
  private publishErrorCount = 0;

  // Theo dõi các topic đang giữ tin retained trên broker để xoá đúng khi reset phòng
  private retainedPlayerIdsByRoom = new Map<string, Set<string>>();
  private retainedChunkCountByTopic = new Map<string, number>();

  // Đợt 5 (4B.2): Last-Will của phía HS — khi máy HS rớt hẳn (hết pin, đóng tab cưỡng
  // bức, mất sóng), broker tự publish PLAYER_OFFLINE (QoS 1, retained) vào topic
  // …/players/<id> để host đóng băng lastSeen và bắt đầu đếm 90s giữ chỗ ngay,
  // thay vì phải chờ quá 15s không ping mới biết. Chỉ client CHÍNH mang will
  // (client phụ không đặt will để tránh will bắn 2 lần cho cùng 1 sự kiện rớt).
  private playerWill: { playerId: string; studentId?: string } | null = null;

  // Đợt 8 (4C): vai trò của phía đang dùng service này — 'HOST' là phía duy nhất quyết
  // định broker + ký lệnh; 'STUDENT' đi theo epoch của host, không tự failover độc lập
  // sau khi đã biết epoch. null = chưa rõ vai trò → hành vi cũ (tương thích ngược).
  private brokerRole: 'HOST' | 'STUDENT' | null = null;
  // Đợt 8 (4C.2): khoá phòng phía HOST dùng để ký lệnh điều khiển trong sendMessage.
  private roomKey: string | null = null;
  // Đợt 8 (4C.1) phía HOST: broker/epoch đang công bố (lưu localStorage theo phòng để
  // F5 không làm epoch nhảy lui). hostBrokerIdx = -1 nghĩa là chưa nối thành công lần nào.
  private hostBrokerIdx = -1;
  private hostBrokerEpochNum = 0;
  // Đợt 8 (4C.1) phía HS: epoch mới nhất đã nhận từ host; null = chưa vào phòng có host
  // (vẫn tự do kết nối/failover như cũ cho tới khi thấy epoch đầu tiên).
  private adoptedBrokerEpoch: BrokerEpochInfo | null = null;
  // Đợt 8 (4C.1): VAN AN TOÀN chống kẹt cứng — số chu kỳ failover bị "khoá" liên tiếp ở
  // broker của host; quá ngưỡng thì HS được DÒ sang broker kế tiếp để lắng nghe epoch
  // MỚI hơn (broker của host sập hẳn thì epoch mới chỉ nghe được ở broker khác). Dò
  // không thấy epoch mới hơn trong thời gian chờ thì quay về broker đã ghim.
  private gatedFailoverCycles = 0;
  private probeReturnTimer: any = null;

  private httpHealthy = true;
  private mqttHealthy = false;
  private consecutiveHttpFailures = 0;
  private isIntentionalDisconnect = false;
  private isPollingInFlight = false;
  private isFetchingQuizInFlight = false;
  private isStaticHost = false;
  private lastOnConnectedFiredAt = 0;

  private rttMs = 24;
  private activeServerName = 'Máy chủ phòng';
  private congestionMode: AntiCongestionMode = 'AUTO';
  private apiOrigins: string[] = [];
  private activeOriginIdx = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname || '';
      const proto = window.location.protocol || '';
      this.isStaticHost = /github\.io$/i.test(host) || proto === 'file:';

      if (this.isStaticHost) {
        this.apiOrigins = [];
        this.httpHealthy = false;
      } else if (window.location.origin && window.location.origin !== 'null') {
        const origins = [window.location.origin];
        if (window.location.origin.includes('://ais-dev-')) {
          origins.push(window.location.origin.replace('://ais-dev-', '://ais-pre-'));
        }
        this.apiOrigins = origins;
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
        // Sự kiện 'online' chỉ có nghĩa là máy có mạng trở lại, chưa có nghĩa đã nối được broker:
        // chỉ chuyển sang RECONNECTING, trạng thái CONNECTED do kết nối thật xác nhận sau.
        this.setStatus('RECONNECTING');
        if (!this.isIntentionalDisconnect && this.currentRoomId) {
          this.reconnectImmediate();
        }
      });

      window.addEventListener('offline', () => {
        this.setStatus('DISCONNECTED');
      });

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !this.isIntentionalDisconnect && this.currentRoomId) {
          this.reconnectImmediate();
        }
      });
    }
  }

  public setHostMessageListener(cb: ((data: CloudMessage) => void) | null) {
    this.hostMessageListener = cb;
  }

  /**
   * Đợt 8 (4C): khai báo vai trò của phía đang dùng service — App phía host gọi 'HOST',
   * StudentMobileView gọi 'STUDENT'. Vai trò quyết định: ai được failover tự do, ai ký
   * lệnh, ai công bố broker epoch.
   */
  public setBrokerRole(role: 'HOST' | 'STUDENT' | null) {
    this.brokerRole = role;
  }

  /** Đợt 8 (4C.2): phía HOST đặt khoá phòng để sendMessage tự ký các lệnh nhạy cảm. */
  public setRoomKey(key: string | null) {
    this.roomKey = key && key.length >= 32 ? key : null;
  }

  /** Epoch broker hiện tại (host: đang công bố; HS: đã nhận từ host) — phục vụ telemetry/test. */
  public getCurrentBrokerEpoch(): BrokerEpochInfo | null {
    if (this.brokerRole === 'HOST' && this.hostBrokerIdx >= 0) {
      return { brokerId: this.hostBrokerIdx, epoch: this.hostBrokerEpochNum };
    }
    return this.adoptedBrokerEpoch;
  }

  /**
   * Đợt 8 (4C.1) phía HOST: ghi nhận client chính vừa nối thành công vào broker idx.
   * Nếu khác broker đã công bố (hoặc lần đầu) thì TĂNG epoch và lưu theo phòng —
   * HS thấy epoch đổi sẽ chuyển broker theo. F5 cùng broker → giữ nguyên epoch.
   */
  private noteHostBrokerConnected(idx: number) {
    if (this.brokerRole !== 'HOST' || !this.currentRoomId) return;
    const storageKey = `kc3d_broker_epoch_${this.currentRoomId}`;
    let stored: BrokerEpochInfo | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.brokerId === 'number' && typeof parsed.epoch === 'number') {
          stored = parsed;
        }
      }
    } catch {}
    if (stored && stored.brokerId === idx) {
      this.hostBrokerIdx = idx;
      this.hostBrokerEpochNum = stored.epoch;
      return;
    }
    this.hostBrokerIdx = idx;
    this.hostBrokerEpochNum = (stored ? stored.epoch : 0) + 1;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ brokerId: idx, epoch: this.hostBrokerEpochNum } as BrokerEpochInfo)
      );
    } catch {}
  }

  /**
   * Đợt 8 (4C.1) phía HS: nhận broker epoch do host công bố (qua state/heartbeat).
   * Epoch mới hơn → ghim broker theo host, reset bộ đếm failover và nối LẠI cả hai
   * client về đúng broker đó (client phụ trỏ CÙNG broker với client chính).
   */
  private maybeAdoptBrokerEpoch(incoming: BrokerEpochInfo | null | undefined) {
    if (this.brokerRole !== 'STUDENT') return;
    if (!shouldAdoptBrokerEpoch(this.adoptedBrokerEpoch, incoming)) return;
    const be = incoming as BrokerEpochInfo;
    if (be.brokerId < 0 || be.brokerId >= PRIMARY_BROKERS.length) return;
    this.adoptedBrokerEpoch = { brokerId: be.brokerId, epoch: be.epoch };
    this.pinnedBrokerIndex = be.brokerId;
    this.failoverAttempt = 0;
    this.currentBrokerRetries = 0;
    this.gatedFailoverCycles = 0;
    if (this.probeReturnTimer) {
      clearTimeout(this.probeReturnTimer);
      this.probeReturnTimer = null;
    }
    if (!this.currentRoomId || this.isIntentionalDisconnect) return;
    const targetUrl = PRIMARY_BROKERS[be.brokerId];
    if (!this.client || !this.client.connected || this.activeBrokerUrl !== targetUrl) {
      this.connectSingleBrokerByRoom(this.currentRoomId, true);
    }
    this.notifyTelemetry();
  }

  /**
   * Đợt 5 (4B.2): phía HS đăng ký danh tính cho Last-Will TRƯỚC khi connect.
   * Gọi lại với null (phía host / khi rời phòng hẳn) để các client tạo sau không mang will.
   * Will chỉ áp cho các client chính tạo MỚI sau lời gọi này (client đang sống giữ will cũ
   * của nó tới khi tự reconnect — đúng hành vi MQTT, will không sửa được giữa chừng).
   */
  public setPlayerWill(will: { playerId: string; studentId?: string } | null) {
    this.playerWill = will && will.playerId ? { playerId: will.playerId, studentId: will.studentId } : null;
  }

  /** Dựng tuỳ chọn will cho client MQTT chính từ danh tính HS đã đăng ký (null nếu chưa có). */
  private buildPlayerWillOption():
    | { topic: string; payload: string; qos: 1; retain: boolean }
    | undefined {
    if (!this.playerWill || !this.currentRoomTopic) return undefined;
    const payload = JSON.stringify({
      type: 'PLAYER_OFFLINE',
      playerId: this.playerWill.playerId,
      studentId: this.playerWill.studentId,
      // ts để 0: thời điểm rớt thật do HOST tự đóng băng bằng đồng hồ của host lúc nhận
      // tin (payload will được soạn từ lúc connect nên không thể chứa giờ rớt thật).
      ts: 0
    } as CloudMessage);
    return {
      topic: `${this.currentRoomTopic}/players/${this.playerWill.playerId}`,
      payload,
      qos: 1,
      retain: true
    };
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

  public getActiveBrokerIndex(roomId?: string): number {
    if (this.activeBrokerUrl) {
      const idx = PRIMARY_BROKERS.indexOf(this.activeBrokerUrl);
      if (idx !== -1) return idx;
    }
    if (this.pinnedBrokerIndex !== null && this.pinnedBrokerIndex >= 0) {
      return this.pinnedBrokerIndex;
    }
    const targetRoom = roomId || this.currentRoomId;
    if (targetRoom) {
      return hashRoomId(targetRoom) % 2;
    }
    return 0;
  }

  public getTelemetry(): NetworkTelemetry {
    // Đếm kênh theo trạng thái SỐNG THẬT của từng client (socket .connected), không suy đoán
    const primaryLive = Boolean(this.client && this.client.connected);
    const secondaryLive = Boolean(this.secondaryClient && this.secondaryClient.connected);
    const mqttLive = primaryLive || secondaryLive;
    const httpLive = !this.isStaticHost && this.httpHealthy && this.apiOrigins.length > 0;
    const channels =
      (primaryLive ? 1 : 0) +
      (secondaryLive ? 1 : 0) +
      (httpLive ? 1 : 0) +
      (this.localBus ? 1 : 0);
    let brokerDisplayName = 'Đang kết nối...';
    if (this.activeBrokerUrl) {
      try {
        const u = new URL(this.activeBrokerUrl);
        const retryNote = this.currentBrokerRetries > 0 ? ` [Thử lại ${this.currentBrokerRetries}/${MAX_RETRIES_PER_BROKER}]` : '';
        brokerDisplayName = `MQTT #${this.getActiveBrokerIndex() + 1} (${u.hostname})${retryNote}`;
      } catch {
        brokerDisplayName = this.activeBrokerUrl;
      }
    }
    return {
      status: this.getStatus(),
      rttMs: this.rttMs,
      activeServerName: mqttLive ? brokerDisplayName : this.activeServerName,
      activeChannelsCount: channels,
      workerActive: this.workerSupported,
      congestionMode: this.congestionMode,
      queuedCount: this.offlineQueue.length,
      quizCached: this.cachedQuizDeck.length > 0,
      quizChunksReceived: this.quizChunkProgressReceived,
      quizChunksTotal: this.quizChunkProgressTotal,
      lastPublishError: this.lastPublishError,
      publishErrorCount: this.publishErrorCount
    };
  }

  /** Đợt 3 (2.3): đăng ký nhận thông báo mỗi khi publish chunk/state thất bại. */
  public onPublishError(cb: (info: PublishErrorInfo) => void): () => void {
    this.publishErrorListeners.add(cb);
    return () => {
      this.publishErrorListeners.delete(cb);
    };
  }

  /**
   * Đợt 3 (2.3): lỗi publish KHÔNG được im lặng — ghi vào telemetry + bắn cho mọi listener
   * đã đăng ký (phía host dùng để biết phát đề/gói trạng thái đã thất bại).
   */
  private reportPublishError(context: string, err: unknown) {
    const message = err instanceof Error ? err.message : String(err || 'unknown publish error');
    this.lastPublishError = `${context}: ${message}`;
    this.publishErrorCount++;
    const info: PublishErrorInfo = { context, message, at: Date.now() };
    this.publishErrorListeners.forEach(cb => {
      try {
        cb(info);
      } catch {}
    });
    this.notifyTelemetry();
  }

  /**
   * Publish 1 gói MQTT và BÁO LỖI nếu thất bại (ném đồng bộ hoặc callback báo lỗi của QoS 1)
   * thay cho try/catch nuốt lỗi như trước. Vẫn tiếp tục với các client còn lại khi 1 client lỗi.
   */
  private publishWithErrorReport(
    client: MqttClient,
    topic: string,
    payloadStr: string,
    opts: { qos: 0 | 1; retain?: boolean },
    context: string
  ) {
    try {
      client.publish(topic, payloadStr, opts, (err) => {
        if (err) this.reportPublishError(context, err);
      });
    } catch (err) {
      this.reportPublishError(context, err);
    }
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

    // Đợt 3 (2.4): chunk riêng 1 câu quá lớn — không phải chunk của cả bộ đề, chuyển thẳng
    // câu đó cho phía HS hiển thị (gắn vào đúng vị trí qIndex), không ghép vào bộ đề.
    if (data.chunkKind === 'SINGLE_QUESTION') {
      const singleQ = chunkItems[0];
      if (singleQ) {
        const singleMsg: CloudMessage = {
          type: 'QUIZ_SINGLE_QUESTION',
          quizHash: hash,
          qIndex: typeof data.qIndex === 'number' ? data.qIndex : undefined,
          globalQIndex: typeof data.qIndex === 'number' ? data.qIndex : undefined,
          question: singleQ
        };
        if (this.onMessageCallback) {
          try {
            this.onMessageCallback(singleMsg);
          } catch {}
        }
        if (this.hostMessageListener && this.hostMessageListener !== this.onMessageCallback) {
          try {
            this.hostMessageListener(singleMsg);
          } catch {}
        }
      }
      return;
    }

    // Bộ đề này đã ghép đủ trước đó (chunk retained phát lại / host phát lại trùng): bỏ qua,
    // tránh việc tiến độ ghép đề bị đếm lại từ đầu.
    if (this.completedQuizChunkHashes.has(hash)) return;

    let chunkMap = this.incomingQuizChunks.get(hash);
    if (!chunkMap) {
      chunkMap = new Map<number, QuizItem[]>();
      this.incomingQuizChunks.set(hash, chunkMap);
    }
    chunkMap.set(chunkIdx, chunkItems);

    // Đợt 3 (2.3): cập nhật TIẾN ĐỘ ghép đề để giao diện HS hiện "đã nhận x/y gói đề"
    this.quizChunkProgressHash = hash;
    this.quizChunkProgressReceived = chunkMap.size;
    this.quizChunkProgressTotal = totalChunks;
    this.notifyTelemetry();

    if (chunkMap.size >= totalChunks) {
      const fullQuiz: QuizItem[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const part = chunkMap.get(i);
        if (part) fullQuiz.push(...part);
      }
      this.completedQuizChunkHashes.add(hash);
      this.incomingQuizChunks.delete(hash);
      if (this.chunkRequestTimer) {
        clearTimeout(this.chunkRequestTimer);
        this.chunkRequestTimer = null;
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
      return;
    }

    // Chưa đủ gói: hẹn giờ xin phát lại các gói còn thiếu (có giới hạn số lần, xem hàm dưới)
    this.scheduleMissingChunkRequest(hash);
  }

  /**
   * Đợt 3 (2.3): sau QUIZ_CHUNK_REQUEST_DELAY_MS kể từ gói chunk gần nhất mà bộ đề vẫn chưa
   * đủ, HS gửi QUIZ_CHUNK_REQUEST { quizHash, missingChunks } xin host phát lại đúng gói thiếu.
   * Chống vòng lặp vô hạn: tối đa QUIZ_CHUNK_REQUEST_MAX_ATTEMPTS lần cho mỗi quizHash;
   * mỗi gói mới nhận được chỉ đặt lại đồng hồ chờ, không đặt lại số lần đã xin.
   */
  private scheduleMissingChunkRequest(hash: string) {
    if (this.chunkRequestTimer) {
      clearTimeout(this.chunkRequestTimer);
      this.chunkRequestTimer = null;
    }
    const attempts = this.chunkRequestAttemptsByHash.get(hash) || 0;
    if (attempts >= QUIZ_CHUNK_REQUEST_MAX_ATTEMPTS) return;
    this.chunkRequestTimer = setTimeout(() => {
      this.chunkRequestTimer = null;
      const chunkMap = this.incomingQuizChunks.get(hash);
      if (!chunkMap || this.completedQuizChunkHashes.has(hash)) return;
      const total = this.quizChunkProgressHash === hash ? this.quizChunkProgressTotal : 0;
      if (total <= 0 || chunkMap.size >= total) return;
      const missing: number[] = [];
      for (let i = 0; i < total; i++) {
        if (!chunkMap.has(i)) missing.push(i);
      }
      if (missing.length === 0) return;
      this.chunkRequestAttemptsByHash.set(hash, attempts + 1);
      this.sendMessage({
        type: 'QUIZ_CHUNK_REQUEST',
        quizHash: hash,
        missingChunks: missing
      });
      // Vẫn thiếu sau lần xin này thì hẹn lần xin tiếp theo (vẫn trong giới hạn số lần)
      this.scheduleMissingChunkRequest(hash);
    }, QUIZ_CHUNK_REQUEST_DELAY_MS);
  }

  /**
   * Đợt 3 (2.3): phía HOST nhận QUIZ_CHUNK_REQUEST — phát lại (QoS 1, retained) đúng các gói
   * được xin từ bản đồ chunk đã đóng gói theo quizHash. Chống bão phát lại: mỗi quizHash
   * tối thiểu 1 giây mới phát lại một lần, danh sách gói xin được khử trùng và giới hạn độ dài.
   * Máy HS không giữ bản đồ phát (chỉ giữ gói đang ghép dở) nên tự nhận lại yêu cầu của
   * chính mình cũng không phát lại được gì — vô hại.
   */
  private handleQuizChunkRequest(data: CloudMessage) {
    const hash = data.quizHash;
    if (!hash || !Array.isArray(data.missingChunks) || !this.currentRoomTopic) return;
    const packed = this.broadcastChunksByHash.get(hash);
    if (!packed || packed.length === 0) return;
    const now = Date.now();
    const lastAt = this.lastChunkResendAtByHash.get(hash) || 0;
    if (now - lastAt < 1000) return;
    this.lastChunkResendAtByHash.set(hash, now);

    const activeClients = [this.client, this.secondaryClient].filter(
      (c): c is MqttClient => Boolean(c && c.connected)
    );
    if (activeClients.length === 0) return;

    const wanted = Array.from(
      new Set(
        data.missingChunks.filter(
          (n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0
        )
      )
    ).slice(0, 200);
    wanted.forEach(idx => {
      const chunk = packed[idx];
      if (!chunk || chunk.chunkIndex !== idx) return;
      const resendMsg: CloudMessage = {
        ...chunk.message,
        _mid: `qchunk_${hash}_${idx}_${Date.now()}`
      };
      const rawChunk = JSON.stringify(resendMsg);
      activeClients.forEach(c => {
        this.publishWithErrorReport(
          c,
          `${this.currentRoomTopic}/qchunk/${idx}`,
          rawChunk,
          { qos: 1, retain: true },
          `QUIZ_CHUNK_RESEND ${idx}/${chunk.totalChunks} (${hash})`
        );
      });
    });
  }

  /**
   * BỘ LỌC KHỬ TRÙNG LẶP GÓI TIN (DEDUPLICATION GUARD)
   * Kiểm tra messageId (_mid); nếu đã từng xử lý gần đây thì bỏ qua ngay lập tức.
   */
  private deliverIncomingMessage(data: CloudMessage | null | undefined) {
    if (!data || !data.type) return;
    if (data.playerId) this.recordRetainedPlayerId(data.playerId);

    // Deduplication Guard: Khử trùng lặp gói tin tức thì
    if (data._mid) {
      if (this.seenMsgIds.has(data._mid)) {
        return; // Bỏ qua ngay, không kích hoạt hàm 2 lần
      }
      this.recordMsgId(data._mid);
    }

    // Đợt 8 (4C.1): phía HS đi theo broker epoch do host công bố trong state/heartbeat —
    // xử lý ở tầng mạng TRƯỚC khi chuyển tin lên trên để lần chuyển broker diễn ra ngay.
    if (data.brokerEpoch) {
      this.maybeAdoptBrokerEpoch(data.brokerEpoch);
    }

    if (data.type === 'QUIZ_CHUNK') {
      this.handleIncomingQuizChunk(data);
      return;
    }

    // Đợt 3 (2.3): host phát lại gói đề thiếu ngay tại tầng mạng (từ bản đồ chunk theo
    // quizHash), rồi vẫn chuyển tiếp tin cho callback phía trên như bình thường.
    if (data.type === 'QUIZ_CHUNK_REQUEST') {
      this.handleQuizChunkRequest(data);
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
    if (this.hostMessageListener && this.hostMessageListener !== this.onMessageCallback) {
      try {
        this.hostMessageListener(data);
      } catch {}
    }
  }

  private setStatus(newStatus: NetworkConnStatus) {
    // Tôn trọng trạng thái THẬT do nơi gọi xác nhận (nối thành công / đang nối lại / mất hẳn),
    // tuyệt đối không tự ép sang CONNECTED.
    if (this.status !== newStatus || newStatus === 'CONNECTED') {
      this.status = newStatus;
      if (this.onStatusChangeCallback) {
        try {
          this.onStatusChangeCallback(newStatus);
        } catch {}
      }
    }
    this.notifyTelemetry();
  }

  public getStatus(): NetworkConnStatus {
    if (this.isIntentionalDisconnect) return 'DISCONNECTED';
    // Socket MQTT đang sống là bằng chứng kết nối chắc chắn nhất
    if ((this.client && this.client.connected) || (this.secondaryClient && this.secondaryClient.connected)) {
      return 'CONNECTED';
    }
    // Không còn socket nào sống mà trạng thái lưu vẫn là CONNECTED:
    // chỉ tin cậy nếu kênh HTTP (không phải static host) vẫn đang khoẻ, ngược lại hạ xuống RECONNECTING.
    if (this.status === 'CONNECTED' && (this.isStaticHost || !this.httpHealthy)) {
      return 'RECONNECTING';
    }
    return this.status;
  }

  private fireOnConnectedIfDue() {
    if (!this.onConnectedCallback) return;
    const now = Date.now();
    if (now - this.lastOnConnectedFiredAt > 600) {
      this.lastOnConnectedFiredAt = now;
      try {
        this.onConnectedCallback();
      } catch {}
    }
  }

  private recordRetainedPlayerId(playerId?: string | null) {
    if (!playerId || !this.currentRoomId) return;
    let set = this.retainedPlayerIdsByRoom.get(this.currentRoomId);
    if (!set) {
      set = new Set<string>();
      this.retainedPlayerIdsByRoom.set(this.currentRoomId, set);
    }
    set.add(String(playerId));
  }

  private recordMsgId(mid: string) {
    this.seenMsgIds.add(mid);
    this.seenMsgQueue.push(mid);
    if (this.seenMsgQueue.length > 10000) {
      const old = this.seenMsgQueue.shift();
      if (old) this.seenMsgIds.delete(old);
    }
  }

  connect(
    roomId: string,
    onMessage: (data: CloudMessage) => void,
    onConnected?: () => void,
    onStatusChange?: (status: NetworkConnStatus) => void,
    pinnedBrokerIndex?: number
  ) {
    this.isIntentionalDisconnect = false;
    const cleanRoom = String(roomId || '12345').replace(/[^a-zA-Z0-9]/g, '') || '12345';
    const roomChanged = this.currentRoomId !== cleanRoom;
    this.currentRoomId = cleanRoom;
    this.currentRoomTopic = `thptmangthit_kc3d_${cleanRoom}`;
    this.onMessageCallback = onMessage;
    if (onConnected) this.onConnectedCallback = onConnected;
    if (onStatusChange) this.onStatusChangeCallback = onStatusChange;

    if (typeof pinnedBrokerIndex === 'number' && pinnedBrokerIndex >= 0 && pinnedBrokerIndex < PRIMARY_BROKERS.length) {
      this.pinnedBrokerIndex = pinnedBrokerIndex;
    }

    if (roomChanged) {
      this.lastHttpSeq = 0;
      this.lastHeartbeatMid = '';
      this.currentQuizHash = '';
      this.lastBroadcastedMqttQuizHash = '';
      this.cachedQuizDeck = [];
      this.incomingQuizChunks.clear();
      this.quizChunkProgressHash = '';
      this.quizChunkProgressReceived = 0;
      this.quizChunkProgressTotal = 0;
      this.completedQuizChunkHashes.clear();
      this.chunkRequestAttemptsByHash.clear();
      if (this.chunkRequestTimer) {
        clearTimeout(this.chunkRequestTimer);
        this.chunkRequestTimer = null;
      }
      this.failoverAttempt = 0;
      this.currentBrokerRetries = 0;
      // Đợt 8 (4C.1): phòng mới → quên epoch/broker đã công bố của phòng cũ; epoch của
      // phòng mới sẽ được học lại từ retained state/heartbeat đầu tiên của host phòng đó.
      this.adoptedBrokerEpoch = null;
      this.hostBrokerIdx = -1;
      this.hostBrokerEpochNum = 0;
    }

    try {
      const savedQueue = sessionStorage.getItem(`kc3d_offline_q_${cleanRoom}`);
      if (savedQueue) {
        const parsedQ = JSON.parse(savedQueue);
        if (Array.isArray(parsedQ) && parsedQ.length > 0) {
          this.offlineQueue = parsedQ;
        }
      }
    } catch {}

    const cachedQuiz = this.loadCachedQuizLocally(cleanRoom);
    this.consecutiveHttpFailures = 0;
    // Mới bắt đầu nối: chỉ báo CONNECTED khi đã có client thật đang sống, còn lại là RECONNECTING
    const anyClientLive = Boolean(
      (this.client && this.client.connected) || (this.secondaryClient && this.secondaryClient.connected)
    );
    this.setStatus(anyClientLive ? 'CONNECTED' : 'RECONNECTING');

    // 1. Khởi chạy luồng HTTP Polling nếu không phải static host
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

    // 2. Kết nối Broker chính theo Mã Phòng + Broker song song dự phòng (mesh
    // emqx + hivemq) — cơ chế gốc của thầy, khôi phục 17/11/2026 sau sự cố sập
    // ở câu 3 khi chỉ còn 1 đường truyền: hai đường luôn sống song song, một
    // đường chết thì đường kia gánh ngay, không có khoảng trống nối lại.
    this.connectSingleBrokerByRoom(cleanRoom, roomChanged);
    this.connectSecondaryMeshBroker(cleanRoom, roomChanged);

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

    // KHÔNG bắn onConnected theo hẹn giờ nữa: onConnected chỉ được bắn trong
    // connectSingleBrokerByRoom khi client chính thật sự connect + subscribe xong
    // (hoặc khi client chính đã nối sẵn từ trước và vẫn đang sống).
  }

  private getSubscriptionTopics(): string[] {
    if (!this.currentRoomTopic) return [];
    const topics = [
      this.currentRoomTopic,
      `${this.currentRoomTopic}/state`,
      `${this.currentRoomTopic}/qchunk/+`
    ];
    // Đợt GIA CỐ TẢI: topic players/+ chỉ HOST mới đăng ký. Trên topic này là
    // PLAYER_PING + hồ sơ retained + Last-Will của TỪNG HS — toàn là tin cho
    // host. Trước đây HS cũng đăng ký nên mỗi điện thoại phải nhận ping/hồ sơ
    // của CẢ PHÒNG (ở 200 HS: hàng chục gói/giây vô ích trên máy HS và nhân
    // fan-out tại broker). Vai trò chưa rõ (null, tương thích ngược) giữ đủ 4.
    if (this.brokerRole !== 'STUDENT') {
      topics.push(`${this.currentRoomTopic}/players/+`);
    }
    return topics;
  }

  /**
   * KHÔI PHỤC CƠ CHẾ GỐC (17/11/2026, theo chỉ đạo của thầy sau sự cố sập ở
   * câu 3 với 40 HS): client phụ MESH song song thường trực — nối tới broker
   * còn lại trong cặp {emqx, hivemq} (broker chính ở broker nào thì mesh ở
   * broker kia). Mọi tin đều phát qua MỌI client đang sống (xem
   * publishToSingleMqttBroker) và nhận qua cả hai đường (khử trùng theo
   * _mid ở deliverIncomingMessage), nên một broker chết/bị chặn/bị bóp thì
   * đường còn lại gánh ngay lập tức — không có cửa sổ mất kết nối chờ
   * failover như khi chỉ có 1 kết nối. Client mesh tự nối lại ngầm
   * (reconnectPeriod 4000 như bản gốc) và KHÔNG mang Last-Will (will chỉ ở
   * client chính, tránh báo offline oan khi chỉ mesh rớt).
   */
  private connectSecondaryMeshBroker(roomId: string, forceReconnect: boolean = false) {
    if (this.isIntentionalDisconnect || !roomId) return;
    const primaryIdx = (this.pinnedBrokerIndex !== null && this.pinnedBrokerIndex >= 0)
      ? this.pinnedBrokerIndex
      : (hashRoomId(roomId) % 2);
    const secondaryIdx = primaryIdx === 0 ? 1 : 0;
    const targetUrl = PRIMARY_BROKERS[secondaryIdx];

    if (
      !forceReconnect &&
      this.secondaryClient &&
      this.secondaryClient.connected &&
      this.secondaryBrokerUrl === targetUrl
    ) {
      return;
    }

    this.secondaryBrokerUrl = targetUrl;
    this.safeCloseSecondaryClient();

    try {
      const secClient = mqtt.connect(targetUrl, {
        clientId: 'kc3d_sec_' + Math.random().toString(16).substring(2, 10),
        clean: true,
        connectTimeout: 4500,
        reconnectPeriod: 4000,
        keepalive: 30
      });
      this.secondaryClient = secClient;

      secClient.on('connect', () => {
        if (this.isIntentionalDisconnect || this.secondaryClient !== secClient) return;
        const topics = this.getSubscriptionTopics();
        if (topics.length === 0) return;
        secClient.subscribe(topics, { qos: 0 }, (err) => {
          if (!err) {
            this.mqttHealthy = true;
            this.setStatus('CONNECTED');
            this.flushOfflineQueue();
            this.notifyTelemetry();
          }
        });
      });

      secClient.on('message', (_topic, message) => {
        try {
          const rawStr = message.toString();
          if (!rawStr) return;
          const data = JSON.parse(rawStr) as CloudMessage;
          this.deliverIncomingMessage(data);
        } catch {}
      });

      secClient.on('error', () => {});
    } catch {}
  }

  private safeCloseSecondaryClient() {
    if (this.secondaryClient) {
      const old = this.secondaryClient;
      this.secondaryClient = null;
      try {
        old.removeAllListeners();
        old.on('error', () => {});
        old.end(true);
      } catch {}
    }
  }

  private connectSingleBrokerByRoom(roomId: string, forceReconnect: boolean = false) {
    if (this.isIntentionalDisconnect || !roomId) return;

    const baseIndex = (this.pinnedBrokerIndex !== null && this.pinnedBrokerIndex >= 0)
      ? this.pinnedBrokerIndex
      : (hashRoomId(roomId) % 2);
    const targetIndex = (baseIndex + this.failoverAttempt) % PRIMARY_BROKERS.length;
    const targetBrokerUrl = PRIMARY_BROKERS[targetIndex];

    // Nếu đã có kết nối hoạt động đúng broker mục tiêu thì không mở lại
    if (
      !forceReconnect &&
      this.client &&
      this.client.connected &&
      this.activeBrokerUrl === targetBrokerUrl
    ) {
      // Client chính đã connect + subscribe xong từ trước và vẫn đang sống -> onConnected ở đây là THẬT
      this.mqttHealthy = true;
      this.setStatus('CONNECTED');
      this.fireOnConnectedIfDue();
      return;
    }

    this.activeBrokerUrl = targetBrokerUrl;
    this.safeCloseClient();

    if (this.failoverTimer) {
      clearTimeout(this.failoverTimer);
      this.failoverTimer = null;
    }

    this.isConnectingMqtt = true;
    const clientId = 'kc3d_' + Math.random().toString(16).substring(2, 10);

    try {
      const willOption = this.buildPlayerWillOption();
      const client = mqtt.connect(targetBrokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 3500, // 3.5s timeout theo yêu cầu
        reconnectPeriod: 0,   // Không tự động reconnect ngầm để sequential failover chủ động kiểm soát
        keepalive: 30,
        // Đợt 5 (4B.2): Last-Will PLAYER_OFFLINE (QoS 1, retained) — chỉ phía HS có will.
        ...(willOption ? { will: willOption } : {})
      });
      this.client = client;

      // Hẹn giờ Failover sau 3.5s nếu broker chưa kết nối thành công
      this.failoverTimer = setTimeout(() => {
        if (this.isConnectingMqtt && (!this.client || !this.client.connected)) {
          this.triggerSequentialFailover('Kết nối Broker quá thời gian 3.5s');
        }
      }, 3500);

      client.on('connect', () => {
        if (this.isIntentionalDisconnect || this.client !== client) return;
        this.isConnectingMqtt = false;
        if (this.failoverTimer) {
          clearTimeout(this.failoverTimer);
          this.failoverTimer = null;
        }

        const topics = this.getSubscriptionTopics();
        if (topics.length === 0) return;

        client.subscribe(topics, { qos: 1 }, (err) => {
          if (!err) {
            this.mqttHealthy = true;
            this.failoverAttempt = 0; // Đặt lại về 0 khi kết nối thành công
            this.currentBrokerRetries = 0; // Đặt lại retry khi kết nối thành công
            this.failoverStreak = 0; // Đặt lại chuỗi failover liên tiếp (backoff về mốc đầu)
            // Đợt 8 (4C.1): phía host ghi nhận broker vừa nối được — đổi broker thì
            // tăng epoch công bố để HS chuyển theo (cùng broker thì giữ nguyên epoch).
            const connectedIdx = PRIMARY_BROKERS.indexOf(targetBrokerUrl);
            if (connectedIdx >= 0) this.noteHostBrokerConnected(connectedIdx);
            // Đợt 8 (4C.1) phía HS: nối được ĐÚNG broker của host → xoá bộ đếm khoá.
            if (this.brokerRole === 'STUDENT' && this.adoptedBrokerEpoch && connectedIdx === this.adoptedBrokerEpoch.brokerId) {
              this.gatedFailoverCycles = 0;
            }
            // Đợt 8 (4C.1) VAN AN TOÀN phía HS: đang DÒ ở broker khác broker của host —
            // cho 6s lắng nghe retained state: host thật sự ở đây thì epoch mới hơn sẽ
            // tới và maybeAdoptBrokerEpoch nhận broker này; hết 6s mà epoch không đổi
            // (host không ở đây) thì quay về broker đã ghim của host.
            if (this.brokerRole === 'STUDENT' && this.adoptedBrokerEpoch && connectedIdx >= 0 && connectedIdx !== this.adoptedBrokerEpoch.brokerId) {
              if (this.probeReturnTimer) clearTimeout(this.probeReturnTimer);
              const probedIdx = connectedIdx;
              this.probeReturnTimer = setTimeout(() => {
                this.probeReturnTimer = null;
                if (this.isIntentionalDisconnect || !this.currentRoomId) return;
                if (this.brokerRole !== 'STUDENT' || !this.adoptedBrokerEpoch) return;
                if (this.adoptedBrokerEpoch.brokerId === probedIdx) return; // đã nhận broker dò làm broker của host
                this.connectSingleBrokerByRoom(this.currentRoomId, true);
              }, 6000);
            }
            this.setStatus('CONNECTED');

            // Client chính vừa connect + subscribe thành công thật -> mới bắn onConnected
            this.fireOnConnectedIfDue();
            this.flushOfflineQueue();
            this.notifyTelemetry();
          } else {
            this.triggerSequentialFailover('Lỗi subscribe topic');
          }
        });
      });

      client.on('error', () => {
        if (this.client === client) {
          this.triggerSequentialFailover('Broker báo lỗi kết nối');
        }
      });

      client.on('close', () => {
        if (this.client === client) {
          this.triggerSequentialFailover('Đóng kết nối Broker');
        }
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
      this.triggerSequentialFailover('Khởi tạo client thất bại');
    }
  }

  private triggerSequentialFailover(_reason: string) {
    if (this.isIntentionalDisconnect || !this.currentRoomId) return;

    // KHÔI PHỤC HÀNH VI GỐC (17/11/2026): client mesh song song đang sống thì
    // kênh vẫn khoẻ (mqttHealthy theo mesh như bản gốc) và KHÔNG lật trạng
    // thái RECONNECTING — tin vẫn chảy qua đường mesh trong lúc client chính
    // nối lại. ĐÃ BỎ nhánh "khoá epoch" của đợt 8 (HS đã nhận epoch bị cấm tự
    // nhảy broker, phải thử lại đúng broker của host tới 4 chu kỳ): khi broker
    // của host chết thật, nhánh khoá này ghìm cả lớp ở broker chết trong khi
    // trận vẫn chạy — đúng mẫu sự cố sập ở câu 3 ngày 17/11. Nay mọi phía đều
    // failover tự do như bản gốc; epoch trong heartbeat chỉ còn là tín hiệu để
    // HS TỰ HỘI TỤ về broker của host khi nghe thấy (maybeAdoptBrokerEpoch),
    // không còn là khoá. Độ trễ thử lại cũng theo bản gốc (350ms/200ms cố
    // định): có mesh gánh nên failover của client chính không còn là đường
    // sống duy nhất, không cần backoff dài; failoverStreak chỉ còn tăng để
    // telemetry quan sát.
    this.failoverStreak++;
    this.mqttHealthy = Boolean(this.secondaryClient && this.secondaryClient.connected);
    if (!this.mqttHealthy) {
      this.setStatus('RECONNECTING');
    }
    this.isConnectingMqtt = false;
    if (this.failoverTimer) {
      clearTimeout(this.failoverTimer);
      this.failoverTimer = null;
    }

    this.safeCloseClient();

    // Ưu tiên Retry kết nối lại vào Broker chính ít nhất 2 lần (mỗi lần 3.5s) trước khi chuyển Broker dự phòng
    if (this.currentBrokerRetries < MAX_RETRIES_PER_BROKER) {
      this.currentBrokerRetries++;
      this.notifyTelemetry();
      setTimeout(() => {
        if (!this.isIntentionalDisconnect && this.currentRoomId) {
          this.connectSingleBrokerByRoom(this.currentRoomId, true);
        }
      }, 350);
      return;
    }

    // Đã thử lại đủ 2 lần trên Broker hiện tại nhưng vẫn lỗi -> Chuyển sang Broker tiếp theo trong danh sách dự phòng
    this.currentBrokerRetries = 0;
    this.failoverAttempt++;
    this.notifyTelemetry();

    // Kết nối tiếp Broker dự phòng tiếp theo
    setTimeout(() => {
      if (!this.isIntentionalDisconnect && this.currentRoomId) {
        this.connectSingleBrokerByRoom(this.currentRoomId, true);
      }
    }, 200);
  }

  private safeCloseClient() {
    if (this.client) {
      const old = this.client;
      this.client = null;
      try {
        old.removeAllListeners();
        old.on('error', () => {});
        old.end(true);
      } catch {}
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

    if (Array.isArray(data.players)) {
      data.players.forEach((p: any) => {
        if (p && p.playerId) {
          this.recordRetainedPlayerId(p.playerId);
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
    if (this.consecutiveHttpFailures === 4 && this.worker && this.workerSupported) {
      this.worker.postMessage({ cmd: 'SET_INTERVAL', intervalMs: 5000 });
    }
    if (this.consecutiveHttpFailures >= 4) {
      this.httpHealthy = false;
      const mqttLive = Boolean(
        (this.client && this.client.connected) || (this.secondaryClient && this.secondaryClient.connected)
      );
      if (!mqttLive) {
        this.setStatus('RECONNECTING');
      }
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
    const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;
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
    const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;
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
        if (respData && respData.matchStatus === 'PLAYING') {
          this.deliverIncomingMessage({
            _mid: `pub_ack_playing_${this.currentRoomId}_${Date.now()}`,
            type: 'WELCOME_ACK',
            status: 'PLAYING'
          });
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
    // Đợt 5 (4B.4): hàng đợi offline áp cho CẢ đường MQTT (không chỉ HTTP/static như
    // trước) và phủ thêm RESYNC_REQUEST/RESYNC_STATE — đáp án & xin resync tuyệt đối
    // không bị vứt khi mất mạng tạm thời, sẽ flush ngay khi có kênh sống trở lại.
    // PLAYER_PING cố ý KHÔNG vào hàng đợi (ping cũ vô giá trị, QoS 0).
    const isCritical = [
      'PULL_CORRECT',
      'FREEZE_WRONG',
      'PLAYER_FINISH_QUIZ',
      'AUTO_ENTER_ARENA',
      'PLAYER_READY_ROPE',
      'PLAYER_UPDATE_NAME',
      'RESYNC_REQUEST',
      'RESYNC_STATE',
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
    // Chỉ báo CONNECTED khi thật sự đang có client sống; vừa bấm nối lại thì là RECONNECTING
    const mqttLive = Boolean(
      (this.client && this.client.connected) || (this.secondaryClient && this.secondaryClient.connected)
    );
    this.setStatus(mqttLive ? 'CONNECTED' : 'RECONNECTING');
    if (!this.isStaticHost && this.apiOrigins.length > 0) {
      if (this.worker && this.workerSupported) {
        this.worker.postMessage({ cmd: 'POLL_NOW' });
      } else {
        this.pollHttpRoomMainThreadNow();
      }
    }
    this.flushOfflineQueue();

    // Nếu MQTT chưa kết nối thì thử kết nối lại — cả client chính lẫn mesh
    // song song (hành vi gốc, khôi phục 17/11/2026).
    if (!this.client || !this.client.connected) {
      this.connectSingleBrokerByRoom(this.currentRoomId, false);
    }
    if (!this.secondaryClient || !this.secondaryClient.connected) {
      this.connectSecondaryMeshBroker(this.currentRoomId, false);
    }
  }

  private async flushOfflineQueue() {
    if (this.offlineQueue.length === 0 || !this.currentRoomId) return;
    const isMqttConnected = Boolean(
      (this.client && this.client.connected) || (this.secondaryClient && this.secondaryClient.connected)
    );
    if (!isMqttConnected && (this.isStaticHost || !this.httpHealthy)) return;

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

    if (isMqttConnected && this.currentRoomTopic) {
      queued.forEach(payload => {
        this.publishToSingleMqttBroker(payload);
      });
    }
  }

  /**
   * Đợt 3 (2.3): phát đề theo CHUNK DUNG LƯỢNG — đóng gói bằng packQuizIntoChunks
   * (≤ QUIZ_CHUNK_BUDGET_BYTES serialized/chunk, trừ chunk 1 câu đơn lẻ vượt ngân sách),
   * publish QoS 1 retained lên đúng topic …/qchunk/<i> và header cũ (quizHash, chunkIndex,
   * totalChunks) nên phía nhận hiện tại vẫn ghép được. Bản đồ chunk được giữ theo quizHash
   * để phát lại khi HS gửi QUIZ_CHUNK_REQUEST. Lỗi publish được báo qua telemetry/callback
   * (reportPublishError), KHÔNG còn try/catch nuốt lỗi như trước.
   * Trả về false khi chưa có client MQTT nào sống: khi đó KHÔNG đánh dấu đã phát, để lần
   * gửi tiếp theo (heartbeat kế tiếp mang quiz) tự phát lại thay vì mất đề lặng lẽ.
   */
  private broadcastQuizChunksOverMqtt(quiz: QuizItem[], quizHash: string): boolean {
    if (!Array.isArray(quiz) || quiz.length === 0 || !this.currentRoomTopic) return false;

    const packed = packQuizIntoChunks(quiz, quizHash);
    if (packed.length === 0) return false;
    this.broadcastChunksByHash.set(quizHash, packed);

    if (this.lastBroadcastedMqttQuizHash === quizHash) return true;

    const activeClients = [this.client, this.secondaryClient].filter(
      (c): c is MqttClient => Boolean(c && c.connected)
    );
    if (activeClients.length === 0) return false;
    this.lastBroadcastedMqttQuizHash = quizHash;

    const totalChunks = packed.length;
    const prevChunkCount = this.retainedChunkCountByTopic.get(this.currentRoomTopic) || 0;
    if (totalChunks > prevChunkCount) {
      this.retainedChunkCountByTopic.set(this.currentRoomTopic, totalChunks);
    }
    packed.forEach(chunk => {
      activeClients.forEach(c => {
        this.publishWithErrorReport(
          c,
          `${this.currentRoomTopic}/qchunk/${chunk.chunkIndex}`,
          chunk.serialized,
          { qos: 1, retain: true },
          `QUIZ_CHUNK ${chunk.chunkIndex}/${totalChunks} (${quizHash})`
        );
      });
    });
    return true;
  }

  /**
   * Đợt 3 (2.4): gửi 1 câu hỏi quá lớn (thường chứa ảnh base64) qua đường chunk riêng:
   * 1 gói QUIZ_CHUNK với chunkKind='SINGLE_QUESTION', totalChunks=1, quizChunk=[câu đó],
   * publish QoS 1 lên topic chính của phòng (không dùng topic …/qchunk/<i> để tránh ghi đè
   * retained của chunk bộ đề). Gói gốc sau đó chỉ mang tham chiếu quizHash + qIndex.
   */
  private broadcastSingleQuestionChunk(payload: CloudMessage, qIndex: number | undefined) {
    if (!payload.question || !this.currentRoomTopic) return;
    const quizHash = payload.quizHash || this.currentQuizHash || `sq_${payload.question.qid}`;
    const chunkMsg = buildQuizChunkMessage(quizHash, 0, 1, [payload.question], 'SINGLE_QUESTION', qIndex);
    chunkMsg._mid = `sqchunk_${quizHash}_${typeof qIndex === 'number' ? qIndex : 'x'}_${Date.now()}`;
    this.singleQuestionChunkByKey.set(`${quizHash}:${typeof qIndex === 'number' ? qIndex : 'x'}`, chunkMsg);

    // Heartbeat mang câu hiện tại mỗi 1,2s — câu lớn chỉ phát đường chunk ĐÚNG 1 LẦN cho mỗi
    // (quizHash, qIndex, nội dung câu); các heartbeat sau chỉ mang tham chiếu rút gọn.
    // Khoá chỉ được ghi sau khi có client sống để phát, chưa có client thì lần gửi sau thử lại.
    const sentKey = `${quizHash}:${typeof qIndex === 'number' ? qIndex : 'x'}:${JSON.stringify(payload.question).length}`;
    if (this.singleQuestionSentKeys.has(sentKey)) return;

    const activeClients = [this.client, this.secondaryClient].filter(
      (c): c is MqttClient => Boolean(c && c.connected)
    );
    if (activeClients.length === 0) return;
    this.singleQuestionSentKeys.add(sentKey);
    const rawChunk = JSON.stringify(chunkMsg);
    activeClients.forEach(c => {
      this.publishWithErrorReport(
        c,
        this.currentRoomTopic,
        rawChunk,
        { qos: 1 },
        `QUIZ_SINGLE_QUESTION (${quizHash})`
      );
    });
  }

  /**
   * Gửi gói tin đồng thời qua các Broker đã kết nối để Giáo viên & Học sinh luôn thông suốt
   */
  private publishToSingleMqttBroker(payload: CloudMessage) {
    // Đóng gói + lưu bản đồ chunk TRƯỚC điểm return khi chưa có client: bản đồ theo quizHash
    // phải tồn tại để trả lời QUIZ_CHUNK_REQUEST, và broadcastQuizChunksOverMqtt chỉ đánh
    // dấu "đã phát" khi thật sự có client sống — chưa có client thì lần gửi sau tự phát lại.
    if (Array.isArray(payload.quiz) && payload.quiz.length > 0 && this.currentRoomTopic) {
      const qHash = payload.quizHash || computeClientQuizHash(payload.quiz);
      payload.quizHash = payload.quizHash || qHash;
      this.broadcastQuizChunksOverMqtt(payload.quiz, qHash);
    }

    const activeClients = [this.client, this.secondaryClient].filter(
      (c): c is MqttClient => Boolean(c && c.connected)
    );
    if (!this.currentRoomTopic || activeClients.length === 0) {
      // Đợt 5 (4B.4): trước đây chỉ static host mới xếp hàng đợi khi MQTT chưa sống —
      // nay MỌI trường hợp mất MQTT tạm thời đều xếp hàng các tin sống còn (khử trùng
      // theo _mid với đường HTTP trong queueCriticalIfOffline nên không gửi trùng).
      this.queueCriticalIfOffline(payload);
      return;
    }

    // Đợt 3 (2.4): ngưỡng an toàn áp cho CẢ question — câu đơn chứa ảnh lớn (serialized của
    // riêng câu vượt ngưỡng) KHÔNG nhét nguyên vào gói đơn/heartbeat nữa: câu đi đường chunk
    // riêng (chunkKind='SINGLE_QUESTION'), gói đang gửi chỉ còn tham chiếu
    // (quizHash + qIndex, questionRefOnly=true) để HS lấy câu thật từ chunk đó hoặc từ bộ
    // đề đã ghép. Cách tối thiểu an toàn này thay cho cơ chế "HS xác nhận đã có câu" (chưa có).
    let effectivePayload = payload;
    if (payload.question && JSON.stringify(payload.question).length > MQTT_SAFE_PAYLOAD_CHARS) {
      const qIndexFromQuestion = (payload.question as any).qIndex;
      const refQIndex =
        typeof payload.qIndex === 'number'
          ? payload.qIndex
          : typeof payload.globalQIndex === 'number'
            ? payload.globalQIndex
            : typeof qIndexFromQuestion === 'number'
              ? qIndexFromQuestion
              : undefined;
      this.broadcastSingleQuestionChunk(payload, refQIndex);
      effectivePayload = {
        ...payload,
        question: undefined,
        questionRefOnly: true,
        quizHash: payload.quizHash || this.currentQuizHash || undefined,
        qIndex: refQIndex,
        globalQIndex:
          typeof payload.globalQIndex === 'number'
            ? payload.globalQIndex
            : refQIndex
      };
    }

    const rawFull = JSON.stringify(effectivePayload);
    const mqttLivePayload =
      rawFull.length > MQTT_SAFE_PAYLOAD_CHARS && effectivePayload.quiz
        ? JSON.stringify({ ...effectivePayload, quiz: undefined, quizHash: effectivePayload.quizHash })
        : rawFull;

    const isHostStateMsg =
      effectivePayload.type === 'HOST_HEARTBEAT' ||
      effectivePayload.type === 'FORCE_START_MATCH' ||
      effectivePayload.type === 'QUESTION_START' ||
      effectivePayload.type === 'FORCE_PULL_TO_WAITING' ||
      effectivePayload.type === 'GAME_SWITCHED';

    // Đợt 8 (4C.1): phía HOST công bố broker epoch kèm MỌI tin state/heartbeat (bản live
    // lẫn bản retained …/state suy ra từ effectivePayload ngay dưới) để HS chuyển broker
    // theo host. Chưa nối được broker nào (hostBrokerIdx < 0) thì chưa công bố gì.
    if (this.brokerRole === 'HOST' && isHostStateMsg && this.hostBrokerIdx >= 0) {
      effectivePayload = {
        ...effectivePayload,
        brokerEpoch: { brokerId: this.hostBrokerIdx, epoch: this.hostBrokerEpochNum }
      };
    }

    const isStudentProfileMsg =
      (effectivePayload.type === 'PLAYER_READY_ROPE' ||
        effectivePayload.type === 'AUTO_ENTER_ARENA' ||
        effectivePayload.type === 'PLAYER_UPDATE_NAME' ||
        effectivePayload.type === 'PLAYER_FINISH_QUIZ') &&
      Boolean(effectivePayload.playerId);

    const retainedHostStatePayload = isHostStateMsg
      ? JSON.stringify({
          ...effectivePayload,
          _mid: `ret_hb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          quiz: undefined
        })
      : null;

    const retainedPlayerPayload = isStudentProfileMsg
      ? JSON.stringify({
          ...effectivePayload,
          _mid: `ret_p_${effectivePayload.playerId}_${Date.now()}`
        })
      : null;

    // Đợt 3 (2.3) + Đợt 5 (4B.4): QoS 1 cho tin STATE của phòng (bản retained …/state) và
    // cho MỌI tin sống còn theo qosForMessageType (đáp án PULL_CORRECT/FREEZE_WRONG,
    // PLAYER_READY_ROPE, RESYNC_REQUEST/RESYNC_STATE, QUESTION_START…); lỗi publish nổi
    // lên telemetry/callback qua publishWithErrorReport thay vì try/catch im lặng.
    // HOST_HEARTBEAT live + PLAYER_PING + feed giữ QoS 0 như quyết định Đợt 5.
    const liveQos: 0 | 1 = qosForMessageType(effectivePayload.type);

    // Đợt GIA CỐ TẢI: PLAYER_PING là tin CHỈ host tiêu thụ (ghi lastSeen giữ
    // chỗ) — phát thẳng vào topic players/<playerId> thay vì topic phòng, để
    // broker chỉ giao cho host (đăng ký players/+) chứ KHÔNG fan-out tới mọi
    // máy HS. Trước gia cố, ở 200 HS: 40 ping/s × phát kép 2 client × ~402
    // subscription ≈ 32.000 lượt giao/s chỉ riêng ping — nghẽn wifi lớp +
    // broker công cộng trước mọi điểm nghẽn khác. Sau gia cố: ~13 lượt/s.
    if (effectivePayload.type === 'PLAYER_PING' && effectivePayload.playerId) {
      const pingTopic = `${this.currentRoomTopic}/players/${effectivePayload.playerId}`;
      activeClients.forEach(c => {
        this.publishWithErrorReport(
          c,
          pingTopic,
          mqttLivePayload,
          { qos: liveQos },
          'MQTT live PLAYER_PING (host-only)'
        );
      });
      return;
    }

    activeClients.forEach(c => {
      this.publishWithErrorReport(
        c,
        this.currentRoomTopic,
        mqttLivePayload,
        { qos: liveQos },
        `MQTT live ${effectivePayload.type}`
      );
      if (retainedHostStatePayload) {
        this.publishWithErrorReport(
          c,
          `${this.currentRoomTopic}/state`,
          retainedHostStatePayload,
          { qos: 1, retain: true },
          `MQTT retained state ${effectivePayload.type}`
        );
      }
      if (retainedPlayerPayload && effectivePayload.playerId) {
        // Đợt 5 (4B.4): hồ sơ HS retained trên …/players/<id> cũng là tin sống còn
        // (PLAYER_READY_ROPE…) → QoS 1 để broker xác nhận, tránh mất retained lặng lẽ.
        this.publishWithErrorReport(
          c,
          `${this.currentRoomTopic}/players/${effectivePayload.playerId}`,
          retainedPlayerPayload,
          { qos: qosForMessageType(effectivePayload.type), retain: true },
          `MQTT retained player ${effectivePayload.type}`
        );
      }
    });
  }

  /**
   * YÊU CẦU 3: BỘ LỌC ĐÍNH KÈM messageId VÀ KHỬ TRÙNG LẶP
   */
  sendMessage(payload: CloudMessage) {
    if (!payload._mid) {
      payload._mid = 'm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }
    this.recordMsgId(payload._mid);
    if (payload.playerId) this.recordRetainedPlayerId(payload.playerId);

    if (Array.isArray(payload.quiz) && payload.quiz.length > 0 && this.currentRoomId) {
      const qHash = payload.quizHash || computeClientQuizHash(payload.quiz);
      payload.quizHash = qHash;
      this.cacheQuizLocally(this.currentRoomId, payload.quiz, qHash);
    }

    // Đợt 8 (4C.2): phía HOST có khoá phòng → KÝ lệnh điều khiển nhạy cảm TRƯỚC khi
    // publish qua bất kỳ kênh nào (BroadcastChannel/HTTP/MQTT đều mang cùng chữ ký).
    // Ký SAU bước gán quizHash ở trên để quizHash nằm trong chuỗi ký. Không có khoá
    // (phòng bản cũ / phía HS) → không ký, hành vi như cũ.
    if (this.roomKey && isSensitiveCommand(payload.type) && !payload.sig) {
      try {
        payload.sig = signCommandSync(this.roomKey, payload as unknown as Record<string, unknown>);
      } catch {}
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

    // 3. Gửi qua các Broker đã kết nối theo Mã Phòng
    this.publishToSingleMqttBroker(payload);
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

  async resetRoomSession(roomId: string): Promise<void> {
    const cleanId = String(roomId || '').replace(/[^a-zA-Z0-9]/g, '');
    this.clearRoomCache(cleanId);
    if (this.isStaticHost || this.apiOrigins.length === 0) return;
    for (const origin of this.apiOrigins) {
      try {
        await fetch(`${origin}/api/room/${encodeURIComponent(cleanId)}/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      } catch {}
    }
  }

  /**
   * Xoá tin retained "ma" của phòng cũ trên broker: publish payload RỖNG với retain=true
   * lên topic state, từng topic qchunk/<i> và từng topic players/<id> đã biết của phòng.
   * (Không publish lên topic wildcard '+' được — broker không nhận publish vào wildcard.)
   * Phải chạy TRƯỚC khi dọn cache local để còn suy ra được số chunk từ đề đang cache.
   */
  private publishRetainedClearForRoom(cleanId: string) {
    if (!cleanId) return;
    const topicBase = `thptmangthit_kc3d_${cleanId}`;
    const activeClients = [this.client, this.secondaryClient].filter(
      (c): c is MqttClient => Boolean(c && c.connected)
    );
    if (activeClients.length === 0) return;

    const topics: string[] = [`${topicBase}/state`];

    let totalChunks = this.retainedChunkCountByTopic.get(topicBase) || 0;
    // Đợt 3 (2.3): chunk chia theo DUNG LƯỢNG nên số chunk không còn là ceil(số câu/5) —
    // đếm bằng chính thuật toán đóng gói trên bộ đề đang cache (hoặc bản đồ chunk đã phát).
    if (this.currentRoomId === cleanId && this.cachedQuizDeck.length > 0) {
      const cachedHash = this.currentQuizHash || computeClientQuizHash(this.cachedQuizDeck);
      const packedCount =
        this.broadcastChunksByHash.get(cachedHash)?.length ||
        packQuizIntoChunks(this.cachedQuizDeck, cachedHash).length;
      totalChunks = Math.max(totalChunks, packedCount);
    }
    if (totalChunks === 0) {
      try {
        const raw =
          sessionStorage.getItem(`kc3d_quiz_cache_${cleanId}`) ||
          localStorage.getItem(`kc3d_quiz_cache_${cleanId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.quiz) && parsed.quiz.length > 0) {
            const storedHash = parsed.quizHash || computeClientQuizHash(parsed.quiz);
            totalChunks =
              this.broadcastChunksByHash.get(storedHash)?.length ||
              packQuizIntoChunks(parsed.quiz, storedHash).length;
          }
        }
      } catch {}
    }
    for (let i = 0; i < totalChunks; i++) {
      topics.push(`${topicBase}/qchunk/${i}`);
    }

    const playerIds = this.retainedPlayerIdsByRoom.get(cleanId);
    if (playerIds) {
      playerIds.forEach(id => topics.push(`${topicBase}/players/${id}`));
    }

    activeClients.forEach(c => {
      topics.forEach(t => {
        try {
          c.publish(t, '', { qos: 0, retain: true });
        } catch {}
      });
    });
  }

  clearRoomCache(roomId: string) {
    try {
      const cleanId = String(roomId || '').replace(/[^a-zA-Z0-9]/g, '');
      // Xoá retained trên broker trước, rồi mới dọn cache local
      this.publishRetainedClearForRoom(cleanId);
      sessionStorage.removeItem(`kc3d_offline_q_${cleanId}`);
      sessionStorage.removeItem(`kc3d_quiz_cache_${cleanId}`);
      localStorage.removeItem(`kc3d_quiz_cache_${cleanId}`);
      localStorage.removeItem(`kc3d_live_sync_${cleanId}`);
      for (const k of Array.from(this.seenMsgIds)) {
        if (k.startsWith('srv_p_') || k.startsWith(`hb_q_synced_${cleanId}`)) {
          this.seenMsgIds.delete(k);
        }
      }
    } catch {}
  }

  disconnect() {
    this.isIntentionalDisconnect = true;
    // Ngắt hẳn phiên (HS rời view / host đóng phòng): xoá đăng ký will để client tạo
    // sau (vd phía host dùng chung service) không mang nhầm Last-Will của HS cũ.
    this.playerWill = null;
    // Đợt 8 (4C): ngắt phiên thì quên vai trò + khoá ký của phiên cũ (phía tiếp theo
    // dùng chung service sẽ tự khai báo lại), tránh ký/đi theo epoch của phiên trước.
    this.brokerRole = null;
    this.roomKey = null;
    this.adoptedBrokerEpoch = null;
    this.gatedFailoverCycles = 0;
    if (this.probeReturnTimer) {
      clearTimeout(this.probeReturnTimer);
      this.probeReturnTimer = null;
    }
    if (this.failoverTimer) {
      clearTimeout(this.failoverTimer);
      this.failoverTimer = null;
    }
    if (this.httpPollTimer) {
      clearInterval(this.httpPollTimer);
      this.httpPollTimer = null;
    }
    if (this.worker && this.workerSupported) {
      this.worker.postMessage({ cmd: 'STOP' });
    }
    this.safeCloseClient();
    this.safeCloseSecondaryClient();
    this.mqttHealthy = false;
    this.currentRoomTopic = '';
    this.currentRoomId = '';
    this.setStatus('DISCONNECTED');
  }
}

export const CloudNetwork = new NetworkService();
