/**
 * Đợt 4 (Giai đoạn 3.4): ĐỌC FILE CHỮ TIẾNG VIỆT KHÔNG LỖI DẤU — dùng chung cho
 * mọi điểm nạp file (TeacherSetupView, CloudSyncModal…).
 *
 * Cách "ngửi" định dạng:
 * - Có BOM: UTF-8 (EF BB BF) / UTF-16LE (FF FE) / UTF-16BE (FE FF) → giải mã đúng
 *   bằng TextDecoder tương ứng.
 * - Không BOM: thử UTF-8 nghiêm ngặt (fatal) — lỗi thì fallback TextDecoder
 *   'windows-1258' (bảng mã tiếng Việt ANSI mà Notepad/Word cũ hay lưu .txt).
 * Kết quả luôn được chuẩn hoá NFC (windows-1258 giải ra tổ hợp dấu dạng combining,
 * NFC ghép lại thành ký tự dựng sẵn giống hệt các đường nạp khác).
 */

export function decodeTextBuffer(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let text: string;

  const hasUtf8Bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const hasUtf16LeBom = bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe;
  const hasUtf16BeBom = bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff;

  if (hasUtf8Bom) {
    text = new TextDecoder('utf-8').decode(bytes);
  } else if (hasUtf16LeBom) {
    text = new TextDecoder('utf-16le').decode(bytes);
  } else if (hasUtf16BeBom) {
    text = new TextDecoder('utf-16be').decode(bytes);
  } else {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      try {
        text = new TextDecoder('windows-1258').decode(bytes);
      } catch {
        // Môi trường không có bảng mã 1258: lùi về 1252 còn hơn đọc hỏng hẳn.
        text = new TextDecoder('windows-1252').decode(bytes);
      }
    }
  }

  // TextDecoder thường đã tự bỏ BOM; xoá thủ công nếu còn sót U+FEFF ở đầu.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text.normalize('NFC');
}

/** Đọc 1 File/Blob thành chuỗi tiếng Việt sạch (NFC) bất kể encoding gốc. */
export async function readFileAsText(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  return decodeTextBuffer(buf);
}
