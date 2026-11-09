import React, { useRef, useEffect, useState, useMemo } from 'react';
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
  shuffleQuestionOrder,
  SAMPLE_PHAN_1_MC,
  SAMPLE_PHAN_2_TF,
  SAMPLE_PHAN_3_SA
} from '../data/defaultSubjects';
import { auditQuizList, QuizAuditSummary } from '../services/quizAuditor';
import { QuizAuditorModal } from './QuizAuditorModal';
import { MathRenderer } from '../utils/katexHelper';
import { CloudNetwork, getStudentShareBaseUrl } from '../services/network';

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
  onSwitchToStudentMode?: () => void;
  onExportHTMLSlide: () => void;
  onPrintPDFEvidence?: () => void;
  onExportJSON?: () => void;
  onImportJSON?: (items: QuizItem[]) => void;
  onOpenKeyModal?: () => void;
  onOpenCloudSync?: (tab?: 'GOOGLE' | 'PASSWORD') => void;
  onOpenNationalDossier?: () => void;
  activeRoomId?: string;
  connectedStudentCount?: number;
  connectedPlayers?: Player[];
  onNewSession?: (customRoomId?: string) => void;
  onResetClass?: () => void;
  onOpenCoffeeModal?: () => void;
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
  onOpenCloudSync,
  onOpenNationalDossier,
  activeRoomId,
  connectedStudentCount = 0,
  connectedPlayers = [],
  onNewSession,
  onResetClass,
  onOpenCoffeeModal
}) => {
  // 3 Khung Dạng Thức Chia Sẵn Riêng Biệt (Chuẩn THPT 2018)
  const mcEditorRef = useRef<HTMLDivElement>(null);
  const tfEditorRef = useRef<HTMLDivElement>(null);
  const saEditorRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inlineMediaInputRef = useRef<HTMLInputElement>(null);
  const activeEditorBoxRef = useRef<'MC' | 'TF' | 'SA'>('MC');

  // Quick Part Selection Tab: Phần I (MC), Phần II (TF), Phần III (SA)
  const [activePartTab, setActivePartTab] = useState<'MC' | 'TF' | 'SA'>('MC');

  // QR Modal States (Ẩn / Hiện Mã QR)
  const [showQRModal, setShowQRModal] = useState(false);
  const [roomQRImg, setRoomQRImg] = useState<string | null>(null);
  const [roomQRUrl, setRoomQRUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Live parsed questions preview state
  const [livePreviewItems, setLivePreviewItems] = useState<QuizItem[]>([]);
  const [showPreviewList, setShowPreviewList] = useState<boolean>(true);

  // AI Doctor & STEM Auditor States
  const [showAuditorModal, setShowAuditorModal] = useState<boolean>(false);
  const [highlightedQId, setHighlightedQId] = useState<number | null>(null);
  const auditSummary = useMemo(() => auditQuizList(livePreviewItems), [livePreviewItems]);

  // Generate Room QR Code
  useEffect(() => {
    if (!activeRoomId) return;
    const base = getStudentShareBaseUrl();
    const gmFlag = gameType === 'FAST' ? '&gm=F' : (gameType === 'BELL' ? '&gm=B' : (gameType === 'BOSS' ? '&gm=BOSS' : '&gm=TUG'));
    const bkIdx = CloudNetwork.getActiveBrokerIndex(activeRoomId);
    const url = `${base}?r=${activeRoomId}&role=player&t=R${gmFlag}&bk=${bkIdx}`;
    setRoomQRUrl(url);
    QRCode.toDataURL(url, { width: 220, margin: 1, errorCorrectionLevel: 'H' }).then(setRoomQRImg).catch(() => {});
  }, [activeRoomId, gameType]);

  const handleCopyRoomLink = () => {
    if (!roomQRUrl) return;
    navigator.clipboard.writeText(roomQRUrl).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const [formatCounts, setFormatCounts] = useState<{ mc: number; tf: number; sa: number }>({ mc: 0, tf: 0, sa: 0 });

  // Nén ảnh sơ đồ / bản đồ / hình vẽ về kích thước tối ưu để lưu & đồng bộ mượt 100%
  const compressImageFileToHTML = (file: File): Promise<string> => {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = ev => {
        const rawB64 = String(ev.target?.result || '');
        if (!rawB64) return resolve('');
        const img = new Image();
        img.onload = () => {
          const maxW = 720;
          const maxH = 480;
          let w = img.width || 400;
          let h = img.height || 260;
          if (w > maxW) {
            h = Math.round((h * maxW) / w);
            w = maxW;
          }
          if (h > maxH) {
            w = Math.round((w * maxH) / h);
            h = maxH;
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL('image/jpeg', 0.84);
            resolve(
              `<img src="${compressed}" alt="Hình minh họa" class="stem-inline-img" style="max-height:170px;max-width:100%;display:inline-block;vertical-align:middle;margin:6px 4px;border-radius:8px;border:1.5px solid #cbd5e1;background:#fff;padding:2px;" />`
            );
          } else {
            resolve(
              `<img src="${rawB64}" alt="Hình minh họa" class="stem-inline-img" style="max-height:170px;max-width:100%;display:inline-block;vertical-align:middle;margin:6px 4px;border-radius:8px;border:1.5px solid #cbd5e1;background:#fff;padding:2px;" />`
            );
          }
        };
        img.onerror = () => resolve('');
        img.src = rawB64;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  // Bảo vệ các thẻ hợp lệ (<table>, <img>, <sub>, <sup>, <u>, <b>) khi chèn dòng đã chuẩn hóa vào khung soạn thảo
  const formatSafeEditorLineHTML = (rawLine: string, isU: boolean, isBold?: boolean): string => {
    const cleaned = stripWordStyleGarbage(rawLine)
      .replace(/⟦U⟧([^A-Za-z0-9À-ỹ]*)⟦\/U⟧/g, '$1');
    const savedTags: string[] = [];
    const tokenized = cleaned.replace(
      /(<table\b[\s\S]*?<\/table>|<img\b[^>]*>|<\/?(?:sub|sup|u|b)\b[^>]*>)/gi,
      match => {
        const idx = savedTags.length;
        savedTags.push(match);
        return `@@SAFE_TAG_${idx}@@`;
      }
    );

    let escaped = tokenized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/⟦U⟧/g, '<u>')
      .replace(/⟦\/U⟧/g, '</u>')
      .replace(/⟦B⟧/g, '<b>')
      .replace(/⟦\/B⟧/g, '</b>');

    savedTags.forEach((tag, idx) => {
      escaped = escaped.replace(`@@SAFE_TAG_${idx}@@`, tag);
    });

    if (isU) {
      // Chuẩn hóa: Nếu dòng là đáp án gạch chân, bọc gọn 1 thẻ <u> duy nhất toàn dòng để dễ bật/tắt 100%
      const strippedU = escaped.replace(/<\/?(?:u|ins)\b[^>]*>/gi, '');
      escaped = `<u>${strippedU}</u>`;
    } else {
      // Nếu không gạch chân (isU = false) ở dòng phương án A,B,C,D hoặc a,b,c,d -> dọn sạch thẻ <u> thừa
      const plainCheck = escaped.replace(/<[^>]+>/g, '').trim();
      if (/^(?:[A-Da-d]\s*[.:\)\/])/.test(plainCheck)) {
        escaped = escaped.replace(/<\/?(?:u|ins)\b[^>]*>/gi, '');
      }
      if (isBold && !/<b>/i.test(escaped)) {
        escaped = `<b>${escaped}</b>`;
      }
    }
    return `<div>${escaped}</div>`;
  };

  // Đọc & ghép câu hỏi từ 3 khung riêng biệt (Dạng I, Dạng II, Dạng III) mà không bao giờ bị lẫn hay mất gạch chân
  const getCombinedQuizFrom3Boxes = (): QuizItem[] => {
    const mcRaw = mcEditorRef.current?.innerHTML?.trim() || '';
    const mcText = mcEditorRef.current?.innerText?.trim() || '';
    const tfRaw = tfEditorRef.current?.innerHTML?.trim() || '';
    const tfText = tfEditorRef.current?.innerText?.trim() || '';
    const saRaw = saEditorRef.current?.innerHTML?.trim() || '';
    const saText = saEditorRef.current?.innerText?.trim() || '';

    // QUAN TRỌNG: Khi đã có innerHTML (mcRaw/tfRaw/saRaw), truyền undefined cho plainTextFallback
    // để hệ thống BẮT BUỘC dùng bản HTML chứa thẻ <u> gạch chân, <table> bảng số liệu và <img> hình ảnh!
    const mcItems = (mcRaw || mcText) ? parseHTMLToQuiz(mcRaw || mcText, 'MULTIPLE_CHOICE', mcRaw ? undefined : mcText) : [];
    const tfItems = (tfRaw || tfText) ? parseHTMLToQuiz(tfRaw || tfText, 'TRUE_FALSE', tfRaw ? undefined : tfText) : [];
    const saItems = (saRaw || saText) ? parseHTMLToQuiz(saRaw || saText, 'SHORT_ANSWER', saRaw ? undefined : saText) : [];

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

  // =========================================================================
  // ENGINE TỰ ĐỘNG CHỮA LỖI DÍNH DÒNG VÀ GIỮ NGUYÊN GẠCH CHÂN CHO 3 KHUNG
  // (Kết hợp bảo toàn Hình ảnh <img>, Bảng số liệu <table>, Công thức <sub>/<sup>,
  //  Dọn sạch 100% rác Word XML/MSO Style Definitions và phục hồi mũi tên Wingdings)
  // =========================================================================
  const preparePasteCleanContent = (
    htmlInput: string,
    textInput: string,
    keepUnderlineTag: boolean = true
  ): { cleanedText: string; restoreProtectedTags: (str: string) => string } => {
    let content = htmlInput && htmlInput.trim() ? htmlInput : textInput;

    // 1. Dọn sạch toàn bộ khối <style>, <xml>, <script>, <head>, <meta> và comment điều kiện rác của Microsoft Word
    // (Giữ lại nội dung bên trong <!--[if !supportLists]--> để không bị mất chữ A., B., C., D.)
    content = content
      .replace(/<!--\[if\s+!supportLists\]-->/gi, '')
      .replace(/<!--\[endif\]-->/gi, '')
      .replace(/<!\[if\s+!supportLists\]>/gi, '')
      .replace(/<!\[endif\]>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(style|script|xml|head|title|meta|link)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/?(?:meta|link|o:p|w:[a-z0-9]+|v:[a-z0-9]+|m:[a-z0-9]+)[^>]*\/?>/gi, ' ');

    // 2. Bảo vệ các thẻ Bảng số liệu <table> và Hình ảnh <img> hợp lệ trước khi lọc thẻ rác của Word
    const savedMediaTags: string[] = [];
    content = content.replace(/(<table\b[\s\S]*?<\/table>|<img\b[^>]*>)/gi, match => {
      // Không bảo vệ bảng nếu đó là bảng bọc câu hỏi trắc nghiệm A. B. C. D. của Word
      if (/^<table/i.test(match) && /(?:^|>|\s)[A-Da-d][\.\)\:]\s+\S/.test(match.replace(/<[^>]+>/g, ' '))) {
        return match;
      }
      const idx = savedMediaTags.length;
      savedMediaTags.push(match);
      return `@@MEDIA_TAG_${idx}@@`;
    });

    // 3. Phục hồi mũi tên Wingdings / Symbol của Word (font-family: Wingdings/Symbol với ký tự " hoặc à/è/®) thành mũi tên chuẩn ➔
    content = content.replace(
      /<span\b[^>]*font-family\s*:\s*["']?(?:Wingdings|Symbol)[^"'>]*["']?[^>]*>([\s\S]*?)<\/span>/gi,
      ' ➔ '
    );

    // 4. Chuẩn hóa mọi kiểu gạch chân của Word / Google Docs / Web về dạng chuẩn <u>...</u>
    content = content
      .replace(
        /<span\b[^>]*style="[^"]*(?:text-decoration(?:-line)?\s*:\s*[^"]*underline|(?:mso-)?text-underline\s*:\s*(?!none)[a-z0-9\-]+)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
        '<u>$1</u>'
      )
      .replace(
        /<span\b[^>]*style='[^']*(?:text-decoration(?:-line)?\s*:\s*[^']*underline|(?:mso-)?text-underline\s*:\s*(?!none)[a-z0-9\-]+)[^']*'[^>]*>([\s\S]*?)<\/span>/gi,
        '<u>$1</u>'
      )
      .replace(/<ins\b[^>]*>([\s\S]*?)<\/ins>/gi, '<u>$1</u>')
      .replace(/<u\b[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>');

    // 5. Chuẩn hóa ngắt dòng: đổi các thẻ <p>, <br>, <div>, <li>, <tr>, <td> thành ký tự xuống dòng
    content = content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|td|th|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, tag => {
        if (/^<\/?(?:sub|sup)>/i.test(tag)) return tag.toLowerCase();
        if (keepUnderlineTag && /^<\/?u>/i.test(tag)) return tag.toLowerCase();
        return '';
      })
      .replace(/&nbsp;/gi, ' ')
      .replace(/&quot;/gi, '"')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');

    // 6. Quét sạch hoàn toàn rác văn bản Word MSO ("Normal 0 false false false...", "/* Style Definitions */ table.MsoNormalTable {...}")
    // và đổi dấu ngoặc kép lẻ ( " ) ngăn cách giữa các giai đoạn (do lỗi font Wingdings khi copy) thành mũi tên ➔
    content = stripWordStyleGarbage(content)
      .replace(/([a-zA-ZÀ-ỹ0-9\)\]])\s+"(?=\s+[a-zA-ZÀ-ỹ0-9\(\[])/g, '$1 ➔')
      .replace(/[\uF0E0\uF0E8\uF0AE\u2192\u2794\u279C\u27A1]/g, '➔');

    const restoreProtectedTags = (str: string): string => {
      let out = str;
      savedMediaTags.forEach((tag, idx) => {
        out = out.replace(`@@MEDIA_TAG_${idx}@@`, tag);
      });
      return out;
    };

    return { cleanedText: content, restoreProtectedTags };
  };

  // Tách danh sách khối câu hỏi thông minh:
  // Nếu văn bản có từ khóa "Câu 1", "Câu 2", "Bài 1", "Question 1" thì CHỈ tách theo từ khóa đó (để giữ nguyên các ý 1., 2., 3., 4. trong thân câu hỏi dài)
  const splitIntoQuestionBlocks = (content: string): string[] => {
    const hasExplicitCauKeyword = /(?:^|\n)\s*(?:<(?:u|b)>\s*)*(?:Câu|Bài|Question)\s*\d+[\.\:\)\s]/i.test(content);
    const rawBlocks = hasExplicitCauKeyword
      ? content.split(/(?:^|\n)\s*(?=(?:<(?:u|b)>\s*)*(?:Câu|Bài|Question)\s*\d+[\.\:\)\s])/i)
      : content.split(/(?:^|\n)\s*(?=(?:<(?:u|b)>\s*)*(?:Câu|Bài|Question)\s*\d+[\.\:\)\s]|(?:<(?:u|b)>\s*)*\d{1,3}[\.\:\)]\s+)/i);

    return rawBlocks
      .map(b => b.trim())
      .filter(b => {
        if (!b) return false;
        const plain = stripWordStyleGarbage(b.replace(/<[^>]+>/g, '')).trim();
        if (!plain) return false;
        // Bỏ qua khối rác chỉ chứa tiêu đề PHẦN I/II/III hoặc rác MSO
        if (/^(?:PHẦN|DẠNG\s*THỨC)\s*(?:I|II|III|1|2|3)\b[^\n]*$/i.test(plain)) return false;
        if (/^(?:Normal\s+0|false\s+false|table\.MsoNormalTable|Style\s+Definitions)/i.test(plain)) return false;
        return true;
      });
  };

  // 1. BỘ LỌC CHO KHUNG 1: TRẮC NGHIỆM 4 PHƯƠNG ÁN (A, B, C, D)
  const cleanKhung1HTML = (htmlInput: string, textInput: string, startNumber: number = 1): string => {
    const { cleanedText: content, restoreProtectedTags } = preparePasteCleanContent(htmlInput, textInput, true);
    const questionBlocks = splitIntoQuestionBlocks(content);
    const finalQuestions: string[] = [];

    questionBlocks.forEach(block => {
      // Regex quét thông minh: Bóc tách A., B., C., D. dù bị dính liền trên 1 hàng ngang hoặc bọc trong thẻ <u>A.</u>
      const optRegex = /(?:^|[\s\t\n])((?:<u>\s*)?[A-D](?:\s*<\/u>)?[\.\:\)]+(?:\s*<\/u>)?)\s*([\s\S]*?)(?=(?:[\s\t\n]+(?:<u>\s*)?[A-D](?:\s*<\/u>)?[\.\:\)]|$))/g;
      const firstOptIndex = block.search(/(?:^|[\s\t\n])(?:<u>\s*)?A(?:\s*<\/u>)?[\.\:\)]/);

      let title = '';
      const opts: Record<'A' | 'B' | 'C' | 'D', { text: string; isUnderlined: boolean }> = {
        A: { text: '', isUnderlined: false },
        B: { text: '', isUnderlined: false },
        C: { text: '', isUnderlined: false },
        D: { text: '', isUnderlined: false }
      };

      if (firstOptIndex !== -1) {
        title = block.substring(0, firstOptIndex).trim();
        const optBlock = block.substring(firstOptIndex);

        let match: RegExpExecArray | null;
        while ((match = optRegex.exec(optBlock)) !== null) {
          const rawPrefix = match[1] || '';
          const rawBody = (match[2] || '').trim().replace(/\n+/g, ' ');
          const keyMatch = rawPrefix.replace(/<\/?u>/gi, '').match(/[A-D]/i);
          if (keyMatch) {
            const key = keyMatch[0].toUpperCase() as 'A' | 'B' | 'C' | 'D';
            const hasUnderline = /<u>/i.test(rawPrefix) || /<u>/i.test(rawBody);
            const cleanOptText = stripWordStyleGarbage(rawBody.replace(/<\/?u>/gi, ''))
              .replace(/([a-zA-ZÀ-ỹ0-9\)\]])\s+"(?=\s+[a-zA-ZÀ-ỹ0-9\(\[])/g, '$1 ➔')
              .trim();
            opts[key] = {
              text: cleanOptText,
              isUnderlined: hasUnderline
            };
          }
        }
      } else {
        title = block.trim();
      }

      // Làm sạch tiêu đề câu
      title = stripWordStyleGarbage(
        title
          .replace(/^(?:<\/?u>\s*)*(?:PHẦN|DẠNG\s*THỨC)\s*(?:I|1)[^\n]*\n+/i, '')
          .replace(/^(?:<\/?u>\s*)*(?:Câu\s*(?:hỏi)?|Bài\s*(?:tập)?|Question)?\s*\d*[\.\:\)\s]*/i, '')
          .replace(/\n+/g, ' ')
      )
        .replace(/([a-zA-ZÀ-ỹ0-9\)\]])\s+"(?=\s+[a-zA-ZÀ-ỹ0-9\(\[])/g, '$1 ➔')
        .trim();

      // Bỏ qua khối rỗng hoặc khối rác MSO không có nội dung câu hỏi thật
      const validOptCount = (['A', 'B', 'C', 'D'] as const).filter(
        k => opts[k].text.length > 0 && !/^[A-D]\.?$/i.test(opts[k].text)
      ).length;
      if (!title && validOptCount === 0) return;
      if (/^(?:Normal\s+0|false\s+false|table\.MsoNormalTable|Style\s+Definitions)/i.test(title) && validOptCount === 0) {
        return;
      }

      const qNum = startNumber + finalQuestions.length;
      let qHTML = `<div><b>Câu ${qNum}:</b> ${restoreProtectedTags(title)}</div>`;
      (['A', 'B', 'C', 'D'] as const).forEach(letter => {
        const optData = opts[letter];
        const restoredOpt = restoreProtectedTags(optData.text);
        if (optData.isUnderlined) {
          qHTML += `<div><u>${letter}. ${restoredOpt}</u></div>`;
        } else {
          qHTML += `<div>${letter}. ${restoredOpt}</div>`;
        }
      });
      qHTML += `<br>`;

      finalQuestions.push(qHTML);
    });

    return finalQuestions.join('');
  };

  // 2. BỘ LỌC CHO KHUNG 2: ĐÚNG / SAI 4 Ý (a, b, c, d)
  const cleanKhung2HTML = (htmlInput: string, textInput: string, startNumber: number = 1): string => {
    const { cleanedText: content, restoreProtectedTags } = preparePasteCleanContent(htmlInput, textInput, true);
    const questionBlocks = splitIntoQuestionBlocks(content);
    const finalQuestions: string[] = [];

    questionBlocks.forEach(block => {
      const subRegex = /(?:^|[\s\t\n])((?:<u>\s*)?[a-d](?:\s*<\/u>)?[\)\.\:]+(?:\s*<\/u>)?)\s*([\s\S]*?)(?=(?:[\s\t\n]+(?:<u>\s*)?[a-d](?:\s*<\/u>)?[\)\.\:]|$))/g;
      const firstSubIndex = block.search(/(?:^|[\s\t\n])(?:<u>\s*)?a(?:\s*<\/u>)?[\)\.\:]/);

      let title = '';
      const items: Record<'a' | 'b' | 'c' | 'd', { text: string; isUnderlined: boolean }> = {
        a: { text: '', isUnderlined: false },
        b: { text: '', isUnderlined: false },
        c: { text: '', isUnderlined: false },
        d: { text: '', isUnderlined: false }
      };

      if (firstSubIndex !== -1) {
        title = block.substring(0, firstSubIndex).trim();
        const subBlock = block.substring(firstSubIndex);

        let match: RegExpExecArray | null;
        while ((match = subRegex.exec(subBlock)) !== null) {
          const rawPrefix = match[1] || '';
          const rawBody = (match[2] || '').trim().replace(/\n+/g, ' ');
          const keyMatch = rawPrefix.replace(/<\/?u>/gi, '').match(/[a-d]/i);
          if (keyMatch) {
            const key = keyMatch[0].toLowerCase() as 'a' | 'b' | 'c' | 'd';
            const hasExplicitFalse = /\(\s*(?:Sai|S|False)\s*\)\s*$/i.test(rawBody);
            const hasExplicitTrue = /\(\s*(?:Đúng|Đ|True)\s*\)\s*$/i.test(rawBody);
            const hasUnderline = !hasExplicitFalse && (/<u>/i.test(rawPrefix) || /<u>/i.test(rawBody) || hasExplicitTrue);
            const cleanItemText = stripWordStyleGarbage(rawBody.replace(/<\/?u>/gi, ''))
              .replace(/([a-zA-ZÀ-ỹ0-9\)\]])\s+"(?=\s+[a-zA-ZÀ-ỹ0-9\(\[])/g, '$1 ➔')
              .trim();
            items[key] = {
              text: cleanItemText,
              isUnderlined: hasUnderline
            };
          }
        }
      } else {
        title = block.trim();
      }

      title = stripWordStyleGarbage(
        title
          .replace(/^(?:<\/?u>\s*)*(?:PHẦN|DẠNG\s*THỨC)\s*(?:II|2)[^\n]*\n+/i, '')
          .replace(/^(?:<\/?u>\s*)*(?:Câu\s*(?:hỏi)?|Bài\s*(?:tập)?|Question)?\s*\d*[\.\:\)\s]*(?:\[[^\]]*\])?\s*[:.-]?\s*/i, '')
          .replace(/\n+/g, ' ')
      )
        .replace(/([a-zA-ZÀ-ỹ0-9\)\]])\s+"(?=\s+[a-zA-ZÀ-ỹ0-9\(\[])/g, '$1 ➔')
        .trim();

      const validItemCount = (['a', 'b', 'c', 'd'] as const).filter(k => items[k].text.length > 0).length;
      if (!title && validItemCount === 0) return;

      const qNum = startNumber + finalQuestions.length;
      let qHTML = `<div><b>Câu ${qNum}:</b> ${restoreProtectedTags(title)}</div>`;
      (['a', 'b', 'c', 'd'] as const).forEach(letter => {
        const itemData = items[letter];
        const restoredTxt = restoreProtectedTags(itemData.text);
        if (itemData.isUnderlined) {
          qHTML += `<div><u>${letter}) ${restoredTxt}</u></div>`;
        } else {
          qHTML += `<div>${letter}) ${restoredTxt}</div>`;
        }
      });
      qHTML += `<br>`;

      finalQuestions.push(qHTML);
    });

    return finalQuestions.join('');
  };

  // 3. BỘ LỌC CHO KHUNG 3: TRẢ LỜI NGẮN
  const cleanKhung3HTML = (htmlInput: string, textInput: string, startNumber: number = 1): string => {
    const { cleanedText: content, restoreProtectedTags } = preparePasteCleanContent(htmlInput, textInput, true);
    const questionBlocks = splitIntoQuestionBlocks(content);
    const finalQuestions: string[] = [];

    questionBlocks.forEach(block => {
      let cleanBlock = block.trim();
      let dapAn = '';

      const match = cleanBlock.match(/(?:Đáp\s*án|Đáp\s*số|KQ|Kết\s*quả|ĐA)\s*[\:\=]\s*([^\n]+)/i);
      if (match) {
        dapAn = stripWordStyleGarbage(match[1].replace(/<\/?u>/gi, '')).trim();
        cleanBlock = cleanBlock.replace(match[0], '').trim();
      } else {
        const underlinedMatch = cleanBlock.match(/<u>([\s\S]*?)<\/u>/i);
        if (underlinedMatch) {
          dapAn = stripWordStyleGarbage(underlinedMatch[1]).trim();
        }
      }

      cleanBlock = stripWordStyleGarbage(
        cleanBlock
          .replace(/<\/?u>/gi, '')
          .replace(/^(?:PHẦN|DẠNG\s*THỨC)\s*(?:III|3)[^\n]*\n+/i, '')
          .replace(/^(?:Câu\s*(?:hỏi)?|Bài\s*(?:tập)?|Question)?\s*\d*[\.\:\)\s]*(?:\[[^\]]*\])?\s*[:.-]?\s*/i, '')
          .replace(/\n+/g, ' ')
      )
        .replace(/([a-zA-ZÀ-ỹ0-9\)\]])\s+"(?=\s+[a-zA-ZÀ-ỹ0-9\(\[])/g, '$1 ➔')
        .trim();

      if (!cleanBlock && !dapAn) return;

      const qNum = startNumber + finalQuestions.length;
      let qHTML = `<div><b>Câu ${qNum}:</b> ${restoreProtectedTags(cleanBlock)}</div>`;
      qHTML += `<div><b>Đáp án:</b> <u>${restoreProtectedTags(dapAn)}</u></div><br>`;

      finalQuestions.push(qHTML);
    });

    return finalQuestions.join('');
  };

  // Xử lý dán (Paste) từ Word / Excel / PDF / Zalo / Snipping Tool vào 3 khung:
  // 1. Hỗ trợ dán trực tiếp hình ảnh chụp màn hình / sơ đồ / bản đồ từ Clipboard (Ctrl+V)
  // 2. Tự động nhận diện Khung 1 (A, B, C, D), Khung 2 (a, b, c, d), Khung 3 (Trả lời ngắn)
  // 3. Chữa triệt để lỗi dính dòng, giữ nguyên gạch chân <u>, đánh lại số Câu 1, Câu 2... liên tục và cập nhật bảng xem trước
  const handleCleanPasteInBox = async (
    e: React.ClipboardEvent<HTMLDivElement>,
    explicitBoxType?: 'MC' | 'TF' | 'SA'
  ) => {
    const targetEl = e.currentTarget;
    const clipboardItems = Array.from(e.clipboardData?.items || []);
    const imageItem = clipboardItems.find(it => it.type.startsWith('image/'));
    const htmlData = e.clipboardData.getData('text/html');
    const textData = e.clipboardData.getData('text/plain');

    // Trường hợp 1: Giáo viên chụp ảnh sơ đồ / bản đồ / công thức (Snipping Tool / Zalo) và nhấn Ctrl+V trực tiếp
    if (imageItem && (!htmlData || !htmlData.trim()) && (!textData || !textData.trim())) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        const imgTag = await compressImageFileToHTML(file);
        if (imgTag && targetEl) {
          targetEl.focus();
          let inserted = false;
          try {
            inserted = document.execCommand('insertHTML', false, imgTag);
          } catch {
            inserted = false;
          }
          if (!inserted) {
            targetEl.innerHTML += `<div>${imgTag}</div>`;
          }
          setTimeout(() => syncEditorQuestionsLive(), 30);
        }
      }
      return;
    }

    e.preventDefault(); // Chặn dán thô mặc định bị dính dòng của trình duyệt

    if ((!htmlData || !htmlData.trim()) && (!textData || !textData.trim())) {
      return;
    }

    // Xác định khung đang dán (Khung 1: MC, Khung 2: TF, Khung 3: SA)
    const boxType: 'MC' | 'TF' | 'SA' =
      explicitBoxType ||
      (targetEl === mcEditorRef.current
        ? 'MC'
        : targetEl === tfEditorRef.current
        ? 'TF'
        : targetEl === saEditorRef.current
        ? 'SA'
        : /[a-d]\)/i.test(textData)
        ? 'TF'
        : /[A-D][\.\:\)]/.test(textData)
        ? 'MC'
        : 'SA');

    // Kiểm tra xem nội dung dán có chứa cấu trúc câu hỏi / phương án hay chỉ là một cụm từ ngắn dán bổ sung vào dòng
    const hasQuestionOrOptionStructure =
      /(?:Câu|Bài|Question)\s*\d+/i.test(textData) ||
      /(?:^|[\s\t\n])[A-D][\.\:\)]\s+/m.test(textData) ||
      /(?:^|[\s\t\n])[a-d]\)\s+/m.test(textData) ||
      /(?:Đáp\s*án|Đáp\s*số)\s*[\:\=]/i.test(textData) ||
      textData.trim().includes('\n');

    let processedHTML = '';

    if (hasQuestionOrOptionStructure) {
      if (boxType === 'MC') {
        processedHTML = cleanKhung1HTML(htmlData, textData, 1);
      } else if (boxType === 'TF') {
        processedHTML = cleanKhung2HTML(htmlData, textData, 1);
      } else {
        processedHTML = cleanKhung3HTML(htmlData, textData, 1);
      }
    } else {
      const rawSource = htmlData && htmlData.trim() ? htmlData : textData;
      const normalizedLines = extractNormalizedLines(rawSource || textData, htmlData ? undefined : textData);
      if (normalizedLines.length > 0) {
        processedHTML = normalizedLines
          .map(p => formatSafeEditorLineHTML(p.raw, p.isU, p.isBold))
          .join('');
      }
    }

    if (processedHTML && targetEl) {
      targetEl.focus();
      const beforeHTML = targetEl.innerHTML;
      let inserted = false;
      try {
        inserted = document.execCommand('insertHTML', false, processedHTML);
      } catch {
        inserted = false;
      }
      if (!inserted || targetEl.innerHTML === beforeHTML) {
        targetEl.innerHTML =
          (beforeHTML && beforeHTML.trim() && beforeHTML !== '<br>' ? beforeHTML + '<br>' : '') + processedHTML;
      }

      // Tự động đánh lại số thứ tự Câu 1, Câu 2... liên tục trong khung vừa dán và cập nhật ngay Bảng xem trước
      setTimeout(() => {
        const allCombined = getCombinedQuizFrom3Boxes();
        if (allCombined.length > 0) {
          const { mcHTML, tfHTML, saHTML } = splitQuizTo3FormatHTML(allCombined);
          if (boxType === 'MC' && mcEditorRef.current && mcHTML) {
            mcEditorRef.current.innerHTML = mcHTML;
          } else if (boxType === 'TF' && tfEditorRef.current && tfHTML) {
            tfEditorRef.current.innerHTML = tfHTML;
          } else if (boxType === 'SA' && saEditorRef.current && saHTML) {
            saEditorRef.current.innerHTML = saHTML;
          }
        }
        syncLiveToStorageAndHost(allCombined);
      }, 25);
    }
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

  // Nút Gạch Chân Thông Minh (Hỗ trợ cả khi bôi đen chữ, nhấn Ctrl+U, HOẶC chỉ đặt con trỏ chuột vào dòng đáp án rồi bấm nút)
  // Đảm bảo bật/tắt gạch chân SẠCH SẼ TOÀN DÒNG cho phương án A, B, C, D và a), b), c), d) (không bao giờ sót mảnh <u> lẻ làm nhận nhầm đáp án)
  const handleUnderline = (targetBox?: 'MC' | 'TF' | 'SA') => {
    const boxType = targetBox || activeEditorBoxRef.current || 'MC';
    const editorEl =
      boxType === 'MC' ? mcEditorRef.current : boxType === 'TF' ? tfEditorRef.current : saEditorRef.current;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const anchorNode = sel.anchorNode;

      // Tìm dòng <div> / <p> chứa con trỏ hiện tại trong khung soạn thảo
      let blockEl: HTMLElement | null =
        anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement || null;
      while (
        blockEl &&
        blockEl.parentElement &&
        blockEl.parentElement !== mcEditorRef.current &&
        blockEl.parentElement !== tfEditorRef.current &&
        blockEl.parentElement !== saEditorRef.current &&
        blockEl !== mcEditorRef.current &&
        blockEl !== tfEditorRef.current &&
        blockEl !== saEditorRef.current
      ) {
        blockEl = blockEl.parentElement;
      }

      const parentEditor =
        blockEl?.parentElement === mcEditorRef.current
          ? mcEditorRef.current
          : blockEl?.parentElement === tfEditorRef.current
          ? tfEditorRef.current
          : blockEl?.parentElement === saEditorRef.current
          ? saEditorRef.current
          : null;

      // Nếu đang ở Khung 1 (4 lựa chọn A, B, C, D) và gạch chân 1 phương án mới -> tự động bỏ gạch chân ở các phương án A/B/C/D anh em của cùng câu đó!
      const clearSiblingMCOptionUnderlines = (currentLineEl: HTMLElement) => {
        if (parentEditor !== mcEditorRef.current) return;
        const lineText = (currentLineEl.textContent || '').trim();
        if (!/^[A-Da-d]\s*[.:\)\/]/.test(lineText)) return;

        // Quét ngược lên và xuôi xuống trong cùng câu hỏi (dừng khi gặp "Câu X:")
        let prev = currentLineEl.previousElementSibling as HTMLElement | null;
        while (prev) {
          const txt = (prev.textContent || '').trim();
          if (/^(?:Câu|Bài|Question|\d+\s*[.):\/])/i.test(txt)) break;
          if (/^[A-Da-d]\s*[.:\)\/]/.test(txt)) {
            prev.innerHTML = prev.innerHTML.replace(/<\/?(?:u|ins)\b[^>]*>/gi, '');
            prev.style.textDecoration = 'none';
          }
          prev = prev.previousElementSibling as HTMLElement | null;
        }
        let next = currentLineEl.nextElementSibling as HTMLElement | null;
        while (next) {
          const txt = (next.textContent || '').trim();
          if (/^(?:Câu|Bài|Question|\d+\s*[.):\/])/i.test(txt)) break;
          if (/^[A-Da-d]\s*[.:\)\/]/.test(txt)) {
            next.innerHTML = next.innerHTML.replace(/<\/?(?:u|ins)\b[^>]*>/gi, '');
            next.style.textDecoration = 'none';
          }
          next = next.nextElementSibling as HTMLElement | null;
        }
      };

      // Nếu con trỏ hoặc vùng bôi đen nằm trên dòng phương án A/B/C/D (Khung 1) hoặc a/b/c/d (Khung 2):
      // LUÔN bật/tắt gạch chân trọn vẹn toàn bộ dòng đó để không bao giờ bị sót mảnh <u>a) </u> hay <u>.</u>
      if (blockEl && parentEditor) {
        const lineText = (blockEl.textContent || '').trim();
        const isOptionOrStatementLine =
          parentEditor === mcEditorRef.current ||
          parentEditor === tfEditorRef.current ||
          /^[A-Da-d]\s*[.:\)\/]/.test(lineText);

        if (isOptionOrStatementLine || range.collapsed) {
          const hasUnderlineNow =
            /<(?:u|ins)\b/i.test(blockEl.innerHTML) ||
            /text-decoration[^;"]*underline/i.test(blockEl.getAttribute('style') || '');
          const cleanInner = blockEl.innerHTML
            .replace(/<\/?(?:u|ins)\b[^>]*>/gi, '')
            .replace(/text-decoration\s*:\s*underline\s*;?/gi, '');
          if (hasUnderlineNow) {
            blockEl.innerHTML = cleanInner;
            blockEl.style.textDecoration = 'none';
          } else {
            clearSiblingMCOptionUnderlines(blockEl);
            blockEl.innerHTML = `<u>${cleanInner}</u>`;
            blockEl.style.textDecoration = '';
          }
          syncEditorQuestionsLive();
          return;
        }
      }

      if (!range.collapsed) {
        document.execCommand('underline', false);
        syncEditorQuestionsLive();
        return;
      }
    }

    if (editorEl) editorEl.focus();
    document.execCommand('underline', false);
    syncEditorQuestionsLive();
  };

  // Bắt phím tắt Ctrl+U / Cmd+U trong 3 khung để dùng cơ chế Gạch chân toàn dòng sạch sẽ
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, boxType: 'MC' | 'TF' | 'SA') => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
      e.preventDefault();
      handleUnderline(boxType);
    }
  };

  // Chèn Hình ảnh / Sơ đồ / Bản đồ Địa lý trực tiếp vào câu hỏi đang soạn
  const handleTriggerInsertImage = (boxType: 'MC' | 'TF' | 'SA') => {
    activeEditorBoxRef.current = boxType;
    inlineMediaInputRef.current?.click();
  };

  const handleInlineMediaFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const imgHTML = await compressImageFileToHTML(file);
    e.target.value = '';
    if (!imgHTML) return;

    const boxType = activeEditorBoxRef.current || 'MC';
    const targetRef = boxType === 'MC' ? mcEditorRef : boxType === 'TF' ? tfEditorRef : saEditorRef;
    if (targetRef.current) {
      targetRef.current.focus();
      let inserted = false;
      try {
        inserted = document.execCommand('insertHTML', false, imgHTML);
      } catch {
        inserted = false;
      }
      if (!inserted) {
        targetRef.current.innerHTML += `<div>${imgHTML}</div>`;
      }
      syncEditorQuestionsLive();
    }
  };

  // Chèn Bảng Số Liệu mẫu (Địa lý, Sinh học, Vật lý, Hóa học, Toán thống kê) vào khung đang chọn
  const handleInsertDataTable = (boxType: 'MC' | 'TF' | 'SA') => {
    activeEditorBoxRef.current = boxType;
    const targetRef = boxType === 'MC' ? mcEditorRef : boxType === 'TF' ? tfEditorRef : saEditorRef;
    const sampleTableHTML = `<div><table class="stem-data-table"><tr><th>Năm / Chỉ tiêu</th><th>2020</th><th>2022</th><th>2024</th></tr><tr><td>Giá trị A (Đơn vị)</td><td>12,5</td><td>15,8</td><td>19,2</td></tr><tr><td>Giá trị B (Đơn vị)</td><td>45,0</td><td>52,4</td><td>61,7</td></tr></table></div>`;
    if (targetRef.current) {
      targetRef.current.focus();
      let inserted = false;
      try {
        inserted = document.execCommand('insertHTML', false, sampleTableHTML);
      } catch {
        inserted = false;
      }
      if (!inserted) {
        targetRef.current.innerHTML =
          (targetRef.current.innerHTML.trim() ? targetRef.current.innerHTML + '<br>' : '') + sampleTableHTML;
      }
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



  const handleSaveToSubject = () => {
    const parsed = getCombinedQuizFrom3Boxes();
    if (!parsed.length) {
      alert('Chưa phát hiện câu hỏi hợp lệ! Vui lòng dán câu hỏi vào ít nhất 1 trong 3 khung Dạng thức.');
      return;
    }
    const updatedHTML = formatQuizToHTML(parsed);
    populate3BoxesFromItems(parsed);
    onSaveCurrentQuizToSubject(parsed, updatedHTML, false);

    // AI Question Doctor Audit
    const report = auditQuizList(parsed);
    if (report.criticalCount > 0) {
      alert(`⚠️ Đã lưu đề, nhưng AI Bác Sĩ Bắt Lỗi phát hiện có ${report.criticalCount} câu cần sửa (ví dụ: chưa chọn đáp án đúng hoặc thiếu phương án). Đang mở bảng Báo Lỗi để bạn xem câu số mấy, bị lỗi gì và bấm "⚡ Tự Động Sửa Toàn Bộ" trong 1 click!`);
      setShowAuditorModal(true);
    } else if (report.warningCount > 0) {
      alert(`💾 Đã lưu thành công ${parsed.length} câu hỏi! Đề thi có ${report.warningCount} cảnh báo nhỏ. Bạn có thể bấm "🩺 Bác Sĩ Bắt Lỗi Đề" để xem chi tiết.`);
    } else {
      alert(`💾 Đã lưu thành công ${parsed.length} câu hỏi vào môn này! Đề thi 100% chuẩn xác, hoàn hảo không có lỗi nào.`);
    }
  };

  // Xáo trộn câu hỏi theo chuẩn GDPT 2018:
  // Xuất hiện lần lượt: Hết Phần I ➔ Hết Phần II ➔ Hết Phần III
  // Các câu hỏi trong mỗi phần được xáo ngẫu nhiên và đồng bộ 100% giữa GV và HS
  const handleShuffleByPartOrder = () => {
    const parsed = getCombinedQuizFrom3Boxes();
    if (!parsed.length) {
      alert('Chưa có câu hỏi nào để xáo trộn! Vui lòng nhập hoặc chọn đề thi trước.');
      return;
    }
    const shuffled = shuffleQuestionOrder(parsed);
    populate3BoxesFromItems(shuffled);
    const updatedHTML = formatQuizToHTML(shuffled);
    onSaveCurrentQuizToSubject(shuffled, updatedHTML, true);
    if (onSyncQuizLive) onSyncQuizLive(shuffled);
    alert(`🔀 ĐÃ XÁO TRỘN ĐỀ THI THÀNH CÔNG (${shuffled.length} CÂU)!\n\n• Thứ tự xuất hiện: Toàn bộ Phần I (Trắc nghiệm) ➔ Toàn bộ Phần II (Đúng/Sai) ➔ Toàn bộ Phần III (Trả lời ngắn)\n• Các câu hỏi bên trong từng phần được xáo trộn ngẫu nhiên\n• Màn hình Giáo viên và Học sinh 100% khớp nhau từng phương án.`);
  };

  const handleStartArena = () => {
    const parsed = getCombinedQuizFrom3Boxes();
    if (!parsed.length) {
      alert('Vui lòng chọn hoặc nhập ít nhất 1 câu hỏi hợp lệ vào 1 trong 3 khung Dạng thức!');
      return;
    }
    // Tự động sắp xếp chuẩn Phần I -> Phần II -> Phần III và xáo trộn ngẫu nhiên trong từng phần
    const orderedAndShuffled = shuffleQuestionOrder(parsed);
    const updatedHTML = formatQuizToHTML(orderedAndShuffled);
    populate3BoxesFromItems(orderedAndShuffled);
    onSaveCurrentQuizToSubject(orderedAndShuffled, updatedHTML, true);
    onLaunchArena(orderedAndShuffled);
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
      const rawContent = String(ev.target?.result || '').trim();
      if (!rawContent) return;
      try {
        // Thử đọc dạng JSON trước
        const parsedJSON = JSON.parse(rawContent);
        const rawArr = Array.isArray(parsedJSON)
          ? parsedJSON
          : Array.isArray(parsedJSON?.questions)
          ? parsedJSON.questions
          : Array.isArray(parsedJSON?.items)
          ? parsedJSON.items
          : Array.isArray(parsedJSON?.quiz)
          ? parsedJSON.quiz
          : null;

        if (!rawArr || rawArr.length === 0) throw new Error('Not a JSON question list');

        const parsedItems: QuizItem[] = rawArr.map((item: any, i: number) => {
          const qText = cleanQuestionTitleText(item.q || item.question || item.title || `Câu ${i + 1}`);
          const rawOpts = Array.isArray(item.opts)
            ? item.opts
            : Array.isArray(item.options)
            ? item.options
            : Array.isArray(item.answers)
            ? item.answers
            : [item.A || item.a, item.B || item.b, item.C || item.c, item.D || item.d].filter(Boolean);
          const cleanOpts = rawOpts.map((o: any) =>
            String(o || '')
              .replace(/^[A-D][\.\:\)\/]\s*/i, '')
              .trim()
          );

          let correctIdx = 0;
          if (typeof item.correct === 'number' && item.correct >= 0 && item.correct < 4) {
            correctIdx = item.correct;
          } else if (typeof item.correct === 'string' && /^[A-D]$/i.test(item.correct.trim())) {
            correctIdx = item.correct.trim().toUpperCase().charCodeAt(0) - 65;
          } else if (typeof item.answer === 'string' && /^[A-D]$/i.test(item.answer.trim())) {
            correctIdx = item.answer.trim().toUpperCase().charCodeAt(0) - 65;
          } else {
            correctIdx = aiAutoDetectCorrectIndex(qText, cleanOpts);
          }

          return {
            qid: i,
            q: qText,
            format: item.format || (Array.isArray(item.tfItems) && item.tfItems.length > 0 ? 'TRUE_FALSE' : item.shortAnswer ? 'SHORT_ANSWER' : 'MULTIPLE_CHOICE'),
            opts: cleanOpts.length > 0 ? cleanOpts : ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
            correct: correctIdx,
            tfItems: item.tfItems || [],
            shortAnswer: item.shortAnswer || '',
            rightCount: 0,
            wrongCount: 0
          };
        });

        populate3BoxesFromItems(parsedItems);
        onImportJSON(parsedItems);
        alert(`✅ Đã nạp thành công ${parsedItems.length} câu hỏi vào 3 khung Dạng thức!`);
      } catch {
        // Nếu file là văn bản (.txt / .html) hoặc đề copy trực tiếp -> tự động bóc tách bằng bộ nhận diện câu hỏi trắc nghiệm
        const parsedFromText = parseHTMLToQuiz(rawContent, undefined, rawContent);
        if (parsedFromText && parsedFromText.length > 0) {
          populate3BoxesFromItems(parsedFromText);
          onImportJSON(parsedFromText);
          alert(`✅ Đã tự động nhận diện và nạp thành công ${parsedFromText.length} câu hỏi từ file vào 3 khung Dạng thức!`);
        } else {
          alert('Không nhận diện được câu hỏi trong file. Vui lòng chọn file .json, .txt hoặc .html chứa câu hỏi trắc nghiệm!');
        }
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
      <div className="setup-box" style={{ marginBottom: '64px' }}>
        {/* Top Header */}
        <div className="flex-between" style={{ marginBottom: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#1e293b' }}>
            🌾 Hệ Thống 12 Môn THPT (GDPT 2018) – Đấu Trường 3D Pro
          </h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-action-sm"
              style={{ background: '#fef3c7', borderColor: '#f59e0b', color: '#92400e', fontWeight: 800 }}
              onClick={onExportHTMLSlide}
              title="Xuất bài giảng slide học liệu đa phương tiện"
            >
              🎨 Xuất Slide Học Liệu Màu (.html)
            </button>
          </div>
        </div>

        {/* 4 Game Modes Grid - Single Row with 4 distinct 3D Colors */}
        <section className="gamemode-selector" aria-label="Chọn chế độ thi đấu">
          {/* Khối 1: XANH CYAN SIÊU TỐC - AI NHANH NHẤT (ĐUA TỐC ĐỘ 3D) */}
          <div
            className={`gm-card fast-gm ${gameType === 'FAST' ? 'active-gm' : ''}`}
            id="gm-card-FAST"
            onClick={() => onSelectGameType('FAST')}
            title="Bấm để chọn: Ai Nhanh Nhất (Đua Tốc Độ 3D)"
          >
            <div className="gm-top-row">
              <span className="gm-badge" style={{ background: gameType === 'FAST' ? 'rgba(0,0,0,0.35)' : '#e0f2fe', color: gameType === 'FAST' ? '#ffffff' : '#075985' }}>
                ⚡ CHẾ ĐỘ 1 (MẶC ĐỊNH)
              </span>
              <span className="gm-check-indicator" style={{ background: gameType === 'FAST' ? '#ffffff' : '#e0f2fe', color: gameType === 'FAST' ? '#0369a1' : '#0c4a6e' }}>
                {gameType === 'FAST' ? '✓ Đang chọn' : 'Chọn'}
              </span>
            </div>
            <div className="gm-card-body">
              <div className="gm-icon">⚡</div>
              <div className="gm-info">
                <h3>⚡ AI NHANH NHẤT (ĐUA TỐC ĐỘ 3D)</h3>
                <p>
                  Chơi chung toàn lớp • Tính điểm cá nhân & tốc độ trả lời đúng • Bảng vàng xếp hạng Realtime!
                </p>
              </div>
            </div>
          </div>

          {/* Khối 2: ĐỎ CHIẾN BINH - KÉO CO 3D */}
          <div
            className={`gm-card tug-gm ${gameType === 'TUG' ? 'active-gm' : ''}`}
            id="gm-card-TUG"
            onClick={() => onSelectGameType('TUG')}
            title="Bấm để chọn: Đấu Trường Kéo Co 3D"
          >
            <div className="gm-top-row">
              <span className="gm-badge" style={{ background: gameType === 'TUG' ? 'rgba(0,0,0,0.35)' : '#fee2e2', color: gameType === 'TUG' ? '#ffffff' : '#991b1b' }}>
                ⚔️ CHẾ ĐỘ 2
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

          {/* Khối 3: VÀNG HOÀNG KIM - RUNG CHUÔNG VÀNG 3D */}
          <div
            className={`gm-card bell-gm ${gameType === 'BELL' ? 'active-gm' : ''}`}
            id="gm-card-BELL"
            onClick={() => onSelectGameType('BELL')}
            title="Bấm để chọn: Rung Chuông Vàng 3D"
          >
            <div className="gm-top-row">
              <span className="gm-badge" style={{ background: gameType === 'BELL' ? 'rgba(0,0,0,0.35)' : '#fef3c7', color: gameType === 'BELL' ? '#ffffff' : '#92400e' }}>
                🔔 CHẾ ĐỘ 3
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

          {/* Khối 4: TÍM HUYỀN BÍ - ĐÁNH BOSS KIẾN THỨC 3D */}
          <div
            className={`gm-card boss-gm ${gameType === 'BOSS' ? 'active-gm' : ''}`}
            id="gm-card-BOSS"
            onClick={() => onSelectGameType('BOSS')}
            title="Bấm để chọn: Đánh Boss Kiến Thức 3D"
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
                max={1000}
                value={matchSettings.roomCapacity}
                onChange={e => onUpdateSettings({ ...matchSettings, roomCapacity: Math.max(2, parseInt(e.target.value) || 200) })}
                style={{ width: '65px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #94a3b8', background: '#090d16', color: '#38bdf8', fontWeight: 900, textAlign: 'center' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 800 }}>
              🎮 Tối đa 3D trên sân:
              <input
                type="number"
                min={2}
                max={10}
                value={matchSettings.max3DRenderCount}
                onChange={e => onUpdateSettings({ ...matchSettings, max3DRenderCount: Math.min(10, Math.max(2, parseInt(e.target.value) || 10)) })}
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

          {/* Diagnostic & Action Toolbar (Thiết kế khoa học, hiện đại, không trùng lặp) */}
          <div
            style={{
              padding: '12px 14px',
              background: '#ffffff',
              borderRadius: '16px',
              border: '2px solid #cbd5e1',
              margin: '10px 0',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            {/* Hàng 1: Thống kê số câu và BÁC SĨ BẮT LỖI ĐỀ NỔI BẬT */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                paddingBottom: '10px',
                borderBottom: '1.5px solid #e2e8f0'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: '#f1f5f9',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '6px 12px',
                    fontSize: '13.5px',
                    fontWeight: 900,
                    color: '#0f172a',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>📚</span>
                  <span>Tổng số câu đã nhận diện:</span>
                  <b style={{ color: '#0284c7', fontSize: '15.5px' }}>{formatCounts.mc + formatCounts.tf + formatCounts.sa} câu</b>
                  <span style={{ color: '#94a3b8' }}>•</span>
                  <span style={{ color: '#2563eb' }}>{formatCounts.mc} Dạng I</span>
                  <span style={{ color: '#94a3b8' }}>•</span>
                  <span style={{ color: '#7c3aed' }}>{formatCounts.tf} Dạng II</span>
                  <span style={{ color: '#94a3b8' }}>•</span>
                  <span style={{ color: '#059669' }}>{formatCounts.sa} Dạng III</span>
                </span>
              </div>

              {/* BÁC SĨ BẮT LỖI ĐỀ - HIỆN NỔI BẬT NHẤT ĐỂ GIÁO VIÊN DỄ THẤY & THAO TÁC */}
              <button
                type="button"
                className="btn-action-sm"
                style={{
                  height: '38px',
                  padding: '0 18px',
                  borderRadius: '12px',
                  fontSize: '13.5px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: auditSummary.criticalCount > 0
                    ? '2px solid #fecaca'
                    : auditSummary.warningCount > 0
                    ? '2px solid #fef08a'
                    : '2px solid #a7f3d0',
                  background: auditSummary.criticalCount > 0
                    ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
                    : auditSummary.warningCount > 0
                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: auditSummary.warningCount > 0 && auditSummary.criticalCount === 0 ? '#0f172a' : '#ffffff',
                  boxShadow: auditSummary.criticalCount > 0
                    ? '0 0 16px rgba(239, 68, 68, 0.65)'
                    : auditSummary.warningCount > 0
                    ? '0 0 14px rgba(245, 158, 11, 0.55)'
                    : '0 0 12px rgba(16, 185, 129, 0.45)',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => setShowAuditorModal(true)}
                title="Bác Sĩ Bắt Lỗi Đề: Tự động kiểm tra phát hiện lỗi câu hỏi, đáp án, định dạng chuẩn GDPT 2018 và hỗ trợ Tự Sửa 1-Click"
              >
                <span style={{ fontSize: '18px' }}>🩺</span>
                <span>
                  {auditSummary.criticalCount > 0
                    ? `BÁC SĨ BẮT LỖI ĐỀ (⚠️ ${auditSummary.criticalCount} CÂU LỖI – BẤM SỬA NGAY)`
                    : auditSummary.warningCount > 0
                    ? `BÁC SĨ BẮT LỖI ĐỀ (🟡 ${auditSummary.warningCount} LƯU Ý – BẤM XEM)`
                    : `BÁC SĨ BẮT LỖI ĐỀ: ✅ 100% ĐẠT CHUẨN GDPT 2018 (0 LỖI)`}
                </span>
              </button>
            </div>

            {/* Hàng 2: Các công cụ soạn & lưu đề chuẩn xác, không bị lặp lại */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-action-sm"
                style={{
                  height: '34px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                  borderColor: '#93c5fd',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '13px',
                  padding: '0 14px',
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)'
                }}
                onClick={handleSaveToSubject}
                title="Lưu toàn bộ câu hỏi của 3 phần vào môn học này"
              >
                💾 Lưu Đề Vào Môn Này
              </button>

              <button
                type="button"
                className="btn-action-sm"
                style={{
                  height: '34px',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                  borderColor: '#a5b4fc',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '13px',
                  padding: '0 14px',
                  boxShadow: '0 2px 8px rgba(79, 70, 229, 0.35)'
                }}
                onClick={handleShuffleByPartOrder}
                title="Xáo trộn câu hỏi ngẫu nhiên trong từng phần, giữ đúng thứ tự Phần I (Trắc nghiệm) ➔ Phần II (Đúng/Sai) ➔ Phần III (Trả lời ngắn)"
              >
                🔀 Xáo Đề Theo Phần (I ➔ II ➔ III)
              </button>



              <button
                type="button"
                className="btn-action-sm"
                style={{
                  height: '34px',
                  background: '#dcfce7',
                  borderColor: '#86efac',
                  color: '#166534',
                  fontWeight: 900,
                  fontSize: '13px',
                  padding: '0 12px'
                }}
                onClick={onAddSubject}
                title="Thêm môn học mới vào hệ thống"
              >
                ➕ Thêm Môn Mới
              </button>

              {!subjectsDB[currentSubjectKey]?.fixed && (
                <button
                  type="button"
                  className="btn-action-sm"
                  style={{
                    height: '34px',
                    background: '#fee2e2',
                    borderColor: '#fca5a5',
                    color: '#991b1b',
                    fontWeight: 900,
                    fontSize: '13px',
                    padding: '0 12px'
                  }}
                  onClick={onDeleteCurrentSubject}
                  title="Xóa môn học tự thêm này"
                >
                  🗑️ Xóa Môn Này
                </button>
              )}

              <input
                type="file"
                ref={inlineMediaInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleInlineMediaFileSelect}
              />
            </div>
          </div>
        </section>

        {/* NÚT CHỌN NHANH PHẦN I, II, III (Segmented Switcher / Quick Navigation Tabs) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: '12px 0 14px 0',
            padding: '8px 12px',
            borderRadius: '14px',
            background: 'linear-gradient(90deg, #1e1b4b 0%, #0f172a 100%)',
            border: '2px solid #38bdf8',
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
            flexWrap: 'wrap'
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 900, color: '#fef08a', display: 'flex', alignItems: 'center', gap: '6px', marginRight: '4px' }}>
            <span>⚡</span>
            <span>CHỌN NHANH PHẦN:</span>
          </span>


          <button
            type="button"
            onClick={() => {
              setActivePartTab('MC');
              activeEditorBoxRef.current = 'MC';
            }}
            style={{
              padding: '7px 14px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 900,
              cursor: 'pointer',
              border: activePartTab === 'MC' ? '2px solid #93c5fd' : '1px solid #475569',
              background: activePartTab === 'MC' ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'rgba(255,255,255,0.08)',
              color: '#ffffff',
              boxShadow: activePartTab === 'MC' ? '0 0 12px rgba(56, 189, 248, 0.55)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            🟦 Phần I: Trắc Nghiệm 4 Phương Án ({formatCounts.mc} câu)
          </button>

          <button
            type="button"
            onClick={() => {
              setActivePartTab('TF');
              activeEditorBoxRef.current = 'TF';
            }}
            style={{
              padding: '7px 14px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 900,
              cursor: 'pointer',
              border: activePartTab === 'TF' ? '2px solid #ddd6fe' : '1px solid #475569',
              background: activePartTab === 'TF' ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'rgba(255,255,255,0.08)',
              color: '#ffffff',
              boxShadow: activePartTab === 'TF' ? '0 0 12px rgba(124, 58, 237, 0.55)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            🟪 Phần II: Đúng / Sai 4 Ý ({formatCounts.tf} câu)
          </button>

          <button
            type="button"
            onClick={() => {
              setActivePartTab('SA');
              activeEditorBoxRef.current = 'SA';
            }}
            style={{
              padding: '7px 14px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 900,
              cursor: 'pointer',
              border: activePartTab === 'SA' ? '2px solid #a7f3d0' : '1px solid #475569',
              background: activePartTab === 'SA' ? 'linear-gradient(135deg, #059669, #047857)' : 'rgba(255,255,255,0.08)',
              color: '#ffffff',
              boxShadow: activePartTab === 'SA' ? '0 0 12px rgba(16, 185, 129, 0.55)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            🟩 Phần III: Trả Lời Ngắn ({formatCounts.sa} câu)
          </button>
        </div>

        {/* BỐ TRÍ 3 KHUNG DẠNG THỨC THEO THỨ TỰ TỪ TRÊN XUỐNG (FULL-WIDTH, KHUNG TO RÕ RÀNG, DỄ THAO TÁC) */}
        <section
          aria-label="Ba khung soạn câu hỏi xếp từ trên xuống theo 3 dạng thức THPT 2018"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            margin: '8px 0 12px 0'
          }}
        >
          {/* KHUNG 1 (TRÊN CÙNG): DẠNG THỨC I - TRẮC NGHIỆM 4 LỰA CHỌN (A, B, C, D) */}
          <div
            style={{
              display: activePartTab === 'MC' ? 'flex' : 'none',
              width: '100%',
              background: '#eff6ff',
              border: '3px solid #3b82f6',
              borderRadius: '16px',
              padding: '14px 16px',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 6px 18px rgba(59, 130, 246, 0.14)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '16px', color: '#1d4ed8', letterSpacing: '0.2px' }}>
                  🟦 KHUNG 1 — DẠNG THỨC I: TRẮC NGHIỆM 4 LỰA CHỌN (A, B, C, D)
                </div>
                <div style={{ fontSize: '12.5px', color: '#1e293b', fontWeight: 700, marginTop: '2px' }}>
                  Mặc định: <b><u>Gạch chân</u> = ĐÚNG</b>, <b>Không gạch chân = SAI</b> • Tự động tách câu hỏi dài, câu dính chùm, phương án 2 cột / 4 cột
                </div>
              </div>
              <span style={{ background: '#1d4ed8', color: '#fff', fontWeight: 900, fontSize: '13.5px', padding: '5px 14px', borderRadius: '999px' }}>
                {formatCounts.mc} câu Dạng I
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-action-sm"
                style={{ fontSize: '12.5px', padding: '6px 12px', background: '#dbeafe', borderColor: '#60a5fa', color: '#1e3a8a', fontWeight: 800 }}
                onClick={() => handleInsertSample(SAMPLE_PHAN_1_MC, 'MC')}
              >
                ➕ Thêm mẫu Dạng I
              </button>
            </div>

            <div
              id="editor-mc"
              ref={mcEditorRef}
              contentEditable={true}
              suppressContentEditableWarning={true}
              onFocus={() => {
                activeEditorBoxRef.current = 'MC';
              }}
              onKeyDown={e => handleEditorKeyDown(e, 'MC')}
              onPaste={e => handleCleanPasteInBox(e, 'MC')}
              onInput={syncEditorQuestionsLive}
              onBlur={syncEditorQuestionsLive}
              style={{
                width: '100%',
                minHeight: '300px',
                maxHeight: '620px',
                resize: 'vertical',
                overflowY: 'auto',
                background: '#ffffff',
                border: '2.5px solid #93c5fd',
                borderRadius: '12px',
                padding: '14px 16px',
                fontSize: '15.5px',
                lineHeight: 1.68,
                outline: 'none',
                color: '#0f172a',
                boxShadow: 'inset 0 2px 6px rgba(15, 23, 42, 0.04)'
              }}
            />
          </div>

          {/* KHUNG 2 (Ở GIỮA): DẠNG THỨC II - ĐÚNG / SAI 4 Ý (a, b, c, d) */}
          <div
            style={{
              display: activePartTab === 'TF' ? 'flex' : 'none',
              width: '100%',
              background: '#f5f3ff',
              border: '3px solid #8b5cf6',
              borderRadius: '16px',
              padding: '14px 16px',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 6px 18px rgba(139, 92, 246, 0.14)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '16px', color: '#6d28d9', letterSpacing: '0.2px' }}>
                  🟪 KHUNG 2 — DẠNG THỨC II: TRẮC NGHIỆM ĐÚNG / SAI 4 Ý (a, b, c, d)
                </div>
                <div style={{ fontSize: '12.5px', color: '#1e293b', fontWeight: 700, marginTop: '2px' }}>
                  Mặc định: <b><u>Ý nào gạch chân</u> = ĐÚNG</b>, <b>Ý không gạch chân = SAI</b> cho cả 4 ý a), b), c), d)
                </div>
              </div>
              <span style={{ background: '#6d28d9', color: '#fff', fontWeight: 900, fontSize: '13.5px', padding: '5px 14px', borderRadius: '999px' }}>
                {formatCounts.tf} câu Dạng II
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-action-sm"
                style={{ fontSize: '12.5px', padding: '6px 12px', background: '#ede9fe', borderColor: '#a78bfa', color: '#4c1d95', fontWeight: 800 }}
                onClick={() => handleInsertSample(SAMPLE_PHAN_2_TF, 'TF')}
              >
                ➕ Thêm mẫu Dạng II
              </button>
            </div>

            <div
              id="editor-tf"
              ref={tfEditorRef}
              contentEditable={true}
              suppressContentEditableWarning={true}
              onFocus={() => {
                activeEditorBoxRef.current = 'TF';
              }}
              onKeyDown={e => handleEditorKeyDown(e, 'TF')}
              onPaste={e => handleCleanPasteInBox(e, 'TF')}
              onInput={syncEditorQuestionsLive}
              onBlur={syncEditorQuestionsLive}
              style={{
                width: '100%',
                minHeight: '300px',
                maxHeight: '620px',
                resize: 'vertical',
                overflowY: 'auto',
                background: '#ffffff',
                border: '2.5px solid #c4b5fd',
                borderRadius: '12px',
                padding: '14px 16px',
                fontSize: '15.5px',
                lineHeight: 1.68,
                outline: 'none',
                color: '#0f172a',
                boxShadow: 'inset 0 2px 6px rgba(15, 23, 42, 0.04)'
              }}
            />
          </div>

          {/* KHUNG 3 (DƯỚI CÙNG): DẠNG THỨC III - TRẢ LỜI NGẮN (ĐÁP SỐ / TỪ KHÓA) */}
          <div
            style={{
              display: activePartTab === 'SA' ? 'flex' : 'none',
              width: '100%',
              background: '#ecfdf5',
              border: '3px solid #10b981',
              borderRadius: '16px',
              padding: '14px 16px',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 6px 18px rgba(16, 185, 129, 0.14)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '16px', color: '#047857', letterSpacing: '0.2px' }}>
                  🟩 KHUNG 3 — DẠNG THỨC III: TRẢ LỜI NGẮN (ĐÁP SỐ / TỪ KHÓA)
                </div>
                <div style={{ fontSize: '12.5px', color: '#1e293b', fontWeight: 700, marginTop: '2px' }}>
                  Copy dán câu hỏi Trả lời ngắn kèm dòng <b>Đáp án: ...</b> hoặc <b><u>gạch chân đáp số</u></b> (Hỗ trợ câu hỏi dài nhiều đoạn văn)
                </div>
              </div>
              <span style={{ background: '#047857', color: '#fff', fontWeight: 900, fontSize: '13.5px', padding: '5px 14px', borderRadius: '999px' }}>
                {formatCounts.sa} câu Dạng III
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-action-sm"
                style={{ fontSize: '12.5px', padding: '6px 12px', background: '#d1fae5', borderColor: '#34d399', color: '#065f46', fontWeight: 800 }}
                onClick={() => handleInsertSample(SAMPLE_PHAN_3_SA, 'SA')}
              >
                ➕ Thêm mẫu Dạng III
              </button>
            </div>

            <div
              id="editor-sa"
              ref={saEditorRef}
              contentEditable={true}
              suppressContentEditableWarning={true}
              onFocus={() => {
                activeEditorBoxRef.current = 'SA';
              }}
              onKeyDown={e => handleEditorKeyDown(e, 'SA')}
              onPaste={e => handleCleanPasteInBox(e, 'SA')}
              onInput={syncEditorQuestionsLive}
              onBlur={syncEditorQuestionsLive}
              style={{
                width: '100%',
                minHeight: '280px',
                maxHeight: '580px',
                resize: 'vertical',
                overflowY: 'auto',
                background: '#ffffff',
                border: '2.5px solid #6ee7b7',
                borderRadius: '12px',
                padding: '14px 16px',
                fontSize: '15.5px',
                lineHeight: 1.68,
                outline: 'none',
                color: '#0f172a',
                boxShadow: 'inset 0 2px 6px rgba(15, 23, 42, 0.04)'
              }}
            />

            {/* Thanh hiển thị đáp số đã nhận diện ngay dưới Khung 3 */}
            {livePreviewItems.some(it => it.format === 'SHORT_ANSWER') && (
              <div
                style={{
                  background: '#d1fae5',
                  border: '1.5px solid #6ee7b7',
                  borderRadius: '10px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 900, color: '#065f46' }}>
                  ⚡ ĐÁP ÁN TRẢ LỜI NGẮN ĐÃ NHẬN DIỆN Ở KHUNG 3:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '130px', overflowY: 'auto' }}>
                  {livePreviewItems.map((item, globalIdx) => {
                    if (item.format !== 'SHORT_ANSWER') return null;
                    const saOrder =
                      livePreviewItems.slice(0, globalIdx + 1).filter(x => x.format === 'SHORT_ANSWER').length;
                    return (
                      <div
                        key={`sa-quick-${globalIdx}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: '#ffffff',
                          border: '1.5px solid #34d399',
                          borderRadius: '8px',
                          padding: '3px 8px',
                          fontSize: '12px',
                          fontWeight: 800
                        }}
                      >
                        <span style={{ color: '#065f46' }}>Câu {saOrder}:</span>
                        <span
                          style={{
                            background: '#059669',
                            color: '#ffffff',
                            padding: '1px 7px',
                            borderRadius: '5px',
                            fontWeight: 900
                          }}
                        >
                          {item.shortAnswer || item.opts?.[0] || 'Chưa có ĐA'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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

                  const qIssues = auditSummary.issues.filter(it => it.qid === qIdx);
                  const isHighlighted = highlightedQId === qIdx;

                  return (
                    <div
                      key={qIdx}
                      id={`preview-q-card-${qIdx}`}
                      style={{
                        background: isHighlighted ? '#fef3c7' : '#f8fafc',
                        border: isHighlighted
                          ? '2.5px solid #d97706'
                          : qIssues.some(i => i.severity === 'CRITICAL')
                          ? '2px solid #ef4444'
                          : '1.5px solid #cbd5e1',
                        borderRadius: '10px',
                        padding: '9px 12px',
                        fontSize: '12.5px',
                        transition: 'all 0.3s ease',
                        boxShadow: isHighlighted ? '0 0 14px rgba(217, 119, 6, 0.45)' : 'none'
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

                        {qIssues.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowAuditorModal(true)}
                            style={{
                              background: qIssues.some(i => i.severity === 'CRITICAL') ? '#fee2e2' : '#fef3c7',
                              color: qIssues.some(i => i.severity === 'CRITICAL') ? '#991b1b' : '#92400e',
                              border: `1px solid ${qIssues.some(i => i.severity === 'CRITICAL') ? '#f87171' : '#fcd34d'}`,
                              borderRadius: '6px',
                              padding: '2px 8px',
                              fontSize: '11px',
                              fontWeight: 900,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Bấm để mở chi tiết lỗi và cách sửa"
                          >
                            <span>⚠️</span>
                            <span>{qIssues[0].badgeLabel}</span>
                          </button>
                        )}

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

                      {/* Live STEM Formula, Data Table, Map & Diagram Preview */}
                      {(item.q.includes('$') ||
                        item.q.includes('\\') ||
                        item.q.includes('<img') ||
                        item.q.includes('<table') ||
                        item.q.includes('<sub') ||
                        item.q.includes('<sup') ||
                        item.q.includes('[')) && (
                        <div style={{ marginBottom: '8px', padding: '6px 10px', background: '#eff6ff', borderRadius: '8px', border: '1.5px solid #bfdbfe', fontSize: '12.5px', color: '#1e3a8a', overflowX: 'auto' }}>
                          <span style={{ fontWeight: 900, color: '#2563eb', marginRight: '6px' }}>📐 Hiển thị Công thức / Bảng số liệu / Bản đồ / Hình ảnh:</span>
                          <MathRenderer text={item.q} />
                        </div>
                      )}

                      {(!item.format || item.format === 'MULTIPLE_CHOICE') && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '6px' }}>
                          {item.opts.slice(0, 4).map((optTxt, oIdx) => {
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
                          {(item.tfItems || []).slice(0, 4).map((tf, tfIdx) => (
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

        <div className="flex-between" style={{ marginTop: '12px', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#059669', fontWeight: 800 }}>
              🟢 Mã phòng hiện tại: <b style={{ color: '#0284c7' }}>{activeRoomId}</b> (<b style={{ color: '#16a34a' }}>{connectedStudentCount}</b> HS trong phòng)
            </span>
            {connectedStudentCount > 0 && (
              <button
                type="button"
                className="btn-action-sm"
                style={{ background: '#fee2e2', borderColor: '#fca5a5', color: '#b91c1c', fontSize: '11.5px', padding: '4px 9px', fontWeight: 900 }}
                onClick={() => {
                  if (confirm(`Xác nhận xóa sạch danh sách ${connectedStudentCount} học sinh hiện tại khỏi phòng để đón lớp mới?`)) {
                    onResetClass?.();
                  }
                }}
                title="Xóa danh sách học sinh cũ khỏi phòng hiện tại để học sinh mới điểm danh lại"
              >
                🧹 Xóa sạch HS cũ
              </button>
            )}
            <button
              type="button"
              className="btn-action-sm"
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#ffffff',
                borderColor: '#fbbf24',
                fontSize: '12px',
                padding: '5px 12px',
                fontWeight: 900,
                boxShadow: '0 2px 6px rgba(245, 158, 11, 0.35)'
              }}
              onClick={() => {
                if (confirm('TẠO PHIÊN MỚI / ĐỔI LỚP KHÁC:\n\n• Hệ thống sẽ cấp Mã phòng 5 số mới toanh.\n• Xóa sạch 100% danh sách học sinh cũ.\n• Mã QR và liên kết phòng sẽ tự cập nhật cho lớp mới.\n\nThầy/Cô có muốn tiếp tục?')) {
                  onNewSession?.();
                }
              }}
              title="Tạo mã phòng mới hoàn toàn và dọn sạch học sinh lớp cũ khi chuyển sang tiết/lớp khác"
            >
              🔄 Đổi Lớp / Phiên Mới
            </button>
          </div>
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

      {/* CHÂN TRANG CỐ ĐỊNH 1 HÀNG KÍCH THƯỚC LỚN RÕ RÀNG, VỪA KHUNG & MÀU SẮC NỔI BẬT */}
      <aside
        className="sticky-launch-bar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '46px',
          minHeight: '46px',
          background: 'linear-gradient(90deg, #090d16 0%, #172554 50%, #090d16 100%)',
          borderTop: '2px solid #38bdf8',
          boxShadow: '0 -4px 18px rgba(0, 0, 0, 0.75)',
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          gap: '10px',
          zIndex: 500,
          whiteSpace: 'nowrap'
        }}
      >
        {/* Nhóm trái: Thông tin tác giả + Mời Thầy Khải Ly Cà Phê */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 800, flexShrink: 0 }}>
          <span style={{ color: '#cbd5e1' }}>Liên hệ & góp ý:</span>
          <span style={{ background: '#dc2626', color: '#ffffff', padding: '2px 8px', borderRadius: '5px', fontWeight: 900 }}>
            👨‍🏫 Hồ Tấn Khải
          </span>
          <span style={{ color: '#38bdf8', fontWeight: 900 }}>🏫 THPT Mang Thít</span>
          <a
            href="mailto:khaibcmt@gmail.com"
            style={{ color: '#fde047', textDecoration: 'none', fontWeight: 800 }}
            title="Gửi Email trực tiếp"
          >
            ✉️ khaibcmt@gmail.com
          </a>
          <a
            href="https://zalo.me/0939580982"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#4ade80', textDecoration: 'none', fontWeight: 800 }}
            title="Nhắn tin Zalo: 0939580982"
          >
            💬 Zalo: 0939580982
          </a>
          {onOpenCoffeeModal && (
            <button
              type="button"
              onClick={onOpenCoffeeModal}
              style={{
                height: '32px',
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                color: '#fef08a',
                border: '1.5px solid #fde047',
                borderRadius: '8px',
                padding: '0 10px',
                fontSize: '12px',
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(217, 119, 6, 0.45)'
              }}
              title="Bấm để mời Thầy Khải một ly cà phê qua VietQR Agribank"
            >
              <span>☕</span>
              <span>Mời Thầy Khải Ly Cà Phê</span>
            </button>
          )}
          <span style={{ color: '#f472b6', fontWeight: 800 }}>• Cảm ơn quý đồng nghiệp!</span>
        </div>

        {/* Nhóm phải: Trạng thái phòng & các nút điều khiển kích cỡ lớn, vừa khít thanh công cụ, màu sắc nổi bật bắt mắt */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div
            style={{
              height: '32px',
              padding: '0 10px',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1.5px solid #38bdf8',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              fontWeight: 800,
              color: '#f1f5f9',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
            }}
          >
            <span style={{ color: '#22c55e', fontSize: '13px' }}>●</span>
            <span>Phòng <b style={{ color: '#fde047', fontSize: '13.5px' }}>{activeRoomId}</b></span>
            <span style={{ color: '#94a3b8' }}>•</span>
            <span style={{ color: '#4ade80', fontWeight: 900 }}>{connectedStudentCount} HS</span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (confirm('TẠO PHIÊN MỚI / ĐỔI LỚP KHÁC:\n\n• Hệ thống sẽ cấp Mã phòng mới toanh.\n• Xóa sạch 100% danh sách học sinh cũ.\n• Mã QR và liên kết phòng sẽ tự cập nhật cho lớp mới.\n\nThầy/Cô có muốn tiếp tục?')) {
                onNewSession?.();
              }
            }}
            style={{
              height: '32px',
              background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
              color: '#ffffff',
              border: '1.5px solid #fdba74',
              borderRadius: '8px',
              padding: '0 12px',
              fontSize: '12.5px',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.45)',
              whiteSpace: 'nowrap'
            }}
            title="Tạo mã phòng mới hoàn toàn và dọn sạch học sinh lớp cũ"
          >
            <span>🔄</span>
            <span>Đổi Lớp</span>
          </button>



          <button
            type="button"
            onClick={() => setShowQRModal(!showQRModal)}
            style={{
              height: '32px',
              background: showQRModal
                ? 'linear-gradient(135deg, #db2777 0%, #9d174d 100%)'
                : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
              color: '#ffffff',
              border: showQRModal ? '1.5px solid #fbcfe8' : '1.5px solid #c4b5fd',
              borderRadius: '8px',
              padding: '0 12px',
              fontSize: '12.5px',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 2px 8px rgba(124, 58, 237, 0.45)',
              whiteSpace: 'nowrap'
            }}
            title="Bấm để ẩn hoặc hiện mã QR phòng"
          >
            <span>{showQRModal ? '🙈' : '📱'}</span>
            <span>{showQRModal ? 'Ẩn QR' : 'Mã QR'}</span>
          </button>

          <button
            type="button"
            onClick={handleStartArena}
            style={{
              height: '34px',
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              color: '#ffffff',
              border: '2px solid #93c5fd',
              borderRadius: '8px',
              padding: '0 16px',
              fontSize: '13.5px',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 0 16px rgba(56, 189, 248, 0.7), 0 3px 10px rgba(0,0,0,0.4)',
              letterSpacing: '0.4px',
              whiteSpace: 'nowrap'
            }}
            title="Chuẩn bị vào sàn đấu 3D (Tập hợp học sinh)"
          >
            <span>📢</span>
            <span>VÀO SÀN ĐẤU</span>
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

      {/* Bác Sĩ Bắt Lỗi Đề (Quiz Auditor Modal) */}

      {/* AI Doctor & STEM Auditor Modal */}
      <QuizAuditorModal
        isOpen={showAuditorModal}
        onClose={() => setShowAuditorModal(false)}
        auditSummary={auditSummary}
        quizList={livePreviewItems}
        onApplyFixedQuiz={(fixedList, msg) => {
          populate3BoxesFromItems(fixedList);
          if (msg) alert(msg);
        }}
        onJumpToQuestion={(qIdx) => {
          setShowPreviewList(true);
          setHighlightedQId(qIdx);
          setTimeout(() => {
            const el = document.getElementById(`preview-q-card-${qIdx}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 150);
          setTimeout(() => {
            setHighlightedQId(null);
          }, 4000);
        }}
      />
    </main>
  );
};
