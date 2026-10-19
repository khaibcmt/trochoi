import { QuizItem, QuestionFormat } from '../types';
import { cleanQuestionTitleText, parseHTMLToQuiz } from '../data/defaultSubjects';

// Supported Gemini models with automatic fallback
const PRIMARY_MODEL = 'gemini-2.5-flash';
const SECONDARY_MODEL = 'gemini-1.5-flash';
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

// 1. Client-Side AI Soạn Đề (Direct REST call to Gemini, with zero backend dependency)
export async function generateQuestionsClientSide(params: {
  topic: string;
  subject: string;
  level: string;
  count: number;
  apiKey?: string;
}): Promise<QuizItem[]> {
  const apiKey = params.apiKey || getStoredGeminiKey();

  if (!apiKey) {
    // Return high quality offline fallback questions if no API key
    console.info('No Gemini API Key provided, loading rich offline fallback questions.');
    return getOfflineFallbackQuestions(params.topic, params.subject, params.count);
  }

  const prompt = `Bạn là chuyên gia giáo dục THPT giàu kinh nghiệm theo chương trình GDPT 2018 tại Việt Nam (SGK Kết nối tri thức).
Hãy tạo ${params.count} câu hỏi trắc nghiệm chất lượng cao cho môn "${params.subject || 'Sinh học'}", chủ đề: "${params.topic}", mức độ nhận thức: "${params.level}".
Đa dạng hóa các dạng câu hỏi chuẩn cấu trúc thi tốt nghiệp THPT từ năm 2025:
1. "MULTIPLE_CHOICE": Trắc nghiệm 4 lựa chọn (A, B, C, D) có 1 đáp án đúng duy nhất.
2. "TRUE_FALSE": Câu hỏi đúng/sai chùm 4 ý a, b, c, d (mỗi ý có nội dung mệnh đề và đáp án boolean true/false).
3. "SHORT_ANSWER": Câu hỏi trả lời ngắn (học sinh điền số nguyên, số thập phân hoặc từ khóa ngắn gọn).

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

  // Try primary model then secondary model
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

  // Graceful fallback to offline questions if API failed
  return getOfflineFallbackQuestions(params.topic, params.subject, params.count);
}

// 2. Client-Side AI Giải Thích (AI Tutor)
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

  const prompt = `Hãy phân tích ngắn gọn trong 3-4 dòng vì sao đáp án đúng là chính xác, giải thích dễ hiểu cho học sinh THPT:
Nội dung câu hỏi: ${params.question}
Dạng thức câu hỏi: ${params.format || 'MULTIPLE_CHOICE'}
${params.opts && typeof params.correct === 'number' ? `4 đáp án: ${JSON.stringify(params.opts)}\nĐáp án đúng: ${params.opts[params.correct] || ''}` : ''}
${params.tfItems ? `Mệnh đề Đúng/Sai: ${JSON.stringify(params.tfItems)}` : ''}
${params.shortAnswer ? `Đáp án đúng (trả lời ngắn): ${params.shortAnswer}` : ''}
${params.rightCount !== undefined ? `Thống kê câu này: ${params.rightCount} học sinh trả lời đúng, ${params.wrongCount || 0} học sinh trả lời sai.` : ''}

Trình bày ngắn gọn, súc tích trong 3-4 dòng dễ hiểu cho học sinh THPT ôn thi tốt nghiệp:
- 🎯 Vì sao đáp án đúng là chính xác:
- ⚠️ Bẫy sai thường gặp:
- 💡 Mẹo nhớ nhanh:`;

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

// 3. Client-Side AI Bóc Tách Đề / OCR
export async function parseDocClientSide(params: {
  textContent?: string;
  imageBase64?: string;
  mimeType?: string;
  apiKey?: string;
}): Promise<QuizItem[]> {
  const apiKey = params.apiKey || getStoredGeminiKey();

  if (params.textContent && !apiKey) {
    // If no key but text was provided, use built-in HTML/text parser
    return parseHTMLToQuiz(params.textContent);
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
      text: 'Hãy đọc ảnh chụp trang sách / đề kiểm tra này và bóc tách toàn bộ câu hỏi trắc nghiệm thành danh sách câu hỏi chuẩn GDPT 2018.',
    });
  } else if (params.textContent) {
    parts.push({
      text: `Hãy phân tích đoạn văn bản sau và trích xuất thành danh sách câu hỏi trắc nghiệm chuẩn GDPT 2018:\n\n${params.textContent}`,
    });
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
    } catch (err: any) {
      console.warn(`Error parsing doc with model ${model}:`, err);
    }
  }

  if (params.textContent) {
    return parseHTMLToQuiz(params.textContent);
  }
  return [];
}

// ==========================================
// OFFLINE INTELLIGENT FALLBACK GENERATORS
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
 * Rich curated question bank for Sinh học 10, 11, 12 chuẩn SGK Kết nối tri thức
 * Covers MULTIPLE_CHOICE (Phần I), TRUE_FALSE (Phần II), and SHORT_ANSWER (Phần III)
 */
function getOfflineFallbackQuestions(topic: string, subject: string, count: number): QuizItem[] {
  const tLower = (topic + ' ' + subject).toLowerCase();

  // 1. Sinh học 10 (Tế bào học, Enzyme, Quang hợp, Hô hấp, Phân bào)
  const bio10Bank: QuizItem[] = [
    {
      qid: 1,
      q: 'Phân tử sinh học nào sau đây đóng vai trò là nguồn năng lượng chính và trực tiếp cho các hoạt động sống của tế bào?',
      format: 'MULTIPLE_CHOICE',
      opts: ['Adenosine triphosphate (ATP)', 'Glucose', 'Acid béo', 'Protein'],
      correct: 0,
      explanation: 'ATP là phân tử giàu năng lượng, đóng vai trò là "đồng tiền năng lượng" phổ quát của mọi tế bào.',
      rightCount: 0,
      wrongCount: 0,
    },
    {
      qid: 2,
      q: 'Quá trình phân giải hiếu khí (hô hấp tế bào) diễn ra chủ yếu ở bào quan nào trong tế bào nhân thực?',
      format: 'MULTIPLE_CHOICE',
      opts: ['Ti thể (chất nền và màng trong)', 'Lục lạp', 'Bộ máy Golgi', 'Lysosome'],
      correct: 0,
      explanation: 'Giai đoạn chu trình Krebs diễn ra ở chất nền ti thể và chuỗi chuyền electron diễn ra ở màng trong ti thể.',
      rightCount: 0,
      wrongCount: 0,
    },
    {
      qid: 3,
      q: 'Trong các phát biểu sau về cấu trúc và chức năng của tế bào nhân thực (SGK Sinh 10 - Kết nối tri thức):',
      format: 'TRUE_FALSE',
      opts: [],
      correct: -1,
      tfItems: [
        { label: 'a', text: 'Nhân tế bào chứa vật chất di truyền là DNA liên kết với protein histone tạo thành nhiễm sắc chất.', isCorrect: true },
        { label: 'b', text: 'Ribosome là bào quan có hai lớp màng bao bọc thực hiện chức năng tổng hợp protein.', isCorrect: false },
        { label: 'c', text: 'Lưới nội chất hạt có đính các hạt ribosome trên bề mặt màng.', isCorrect: true },
        { label: 'd', text: 'Thành tế bào thực vật cấu tạo chủ yếu từ cellulose giúp bảo vệ và định hình tế bào.', isCorrect: true },
      ],
      explanation: 'Ribosome là bào quan không có màng bao bọc, cấu tạo từ rRNA và protein.',
      rightCount: 0,
      wrongCount: 0,
    },
    {
      qid: 4,
      q: 'Từ một tế bào mẹ ban đầu (2n = 24), sau 4 lần nguyên phân liên tiếp sẽ tạo ra bao nhiêu tế bào con?',
      format: 'SHORT_ANSWER',
      opts: ['16'],
      correct: 0,
      shortAnswer: '16',
      explanation: 'Số tế bào con = 2^k = 2^4 = 16 tế bào.',
      rightCount: 0,
      wrongCount: 0,
    },
  ];

  // 2. Sinh học 11 (Trao đổi nước & khoáng, Cảm ứng, Tuần hoàn, Hô hấp thực vật & động vật)
  const bio11Bank: QuizItem[] = [
    {
      qid: 5,
      q: 'Ở thực vật trên cạn, nước và ion khoáng từ đất được hấp thụ vào mạch gỗ của rễ theo hai con đường nào?',
      format: 'MULTIPLE_CHOICE',
      opts: ['Con đường gian bào và con đường tế bào chất', 'Con đường khí khổng và con đường cutin', 'Con đường mao dẫn và con đường trọng lực', 'Con đường thẩm tách và con đường ẩm bào'],
      correct: 0,
      explanation: 'Nước và khoáng đi vào qua lông hút theo 2 con đường: gian bào (bị đai Caspary chặn ở nội bì) và tế bào chất.',
      rightCount: 0,
      wrongCount: 0,
    },
    {
      qid: 6,
      q: 'Trong các nhận định sau về pha sáng và pha tối của quang hợp ở thực vật C3:',
      format: 'TRUE_FALSE',
      opts: [],
      correct: -1,
      tfItems: [
        { label: 'a', text: 'Quang phân li nước diễn ra trong xoang thylakoid tạo ra O2, H+ và electron.', isCorrect: true },
        { label: 'b', text: 'Chất nhận CO2 đầu tiên trong chu trình Calvin là phân tử RuBP (5C).', isCorrect: true },
        { label: 'c', text: 'Sản phẩm đầu tiên của chu trình Calvin là hợp chất 4 carbon (OAA).', isCorrect: false },
        { label: 'd', text: 'Pha tối diễn ra ở chất nền (stroma) của lục lạp mà không cần trực tiếp ánh sáng.', isCorrect: true },
      ],
      explanation: 'Sản phẩm đầu tiên của thực vật C3 là 3-PGA (3 carbon). Hợp chất 4C là ở thực vật C4.',
      rightCount: 0,
      wrongCount: 0,
    },
    {
      qid: 7,
      q: 'Một cây ngô có tổng diện tích lá là 0.5 m². Trong 1 giờ thoát ra 200 gam nước. Cường độ thoát hơi nước của cây ngô này bằng bao nhiêu g/m²/h?',
      format: 'SHORT_ANSWER',
      opts: ['400'],
      correct: 0,
      shortAnswer: '400',
      explanation: 'Cường độ thoát hơi nước = Lượng nước thoát / (Diện tích lá * Thời gian) = 200 / (0.5 * 1) = 400 g/m²/h.',
      rightCount: 0,
      wrongCount: 0,
    },
  ];

  // 3. Sinh học 12 (Di truyền, Tiến hóa, Sinh thái học - Trọng tâm thi tốt nghiệp THPT)
  const bio12Bank: QuizItem[] = [
    {
      qid: 8,
      q: 'Bộ ba (codon) nào sau đây trên phân tử mRNA vừa làm tín hiệu mở đầu dịch mã, vừa mã hóa cho amino acid Methionine ở sinh vật nhân thực?',
      format: 'MULTIPLE_CHOICE',
      opts: ['5\'-AUG-3\'', '5\'-UAA-3\'', '5\'-UAG-3\'', '5\'-UGA-3\''],
      correct: 0,
      explanation: '5\'-AUG-3\' là codon mở đầu duy nhất trên mRNA. Ba bộ ba còn lại UAA, UAG, UGA là các codon kết thúc.',
      rightCount: 0,
      wrongCount: 0,
    },
    {
      qid: 9,
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
      qid: 10,
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
      qid: 11,
      q: 'Theo quy luật phân li độc lập của Mendel, phép lai P: AaBb x AaBb cho tỉ lệ cá thể mang kiểu hình trội về cả 2 tính trạng (A-B-) ở F1 là bao nhiêu phần mười sáu?',
      format: 'SHORT_ANSWER',
      opts: ['9'],
      correct: 0,
      shortAnswer: '9',
      explanation: 'Tỉ lệ kiểu hình phân li độc lập ở F2: 9 A-B- : 3 A-bb : 3 aaB- : 1 aabb. Số cá thể trội 2 tính trạng là 9/16.',
      rightCount: 0,
      wrongCount: 0,
    },
    {
      qid: 12,
      q: 'Mối quan hệ sinh thái nào sau đây thuộc nhóm quan hệ đối kháng giữa các loài trong quần xã sinh vật?',
      format: 'MULTIPLE_CHOICE',
      opts: ['Cạnh tranh khác loài', 'Cộng sinh', 'Hội sinh', 'Hợp tác'],
      correct: 0,
      explanation: 'Cạnh tranh khác loài, kí sinh, vật ăn thịt - con mồi, ức chế cảm nhiễm thuộc quan hệ đối kháng; còn cộng sinh, hội sinh, hợp tác là hỗ trợ.',
      rightCount: 0,
      wrongCount: 0,
    },
    {
      qid: 13,
      q: 'Xét các nhân tố tiến hóa theo thuyết tiến hóa hiện đại:',
      format: 'TRUE_FALSE',
      opts: [],
      correct: -1,
      tfItems: [
        { label: 'a', text: 'Đột biến là nhân tố duy nhất tạo ra nguồn nguyên liệu sơ cấp cho tiến hóa.', isCorrect: true },
        { label: 'b', text: 'Chọn lọc tự nhiên tác động trực tiếp lên kiểu hình và gián tiếp làm biến đổi tần số alen.', isCorrect: true },
        { label: 'c', text: 'Giao phối không ngẫu nhiên làm thay đổi tần số alen của quần thể theo hướng xác định.', isCorrect: false },
        { label: 'd', text: 'Các yếu tố ngẫu nhiên có thể loại bỏ hoàn toàn một alen có lợi ra khỏi quần thể.', isCorrect: true },
      ],
      explanation: 'Giao phối không ngẫu nhiên không làm thay đổi tần số alen, chỉ làm thay đổi thành phần kiểu gen (tăng đồng hợp, giảm dị hợp).',
      rightCount: 0,
      wrongCount: 0,
    },
  ];

  // Select appropriate bank based on topic / grade
  let selectedBank: QuizItem[] = [];
  if (tLower.includes('10') || tLower.includes('tế bào') || tLower.includes('nguyên phân') || tLower.includes('phân bào')) {
    selectedBank = [...bio10Bank, ...bio12Bank];
  } else if (tLower.includes('11') || tLower.includes('nước') || tLower.includes('khoáng') || tLower.includes('quang hợp') || tLower.includes('cảm ứng')) {
    selectedBank = [...bio11Bank, ...bio12Bank];
  } else if (tLower.includes('12') || tLower.includes('di truyền') || tLower.includes('tiến hóa') || tLower.includes('sinh thái') || tLower.includes('gen') || tLower.includes('adn')) {
    selectedBank = [...bio12Bank, ...bio11Bank, ...bio10Bank];
  } else {
    // General combined bank: mix of 10, 11, 12
    selectedBank = [...bio12Bank, ...bio11Bank, ...bio10Bank];
  }

  // Shuffle slightly or take desired count
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
