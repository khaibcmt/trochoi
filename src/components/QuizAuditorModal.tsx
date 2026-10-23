import React from 'react';
import { QuizItem } from '../types';
import { QuizAuditSummary, QuestionAuditIssue, autoFixSingleIssue, autoFixAllIssues } from '../services/quizAuditor';
import { MathRenderer } from '../utils/katexHelper';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  auditSummary: QuizAuditSummary;
  quizList: QuizItem[];
  onApplyFixedQuiz: (updatedQuiz: QuizItem[], message?: string) => void;
  onJumpToQuestion: (qIdx: number) => void;
}

export const QuizAuditorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  auditSummary,
  quizList,
  onApplyFixedQuiz,
  onJumpToQuestion,
}) => {
  if (!isOpen) return null;

  const handleFixSingle = (issue: QuestionAuditIssue) => {
    const updated = autoFixSingleIssue(quizList, issue);
    onApplyFixedQuiz(updated, `⚡ Đã tự động sửa lỗi cho Câu ${issue.questionNumber}!`);
  };

  const handleFixAll = () => {
    const { fixedList, fixedCount } = autoFixAllIssues(quizList, auditSummary);
    onApplyFixedQuiz(fixedList, `🎉 Đã tự động sửa hoàn hảo ${fixedCount} lỗi trong toàn bộ đề!`);
  };

  return (
    <div
      className="fixed inset-0 z-[99990] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border-2 border-indigo-500 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-slate-900 text-white px-5 py-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <span className="text-2xl p-2 bg-white/10 rounded-xl">🩺</span>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide flex items-center gap-2">
                BÁC SĨ BẮT LỖI ĐỀ & NHẬN DIỆN CÔNG THỨC STEM (AI DOCTOR)
              </h2>
              <p className="text-xs text-indigo-200 font-medium">
                Tự động kiểm tra: Câu số mấy? Bị lỗi gì? Cách sửa lỗi? • Chuẩn GDPT 2018 (Toán, Lý, Hóa, Sinh)
              </p>
            </div>
          </div>
          <button
            type="button"
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-lg font-bold transition"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Stats & Quick Actions Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs font-bold">
            <span className="px-3 py-1 bg-slate-200 text-slate-800 rounded-full">
              📚 Tổng: {auditSummary.totalQuestions} câu
            </span>
            {auditSummary.criticalCount > 0 ? (
              <span className="px-3 py-1 bg-red-100 text-red-700 border border-red-300 rounded-full flex items-center gap-1">
                🔴 {auditSummary.criticalCount} lỗi cần sửa
              </span>
            ) : (
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full flex items-center gap-1">
                ✅ 0 lỗi nghiêm trọng
              </span>
            )}
            {auditSummary.warningCount > 0 && (
              <span className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full flex items-center gap-1">
                🟡 {auditSummary.warningCount} cảnh báo
              </span>
            )}
            {auditSummary.suggestionCount > 0 && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 border border-blue-300 rounded-full flex items-center gap-1">
                🟢 {auditSummary.suggestionCount} tối ưu
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {auditSummary.totalIssues > 0 && (
              <button
                type="button"
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-1.5 cursor-pointer"
                onClick={handleFixAll}
              >
                <span>⚡</span> SỬA TỰ ĐỘNG TOÀN BỘ (1-CLICK)
              </button>
            )}
            <button
              type="button"
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition"
              onClick={onClose}
            >
              Đóng
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 max-h-[65vh]">
          {auditSummary.isClean ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl shadow-inner">
                🎉
              </div>
              <h3 className="text-lg font-black text-slate-800">
                XUẤT SẮC! ĐỀ THI HOÀN TOÀN CHUẨN XÁC, 0 LỖI
              </h3>
              <p className="text-sm text-slate-500 max-w-md">
                Tất cả {auditSummary.totalQuestions} câu hỏi đều hợp lệ, có đầy đủ đáp án đúng, công thức STEM kẹp LaTeX chuẩn và tương thích 100% với cấu trúc thi tốt nghiệp Quốc gia 2025.
              </p>
              <button
                type="button"
                className="mt-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition"
                onClick={onClose}
              >
                Tiếp tục & Sẵn sàng mở Sàn đấu 3D
              </button>
            </div>
          ) : (
            auditSummary.issues.map((issue) => {
              const borderClass =
                issue.severity === 'CRITICAL'
                  ? 'border-red-400 bg-red-50/50'
                  : issue.severity === 'WARNING'
                  ? 'border-amber-400 bg-amber-50/50'
                  : 'border-blue-400 bg-blue-50/50';

              const formatLabel =
                issue.format === 'TRUE_FALSE'
                  ? '🟪 Dạng II (Đúng/Sai)'
                  : issue.format === 'SHORT_ANSWER'
                  ? '🟩 Dạng III (Trả lời ngắn)'
                  : '🟦 Dạng I (4 lựa chọn)';

              return (
                <div
                  key={issue.id}
                  className={`border-2 rounded-xl p-3 sm:p-4 transition hover:shadow-md ${borderClass} flex flex-col sm:flex-row sm:items-start justify-between gap-3`}
                >
                  <div className="flex-1 space-y-1.5">
                    {/* Header line: Question number + Badge + Format */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm px-2.5 py-0.5 bg-slate-900 text-white rounded-lg">
                        CÂU {issue.questionNumber}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 bg-white/80 rounded-md border text-slate-700">
                        {formatLabel}
                      </span>
                      <span
                        className={`text-xs font-black px-2 py-0.5 rounded-full ${
                          issue.severity === 'CRITICAL'
                            ? 'bg-red-200 text-red-800'
                            : issue.severity === 'WARNING'
                            ? 'bg-amber-200 text-amber-800'
                            : 'bg-blue-200 text-blue-800'
                        }`}
                      >
                        {issue.badgeLabel}
                      </span>
                    </div>

                    {/* Question title preview */}
                    <div className="text-xs sm:text-sm font-semibold text-slate-800 line-clamp-2">
                      <span className="text-slate-400 font-normal">Đề bài: </span>
                      <MathRenderer text={issue.questionTitle} />
                    </div>

                    {/* What is the error? */}
                    <div className="text-xs text-red-700 bg-white/90 p-2 rounded-lg border border-red-200 flex items-start gap-1.5">
                      <span className="font-bold shrink-0">⚠️ Bị lỗi gì:</span>
                      <span>{issue.description}</span>
                    </div>

                    {/* How to fix? */}
                    <div className="text-xs text-slate-700 bg-white/90 p-2 rounded-lg border border-slate-200 flex items-start gap-1.5">
                      <span className="font-bold text-indigo-700 shrink-0">💡 Cách sửa lỗi:</span>
                      <span>{issue.howToFix}</span>
                    </div>
                  </div>

                  {/* Right side actions */}
                  <div className="flex sm:flex-col items-center gap-2 shrink-0">
                    {issue.autoFixable && (
                      <button
                        type="button"
                        className="w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-1 cursor-pointer"
                        onClick={() => handleFixSingle(issue)}
                        title="Bấm để AI tự động sửa lỗi câu này ngay lập tức"
                      >
                        ⚡ Tự Sửa Ngay
                      </button>
                    )}
                    <button
                      type="button"
                      className="w-full px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1"
                      onClick={() => {
                        onJumpToQuestion(issue.qid);
                        onClose();
                      }}
                      title="Cuộn xuống vị trí câu này trong bảng để chỉnh sửa thủ công"
                    >
                      ✏️ Nhảy Đến Câu Này
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info note */}
        <div className="bg-slate-100 px-5 py-2.5 border-t border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
          <span>
            💡 <b>Mẹo cho giáo viên:</b> Bấm <b>"⚡ Sửa Tự Động Toàn Bộ (1-Click)"</b> để AI tự chọn đáp án đúng hợp lý và điền đủ 4 ý theo chuẩn Bộ GD&ĐT trong 1 giây!
          </span>
          <span className="text-slate-400 font-semibold">Tác giả: Hồ Tấn Khải - THPT Mang Thít</span>
        </div>
      </div>
    </div>
  );
};
