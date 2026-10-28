import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json({ limit: '25mb' }));

// Cho phép truy cập CORS từ mọi nguồn (bao gồm GitHub Pages https://khaibcmt.github.io)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Lazy initialization of GoogleGenAI SDK so server startup never crashes if GEMINI_API_KEY is not set
function getGenAIClient(customKey?: string) {
  const apiKey = customKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * HOTFIX 3.1: Bộ lọc JSON trích xuất tự động (Fault-tolerant AI JSON Sanitizer)
 * Tự động loại bỏ markdown backticks (```json ... ```) và text rác ngoài khối { ... } hoặc [ ... ] trước khi JSON.parse()
 */
function sanitizeAndParseAIJson(rawText: string): any {
  const cleaned = String(rawText || '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();

  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  let candidate = cleaned;
  if (firstBracket !== -1 && lastBracket > firstBracket && (firstBrace === -1 || firstBracket < firstBrace)) {
    candidate = cleaned.slice(firstBracket, lastBracket + 1);
  } else if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidate = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(candidate);
  } catch {
    const match = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (match && match[1]) {
      return JSON.parse(match[1]);
    }
    throw new Error('Không thể bóc tách dữ liệu JSON hợp lệ từ phản hồi AI.');
  }
}

// 1. Sinh câu hỏi tự động theo chủ đề & mức độ nhận thức (GDPT 2018)
app.post('/api/ai/generate-questions', async (req, res) => {
  try {
    const { topic, subject, level = 'Thông hiểu', count = 5, apiKey } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const ai = getGenAIClient(apiKey);
    const prompt = `Bạn là Hội đồng Chuyên gia Giáo dục và Thẩm định Đề thi Quốc gia cấp THPT hàng đầu thế giới theo chương trình GDPT 2018 tại Việt Nam (SGK Kết nối tri thức với cuộc sống).
Hãy tạo ${count} câu hỏi trắc nghiệm chuẩn mực, chính xác tuyệt đối 100% về mặt khoa học cho môn "${subject || 'Tổng hợp'}", chủ đề: "${topic}", mức độ nhận thức: "${level}".

YÊU CẦU ĐẶC BIỆT VỀ CÔNG THỨC TOÁN-LÝ-HÓA-SINH, BẢNG SỐ LIỆU & BẢN ĐỒ ĐỊA LÝ:
1. Giải kiểm tra từng bước trước khi xuất JSON để đảm bảo đáp án đúng ("correct", "tfItems", "shortAnswer") là chính xác tuyệt đối 100%.
2. Mọi công thức Toán, Vật lý, Hóa học, Sinh học BẮT BUỘC kẹp trong cặp dấu $...$ (inline LaTeX) hoặc $$...$$ (block LaTeX).
3. Nếu câu hỏi có bảng số liệu (Địa lý, Sinh học, Vật lý, Hóa học, Toán thống kê), hãy nhúng bảng HTML gọn sạch <table class="stem-data-table"><tr><th>...</th></tr><tr><td>...</td></tr></table> ngay trong trường "q". Nếu có sơ đồ/bản đồ/đồ thị, hãy mô tả rõ trong ngoặc vuông đầu câu dẫn: [Bản đồ...], [Sơ đồ...], [Đồ thị...].

Đa dạng hóa 3 dạng thức chuẩn GDPT 2018:
1. "MULTIPLE_CHOICE": Trắc nghiệm 4 lựa chọn (A, B, C, D) có 1 đáp án đúng duy nhất ("correct": 0..3).
2. "TRUE_FALSE": Câu hỏi đúng/sai chùm 4 ý a, b, c, d (mỗi ý có nội dung mệnh đề và đáp án boolean true/false).
3. "SHORT_ANSWER": Câu hỏi trả lời ngắn (học sinh điền số hoặc từ khóa ngắn gọn).

Trả về định dạng JSON thuần túy (mảng các object):
[
  {
    "q": "Nội dung câu hỏi...",
    "format": "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER",
    "opts": ["Phương án A", "Phương án B", "Phương án C", "Phương án D"],
    "correct": 0,
    "tfItems": [
      { "label": "a", "text": "Mệnh đề 1...", "isCorrect": true },
      { "label": "b", "text": "Mệnh đề 2...", "isCorrect": false },
      { "label": "c", "text": "Mệnh đề 3...", "isCorrect": true },
      { "label": "d", "text": "Mệnh đề 4...", "isCorrect": false }
    ],
    "shortAnswer": "12.5",
    "explanation": "Giải thích chi tiết từng bước tại sao đáp án đúng..."
  }
]
Không chèn markdown backticks hay giải thích thêm ngoài JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.25,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '[]';
    const parsed = sanitizeAndParseAIJson(text);
    return res.json({ success: true, questions: parsed });
  } catch (error: any) {
    console.error('Error generating questions:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate questions' });
  }
});

// 2. Bóc tách đề từ văn bản hoặc hình ảnh chụp (OCR Đa phương tiện: Sơ đồ, Bản đồ Địa lý, Bảng số liệu, Công thức Toán Lý Hóa Sinh & Gạch chân = Đúng)
app.post('/api/ai/parse-doc', async (req, res) => {
  try {
    const { textContent, imageBase64, mimeType = 'image/jpeg', apiKey } = req.body;

    const parts: any[] = [];
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, ''),
        },
      });
      parts.push({
        text: `Bạn là Hệ thống AI Nhận diện Đề thi Đa phương tiện (OCR & STEM Parser) thông minh nhất thế giới.
Hãy đọc ảnh chụp trang sách / đề kiểm tra này và bóc tách toàn bộ các câu hỏi trắc nghiệm thành danh sách câu hỏi chuẩn GDPT 2018 theo các quy tắc sống còn:
1. QUY TẮC GẠCH CHÂN = ĐÚNG, KHÔNG GẠCH CHÂN = SAI:
   - Áp dụng cho cả Dạng I (4 lựa chọn A, B, C, D) và Dạng II (Đúng/Sai 4 ý a, b, c, d): Bất kỳ phương án hoặc mệnh đề nào có ĐƯỜNG GẠCH CHÂN dưới chữ (hoặc khoanh tròn / tô màu / đánh dấu *) thì MẶC ĐỊNH LÀ ĐÚNG (isCorrect: true). Không gạch chân thì MẶC ĐỊNH LÀ SAI (isCorrect: false).
   - Tuyệt đối tôn trọng đáp án gạch chân của giáo viên!
2. CÔNG THỨC TOÁN, VẬT LÝ, HÓA HỌC, SINH HỌC:
   - Chuyển toàn bộ công thức Toán, Lý, Hóa, Sinh về chuẩn LaTeX kẹp trong cặp dấu $...$ (ví dụ $\\frac{a}{b}$, $\\sqrt{x}$, $H_2SO_4$, $Fe^{3+}$).
3. BẢNG SỐ LIỆU, HÌNH ẢNH, SƠ ĐỒ, BẢN ĐỒ ĐỊA LÝ:
   - Nếu trong ảnh có BẢNG SỐ LIỆU (Địa lý, Sinh học, Vật lý, Hóa học, Toán thống kê), BẮT BUỘC dựng lại đầy đủ bảng đó bằng HTML <table class="stem-data-table"><tr><th>...</th></tr><tr><td>...</td></tr></table> đặt ngay trong trường "q".
   - Nếu có Hình ảnh, Sơ đồ thí nghiệm, Đồ thị hoặc Bản đồ Địa lý, hãy trích xuất toàn bộ số liệu/ký hiệu trên hình/bản đồ và đặt trong [Hình/Bản đồ: ...] ngay trong trường "q".`,
      });
    } else if (textContent) {
      parts.push({
        text: `Hãy phân tích đoạn văn bản/HTML sau và trích xuất thành danh sách câu hỏi trắc nghiệm chuẩn GDPT 2018.
QUY TẮC BẮT BUỘC:
1. Mặc định các đáp án/mệnh đề có gạch chân (<u>...</u>, style underline, hoặc dấu *) là ĐÚNG (isCorrect: true), không gạch chân là SAI (isCorrect: false) cho cả Dạng I và Dạng II.
2. Giữ nguyên 100% công thức LaTeX ($...$) và bảng số liệu (<table class="stem-data-table">...</table>):\n\n${textContent}`,
      });
    } else {
      return res.status(400).json({ error: 'No text or image provided' });
    }

    parts.push({
      text: `Yêu cầu trả về JSON thuần túy (mảng các object):
[
  {
    "q": "Nội dung câu hỏi (kèm công thức $...$ hoặc <table class='stem-data-table'>...</table> nếu có)...",
    "format": "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER",
    "opts": ["Phương án A", "Phương án B", "Phương án C", "Phương án D"],
    "correct": 0,
    "tfItems": [
      { "label": "a", "text": "...", "isCorrect": true },
      { "label": "b", "text": "...", "isCorrect": false },
      { "label": "c", "text": "...", "isCorrect": true },
      { "label": "d", "text": "...", "isCorrect": false }
    ],
    "shortAnswer": "...",
    "explanation": "..."
  }
]`,
    });

    const ai = getGenAIClient(apiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        temperature: 0.15,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '[]';
    const parsed = sanitizeAndParseAIJson(text);
    return res.json({ success: true, questions: parsed });
  } catch (error: any) {
    console.error('Error parsing document with AI:', error);
    return res.status(500).json({ error: error.message || 'Failed to parse document' });
  }
});

// 3. AI Giải thích đáp án trực tiếp (AI Tutor on-screen - Tuyệt đối tôn trọng đáp án của Giáo viên)
app.post('/api/ai/explain', async (req, res) => {
  try {
    const { question, format, opts, correct, tfItems, shortAnswer, wrongCount = 0, rightCount = 0, apiKey } = req.body;
    const correctLetter = typeof correct === 'number' && correct >= 0 ? String.fromCharCode(65 + correct) : 'A';
    const correctOptText = Array.isArray(opts) && typeof correct === 'number' ? opts[correct] || '' : '';

    const prompt = `Bạn là Giáo sư - Chuyên gia Sư phạm THPT hàng đầu thế giới đang giảng bài trực tiếp trên máy chiếu lớp học.
Hãy giải thích rõ ràng, chuẩn xác 100%, sinh động cho câu hỏi sau đây (sử dụng LaTeX $...$ cho mọi công thức Toán, Lý, Hóa, Sinh):
Câu hỏi: ${question}
Dạng thức: ${format || 'MULTIPLE_CHOICE'}
${opts ? `Các phương án: ${JSON.stringify(opts)}\nĐÁP ÁN ĐÚNG CHÍNH THỨC CỦA GIÁO VIÊN LÀ: Phương án ${correctLetter} ("${correctOptText}")` : ''}
${tfItems ? `ĐÁP ÁN ĐÚNG/SAI CHÍNH THỨC CỦA GIÁO VIÊN CHO 4 MỆNH ĐỀ LÀ: ${JSON.stringify(tfItems)}` : ''}
${shortAnswer ? `ĐÁP ÁN NGẮN ĐÚNG CHÍNH THỨC CỦA GIÁO VIÊN LÀ: ${shortAnswer}` : ''}
Thống kê lớp học vừa rồi: ${rightCount} học sinh làm ĐÚNG, ${wrongCount} học sinh làm SAI.

QUY TẮC SỐNG CÒN:
- Đáp án của Giáo viên cung cấp ở trên là CHÂN LÝ TUYỆT ĐỐI 100%. Bạn TUYỆT ĐỐI KHÔNG BAO GIỜ được báo đáp án của Giáo viên là sai!
- Hãy chứng minh và giải thích mạch lạc:
  🎯 Vì sao đáp án của Giáo viên là hoàn toàn chính xác (bản chất định luật/công thức/số liệu bảng biểu).
  ⚠️ Lỗi sai hoặc bẫy phổ biến mà học sinh thường mắc phải.
  💡 Mẹo ghi nhớ nhanh trong 5 giây.`;

    const ai = getGenAIClient(apiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.15,
      },
    });

    return res.json({ success: true, explanation: response.text });
  } catch (error: any) {
    console.error('Error explaining answer:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate explanation' });
  }
});

// ============================================================================
// 3.5. HỆ THỐNG SAO LƯU & ĐỒNG BỘ ĐÁM MÂY (GOOGLE ACCOUNT & MẬT KHẨU ĐỒNG BỘ)
// Giúp giáo viên soạn bài ở nhà, sang máy tính ở trường học chỉ cần đăng nhập Google hoặc nhập Mật khẩu là dữ liệu đồng bộ ngay lập tức
// ============================================================================
const SYNC_DATA_DIR = path.join(__dirname, 'data');
const SYNC_DB_FILE = path.join(SYNC_DATA_DIR, 'cloud_sync_db.json');

interface CloudSyncRecord {
  identifier: string;
  hint?: string;
  lastUpdated: number;
  backup: any;
}

interface CloudSyncStore {
  google: Record<string, CloudSyncRecord>;
  passwords: Record<string, CloudSyncRecord>;
}

function loadSyncStore(): CloudSyncStore {
  try {
    if (!fs.existsSync(SYNC_DATA_DIR)) {
      fs.mkdirSync(SYNC_DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(SYNC_DB_FILE)) {
      const raw = fs.readFileSync(SYNC_DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        google: parsed.google || {},
        passwords: parsed.passwords || {}
      };
    }
  } catch (err) {
    console.error('Lỗi khi đọc tệp cloud_sync_db.json:', err);
  }
  return { google: {}, passwords: {} };
}

function saveSyncStore(store: CloudSyncStore) {
  try {
    if (!fs.existsSync(SYNC_DATA_DIR)) {
      fs.mkdirSync(SYNC_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SYNC_DB_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Lỗi khi ghi tệp cloud_sync_db.json:', err);
  }
}

// 1. Lưu bản sao lưu lên Đám mây (theo Google Account hoặc Mật khẩu)
app.post('/api/sync/save', (req, res) => {
  try {
    const { syncType, identifier, backup, hint } = req.body;
    if (!syncType || !identifier || !backup) {
      return res.status(400).json({ error: 'Thiếu thông tin sao lưu bắt buộc' });
    }

    const store = loadSyncStore();
    const now = Date.now();

    if (syncType === 'GOOGLE') {
      const cleanEmail = String(identifier).trim().toLowerCase();
      if (!cleanEmail.includes('@')) {
        return res.status(400).json({ error: 'Địa chỉ email Google không hợp lệ' });
      }
      store.google[cleanEmail] = {
        identifier: cleanEmail,
        lastUpdated: now,
        backup
      };
      saveSyncStore(store);
      return res.json({
        ok: true,
        syncType: 'GOOGLE',
        identifier: cleanEmail,
        lastUpdated: now,
        stats: backup.stats
      });
    } else if (syncType === 'PASSWORD') {
      const cleanPass = String(identifier).trim();
      if (cleanPass.length < 3) {
        return res.status(400).json({ error: 'Mật khẩu đồng bộ phải có ít nhất 3 ký tự' });
      }
      // Dùng SHA-256 để định danh mật khẩu bảo mật
      const passHash = crypto.createHash('sha256').update(cleanPass).digest('hex');
      store.passwords[passHash] = {
        identifier: passHash,
        hint: hint || (cleanPass.length > 2 ? cleanPass.slice(0, 2) + '***' : '***'),
        lastUpdated: now,
        backup
      };
      saveSyncStore(store);
      return res.json({
        ok: true,
        syncType: 'PASSWORD',
        lastUpdated: now,
        stats: backup.stats
      });
    } else {
      return res.status(400).json({ error: 'Loại đồng bộ không được hỗ trợ' });
    }
  } catch (err: any) {
    console.error('Lỗi API /api/sync/save:', err);
    return res.status(500).json({ error: err.message || 'Lỗi lưu bản sao lưu' });
  }
});

// 2. Tải & Đồng bộ bản sao lưu từ Đám mây về máy hiện tại
app.post('/api/sync/load', (req, res) => {
  try {
    const { syncType, identifier } = req.body;
    if (!syncType || !identifier) {
      return res.status(400).json({ error: 'Thiếu thông tin định danh đồng bộ' });
    }

    const store = loadSyncStore();

    if (syncType === 'GOOGLE') {
      const cleanEmail = String(identifier).trim().toLowerCase();
      const record = store.google[cleanEmail];
      if (!record || !record.backup) {
        return res.status(404).json({
          error: `Chưa tìm thấy bản sao lưu nào gắn với tài khoản Google [${cleanEmail}]. Hãy đảm bảo Thầy/Cô đã nhấn "Sao Lưu Lên Google" ở máy soạn bài trước đó.`
        });
      }
      return res.json({
        ok: true,
        syncType: 'GOOGLE',
        identifier: cleanEmail,
        lastUpdated: record.lastUpdated,
        backup: record.backup
      });
    } else if (syncType === 'PASSWORD') {
      const cleanPass = String(identifier).trim();
      const passHash = crypto.createHash('sha256').update(cleanPass).digest('hex');
      const record = store.passwords[passHash];
      if (!record || !record.backup) {
        return res.status(404).json({
          error: 'Mật khẩu đồng bộ không chính xác hoặc chưa có dữ liệu nào được sao lưu với mật khẩu này. Vui lòng kiểm tra lại mật khẩu.'
        });
      }
      return res.json({
        ok: true,
        syncType: 'PASSWORD',
        lastUpdated: record.lastUpdated,
        backup: record.backup
      });
    } else {
      return res.status(400).json({ error: 'Loại đồng bộ không hợp lệ' });
    }
  } catch (err: any) {
    console.error('Lỗi API /api/sync/load:', err);
    return res.status(500).json({ error: err.message || 'Lỗi tải bản sao lưu' });
  }
});

// 3. Kiểm tra trạng thái bản sao lưu (không tải toàn bộ khối dữ liệu nặng)
app.post('/api/sync/status', (req, res) => {
  try {
    const { syncType, identifier } = req.body;
    if (!syncType || !identifier) {
      return res.json({ exists: false });
    }
    const store = loadSyncStore();
    if (syncType === 'GOOGLE') {
      const cleanEmail = String(identifier).trim().toLowerCase();
      const record = store.google[cleanEmail];
      if (record) {
        return res.json({
          exists: true,
          lastUpdated: record.lastUpdated,
          stats: record.backup?.stats
        });
      }
    } else if (syncType === 'PASSWORD') {
      const passHash = crypto.createHash('sha256').update(String(identifier).trim()).digest('hex');
      const record = store.passwords[passHash];
      if (record) {
        return res.json({
          exists: true,
          lastUpdated: record.lastUpdated,
          stats: record.backup?.stats
        });
      }
    }
    return res.json({ exists: false });
  } catch (err: any) {
    return res.json({ exists: false });
  }
});

// ============================================================================
// 4. HỆ THỐNG ĐỒNG BỘ PHÒNG THI ĐẤU ĐA SERVER - CHỐNG NGHẼN MẠNG (ANTI-CONGESTION HUB)
// Giúp học sinh kết nối 100% thông suốt qua 3G/4G/Wi-Fi yếu mà không bao giờ bị văng hay kẹt ở Phòng chờ
// ============================================================================
interface RoomEventRecord {
  seq: number;
  ts: number;
  msg: any;
}

interface RoomHubState {
  roomId: string;
  seqCounter: number;
  matchStatus: string;
  statusChangedAt: number;
  forcePullTs: number;
  globalQIndex: number;
  gameType: string;
  quizDeck: any[];
  quizHash: string;
  stateSignature: string;
  latestHeartbeat: any | null;
  events: RoomEventRecord[];
  players: Record<string, any>;
  updatedAt: number;
}

const roomsHub = new Map<string, RoomHubState>();
let primaryActiveRoomId = '';

function computeQuizHash(quiz: any[] | undefined | null): string {
  if (!Array.isArray(quiz) || quiz.length === 0) return '';
  const firstQ = String(quiz[0]?.q || '').slice(0, 24);
  const lastQ = String(quiz[quiz.length - 1]?.q || '').slice(0, 24);
  const correctSig = quiz.map((q: any) => `${q.format || 'M'}:${q.correct ?? ''}`).join(',');
  return crypto
    .createHash('md5')
    .update(`${quiz.length}|${firstQ}|${lastQ}|${correctSig}`)
    .digest('hex')
    .slice(0, 12);
}

function computeHeartbeatSignature(hb: any, quizHash: string): string {
  if (!hb) return '';
  return [
    hb.status || 'LOBBY',
    hb.gameType || 'TUG',
    hb.globalQIndex ?? 0,
    hb.currentRound ?? 1,
    Number(hb.ropeScore || 0).toFixed(2),
    hb.redRoundWins ?? 0,
    hb.blueRoundWins ?? 0,
    hb.redDoneCount ?? 0,
    hb.blueDoneCount ?? 0,
    hb.bellAliveCount ?? 0,
    hb.bossHP ?? 1000,
    hb.worldEvent || 'NONE',
    hb.forcePullTs ?? 0,
    quizHash
  ].join('|');
}

function getOrCreateRoomHub(rawRoomId: string): RoomHubState {
  const cleanId = String(rawRoomId || '12345').replace(/[^a-zA-Z0-9]/g, '') || '12345';
  let room = roomsHub.get(cleanId);
  if (!room) {
    room = {
      roomId: cleanId,
      seqCounter: 1,
      matchStatus: 'LOBBY',
      statusChangedAt: 0,
      forcePullTs: 0,
      globalQIndex: 0,
      gameType: 'TUG',
      quizDeck: [],
      quizHash: '',
      stateSignature: '',
      latestHeartbeat: null,
      events: [],
      players: {},
      updatedAt: Date.now()
    };
    roomsHub.set(cleanId, room);
  }
  if (!primaryActiveRoomId) {
    primaryActiveRoomId = cleanId;
  }
  return room;
}

// Dọn dẹp phòng cũ không hoạt động quá 12 giờ để tối ưu bộ nhớ
setInterval(() => {
  const now = Date.now();
  for (const [key, room] of roomsHub.entries()) {
    if (now - room.updatedAt > 12 * 3600 * 1000) {
      roomsHub.delete(key);
    }
  }
}, 30 * 60 * 1000);

// Endpoint trả về mã phòng đang hoạt động trên Server (giúp Tab Ẩn Danh / Điện thoại tự động bắt đúng mã phòng của Giáo viên)
app.get('/api/room/active', (_req, res) => {
  try {
    const now = Date.now();
    // Ưu tiên số 1: Mã phòng Giáo viên đang mở và phát nhịp tim trực tiếp trong 5 phút gần nhất
    if (primaryActiveRoomId) {
      const primaryRoom = roomsHub.get(primaryActiveRoomId);
      if (primaryRoom && now - primaryRoom.updatedAt < 5 * 60 * 1000) {
        return res.json({ ok: true, roomId: primaryActiveRoomId });
      }
    }
    let bestRoomId = primaryActiveRoomId || '12345';
    let bestScore = -1;
    for (const [rId, rm] of roomsHub.entries()) {
      if (now - rm.updatedAt > 30 * 60 * 1000) continue;
      const pCount = Object.keys(rm.players || {}).length;
      const isPlaying = rm.matchStatus === 'PLAYING' || rm.latestHeartbeat?.status === 'PLAYING' ? 1000 : 0;
      const hasHeartbeat = rm.latestHeartbeat ? 500 : 0;
      const hasQuiz = Array.isArray(rm.quizDeck) && rm.quizDeck.length > 0 ? 100 : 0;
      const score = pCount * 50 + isPlaying + hasHeartbeat + hasQuiz;
      if (score > bestScore) {
        bestScore = score;
        bestRoomId = rId;
      }
    }
    return res.json({ ok: true, roomId: bestRoomId });
  } catch (err: any) {
    return res.json({ ok: true, roomId: primaryActiveRoomId || '12345' });
  }
});

// Endpoint tải riêng bộ đề thi (nén & cache theo quizHash để chống nghẽn mạng khi 50+ học sinh cùng vào phòng)
app.get('/api/room/:roomId/quiz', (req, res) => {
  try {
    const room = getOrCreateRoomHub(req.params.roomId);
    return res.json({
      ok: true,
      roomId: room.roomId,
      quizHash: room.quizHash,
      quiz: room.quizDeck || []
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Quiz fetch error' });
  }
});

function processRoomIncomingPayload(room: RoomHubState, payload: any) {
  if (!payload || !payload.type) return;
  const now = Date.now();
  room.updatedAt = now;

  // Cập nhật bộ câu hỏi nếu gói tin có đính kèm mảng quiz hợp lệ
  if (Array.isArray(payload.quiz) && payload.quiz.length > 0) {
    room.quizDeck = payload.quiz;
    room.quizHash = computeQuizHash(payload.quiz);
  }

  // Xử lý tín hiệu Kéo Học Sinh Vào Phòng từ Giáo viên
  if (payload.type === 'FORCE_PULL_TO_WAITING') {
    primaryActiveRoomId = room.roomId;
    room.forcePullTs = now;
    if (payload.gameType) {
      room.gameType = payload.gameType;
    }
  }

  // Xử lý các tín hiệu chuyển trạng thái quan trọng từ Giáo viên (BẮT ĐẦU / CHUYỂN CÂU / ĐỔI TRÒ / KẾT THÚC)
  if (payload.type === 'FORCE_START_MATCH' || payload.type === 'MATCH_START' || payload.type === 'QUESTION_START') {
    primaryActiveRoomId = room.roomId;
    room.matchStatus = 'PLAYING';
    room.statusChangedAt = now;
    room.forcePullTs = now;
    if (typeof payload.qIndex === 'number') {
      room.globalQIndex = payload.qIndex;
    } else if (typeof payload.globalQIndex === 'number') {
      room.globalQIndex = payload.globalQIndex;
    }
    if (payload.gameType) {
      room.gameType = payload.gameType;
    }
    // Xóa toàn bộ các sự kiện cũ (như GAME_SWITCH về LOBBY hay MATCH_ENDED cũ) để học sinh vào sau hoặc reconnect KHÔNG BAO GIỜ bị văng ngược ra phòng chờ!
    room.events = room.events.filter(
      e =>
        e.msg.type !== 'GAME_SWITCH' &&
        e.msg.type !== 'GAME_SWITCHED' &&
        e.msg.type !== 'MATCH_ENDED' &&
        !(e.msg.type === 'QUESTION_START' && e.msg.qIndex !== room.globalQIndex)
    );
  } else if (payload.type === 'GAME_SWITCH' || payload.type === 'GAME_SWITCHED') {
    primaryActiveRoomId = room.roomId;
    room.matchStatus = payload.status || 'LOBBY';
    room.statusChangedAt = now;
    room.globalQIndex = payload.qIndex ?? payload.globalQIndex ?? 0;
    if (payload.gameType) room.gameType = payload.gameType;
    // Dọn dẹp sự kiện ván cũ
    room.events = [];
  } else if (payload.type === 'PAUSE_TOGGLE' && payload.status) {
    room.matchStatus = payload.status;
    room.statusChangedAt = now;
  } else if (payload.type === 'MATCH_ENDED') {
    room.matchStatus = 'ENDED';
    room.statusChangedAt = now;
  }

  if (payload.type === 'HOST_HEARTBEAT') {
    primaryActiveRoomId = room.roomId;
    // CHỐNG LỖI RACE CONDITION KHI GIÁO VIÊN BẤM BẮT ĐẦU:
    // Nếu Giáo viên vừa bấm BẮT ĐẦU (FORCE_START_MATCH / QUESTION_START) trong vòng 10 giây,
    // tuyệt đối không để gói HOST_HEARTBEAT trễ mang status='LOBBY' ghi đè làm khóa màn hình học sinh!
    let effectiveStatus = payload.status || room.matchStatus || 'LOBBY';
    if (
      room.matchStatus === 'PLAYING' &&
      effectiveStatus === 'LOBBY' &&
      now - room.statusChangedAt < 10000
    ) {
      effectiveStatus = 'PLAYING';
    } else if (payload.status) {
      room.matchStatus = payload.status;
    }

    const effectiveQIndex =
      typeof payload.globalQIndex === 'number' ? payload.globalQIndex : room.globalQIndex;
    room.globalQIndex = effectiveQIndex;
    if (payload.gameType) room.gameType = payload.gameType;

    const activeQ =
      payload.question ||
      (room.quizDeck && room.quizDeck[effectiveQIndex]
        ? { ...room.quizDeck[effectiveQIndex], qIndex: effectiveQIndex, totalQuestions: room.quizDeck.length }
        : undefined);

    const nextHb = {
      ...payload,
      status: effectiveStatus,
      globalQIndex: effectiveQIndex,
      gameType: room.gameType,
      question: activeQ,
      quizHash: room.quizHash,
      forcePullTs: room.forcePullTs || 0,
      // Không lưu lặp lại mảng quiz nặng trong từng heartbeat biến thiên
      quiz: undefined
    };

    const sig = computeHeartbeatSignature(nextHb, room.quizHash);
    room.stateSignature = sig;
    room.latestHeartbeat = {
      ...nextHb,
      _mid: `hb_${sig}`
    };
    return;
  }

  // Cập nhật ngay latestHeartbeat khi có gói đồng bộ câu hỏi / kéo học sinh / bắt đầu trận đấu từ Giáo viên
  if (
    payload.type === 'QUIZ_SYNC' ||
    payload.type === 'FORCE_PULL_TO_WAITING' ||
    payload.type === 'GAME_SWITCH' ||
    payload.type === 'GAME_SWITCHED' ||
    payload.type === 'MATCH_START' ||
    payload.type === 'FORCE_START_MATCH' ||
    payload.type === 'QUESTION_START' ||
    payload.type === 'PAUSE_TOGGLE' ||
    payload.type === 'MATCH_ENDED'
  ) {
    primaryActiveRoomId = room.roomId;
    const safeQIdx =
      typeof payload.qIndex === 'number'
        ? payload.qIndex
        : typeof payload.globalQIndex === 'number'
        ? payload.globalQIndex
        : room.globalQIndex;
    const activeQ =
      payload.question ||
      (room.quizDeck && room.quizDeck[safeQIdx]
        ? { ...room.quizDeck[safeQIdx], qIndex: safeQIdx, totalQuestions: room.quizDeck.length }
        : room.latestHeartbeat?.question);

    const nextHb = {
      ...(room.latestHeartbeat || {}),
      type: 'HOST_HEARTBEAT',
      gameType: payload.gameType || room.gameType || 'TUG',
      status: room.matchStatus,
      globalQIndex: safeQIdx,
      question: activeQ,
      quizHash: room.quizHash,
      forcePullTs: room.forcePullTs || 0,
      worldEvent: payload.worldEvent || room.latestHeartbeat?.worldEvent || 'NONE',
      worldEventTitle: payload.worldEventTitle ?? room.latestHeartbeat?.worldEventTitle ?? '',
      serverStartTime: payload.serverStartTime || Date.now(),
      durationSec: payload.durationSec || 30,
      quiz: undefined
    };
    const sig = computeHeartbeatSignature(nextHb, room.quizHash);
    room.stateSignature = `${sig}_${payload.type}_${now}`;
    room.latestHeartbeat = {
      ...nextHb,
      _mid: `hb_${room.stateSignature}`
    };
  }

  // Kiểm tra xem gói tin của học sinh có thay đổi gì mới không để chống nghẽn hàng đợi sự kiện
  let isDuplicatePlayerPing = false;
  if (
    (payload.type === 'AUTO_ENTER_ARENA' ||
      payload.type === 'PLAYER_READY_ROPE' ||
      payload.type === 'PLAYER_FINISH_QUIZ' ||
      payload.type === 'PLAYER_UPDATE_NAME' ||
      payload.type === 'TEAM_SWITCH_REQUEST') &&
    payload.playerId
  ) {
    const prevP = room.players[payload.playerId];
    const nextReady =
      payload.type === 'PLAYER_READY_ROPE' ||
      payload.type === 'PLAYER_FINISH_QUIZ' ||
      payload.type === 'PLAYER_UPDATE_NAME' ||
      Boolean(prevP?.ready);

    // Khi học sinh rớt mạng vào lại (reconnect), ghi đè socketId mới vào playerId cũ và giữ nguyên điểm số cao nhất
    const nextScore =
      payload.type === 'PLAYER_FINISH_QUIZ' && typeof payload.savedScore === 'number'
        ? Math.max(typeof prevP?.savedScore === 'number' ? prevP.savedScore : 0, payload.savedScore)
        : Math.max(
            typeof prevP?.savedScore === 'number' ? prevP.savedScore : 0,
            typeof payload.savedScore === 'number' ? payload.savedScore : 0
          );
    const nextCorrect = Math.max(
      typeof prevP?.savedCorrect === 'number' ? prevP.savedCorrect : 0,
      typeof payload.savedCorrect === 'number' ? payload.savedCorrect : 0
    );
    const incomingCleanName = (payload.playerName || '').trim();
    const nextName =
      incomingCleanName && incomingCleanName !== 'Học sinh' && incomingCleanName !== 'Chưa lưu tên'
        ? incomingCleanName
        : prevP?.playerName && prevP.playerName !== 'Chưa lưu tên'
        ? prevP.playerName
        : incomingCleanName || `SBD #${String(payload.playerId).slice(-3).toUpperCase()}`;

    const nextTeam = payload.newTeam || payload.preferredTeam || payload.team || prevP?.preferredTeam || 'RED';
    const nextAvatar = payload.avatar || prevP?.avatar;
    const sameAvatar = JSON.stringify(prevP?.avatar || null) === JSON.stringify(nextAvatar || null);

    if (
      prevP &&
      prevP.ready === nextReady &&
      prevP.savedScore === nextScore &&
      prevP.savedCorrect === nextCorrect &&
      prevP.playerName === nextName &&
      prevP.preferredTeam === nextTeam &&
      sameAvatar &&
      now - (prevP.updatedAt || 0) < 3500 &&
      payload.type !== 'PLAYER_FINISH_QUIZ' &&
      payload.type !== 'PLAYER_UPDATE_NAME' &&
      payload.type !== 'TEAM_SWITCH_REQUEST'
    ) {
      isDuplicatePlayerPing = true;
    }

    room.players[payload.playerId] = {
      ...(prevP || {}),
      playerId: payload.playerId,
      socketId: payload.senderId || prevP?.socketId || payload.playerId,
      playerName: nextName,
      preferredTeam: nextTeam,
      avatar: nextAvatar,
      savedScore: nextScore,
      savedCorrect: nextCorrect,
      ready: nextReady,
      updatedAt: now
    };
  } else if (
    (payload.type === 'PULL_CORRECT' ||
      payload.type === 'FREEZE_WRONG' ||
      payload.type === 'MYSTERY_CHEST_CLAIMED') &&
    payload.playerId
  ) {
    const existingP = room.players[payload.playerId] || {
      playerId: payload.playerId,
      playerName: payload.playerName || `SBD #${String(payload.playerId).slice(-3).toUpperCase()}`,
      preferredTeam: payload.team || 'RED',
      ready: true,
      savedScore: 0,
      savedCorrect: 0
    };
    if (typeof payload.totalScore === 'number') {
      existingP.savedScore = payload.totalScore;
    }
    if (typeof payload.savedCorrect === 'number') {
      existingP.savedCorrect = Math.max(existingP.savedCorrect || 0, payload.savedCorrect);
    }
    existingP.updatedAt = now;
    room.players[payload.playerId] = existingP;
  }

  if (!isDuplicatePlayerPing) {
    room.seqCounter += 1;
    // CHỐNG NGHẼN MẠNG TUYỆT ĐỐI: Tách mảng quiz nặng ra khỏi từng sự kiện trong room.events
    // (vì quiz đã được lưu tập trung ở room.quizDeck và đồng bộ qua quizHash)
    const slimEventPayload =
      payload.quiz && Array.isArray(payload.quiz)
        ? { ...payload, quiz: undefined, quizHash: room.quizHash }
        : payload;

    room.events.push({
      seq: room.seqCounter,
      ts: now,
      msg: slimEventPayload
    });
    if (room.events.length > 800) {
      room.events.splice(0, room.events.length - 800);
    }
  }

  if (
    payload.type === 'MATCH_START' ||
    payload.type === 'FORCE_START_MATCH' ||
    payload.type === 'GAME_SWITCH' ||
    payload.type === 'GAME_SWITCHED'
  ) {
    Object.keys(room.players).forEach(pid => {
      if (room.players[pid]) {
        room.players[pid].savedScore = 0;
        room.players[pid].savedCorrect = 0;
      }
    });
  }
}

app.post('/api/room/:roomId/publish', (req, res) => {
  try {
    const room = getOrCreateRoomHub(req.params.roomId);
    const payload = req.body;
    if (!payload || !payload.type) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    processRoomIncomingPayload(room, payload);

    return res.json({
      ok: true,
      seq: room.seqCounter,
      quizHash: room.quizHash,
      matchStatus: room.matchStatus,
      forcePullTs: room.forcePullTs || 0,
      playerCount: Object.keys(room.players).length
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Publish error' });
  }
});

// Endpoint xử lý đa luồng gộp gói tin (Batch Publish) giảm 80% số lượng request khi mạng chập chờn
app.post('/api/room/:roomId/batch', (req, res) => {
  try {
    const room = getOrCreateRoomHub(req.params.roomId);
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    for (const msg of messages) {
      processRoomIncomingPayload(room, msg);
    }
    return res.json({
      ok: true,
      seq: room.seqCounter,
      quizHash: room.quizHash,
      matchStatus: room.matchStatus,
      forcePullTs: room.forcePullTs || 0,
      playerCount: Object.keys(room.players).length
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Batch publish error' });
  }
});

app.get('/api/room/:roomId/poll', (req, res) => {
  try {
    const room = getOrCreateRoomHub(req.params.roomId);
    const sinceSeq = parseInt(String(req.query.since || '0'), 10) || 0;
    const clientHbMid = String(req.query.hb || '');
    const clientQuizHash = String(req.query.qh || '');
    const now = Date.now();

    // Khi học sinh mới vào hoặc vừa reconnect (sinceSeq === 0), KHÔNG phát lại 80 sự kiện lịch sử cũ
    // (tránh việc sự kiện GAME_SWITCH / MATCH_ENDED cũ làm văng học sinh ra khỏi phòng đang thi).
    // Riêng tín hiệu FORCE_PULL_TO_WAITING được giữ trong 30 giây để kéo toàn bộ học sinh vào phòng ngay lập tức!
    const newEvents =
      sinceSeq > 0
        ? room.events.filter(e => e.seq > sinceSeq)
        : room.events.filter(
            e =>
              (now - e.ts <= 5000 || (e.msg.type === 'FORCE_PULL_TO_WAITING' && now - e.ts <= 30000)) &&
              e.msg.type !== 'GAME_SWITCH' &&
              e.msg.type !== 'GAME_SWITCHED' &&
              e.msg.type !== 'MATCH_ENDED'
          );

    const needQuizSync = Boolean(room.quizHash && room.quizDeck.length > 0 && clientQuizHash !== room.quizHash);
    const shouldSendHeartbeat =
      Boolean(room.latestHeartbeat) &&
      (!clientHbMid || room.latestHeartbeat._mid !== clientHbMid || needQuizSync || sinceSeq === 0);

    let heartbeatToSend = null;
    if (shouldSendHeartbeat && room.latestHeartbeat) {
      heartbeatToSend = {
        ...room.latestHeartbeat,
        status: room.matchStatus || room.latestHeartbeat.status || 'LOBBY',
        globalQIndex: room.globalQIndex ?? room.latestHeartbeat.globalQIndex ?? 0,
        forcePullTs: room.forcePullTs || 0,
        quizHash: room.quizHash,
        // Chỉ đính kèm mảng quiz khi máy học sinh chưa có phiên bản đề thi này (giảm 99% dung lượng mạng!)
        quiz: needQuizSync ? room.quizDeck : undefined
      };
    }

    return res.json({
      ok: true,
      seq: room.seqCounter,
      serverTs: now,
      matchStatus: room.matchStatus,
      forcePullTs: room.forcePullTs || 0,
      globalQIndex: room.globalQIndex,
      quizHash: room.quizHash,
      latestHeartbeat: heartbeatToSend,
      events: newEvents.map(e => e.msg),
      players: Object.values(room.players)
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Poll error' });
  }
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${port}`);
  });
}

startServer();
