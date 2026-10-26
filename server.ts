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
// 3.8. HỆ THỐNG BẢO MẬT CHỦ SỞ HỮU TRANG WEB, GHI NHỚ ID MÁY & ID CÁC TRANG MẠNG
// ============================================================================
const SECURITY_DB_FILE = path.join(SYNC_DATA_DIR, 'security_registry_db.json');
const OWNER_EMAIL_ADDRESS = 'khaibcmt@gmail.com';

interface SecurityRegistryStore {
  machines: Record<string, any>;
  websites: Record<string, any>;
  activationRequests: any[];
}

function loadSecurityRegistryStore(): SecurityRegistryStore {
  try {
    if (!fs.existsSync(SYNC_DATA_DIR)) {
      fs.mkdirSync(SYNC_DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(SECURITY_DB_FILE)) {
      const raw = fs.readFileSync(SECURITY_DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        machines: parsed.machines || {},
        websites: parsed.websites || {},
        activationRequests: Array.isArray(parsed.activationRequests) ? parsed.activationRequests : []
      };
    }
  } catch (err) {
    console.error('Lỗi đọc security_registry_db.json:', err);
  }
  return { machines: {}, websites: {}, activationRequests: [] };
}

function saveSecurityRegistryStore(store: SecurityRegistryStore) {
  try {
    if (!fs.existsSync(SYNC_DATA_DIR)) {
      fs.mkdirSync(SYNC_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SECURITY_DB_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Lỗi ghi security_registry_db.json:', err);
  }
}

// API ghi nhận và đồng bộ ID Máy đã chạy + ID các trang mạng
app.post('/api/security/telemetry', (req, res) => {
  try {
    const { machine, website, activationRequests } = req.body || {};
    const store = loadSecurityRegistryStore();

    const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const clientIp = forwardedFor || req.socket.remoteAddress || 'Local-Network';

    if (machine && machine.deviceId) {
      const prevM = store.machines[machine.deviceId] || {};
      const mergedSites = Array.from(new Set([...(prevM.siteIds || []), ...(machine.siteIds || [])]));
      const mergedDomains = Array.from(new Set([...(prevM.networkDomains || []), ...(machine.networkDomains || [])]));
      store.machines[machine.deviceId] = {
        ...prevM,
        ...machine,
        sessionsUsed: Math.max(Number(prevM.sessionsUsed || 0), Number(machine.sessionsUsed || 1)),
        isActivated: Boolean(prevM.isActivated || machine.isActivated),
        isOwnerDevice: Boolean(prevM.isOwnerDevice || machine.isOwnerDevice),
        siteIds: mergedSites,
        networkDomains: mergedDomains,
        clientIp,
        firstSeenAt: prevM.firstSeenAt || machine.firstSeenAt || Date.now(),
        lastSeenAt: Date.now()
      };
    }

    if (website && website.siteId) {
      const prevW = store.websites[website.siteId] || {};
      const mergedDevs = Array.from(new Set([...(prevW.deviceIds || []), ...(website.deviceIds || [])]));
      store.websites[website.siteId] = {
        ...prevW,
        ...website,
        visitCount: Math.max(Number(prevW.visitCount || 0), Number(website.visitCount || 1)),
        deviceIds: mergedDevs,
        firstVisitedAt: prevW.firstVisitedAt || website.firstVisitedAt || Date.now(),
        lastVisitedAt: Date.now()
      };
    }

    if (Array.isArray(activationRequests) && activationRequests.length > 0) {
      const existingIds = new Set(store.activationRequests.map((r: any) => r.requestId));
      activationRequests.forEach((reqItem: any) => {
        if (reqItem && reqItem.requestId && !existingIds.has(reqItem.requestId)) {
          store.activationRequests.unshift(reqItem);
          existingIds.add(reqItem.requestId);
        }
      });
      store.activationRequests = store.activationRequests.slice(0, 50);
    }

    saveSecurityRegistryStore(store);

    return res.json({
      ok: true,
      clientIp,
      registry: store
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message || 'Telemetry error' });
  }
});

// API gửi Mã Kích Hoạt về email đăng ký GitHub của Chủ sở hữu (khaibcmt@gmail.com)
app.post('/api/security/request-activation-email', async (req, res) => {
  try {
    const reqLog = req.body;
    if (!reqLog || !reqLog.deviceId || !reqLog.activationCode) {
      return res.status(400).json({ ok: false, error: 'Thiếu thông tin thiết bị yêu cầu kích hoạt' });
    }

    const store = loadSecurityRegistryStore();
    const existingIds = new Set(store.activationRequests.map((r: any) => r.requestId));
    if (!existingIds.has(reqLog.requestId)) {
      store.activationRequests.unshift({
        ...reqLog,
        emailSentTo: OWNER_EMAIL_ADDRESS,
        createdAt: reqLog.createdAt || Date.now()
      });
      store.activationRequests = store.activationRequests.slice(0, 50);
      saveSecurityRegistryStore(store);
    }

    // Chuyển tiếp email thông báo tới mail đăng ký GitHub của Chủ sở hữu (khaibcmt@gmail.com)
    let emailDelivered = false;
    try {
      const mailRes = await fetch(`https://formsubmit.co/ajax/${OWNER_EMAIL_ADDRESS}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          _subject: `[ĐẤU TRƯỜNG 3D - GITHUB] Cấp Mã Kích Hoạt cho Máy ${reqLog.deviceId}`,
          _template: 'table',
          Mail_Chu_So_Huu_GitHub: OWNER_EMAIL_ADDRESS,
          ID_May_Da_Chay: reqLog.deviceId,
          Thong_So_May: reqLog.hardwareSummary || '',
          ID_Trang_Mang: `${reqLog.siteId || ''} (${reqLog.origin || ''})`,
          Ghi_Chu: reqLog.requesterNote || '',
          MA_KICH_HOAT_CAP_PHEP: reqLog.activationCode,
          Thoi_Gian: new Date().toLocaleString('vi-VN')
        })
      });
      emailDelivered = mailRes.ok;
    } catch {}

    return res.json({
      ok: true,
      emailDelivered,
      ownerEmail: OWNER_EMAIL_ADDRESS
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message || 'Activation email error' });
  }
});

// ============================================================================
// 4. HỆ THỐNG ĐỒNG BỘ PHÒNG THI ĐẤU REAL-TIME QUA HTTP CÙNG TÊN MIỀN (FIREWALL-PROOF)
// Giúp học sinh kết nối 100% thông suốt qua 3G/4G/Wi-Fi trường học mà không bao giờ bị văng
// ============================================================================
interface RoomEventRecord {
  seq: number;
  ts: number;
  msg: any;
}

interface RoomHubState {
  roomId: string;
  seqCounter: number;
  latestHeartbeat: any | null;
  events: RoomEventRecord[];
  players: Record<string, any>;
  updatedAt: number;
}

const roomsHub = new Map<string, RoomHubState>();
let primaryActiveRoomId = '';

function getOrCreateRoomHub(rawRoomId: string): RoomHubState {
  const cleanId = String(rawRoomId || '12345').replace(/[^a-zA-Z0-9]/g, '') || '12345';
  let room = roomsHub.get(cleanId);
  if (!room) {
    room = {
      roomId: cleanId,
      seqCounter: 1,
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

// Endpoint trả về mã phòng đang hoạt động trên Server (giúp Tab Ẩn Danh tự động bắt đúng mã phòng của Giáo viên)
app.get('/api/room/active', (_req, res) => {
  try {
    let bestRoomId = primaryActiveRoomId || '12345';
    let bestScore = -1;
    const now = Date.now();
    for (const [rId, rm] of roomsHub.entries()) {
      if (now - rm.updatedAt > 30 * 60 * 1000) continue;
      const pCount = Object.keys(rm.players || {}).length;
      const isPlaying = rm.latestHeartbeat?.status === 'PLAYING' ? 1000 : 0;
      const hasQuiz = Array.isArray(rm.latestHeartbeat?.quiz) && rm.latestHeartbeat.quiz.length > 0 ? 100 : 0;
      const score = pCount * 50 + isPlaying + hasQuiz;
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

app.post('/api/room/:roomId/publish', (req, res) => {
  try {
    const room = getOrCreateRoomHub(req.params.roomId);
    const payload = req.body;
    if (!payload || !payload.type) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    room.updatedAt = Date.now();

    if (payload.type === 'HOST_HEARTBEAT') {
      room.latestHeartbeat = payload;
      primaryActiveRoomId = room.roomId;
    } else {
      // Nếu là gói đồng bộ câu hỏi mới (QUIZ_SYNC / GAME_SWITCHED / MATCH_START / FORCE_START_MATCH / QUESTION_START), cập nhật ngay vào latestHeartbeat
      if (
        (payload.type === 'QUIZ_SYNC' ||
          payload.type === 'GAME_SWITCHED' ||
          payload.type === 'MATCH_START' ||
          payload.type === 'FORCE_START_MATCH' ||
          payload.type === 'QUESTION_START') &&
        Array.isArray(payload.quiz) &&
        payload.quiz.length > 0
      ) {
        room.latestHeartbeat = {
          ...(room.latestHeartbeat || {}),
          type: 'HOST_HEARTBEAT',
          _mid: payload._mid || 'hb_' + Date.now(),
          gameType: payload.gameType || room.latestHeartbeat?.gameType || 'TUG',
          status: payload.status || (payload.type === 'FORCE_START_MATCH' || payload.type === 'MATCH_START' ? 'PLAYING' : room.latestHeartbeat?.status || 'LOBBY'),
          globalQIndex: typeof payload.qIndex === 'number' ? payload.qIndex : (payload.globalQIndex ?? 0),
          quiz: payload.quiz,
          question: payload.question || payload.quiz[payload.qIndex || 0] || payload.quiz[0]
        };
      }

      // Kiểm tra xem gói tin PLAYER_READY_ROPE / AUTO_ENTER_ARENA có thay đổi gì mới không để tránh làm tràn hàng đợi sự kiện
      let isDuplicatePlayerPing = false;
      if (
        (payload.type === 'AUTO_ENTER_ARENA' ||
          payload.type === 'PLAYER_READY_ROPE' ||
          payload.type === 'PLAYER_FINISH_QUIZ' ||
          payload.type === 'PLAYER_UPDATE_NAME') &&
        payload.playerId
      ) {
        const prevP = room.players[payload.playerId];
        const nextReady = payload.type === 'PLAYER_READY_ROPE' || payload.type === 'PLAYER_FINISH_QUIZ' || Boolean(prevP?.ready);
        // HOTFIX 1.1: Khi học sinh rớt mạng vào lại (reconnect), ghi đè socketId mới vào playerId cũ và giữ nguyên điểm số cao nhất (không bị reset về 0)
        const nextScore =
          payload.type === 'PLAYER_FINISH_QUIZ' && typeof payload.savedScore === 'number'
            ? payload.savedScore
            : Math.max(
                typeof prevP?.savedScore === 'number' ? prevP.savedScore : 0,
                typeof payload.savedScore === 'number' ? payload.savedScore : 0
              );
        const nextCorrect = Math.max(
          typeof prevP?.savedCorrect === 'number' ? prevP.savedCorrect : 0,
          typeof payload.savedCorrect === 'number' ? payload.savedCorrect : 0
        );
        const nextName = payload.playerName || prevP?.playerName || 'Học sinh';

        if (
          prevP &&
          prevP.ready === nextReady &&
          prevP.savedScore === nextScore &&
          prevP.savedCorrect === nextCorrect &&
          prevP.playerName === nextName &&
          payload.type !== 'PLAYER_FINISH_QUIZ' &&
          payload.type !== 'PLAYER_UPDATE_NAME'
        ) {
          isDuplicatePlayerPing = true;
        }

        room.players[payload.playerId] = {
          ...(prevP || {}),
          playerId: payload.playerId,
          socketId: payload.senderId || prevP?.socketId || payload.playerId,
          playerName: nextName,
          preferredTeam: payload.preferredTeam || payload.team || prevP?.preferredTeam || 'RED',
          avatar: payload.avatar || prevP?.avatar,
          savedScore: nextScore,
          savedCorrect: nextCorrect,
          ready: nextReady,
          updatedAt: Date.now()
        };
      } else if (
        (payload.type === 'PULL_CORRECT' ||
          payload.type === 'FREEZE_WRONG' ||
          payload.type === 'MYSTERY_CHEST_CLAIMED') &&
        payload.playerId &&
        room.players[payload.playerId]
      ) {
        if (typeof payload.totalScore === 'number') {
          room.players[payload.playerId].savedScore = payload.totalScore;
        }
        if (typeof payload.savedCorrect === 'number') {
          room.players[payload.playerId].savedCorrect = payload.savedCorrect;
        }
        room.players[payload.playerId].updatedAt = Date.now();
      }

      if (!isDuplicatePlayerPing) {
        room.seqCounter += 1;
        // Tối ưu băng thông khi chịu tải hàng trăm Tab cùng lúc: Không nhân bản mảng quiz lớn trong từng gói ENTER_CONFIRMED
        const eventPayload =
          payload.type === 'ENTER_CONFIRMED' && room.latestHeartbeat?.quiz
            ? { ...payload, quiz: undefined }
            : payload;

        room.events.push({
          seq: room.seqCounter,
          ts: Date.now(),
          msg: eventPayload
        });
        if (room.events.length > 2500) {
          room.events.splice(0, room.events.length - 2500);
        }
      }

      if (payload.type === 'MATCH_START' || payload.type === 'FORCE_START_MATCH' || payload.type === 'GAME_SWITCH' || payload.type === 'GAME_SWITCHED') {
        Object.keys(room.players).forEach(pid => {
          if (room.players[pid]) {
            room.players[pid].savedScore = 0;
            room.players[pid].savedCorrect = 0;
          }
        });
      }
    }

    return res.json({
      ok: true,
      seq: room.seqCounter,
      playerCount: Object.keys(room.players).length
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Publish error' });
  }
});

app.get('/api/room/:roomId/poll', (req, res) => {
  try {
    const room = getOrCreateRoomHub(req.params.roomId);
    const sinceSeq = parseInt(String(req.query.since || '0'), 10) || 0;
    const clientHbMid = String(req.query.hb || '');
    const newEvents = sinceSeq > 0
      ? room.events.filter(e => e.seq > sinceSeq)
      : room.events.slice(-80);

    // Chỉ gửi latestHeartbeat khi có thay đổi mới để giảm 95% dung lượng tải khi mở 50-100 Tab cùng lúc
    const shouldSendHeartbeat =
      room.latestHeartbeat && (!clientHbMid || room.latestHeartbeat._mid !== clientHbMid);

    return res.json({
      ok: true,
      seq: room.seqCounter,
      latestHeartbeat: shouldSendHeartbeat ? room.latestHeartbeat : null,
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
