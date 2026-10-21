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
