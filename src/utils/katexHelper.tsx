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

  // Normalize chemical arrows if not already inside HTML tags
  str = str.replace(/(\s)-->?(\s)/g, '$1$\\rightarrow$$2');
  str = str.replace(/(\s)<=>(\s)/g, '$1$\\rightleftharpoons$$2');

  // Detect bare LaTeX commands not enclosed in $...$
  const bareLatexRegex =
    /(?:\\(?:frac\{[^{}]+\}\{[^{}]+\}|sqrt(?:\[[^{}]+\])?\{[^{}]+\}|vec\{[^{}]+\}|overrightarrow\{[^{}]+\}|overline\{[^{}]+\}|widehat\{[^{}]+\}|int(?:_\{[^{}]+\})?(?:\^\{[^{}]+\})?|lim_\{[^{}]+\}|sum(?:_\{[^{}]+\})?(?:\^\{[^{}]+\})?|alpha|beta|gamma|Delta|delta|epsilon|theta|lambda|mu|pi|sigma|omega|Omega|partial|nabla|infty|approx|times|div|pm|leq|geq|neq|equiv|subset|subseteq|in|notin|cup|cap|to|rightarrow|rightleftharpoons|cdot))(?:[^\$\n<>]*)?/g;

  const segments = str.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+\$)/g);
  for (let i = 0; i < segments.length; i++) {
    if (!segments[i].startsWith('$')) {
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

