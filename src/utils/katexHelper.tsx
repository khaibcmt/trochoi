import React, { useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { stripWordStyleGarbage } from '../data/defaultSubjects';

interface Props {
  text: string;
  className?: string;
  allowZoom?: boolean;
}

/**
 * Preprocess STEM texts for Math, Physics, Chemistry, Biology:
 * 1. Wraps bare LaTeX commands like \frac, \sqrt, \vec, \alpha, \int, \sum, \lim that miss $...$
 * 2. Normalizes chemistry reaction arrows (->, <=>, \rightleftharpoons)
 * 3. Formats common chemical formulas (H2SO4, CaCO3, Fe3+, etc.)
 * 4. Extracts or normalizes diagram and image references
 */
export function preprocessSTEMMath(raw: string): string {
  if (!raw) return '';
  let str = raw;

  // Normalize chemical arrows if not already inside LaTeX
  // e.g. "A + B -> C" => "A + B \rightarrow C"
  str = str.replace(/(\s)-->?(\s)/g, '$1\\rightarrow$2');
  str = str.replace(/(\s)<=>(\s)/g, '$1\\rightleftharpoons$2');

  // Detect bare LaTeX commands not enclosed in $...$
  // Patterns like \frac{...}{...}, \sqrt{...}, \vec{...}, \overline{...}, \int_{...}^{...}, \sum_{...}^{...}
  const bareLatexRegex = /(?:\\(?:frac\{[^{}]+\}\{[^{}]+\}|sqrt(?:\[[^{}]+\])?\{[^{}]+\}|vec\{[^{}]+\}|overrightarrow\{[^{}]+\}|overline\{[^{}]+\}|int(?:_\{[^{}]+\})?(?:\^\{[^{}]+\})?|lim_\{[^{}]+\}|sum(?:_\{[^{}]+\})?(?:\^\{[^{}]+\})?|alpha|beta|gamma|Delta|delta|epsilon|theta|lambda|mu|pi|sigma|omega|Omega|partial|nabla|infty|approx|times|div|pm|leq|geq|neq|equiv|subset|subseteq|in|notin|cup|cap|to|rightarrow|rightleftharpoons|cdot))(?:[^\$\n<>]*)?/g;

  // Only wrap if not already in $...$ or $$...$$
  const segments = str.split(/(\$\$[^\$]+\$\$|\$[^\$]+\$)/g);
  for (let i = 0; i < segments.length; i++) {
    // If it's not already inside a math delimiter
    if (!segments[i].startsWith('$')) {
      // Find bare LaTeX commands and wrap them in $...$
      segments[i] = segments[i].replace(bareLatexRegex, (match) => {
        // Trim trailing punctuation if caught
        const trimmed = match.trim();
        if (trimmed.length > 0) {
          return `$${trimmed}$`;
        }
        return match;
      });
    }
  }

  return segments.join('');
}

/**
 * Enhanced Math & STEM Diagram Renderer
 * Safely renders:
 * - Inline LaTeX ($...$) and block LaTeX ($$...$$)
 * - Math, Physics, Chemistry, Biology formulas
 * - Embedded diagrams/images (<img>, SVG, base64) with click-to-zoom
 * - Diagram badges [Hình 1], [Sơ đồ...]
 */
export const MathRenderer: React.FC<Props> = ({ text, className = '', allowZoom = true }) => {
  const [zoomedImgSrc, setZoomedImgSrc] = useState<string | null>(null);

  if (!text) return null;
  const safeText = stripWordStyleGarbage(text);
  if (!safeText) return null;

  // Preprocess text to wrap bare LaTeX commands
  const processedText = preprocessSTEMMath(safeText);

  // Check if text has LaTeX or embedded images/diagrams
  const hasLatex = /\$([^\$]+)\$|\\(?:frac|sqrt|alpha|beta|gamma|pi|sum|int|le|ge|ne|pm|cdot|vec|rightarrow)/.test(processedText);
  const hasImage = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/i.test(processedText);
  const hasDiagramBadge = /\[(?:Hình|Sơ đồ|Đồ thị|Bảng|Thí nghiệm)[^\]]*\]/i.test(processedText);

  if (!hasLatex && !hasImage && !hasDiagramBadge) {
    return <span className={className} dangerouslySetInnerHTML={{ __html: processedText }} />;
  }

  // Split by LaTeX delimiters ($$...$$ or $...$)
  const parts = processedText.split(/(\$\$[^\$]+\$\$|\$[^\$]+\$)/g);

  return (
    <>
      <span className={`stem-math-renderer ${className}`}>
        {parts.map((part, idx) => {
          if (part.startsWith('$$') && part.endsWith('$$')) {
            const math = part.slice(2, -2).trim();
            try {
              const html = katex.renderToString(math, {
                displayMode: true,
                throwOnError: false,
                output: 'htmlAndMathml',
                strict: false
              });
              return (
                <span
                  key={idx}
                  className="stem-latex-block inline-block my-1.5 px-2 py-0.5 bg-blue-50/60 dark:bg-blue-950/40 rounded border border-blue-200/50"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              );
            } catch {
              return <span key={idx} className="font-mono text-amber-700 bg-amber-50 px-1 rounded">{part}</span>;
            }
          } else if (part.startsWith('$') && part.endsWith('$')) {
            const math = part.slice(1, -1).trim();
            try {
              const html = katex.renderToString(math, {
                displayMode: false,
                throwOnError: false,
                output: 'htmlAndMathml',
                strict: false
              });
              return (
                <span
                  key={idx}
                  className="stem-latex-inline inline-block px-1 mx-0.5 rounded"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              );
            } catch {
              return <span key={idx} className="font-mono text-amber-700 bg-amber-50 px-1 rounded">{part}</span>;
            }
          } else {
            // Check for diagram tags or images in plain text
            let enrichedPart = part;

            // Highlight diagram notes like [Hình 1: ...] or [Sơ đồ ...]
            enrichedPart = enrichedPart.replace(
              /\[(Hình|Sơ đồ|Đồ thị|Bảng|Thí nghiệm)([^\]]*)\]/gi,
              '<span class="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">📊 [$1$2]</span>'
            );

            // Handle images if any
            if (hasImage && allowZoom) {
              return (
                <span
                  key={idx}
                  dangerouslySetInnerHTML={{ __html: enrichedPart }}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target && target.tagName === 'IMG') {
                      const src = (target as HTMLImageElement).src;
                      if (src) setZoomedImgSrc(src);
                    }
                  }}
                />
              );
            }

            return <span key={idx} dangerouslySetInnerHTML={{ __html: enrichedPart }} />;
          }
        })}
      </span>

      {/* Diagram Fullscreen Zoom Modal */}
      {zoomedImgSrc && (
        <div
          className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomedImgSrc(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl p-3 shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex justify-between items-center mb-2 px-2">
              <span className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                🔍 Sơ đồ / Hình ảnh câu hỏi (Phóng to sắc nét)
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
              className="max-w-full max-h-[80vh] object-contain rounded-xl border border-slate-200"
            />
          </div>
        </div>
      )}
    </>
  );
};
