import { QuizItem } from '../types';
import { cleanQuestionTitleText } from '../data/defaultSubjects';

export function buildColorfulEvidenceHTMLDocument(
  quizList: QuizItem[],
  subjectTitle: string,
  isAutoPrint: boolean = false
): string {
  const nowStr = new Date().toLocaleDateString('vi-VN');

  const cardsHTML = quizList.map((item, idx) => {
    const optsHTML = item.opts.map((opt, oIdx) => {
      const isCorrect = oIdx === item.correct;
      const letter = String.fromCharCode(65 + oIdx);
      return `
        <div class="exp-opt exp-color-${oIdx % 4} ${isCorrect ? 'exp-correct' : ''}">
          <span><b>${letter}.</b> ${opt}</span>
          ${isCorrect ? '<span class="exp-badge-right">✓ ĐÁP ÁN ĐÚNG</span>' : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="exp-card" id="slide-q-${idx}">
        <div class="exp-card-header">
          <span>CÂU HỎI SỐ ${idx + 1} / ${quizList.length}</span>
          <span>Thống kê lớp học: ✅ ${item.rightCount || 0} lượt Đúng • 🧊 ${item.wrongCount || 0} lượt Sai</span>
        </div>
        <div class="exp-question-box">
          Câu ${idx + 1}: ${cleanQuestionTitleText(item.q)}
        </div>
        <div class="exp-options-grid">
          ${optsHTML}
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Học Liệu & Minh Chứng: ${subjectTitle} - Thầy Hồ Tấn Khải</title>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; font-family: 'Nunito', sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; padding: 24px; background: #0f172a; color: #f8fafc; }
    .doc-container { max-width: 1020px; margin: 0 auto; }
    .doc-banner {
      background: linear-gradient(90deg, #090d16 0%, #1e1b4b 50%, #090d16 100%);
      border: 3px solid #f59e0b; border-radius: 20px; padding: 20px 28px;
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
      margin-bottom: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    }
    .doc-title { font-size: 24px; font-weight: 900; color: #38bdf8; margin: 0 0 6px 0; }
    .doc-sub { font-size: 15px; font-weight: 800; color: #fef08a; margin: 0; }
    .control-panel {
      background: #1e293b; border: 2px solid #475569; border-radius: 14px; padding: 12px 20px;
      margin-bottom: 24px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    }
    .ctrl-btn {
      padding: 10px 18px; border-radius: 10px; border: none; font-weight: 900; font-size: 14px;
      cursor: pointer; color: #fff; background: #0284c7;
    }
    .exp-card {
      background: #111827; border: 3px solid #38bdf8; border-radius: 22px; padding: 22px 26px;
      margin-bottom: 26px; page-break-inside: avoid; box-shadow: 0 10px 30px rgba(0,0,0,0.45);
    }
    .exp-card-header {
      display: flex; justify-content: space-between; font-size: 13.5px; font-weight: 900;
      color: #7dd3fc; margin-bottom: 10px; text-transform: uppercase;
    }
    .exp-question-box {
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      border: 2.5px solid #818cf8; border-radius: 16px; padding: 16px 22px;
      font-size: 22px; font-weight: 900; color: #fef08a; margin-bottom: 14px; line-height: 1.4;
    }
    .exp-options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .exp-opt {
      padding: 14px 18px; border-radius: 14px; font-size: 18px; font-weight: 900; color: #ffffff;
      display: flex; justify-content: space-between; align-items: center;
      border: 2.5px solid rgba(255,255,255,0.35);
    }
    .exp-color-0 { background: linear-gradient(135deg, #e11d48, #be123c); border-color: #fda4af; }
    .exp-color-1 { background: linear-gradient(135deg, #0284c7, #0369a1); border-color: #7dd3fc; }
    .exp-color-2 { background: linear-gradient(135deg, #d97706, #b45309); border-color: #fde047; }
    .exp-color-3 { background: linear-gradient(135deg, #7c3aed, #5b21b6); border-color: #c4b5fd; }

    body.show-answers .exp-opt.exp-correct {
      background: linear-gradient(135deg, #059669, #10b981) !important;
      border: 3.5px solid #fef08a !important; box-shadow: 0 0 20px rgba(16,185,129,0.7);
    }
    body.show-answers .exp-opt:not(.exp-correct) { opacity: 0.55; }
    .exp-badge-right {
      display: none; background: #fef08a; color: #065f46; padding: 3px 10px;
      border-radius: 12px; font-size: 13px; font-weight: 900; white-space: nowrap;
    }
    body.show-answers .exp-badge-right { display: inline-block; }

    @media print {
      body { background: #ffffff; color: #000; padding: 0; }
      .control-panel { display: none !important; }
      .exp-card { break-inside: avoid; margin-bottom: 18px; }
    }
  </style>
</head>
<body class="show-answers">
  <div class="doc-container">
    <div class="doc-banner">
      <div>
        <h1 class="doc-title">⚔️ HỒ SƠ HỌC LIỆU & MINH CHỨNG: ĐẤU TRƯỜNG 3D ĐA MÔN</h1>
        <p class="doc-sub">Chủ đề / Môn học: ${subjectTitle} • Ngày xuất: ${nowStr}</p>
      </div>
      <div style="text-align:right;">
        <div style="background:#fef08a; color:#0f172a; padding:5px 14px; border-radius:20px; font-weight:900; font-size:14px; margin-bottom:4px;">👨‍🏫 Tác giả: Thầy Hồ Tấn Khải</div>
        <div style="background:#10b981; color:#ffffff; padding:5px 14px; border-radius:20px; font-weight:900; font-size:14px;">🏫 Trường THPT Mang Thít</div>
      </div>
    </div>

    <div class="control-panel">
      <button class="ctrl-btn" style="background:#10b981;" onclick="document.body.classList.toggle('show-answers')">👁️ Bật / Tắt Đáp Án Đúng (Dùng Trình Chiếu Trên Lớp)</button>
      <button class="ctrl-btn" style="background:#6366f1;" onclick="window.print()">🖨️ In hoặc Lưu thành PDF Minh Chứng</button>
      <span style="font-size:13.5px; color:#cbd5e1; font-weight:800; margin-left:auto;">Tổng số: ${quizList.length} câu hỏi chuẩn màu sắc</span>
    </div>

    ${cardsHTML}
  </div>
  ${isAutoPrint ? '<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 500); };<\/script>' : ''}
</body>
</html>`;
}

export function exportColorfulPresentationHTML(quizList: QuizItem[], subjectTitle: string) {
  if (!quizList.length) {
    alert("Chưa có câu hỏi để xuất!");
    return;
  }
  const htmlContent = buildColorfulEvidenceHTMLDocument(quizList, subjectTitle, false);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Hoc_Lieu_Trinh_Chieu_3D_${Date.now()}.html`;
  a.click();
}

export function printEvidenceColorfulPDF(quizList: QuizItem[], subjectTitle: string) {
  if (!quizList.length) {
    alert("Chưa có câu hỏi để in!");
    return;
  }
  const htmlContent = buildColorfulEvidenceHTMLDocument(quizList, subjectTitle, true);
  const printWin = window.open('', '_blank');
  if (printWin) {
    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  } else {
    exportColorfulPresentationHTML(quizList, subjectTitle);
  }
}
