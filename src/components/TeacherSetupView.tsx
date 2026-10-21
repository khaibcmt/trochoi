import React, { useRef, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { GamePlayType, JoinMode, SubjectData, QuizItem, MatchSettings, Player } from '../types';
import {
  parseHTMLToQuiz,
  extractNormalizedLines,
  stripWordStyleGarbage,
  splitQuizTo3FormatHTML,
  cleanQuestionTitleText,
  formatQuizToHTML,
  aiAutoDetectCorrectIndex,
  SAMPLE_PHAN_1_MC,
  SAMPLE_PHAN_2_TF,
  SAMPLE_PHAN_3_SA
} from '../data/defaultSubjects';
import { generateQuestionsClientSide, parseDocClientSide, getStoredGeminiKey } from '../services/geminiClient';

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
  onSaveCurrentQuizToSubject: (parsedQuiz: QuizItem[], html: string, silent?: boolean) => void;
  onSyncQuizLive?: (parsedQuiz: QuizItem[]) => void;
  onDeleteCurrentSubject: () => void;
  onLaunchArena: (quizList: QuizItem[]) => void;
  onSwitchToStudentMode: () => void;
  onExportHTMLSlide: () => void;
  onPrintPDFEvidence: () => void;
  onExportJSON: () => void;
  onImportJSON: (items: QuizItem[]) => void;
  onOpenKeyModal?: () => void;
  activeRoomId?: string;
  connectedStudentCount?: number;
  connectedPlayers?: Player[];
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
  onSyncQuizLive,
  onDeleteCurrentSubject,
  onLaunchArena,
  onSwitchToStudentMode,
  onExportHTMLSlide,
  onPrintPDFEvidence,
  onExportJSON,
  onImportJSON,
  onOpenKeyModal,
  activeRoomId,
  connectedStudentCount = 0,
  connectedPlayers = []
}) => {
  // 3 Khung Dạng Thức Chia Sẵn Riêng Biệt (Chuẩn THPT 2018)
  const mcEditorRef = useRef<HTMLDivElement>(null);
  const tfEditorRef = useRef<HTMLDivElement>(null);
  const saEditorRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);

  // QR Modal States (Ẩn / Hiện Mã QR)
  const [showQRModal, setShowQRModal] = useState(false);
  const [roomQRImg, setRoomQRImg] = useState<string | null>(null);
  const [roomQRUrl, setRoomQRUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

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

  // Live parsed questions preview state
  const [livePreviewItems, setLivePreviewItems] = useState<QuizItem[]>([]);
  const [showPreviewList, setShowPreviewList] = useState<boolean>(true);

  // Generate Room QR Code
  useEffect(() => {
    if (!activeRoomId) return;
    let base = window.location.href.split('?')[0].split('#')[0];
    if (base.startsWith('file:')) {
      base = 'https://khaibcmt.github.io/edu/';
    }
    const gmFlag = gameType === 'FAST' ? '&gm=F' : (gameType === 'BELL' ? '&gm=B' : (gameType === 'BOSS' ? '&gm=BOSS' : ''));
    const url = `${base}?r=${activeRoomId}&t=R${gmFlag}`;
    setRoomQRUrl(url);
    QRCode.toDataURL(url, { width: 220, margin: 1, errorCorrectionLevel: 'H' }).then(setRoomQRImg).catch(() => {});
  }, [activeRoomId, gameType]);

  const handleCopyRoomLink = () => {
    if (!roomQRUrl) return;
    navigator.clipboard.writeText(roomQRUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const [formatCounts, setFormatCounts] = useState<{ mc: number; tf: number; sa: number }>({ mc: 0, tf: 0, sa: 0 });

  // Đọc & ghép câu hỏi từ 3 khung riêng biệt (Dạng I, Dạng II, Dạng III) mà không bao giờ bị lẫn hay mất câu
  const getCombinedQuizFrom3Boxes = (): QuizItem[] => {
    const mcRaw = mcEditorRef.current?.innerHTML?.trim() || '';
    const tfRaw = tfEditorRef.current?.innerHTML?.trim() || '';
    const saRaw = saEditorRef.current?.innerHTML?.trim() || '';

    const mcItems = mcRaw ? parseHTMLToQuiz(mcRaw, 'MULTIPLE_CHOICE') : [];
    const tfItems = tfRaw ? parseHTMLToQuiz(tfRaw, 'TRUE_FALSE') : [];
    const saItems = saRaw ? parseHTMLToQuiz(saRaw, 'SHORT_ANSWER') : [];

    const combined = [...mcItems, ...tfItems, ...saItems].map((item, idx) => ({
      ...item,
      qid: idx
    }));

    return combined;
  };

  const syncLiveToStorageAndHost = (items: QuizItem[]) => {
    const mc = items.filter(q => !q.format || q.format === 'MULTIPLE_CHOICE').length;
    const tf = items.filter(q => q.format === 'TRUE_FALSE').length;
    const sa = items.filter(q => q.format === 'SHORT_ANSWER').length;
    setFormatCounts({ mc, tf, sa });
    setLivePreviewItems(items);
    try {
      localStorage.setItem('custom_Active_Quiz_V31', JSON.stringify(items));
    } catch {}
    if (items.length > 0 && onSyncQuizLive) {
      onSyncQuizLive(items);
    }
  };

  const populate3BoxesFromItems = (items: QuizItem[]) => {
    const { mcHTML, tfHTML, saHTML } = splitQuizTo3FormatHTML(items);
    if (mcEditorRef.current) mcEditorRef.current.innerHTML = mcHTML;
    if (tfEditorRef.current) tfEditorRef.current.innerHTML = tfHTML;
    if (saEditorRef.current) saEditorRef.current.innerHTML = saHTML;
    syncLiveToStorageAndHost(items);
  };

  const syncEditorQuestionsLive = () => {
    const combined = getCombinedQuizFrom3Boxes();
    syncLiveToStorageAndHost(combined);
  };

  // Xử lý dán (Paste) từ Word / PDF / Zalo vào 3 khung: Lọc sạch rác <style>/<xml>/font-family của Word, tự tách dòng a) b) c) d) và giữ nguyên gạch chân <u>
  const handleCleanPasteInBox = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const htmlData = e.clipboardData.getData('text/html');
    const textData = e.clipboardData.getData('text/plain');

    const rawSource = htmlData && htmlData.trim() ? htmlData : textData;
    let cleanToInsert = '';

    if (rawSource && rawSource.trim()) {
      const normalizedLines = extractNormalizedLines(rawSource);
      if (normalizedLines.length > 0) {
        cleanToInsert = normalizedLines
          .map(p => {
            const safeLine = stripWordStyleGarbage(p.raw)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/⟦U⟧/g, '<u>')
              .replace(/⟦\/U⟧/g, '</u>');
            return `<div>${safeLine}</div>`;
          })
          .join('');
      }
    }

    if (cleanToInsert) {
      document.execCommand('insertHTML', false, cleanToInsert);
    }
    setTimeout(() => {
      syncEditorQuestionsLive();
    }, 30);
  };

  // Sync 3 format boxes when subject changes
  const lastLoadedSubjectKeyRef = useRef<string>('');
  useEffect(() => {
    if (subjectsDB[currentSubjectKey] && lastLoadedSubjectKeyRef.current !== currentSubjectKey) {
      lastLoadedSubjectKeyRef.current = currentSubjectKey;
      const parsed = parseHTMLToQuiz(subjectsDB[currentSubjectKey].html);
      populate3BoxesFromItems(parsed);
    }
  }, [currentSubjectKey, subjectsDB]);

  const handleUnderline = () => {
    document.execCommand('underline', false);
    syncEditorQuestionsLive();
  };

  const handleClearSingleBox = (boxType: 'MC' | 'TF' | 'SA') => {
    const targetRef = boxType === 'MC' ? mcEditorRef : boxType === 'TF' ? tfEditorRef : saEditorRef;
    const labelName = boxType === 'MC' ? 'Khung Dạng thức I (4 lựa chọn)' : boxType === 'TF' ? 'Khung Dạng thức II (Đúng/Sai)' : 'Khung Dạng thức III (Trả lời ngắn)';
    if (targetRef.current && confirm(`Bạn có chắc muốn xóa trắng ${labelName}?`)) {
      targetRef.current.innerHTML = '';
      syncEditorQuestionsLive();
    }
  };

  const handleClearEditor = () => {
    if (confirm('Bạn có chắc muốn xóa trắng toàn bộ cả 3 khung câu hỏi?')) {
      if (mcEditorRef.current) mcEditorRef.current.innerHTML = '';
      if (tfEditorRef.current) tfEditorRef.current.innerHTML = '';
      if (saEditorRef.current) saEditorRef.current.innerHTML = '';
      syncEditorQuestionsLive();
    }
  };

  const handleInsertSample = (sampleHTML: string, boxType: 'MC' | 'TF' | 'SA') => {
    const targetRef = boxType === 'MC' ? mcEditorRef : boxType === 'TF' ? tfEditorRef : saEditorRef;
    if (targetRef.current) {
      targetRef.current.innerHTML = (targetRef.current.innerHTML.trim() ? targetRef.current.innerHTML + '<br>' : '') + sampleHTML;
      targetRef.current.scrollTop = targetRef.current.scrollHeight;
      syncEditorQuestionsLive();
    }
  };

  // Thêm nhanh 1 câu hỏi mới theo đúng Dạng thức I, II, III
  const handleAddBlankQuestionByFormat = (fmt: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER') => {
    const newQ: QuizItem =
      fmt === 'TRUE_FALSE'
        ? {
            qid: livePreviewItems.length,
            q: 'Nhập nội dung câu hỏi Đúng/Sai (Dạng thức II) tại đây:',
            format: 'TRUE_FALSE',
            tfItems: [
              { label: 'a', text: 'Nội dung mệnh đề a', isCorrect: true },
              { label: 'b', text: 'Nội dung mệnh đề b', isCorrect: false },
              { label: 'c', text: 'Nội dung mệnh đề c', isCorrect: true },
              { label: 'd', text: 'Nội dung mệnh đề d', isCorrect: false }
            ],
            opts: [
              'a) Nội dung mệnh đề a (Đúng)',
              'b) Nội dung mệnh đề b (Sai)',
              'c) Nội dung mệnh đề c (Đúng)',
              'd) Nội dung mệnh đề d (Sai)'
            ],
            correct: 0
          }
        : fmt === 'SHORT_ANSWER'
        ? {
            qid: livePreviewItems.length,
            q: 'Nhập nội dung câu hỏi Trả lời ngắn (Dạng thức III) tại đây:',
            format: 'SHORT_ANSWER',
            shortAnswer: '10',
            opts: ['10'],
            correct: 0
          }
        : {
            qid: livePreviewItems.length,
            q: 'Nhập nội dung câu hỏi 4 phương án (Dạng thức I) tại đây:',
            format: 'MULTIPLE_CHOICE',
            opts: ['Phương án A (Đúng)', 'Phương án B', 'Phương án C', 'Phương án D'],
            correct: 0
          };

    const updated = [...livePreviewItems, newQ].map((item, idx) => ({ ...item, qid: idx }));
    populate3BoxesFromItems(updated);
    setShowPreviewList(true);
  };

  // Chỉnh sửa trực tiếp nội dung câu hỏi & phương án trong Bảng Kiểm Tra 3 Dạng Thức
  const handleQuickEditQuestionTitle = (qIdx: number, newTitle: string) => {
    const updated = livePreviewItems.map((item, idx) => (idx === qIdx ? { ...item, q: newTitle } : item));
    syncLiveToStorageAndHost(updated);
  };

  const handleQuickEditMCOptionText = (qIdx: number, optIdx: number, newOptText: string) => {
    const updated = livePreviewItems.map((item, idx) => {
      if (idx !== qIdx) return item;
      const nextOpts = [...item.opts];
      nextOpts[optIdx] = newOptText;
      return { ...item, opts: nextOpts };
    });
    syncLiveToStorageAndHost(updated);
  };

  const handleQuickChangeCorrectMC = (qIdx: number, newCorrectOptIdx: number) => {
    const updated = livePreviewItems.map((item, idx) =>
      idx === qIdx ? { ...item, correct: newCorrectOptIdx, aiSelected: false } : item
    );
    populate3BoxesFromItems(updated);
  };

  const handleQuickEditTFStatementText = (qIdx: number, tfIdx: number, newText: string) => {
    const updated = livePreviewItems.map((item, idx) => {
      if (idx !== qIdx || !item.tfItems) return item;
      const nextTf = item.tfItems.map((tf, i) => (i === tfIdx ? { ...tf, text: newText } : tf));
      return {
        ...item,
        tfItems: nextTf,
        opts: nextTf.map(tf => `${tf.label}) ${tf.text} (${tf.isCorrect ? 'Đúng' : 'Sai'})`)
      };
    });
    syncLiveToStorageAndHost(updated);
  };

  const handleQuickToggleTFItem = (qIdx: number, tfIdx: number) => {
    const updated = livePreviewItems.map((item, idx) => {
      if (idx !== qIdx || !item.tfItems) return item;
      const nextTf = item.tfItems.map((tf, i) => (i === tfIdx ? { ...tf, isCorrect: !tf.isCorrect } : tf));
      return {
        ...item,
        tfItems: nextTf,
        opts: nextTf.map(tf => `${tf.label}) ${tf.text} (${tf.isCorrect ? 'Đúng' : 'Sai'})`)
      };
    });
    populate3BoxesFromItems(updated);
  };

  const handleQuickEditShortAnswer = (qIdx: number, newVal: string) => {
    const updated = livePreviewItems.map((item, idx) =>
      idx === qIdx ? { ...item, shortAnswer: newVal, opts: [newVal] } : item
    );
    syncLiveToStorageAndHost(updated);
  };

  const handleCommitPreviewEditsToBoxes = () => {
    const { mcHTML, tfHTML, saHTML } = splitQuizTo3FormatHTML(livePreviewItems);
    if (mcEditorRef.current) mcEditorRef.current.innerHTML = mcHTML;
    if (tfEditorRef.current) tfEditorRef.current.innerHTML = tfHTML;
    if (saEditorRef.current) saEditorRef.current.innerHTML = saHTML;
  };

  const handleQuickDeleteQuestion = (qIdx: number) => {
    const updated = livePreviewItems.filter((_, idx) => idx !== qIdx).map((item, i) => ({ ...item, qid: i }));
    populate3BoxesFromItems(updated);
  };

  const handleAIAutoMark = () => {
    // Nếu giáo viên dán chung cả 3 phần vào 1 khung, tự động phân loại về đúng 3 khung Dạng thức I, II, III
    const mcRaw = mcEditorRef.current?.innerHTML?.trim() || '';
    const tfRaw = tfEditorRef.current?.innerHTML?.trim() || '';
    const saRaw = saEditorRef.current?.innerHTML?.trim() || '';

    const autoItems = [
      ...(mcRaw ? parseHTMLToQuiz(mcRaw) : []),
      ...(tfRaw ? parseHTMLToQuiz(tfRaw, 'TRUE_FALSE') : []),
      ...(saRaw ? parseHTMLToQuiz(saRaw, 'SHORT_ANSWER') : [])
    ].map((item, idx) => ({ ...item, qid: idx }));

    if (!autoItems.length) {
      alert('Vui lòng nhập hoặc dán câu hỏi vào ít nhất 1 trong 3 khung Dạng thức trước!');
      return;
    }
    populate3BoxesFromItems(autoItems);
    alert(`🤖 Hệ thống đã tự động chuẩn hóa, chia đúng 3 khung Dạng thức và gạch chân đáp án đúng cho toàn bộ ${autoItems.length} câu hỏi chuẩn GDPT 2018!`);
  };

  // AI Question Generation (Client-Side Gemini & Intelligent Offline Fallback)
  const handleAIGenerateQuestions = async () => {
    if (!aiTopic.trim()) {
      alert('Vui lòng nhập chủ đề bài học!');
      return;
    }
    setAiLoading(true);
    try {
      const newItems = await generateQuestionsClientSide({
        topic: aiTopic,
        subject: subjectsDB[currentSubjectKey]?.name || 'Sinh học',
        level: aiLevel,
        count: aiCount
      });

      if (newItems && newItems.length > 0) {
        const currentItems = getCombinedQuizFrom3Boxes();
        const merged = [...currentItems, ...newItems].map((it, idx) => ({ ...it, qid: idx }));
        populate3BoxesFromItems(merged);
        if (onSyncQuizLive) onSyncQuizLive(merged);
        setShowAIGenModal(false);
        const hasKey = !!getStoredGeminiKey();
        alert(`🎉 ${hasKey ? 'Google Gemini AI' : 'Hệ thống (Ngân hàng chuẩn GDPT 2018)'} đã nạp thành công ${newItems.length} câu hỏi vào 3 khung Dạng thức!`);
      } else {
        alert('Không tìm thấy câu hỏi phù hợp. Vui lòng thử lại!');
      }
    } catch (err: any) {
      alert('Lỗi tạo câu hỏi AI: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // AI OCR / Document Parsing (Client-Side)
  const handleAIParsingDocument = async (base64Image?: string) => {
    if (!base64Image && !ocrText.trim()) {
      alert('Vui lòng dán văn bản bài học hoặc tải ảnh chụp đề!');
      return;
    }
    setOcrLoading(true);
    try {
      const newItems = await parseDocClientSide({
        textContent: ocrText,
        imageBase64: base64Image
      });

      if (newItems && newItems.length > 0) {
        const currentItems = getCombinedQuizFrom3Boxes();
        const merged = [...currentItems, ...newItems].map((it, idx) => ({ ...it, qid: idx }));
        populate3BoxesFromItems(merged);
        if (onSyncQuizLive) onSyncQuizLive(merged);
        setShowOCRModal(false);
        setOcrText('');
        alert(`🎉 Đã bóc tách thành công ${newItems.length} câu hỏi chuẩn GDPT 2018 và chia vào đúng 3 khung Dạng thức!`);
      } else {
        alert('Không tìm thấy câu hỏi trắc nghiệm nào trong tài liệu.');
      }
    } catch (err: any) {
      if (err.message && err.message.includes('API Key') && onOpenKeyModal) {
        onOpenKeyModal();
      }
      alert(err.message || 'Lỗi bóc tách tài liệu.');
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
    const parsed = getCombinedQuizFrom3Boxes();
    if (!parsed.length) {
      alert('Chưa phát hiện câu hỏi hợp lệ! Vui lòng dán câu hỏi vào ít nhất 1 trong 3 khung Dạng thức.');
      return;
    }
    const updatedHTML = formatQuizToHTML(parsed);
    populate3BoxesFromItems(parsed);
    onSaveCurrentQuizToSubject(parsed, updatedHTML, false);
  };

  const handleStartArena = () => {
    const parsed = getCombinedQuizFrom3Boxes();
    if (!parsed.length) {
      alert('Vui lòng chọn hoặc nhập ít nhất 1 câu hỏi hợp lệ vào 1 trong 3 khung Dạng thức!');
      return;
    }
    const updatedHTML = formatQuizToHTML(parsed);
    populate3BoxesFromItems(parsed);
    onSaveCurrentQuizToSubject(parsed, updatedHTML, true);
    onLaunchArena(parsed);
  };

  const handleSwitchToStudentWithSync = () => {
    const parsed = getCombinedQuizFrom3Boxes();
    if (parsed.length > 0) {
      const updatedHTML = formatQuizToHTML(parsed);
      populate3BoxesFromItems(parsed);
      onSaveCurrentQuizToSubject(parsed, updatedHTML, true);
    }
    onSwitchToStudentMode();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const arr = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(arr)) throw new Error('Invalid format');
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
        populate3BoxesFromItems(parsedItems);
        onImportJSON(parsedItems);
        alert(`✅ Đã nhập thành công ${parsedItems.length} câu hỏi vào 3 khung Dạng thức!`);
      } catch (err) {
        alert('File JSON không hợp lệ!');
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
              onClick={handleSwitchToStudentWithSync}
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

        {/* Live Student Roster Banner right on Teacher Setup Screen */}
        <div
          style={{
            marginTop: '10px',
            padding: '10px 14px',
            background: 'linear-gradient(90deg, #064e3b, #0f172a)',
            border: '2px solid #10b981',
            borderRadius: '14px',
            color: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ background: '#10b981', color: '#022c22', fontWeight: 900, fontSize: '12.5px', padding: '4px 10px', borderRadius: '999px' }}>
                🟢 MÃ PHÒNG: {activeRoomId}
              </span>
              <span style={{ fontWeight: 900, fontSize: '13.5px', color: '#fef08a' }}>
                👥 Sĩ số học sinh đã vào phòng: <b style={{ color: '#4ade80', fontSize: '15px' }}>{connectedPlayers.length}</b> / {matchSettings.roomCapacity} HS
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-action-sm"
                style={{ background: '#0284c7', color: '#ffffff', borderColor: '#38bdf8', fontWeight: 900 }}
                onClick={() => setShowQRModal(true)}
              >
                📱 Hiện Mã QR Cho HS Quét
              </button>
              <button
                type="button"
                className="btn-action-sm"
                style={{ background: '#10b981', color: '#022c22', borderColor: '#6ee7b7', fontWeight: 900 }}
                onClick={handleStartArena}
              >
                🚀 Mở Sàn Đấu 3D Ngay
              </button>
            </div>
          </div>

          {connectedPlayers.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '78px', overflowY: 'auto', paddingTop: '2px' }}>
              {connectedPlayers.map((p, idx) => (
                <span
                  key={p.id || idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 900,
                    background: p.team === 'RED' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.25)',
                    border: `1.5px solid ${p.team === 'RED' ? '#f87171' : '#38bdf8'}`,
                    color: '#ffffff'
                  }}
                >
                  <span>{p.ready ? '✅' : '⏳'}</span>
                  <span>{p.label}</span>
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: '#a7f3d0', fontWeight: 700 }}>
              💡 Học sinh quét mã QR hoặc nhập mã phòng <b>{activeRoomId}</b> và bấm <b>"BƯỚC VÀO SÀN ĐẤU"</b> sẽ hiện tên ngay lập tức tại đây và trên sân 3D!
            </div>
          )}
        </div>

        {/* 4 Game Modes Grid - Single Row with 4 distinct 3D Colors */}
        <section className="gamemode-selector" aria-label="Chọn chế độ thi đấu">
          {/* Khối 1: ĐỎ CHIẾN BINH - KÉO CO 3D */}
          <div
            className={`gm-card tug-gm ${gameType === 'TUG' ? 'active-gm' : ''}`}
            id="gm-card-TUG"
            onClick={() => onSelectGameType('TUG')}
            title="Bấm để chọn Chế độ 1: Đấu Trường Kéo Co 3D"
          >
            <div className="gm-top-row">
              <span className="gm-badge" style={{ background: gameType === 'TUG' ? 'rgba(0,0,0,0.35)' : '#fee2e2', color: gameType === 'TUG' ? '#ffffff' : '#991b1b' }}>
                ⚔️ CHẾ ĐỘ 1
              </span>
              <span className="gm-check-indicator" style={{ background: gameType === 'TUG' ? '#ffffff' : '#fee2e2', color: gameType === 'TUG' ? '#b91c1c' : '#7f1d1d' }}>
                {gameType === 'TUG' ? '✓ Đang chọn' : 'Chọn'}
              </span>
            </div>
            <div className="gm-card-body">
              <div className="gm-icon">⚔️</div>
              <div className="gm-info">
                <h3>KÉO CO 3D (CHIA 2 ĐỘI)</h3>
                <p>
                  Chia 2 Đội Đỏ & Xanh đối kháng • Tính điểm & câu đúng để kéo thắng • Có hiệu ứng: 🛡️ Khiên, ❄️ Đóng băng, ⚡ x2 Kéo!
                </p>
              </div>
            </div>
          </div>

          {/* Khối 2: VÀNG HOÀNG KIM - RUNG CHUÔNG VÀNG 3D */}
          <div
            className={`gm-card bell-gm ${gameType === 'BELL' ? 'active-gm' : ''}`}
            id="gm-card-BELL"
            onClick={() => onSelectGameType('BELL')}
            title="Bấm để chọn Chế độ 2: Rung Chuông Vàng 3D"
          >
            <div className="gm-top-row">
              <span className="gm-badge" style={{ background: gameType === 'BELL' ? 'rgba(0,0,0,0.35)' : '#fef3c7', color: gameType === 'BELL' ? '#ffffff' : '#92400e' }}>
                🔔 CHẾ ĐỘ 2
              </span>
              <span className="gm-check-indicator" style={{ background: gameType === 'BELL' ? '#ffffff' : '#fef3c7', color: gameType === 'BELL' ? '#b45309' : '#78350f' }}>
                {gameType === 'BELL' ? '✓ Đang chọn' : 'Chọn'}
              </span>
            </div>
            <div className="gm-card-body">
              <div className="gm-icon">🔔</div>
              <div className="gm-info">
                <h3>RUNG CHUÔNG VÀNG 3D</h3>
                <p>
                  Chơi chung • Mỗi HS có 3 Mạng (❤️❤️❤️) • Trả lời sai mất 1 mạng, hết 3 mạng thành <b>Khán giả cổ vũ</b> • Có <b>🛟 Phao Cứu Trợ</b>!
                </p>
              </div>
            </div>
          </div>

          {/* Khối 3: XANH CYAN SIÊU TỐC - ĐUA TỐC ĐỘ 3D */}
          <div
            className={`gm-card fast-gm ${gameType === 'FAST' ? 'active-gm' : ''}`}
            id="gm-card-FAST"
            onClick={() => onSelectGameType('FAST')}
            title="Bấm để chọn Chế độ 3: Đua Tốc Độ 3D"
          >
            <div className="gm-top-row">
              <span className="gm-badge" style={{ background: gameType === 'FAST' ? 'rgba(0,0,0,0.35)' : '#e0f2fe', color: gameType === 'FAST' ? '#ffffff' : '#075985' }}>
                🏎️ CHẾ ĐỘ 3
              </span>
              <span className="gm-check-indicator" style={{ background: gameType === 'FAST' ? '#ffffff' : '#e0f2fe', color: gameType === 'FAST' ? '#0369a1' : '#0c4a6e' }}>
                {gameType === 'FAST' ? '✓ Đang chọn' : 'Chọn'}
              </span>
            </div>
            <div className="gm-card-body">
              <div className="gm-icon">🏎️</div>
              <div className="gm-info">
                <h3>ĐUA TỐC ĐỘ 3D (CÁ NHÂN)</h3>
                <p>
                  Chơi chung toàn lớp • Tính điểm cá nhân & số câu đúng để xếp hạng • Câu trả lời sai không bị phạt!
                </p>
              </div>
            </div>
          </div>

          {/* Khối 4: TÍM HUYỀN BÍ - ĐÁNH BOSS KIẾN THỨC 3D */}
          <div
            className={`gm-card boss-gm ${gameType === 'BOSS' ? 'active-gm' : ''}`}
            id="gm-card-BOSS"
            onClick={() => onSelectGameType('BOSS')}
            title="Bấm để chọn Chế độ 4: Đánh Boss Kiến Thức 3D"
          >
            <div className="gm-top-row">
              <span className="gm-badge" style={{ background: gameType === 'BOSS' ? 'rgba(0,0,0,0.35)' : '#f3e8ff', color: gameType === 'BOSS' ? '#ffffff' : '#6b21a8' }}>
                🐉 CHẾ ĐỘ 4
              </span>
              <span className="gm-check-indicator" style={{ background: gameType === 'BOSS' ? '#ffffff' : '#f3e8ff', color: gameType === 'BOSS' ? '#581c87' : '#3b0764' }}>
                {gameType === 'BOSS' ? '✓ Đang chọn' : 'Chọn'}
              </span>
            </div>
            <div className="gm-card-body">
              <div className="gm-icon">🐉</div>
              <div className="gm-info">
                <h3>DIỆT BOSS KIẾN THỨC</h3>
                <p>
                  Chơi chung toàn lớp • Tính điểm cá nhân & câu đúng để trừ máu Boss ({matchSettings.bossMaxHP} HP) • Vinh danh Dũng Sĩ!
                </p>
              </div>
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

          {/* Action Toolbar */}
          <div className="flex-between" style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '10px', border: '1.5px solid #cbd5e1', margin: '8px 0' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontWeight: 900, fontSize: '13px', color: '#0f172a' }}>
                📚 Tổng số câu đã nhận diện: <b style={{ color: '#0284c7', fontSize: '15px' }}>{formatCounts.mc + formatCounts.tf + formatCounts.sa} câu</b>
                {' '}({formatCounts.mc} Dạng I • {formatCounts.tf} Dạng II • {formatCounts.sa} Dạng III)
              </span>
              <button
                className="btn-action-sm"
                style={{ background: 'linear-gradient(135deg, #e0e7ff, #fae8ff)', borderColor: '#818cf8', color: '#3730a3', fontWeight: 900 }}
                onClick={() => setShowAIGenModal(true)}
              >
                🤖 AI Soạn Đề 3 Dạng Thức
              </button>
              <button
                className="btn-action-sm"
                style={{ background: '#fffbeb', borderColor: '#fcd34d', color: '#92400e', fontWeight: 900 }}
                onClick={() => setShowOCRModal(true)}
              >
                📸 AI Quét Đề Từ Ảnh / Văn Bản
              </button>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                className="btn-action-sm"
                style={{ background: '#dcfce7', borderColor: '#86efac', color: '#166534' }}
                onClick={onAddSubject}
              >
                ➕ Thêm Môn Mới
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
                🤖 Chuẩn Hóa & Tự Gạch Chân Đáp Án
              </button>
              <button className="btn-action-sm" onClick={handleUnderline} title="Bôi đen phương án đúng rồi bấm nút này để gạch chân">
                <u>U</u> Gạch chân đáp án
              </button>
              <button className="btn-action-sm" style={{ background: '#fee2e2', borderColor: '#fca5a5', color: '#991b1b' }} onClick={handleClearEditor}>
                🗑️ Xóa trắng cả 3 khung
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
          </div>
        </section>

        {/* CHIA SẴN 3 KHUNG DẠNG THỨC ĐỘC LẬP ĐỂ GIÁO VIÊN COPY - DÁN KHÔNG BAO GIỜ LỖI */}
        <section
          aria-label="Ba khung dán câu hỏi theo 3 dạng thức THPT 2018"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
            gap: '12px',
            margin: '10px 0'
          }}
        >
          {/* KHUNG 1: DẠNG THỨC I - TRẮC NGHIỆM 4 LỰA CHỌN (A, B, C, D) */}
          <div
            style={{
              background: '#eff6ff',
              border: '2.5px solid #3b82f6',
              borderRadius: '14px',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '13.5px', color: '#1d4ed8' }}>
                  🟦 KHUNG 1 — DẠNG THỨC I: 4 LỰA CHỌN (A, B, C, D)
                </div>
                <div style={{ fontSize: '11px', color: '#334155', fontWeight: 700 }}>
                  Copy dán câu hỏi A, B, C, D vào đây (Gạch chân <u>A</u>, đánh dấu <b>*A.</b> hoặc ghi <b>Đáp án: A</b>)
                </div>
              </div>
              <span style={{ background: '#1d4ed8', color: '#fff', fontWeight: 900, fontSize: '11.5px', padding: '3px 9px', borderRadius: '999px' }}>
                {formatCounts.mc} câu
              </span>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-action-sm"
                style={{ fontSize: '11px', padding: '4px 8px', background: '#dbeafe', borderColor: '#60a5fa', color: '#1e3a8a' }}
                onClick={() => handleInsertSample(SAMPLE_PHAN_1_MC, 'MC')}
              >
                ➕ Thêm mẫu Dạng I
              </button>
              <button
                type="button"
                className="btn-action-sm"
                style={{ fontSize: '11px', padding: '4px 8px' }}
                onClick={handleUnderline}
              >
                <u>U</u> Gạch chân ĐA
              </button>
              <button
                type="button"
                className="btn-action-sm"
                style={{ fontSize: '11px', padding: '4px 8px', color: '#b91c1c' }}
                onClick={() => handleClearSingleBox('MC')}
              >
                🗑️ Xóa khung 1
              </button>
            </div>

            <div
              id="editor-mc"
              ref={mcEditorRef}
              contentEditable={true}
              suppressContentEditableWarning={true}
              onPaste={handleCleanPasteInBox}
              onInput={syncEditorQuestionsLive}
              onBlur={syncEditorQuestionsLive}
              style={{
                minHeight: '190px',
                maxHeight: '290px',
                overflowY: 'auto',
                background: '#ffffff',
                border: '2px solid #93c5fd',
                borderRadius: '10px',
                padding: '10px',
                fontSize: '13.5px',
                lineHeight: 1.5,
                outline: 'none',
                color: '#0f172a'
              }}
            />
          </div>

          {/* KHUNG 2: DẠNG THỨC II - ĐÚNG / SAI 4 Ý (a, b, c, d) */}
          <div
            style={{
              background: '#f5f3ff',
              border: '2.5px solid #8b5cf6',
              borderRadius: '14px',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '13.5px', color: '#6d28d9' }}>
                  🟪 KHUNG 2 — DẠNG THỨC II: ĐÚNG / SAI (a, b, c, d)
                </div>
                <div style={{ fontSize: '11px', color: '#334155', fontWeight: 700 }}>
                  Copy dán câu hỏi có 4 ý a), b), c), d) (Gạch chân ý Đúng, ghi <b>(Đúng)/(Sai)</b> hoặc <b>Đáp án: Đ-S-Đ-S</b>)
                </div>
              </div>
              <span style={{ background: '#6d28d9', color: '#fff', fontWeight: 900, fontSize: '11.5px', padding: '3px 9px', borderRadius: '999px' }}>
                {formatCounts.tf} câu
              </span>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-action-sm"
                style={{ fontSize: '11px', padding: '4px 8px', background: '#ede9fe', borderColor: '#a78bfa', color: '#4c1d95' }}
                onClick={() => handleInsertSample(SAMPLE_PHAN_2_TF, 'TF')}
              >
                ➕ Thêm mẫu Dạng II
              </button>
              <button
                type="button"
                className="btn-action-sm"
                style={{ fontSize: '11px', padding: '4px 8px' }}
                onClick={handleUnderline}
              >
                <u>U</u> Gạch chân ý Đúng
              </button>
              <button
                type="button"
                className="btn-action-sm"
                style={{ fontSize: '11px', padding: '4px 8px', color: '#b91c1c' }}
                onClick={() => handleClearSingleBox('TF')}
              >
                🗑️ Xóa khung 2
              </button>
            </div>

            <div
              id="editor-tf"
              ref={tfEditorRef}
              contentEditable={true}
              suppressContentEditableWarning={true}
              onPaste={handleCleanPasteInBox}
              onInput={syncEditorQuestionsLive}
              onBlur={syncEditorQuestionsLive}
              style={{
                minHeight: '190px',
                maxHeight: '290px',
                overflowY: 'auto',
                background: '#ffffff',
                border: '2px solid #c4b5fd',
                borderRadius: '10px',
                padding: '10px',
                fontSize: '13.5px',
                lineHeight: 1.5,
                outline: 'none',
                color: '#0f172a'
              }}
            />
          </div>

          {/* KHUNG 3: DẠNG THỨC III - TRẢ LỜI NGẮN (ĐÁP SỐ / TỪ KHÓA) */}
          <div
            style={{
              background: '#ecfdf5',
              border: '2.5px solid #10b981',
              borderRadius: '14px',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '13.5px', color: '#047857' }}>
                  🟩 KHUNG 3 — DẠNG THỨC III: TRẢ LỜI NGẮN
                </div>
                <div style={{ fontSize: '11px', color: '#334155', fontWeight: 700 }}>
                  Copy dán câu hỏi Trả lời ngắn kèm dòng <b>Đáp án: ...</b> hoặc <b>ĐS: ...</b> ở dưới mỗi câu
                </div>
              </div>
              <span style={{ background: '#047857', color: '#fff', fontWeight: 900, fontSize: '11.5px', padding: '3px 9px', borderRadius: '999px' }}>
                {formatCounts.sa} câu
              </span>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-action-sm"
                style={{ fontSize: '11px', padding: '4px 8px', background: '#d1fae5', borderColor: '#34d399', color: '#065f46' }}
                onClick={() => handleInsertSample(SAMPLE_PHAN_3_SA, 'SA')}
              >
                ➕ Thêm mẫu Dạng III
              </button>
              <button
                type="button"
                className="btn-action-sm"
                style={{ fontSize: '11px', padding: '4px 8px' }}
                onClick={handleUnderline}
              >
                <u>U</u> Gạch chân ĐA
              </button>
              <button
                type="button"
                className="btn-action-sm"
                style={{ fontSize: '11px', padding: '4px 8px', color: '#b91c1c' }}
                onClick={() => handleClearSingleBox('SA')}
              >
                🗑️ Xóa khung 3
              </button>
            </div>

            <div
              id="editor-sa"
              ref={saEditorRef}
              contentEditable={true}
              suppressContentEditableWarning={true}
              onPaste={handleCleanPasteInBox}
              onInput={syncEditorQuestionsLive}
              onBlur={syncEditorQuestionsLive}
              style={{
                minHeight: '190px',
                maxHeight: '290px',
                overflowY: 'auto',
                background: '#ffffff',
                border: '2px solid #6ee7b7',
                borderRadius: '10px',
                padding: '10px',
                fontSize: '13.5px',
                lineHeight: 1.5,
                outline: 'none',
                color: '#0f172a'
              }}
            />
          </div>
        </section>

        {/* BẢNG KIỂM TRA & SOẠN THẢO TRỰC QUAN 3 DẠNG THỨC (LIVE INTERACTIVE EDITOR) */}
        <section
          style={{
            margin: '10px 0',
            background: '#ffffff',
            border: '2px solid #cbd5e1',
            borderRadius: '14px',
            padding: '10px 14px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontWeight: 900, fontSize: '13.5px', color: '#0f172a' }}>
              ✅ Bảng Soạn Thảo & Kiểm Tra Trực Quan 3 Dạng Thức ({livePreviewItems.length} câu — Sửa trực tiếp nội dung hoặc bấm chọn Đáp án đúng):
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-action-sm"
                style={{ fontSize: '11.5px', padding: '4px 9px', background: '#dbeafe', borderColor: '#60a5fa', color: '#1e3a8a', fontWeight: 900 }}
                onClick={() => handleAddBlankQuestionByFormat('MULTIPLE_CHOICE')}
              >
                ➕ Thêm Câu Dạng I (A,B,C,D)
              </button>
              <button
                type="button"
                className="btn-action-sm"
                style={{ fontSize: '11.5px', padding: '4px 9px', background: '#ede9fe', borderColor: '#a78bfa', color: '#4c1d95', fontWeight: 900 }}
                onClick={() => handleAddBlankQuestionByFormat('TRUE_FALSE')}
              >
                ➕ Thêm Câu Dạng II (Đúng/Sai)
              </button>
              <button
                type="button"
                className="btn-action-sm"
                style={{ fontSize: '11.5px', padding: '4px 9px', background: '#d1fae5', borderColor: '#34d399', color: '#065f46', fontWeight: 900 }}
                onClick={() => handleAddBlankQuestionByFormat('SHORT_ANSWER')}
              >
                ➕ Thêm Câu Dạng III (Trả lời ngắn)
              </button>
              <button
                type="button"
                className="btn-action-sm"
                style={{ fontSize: '11.5px', padding: '4px 10px' }}
                onClick={() => setShowPreviewList(!showPreviewList)}
              >
                {showPreviewList ? '🔽 Thu gọn danh sách' : '▶️ Mở danh sách câu hỏi'}
              </button>
            </div>
          </div>

          {showPreviewList && (
            <div
              style={{
                marginTop: '8px',
                maxHeight: '320px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingRight: '4px'
              }}
            >
              {livePreviewItems.length === 0 ? (
                <div style={{ padding: '14px', textAlign: 'center', color: '#64748b', fontWeight: 700, fontSize: '13px' }}>
                  Chưa có câu hỏi nào. Hãy copy dán câu hỏi vào 3 khung ở trên hoặc bấm nút <b>&ldquo;➕ Thêm Câu Dạng I / II / III&rdquo;</b>!
                </div>
              ) : (
                livePreviewItems.map((item, qIdx) => {
                  const fmtLabel =
                    item.format === 'TRUE_FALSE'
                      ? 'Dạng II: Đúng/Sai (4 ý)'
                      : item.format === 'SHORT_ANSWER'
                      ? 'Dạng III: Trả lời ngắn'
                      : 'Dạng I: 4 lựa chọn';
                  const fmtColor =
                    item.format === 'TRUE_FALSE' ? '#6d28d9' : item.format === 'SHORT_ANSWER' ? '#047857' : '#1d4ed8';

                  return (
                    <div
                      key={qIdx}
                      style={{
                        background: '#f8fafc',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '10px',
                        padding: '9px 12px',
                        fontSize: '12.5px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span
                          style={{
                            background: fmtColor,
                            color: '#fff',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 900,
                            flexShrink: 0
                          }}
                        >
                          Câu {qIdx + 1} • {fmtLabel}
                        </span>
                        <input
                          type="text"
                          value={item.q}
                          onChange={e => handleQuickEditQuestionTitle(qIdx, e.target.value)}
                          onBlur={handleCommitPreviewEditsToBoxes}
                          placeholder="Nhập nội dung câu hỏi..."
                          style={{
                            flex: 1,
                            padding: '5px 8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontWeight: 800,
                            fontSize: '12.5px',
                            color: '#0f172a',
                            background: '#ffffff'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleQuickDeleteQuestion(qIdx)}
                          style={{
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fca5a5',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: 900,
                            cursor: 'pointer',
                            flexShrink: 0
                          }}
                          title="Xóa câu này"
                        >
                          ✕ Xóa
                        </button>
                      </div>

                      {(!item.format || item.format === 'MULTIPLE_CHOICE') && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '6px' }}>
                          {item.opts.map((optTxt, oIdx) => {
                            const isCorr = item.correct === oIdx;
                            const letter = String.fromCharCode(65 + oIdx);
                            return (
                              <div
                                key={oIdx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '4px 6px',
                                  borderRadius: '8px',
                                  border: isCorr ? '2px solid #059669' : '1px solid #cbd5e1',
                                  background: isCorr ? '#dcfce7' : '#ffffff'
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleQuickChangeCorrectMC(qIdx, oIdx)}
                                  title="Bấm để chọn làm Đáp án Đúng"
                                  style={{
                                    padding: '3px 7px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: isCorr ? '#059669' : '#e2e8f0',
                                    color: isCorr ? '#ffffff' : '#334155',
                                    fontWeight: 900,
                                    fontSize: '11.5px',
                                    cursor: 'pointer',
                                    flexShrink: 0
                                  }}
                                >
                                  {isCorr ? `✅ ${letter}` : letter}
                                </button>
                                <input
                                  type="text"
                                  value={optTxt}
                                  onChange={e => handleQuickEditMCOptionText(qIdx, oIdx, e.target.value)}
                                  onBlur={handleCommitPreviewEditsToBoxes}
                                  style={{
                                    flex: 1,
                                    border: 'none',
                                    background: 'transparent',
                                    fontWeight: isCorr ? 900 : 700,
                                    color: isCorr ? '#065f46' : '#1e293b',
                                    fontSize: '12px',
                                    outline: 'none'
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {item.format === 'TRUE_FALSE' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '6px' }}>
                          {(item.tfItems || []).map((tf, tfIdx) => (
                            <div
                              key={tfIdx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 6px',
                                borderRadius: '8px',
                                border: tf.isCorrect ? '2px solid #059669' : '1.5px solid #f43f5e',
                                background: tf.isCorrect ? '#dcfce7' : '#ffe4e6'
                              }}
                            >
                              <span style={{ fontWeight: 900, color: '#1e293b', fontSize: '12px' }}>{tf.label})</span>
                              <input
                                type="text"
                                value={tf.text}
                                onChange={e => handleQuickEditTFStatementText(qIdx, tfIdx, e.target.value)}
                                onBlur={handleCommitPreviewEditsToBoxes}
                                style={{
                                  flex: 1,
                                  border: 'none',
                                  background: 'transparent',
                                  fontWeight: 800,
                                  color: tf.isCorrect ? '#065f46' : '#9f1239',
                                  fontSize: '12px',
                                  outline: 'none'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleQuickToggleTFItem(qIdx, tfIdx)}
                                title="Bấm để đổi Đúng / Sai"
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: tf.isCorrect ? '#059669' : '#e11d48',
                                  color: '#ffffff',
                                  fontWeight: 900,
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  flexShrink: 0
                                }}
                              >
                                {tf.isCorrect ? 'ĐÚNG' : 'SAI'}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {item.format === 'SHORT_ANSWER' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 900, color: '#047857', fontSize: '12px' }}>🔑 Đáp án ngắn đúng:</span>
                          <input
                            type="text"
                            value={item.shortAnswer ?? item.opts[0] ?? ''}
                            onChange={e => handleQuickEditShortAnswer(qIdx, e.target.value)}
                            onBlur={handleCommitPreviewEditsToBoxes}
                            placeholder="Nhập đáp số hoặc từ khóa (VD: 12,5)"
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: '2px solid #10b981',
                              background: '#ecfdf5',
                              color: '#065f46',
                              fontWeight: 900,
                              fontSize: '12.5px',
                              width: '240px'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>

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

        <div className="flex-between" style={{ marginTop: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '12.5px', color: '#059669', fontWeight: 800 }}>
            🟢 Mã phòng cố định: <b style={{ color: '#0284c7' }}>{activeRoomId}</b> ({connectedStudentCount} HS đang trong phòng) • Đổi trò chơi không cần quét lại QR!
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-action-sm"
              style={{
                background: showQRModal ? 'linear-gradient(135deg, #0284c7, #0369a1)' : '#1e293b',
                color: '#ffffff',
                borderColor: '#38bdf8',
                padding: '9px 14px',
                fontSize: '13px',
                fontWeight: 900
              }}
              onClick={() => setShowQRModal(!showQRModal)}
              title="Bấm để ẩn / hiện mã QR phòng cho học sinh quét trước"
            >
              {showQRModal ? '🙈 ẨN MÃ QR' : '📱 ẨN / HIỆN MÃ QR'}
            </button>
            <button
              className="btn-launch"
              onClick={handleStartArena}
              title="Vào sảnh chuẩn bị sàn đấu 3D để tập hợp đủ học sinh trước khi bấm Bắt đầu"
            >
              📣 CHUẨN BỊ VÀO SÀN ĐẤU (TẬP HỢP HS)
            </button>
          </div>
        </div>
      </div>

      {/* LUÔN HIỆN THANH MỞ SÂN ĐẤU & HIỆN MÃ QR (Always-Visible Pinned Launch Bar) */}
      <aside className="sticky-launch-bar" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(3, 7, 18, 0.98) 100%)',
        backdropFilter: 'blur(10px)',
        borderTop: '3px solid #38bdf8',
        boxShadow: '0 -10px 30px rgba(0,0,0,0.7)',
        padding: '10px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 500,
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{
            background: gameType === 'BELL' ? '#f59e0b' : gameType === 'FAST' ? '#9333ea' : gameType === 'BOSS' ? '#ef4444' : '#0284c7',
            color: '#fff',
            padding: '5px 12px',
            borderRadius: '12px',
            fontSize: '12.5px',
            fontWeight: 900,
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {gameType === 'BELL' ? '🔔 Rung Chuông Vàng 3D' : gameType === 'FAST' ? '⚡ Ai Nhanh Nhất 3D' : gameType === 'BOSS' ? '🐉 Đánh Boss 3D' : '⚔️ Kéo Co 3D'}
          </div>

          <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 800 }}>
            🟢 Phòng <b style={{ color: '#fef08a' }}>{activeRoomId}</b> • Đã vào: <b style={{ color: '#4ade80' }}>{connectedStudentCount}/{matchSettings.roomCapacity} HS</b> • Đếm ngược: <b style={{ color: '#fde047' }}>{matchSettings.questionDurationSec}s</b>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {onSwitchToStudentMode && (
            <button
              type="button"
              className="btn-action-sm"
              style={{ background: '#334155', color: '#f8fafc', borderColor: '#475569', padding: '9px 14px', fontSize: '13px' }}
              onClick={handleSwitchToStudentWithSync}
              title="Mở giao diện điện thoại học sinh để thi đấu thử"
            >
              📱 Thử Vai Học Sinh
            </button>
          )}

          {/* NÚT ẨN / HIỆN MÃ QR PHÒNG */}
          <button
            type="button"
            className="btn-action-sm"
            style={{
              background: showQRModal ? 'linear-gradient(135deg, #0284c7, #0369a1)' : '#1e293b',
              color: '#ffffff',
              borderColor: '#38bdf8',
              padding: '9px 15px',
              fontSize: '13px',
              fontWeight: 900,
              boxShadow: showQRModal ? '0 0 15px rgba(56, 189, 248, 0.5)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setShowQRModal(!showQRModal)}
            title="Bấm để ẩn hoặc hiện mã QR phòng cho học sinh quét trước"
          >
            {showQRModal ? '🙈 ẨN MÃ QR' : '📱 ẨN / HIỆN MÃ QR'}
          </button>

          <button
            type="button"
            className="btn-launch"
            style={{
              padding: '11px 22px',
              fontSize: '15px',
              boxShadow: '0 0 25px rgba(56, 189, 248, 0.6), inset 0 2px 3px rgba(255,255,255,0.7)'
            }}
            onClick={handleStartArena}
            title="Chuẩn bị vào sàn đấu 3D để tập hợp đủ học sinh trước khi bấm Bắt đầu"
          >
            📣 CHUẨN BỊ VÀO SÀN ĐẤU (TẬP HỢP HS)
          </button>
        </div>
      </aside>

      {/* Teacher Setup QR Modal (Ẩn / Hiện Mã QR) */}
      {showQRModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#0f172a', border: '2.5px solid #38bdf8', borderRadius: '24px', padding: '24px', maxWidth: '440px', width: '100%', textAlign: 'center', color: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#38bdf8', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                📱 MÃ QR THAM GIA PHÒNG
              </h3>
              <button
                type="button"
                onClick={() => setShowQRModal(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', color: '#94a3b8', width: '28px', height: '28px', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Đóng / Ẩn mã QR"
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#ffffff', padding: '12px', borderRadius: '16px', display: 'inline-block', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', marginBottom: '14px' }}>
              {roomQRImg ? (
                <img src={roomQRImg} alt="Mã QR Phòng" style={{ width: '220px', height: '220px', display: 'block', margin: '0 auto' }} />
              ) : (
                <div style={{ width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                  Đang tạo mã QR...
                </div>
              )}
            </div>

            <div style={{ fontSize: '15px', fontWeight: 900, color: '#fef08a', marginBottom: '8px' }}>
              MÃ PHÒNG: <span style={{ color: '#38bdf8', letterSpacing: '1px' }}>{activeRoomId}</span>
            </div>

            <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '0 0 16px 0' }}>
              Học sinh dùng điện thoại mở Zalo / Camera quét mã để tham gia ngay!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-action-sm"
                  style={{ flex: 1, padding: '10px', fontSize: '13px', background: copiedLink ? '#059669' : '#334155', color: '#ffffff', borderColor: copiedLink ? '#34d399' : '#475569' }}
                  onClick={handleCopyRoomLink}
                >
                  {copiedLink ? '✅ Đã Copy Link!' : '🔗 Copy Link Tham Gia'}
                </button>
                <button
                  type="button"
                  className="btn-action-sm"
                  style={{ padding: '10px 14px', fontSize: '13px', background: '#e11d48', color: '#ffffff', borderColor: '#f43f5e' }}
                  onClick={() => setShowQRModal(false)}
                >
                  🙈 Ẩn QR
                </button>
              </div>

              <button
                type="button"
                className="btn-launch"
                style={{ padding: '12px 20px', fontSize: '15px', background: 'linear-gradient(135deg, #0284c7, #0369a1)', boxShadow: '0 4px 15px rgba(2, 132, 199, 0.4)' }}
                onClick={() => {
                  setShowQRModal(false);
                  handleStartArena();
                }}
              >
                🚀 Mở Sân Đấu 3D Trực Tiếp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Generate Questions Modal */}
      {showAIGenModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '18px', padding: '24px', maxWidth: '520px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', color: '#0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#3730a3' }}>
                🤖 AI Soạn Đề Chuẩn GDPT 2018 (Gemini Flash)
              </h3>
              <button
                type="button"
                onClick={() => onOpenKeyModal && onOpenKeyModal()}
                style={{
                  background: getStoredGeminiKey() ? '#ecfdf5' : '#fef3c7',
                  border: `1px solid ${getStoredGeminiKey() ? '#10b981' : '#f59e0b'}`,
                  color: getStoredGeminiKey() ? '#047857' : '#b45309',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
                title="Cài đặt Google Gemini API Key"
              >
                {getStoredGeminiKey() ? '🟢 Đã có API Key' : '⚙️ Cài đặt Key (hoặc dùng Offline)'}
              </button>
            </div>
            <p style={{ fontSize: '12.5px', color: '#475569', margin: '0 0 14px 0' }}>
              Nhập chủ đề bài dạy, môn học và mức độ nhận thức. AI sẽ tạo bộ câu hỏi đa dạng (Trắc nghiệm, Đúng/Sai 4 ý, Trả lời ngắn). Nếu chưa có Key, hệ thống tự động nạp ngân hàng câu hỏi chuẩn SGK Kết nối tri thức.
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
