/**
 * THỜI GIAN THEO TỪNG PHẦN CÂU HỎI + TOÁN TẠM DỪNG THEO CÂU (logic thuần, không
 * phụ thuộc React/mạng — kiểm chứng bằng script test độc lập).
 *
 * Ánh xạ PHẦN ↔ dạng câu (đúng cấu trúc đề 3 phần hiện hành của app):
 *   Phần 1 — trắc nghiệm nhiều lựa chọn  ↔ MULTIPLE_CHOICE  (mặc định 30 giây)
 *   Phần 2 — Đúng/Sai                    ↔ TRUE_FALSE       (mặc định 60 giây)
 *   Phần 3 — trả lời ngắn                ↔ SHORT_ANSWER     (mặc định 60 giây)
 * Giáo viên chỉnh 3 ô số giây trong màn hình cài đặt (TeacherSetupView); các giá
 * trị lưu trong MatchSettings và chảy theo đúng cơ chế deadline của Đợt 1: host
 * tính durationSec CHO TỪNG CÂU theo phần của câu đó rồi công bố kèm
 * serverStartTime — phía HS chỉ dựng deadline tuyệt đối, không tự tính theo máy mình.
 */
import type { MatchSettings, QuestionFormat, QuizItem } from '../types';

export const DEFAULT_DURATION_MC_SEC = 30;
export const DEFAULT_DURATION_TF_SEC = 60;
export const DEFAULT_DURATION_SA_SEC = 60;

/**
 * Dạng hiệu dụng của 1 câu hỏi: ưu tiên trường format; thiếu thì suy ra từ dữ
 * liệu (có tfItems → Đúng/Sai; có shortAnswer → trả lời ngắn) — cùng quy tắc suy
 * luận đã dùng ở TeacherSetupView (chuẩn hoá đề) và utils/speechText.ts.
 */
export function resolveQuestionFormat(q?: QuizItem | null): QuestionFormat {
  if (!q) return 'MULTIPLE_CHOICE';
  if (q.format) return q.format;
  if (q.tfItems && q.tfItems.length > 0) return 'TRUE_FALSE';
  if (q.shortAnswer) return 'SHORT_ANSWER';
  return 'MULTIPLE_CHOICE';
}

function saneSec(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Số giây của 1 câu hỏi cụ thể theo phần của nó và cài đặt hiện hành của host. */
export function questionDurationFor(
  settings: MatchSettings | undefined | null,
  q?: QuizItem | null
): number {
  const format = resolveQuestionFormat(q);
  if (format === 'TRUE_FALSE') {
    return saneSec(settings?.questionDurationTfSec, DEFAULT_DURATION_TF_SEC);
  }
  if (format === 'SHORT_ANSWER') {
    return saneSec(settings?.questionDurationSaSec, DEFAULT_DURATION_SA_SEC);
  }
  return saneSec(settings?.questionDurationSec, DEFAULT_DURATION_MC_SEC);
}

/** Số giây CÒN LẠI của 1 đoạn câu tại thời điểm nowMs (không bao giờ âm). */
export function computeRemainingSec(startMs: number, durationSec: number, nowMs: number): number {
  return Math.max(0, durationSec - (nowMs - startMs) / 1000);
}

/**
 * Deadline mới khi TIẾP TỤC sau tạm dừng: mốc tiếp tục + số giây còn lại đã chốt
 * lúc dừng — học sinh không mất (và không được cộng thêm) giây nào.
 */
export function resumeDeadlineMs(resumeMs: number, remainingSec: number): number {
  return resumeMs + Math.max(0, remainingSec) * 1000;
}
