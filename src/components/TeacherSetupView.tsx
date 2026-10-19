import React, { useRef, useEffect, useState } from 'react';
import { GamePlayType, JoinMode, SubjectData, QuizItem, MatchSettings } from '../types';
import {
  parseHTMLToQuiz,
  cleanQuestionTitleText,
  formatQuizToHTML,
  aiAutoDetectCorrectIndex,
  SAMPLE_PHAN_1_MC,
  SAMPLE_PHAN_2_TF,
  SAMPLE_PHAN_3_SA
} from '../data/defaultSubjects';

interface Props {
  subjectsDB: Record<string, SubjectData>;
  currentSubjectKey: string;
  gameType: GamePlayType;
  joinMode: JoinMode;
  maxPerTeam: number;
  matchSettings: MatchSettings;
  onUpdateSettings: (settings: MatchSettings) => void;
  onSelectSubject: (key: string) => void;
  onSelectGameType: (type: GamePlayType) => void;
  onSetJoinMode: (mode: JoinMode) => void;
  onSetMaxPerTeam: (qty: number) => void;
  onAddSubject: () => void;
  onSaveCurrentQuizToSubject: (parsedQuiz: QuizItem[], html: string) => void;
  onDeleteCurrentSubject: () => void;
  onLaunchArena: (quizList: QuizItem[]) => void;
  onSwitchToStudentMode: () => void;
  onExportHTMLSlide: () => void;
  onPrintPDFEvidence: () => void;
  onExportJSON: () => void;
  onImportJSON: (items: QuizItem[]) => void;
}

export const TeacherSetupView: React.FC<Props> = ({
  subjectsDB,
  currentSubjectKey,
  gameType,
  joinMode,
  maxPerTeam,
  matchSettings,
  onUpdateSettings,
  onSelectSubject,
  onSelectGameType,
  onSetJoinMode,
  onSetMaxPerTeam,
  onAddSubject,
  onSaveCurrentQuizToSubject,
  onDeleteCurrentSubject,
  onLaunchArena,
  onSwitchToStudentMode,
  onExportHTMLSlide,
  onPrintPDFEvidence,
  onExportJSON,
  onImportJSON
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);

  // AI Modal States
  const [showAIGenModal, setShowAIGenModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiLevel, setAiLevel] = useState('Thông hiểu');
  const [aiCount, setAiCount] = useState(5);
  const [aiLoading, setAiLoading] = useState(false);

  // AI OCR / Doc Parse Modal
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);

  // Sync editor innerHTML when subject changes
  useEffect(() => {
    if (editorRef.current && subjectsDB[currentSubjectKey]) {
      editorRef.current.innerHTML = subjectsDB[currentSubjectKey].html;
    }
  }, [currentSubjectKey, subjectsDB]);

  const handleUnderline = () => {
    document.execCommand('underline', false);
  };

  const handleClearEditor = () => {
    if (editorRef.current && confirm('Bạn có chắc muốn xóa trắng nội dung khung soạn thảo?')) {
      editorRef.current.innerHTML = '';
    }
  };

  const handleInsertSample = (sampleHTML: string) => {
    if (editorRef.current) {
      editorRef.current.innerHTML = (editorRef.current.innerHTML.trim() ? editorRef.current.innerHTML + '<br>' : '') + sampleHTML;
      editorRef.current.scrollTop = editorRef.current.scrollHeight;
    }
  };

  const handleAIAutoMark = () => {
    if (!editorRef.current) return;
    const raw = editorRef.current.innerHTML;
    const parsed = parseHTMLToQuiz(raw);
    if (!parsed.length) {
      alert("Vui lòng nhập hoặc dán câu hỏi vào khung soạn thảo trước!");
      return;
    }

    const updatedHTML = formatQuizToHTML(parsed);
    editorRef.current.innerHTML = updatedHTML;
    alert(`🤖 Trình AI đã tự động phân tích và gạch chân đáp án đúng cho toàn bộ ${parsed.length} câu hỏi chuẩn GDPT 2018!`);
  };

  // AI Question Generation API
  const handleAIGenerateQuestions = async () => {
    if (!aiTopic.trim()) {
      alert('Vui lòng nhập chủ đề bài học!');
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiTopic,
          subject: subjectsDB[currentSubjectKey]?.name || 'Tổng hợp',
          level: aiLevel,
          count: aiCount
        })
      });
      const data = await res.json();
      if (!data.success || !Array.isArray(data.questions)) {
        throw new Error(data.error || 'Lỗi tạo đề từ AI');
      }

      // Convert generated questions into QuizItem[]
      const newItems: QuizItem[] = data.questions.map((qObj: any, idx: number) => ({
        qid: idx,
        q: cleanQuestionTitleText(qObj.q || ''),
        format: qObj.format || 'MULTIPLE_CHOICE',
        opts: qObj.opts || [],
        correct: typeof qObj.correct === 'number' ? qObj.correct : 0,
        tfItems: qObj.tfItems || [],
        shortAnswer: qObj.shortAnswer || '',
        explanation: qObj.explanation || '',
        rightCount: 0,
        wrongCount: 0
      }));

      const newHTML = formatQuizToHTML(newItems);
      if (editorRef.current) {
        editorRef.current.innerHTML = (editorRef.current.innerHTML.trim() ? editorRef.current.innerHTML + '<br>' : '') + newHTML;
        editorRef.current.scrollTop = editorRef.current.scrollHeight;
      }
      setShowAIGenModal(false);
      alert(`🎉 AI đã tạo thành công ${newItems.length} câu hỏi theo chủ đề "${aiTopic}"!`);
    } catch (err: any) {
      alert('Lỗi tạo câu hỏi AI: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // AI OCR / Document Parsing API
  const handleAIParsingDocument = async (base64Image?: string) => {
    if (!base64Image && !ocrText.trim()) {
      alert('Vui lòng dán văn bản bài học hoặc tải ảnh chụp đề!');
      return;
    }
    setOcrLoading(true);
    try {
      const res = await fetch('/api/ai/parse-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textContent: ocrText,
          imageBase64: base64Image
        })
      });
      const data = await res.json();
      if (!data.success || !Array.isArray(data.questions)) {
        throw new Error(data.error || 'Lỗi phân tích tài liệu');
      }

      const newItems: QuizItem[] = data.questions.map((qObj: any, idx: number) => ({
        qid: idx,
        q: cleanQuestionTitleText(qObj.q || ''),
        format: qObj.format || 'MULTIPLE_CHOICE',
        opts: qObj.opts || [],
        correct: typeof qObj.correct === 'number' ? qObj.correct : 0,
        tfItems: qObj.tfItems || [],
        shortAnswer: qObj.shortAnswer || '',
        explanation: qObj.explanation || '',
        rightCount: 0,
        wrongCount: 0
      }));

      const newHTML = formatQuizToHTML(newItems);
      if (editorRef.current) {
        editorRef.current.innerHTML = (editorRef.current.innerHTML.trim() ? editorRef.current.innerHTML + '<br>' : '') + newHTML;
        editorRef.current.scrollTop = editorRef.current.scrollHeight;
      }
      setShowOCRModal(false);
      setOcrText('');
      alert(`🎉 AI đã bóc tách thành công ${newItems.length} câu hỏi từ tài liệu!`);
    } catch (err: any) {
      alert('Lỗi OCR / Phân tích tài liệu: ' + err.message);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleOCRFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const b64 = ev.target?.result as string;
      handleAIParsingDocument(b64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveToSubject = () => {
    if (!editorRef.current) return;
    const raw = editorRef.current.innerHTML.trim();
    const parsed = parseHTMLToQuiz(raw);
    if (!parsed.length) {
      alert("Chưa phát hiện câu hỏi hợp lệ! Mỗi câu cần có phương án hoặc mệnh đề.");
      return;
    }
    const updatedHTML = formatQuizToHTML(parsed);
    editorRef.current.innerHTML = updatedHTML;
    onSaveCurrentQuizToSubject(parsed, updatedHTML);
  };

  const handleStartArena = () => {
    if (!editorRef.current) return;
    const raw = editorRef.current.innerHTML.trim();
    const parsed = parseHTMLToQuiz(raw);
    if (!parsed.length) {
      alert("Vui lòng chọn hoặc nhập ít nhất 1 câu hỏi hợp lệ!");
      return;
    }
    const updatedHTML = formatQuizToHTML(parsed);
    editorRef.current.innerHTML = updatedHTML;
    onSaveCurrentQuizToSubject(parsed, updatedHTML);
    onLaunchArena(parsed);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const arr = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(arr)) throw new Error("Invalid format");
        const parsedItems: QuizItem[] = arr.map((item: any, i: number) => ({
          qid: i,
          q: cleanQuestionTitleText(item.q || item.question || ''),
          format: item.format || 'MULTIPLE_CHOICE',
          opts: item.opts || item.options || [],
          correct: typeof item.correct === 'number' ? item.correct : aiAutoDetectCorrectIndex(item.q, item.opts || []),
          tfItems: item.tfItems || [],
          shortAnswer: item.shortAnswer || '',
          rightCount: 0,
          wrongCount: 0
        }));
        const html = formatQuizToHTML(parsedItems);
        if (editorRef.current) editorRef.current.innerHTML = html;
        onImportJSON(parsedItems);
        alert(`✅ Đã nhập thành công ${parsedItems.length} câu hỏi từ file JSON!`);
      } catch (err) {
        alert("File JSON không hợp lệ!");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const orderKeys = ['BIO', 'AGRI', 'MATH', 'PHYS', 'CHEM', 'LIT', 'ENG', 'HIST', 'GEO', 'GDKTPL', 'IT', 'GDQPAN', 'ALL_SUBJ'];
  const customKeys = Object.keys(subjectsDB).filter(k => !orderKeys.includes(k));
  const allKeys = [...orderKeys, ...customKeys];

  return (
    <main id="teacher-view">
      <div className="setup-box">
        {/* Top Header */}
        <div className="flex-between">
          <h2 style={{ margin: 0 }}>🌾 Hệ Thống 12 Môn THPT (GDPT 2018) – Đấu Trường 3D Pro</h2>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              className="btn-action-sm"
              style={{ background: '#dcfce7', borderColor: '#10b981', color: '#065f46' }}
              onClick={onSwitchToStudentMode}
            >
              📱 Chế Độ HS (Nhập Mã Phòng)
            </button>
            <button
              className="btn-action-sm"
              style={{ background: '#fef3c7', borderColor: '#f59e0b', color: '#92400e' }}
              onClick={onExportHTMLSlide}
            >
              🎨 Xuất Slide Học Liệu Màu (.html)
            </button>
            <button
              className="btn-action-sm"
              style={{ background: '#e0e7ff', borderColor: '#6366f1', color: '#1e1b4b' }}
              onClick={onPrintPDFEvidence}
            >
              🖨️ In / Lưu PDF Minh Chứng
            </button>
            <button className="btn-action-sm" onClick={onExportJSON}>
              💾 Xuất Đề (.json)
            </button>
            <button className="btn-action-sm" onClick={() => fileInputRef.current?.click()}>
              📂 Nhập Đề (.json)
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* 4 Game Modes Grid */}
        <section className="gamemode-selector" aria-label="Chọn chế độ thi đấu">
          <div
            className={`gm-card ${gameType === 'TUG' ? 'active-gm' : ''}`}
            id="gm-card-TUG"
            onClick={() => onSelectGameType('TUG')}
          >
            <div className="gm-icon">⚔️</div>
            <div className="gm-info">
              <h3>CHẾ ĐỘ 1: ĐẤU TRƯỜNG KÉO CO 3D (ĐỒNG ĐỘI 3 HIỆP)</h3>
              <p>
                Chia 2 Đội Đỏ & Xanh đối kháng 3 Hiệp. Mỗi hiệp dẫn trước 3 câu là thắng hiệp. Nhận thẻ kỹ năng: 🛡️ Khiên, ❄️ Đóng băng đối thủ 3s, ⚡ Nhân đôi lực kéo!
              </p>
            </div>
          </div>

          <div
            className={`gm-card bell-gm ${gameType === 'BELL' ? 'active-gm' : ''}`}
            id="gm-card-BELL"
            onClick={() => onSelectGameType('BELL')}
          >
            <div className="gm-icon">🔔</div>
            <div className="gm-info">
              <h3>CHẾ ĐỘ 2: RUNG CHUÔNG VÀNG 3D (SINH TỒN & PHAO CỨU TRỢ)</h3>
              <p>
                Mỗi HS có 3 lượt (❤️❤️❤️). <b>Sai 3 câu bị loại</b>. Đúng 3 câu liên tiếp nhận +1❤️ và Thẻ 50/50. Khi bị loại hết, Giáo viên có nút <b>🛟 Tung Phao Cứu Trợ</b> hồi sinh toàn bộ!
              </p>
            </div>
          </div>

          <div
            className={`gm-card fast-gm ${gameType === 'FAST' ? 'active-gm' : ''}`}
            id="gm-card-FAST"
            onClick={() => onSelectGameType('FAST')}
          >
            <div className="gm-icon">🏎️</div>
            <div className="gm-info">
              <h3>CHẾ ĐỘ 3: AI NHANH NHẤT & ĐUA TỐC ĐỘ 3D</h3>
              <p>
                Đúng & nhanh nhất trọn <b>1.000đ</b>. Vinh danh <b>Top 10 Realtime</b>. Quy đổi điểm số chính xác: <b>Hạng 1–3 (10đ), 4–6 (9đ), 7–10 (8đ), 11–15 (7đ)</b>!
              </p>
            </div>
          </div>

          <div
            className={`gm-card boss-gm ${gameType === 'BOSS' ? 'active-gm' : ''}`}
            id="gm-card-BOSS"
            style={{
              borderColor: gameType === 'BOSS' ? '#ef4444' : '#f87171',
              background: gameType === 'BOSS' ? 'linear-gradient(135deg, #450a0a, #7f1d1d)' : '#fff1f2',
              color: gameType === 'BOSS' ? '#ffffff' : '#881337'
            }}
            onClick={() => onSelectGameType('BOSS')}
          >
            <div className="gm-icon">🐉</div>
            <div className="gm-info">
              <h3>CHẾ ĐỘ 4: ĐÁNH BOSS KIẾN THỨC 3D (CO-OP RAID)</h3>
              <p>
                Cả lớp hợp sức trả lời câu hỏi để bắn năng lượng tấn công Quái vật Kiến thức khổng lồ ({matchSettings.bossMaxHP} HP). Trả lời sai hoặc hết 30s, Boss phản đòn hồi 50 HP!
              </p>
            </div>
          </div>
        </section>

        {/* 4 Settings Direct Input Bar */}
        <section
          style={{
            margin: '10px 0',
            padding: '10px 14px',
            background: 'linear-gradient(90deg, #1e1b4b, #0f172a)',
            borderRadius: '12px',
            border: '2px solid #6366f1',
            color: '#ffffff',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
          aria-label="Cài đặt thông số trận đấu"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 900, color: '#fef08a' }}>⚙️ Cấu Hình Thông Số:</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 800 }}>
              👥 Sĩ số phòng:
              <input
                type="number"
                min={2}
                max={200}
                value={matchSettings.roomCapacity}
                onChange={e => onUpdateSettings({ ...matchSettings, roomCapacity: Math.max(2, parseInt(e.target.value) || 50) })}
                style={{ width: '60px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #94a3b8', background: '#090d16', color: '#38bdf8', fontWeight: 900, textAlign: 'center' }}
                title="Khống chế sĩ số học sinh kết nối vào phòng"
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 800 }}>
              🎮 Tối đa 3D trên sân:
              <input
                type="number"
                min={2}
                max={20}
                value={matchSettings.max3DRenderCount}
                onChange={e => onUpdateSettings({ ...matchSettings, max3DRenderCount: Math.min(20, Math.max(2, parseInt(e.target.value) || 20)) })}
                style={{ width: '60px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #94a3b8', background: '#090d16', color: '#4ade80', fontWeight: 900, textAlign: 'center' }}
                title="Giới hạn tối đa 20 nhân vật 3D vẽ trên sân, số còn lại cộng gộp +N tiếp sức"
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 800 }}>
              ⏱️ Thời gian đếm ngược:
              <input
                type="number"
                min={5}
                max={120}
                value={matchSettings.questionDurationSec}
                onChange={e => onUpdateSettings({ ...matchSettings, questionDurationSec: Math.max(5, parseInt(e.target.value) || 30) })}
                style={{ width: '60px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #94a3b8', background: '#090d16', color: '#f59e0b', fontWeight: 900, textAlign: 'center' }}
                title="Thời gian làm bài mỗi câu (30s tự động chuyển câu, không chọn = sai)"
              />
              <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>giây</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 800 }}>
              🐉 Máu Quái vật Boss:
              <input
                type="number"
                min={200}
                max={5000}
                step={100}
                value={matchSettings.bossMaxHP}
                onChange={e => onUpdateSettings({ ...matchSettings, bossMaxHP: Math.max(200, parseInt(e.target.value) || 1000) })}
                style={{ width: '70px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #94a3b8', background: '#090d16', color: '#f87171', fontWeight: 900, textAlign: 'center' }}
                title="Tổng lượng máu của Boss Quái vật trong chế độ Đánh Boss"
              />
              <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>HP</span>
            </label>
          </div>
        </section>

        {/* Subject Manager */}
        <section className="subject-manager" aria-label="Quản lý bộ môn và câu hỏi">
          <div className="subject-tabs">
            <span style={{ fontWeight: 900, fontSize: '12.5px', color: '#334155', marginRight: '4px' }}>
              12 Môn THPT:
            </span>
            {allKeys.map(k => {
              const item = subjectsDB[k];
              if (!item) return null;
              const isActive = k === currentSubjectKey;
              return (
                <button
                  key={k}
                  className={`btn-subj ${isActive ? 'active-subj' : ''}`}
                  style={{ background: item.color || '#0284c7' }}
                  onClick={() => onSelectSubject(k)}
                >
                  {item.name}
                </button>
              );
            })}
          </div>

          {/* Quick Insert GDPT 2018 Format Buttons & AI Tools */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', padding: '8px 0', borderTop: '1px dashed #cbd5e1', borderBottom: '1px dashed #cbd5e1', margin: '6px 0' }}>
            <span style={{ fontWeight: 900, fontSize: '12px', color: '#475569' }}>
              📝 3 Dạng Thức GDPT 2018:
            </span>
            <button
              className="btn-action-sm"
              style={{ background: '#eff6ff', borderColor: '#3b82f6', color: '#1d4ed8' }}
              onClick={() => handleInsertSample(SAMPLE_PHAN_1_MC)}
              title="Thêm mẫu Phần I: Trắc nghiệm 4 lựa chọn (A, B, C, D)"
            >
              ➕ Mẫu Phần I (4 Lựa Chọn)
            </button>
            <button
              className="btn-action-sm"
              style={{ background: '#f5f3ff', borderColor: '#8b5cf6', color: '#6d28d9' }}
              onClick={() => handleInsertSample(SAMPLE_PHAN_2_TF)}
              title="Thêm mẫu Phần II: Đúng/Sai chùm 4 ý (a, b, c, d)"
            >
              ➕ Mẫu Phần II (Đúng/Sai 4 ý)
            </button>
            <button
              className="btn-action-sm"
              style={{ background: '#ecfdf5', borderColor: '#10b981', color: '#047857' }}
              onClick={() => handleInsertSample(SAMPLE_PHAN_3_SA)}
              title="Thêm mẫu Phần III: Câu hỏi trả lời ngắn (Điền số / từ khóa)"
            >
              ➕ Mẫu Phần III (Trả Lời Ngắn)
            </button>

            <span style={{ margin: '0 4px', color: '#cbd5e1' }}>|</span>

            {/* AI Studio Pro Actions */}
            <button
              className="btn-action-sm"
              style={{ background: 'linear-gradient(135deg, #e0e7ff, #fae8ff)', borderColor: '#818cf8', color: '#3730a3', fontWeight: 900 }}
              onClick={() => setShowAIGenModal(true)}
            >
              🤖 AI Soạn Đề Tự Động
            </button>
            <button
              className="btn-action-sm"
              style={{ background: '#fffbeb', borderColor: '#fcd34d', color: '#92400e', fontWeight: 900 }}
              onClick={() => setShowOCRModal(true)}
            >
              📸 AI Quét Đề Từ Ảnh / Văn Bản
            </button>
          </div>

          <div className="flex-between" style={{ paddingTop: '6px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                className="btn-action-sm"
                style={{ background: '#dcfce7', borderColor: '#86efac', color: '#166534' }}
                onClick={onAddSubject}
              >
                ➕ Thêm Môn / Bài Mới
              </button>
              <button
                className="btn-action-sm"
                style={{ background: '#dbeafe', borderColor: '#93c5fd', color: '#1e40af' }}
                onClick={handleSaveToSubject}
              >
                💾 Lưu Đề Vào Môn Này
              </button>
              <button
                className="btn-action-sm"
                style={{ background: '#fae8ff', borderColor: '#d8b4fe', color: '#6b21a8' }}
                onClick={handleAIAutoMark}
              >
                🤖 AI Tự Chọn Đáp Án Đúng
              </button>
              {!subjectsDB[currentSubjectKey]?.fixed && (
                <button
                  className="btn-action-sm"
                  style={{ background: '#fee2e2', borderColor: '#fca5a5', color: '#991b1b' }}
                  onClick={onDeleteCurrentSubject}
                >
                  🗑️ Xóa Môn Này
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn-action-sm" onClick={handleUnderline}>
                <u>U</u> Gạch chân
              </button>
              <button className="btn-action-sm" onClick={handleClearEditor}>
                Xóa trắng
              </button>
            </div>
          </div>
        </section>

        {/* Contenteditable Rich Editor */}
        <div
          id="editor"
          ref={editorRef}
          contentEditable={true}
          suppressContentEditableWarning={true}
          style={{ minHeight: '180px', maxHeight: '340px', overflowY: 'auto' }}
        />

        {/* Team Configuration (Only for Tug of War) */}
        {gameType === 'TUG' && (
          <section className="config-grid" id="tug-team-config-row">
            <div className="cfg-card">
              <div style={{ fontWeight: 900, fontSize: '13.5px', marginBottom: '4px', color: '#0f172a' }}>
                ⚙️ Chế độ tham gia & Chia đội:
              </div>
              <label className="mode-option">
                <input
                  type="radio"
                  name="joinMode"
                  value="AUTO_ALL"
                  checked={joinMode === 'AUTO_ALL'}
                  onChange={() => onSetJoinMode('AUTO_ALL')}
                />
                <span><b>Toàn bộ lớp:</b> Tự động cân bằng sĩ số (Tất cả HS đều vào thi đấu)</span>
              </label>
              <label className="mode-option">
                <input
                  type="radio"
                  name="joinMode"
                  value="LIMITED_VS"
                  checked={joinMode === 'LIMITED_VS'}
                  onChange={() => onSetJoinMode('LIMITED_VS')}
                />
                <span><b>Giới hạn đấu thủ:</b> Đủ người vào sân, HS còn lại làm <b>Khán giả cổ vũ</b></span>
              </label>
            </div>

            <div
              className="cfg-card"
              style={{
                opacity: joinMode === 'LIMITED_VS' ? 1 : 0.5,
                pointerEvents: joinMode === 'LIMITED_VS' ? 'auto' : 'none'
              }}
            >
              <div style={{ fontWeight: 900, fontSize: '13.5px', textAlign: 'center' }}>
                Số đấu thủ chính thức mỗi bên:
              </div>
              <div className="qty-control">
                <button className="step-btn" onClick={() => onSetMaxPerTeam(Math.max(1, maxPerTeam - 1))}>
                  −
                </button>
                <span style={{ fontSize: '22px', fontWeight: 900 }}>{maxPerTeam}</span>
                <button className="step-btn" onClick={() => onSetMaxPerTeam(Math.min(25, maxPerTeam + 1))}>
                  +
                </button>
              </div>
            </div>
          </section>
        )}

        <div className="flex-between" style={{ marginTop: '12px' }}>
          <span style={{ fontSize: '12.5px', color: '#059669', fontWeight: 800 }}>
            🌾 Đầy đủ 3 Dạng Thức GDPT 2018 (Phần I, II, III) • Tự động qua câu 30s • Đánh Boss ({matchSettings.bossMaxHP} HP) & Kéo Co 3D!
          </span>
          <button className="btn-launch" onClick={handleStartArena}>
            MỞ SÂN ĐẤU 3D & HIỆN MÃ QR
          </button>
        </div>
      </div>

      {/* AI Generate Questions Modal */}
      {showAIGenModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '18px', padding: '24px', maxWidth: '520px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', color: '#0f172a' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '19px', color: '#3730a3' }}>
              🤖 AI Soạn Đề Chuẩn GDPT 2018 (Gemini 3.8 Flash)
            </h3>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 14px 0' }}>
              Nhập chủ đề bài dạy, môn học và mức độ nhận thức. AI sẽ tạo bộ câu hỏi đa dạng (Trắc nghiệm, Đúng/Sai 4 ý, Trả lời ngắn).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '13px', fontWeight: 800 }}>
                Chủ đề / Bài học:
                <input
                  type="text"
                  placeholder="VD: Cấu trúc di truyền quần thể, Định luật II Newton, Tích phân từng phần..."
                  value={aiTopic}
                  onChange={e => setAiTopic(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', marginTop: '4px', fontSize: '13.5px' }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label style={{ fontSize: '13px', fontWeight: 800 }}>
                  Mức độ nhận thức:
                  <select
                    value={aiLevel}
                    onChange={e => setAiLevel(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', marginTop: '4px', fontSize: '13px' }}
                  >
                    <option value="Nhận biết">1. Nhận biết</option>
                    <option value="Thông hiểu">2. Thông hiểu</option>
                    <option value="Vận dụng">3. Vận dụng</option>
                    <option value="Vận dụng cao">4. Vận dụng cao</option>
                    <option value="Tổng hợp đa cấp độ">Tổng hợp cả 4 cấp độ</option>
                  </select>
                </label>

                <label style={{ fontSize: '13px', fontWeight: 800 }}>
                  Số lượng câu hỏi:
                  <select
                    value={aiCount}
                    onChange={e => setAiCount(parseInt(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', marginTop: '4px', fontSize: '13px' }}
                  >
                    <option value={3}>3 câu</option>
                    <option value={5}>5 câu</option>
                    <option value={8}>8 câu</option>
                    <option value={10}>10 câu</option>
                  </select>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button
                className="btn-action-sm"
                onClick={() => setShowAIGenModal(false)}
                disabled={aiLoading}
              >
                Hủy
              </button>
              <button
                className="btn-launch"
                style={{ padding: '8px 18px', fontSize: '14px' }}
                onClick={handleAIGenerateQuestions}
                disabled={aiLoading}
              >
                {aiLoading ? '⏳ Đang tạo đề...' : '✨ Tạo Đề Ngay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI OCR & Document Parsing Modal */}
      {showOCRModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '18px', padding: '24px', maxWidth: '580px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', color: '#0f172a' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '19px', color: '#92400e' }}>
              📸 AI Quét Đề Từ Ảnh Chụp Hoặc Đoạn Văn Bản (OCR)
            </h3>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 12px 0' }}>
              Tải ảnh chụp trang đề thi hoặc dán nội dung từ file Word/PDF. AI sẽ tự động nhận diện và bóc tách thành danh sách câu hỏi chuẩn GDPT 2018.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                className="btn-action-sm"
                style={{ background: '#dbeafe', borderColor: '#60a5fa', color: '#1e40af', padding: '8px 14px' }}
                onClick={() => ocrFileInputRef.current?.click()}
                disabled={ocrLoading}
              >
                📷 Tải Ảnh Chụp Đề Thi (JPG/PNG)
              </button>
              <input
                type="file"
                ref={ocrFileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleOCRFileSelect}
              />
            </div>

            <label style={{ fontSize: '13px', fontWeight: 800 }}>
              Hoặc dán nội dung văn bản đề thi / bài học vào đây:
              <textarea
                rows={7}
                placeholder="Dán câu hỏi hoặc nội dung từ file Word/PDF tại đây..."
                value={ocrText}
                onChange={e => setOcrText(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', marginTop: '6px', fontSize: '13px', fontFamily: 'inherit' }}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button
                className="btn-action-sm"
                onClick={() => setShowOCRModal(false)}
                disabled={ocrLoading}
              >
                Hủy
              </button>
              <button
                className="btn-launch"
                style={{ padding: '8px 18px', fontSize: '14px' }}
                onClick={() => handleAIParsingDocument()}
                disabled={ocrLoading}
              >
                {ocrLoading ? '⏳ AI đang bóc tách...' : '⚡ Bóc Tách Đề'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
