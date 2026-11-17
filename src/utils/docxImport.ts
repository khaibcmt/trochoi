/**
 * Đợt 7 (Giai đoạn 1.2): MỞ FILE .docx THẬT — mammoth (.docx -> HTML) +
 * TIỀN XỬ LÝ OMML trên word/document.xml.
 *
 * Vì sao cần tiền xử lý: mammoth BỎ QUA hoàn toàn Equation của Word (thẻ
 * <m:oMath>/<m:oMathPara> trong word/document.xml) nên công thức sẽ biến mất
 * khi mở file. Trước khi đưa qua mammoth, hàm này mở .docx bằng JSZip, đọc
 * word/document.xml và thay:
 *   - mỗi khối <m:oMathPara>...</m:oMathPara> -> 1 đoạn văn (w:p) chứa $$latex$$
 *     (nếu khối đang nằm sẵn trong một <w:p> thì chỉ thay bằng 1 run w:r chứa
 *     $$latex$$ để XML vẫn hợp lệ — đoạn văn đó chính là nơi chứa công thức);
 *   - mỗi <m:oMath>...</m:oMath> còn lại -> 1 run <w:r><w:t>$latex$</w:t></w:r>.
 * LaTeX lấy từ convertWordOMMLToLatex (Đợt 2, src/data/defaultSubjects.ts) —
 * converter đệ quy đã xử lý phân số/căn/chỉ số/nary/hệ phương trình... Việc
 * quét thẻ ở đây đếm độ lồng của CHÍNH thẻ đó (oMathPara chứa oMath bên trong)
 * và xử lý oMathPara TRƯỚC oMath để không cắt nhầm khối hiển thị thành inline.
 * Chuỗi LaTeX được escape XML (&, <, >) trước khi chèn vào <w:t> để
 * document.xml vẫn là XML hợp lệ (mammoth giải mã ngược lại khi đọc).
 * Các phần còn lại của gói .docx giữ nguyên; nếu file không có Equation hoặc
 * không mở được dạng zip thì trả lại ArrayBuffer gốc cho mammoth tự xử lý.
 */
import JSZip from 'jszip';
import mammoth from 'mammoth';
import { convertWordOMMLToLatex } from '../data/defaultSubjects';

/** Escape các ký tự đặc biệt XML cho chuỗi LaTeX trước khi chèn vào <w:t>. */
function escapeXmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Tìm một phần tử theo tên thẻ trong chuỗi XML (có đếm lồng cùng thẻ) và trả
 * về [vị trí bắt đầu, vị trí kết thúc (ngay sau thẻ đóng)]. Cùng mẫu với
 * findOmmlElementRange trong defaultSubjects.ts.
 */
function findElementRange(s: string, tagName: string, fromIdx: number): [number, number] | null {
  const openRe = new RegExp(`<${tagName}\\b[^>]*?(/?)>`, 'i');
  const openMatch = openRe.exec(s.slice(fromIdx));
  if (!openMatch) return null;
  const start = fromIdx + openMatch.index;
  const openEnd = start + openMatch[0].length;
  if (openMatch[1] === '/') return [start, openEnd];
  const scanRe = new RegExp(`<(/?)${tagName}\\b[^>]*?(/?)>`, 'gi');
  scanRe.lastIndex = openEnd;
  let depth = 1;
  let sm: RegExpExecArray | null;
  while ((sm = scanRe.exec(s)) !== null) {
    if (sm[1] === '/') {
      depth--;
      if (depth === 0) return [start, scanRe.lastIndex];
    } else if (sm[2] !== '/') {
      depth++;
    }
  }
  return null;
}

/** Vị trí idx có đang nằm bên trong một đoạn <w:p>...</w:p> chưa đóng không? */
function isInsideParagraph(xml: string, idx: number): boolean {
  const before = xml.slice(0, idx);
  const lastOpen = Math.max(before.lastIndexOf('<w:p>'), before.lastIndexOf('<w:p '));
  const lastClose = before.lastIndexOf('</w:p>');
  return lastOpen > lastClose;
}

/** Thay toàn bộ Equation (OMML) trong nội dung word/document.xml bằng run chứa LaTeX. */
function transformOmmlInDocumentXml(xml: string): string {
  let out = xml;

  // 1. Khối hiển thị <m:oMathPara> -> $$...$$ (xử lý TRƯỚC m:oMath vì oMathPara chứa oMath)
  let cursor = 0;
  let guard = 0;
  while (guard++ < 1000) {
    const range = findElementRange(out, 'm:oMathPara', cursor);
    if (!range) break;
    const [start, end] = range;
    const latex = convertWordOMMLToLatex(out.slice(start, end)).trim();
    if (!latex) {
      out = out.slice(0, start) + out.slice(end);
      cursor = start;
      continue;
    }
    const run = `<w:r><w:t xml:space="preserve">${escapeXmlText(latex)}</w:t></w:r>`;
    // Ngoài đoạn văn thì bọc thành 1 đoạn <w:p> mới; đã ở trong <w:p> thì chỉ cần 1 run.
    const replacement = isInsideParagraph(out, start) ? run : `<w:p>${run}</w:p>`;
    out = out.slice(0, start) + replacement + out.slice(end);
    cursor = start + replacement.length;
  }

  // 2. Công thức inline <m:oMath> còn lại -> $...$ trong 1 run
  cursor = 0;
  guard = 0;
  while (guard++ < 5000) {
    const range = findElementRange(out, 'm:oMath', cursor);
    if (!range) break;
    const [start, end] = range;
    const latex = convertWordOMMLToLatex(out.slice(start, end)).trim();
    if (!latex) {
      out = out.slice(0, start) + out.slice(end);
      cursor = start;
      continue;
    }
    const replacement = `<w:r><w:t xml:space="preserve">${escapeXmlText(latex)}</w:t></w:r>`;
    out = out.slice(0, start) + replacement + out.slice(end);
    cursor = start + replacement.length;
  }

  return out;
}

/**
 * Mở gói .docx bằng JSZip, tiền xử lý OMML trong word/document.xml rồi đóng
 * gói lại thành ArrayBuffer mới. Mọi lỗi/không có Equation -> trả buffer gốc.
 */
async function preprocessDocxOmml(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docFile = zip.file('word/document.xml');
    if (!docFile) return arrayBuffer;
    const xml = await docFile.async('string');
    if (!/<m:oMath/i.test(xml)) return arrayBuffer;
    const transformed = transformOmmlInDocumentXml(xml);
    if (transformed === xml) return arrayBuffer;
    zip.file('word/document.xml', transformed);
    return await zip.generateAsync({ type: 'arraybuffer' });
  } catch {
    return arrayBuffer;
  }
}

/**
 * Chuyển nội dung file .docx (ArrayBuffer) thành HTML:
 * (a) tiền xử lý OMML trong word/document.xml (Equation -> $...$/$$...$$),
 * (b) đưa .docx đã biến đổi qua mammoth.convertToHtml.
 * styleMap "u => u": giữ gạch chân của Word thành thẻ <u> như đường dán, để
 * bộ nhận diện đáp án đúng (gạch chân = đúng) hoạt động giống hệt khi dán.
 */
export async function docxToHtml(arrayBuffer: ArrayBuffer): Promise<string> {
  const prepared = await preprocessDocxOmml(arrayBuffer);
  // mammoth có 2 đầu vào khác nhau theo môi trường: bản trình duyệt (Vite tự
  // chọn qua trường "browser") CHỈ nhận { arrayBuffer }, bản Node CHỈ nhận
  // { buffer } — truyền cả hai khoá, mỗi bản tự lấy khoá của mình. Trên trình
  // duyệt không có global Buffer nên khoá buffer không được thêm, hành vi web
  // giữ nguyên; phía Node (kiểm chứng/server) thì dùng buffer.
  const mammothInput: { arrayBuffer: ArrayBuffer; buffer?: unknown } = { arrayBuffer: prepared };
  if (typeof Buffer !== 'undefined') {
    mammothInput.buffer = Buffer.from(prepared);
  }
  const result = await mammoth.convertToHtml(
    mammothInput as { arrayBuffer: ArrayBuffer },
    { styleMap: ['u => u'] }
  );
  return result.value || '';
}
