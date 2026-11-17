import type { QuizItem } from '../types';

/**
 * Đợt 4 (Giai đoạn 3.1 + 3.2): BỘ CHUYỂN LỜI NÓI dùng chung cho host và học sinh.
 *
 * - buildSpeechText(item): biến 1 câu hỏi (MC / Đúng-Sai / Trả lời ngắn) thành chuỗi
 *   tiếng Việt đọc được bằng TTS: bóc HTML/bảng/ảnh, chuyển LaTeX → lời Việt theo
 *   quy ước lớp học, đọc số/đơn vị/công thức hoá học. TUYỆT ĐỐI không lộ đáp án đúng
 *   (không đọc correct / tfItems[].isCorrect / shortAnswer / explanation).
 * - getVietnameseVoice() / subscribeVietnameseVoice(): chọn giọng tiếng Việt thật
 *   từ speechSynthesis (ưu tiên lang bắt đầu bằng 'vi'); không có giọng Việt thì
 *   phía gọi phải cảnh báo rõ thay vì đọc sai lặng lẽ.
 * - speakVietnameseText(): phát 1 chuỗi đã chuyển bằng giọng Việt (nếu có).
 * - unlockSpeechSynthesis(): mở khoá âm thanh trên trình duyệt di động bằng 1
 *   thao tác chạm của người dùng (nút "Vào phòng" phía học sinh).
 */

// ---------------------------------------------------------------------------
// Số → chữ tiếng Việt (dùng cho chỉ số hoá học, số mũ nhỏ, cận tích phân…)
// ---------------------------------------------------------------------------

const DIGIT_WORDS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

/** Đọc 1 số nguyên 0..999 thành chữ tiếng Việt (vd 12 → "mười hai", 105 → "một trăm lẻ năm"). */
export function numberToVietnameseWords(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const neg = n < 0;
  n = Math.abs(Math.trunc(n));
  if (n < 10) return (neg ? 'trừ ' : '') + DIGIT_WORDS[n];
  let out = '';
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) out = DIGIT_WORDS[hundreds] + ' trăm';
  if (rest === 0) return (neg ? 'trừ ' : '') + out;
  const tens = Math.floor(rest / 10);
  const ones = rest % 10;
  let tail = '';
  if (tens === 0) tail = 'lẻ ' + DIGIT_WORDS[ones];
  else if (tens === 1) tail = 'mười' + (ones ? ' ' + (ones === 5 ? 'lăm' : DIGIT_WORDS[ones]) : '');
  else
    tail =
      DIGIT_WORDS[tens] +
      ' mươi' +
      (ones ? ' ' + (ones === 1 ? 'mốt' : ones === 5 ? 'lăm' : DIGIT_WORDS[ones]) : '');
  return (neg ? 'trừ ' : '') + (out ? out + ' ' + tail : tail);
}

/** Chèn dấu chấm nghìn cho số nguyên dài (vd 1234567 → "1.234.567") để TTS đọc đúng nhịp. */
function addThousandSeparators(text: string): string {
  return text.replace(/\b\d{5,}\b/g, (m) => {
    let out = '';
    let rest = m;
    while (rest.length > 3) {
      out = '.' + rest.slice(-3) + out;
      rest = rest.slice(0, -3);
    }
    return rest + out;
  });
}

// ---------------------------------------------------------------------------
// Công thức hoá học dạng chữ phẳng: H2SO4 → "H hai S O bốn"
// ---------------------------------------------------------------------------

const ELEMENT_SYMBOLS = new Set([
  'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar',
  'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br',
  'Kr', 'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te',
  'I', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm',
  'Yb', 'Lu', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn',
  'Fr', 'Ra', 'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu'
]);

/**
 * Thử đọc 1 token như công thức hoá học: token phải tách trọn thành các ký hiệu
 * nguyên tố thật và có ít nhất 1 chỉ số. Trả null nếu không phải công thức.
 */
function chemicalTokenToSpeech(token: string): string | null {
  if (!/\d/.test(token)) return null;
  const parts: string[] = [];
  let i = 0;
  let hasSubscript = false;
  while (i < token.length) {
    const ch = token[i];
    if (ch === '(') {
      parts.push('mở ngoặc');
      i++;
      continue;
    }
    if (ch === ')') {
      parts.push('đóng ngoặc');
      i++;
      continue;
    }
    if (/\d/.test(ch)) {
      let j = i;
      while (j < token.length && /\d/.test(token[j])) j++;
      parts.push(numberToVietnameseWords(parseInt(token.slice(i, j), 10)));
      hasSubscript = true;
      i = j;
      continue;
    }
    if (/[A-Z]/.test(ch)) {
      const two = token.slice(i, i + 2);
      if (two.length === 2 && /[a-z]/.test(two[1]) && ELEMENT_SYMBOLS.has(two)) {
        parts.push(two.split('').join(' '));
        i += 2;
        continue;
      }
      if (ELEMENT_SYMBOLS.has(ch)) {
        parts.push(ch);
        i++;
        continue;
      }
      return null;
    }
    return null;
  }
  if (!hasSubscript || parts.length < 2) return null;
  return parts.join(' ');
}

function convertChemicalFormulas(text: string): string {
  return text.replace(/[A-Z][A-Za-z0-9()]*\d[A-Za-z0-9()]*/g, (token) => {
    const spoken = chemicalTokenToSpeech(token);
    return spoken !== null ? spoken : token;
  });
}

// ---------------------------------------------------------------------------
// LaTeX → lời Việt (đệ quy theo cặp ngoặc nhọn, xử lý được phân số lồng nhau)
// ---------------------------------------------------------------------------

const GREEK_WORDS: Record<string, string> = {
  alpha: 'an-pha',
  beta: 'bê-ta',
  gamma: 'gam-ma',
  delta: 'đen-ta',
  epsilon: 'ép-si-lon',
  varepsilon: 'ép-si-lon',
  zeta: 'dê-ta',
  eta: 'ê-ta',
  theta: 'thê-ta',
  vartheta: 'thê-ta',
  iota: 'i-ô-ta',
  kappa: 'cáp-pa',
  lambda: 'lam-đa',
  mu: 'muy',
  nu: 'nuy',
  xi: 'xi',
  pi: 'pi',
  rho: 'rô',
  sigma: 'xích-ma',
  tau: 'tau',
  upsilon: 'uýp-si-lon',
  phi: 'phi',
  varphi: 'phi',
  chi: 'khi',
  psi: 'pờ-si',
  omega: 'ô-mê-ga'
};

/** Đọc nội dung trong {…} bắt đầu tại vị trí '{' — trả nội dung thô + vị trí sau '}'. */
function readBraced(s: string, start: number): { content: string; end: number } | null {
  if (s[start] !== '{') return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0) return { content: s.slice(start + 1, i), end: i + 1 };
    }
  }
  return { content: s.slice(start + 1), end: s.length };
}

/** Đọc 1 đối số LaTeX tại vị trí i: {…} hoặc 1 token đơn (lệnh, ký tự, số…). */
function readLatexArg(s: string, i: number): { raw: string; end: number } {
  while (i < s.length && /\s/.test(s[i])) i++;
  if (i >= s.length) return { raw: '', end: i };
  if (s[i] === '{') {
    const b = readBraced(s, i);
    return b ? { raw: b.content, end: b.end } : { raw: '', end: i + 1 };
  }
  if (s[i] === '\\') {
    let j = i + 1;
    while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
    return { raw: s.slice(i, j), end: j };
  }
  return { raw: s[i], end: i + 1 };
}

/** Chuyển nội dung chỉ số trên/dưới: đổi dấu +/−/= thành lời, số thuần → chữ khi ngắn. */
function convertScriptContent(raw: string, isSuper: boolean): string {
  let t = convertLatex(raw).trim();
  t = t.replace(/=/g, ' bằng ').replace(/\+/g, ' cộng ').replace(/-/g, ' trừ ');
  t = t.replace(/\s+/g, ' ').trim();
  if (/^\d+$/.test(t) && t.length <= 3) {
    return numberToVietnameseWords(parseInt(t, 10));
  }
  return t;
}

/** Đọc cặp chỉ số dưới/trên đi kèm sau \int, \sum… (thứ tự tuỳ ý, có thể thiếu 1 phía). */
function readLimits(s: string, i: number): { lower?: string; upper?: string; end: number } {
  let lower: string | undefined;
  let upper: string | undefined;
  let pos = i;
  for (let k = 0; k < 2; k++) {
    let p = pos;
    while (p < s.length && /\s/.test(s[p])) p++;
    if (s[p] === '_') {
      const a = readLatexArg(s, p + 1);
      lower = convertScriptContent(a.raw, false);
      pos = a.end;
    } else if (s[p] === '^') {
      const a = readLatexArg(s, p + 1);
      upper = convertScriptContent(a.raw, true);
      pos = a.end;
    } else break;
  }
  return { lower, upper, end: pos };
}

export function latexToSpeech(rawInput: string): string {
  // Công thức hoá học viết kiểu LaTeX (H_2SO_4, (NH_4)_2…) → đọc theo ký tự trước,
  // tránh chỉ số dưới dính chữ thành "haiSO bốn".
  const s = rawInput.replace(
    /\b[A-Z][A-Za-z0-9_(){}]*_\{?\d+\}?[A-Za-z0-9_(){}]*/g,
    (token) => {
      const plain = token.replace(/_/g, '').replace(/[{}]/g, '');
      return chemicalTokenToSpeech(plain) ?? token;
    }
  );
  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];

    if (ch === '$') {
      i++;
      continue;
    }

    if (ch === '\\') {
      // Lệnh dạng ký tự đơn: \( \) \[ \] \% \, \; \\ …
      const next = s[i + 1];
      if (next === undefined) break;
      if (!/[a-zA-Z]/.test(next)) {
        if (next === '%') out += '%';
        else if (next === '(' || next === ')' || next === '[' || next === ']') out += '';
        else out += ' ';
        i += 2;
        continue;
      }
      let j = i + 1;
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      const cmd = s.slice(i + 1, j);
      const lowerCmd = cmd.toLowerCase();
      i = j;

      if (lowerCmd === 'frac' || lowerCmd === 'dfrac' || lowerCmd === 'tfrac') {
        const a = readLatexArg(s, i);
        const b = readLatexArg(s, a.end);
        out += ` ${convertLatex(a.raw)} phần ${convertLatex(b.raw)} `;
        i = b.end;
        continue;
      }
      if (lowerCmd === 'sqrt') {
        let p = i;
        while (p < s.length && /\s/.test(s[p])) p++;
        let rootIndex: string | undefined;
        if (s[p] === '[') {
          const close = s.indexOf(']', p);
          if (close > p) {
            rootIndex = convertLatex(s.slice(p + 1, close)).trim();
            p = close + 1;
          }
        }
        const a = readLatexArg(s, p);
        const body = convertLatex(a.raw);
        out += rootIndex ? ` căn bậc ${rootIndex} của ${body} ` : ` căn bậc hai của ${body} `;
        i = a.end;
        continue;
      }
      if (lowerCmd === 'int' || lowerCmd === 'iint' || lowerCmd === 'oint') {
        const lim = readLimits(s, i);
        const kind = lowerCmd === 'iint' ? 'tích phân kép' : 'tích phân';
        if (lim.lower !== undefined || lim.upper !== undefined) {
          out += ` ${kind} từ ${lim.lower ?? ''} đến ${lim.upper ?? ''} của `;
        } else {
          out += ` ${kind} của `;
        }
        i = lim.end;
        continue;
      }
      if (lowerCmd === 'sum' || lowerCmd === 'prod') {
        const lim = readLimits(s, i);
        const kind = lowerCmd === 'sum' ? 'tổng' : 'tích';
        if (lim.lower !== undefined || lim.upper !== undefined) {
          out += ` ${kind} từ ${lim.lower ?? ''} đến ${lim.upper ?? ''} của `;
        } else {
          out += ` ${kind} của `;
        }
        i = lim.end;
        continue;
      }
      if (lowerCmd === 'lim') {
        const lim = readLimits(s, i);
        out += lim.lower ? ` giới hạn khi ${lim.lower} của ` : ' giới hạn của ';
        i = lim.end;
        continue;
      }
      if (lowerCmd === 'binom') {
        const a = readLatexArg(s, i);
        const b = readLatexArg(s, a.end);
        out += ` tổ hợp chập ${convertLatex(b.raw)} của ${convertLatex(a.raw)} `;
        i = b.end;
        continue;
      }
      if (
        lowerCmd === 'text' ||
        lowerCmd === 'mathrm' ||
        lowerCmd === 'mathbf' ||
        lowerCmd === 'mathit' ||
        lowerCmd === 'operatorname' ||
        lowerCmd === 'textbf' ||
        lowerCmd === 'textit'
      ) {
        const a = readLatexArg(s, i);
        out += ` ${convertLatex(a.raw)} `;
        i = a.end;
        continue;
      }
      if (lowerCmd === 'vec' || lowerCmd === 'overrightarrow') {
        const a = readLatexArg(s, i);
        out += ` véc-tơ ${convertLatex(a.raw)} `;
        i = a.end;
        continue;
      }
      if (lowerCmd === 'overline' || lowerCmd === 'bar' || lowerCmd === 'hat' || lowerCmd === 'widehat' || lowerCmd === 'tilde') {
        const a = readLatexArg(s, i);
        out += ` ${convertLatex(a.raw)} `;
        i = a.end;
        continue;
      }
      if (GREEK_WORDS[lowerCmd]) {
        out += ` ${GREEK_WORDS[lowerCmd]} `;
        continue;
      }
      const SIMPLE_COMMANDS: Record<string, string> = {
        times: ' nhân ',
        cdot: ' nhân ',
        div: ' chia ',
        pm: ' cộng trừ ',
        mp: ' trừ cộng ',
        leq: ' nhỏ hơn hoặc bằng ',
        le: ' nhỏ hơn hoặc bằng ',
        geq: ' lớn hơn hoặc bằng ',
        ge: ' lớn hơn hoặc bằng ',
        neq: ' khác ',
        ne: ' khác ',
        approx: ' xấp xỉ ',
        infty: ' vô cực ',
        to: ' tiến tới ',
        rightarrow: ' tạo thành ',
        longrightarrow: ' tạo thành ',
        rightleftharpoons: ' phản ứng thuận nghịch ',
        leftrightarrow: ' tương đương ',
        rightleftarrows: ' phản ứng thuận nghịch ',
        Rightarrow: ' suy ra ',
        implies: ' suy ra ',
        log: ' lô-ga-rít ',
        ln: ' lô-ga-rít tự nhiên ',
        sin: ' sin ',
        cos: ' cos ',
        tan: ' tan ',
        cot: ' cot ',
        min: ' nhỏ nhất ',
        max: ' lớn nhất ',
        degree: ' độ ',
        circ: ' độ ',
        left: ' ',
        right: ' ',
        big: ' ',
        Big: ' ',
        quad: ' ',
        qquad: ' '
      };
      if (SIMPLE_COMMANDS[cmd] !== undefined) {
        out += SIMPLE_COMMANDS[cmd];
        continue;
      }
      if (SIMPLE_COMMANDS[lowerCmd] !== undefined) {
        out += SIMPLE_COMMANDS[lowerCmd];
        continue;
      }
      // Lệnh lạ: bỏ tên lệnh, nội dung {…} phía sau vẫn được vòng lặp chính xử lý.
      continue;
    }

    if (ch === '^' || ch === '_') {
      const a = readLatexArg(s, i + 1);
      const spoken = convertScriptContent(a.raw, ch === '^');
      if (ch === '^') {
        if (/^(o|°)$/.test(a.raw.trim())) out += ' độ';
        else out += ` mũ ${spoken}`;
      } else {
        out += spoken ? ` ${spoken}` : '';
      }
      i = a.end;
      continue;
    }

    if (ch === '{') {
      const b = readBraced(s, i);
      if (b) {
        out += convertLatex(b.content);
        i = b.end;
        continue;
      }
      i++;
      continue;
    }
    if (ch === '}') {
      i++;
      continue;
    }
    if (ch === '~') {
      out += ' ';
      i++;
      continue;
    }
    if (ch === '+') {
      out += ' cộng ';
      i++;
      continue;
    }
    if (ch === '=') {
      out += ' bằng ';
      i++;
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}

function convertLatex(input: string): string {
  return latexToSpeech(input);
}

// ---------------------------------------------------------------------------
// HTML → lời nói: bảng thành câu mô tả, ảnh thành "có hình minh hoạ"
// ---------------------------------------------------------------------------

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#0?39;/gi, "'")
    .replace(/&#(\d+);/g, (_m, code) => {
      const n = parseInt(code, 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, code) => {
      const n = parseInt(code, 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : '';
    });
}

function stripTagsKeepText(html: string): string {
  // Chỉ bóc thẻ THẬT (bắt đầu bằng chữ cái sau '<' hoặc '</') — tránh ăn nhầm
  // dấu bất đẳng thức kiểu "a <= b -> c" thành "thẻ" rồi nuốt mất nội dung.
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ');
}

/** Chuyển 1 bảng HTML thành câu mô tả + đọc lần lượt các ô theo hàng. */
function tableToSpeech(tableHtml: string): string {
  const rowMatches = tableHtml.match(/<tr[\s>][\s\S]*?<\/tr\s*>|<tr\s*\/>/gi) || [];
  const rows: string[][] = [];
  const rowSources = rowMatches.length > 0 ? rowMatches : [tableHtml];
  rowSources.forEach((rowHtml) => {
    const cellMatches = rowHtml.match(/<t[dh][\s>][\s\S]*?<\/t[dh]\s*>/gi) || [];
    const cells = cellMatches
      .map((c) => decodeHtmlEntities(stripTagsKeepText(c)).replace(/\s+/g, ' ').trim())
      .filter((c) => c.length > 0);
    if (cells.length > 0) rows.push(cells);
  });
  if (rows.length === 0) return ' Bảng số liệu. ';
  const colCount = Math.max(...rows.map((r) => r.length));
  let out = ` Bảng số liệu gồm ${rows.length} hàng và ${colCount} cột. `;
  rows.forEach((cells, idx) => {
    out += `Hàng ${idx + 1}: ${cells.join(', ')}. `;
  });
  return out;
}

export function htmlToSpeechText(raw: string): string {
  let text = String(raw || '');
  // Bảng → câu mô tả (làm trước khi bóc thẻ)
  text = text.replace(/<table[\s>][\s\S]*?<\/table\s*>/gi, (m) => tableToSpeech(m));
  // Ảnh thật → ghi chú có hình
  text = text.replace(/<img\b[^>]*>/gi, ' (có hình minh hoạ) ');
  // Badge [Hình…] chèn tay trong đề → thay bằng ghi chú hình, không đọc nguyên badge
  text = text.replace(/\[Hình[^\]]*\]/gi, ' (có hình minh hoạ) ');
  // Bỏ script/style và mọi thẻ còn lại
  text = text.replace(/<(script|style)[\s>][\s\S]*?<\/\1\s*>/gi, ' ');
  text = stripTagsKeepText(text);
  text = decodeHtmlEntities(text);
  return text;
}

// ---------------------------------------------------------------------------
// Chuỗi thuần → lời nói: ký hiệu, %, đơn vị, số
// ---------------------------------------------------------------------------

const UNIT_WORDS: [RegExp, string][] = [
  [/(\d)\s*(km\/h)\b/g, '$1 ki-lô-mét trên giờ'],
  [/(\d)\s*(m\/s)\b/g, '$1 mét trên giây'],
  [/(\d)\s*(mol\/l)\b/gi, '$1 mol trên lít'],
  [/(\d)\s*(km)\b/g, '$1 ki-lô-mét'],
  [/(\d)\s*(cm)\b/g, '$1 xăng-ti-mét'],
  [/(\d)\s*(mm)\b/g, '$1 mi-li-mét'],
  [/(\d)\s*(kg)\b/g, '$1 ki-lô-gam'],
  [/(\d)\s*(ml)\b/gi, '$1 mi-li-lít'],
  [/(\d)\s*(ha)\b/g, '$1 héc-ta'],
  [/(\d)\s*(m)\b/g, '$1 mét']
];

export function plainTextToSpeech(raw: string): string {
  let text = String(raw || '');
  // Chỉ số Unicode của Word (H₂SO₄, x²) → dạng thường để các bước sau xử lý
  const SUB_MAP: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
  const SUP_MAP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
  text = text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => '^' + m.split('').map((c) => SUP_MAP[c] || '').join(''));
  text = text.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (c) => SUB_MAP[c] || c);

  // Ký hiệu so sánh / mũi tên dạng thuần phải đổi TRƯỚC bước LaTeX, nếu không
  // dấu '=' trong '<=' / '>=' sẽ bị đọc rời thành "nhỏ hơn bằng".
  text = text
    .replace(/<=>/g, ' phản ứng thuận nghịch ')
    .replace(/->|→/g, ' tạo thành ')
    .replace(/⇌/g, ' phản ứng thuận nghịch ')
    .replace(/↔/g, ' phản ứng thuận nghịch ')
    .replace(/<=|≤/g, ' nhỏ hơn hoặc bằng ')
    .replace(/>=|≥/g, ' lớn hơn hoặc bằng ')
    .replace(/!=|≠/g, ' khác ')
    .replace(/≈/g, ' xấp xỉ ')
    .replace(/±/g, ' cộng trừ ')
    .replace(/×/g, ' nhân ')
    .replace(/÷/g, ' chia ')
    .replace(/</g, ' nhỏ hơn ')
    .replace(/>/g, ' lớn hơn ');

  // LaTeX (có hoặc không có $…$) → lời Việt
  text = latexToSpeech(text);

  text = text.replace(/°C/g, ' độ C').replace(/°/g, ' độ ');

  // % → phần trăm
  text = text.replace(/%/g, ' phần trăm');

  // Công thức hoá học phẳng (H2SO4 → "H hai S O bốn")
  text = convertChemicalFormulas(text);

  // Đơn vị phổ biến đọc đầy đủ
  UNIT_WORDS.forEach(([re, rep]) => {
    text = text.replace(re, rep);
  });

  // Số nguyên dài → chèn dấu chấm nghìn (số thập phân dấu phẩy giữ nguyên)
  text = addThousandSeparators(text);

  // Dọn khoảng trắng + dấu câu
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/([.,;:!?])(?=[^\s\d])/g, '$1 ')
    .trim();
  return text;
}

/** Chuyển 1 đoạn nội dung câu hỏi (có thể chứa HTML + LaTeX) thành lời nói. */
export function speechify(raw: string): string {
  return plainTextToSpeech(htmlToSpeechText(raw || ''));
}

// ---------------------------------------------------------------------------
// Hàm chính: QuizItem → chuỗi đọc hoàn chỉnh (KHÔNG lộ đáp án)
// ---------------------------------------------------------------------------

export function buildSpeechText(item: QuizItem, questionNumber?: number): string {
  if (!item) return '';
  const parts: string[] = [];
  if (typeof questionNumber === 'number' && questionNumber > 0) {
    parts.push(`Câu hỏi số ${questionNumber}.`);
  }
  const stem = speechify(item.q || '');
  if (stem) parts.push(stem.endsWith('.') || stem.endsWith('?') || stem.endsWith('!') ? stem : stem + '.');
  if (item.imageUri) {
    parts.push('Câu hỏi có hình minh hoạ.');
  }

  // Suy ra dạng câu khi thiếu trường format (đề nhập từ JSON/nguồn cũ): có tfItems thì là Đúng/Sai.
  const format =
    item.format ||
    (item.tfItems && item.tfItems.length > 0 ? 'TRUE_FALSE' : 'MULTIPLE_CHOICE');
  if (format === 'TRUE_FALSE' && item.tfItems && item.tfItems.length > 0) {
    parts.push('Hãy xét tính Đúng hoặc Sai của các mệnh đề sau.');
    item.tfItems.forEach((tf) => {
      const label = (tf.label || '').toString().trim().toLowerCase();
      const body = speechify(tf.text || '');
      if (body) parts.push(`Ý ${label}: ${body}.`);
    });
  } else if (format === 'SHORT_ANSWER') {
    parts.push('Các em hãy tính toán và nhập kết quả trả lời ngắn trên màn hình điện thoại.');
  } else if (item.opts && item.opts.length > 0) {
    item.opts.forEach((opt, idx) => {
      const body = speechify(opt || '');
      if (body) parts.push(`Phương án ${String.fromCharCode(65 + idx)}: ${body}.`);
    });
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Chọn giọng tiếng Việt + phát tiếng (dùng chung host & học sinh)
// ---------------------------------------------------------------------------

let cachedVoice: SpeechSynthesisVoice | null = null;
let voicesListenerInstalled = false;
const voiceSubscribers = new Set<(voice: SpeechSynthesisVoice | null) => void>();

export function pickVietnameseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const viVoices = voices.filter((v) => (v.lang || '').toLowerCase().startsWith('vi'));
  if (viVoices.length === 0) return null;
  const scored = viVoices
    .map((v) => {
      const name = (v.name || '').toLowerCase();
      let score = 0;
      if (name.includes('vietnam')) score += 4;
      if (name.includes('microsoft')) score += 3;
      if (name.includes('google')) score += 2;
      if ((v.lang || '').toLowerCase() === 'vi-vn') score += 1;
      return { v, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0].v;
}

function ensureVoicesListener() {
  if (voicesListenerInstalled) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  voicesListenerInstalled = true;
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    cachedVoice = pickVietnameseVoice(window.speechSynthesis.getVoices());
    voiceSubscribers.forEach((cb) => {
      try {
        cb(cachedVoice);
      } catch {}
    });
  });
}

export function getVietnameseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  ensureVoicesListener();
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    cachedVoice = pickVietnameseVoice(voices);
  }
  return cachedVoice;
}

/** Đăng ký nhận giọng Việt ngay khi trình duyệt nạp xong danh sách giọng. */
export function subscribeVietnameseVoice(cb: (voice: SpeechSynthesisVoice | null) => void): () => void {
  ensureVoicesListener();
  voiceSubscribers.add(cb);
  cb(getVietnameseVoice());
  return () => {
    voiceSubscribers.delete(cb);
  };
}

/**
 * Phát 1 chuỗi bằng giọng Việt (nếu máy có). Trả false khi trình duyệt không hỗ trợ TTS.
 * onEnd được gọi khi đọc xong hoặc khi lỗi.
 */
export function speakVietnameseText(
  text: string,
  options?: { rate?: number; onEnd?: () => void }
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  if (!text || !text.trim()) return false;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'vi-VN';
  const voice = getVietnameseVoice();
  if (voice) utter.voice = voice;
  utter.rate = options?.rate && options.rate > 0 ? options.rate : 1.0;
  if (options?.onEnd) {
    utter.onend = () => options.onEnd!();
    utter.onerror = () => options.onEnd!();
  }
  window.speechSynthesis.speak(utter);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Mở khoá âm thanh di động: phải gọi TRONG 1 thao tác chạm của người dùng
 * (vd nút "Vào phòng") — phát 1 utterance rỗng âm lượng 0 + resume + nạp giọng.
 */
export function unlockSpeechSynthesis() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    ensureVoicesListener();
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    const unlockUtter = new SpeechSynthesisUtterance('');
    unlockUtter.volume = 0;
    window.speechSynthesis.speak(unlockUtter);
  } catch {}
}
