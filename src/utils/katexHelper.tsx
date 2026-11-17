import React, { useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { stripWordStyleGarbage, normalizeWordMathUnicode } from '../data/defaultSubjects';

interface Props {
  text: string;
  className?: string;
  allowZoom?: boolean;
}

/**
 * Tự động định dạng công thức Hóa học / Sinh học / Vật lý cơ bản (VD: H2SO4, Ca(OH)2, Fe3+, CO2, O2, N2, C6H12O6)
 * khi nằm ngoài thẻ HTML và ngoài cặp dấu $...$
 */
function formatChemicalSubscriptsOutsideTags(input: string): string {
  // Bảo vệ các thẻ HTML (<table...>, <img...>, <sub...>, <sup...>, <span...>) để không chạm vào thuộc tính src/style
  const parts = input.split(/(<[^>]+>)/g);
  return parts
    .map(part => {
      if (part.startsWith('<')) return part;
      return part
        // VD: Ca(OH)2, Fe2(SO4)3 -> đóng ngoặc kèm chỉ số dưới
        .replace(/(\([A-Z][a-zA-Z0-9]*\))(\d{1,2})\b/g, '$1<sub>$2</sub>')
        // VD: H2SO4, C6H12O6, CO2, H2O, O2, N2, Cl2, NH3, CH4, Al2O3, Fe3O4, AgNO3, BaSO4, CaCO3
        .replace(
          /\b(H|He|Li|Be|B|C|N|O|F|Ne|Na|Mg|Al|Si|P|S|Cl|Ar|K|Ca|Sc|Ti|V|Cr|Mn|Fe|Co|Ni|Cu|Zn|Ga|Ge|As|Se|Br|Kr|Rb|Sr|Ag|Cd|Sn|Sb|I|Xe|Cs|Ba|Pt|Au|Hg|Pb|Bi)(\d{1,2})(?=[A-Z(\s.,;?:!)\]]|$)/g,
          '$1<sub>$2</sub>'
        )
        // Lặp thêm 1 lần cho hợp chất nhiều nguyên tố nối tiếp như H2SO4, C6H12O6, CH3COOH
        .replace(
          /(<\/sub>|H|C|N|O|S|P|Cl|Br|Na|K|Ca|Mg|Al|Fe|Cu|Zn|Ag|Ba)(\d{1,2})(?=[A-Z(\s.,;?:!)\]]|$)/g,
          '$1<sub>$2</sub>'
        );
    })
    .join('');
}

// Đợt 7 (1.3): map ký tự số mũ / chỉ số dưới Unicode (dạng Word hay xuất ra:
// x², 10⁻³, CO₂, H₂SO₄...) sang ký tự LaTeX tương ứng (chỉ số mũ -> ^, chỉ số dưới -> _)
const UNICODE_SUPERSCRIPT_MAP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-', 'ⁿ': 'n'
};
const UNICODE_SUBSCRIPT_MAP: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '₊': '+', '₋': '-'
};

/**
 * Đợt 7 (1.3): Nâng số mũ / chỉ số dưới Unicode đứng sau một "gốc" (token chữ/số
 * hoặc nhóm ngoặc (...)) thành công thức $gốc^{n}$ / $gốc_{n}$ để KaTeX render.
 * Chỉ áp cho phần chữ ngoài thẻ HTML. Chỉ số dưới ASCII (CO2, H2SO4) KHÔNG đi
 * qua đây — bộ hạ chỉ số hoá học formatChemicalSubscriptsOutsideTags lo riêng,
 * nên hai bộ không chồng chéo (bộ này chỉ chạm ký tự Unicode ⁰-ⁿ / ₀-₉).
 */
function convertUnicodeSuperSubScripts(text: string): string {
  const parts = text.split(/(<[^>]+>)/g);
  return parts
    .map(part => {
      if (part.startsWith('<')) return part;
      let out = part.replace(
        /((?:\([^()]*\))|(?:[A-Za-z0-9]+))([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ]+)/g,
        (_m, base: string, sup: string) =>
          `$${base}^{${[...sup].map(c => UNICODE_SUPERSCRIPT_MAP[c] ?? c).join('')}}$`
      );
      out = out.replace(
        /((?:\([^()]*\))|(?:[A-Za-z0-9]+))([₀₁₂₃₄₅₆₇₈₉₊₋]+)/g,
        (_m, base: string, sub: string) =>
          `$${base}_{${[...sub].map(c => UNICODE_SUBSCRIPT_MAP[c] ?? c).join('')}}$`
      );
      return out;
    })
    .join('');
}

/**
 * Preprocess STEM texts for Math, Physics, Chemistry, Biology, Geography:
 * 1. Normalizes Word Unicode Math symbols (𝑥, 𝑦, 𝛼, 𝛽...)
 * 2. Wraps bare LaTeX commands like \frac, \sqrt, \vec, \alpha, \int, \sum, \lim that miss $...$
 * 3. Normalizes chemistry reaction arrows (->, <=>, \rightleftharpoons)
 * 4. Formats common chemical formulas (H2SO4, CaCO3, CO2...)
 */
export function preprocessSTEMMath(raw: string): string {
  if (!raw) return '';
  let str = normalizeWordMathUnicode(raw);

  // Đợt 7 (1.3): Nhận thêm cặp ngoặc LaTeX dạng \(...\) (inline) và \[...\]
  // (display) — chuẩn hoá sớm về $...$ / $$...$$ để dùng chung pipeline KaTeX.
  str = str
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, inner) => `$$${inner}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, inner) => `$${inner}$`);

  // Đợt 7 (1.3): Ký hiệu căn Unicode √ -> \sqrt (có nhóm {…} hoặc token theo
  // sau thì bọc thành \sqrt{…}; √ đứng một mình thì thành \sqrt trần). Chạy
  // trước bước tách đoạn $...$ để cả công thức trong/ngoài $ đều sạch; phần
  // ngoài $ sẽ được bareLatexRegex bọc $...$ ở bước dưới như các lệnh khác.
  str = str
    .replace(/√\s*\{([^{}]+)\}/g, '\\sqrt{$1}')
    .replace(/√\s*(\([^()]*\)|[A-Za-z0-9]+)/g, '\\sqrt{$1}')
    .replace(/√/g, '\\sqrt ');

  // Normalize chemical arrows if not already inside HTML tags
  str = str.replace(/(\s)-->?(\s)/g, '$1$\\rightarrow$$2');
  str = str.replace(/(\s)<=>(\s)/g, '$1$\\rightleftharpoons$$2');

  // Detect bare LaTeX commands not enclosed in $...$
  // Đợt 7 (1.3): bổ sung các lệnh trần hay gặp còn thiếu: \dfrac, \tfrac (phân
  // số cỡ lớn/nhỏ như \frac), \text{...} (chữ thường trong công thức, có tham
  // số ngoặc nhọn) và các hàm \sin \cos \tan \cot \log \ln.
  const bareLatexRegex =
    /(?:\\(?:dfrac\{[^{}]+\}\{[^{}]+\}|tfrac\{[^{}]+\}\{[^{}]+\}|frac\{[^{}]+\}\{[^{}]+\}|sqrt(?:\[[^{}]+\])?\{[^{}]+\}|text\{[^{}]+\}|vec\{[^{}]+\}|overrightarrow\{[^{}]+\}|overline\{[^{}]+\}|widehat\{[^{}]+\}|int(?:_\{[^{}]+\})?(?:\^\{[^{}]+\})?|lim_\{[^{}]+\}|sum(?:_\{[^{}]+\})?(?:\^\{[^{}]+\})?|sin|cos|tan|cot|log|ln|alpha|beta|gamma|Delta|delta|epsilon|theta|lambda|mu|pi|sigma|omega|Omega|partial|nabla|infty|approx|times|div|pm|leq|geq|neq|equiv|subset|subseteq|in|notin|cup|cap|to|rightarrow|rightleftharpoons|cdot))(?:[^\$\n<>]*)?/g;

  const segments = str.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+\$)/g);
  for (let i = 0; i < segments.length; i++) {
    if (!segments[i].startsWith('$')) {
      // Đợt 7 (1.3): nâng x² / CO₂ / H₂... (số mũ & chỉ số dưới Unicode) thành
      // công thức TRƯỚC khi bọc lệnh LaTeX trần và hạ chỉ số hoá học ASCII, để
      // các bước sau thấy sẵn cặp $...$ hoàn chỉnh và không xử lý trùng.
      segments[i] = convertUnicodeSuperSubScripts(segments[i]);
      segments[i] = segments[i].replace(bareLatexRegex, match => {
        const trimmed = match.trim();
        if (trimmed.length > 0) {
          return `$${trimmed}$`;
        }
        return match;
      });
      segments[i] = formatChemicalSubscriptsOutsideTags(segments[i]);
    }
  }

  return segments.join('');
}

/**
 * Biến đổi mọi khối LaTeX ($$...$$ và $...$) và nhãn sơ đồ [Hình...], [Bản đồ...], [Bảng...]
 * trực tiếp thành chuỗi HTML hoàn chỉnh để không bao giờ làm đứt gãy cấu trúc thẻ <table>...</table> hay <img>!
 */
export function renderSTEMRichHTML(rawText: string): string {
  const safeText = stripWordStyleGarbage(rawText || '');
  if (!safeText) return '';

  const processed = preprocessSTEMMath(safeText);

  // 1. Render block LaTeX $$...$$
  let html = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_m, math) => {
    try {
      const rendered = katex.renderToString(String(math || '').trim(), {
        displayMode: true,
        throwOnError: false,
        output: 'htmlAndMathml',
        strict: false
      });
      return `<span class="stem-latex-block inline-block my-1.5 px-2 py-0.5 bg-blue-50/70 rounded border border-blue-200/60">${rendered}</span>`;
    } catch {
      return `<span class="font-mono text-amber-700 bg-amber-50 px-1 rounded">$$${math}$$</span>`;
    }
  });

  // 2. Render inline LaTeX $...$
  html = html.replace(/\$([^\$]+?)\$/g, (_m, math) => {
    try {
      const rendered = katex.renderToString(String(math || '').trim(), {
        displayMode: false,
        throwOnError: false,
        output: 'htmlAndMathml',
        strict: false
      });
      return `<span class="stem-latex-inline inline-block px-0.5 mx-0.5 rounded">${rendered}</span>`;
    } catch {
      return `<span class="font-mono text-amber-700 bg-amber-50 px-1 rounded">$${math}$</span>`;
    }
  });

  // 3. Highlight diagram / map / table badges like [Hình 1: ...], [Bản đồ ...], [Sơ đồ ...], [Bảng số liệu ...]
  html = html.replace(
    /\[(Hình|Sơ đồ|Đồ thị|Bản đồ|Bảng|Lược đồ|Thí nghiệm)([^\]]*)\]/gi,
    '<span class="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">🗺️ [$1$2]</span>'
  );

  return html;
}

/**
 * Enhanced Math, STEM Formula, Data Table, Geography Map & Diagram Renderer
 * Safely renders:
 * - Inline LaTeX ($...$) and block LaTeX ($$...$$) even inside HTML <table> cells
 * - Math, Physics, Chemistry, Biology formulas & chemical subscripts
 * - Data tables (<table class="stem-data-table">) for Geography, Biology, Physics, Math
 * - Embedded diagrams/maps/images (<img>, SVG, base64) with click-to-zoom
 */
export const MathRenderer: React.FC<Props> = ({ text, className = '', allowZoom = true }) => {
  const [zoomedImgSrc, setZoomedImgSrc] = useState<string | null>(null);

  if (!text) return null;
  const finalHTML = renderSTEMRichHTML(text);
  if (!finalHTML) return null;

  return (
    <>
      <span
        className={`stem-math-renderer ${className}`}
        dangerouslySetInnerHTML={{ __html: finalHTML }}
        onClick={e => {
          if (!allowZoom) return;
          const target = e.target as HTMLElement;
          if (target && target.tagName === 'IMG') {
            e.stopPropagation();
            const src = (target as HTMLImageElement).src;
            if (src) setZoomedImgSrc(src);
          }
        }}
      />

      {/* Diagram / Map Fullscreen Zoom Modal */}
      {zoomedImgSrc && (
        <div
          className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          onClick={e => {
            e.stopPropagation();
            setZoomedImgSrc(null);
          }}
        >
          <div
            className="relative max-w-5xl max-h-[92vh] bg-white rounded-2xl p-3 shadow-2xl flex flex-col items-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full flex justify-between items-center mb-2 px-2">
              <span className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                🔍 Hình ảnh / Bản đồ / Sơ đồ câu hỏi (Phóng to sắc nét)
              </span>
              <button
                type="button"
                className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white font-black rounded-lg text-xs transition"
                onClick={() => setZoomedImgSrc(null)}
              >
                ✕ Đóng
              </button>
            </div>
            <img
              src={zoomedImgSrc}
              alt="Diagram preview"
              className="max-w-full max-h-[82vh] object-contain rounded-xl border border-slate-200"
            />
          </div>
        </div>
      )}
    </>
  );
};

