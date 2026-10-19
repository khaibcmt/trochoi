import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface Props {
  text: string;
  className?: string;
}

/**
 * Safely parses and renders inline and block LaTeX math formulas (e.g. $x^2 + y^2 = r^2$, $$...$$)
 * or plain text with HTML tags.
 */
export const MathRenderer: React.FC<Props> = ({ text, className = '' }) => {
  if (!text) return null;

  // Check if text contains LaTeX delimiters ($...$ or $$...$$ or \frac or \sqrt)
  const hasLatex = /\$([^\$]+)\$|\\(?:frac|sqrt|alpha|beta|gamma|pi|sum|int|le|ge|ne|pm|cdot)/.test(text);

  if (!hasLatex) {
    return <span className={className} dangerouslySetInnerHTML={{ __html: text }} />;
  }

  // Split by $...$
  const parts = text.split(/(\$\$[^\$]+\$\$|\$[^\$]+\$)/g);

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2).trim();
          try {
            const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
            return <span key={idx} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch {
            return <span key={idx}>{part}</span>;
          }
        } else if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1).trim();
          try {
            const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
            return <span key={idx} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch {
            return <span key={idx}>{part}</span>;
          }
        } else {
          return <span key={idx} dangerouslySetInnerHTML={{ __html: part }} />;
        }
      })}
    </span>
  );
};
