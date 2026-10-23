import { QuizItem, QuestionFormat } from '../types';
import { cleanQuestionTitleText, parseHTMLToQuiz } from '../data/defaultSubjects';

// Supported modern Gemini models with automatic fallback (strictly avoiding deprecated models)
const PRIMARY_MODEL = 'gemini-2.5-flash';
const SECONDARY_MODEL = 'gemini-3.8-flash';
const API_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function getStoredGeminiKey(): string {
  try {
    const key = localStorage.getItem('gemini_api_key') || '';
    if (key.trim()) return key.trim();
  } catch {}
  return ((import.meta as any).env?.VITE_GEMINI_API_KEY as string) || '';
}

export function saveStoredGeminiKey(key: string): void {
  try {
    localStorage.setItem('gemini_api_key', key.trim());
  } catch {}
}

export function removeStoredGeminiKey(): void {
  try {
    localStorage.removeItem('gemini_api_key');
  } catch {}
}

// 1. Client-Side AI Soạn Đề Thông Minh Chuẩn GDPT 2018 (Toán, Lý, Hóa, Sinh, STEM)
export async function generateQuestionsClientSide(params: {
  topic: string;
  subject: string;
  level: string;
  count: number;
  apiKey?: string;
}): Promise<QuizItem[]> {
  const apiKey = params.apiKey || getStoredGeminiKey();

  if (!apiKey) {
    // Trả về ngân hàng câu hỏi STEM ngoại tuyến chuyên sâu chất lượng cao
    console.info('No Gemini API Key provided, loading rich offline fallback questions.');
    return getOfflineFallbackQuestions(params.topic, params.subject, params.count);
  }

  const prompt = `Bạn là chuyên gia giáo dục và thẩm định đề thi Quốc gia cấp THPT theo chương trình GDPT 2018 tại Việt Nam (SGK Kết nối tri thức).
Hãy tạo ${params.count} câu hỏi trắc nghiệm chất lượng cao, sâu sắc, có tính phân hóa cho môn "${params.subject || 'Sinh học'}", chủ đề: "${params.topic}", mức độ nhận thức: "${params.level}".

YÊU CẦU ĐẶC BIỆT VỀ CÔNG THỨC TOÁN, LÝ, HÓA, SINH (STEM) & SƠ ĐỒ:
1. Mọi công thức toán, lý, hóa, sinh BẮT BUỘC kẹp trong cặp dấu $...$ (inline LaTeX) hoặc $$...$$ (block LaTeX). Ví dụ: $f(x) = \\frac{2x-1}{x+1}$, $T = 2\\pi\\sqrt{\\frac{l}{g}}$, $Fe_2(SO_4)_3$, $P: \\frac{AB}{ab} \\times \\frac{ab}{ab}$.
2. Mũ số, chỉ số dưới viết đúng chuẩn LaTeX: $x^2$, $H_2SO_4$, $I^A I^B$, $2n = 46$.
3. Nếu câu hỏi có sơ đồ/đồ thị/thí nghiệm, hãy mô tả ngắn trong ngoặc vuông đầu câu dẫn: [Sơ đồ mạch điện R-L-C nối tiếp] hoặc [Đồ thị hàm số $y=f'(x)$] hoặc [Sơ đồ phả hệ di truyền bệnh máu khó đông].

ĐẢM BẢO CHUẨN CẤU TRÚC ĐỀ THI TỐT NGHIỆP THPT TỪ NĂM 2025 (3 DẠNG THỨC):
1. "MULTIPLE_CHOICE" (Dạng thức I): Trắc nghiệm 4 lựa chọn (A, B, C, D) có đúng 1 phương án đúng duy nhất. "correct" là chỉ số từ 0 đến 3.
2. "TRUE_FALSE" (Dạng thức II): Câu hỏi Đúng/Sai chùm đủ 4 ý a, b, c, d độc lập, logic. "tfItems" gồm đúng 4 phần tử có label ('a','b','c','d'), text mệnh đề, và isCorrect (boolean).
3. "SHORT_ANSWER" (Dạng thức III): Câu hỏi Trả lời ngắn, yêu cầu học sinh tính toán ra kết quả là số nguyên, số thập phân hoặc từ khóa cốt lõi (ví dụ: "12.5", "4", "3120"). "shortAnswer" là chuỗi kết quả.

Trả về duy nhất JSON thuần túy (mảng các object):
[
  {
    "q": "Nội dung câu hỏi có công thức LaTeX...",
    "format": "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER",
    "opts": ["Phương án A", "Phương án B", "Phương án C", "Phương án D"],
    "correct": 0,
    "tfItems": [
      { "label": "a", "text": "Mệnh đề a...", "isCorrect": true },
      { "label": "b", "text": "Mệnh đề b...", "isCorrect": false },
      { "label": "c", "text": "Mệnh đề c...", "isCorrect": true },
      { "label": "d", "text": "Mệnh đề d...", "isCorrect": false }
    ],
    "shortAnswer": "12.5",
    "explanation": "Hướng dẫn giải chi tiết, chỉ rõ bản chất định luật và các bước tính..."
  }
]
Không chèn markdown backticks hay giải thích bên ngoài JSON.`;

  // Try primary model then secondary model (gemini-2.5-flash, gemini-3.8-flash)
  const modelsToTry = [PRIMARY_MODEL, SECONDARY_MODEL];
  for (const model of modelsToTry) {
    try {
      const url = `${API_URL_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.warn(`Model ${model} returned non-200:`, errData);
        continue;
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any, i: number) => ({
          qid: i,
          q: cleanQuestionTitleText(item.q || ''),
          format: item.format || 'MULTIPLE_CHOICE',
          opts: item.opts || [],
          correct: typeof item.correct === 'number' ? item.correct : 0,
          tfItems: item.tfItems || [],
          shortAnswer: item.shortAnswer || '',
          explanation: item.explanation || '',
          rightCount: 0,
          wrongCount: 0,
        }));
      }
    } catch (err) {
      console.warn(`Error calling Gemini with model ${model}:`, err);
    }
  }

  // Graceful fallback to offline rich questions if API failed
  return getOfflineFallbackQuestions(params.topic, params.subject, params.count);
}

// 2. Client-Side AI Giải Thích & Gia Sư Trực Tuyến (AI Tutor)
export async function explainQuestionClientSide(params: {
  question: string;
  format?: QuestionFormat;
  opts?: string[];
  correct?: number;
  tfItems?: { label: string; text: string; isCorrect: boolean }[];
  shortAnswer?: string;
  rightCount?: number;
  wrongCount?: number;
  apiKey?: string;
}): Promise<string> {
  const apiKey = params.apiKey || getStoredGeminiKey();

  if (!apiKey) {
    return generateOfflineExplanation(params);
  }

  const prompt = `Bạn là chuyên gia sư phạm THPT luyện thi tốt nghiệp Quốc gia. Hãy hướng dẫn giải chi tiết, rõ ràng và dễ hiểu cho câu hỏi sau (sử dụng LaTeX $...$ cho công thức toán lý hóa):
Nội dung câu hỏi: ${params.question}
Dạng thức câu hỏi: ${params.format || 'MULTIPLE_CHOICE'}
${params.opts && typeof params.correct === 'number' ? `4 đáp án: ${JSON.stringify(params.opts)}\nĐáp án đúng: ${params.opts[params.correct] || ''}` : ''}
${params.tfItems ? `Mệnh đề Đúng/Sai: ${JSON.stringify(params.tfItems)}` : ''}
${params.shortAnswer ? `Đáp án đúng (trả lời ngắn): ${params.shortAnswer}` : ''}
${params.rightCount !== undefined ? `Thống kê câu này: ${params.rightCount} học sinh trả lời đúng, ${params.wrongCount || 0} học sinh trả lời sai.` : ''}

Trình bày theo 4 phần rõ ràng:
🎯 Bản chất lý thuyết & Các bước giải chi tiết:
⚠️ Bẫy sai thường gặp trong đề thi tốt nghiệp:
💡 Mẹo giải nhanh / Phương pháp tư duy 10 giây:
📊 Đánh giá mức độ câu hỏi:`;

  const modelsToTry = [PRIMARY_MODEL, SECONDARY_MODEL];
  for (const model of modelsToTry) {
    try {
      const url = `${API_URL_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (!res.ok) {
        continue;
      }

      const data = await res.json();
      const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (answer && answer.trim()) {
        return answer.trim();
      }
    } catch (err) {
      console.warn(`Error fetching AI explanation with model ${model}:`, err);
    }
  }

  return generateOfflineExplanation(params);
}

// 3. Client-Side AI Bóc Tách Đề / OCR với khả năng nhận diện công thức LaTeX và sơ đồ
export async function parseDocClientSide(params: {
  textContent?: string;
  imageBase64?: string;
  mimeType?: string;
  apiKey?: string;
}): Promise<QuizItem[]> {
  const apiKey = params.apiKey || getStoredGeminiKey();

  if (params.textContent && !params.imageBase64) {
    const directParsed = parseHTMLToQuiz(params.textContent, undefined, params.textContent);
    if (directParsed && directParsed.length > 0 && !apiKey) {
      return directParsed;
    }
    if (!apiKey) {
      return directParsed;
    }
  }

  if (!apiKey) {
    throw new Error('Chưa cài đặt Gemini API Key. Vui lòng bấm biểu tượng ⚙️ ở góc trên để dán API Key miễn phí từ Google AI Studio!');
  }

  const parts: any[] = [];
  if (params.imageBase64) {
    parts.push({
      inlineData: {
        mimeType: params.mimeType || 'image/jpeg',
        data: params.imageBase64.replace(/^data:image\/[a-z]+;base64,/, ''),
      },
    });
    parts.push({
      text: 'Hãy đọc ảnh chụp trang sách / đề kiểm tra này và bóc tách toàn bộ câu hỏi trắc nghiệm thành danh sách câu hỏi chuẩn GDPT 2018. Mọi công thức Toán, Lý, Hóa, Sinh hãy chuyển về dạng LaTeX chuẩn kẹp trong $...$.',
    });
  } else if (params.textContent) {
    parts.push({
      text: `Hãy phân tích văn bản sau và trích xuất thành danh sách câu hỏi trắc nghiệm chuẩn GDPT 2018 (giữ nguyên công thức toán lý hóa kẹp trong $...$):\n\n${params.textContent}`,
    });
  }

  parts.push({
    text: `Yêu cầu trả về JSON thuần túy (mảng các object):
[
  {
    "q": "Nội dung câu hỏi (kẹp công thức trong $...$)...",
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

  const modelsToTry = [PRIMARY_MODEL, SECONDARY_MODEL];
  for (const model of modelsToTry) {
    try {
      const url = `${API_URL_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!res.ok) {
        continue;
      }

      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      const cleanJson = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any, i: number) => ({
          qid: i,
          q: cleanQuestionTitleText(item.q || item.question || ''),
          format: item.format || 'MULTIPLE_CHOICE',
          opts: Array.isArray(item.opts || item.options)
            ? (item.opts || item.options).map((o: any) =>
                String(o || '').replace(/^[A-D][\.\:\)\/]\s*/i, '').trim()
              )
            : [],
          correct:
            typeof item.correct === 'number'
              ? item.correct
              : typeof item.correct === 'string' && /^[A-D]$/i.test(item.correct.trim())
              ? item.correct.trim().toUpperCase().charCodeAt(0) - 65
              : 0,
          tfItems: item.tfItems || [],
          shortAnswer: item.shortAnswer || '',
          explanation: item.explanation || '',
          rightCount: 0,
          wrongCount: 0,
        }));
      }
    } catch (err: any) {
      console.warn(`Error parsing doc with model ${model}:`, err);
    }
  }

  if (params.textContent) {
    return parseHTMLToQuiz(params.textContent, undefined, params.textContent);
  }
  return [];
}

// ==========================================
// OFFLINE INTELLIGENT FALLBACK GENERATORS (RICH STEM BANK)
// ==========================================

function generateOfflineExplanation(params: {
  question: string;
  format?: QuestionFormat;
  opts?: string[];
  correct?: number;
  tfItems?: { label: string; text: string; isCorrect: boolean }[];
  shortAnswer?: string;
  rightCount?: number;
  wrongCount?: number;
}): string {
  const correctOptText = params.opts && typeof params.correct === 'number' ? params.opts[params.correct] : '';
  const qClean = cleanQuestionTitleText(params.question);

  let explanation = `📌 **HƯỚNG DẪN GIẢI CHI TIẾT & PHÂN TÍCH (CHUẨN GDPT 2018):**\n\n`;

  if (params.format === 'TRUE_FALSE' && params.tfItems) {
    explanation += `🎯 **Bản chất kiến thức từng ý:**\n`;
    params.tfItems.forEach(tf => {
      explanation += `• **Ý ${tf.label.toUpperCase()} (${tf.isCorrect ? 'ĐÚNG' : 'SAI'}):** ${tf.text}\n`;
    });
    explanation += `\n⚠️ **Bẫy sai học sinh dễ nhầm:** Đọc sót các từ phủ định hoặc điều kiện giới hạn trong từng mệnh đề.\n`;
    explanation += `💡 **Mẹo giải nhanh:** Xét tính đúng/sai độc lập cho từng mệnh đề, bám sát sách giáo khoa Kết nối tri thức.`;
    return explanation;
  }

  if (params.format === 'SHORT_ANSWER') {
    explanation += `🎯 **Đáp án chính xác:** **${params.shortAnswer || 'Xem lại dữ liệu đề'}**\n`;
    explanation += `🔍 **Vì sao đúng:** Áp dụng định nghĩa và công thức tính toán cốt lõi của bài học.\n`;
    explanation += `⚠️ **Bẫy sai thường gặp:** Nhầm lẫn đơn vị tính hoặc làm tròn số chưa đúng quy tắc toán học.\n`;
    explanation += `💡 **Mẹo:** Kiểm tra lại phép tính và chỉ điền con số hoặc từ khóa ngắn gọn vào ô trả lời.`;
    return explanation;
  }

  // MULTIPLE_CHOICE
  explanation += `🎯 **Vì sao đáp án đúng là chính xác:**\n`;
  explanation += `Phương án **${correctOptText}** phản ánh đúng định luật và bản chất kiến thức cơ bản của chủ đề "${qClean}".\n\n`;
  explanation += `⚠️ **Bẫy sai học sinh dễ nhầm:** Các phương án còn lại là phương án nhiễu, thường đúng một phần nhưng thiếu điều kiện bắt buộc.\n\n`;
  explanation += `💡 **Mẹo nhớ nhanh:** Tập trung vào các từ khóa mang tính chất cốt lõi để loại trừ các đáp án sai trong 5 giây đầu.`;

  if (params.rightCount !== undefined && params.wrongCount !== undefined && (params.rightCount > 0 || params.wrongCount > 0)) {
    explanation += `\n\n📊 **Thống kê lớp học:** Đã có ${params.rightCount} bạn làm đúng và ${params.wrongCount} bạn làm sai ở câu này.`;
  }

  return explanation;
}

/**
 * Rich curated question bank across Toán, Vật lí, Hóa học, Sinh học chuẩn GDPT 2018
 */
function getOfflineFallbackQuestions(topic: string, subject: string, count: number): QuizItem[] {
  const tLower = (topic + ' ' + subject).toLowerCase();

  // 1. NGÂN HÀNG TOÁN HỌC (Giải tích, Hình học không gian, Xác suất)
  const mathBank: QuizItem[] = [
    {
      qid: 101,
      q: 'Cho hàm số $y = \\frac{2x - 1}{x + 1}$. Đường tiệm cận ngang của đồ thị hàm số có phương trình là:',
      format: 'MULTIPLE_CHOICE',
      opts: ['$y = 2$', '$y = -1$', '$x = -1$', '$x = 2$'],
      correct: 0,
      explanation: 'Tiệm cận ngang $y = \\lim_{x \\to \\pm\\infty} \\frac{2x-1}{x+1} = 2$. Do đó $y = 2$.',
      rightCount: 0,
      wrongCount: 0,
    },
    {
      qid: 102,
      q: 'Cho hình chóp $S.ABC$ có đáy $ABC$ là tam giác vuông tại $B$, $SA \\perp (ABC)$.',
      format: 'TRUE_FALSE',
      opts: [],
      correct: -1,
      tfItems: [
        { label: 'a', text: 'Đường thẳng $SA$ vuông góc với mặt phẳng đáy $(ABC)$.', isCorrect: true },
        { label: 'b', text: 'Tam giác $SBC$ là tam giác vuông tại $B$.', isCorrect: true },
        { label: 'c', text: 'Mặt phẳng $(SAB)$ vuông góc với mặt phẳng $(SBC)$.', isCorrect: false },
        { label: 'd', text: 'Góc giữa đường thẳng $SC$ và mặt phẳng đáy là góc $\\widehat{SCA}$.', isCorrect: true },
      ],
      explanation: 'Vì $BC \\perp AB$ và $BC \\perp SA \\implies BC \\perp (SAB) \\implies BC \\perp SB$.',
      rightCount: 0,
      wrongCount: 0,
    },
    {
      qid: 103,
      q: 'Tìm giá trị nhỏ nhất của hàm số $f(x) = x + \\frac{4}{x}$ trên khoảng $(0; +\\infty)$.',
      format: 'SHORT_ANSWER',
      opts: ['4'],
      correct: 0,
      shortAnswer: '4',
      explanation: 'Áp dụng bất đẳng thức Cauchy: $x + \\frac{4}{x} \\ge 2\\sqrt{x \\cdot \\frac{4}{x}} = 4$. Dấu bằng xảy ra khi $x = 2$.',
      rightCount: 0,
      wrongCount: 0,
    },
  ];

  // 2. NGÂN HÀNG VẬT LÍ (Dao động cơ, Sóng cơ, Điện xoay chiều, Hạt nhân)
  const physicsBank: QuizItem[] = [
    {
      qid: 201,
      q: 'Một con lắc lò xo có độ cứng $k = 100\\text{ N/m}$, gắn vật nặng khối lượng $m = 100\\text{ g}$. Chu kì dao động riêng của con lắc là bao nhiêu giây (lấy $\\pi^2 = 10$)?',
      format: 'SHORT_ANSWER',
      opts: ['0.2'],
      correct: 0,
      shortAnswer: '0.2',
      explanation: '$T = 2\\pi\\sqrt{\\frac{m}{k}} = 2\\pi\\sqrt{\\frac{0.1}{100}} = 2\\pi \\cdot \\frac{1}{10\\sqrt{10}} = 0.2\\text{ s}$.',
      rightCount: 0,
      wrongCount: 0,
    },
    {
      qid: 202,
      q: '[Sơ đồ đoạn mạch điện R-L-C nối tiếp] Đặt điện áp xoay chiều $u = U_0\\cos(\\omega t)$ vào hai đầu đoạn mạch gồm $R, L, C$ mắc nối tiếp. Khi xảy ra hiện tượng cộng hưởng điện:',
      format: 'TRUE_FALSE',
      opts: [],
      correct: -1,
      tfItems: [
        { label: 'a', text: 'Cảm kháng bằng dung kháng ($Z_L = Z_C$).', isCorrect: true },
        { label: 'b', text: 'Cường độ dòng điện hiệu dụng trong mạch đạt giá trị cực đại ($I_{\\max} = \\frac{U}{R}$).', isCorrect: true },
        { label: 'c', text: 'Hệ số công suất của đoạn mạch bằng 0.', isCorrect: false },
        { label: 'd', text: 'Điện áp giữa hai đầu đoạn mạch cùng pha với cường độ dòng điện.', isCorrect: true },
      ],
      explanation: 'Khi cộng hưởng, $\\cos\\varphi = 1$ chứ không phải bằng 0.',
      rightCount: 0,
      wrongCount: 0,
    },
  ];

  // 3. NGÂN HÀNG HÓA HỌC (Este - Lipit, Hóa học hữu cơ, Kim loại, Cân bằng hóa học)
  const chemBank: QuizItem[] = [
    {
      qid: 301,
      q: 'Thủy phân hoàn toàn $8.8\\text{ gam}$ ethyl acetate ($CH_3COOC_2H_5$) bằng dung dịch $NaOH$ dư thu được bao nhiêu gam muối sodium acetate ($CH_3COONa$)?',
      format: 'SHORT_ANSWER',
      opts: ['8.2'],
      correct: 0,
      shortAnswer: '8.2',
      explanation: '$n_{este} = \\frac{8.8}{88} = 0.1\\text{ mol} \\implies m_{muối} = 0.1 \\times 82 = 8.2\\text{ gam}$.',
      rightCount: 0,
      wrongCount: 0,
    },
    {
      qid: 302,
      q: 'Xét cân bằng hóa học sau trong bình kín: $N_2(k) + 3H_2(k) \\rightleftharpoons 2NH_3(k)$, $\\Delta_r H^o_{298} < 0$.',
      format: 'TRUE_FALSE',
      opts: [],
      correct: -1,
      tfItems: [
        { label: 'a', text: 'Phản ứng thuận là phản ứng tỏa nhiệt.', isCorrect: true },
        { label: 'b', text: 'Khi tăng nhiệt độ của hệ, cân bằng chuyển dịch theo chiều thuận.', isCorrect: false },
        { label: 'c', text: 'Khi tăng áp suất chung của hệ, cân bằng chuyển dịch theo chiều thuận.', isCorrect: true },
        { label: 'd', text: 'Thêm chất xúc tác Fe làm tăng hiệu suất phản ứng tổng hợp $NH_3$.', isCorrect: false },
      ],
      explanation: 'Tăng nhiệt độ làm cân bằng dịch theo chiều thu nhiệt (chiều nghịch). Chất xúc tác chỉ làm tăng tốc độ đạt cân bằng chứ không làm chuyển dịch cân bằng.',
      rightCount: 0,
      wrongCount: 0,
    },
  ];

  // 4. NGÂN HÀNG SINH HỌC 10, 11, 12 CHUẨN KẾT NỐI TRI THỨC
  const bioBank: QuizItem[] = [
    {
      qid: 401,
      q: 'Bộ ba (codon) nào sau đây trên phân tử mRNA vừa làm tín hiệu mở đầu dịch mã, vừa mã hóa cho amino acid Methionine ở sinh vật nhân thực?',
      format: 'MULTIPLE_CHOICE',
      opts: ['5\'-AUG-3\'', '5\'-UAA-3\'', '5\'-UAG-3\'', '5\'-UGA-3\''],
      correct: 0,
      explanation: '5\'-AUG-3\' là codon mở đầu duy nhất trên mRNA. Ba bộ ba còn lại UAA, UAG, UGA là các codon kết thúc.',
      rightCount: 0,
      wrongCount: 0,
    },
    {
      qid: 402,
      q: 'Trong các phát biểu sau về operon Lac ở vi khuẩn E. coli (SGK Sinh học 12):',
      format: 'TRUE_FALSE',
      opts: [],
      correct: -1,
      tfItems: [
        { label: 'a', text: 'Gen điều hòa (R) không nằm trong cấu trúc của operon Lac.', isCorrect: true },
        { label: 'b', text: 'Vùng vận hành (O) là nơi protein ức chế liên kết để ngăn cản phiên mã.', isCorrect: true },
        { label: 'c', text: 'Khi môi trường có lactose, phân tử allolactose sẽ gắn vào vùng khởi động (P).', isCorrect: false },
        { label: 'd', text: 'Các gen cấu trúc Z, Y, A được phiên mã tạo thành một phân tử mRNA chung.', isCorrect: true },
      ],
      explanation: 'Khi có lactose, chất cảm ứng liên kết với protein ức chế làm biến đổi cấu hình của nó chứ không gắn vào vùng P.',
      rightCount: 0,
      wrongCount: 0,
    },
    {
      qid: 403,
      q: 'Một gen ở vi khuẩn có 2400 nucleotide, trong đó số nucleotide loại Adenine (A) chiếm 20%. Số liên kết hydrogen của gen này bằng bao nhiêu?',
      format: 'SHORT_ANSWER',
      opts: ['3120'],
      correct: 0,
      shortAnswer: '3120',
      explanation: 'A = T = 2400 * 20% = 480. G = X = (2400 - 2*480) / 2 = 720. Số liên kết H = 2A + 3G = 2*480 + 3*720 = 960 + 2160 = 3120.',
      rightCount: 0,
      wrongCount: 0,
    },
    {
      qid: 404,
      q: 'Theo quy luật phân li độc lập của Mendel, phép lai $P: AaBb \\times AaBb$ cho tỉ lệ cá thể mang kiểu hình trội về cả 2 tính trạng ($A-B-$) ở F1 là bao nhiêu phần mười sáu?',
      format: 'SHORT_ANSWER',
      opts: ['9'],
      correct: 0,
      shortAnswer: '9',
      explanation: 'Tỉ lệ kiểu hình phân li độc lập ở F2: 9 A-B- : 3 A-bb : 3 aaB- : 1 aabb. Số cá thể trội 2 tính trạng là 9/16.',
      rightCount: 0,
      wrongCount: 0,
    },
  ];

  let selectedBank: QuizItem[] = [];
  if (tLower.includes('toán') || tLower.includes('giải tích') || tLower.includes('hình học') || tLower.includes('hàm số')) {
    selectedBank = [...mathBank, ...physicsBank];
  } else if (tLower.includes('vật lí') || tLower.includes('vật lý') || tLower.includes('dao động') || tLower.includes('điện')) {
    selectedBank = [...physicsBank, ...mathBank];
  } else if (tLower.includes('hóa') || tLower.includes('hóa học') || tLower.includes('este') || tLower.includes('cân bằng')) {
    selectedBank = [...chemBank, ...bioBank];
  } else {
    // Default or Bio
    selectedBank = [...bioBank, ...mathBank, ...chemBank, ...physicsBank];
  }

  const result: QuizItem[] = [];
  for (let i = 0; i < count; i++) {
    const item = selectedBank[i % selectedBank.length];
    result.push({
      ...item,
      qid: i,
      q: cleanQuestionTitleText(item.q),
    });
  }

  return result;
}
