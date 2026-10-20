import { QuizItem, MatchState, Player } from '../types';
import { cleanQuestionTitleText, getConvertedGradeByRank } from '../data/defaultSubjects';

export function buildColorfulEvidenceHTMLDocument(
  quizList: QuizItem[],
  subjectTitle: string,
  isAutoPrint: boolean = false
): string {
  const nowStr = new Date().toLocaleDateString('vi-VN');

  const countF1 = quizList.filter(q => !q.format || q.format === 'MULTIPLE_CHOICE').length;
  const countF2 = quizList.filter(q => q.format === 'TRUE_FALSE').length;
  const countF3 = quizList.filter(q => q.format === 'SHORT_ANSWER').length;
  const totalQ = Math.max(quizList.length, 1);

  const cardsHTML = quizList.map((item, idx) => {
    const formatLabel =
      item.format === 'TRUE_FALSE'
        ? 'PHẦN II • DẠNG THỨC 2: TRẮC NGHIỆM ĐÚNG / SAI (4 Ý a, b, c, d)'
        : item.format === 'SHORT_ANSWER'
        ? 'PHẦN III • DẠNG THỨC 3: TRẮC NGHIỆM TRẢ LỜI NGẮN'
        : 'PHẦN I • DẠNG THỨC 1: TRẮC NGHIỆM 4 PHƯƠNG ÁN LỰA CHỌN';

    const rCount = item.rightCount || 0;
    const wCount = item.wrongCount || 0;
    const totalAttempts = rCount + wCount;
    const correctRate = totalAttempts > 0 ? Math.round((rCount / totalAttempts) * 100) : null;

    let bodyHTML = '';
    if (item.format === 'TRUE_FALSE' && item.tfItems && item.tfItems.length > 0) {
      bodyHTML = `
        <div class="exp-tf-grid">
          ${item.tfItems
            .map(
              tf => `
            <div class="exp-tf-row ${tf.isCorrect ? 'tf-true' : 'tf-false'}">
              <div class="exp-tf-text"><b>${tf.label})</b> ${tf.text}</div>
              <div class="exp-tf-badge ${tf.isCorrect ? 'badge-true' : 'badge-false'}">
                ${tf.isCorrect ? '✓ ĐÚNG' : '✗ SAI'}
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `;
    } else if (item.format === 'SHORT_ANSWER') {
      const ans = item.shortAnswer || item.opts?.[0] || '';
      bodyHTML = `
        <div class="exp-short-box">
          <div class="exp-short-label">✍️ ĐÁP ÁN CHUẨN (DẠNG THỨC III - TRẢ LỜI NGẮN):</div>
          <div class="exp-short-val">${ans}</div>
        </div>
      `;
    } else {
      const optsHTML = (item.opts || [])
        .map((opt, oIdx) => {
          const isCorrect = oIdx === item.correct;
          const letter = String.fromCharCode(65 + oIdx);
          return `
            <div class="exp-opt exp-color-${oIdx % 4} ${isCorrect ? 'exp-correct' : ''}">
              <span><b>${letter}.</b> ${opt}</span>
              ${isCorrect ? '<span class="exp-badge-right">✓ ĐÁP ÁN ĐÚNG</span>' : ''}
            </div>
          `;
        })
        .join('');
      bodyHTML = `<div class="exp-options-grid">${optsHTML}</div>`;
    }

    return `
      <div class="exp-card" id="slide-q-${idx}">
        <div class="exp-card-header">
          <span>CÂU HỎI SỐ ${idx + 1} / ${quizList.length} • ${formatLabel}</span>
          <span>Thống kê lớp học: ✅ ${rCount} lượt Đúng • ❌ ${wCount} lượt Sai ${
      correctRate !== null ? `(${correctRate}% Đúng)` : ''
    }</span>
        </div>
        <div class="exp-question-box">
          Câu ${idx + 1}: ${cleanQuestionTitleText(item.q)}
        </div>
        ${bodyHTML}
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Hồ Sơ Học Liệu Số & Ma Trận Đề Thi GDPT 2018: ${subjectTitle} - Thầy Hồ Tấn Khải</title>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; font-family: 'Nunito', sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; padding: 24px; background: #0f172a; color: #f8fafc; }
    .doc-container { max-width: 1040px; margin: 0 auto; }
    .doc-banner {
      background: linear-gradient(90deg, #090d16 0%, #1e1b4b 50%, #090d16 100%);
      border: 3px solid #f59e0b; border-radius: 20px; padding: 20px 28px;
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
      margin-bottom: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    }
    .doc-title { font-size: 23px; font-weight: 900; color: #38bdf8; margin: 0 0 6px 0; }
    .doc-sub { font-size: 14.5px; font-weight: 800; color: #fef08a; margin: 0; }
    .matrix-box {
      background: #111827; border: 2px solid #10b981; border-radius: 16px; padding: 16px 22px;
      margin-bottom: 20px;
    }
    .matrix-title { font-size: 15px; font-weight: 900; color: #6ee7b7; margin: 0 0 10px 0; text-transform: uppercase; }
    .matrix-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .matrix-item { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 10px 14px; }
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
      margin-bottom: 24px; page-break-inside: avoid; box-shadow: 0 10px 30px rgba(0,0,0,0.45);
    }
    .exp-card-header {
      display: flex; justify-content: space-between; font-size: 13px; font-weight: 900;
      color: #7dd3fc; margin-bottom: 10px; text-transform: uppercase; flex-wrap: wrap; gap: 6px;
    }
    .exp-question-box {
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      border: 2.5px solid #818cf8; border-radius: 16px; padding: 16px 22px;
      font-size: 21px; font-weight: 900; color: #fef08a; margin-bottom: 14px; line-height: 1.4;
    }
    .exp-options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .exp-opt {
      padding: 14px 18px; border-radius: 14px; font-size: 17px; font-weight: 900; color: #ffffff;
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
    body.show-answers .exp-opt:not(.exp-correct) { opacity: 0.6; }
    .exp-badge-right {
      display: none; background: #fef08a; color: #065f46; padding: 3px 10px;
      border-radius: 12px; font-size: 13px; font-weight: 900; white-space: nowrap;
    }
    body.show-answers .exp-badge-right { display: inline-block; }

    .exp-tf-grid { display: flex; flex-direction: column; gap: 8px; }
    .exp-tf-row {
      display: flex; justify-content: space-between; align-items: center; gap: 12px;
      padding: 12px 16px; border-radius: 12px; background: #1e293b; border: 1.5px solid #475569;
      font-size: 16.5px; font-weight: 800; color: #f8fafc;
    }
    .exp-tf-badge {
      display: none; padding: 4px 12px; border-radius: 8px; font-size: 13.5px; font-weight: 900; white-space: nowrap;
    }
    body.show-answers .exp-tf-badge { display: inline-block; }
    .badge-true { background: #10b981; color: #064e3b; }
    .badge-false { background: #ef4444; color: #ffffff; }

    .exp-short-box {
      background: #1e293b; border: 2px dashed #10b981; border-radius: 14px; padding: 16px 20px; text-align: center;
    }
    .exp-short-label { font-size: 13.5px; color: #6ee7b7; font-weight: 900; margin-bottom: 6px; }
    .exp-short-val { display: none; font-size: 26px; font-weight: 900; color: #fef08a; }
    body.show-answers .exp-short-val { display: block; }

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
        <h1 class="doc-title">🏅 HỒ SƠ THIẾT BỊ DẠY HỌC SỐ & MA TRẬN ĐỀ THI CHUẨN GDPT 2018</h1>
        <p class="doc-sub">Chủ đề / Môn học: ${subjectTitle} • Ngày trích xuất: ${nowStr} • Chuẩn định dạng Bộ GD&ĐT</p>
      </div>
      <div style="text-align:right;">
        <div style="background:#fef08a; color:#0f172a; padding:5px 14px; border-radius:20px; font-weight:900; font-size:14px; margin-bottom:4px;">👨‍🏫 Tác giả: Thầy Hồ Tấn Khải</div>
        <div style="background:#10b981; color:#ffffff; padding:5px 14px; border-radius:20px; font-weight:900; font-size:14px;">🏫 Trường THPT Mang Thít - Vĩnh Long</div>
      </div>
    </div>

    <div class="matrix-box">
      <div class="matrix-title">📊 BẢNG ĐẶC TẢ MA TRẬN CẤU TRÚC ĐỀ THI 3 DẠNG THỨC (CHƯƠNG TRÌNH THPT 2018)</div>
      <div class="matrix-grid">
        <div class="matrix-item">
          <div style="font-size:12.5px; color:#38bdf8; font-weight:900;">PHẦN I • DẠNG THỨC 1</div>
          <div style="font-size:18px; color:#ffffff; font-weight:900; margin:3px 0;">${countF1} câu (${Math.round((countF1 / totalQ) * 100)}%)</div>
          <div style="font-size:11.5px; color:#94a3b8;">Trắc nghiệm 4 phương án A, B, C, D (Năng lực Nhận biết & Thông hiểu)</div>
        </div>
        <div class="matrix-item">
          <div style="font-size:12.5px; color:#fde047; font-weight:900;">PHẦN II • DẠNG THỨC 2</div>
          <div style="font-size:18px; color:#ffffff; font-weight:900; margin:3px 0;">${countF2} câu (${Math.round((countF2 / totalQ) * 100)}%)</div>
          <div style="font-size:11.5px; color:#94a3b8;">Trắc nghiệm Đúng/Sai 4 mệnh đề a, b, c, d (Tư duy Phân tích & Tổng hợp)</div>
        </div>
        <div class="matrix-item">
          <div style="font-size:12.5px; color:#4ade80; font-weight:900;">PHẦN III • DẠNG THỨC 3</div>
          <div style="font-size:18px; color:#ffffff; font-weight:900; margin:3px 0;">${countF3} câu (${Math.round((countF3 / totalQ) * 100)}%)</div>
          <div style="font-size:11.5px; color:#94a3b8;">Trắc nghiệm Trả lời ngắn (Năng lực Vận dụng & Giải quyết vấn đề)</div>
        </div>
      </div>
    </div>

    <div class="control-panel">
      <button class="ctrl-btn" style="background:#10b981;" onclick="document.body.classList.toggle('show-answers')">👁️ Bật / Tắt Đáp Án Đúng (Dùng Trình Chiếu Trên Lớp)</button>
      <button class="ctrl-btn" style="background:#6366f1;" onclick="window.print()">🖨️ In hoặc Lưu thành PDF Hồ Sơ Minh Chứng</button>
      <span style="font-size:13.5px; color:#cbd5e1; font-weight:800; margin-left:auto;">Tổng số: ${quizList.length} câu hỏi chuẩn 3 dạng thức</span>
    </div>

    ${cardsHTML}
  </div>
  ${isAutoPrint ? '<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 500); };</script>' : ''}
</body>
</html>`;
}

export function exportColorfulPresentationHTML(quizList: QuizItem[], subjectTitle: string) {
  if (!quizList.length) {
    alert('Chưa có câu hỏi để xuất!');
    return;
  }
  const htmlContent = buildColorfulEvidenceHTMLDocument(quizList, subjectTitle, false);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Ho_So_Hoc_Lieu_So_GDPT2018_${Date.now()}.html`;
  a.click();
}

export function printEvidenceColorfulPDF(quizList: QuizItem[], subjectTitle: string) {
  if (!quizList.length) {
    alert('Chưa có câu hỏi để in!');
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

export function exportHonorCertificateHTML(matchState: MatchState, roomId: string) {
  const nowStr = new Date().toLocaleDateString('vi-VN');
  const allPlayers: Player[] = [...matchState.redPlayers, ...matchState.bluePlayers];
  const ranked = [...allPlayers].sort((a, b) => {
    if (matchState.gameType === 'BELL') {
      if (!a.eliminated && b.eliminated) return -1;
      if (a.eliminated && !b.eliminated) return 1;
      if ((b.lives || 0) !== (a.lives || 0)) return (b.lives || 0) - (a.lives || 0);
    }
    const sA = (a.fastScore || 0) + (a.correct || 0) * 100;
    const sB = (b.fastScore || 0) + (b.correct || 0) * 100;
    return sB - sA;
  });

  const top10 = ranked.slice(0, 10);
  const champion = top10[0];

  const gameName =
    matchState.gameType === 'BELL'
      ? 'RUNG CHUÔNG VÀNG 3D'
      : matchState.gameType === 'BOSS'
      ? 'DŨNG SĨ DIỆT BOSS KIẾN THỨC'
      : matchState.gameType === 'FAST'
      ? 'ĐƯỜNG ĐUA TỐC ĐỘ 3D'
      : 'ĐẤU TRƯỜNG KÉO CO 3D';

  const rowsHTML = top10
    .map((p, idx) => {
      const rank = idx + 1;
      const totalPts = (p.fastScore || 0) + (p.correct || 0) * 100;
      const g = getConvertedGradeByRank(rank, totalPts);
      return `
        <tr>
          <td style="padding:10px; font-weight:900; text-align:center;">${
            rank === 1 ? '🥇 Hạng 1' : rank === 2 ? '🥈 Hạng 2' : rank === 3 ? '🥉 Hạng 3' : `#${rank}`
          }</td>
          <td style="padding:10px; font-weight:900; color:#1e293b;">${p.label}</td>
          <td style="padding:10px; text-align:center; font-weight:800;">${p.correct || 0} câu</td>
          <td style="padding:10px; text-align:center; font-weight:900; color:#0284c7;">${totalPts} điểm</td>
          <td style="padding:10px; text-align:center; font-weight:900; color:#059669;">${g.grade} điểm (TT22)</td>
        </tr>
      `;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Bảng Vàng & Giấy Khen Vinh Danh - Trường THPT Mang Thít</title>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; font-family: 'Nunito', sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; padding: 24px; background: #fef9c3; color: #0f172a; }
    .cert-frame {
      max-width: 960px; margin: 0 auto; background: #ffffff;
      border: 8px double #d97706; border-radius: 24px; padding: 36px 42px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.18); position: relative;
    }
    .cert-header { text-align: center; border-bottom: 2px dashed #f59e0b; padding-bottom: 18px; margin-bottom: 22px; }
    .gov-line { font-size: 14px; font-weight: 900; text-transform: uppercase; color: #334155; }
    .school-line { font-size: 16px; font-weight: 900; color: #b45309; margin-top: 4px; }
    .cert-title { font-size: 32px; font-weight: 900; color: #dc2626; margin: 16px 0 6px 0; text-transform: uppercase; letter-spacing: 1px; }
    .cert-sub { font-size: 16px; font-weight: 800; color: #0284c7; margin: 0; }
    .champ-box {
      background: linear-gradient(135deg, #fef3c7, #fde68a); border: 2.5px solid #f59e0b;
      border-radius: 18px; padding: 18px 24px; text-align: center; margin-bottom: 24px;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { background: #1e293b; color: #fef08a; padding: 10px; font-size: 13.5px; }
    td { border-bottom: 1px solid #e2e8f0; font-size: 14.5px; }
    .sign-row { display: flex; justify-content: space-between; margin-top: 32px; padding: 0 24px; }
    @media print { .no-print { display: none !important; } body { background: #fff; padding: 0; } }
  </style>
</head>
<body>
  <div class="no-print" style="max-width:960px; margin:0 auto 16px auto; display:flex; justify-content:flex-end; gap:10px;">
    <button onclick="window.print()" style="padding:10px 20px; border-radius:10px; background:#059669; color:#fff; border:none; font-weight:900; cursor:pointer;">🖨️ In Bằng Vinh Danh / Lưu PDF</button>
  </div>
  <div class="cert-frame">
    <div class="cert-header">
      <div class="gov-line">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM • Độc lập - Tự do - Hạnh phúc</div>
      <div class="school-line">SỞ GD&ĐT VĨNH LONG • TRƯỜNG THPT MANG THÍT</div>
      <h1 class="cert-title">🏆 BẢNG VÀNG VINH DANH QUÁN QUÂN & TOP 10 XUẤT SẮC 🏆</h1>
      <p class="cert-sub">Học Liệu Số Đấu Trường 3D • Chế Độ: ${gameName} • Mã Phòng: ${roomId}</p>
    </div>

    <div class="champ-box">
      <div style="font-size:14px; font-weight:900; color:#b45309;">👑 QUÁN QUÂN XUẤT SẮC NHẤT TRẬN ĐẤU</div>
      <div style="font-size:28px; font-weight:900; color:#dc2626; margin:4px 0;">${
        champion ? champion.label : 'Tập thể Lớp Học Tích Cực'
      }</div>
      <div style="font-size:15px; font-weight:800; color:#065f46;">
        ${
          champion
            ? `Đạt ${champion.correct || 0} câu đúng • Tổng điểm: ${(champion.fastScore || 0) + (champion.correct || 0) * 100} điểm • Điểm quy đổi: 10.0 điểm`
            : 'Hoàn thành xuất sắc nhiệm vụ học tập chương trình GDPT 2018'
        }
      </div>
    </div>

    <h3 style="margin:0 0 8px 0; font-size:16px; color:#1e293b; text-transform:uppercase;">🌟 Danh Sách Top 10 Học Sinh Điển Hình & Quy Đổi Điểm Thường Xuyên (Thông Tư 22/2021/TT-BGDĐT):</h3>
    <table>
      <thead>
        <tr>
          <th>THỨ HẠNG</th>
          <th style="text-align:left;">HỌ VÀ TÊN HỌC SINH</th>
          <th>SỐ CÂU ĐÚNG</th>
          <th>TỔNG ĐIỂM</th>
          <th>ĐIỂM QUY ĐỔI</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHTML || '<tr><td colspan="5" style="padding:16px; text-align:center;">Chưa có dữ liệu học sinh</td></tr>'}
      </tbody>
    </table>

    <div class="sign-row">
      <div style="text-align:center;">
        <div style="font-size:13.5px; font-weight:800; color:#475569;">Hệ thống Đánh giá Năng lực Số</div>
        <div style="font-size:14px; font-weight:900; color:#0284c7; margin-top:36px;">Đã xác thực dữ liệu thời gian thực</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:13.5px; font-weight:800; color:#475569;">Mang Thít, ngày ${nowStr}</div>
        <div style="font-size:14.5px; font-weight:900; color:#0f172a; margin-top:4px;">GIÁO VIÊN / TÁC GIẢ BIÊN SOẠN</div>
        <div style="font-size:18px; font-weight:900; color:#dc2626; margin-top:34px;">Thầy Hồ Tấn Khải</div>
        <div style="font-size:13px; font-weight:800; color:#334155;">Trường THPT Mang Thít</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Bang_Vinh_Danh_THPT_Mang_Thit_Phong_${roomId}.html`;
  a.click();
}
