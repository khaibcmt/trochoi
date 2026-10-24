import { QuizItem, QuestionFormat } from '../types';
import { aiAutoDetectCorrectIndex } from '../data/defaultSubjects';

export type IssueSeverity = 'CRITICAL' | 'WARNING' | 'SUGGESTION';

export interface QuestionAuditIssue {
  id: string;
  qid: number;
  questionNumber: number;
  questionTitle: string;
  format: QuestionFormat;
  severity: IssueSeverity;
  errorType: string;
  badgeLabel: string;
  description: string; // Bị lỗi gì?
  howToFix: string;    // Cách sửa lỗi?
  autoFixable: boolean;
}

export interface QuizAuditSummary {
  totalQuestions: number;
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  suggestionCount: number;
  issues: QuestionAuditIssue[];
  isClean: boolean;
}

/**
 * Validates LaTeX formulas for unmatched brackets or malformed commands
 * (Strips HTML <table> and <img> tags first so CSS/HTML attributes never trigger false LaTeX warnings)
 */
function checkFormulaErrors(rawText: string): string | null {
  if (!rawText) return null;
  const text = rawText
    .replace(/<table[\s\S]*?<\/table>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  // Check unclosed $ delimiters
  const singleDollarCount = (text.match(/(?<!\$)\$(?!\$)/g) || []).length;
  if (singleDollarCount % 2 !== 0) {
    return 'Dấu đô la kẹp công thức ($) chưa được đóng khép kín (số lượng dấu $ bị lẻ).';
  }

  // Only check curly braces if the text actually contains LaTeX commands or $ delimiters
  if (text.includes('$') || /\\(?:frac|sqrt|vec|sum|int|lim)/.test(text)) {
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') depth++;
      if (text[i] === '}') depth--;
      if (depth < 0) {
        return 'Thừa dấu đóng ngoặc nhọn "}" trong công thức LaTeX.';
      }
    }
    if (depth > 0) {
      return 'Thiếu dấu đóng ngoặc nhọn "}" trong công thức LaTeX (chưa khép kín).';
    }
  }

  // Check broken \frac missing arguments
  if (/\\frac\s*([^{]|$)/.test(text)) {
    return 'Cú pháp phân số \\frac bị thiếu ngoặc nhọn {tử}{mẫu}.';
  }

  return null;
}

/**
 * AI Question Auditor & Error Doctor
 * Thoroughly inspects every question in the quiz list and generates a structured report
 * specifying: Câu số mấy, Bị lỗi gì, Cách sửa lỗi, và Hỗ trợ tự sửa 1-Click.
 * TUYỆT ĐỐI TÔN TRỌNG ĐÁP ÁN ĐÚNG CỦA GIÁO VIÊN (Không bao giờ báo đáp án của Giáo viên là lỗi!)
 */
export function auditQuizList(quizList: QuizItem[]): QuizAuditSummary {
  const issues: QuestionAuditIssue[] = [];

  if (!quizList || quizList.length === 0) {
    return {
      totalQuestions: 0,
      totalIssues: 0,
      criticalCount: 0,
      warningCount: 0,
      suggestionCount: 0,
      issues: [],
      isClean: true,
    };
  }

  quizList.forEach((q, idx) => {
    const qNum = idx + 1;
    const format = q.format || 'MULTIPLE_CHOICE';
    const qTitle = (q.q || '').trim();

    // 1. Kiểm tra tiêu đề câu hỏi
    if (!qTitle || qTitle.length < 3) {
      issues.push({
        id: `err_title_${idx}`,
        qid: idx,
        questionNumber: qNum,
        questionTitle: qTitle || '(Câu hỏi trống)',
        format,
        severity: 'CRITICAL',
        errorType: 'EMPTY_QUESTION',
        badgeLabel: '🔴 Trống đề',
        description: 'Nội dung câu hỏi đang để trống hoặc quá ngắn.',
        howToFix: 'Bấm vào câu này và nhập đầy đủ phần dẫn đề bài toán/câu hỏi trước các phương án.',
        autoFixable: true,
      });
    }

    // 2. Kiểm tra công thức STEM trong tiêu đề
    const formulaErr = checkFormulaErrors(qTitle);
    if (formulaErr) {
      issues.push({
        id: `err_formula_q_${idx}`,
        qid: idx,
        questionNumber: qNum,
        questionTitle: qTitle,
        format,
        severity: 'WARNING',
        errorType: 'BROKEN_FORMULA',
        badgeLabel: '🟡 Lỗi công thức',
        description: `Công thức toán/lý/hóa trong đề bị lỗi: ${formulaErr}`,
        howToFix: 'Kiểm tra và sửa lại dấu $ hoặc đóng đủ ngoặc nhọn {} cho các hàm \\frac, \\sqrt, \\vec.',
        autoFixable: true,
      });
    }

    // 3. Kiểm tra ảnh/sơ đồ hỏng
    if (qTitle.includes('<img')) {
      if (/<img[^>]*src=["']\s*["']/i.test(qTitle) || /<img(?![^>]*src=)/i.test(qTitle)) {
        issues.push({
          id: `err_img_${idx}`,
          qid: idx,
          questionNumber: qNum,
          questionTitle: qTitle,
          format,
          severity: 'WARNING',
          errorType: 'BROKEN_IMAGE',
          badgeLabel: '🟡 Ảnh hỏng',
          description: 'Thẻ hình ảnh sơ đồ <img> không có đường dẫn nguồn (src rỗng).',
          howToFix: 'Dán đường dẫn ảnh hợp lệ vào src="..." hoặc chèn lại ảnh sơ đồ/thí nghiệm.',
          autoFixable: false,
        });
      }
    }

    // 4. Kiểm tra theo từng Dạng thức THPT 2018 (kèm cảnh báo dòng cụ thể từ Parser nếu có)
    const linePrefix = q.sourceLine ? `[Dòng ${q.sourceLine}] ` : '';

    if (format === 'MULTIPLE_CHOICE') {
      const opts = q.opts || [];
      const correct = typeof q.correct === 'number' ? q.correct : -1;

      // Thiếu phương án
      if (opts.length < 2) {
        issues.push({
          id: `err_mc_no_opts_${idx}`,
          qid: idx,
          questionNumber: qNum,
          questionTitle: qTitle,
          format,
          severity: 'CRITICAL',
          errorType: 'MISSING_CHOICES',
          badgeLabel: '🔴 Thiếu phương án',
          description: `${linePrefix}Dạng thức I (4 lựa chọn) cần đủ ít nhất 2 đến 4 phương án A, B, C, D nhưng hiện tại chỉ có ${opts.length} phương án.`,
          howToFix: 'Bổ sung thêm các dòng A. B. C. D. hoặc bấm "⚡ AI Tự Động Sửa" để sinh đủ 4 phương án.',
          autoFixable: true,
        });
      } else if (opts.length < 4) {
        issues.push({
          id: `err_mc_few_opts_${idx}`,
          qid: idx,
          questionNumber: qNum,
          questionTitle: qTitle,
          format,
          severity: 'SUGGESTION',
          errorType: 'FEW_CHOICES',
          badgeLabel: '🟢 Khuyên đủ 4 lựa chọn',
          description: `${linePrefix}Hiện có ${opts.length} lựa chọn. Cấu trúc thi tốt nghiệp THPT chuẩn luôn có đủ 4 lựa chọn A, B, C, D.`,
          howToFix: 'Bổ sung thêm phương án để học sinh quen với đề thi tốt nghiệp chính thức.',
          autoFixable: true,
        });
      }

      // Chưa có đáp án đúng hoặc đáp án ngoài phạm vi
      if (correct < 0 || correct >= opts.length) {
        issues.push({
          id: `err_mc_no_correct_${idx}`,
          qid: idx,
          questionNumber: qNum,
          questionTitle: qTitle,
          format,
          severity: 'CRITICAL',
          errorType: 'NO_CORRECT_ANSWER',
          badgeLabel: '🔴 Chưa chọn ĐA đúng',
          description: `${linePrefix}Chưa có đáp án đúng nào được gạch chân hoặc chọn cho câu hỏi 4 lựa chọn này.`,
          howToFix: 'Gạch chân phương án đúng (mặc định gạch chân = Đúng, không gạch chân = Sai), hoặc bấm chọn trực tiếp vào phương án đúng trong bảng kiểm tra.',
          autoFixable: true,
        });
      }

      // Kiểm tra công thức trong các phương án
      opts.forEach((optText, oIdx) => {
        const oFormErr = checkFormulaErrors(optText);
        if (oFormErr) {
          const charLabel = String.fromCharCode(65 + oIdx);
          issues.push({
            id: `err_formula_opt_${idx}_${oIdx}`,
            qid: idx,
            questionNumber: qNum,
            questionTitle: qTitle,
            format,
            severity: 'WARNING',
            errorType: 'BROKEN_FORMULA_OPT',
            badgeLabel: `🟡 Lỗi CT ở ý ${charLabel}`,
            description: `Phương án ${charLabel} có công thức bị lỗi: ${oFormErr}`,
            howToFix: `Sửa lại cú pháp công thức ở phương án ${charLabel} cho đủ ngoặc nhọn {}.`,
            autoFixable: true,
          });
        }
      });

      // Kiểm tra phương án bị trùng lặp
      const uniqueOpts = new Set(opts.map(o => o.trim().toLowerCase()));
      if (opts.length >= 2 && uniqueOpts.size < opts.length) {
        issues.push({
          id: `err_mc_duplicate_${idx}`,
          qid: idx,
          questionNumber: qNum,
          questionTitle: qTitle,
          format,
          severity: 'WARNING',
          errorType: 'DUPLICATE_CHOICES',
          badgeLabel: '🟡 Trùng phương án',
          description: 'Có ít nhất 2 phương án trùng lặp nội dung giống hệt nhau.',
          howToFix: 'Chỉnh sửa lại nội dung phương án bị trùng để tạo phương án nhiễu hợp lý.',
          autoFixable: false,
        });
      }
    } else if (format === 'TRUE_FALSE') {
      const tfItems = q.tfItems || [];

      if (!tfItems || tfItems.length === 0) {
        issues.push({
          id: `err_tf_empty_${idx}`,
          qid: idx,
          questionNumber: qNum,
          questionTitle: qTitle,
          format,
          severity: 'CRITICAL',
          errorType: 'MISSING_TF_SUB_ITEMS',
          badgeLabel: '🔴 Thiếu ý a-b-c-d',
          description: 'Câu hỏi Đúng/Sai (Dạng thức II) chưa có 4 mệnh đề con a, b, c, d.',
          howToFix: 'Nhập 4 mệnh đề con a), b), c), d) (gạch chân ý Đúng, không gạch chân ý Sai) hoặc bấm "⚡ AI Tự Động Sửa".',
          autoFixable: true,
        });
      } else if (tfItems.length < 4) {
        issues.push({
          id: `err_tf_not_4_${idx}`,
          qid: idx,
          questionNumber: qNum,
          questionTitle: qTitle,
          format,
          severity: 'CRITICAL',
          errorType: 'TF_NOT_ENOUGH_4',
          badgeLabel: `🔴 Mới có ${tfItems.length}/4 ý`,
          description: `Chuẩn đề thi THPT 2018 quy định mỗi câu Dạng thức II bắt buộc phải có đủ 4 ý a, b, c, d. Hiện tại câu này chỉ có ${tfItems.length} ý.`,
          howToFix: 'Bổ sung thêm các ý còn thiếu để đạt đủ 4 ý a, b, c, d.',
          autoFixable: true,
        });
      } else {
        // Kiểm tra xem có ý nào bị trống không
        const emptyItems = tfItems.filter(it => !it.text || !it.text.trim() || /^Mệnh đề [a-d]$/i.test(it.text.trim()));
        if (emptyItems.length > 0) {
          issues.push({
            id: `err_tf_blank_text_${idx}`,
            qid: idx,
            questionNumber: qNum,
            questionTitle: qTitle,
            format,
            severity: 'WARNING',
            errorType: 'TF_BLANK_STATEMENT',
            badgeLabel: '🟡 Ý trống nội dung',
            description: `Có ${emptyItems.length} mệnh đề con đang để trống nội dung.`,
            howToFix: 'Điền nội dung phát biểu khoa học cho từng ý.',
            autoFixable: true,
          });
        }
        // Lưu ý: KHÔNG báo lỗi khi cả 4 ý đều Đúng hoặc đều Sai vì quy tắc:
        // "Mặc định các đáp án gạch chân là Đúng, không gạch chân là Sai" hoàn toàn do Giáo viên quyết định!
      }
    } else if (format === 'SHORT_ANSWER') {
      const saVal = (q.shortAnswer || (q.opts && q.opts[0]) || '').trim();

      if (!saVal) {
        issues.push({
          id: `err_sa_missing_${idx}`,
          qid: idx,
          questionNumber: qNum,
          questionTitle: qTitle,
          format,
          severity: 'CRITICAL',
          errorType: 'MISSING_SHORT_ANSWER',
          badgeLabel: '🔴 Chưa có đáp số',
          description: 'Câu hỏi Trả lời ngắn (Dạng thức III) chưa có đáp số chính xác.',
          howToFix: 'Nhập số (ví dụ: 12.5) hoặc từ khóa vào ô "Đáp án ngắn" của câu này.',
          autoFixable: true,
        });
      } else if (saVal.length > 35) {
        issues.push({
          id: `err_sa_too_long_${idx}`,
          qid: idx,
          questionNumber: qNum,
          questionTitle: qTitle,
          format,
          severity: 'WARNING',
          errorType: 'SA_TOO_LONG',
          badgeLabel: '🟡 Đáp số quá dài',
          description: `Đáp số trả lời ngắn đang có ${saVal.length} ký tự. Quy chế thi tốt nghiệp thường điền số nguyên, số thập phân hoặc cụm từ ngắn.`,
          howToFix: 'Rút gọn lại chỉ để con số kết quả (ví dụ: "4", "12.5", "3120").',
          autoFixable: true,
        });
      }
    }
  });

  const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
  const warningCount = issues.filter(i => i.severity === 'WARNING').length;
  const suggestionCount = issues.filter(i => i.severity === 'SUGGESTION').length;

  return {
    totalQuestions: quizList.length,
    totalIssues: issues.length,
    criticalCount,
    warningCount,
    suggestionCount,
    issues,
    isClean: issues.length === 0,
  };
}

/**
 * ⚡ 1-Click Auto-Fix for a specific issue (Strictly preserves Teacher's chosen answers)
 */
export function autoFixSingleIssue(quizList: QuizItem[], issue: QuestionAuditIssue): QuizItem[] {
  return quizList.map((q, idx) => {
    if (idx !== issue.qid) return q;

    const copy = { ...q };

    switch (issue.errorType) {
      case 'EMPTY_QUESTION': {
        copy.q = copy.q && copy.q.trim() ? copy.q : `Câu hỏi ${idx + 1}: Chọn khẳng định đúng`;
        break;
      }

      case 'NO_CORRECT_ANSWER': {
        if (copy.opts && copy.opts.length > 0 && (copy.correct < 0 || copy.correct >= copy.opts.length)) {
          const detected = aiAutoDetectCorrectIndex(copy.q, copy.opts);
          copy.correct = detected >= 0 && detected < copy.opts.length ? detected : 0;
          copy.aiSelected = true;
        }
        break;
      }

      case 'MISSING_CHOICES':
      case 'FEW_CHOICES': {
        const curOpts = [...(copy.opts || [])];
        const missingLabels = ['A', 'B', 'C', 'D'];
        while (curOpts.length < 4) {
          curOpts.push(`Phương án ${missingLabels[curOpts.length]}`);
        }
        copy.opts = curOpts;
        if (copy.correct < 0 || copy.correct >= curOpts.length) copy.correct = 0;
        break;
      }

      case 'MISSING_TF_SUB_ITEMS':
      case 'TF_NOT_ENOUGH_4': {
        const labels = ['a', 'b', 'c', 'd'];
        const existing = copy.tfItems ? [...copy.tfItems] : [];
        while (existing.length < 4) {
          const l = labels[existing.length];
          existing.push({
            label: l,
            text: `Phát biểu ${l} phù hợp với bản chất khoa học của bài học`,
            isCorrect: false,
          });
        }
        copy.tfItems = existing;
        copy.opts = existing.map(it => `${it.label}) ${it.text} (${it.isCorrect ? 'Đúng' : 'Sai'})`);
        break;
      }

      case 'TF_BLANK_STATEMENT': {
        if (copy.tfItems) {
          copy.tfItems = copy.tfItems.map((it, i) => ({
            ...it,
            text: it.text && it.text.trim() ? it.text : `Mệnh đề ${it.label || String.fromCharCode(97 + i)}`,
          }));
          copy.opts = copy.tfItems.map(it => `${it.label}) ${it.text} (${it.isCorrect ? 'Đúng' : 'Sai'})`);
        }
        break;
      }

      case 'MISSING_SHORT_ANSWER': {
        // Try to find numbers in the question text
        const nums = copy.q.match(/\b\d+(?:[\.,]\d+)?\b/g);
        copy.shortAnswer = nums && nums.length > 0 ? nums[0] : '10';
        copy.opts = [copy.shortAnswer];
        copy.correct = 0;
        break;
      }

      case 'SA_TOO_LONG': {
        const nums = (copy.shortAnswer || copy.q).match(/\b\d+(?:[\.,]\d+)?\b/);
        copy.shortAnswer = nums ? nums[0] : (copy.shortAnswer || '').slice(0, 10).trim();
        copy.opts = [copy.shortAnswer];
        break;
      }

      case 'BROKEN_FORMULA':
      case 'BROKEN_FORMULA_OPT': {
        // Balance brackets in formula
        const balance = (str: string) => {
          let open = (str.match(/\{/g) || []).length;
          let close = (str.match(/\}/g) || []).length;
          let res = str;
          while (open > close) {
            res += '}';
            close++;
          }
          return res;
        };
        copy.q = balance(copy.q);
        if (copy.opts) {
          copy.opts = copy.opts.map(o => balance(o));
        }
        break;
      }

      default:
        break;
    }

    return copy;
  });
}

/**
 * ⚡ Auto-Fix ALL issues in one click
 */
export function autoFixAllIssues(
  quizList: QuizItem[],
  summary: QuizAuditSummary
): { fixedList: QuizItem[]; fixedCount: number } {
  let currentList = [...quizList];
  let fixedCount = 0;

  for (const issue of summary.issues) {
    if (issue.autoFixable) {
      currentList = autoFixSingleIssue(currentList, issue);
      fixedCount++;
    }
  }

  return { fixedList: currentList, fixedCount };
}
