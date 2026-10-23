import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json({ limit: '25mb' }));

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

// 1. Sinh câu hỏi tự động theo chủ đề & mức độ nhận thức (GDPT 2018)
app.post('/api/ai/generate-questions', async (req, res) => {
  try {
    const { topic, subject, level = 'Thông hiểu', count = 5, apiKey } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const ai = getGenAIClient(apiKey);
    const prompt = `Bạn là chuyên gia ra đề thi THPT theo chương trình GDPT 2018 tại Việt Nam.
Hãy tạo ${count} câu hỏi trắc nghiệm chất lượng cao cho môn "${subject || 'Tổng hợp'}", chủ đề: "${topic}", mức độ nhận thức: "${level}".
Đa dạng hóa các dạng câu hỏi chuẩn GDPT 2018:
1. "MULTIPLE_CHOICE": Trắc nghiệm 4 lựa chọn (A, B, C, D) có 1 đáp án đúng duy nhất.
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
    "explanation": "Giải thích ngắn gọn tại sao đáp án đúng..."
  }
]
Không chèn markdown backticks hay giải thích thêm ngoài JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '[]';
    const parsed = JSON.parse(text);
    return res.json({ success: true, questions: parsed });
  } catch (error: any) {
    console.error('Error generating questions:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate questions' });
  }
});

// 2. Bóc tách đề từ văn bản hoặc hình ảnh chụp (OCR & Document Parsing)
app.post('/api/ai/parse-doc', async (req, res) => {
  try {
    const { textContent, imageBase64, mimeType = 'image/jpeg', apiKey } = req.body;

    const parts: any[] = [];
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: imageBase64.replace(/^data:image\/[a-z]+;base64,/, ''),
        },
      });
      parts.push({
        text: 'Hãy đọc ảnh chụp trang sách / đề kiểm tra này và bóc tách toàn bộ các câu hỏi trắc nghiệm thành danh sách câu hỏi chuẩn GDPT 2018.',
      });
    } else if (textContent) {
      parts.push({
        text: `Hãy phân tích đoạn văn bản sau và trích xuất thành danh sách câu hỏi trắc nghiệm chuẩn GDPT 2018:\n\n${textContent}`,
      });
    } else {
      return res.status(400).json({ error: 'No text or image provided' });
    }

    parts.push({
      text: `Yêu cầu trả về JSON thuần túy (mảng các object):
[
  {
    "q": "Nội dung câu hỏi...",
    "format": "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER",
    "opts": ["A. ...", "B. ...", "C. ...", "D. ..."],
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
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '[]';
    const parsed = JSON.parse(text);
    return res.json({ success: true, questions: parsed });
  } catch (error: any) {
    console.error('Error parsing document with AI:', error);
    return res.status(500).json({ error: error.message || 'Failed to parse document' });
  }
});

// 3. AI Giải thích đáp án trực tiếp (AI Tutor on-screen)
app.post('/api/ai/explain', async (req, res) => {
  try {
    const { question, format, opts, correct, tfItems, shortAnswer, wrongCount = 0, rightCount = 0, apiKey } = req.body;

    const prompt = `Bạn là giáo viên giàu kinh nghiệm đang giảng bài trực tiếp trên máy chiếu lớp học.
Hãy giải thích ngắn gọn, súc tích (khoảng 3–5 câu gạch đầu dòng), sinh động cho câu hỏi sau đây:
Câu hỏi: ${question}
Dạng thức: ${format || 'MULTIPLE_CHOICE'}
${opts ? `Các phương án: ${JSON.stringify(opts)}\nĐáp án đúng chỉ số: ${correct} (${opts[correct]})` : ''}
${tfItems ? `Các ý Đúng/Sai: ${JSON.stringify(tfItems)}` : ''}
${shortAnswer ? `Đáp án ngắn đúng: ${shortAnswer}` : ''}
Thống kê lớp học vừa rồi: ${rightCount} học sinh làm ĐÚNG, ${wrongCount} học sinh làm SAI.

Hãy chỉ rõ:
- Vì sao phương án đúng là chính xác (bản chất kiến thức/công thức).
- Lỗi sai phổ biến mà các bạn học sinh thường mắc phải.
- Mẹo ghi nhớ nhanh để không bao giờ bị bẫy ở câu này nữa.`;

    const ai = getGenAIClient(apiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return res.json({ success: true, explanation: response.text });
  } catch (error: any) {
    console.error('Error explaining answer:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate explanation' });
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
      // Nếu là gói đồng bộ câu hỏi mới (QUIZ_SYNC / GAME_SWITCHED / MATCH_START), cập nhật ngay vào latestHeartbeat
      if (
        (payload.type === 'QUIZ_SYNC' || payload.type === 'GAME_SWITCHED' || payload.type === 'MATCH_START') &&
        Array.isArray(payload.quiz) &&
        payload.quiz.length > 0
      ) {
        room.latestHeartbeat = {
          ...(room.latestHeartbeat || {}),
          type: 'HOST_HEARTBEAT',
          _mid: payload._mid || 'hb_' + Date.now(),
          gameType: payload.gameType || room.latestHeartbeat?.gameType || 'TUG',
          status: payload.status || room.latestHeartbeat?.status || 'LOBBY',
          globalQIndex: typeof payload.qIndex === 'number' ? payload.qIndex : (payload.globalQIndex ?? 0),
          quiz: payload.quiz,
          question: payload.question || payload.quiz[0]
        };
      }

      // Kiểm tra xem gói tin PLAYER_READY_ROPE / AUTO_ENTER_ARENA có thay đổi gì mới không để tránh làm tràn hàng đợi sự kiện
      let isDuplicatePlayerPing = false;
      if (
        (payload.type === 'AUTO_ENTER_ARENA' ||
          payload.type === 'PLAYER_READY_ROPE' ||
          payload.type === 'PLAYER_FINISH_QUIZ') &&
        payload.playerId
      ) {
        const prevP = room.players[payload.playerId];
        const nextReady = payload.type === 'PLAYER_READY_ROPE' || payload.type === 'PLAYER_FINISH_QUIZ' || Boolean(prevP?.ready);
        const nextScore = typeof payload.savedScore === 'number' ? payload.savedScore : prevP?.savedScore;
        const nextCorrect = typeof payload.savedCorrect === 'number' ? payload.savedCorrect : prevP?.savedCorrect;
        const nextName = payload.playerName || prevP?.playerName || 'Học sinh';

        if (
          prevP &&
          prevP.ready === nextReady &&
          prevP.savedScore === nextScore &&
          prevP.savedCorrect === nextCorrect &&
          prevP.playerName === nextName &&
          payload.type !== 'PLAYER_FINISH_QUIZ'
        ) {
          isDuplicatePlayerPing = true;
        }

        room.players[payload.playerId] = {
          ...(prevP || {}),
          playerId: payload.playerId,
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

      if (payload.type === 'MATCH_START' || payload.type === 'GAME_SWITCH' || payload.type === 'GAME_SWITCHED') {
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
