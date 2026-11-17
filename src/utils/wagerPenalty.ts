/**
 * MA TRẬN PHẠT KHI TRẢ LỜI SAI — LUẬT CƯỢC BẢN LĨNH MỚI (thầy chốt 17/11/2026).
 *
 * Bối cảnh: luật cũ cho mức An Toàn (x1) phạt 0đ VĨNH VIỄN — cờ "chỉ dùng
 * 1 lần" chỉ khoá 2 nút cược đặc biệt phía HS, host không hề biết, nên HS
 * ngồi An Toàn cả trận, sai bao nhiêu cũng không trừ điểm. Thầy chốt lại:
 *
 *  - Mỗi HS có 1 "LÁ CHẮN AN TOÀN" cho cả trận: câu sai ĐẦU TIÊN ở mức x1
 *    (chốt sai hoặc hết giờ) được miễn PHẠT ĐIỂM. Từ câu sai thứ hai ở x1:
 *    phạt chuẩn 1000đ ở MỌI chế độ (FAST/BOSS/TUG/BELL).
 *  - Ở BELL, lá chắn chỉ che phần ĐIỂM — mất mạng vẫn áp từ câu sai đầu
 *    tiên (luật mạng là luật lõi của Rung Chuông Vàng). Sai ở BELL (sau
 *    khi lá chắn đã dùng) = −1000đ VÀ −1 mạng.
 *  - TUG: BỎ HOÀN TOÀN luật đóng băng khi trả lời sai — sai chỉ trừ điểm
 *    theo ma trận này, không còn hiệu ứng/điều kiện đóng băng nào trong
 *    luật phạt (thẻ kỹ năng Đóng Băng đối thủ là cơ chế riêng, không đổi).
 *  - Cược đặc biệt (Liều Lĩnh x1.5 → −300đ, Tất Tay x2.5 → −800đ) giữ
 *    nguyên khoá 1 lần/trận: host theo dõi theo từng người chơi và KẸP
 *    wager về 1 nếu HS đã dùng (chặn tin trùng/cũ áp lại mức đặc biệt).
 *  - Khiên Bất Tử (rương) / Khiên Bảo Vệ (thẻ TUG): bảo vệ tuyệt đối câu
 *    sai đó (0 điểm, 0 mạng) và tiêu hao ngay — lá chắn An Toàn KHÔNG bị
 *    tiêu hao trong câu được khiên che.
 *
 * File này là LOGIC THUẦN dùng chung cho CẢ HAI PHÍA (StudentMobileView tự
 * tính để hiển thị + App.tsx phía host tính trên sổ chuẩn) để điểm HS và sổ
 * host KHỚP TUYỆT ĐỐI — kể cả đường hết giờ (trước đây tin hết giờ không
 * kèm wagerLevel nên host tính phạt 0 trong khi máy HS tự trừ 1000đ).
 */

export type PenaltyGameType = 'FAST' | 'BOSS' | 'TUG' | 'BELL';

export interface WrongPenaltyInput {
  gameType: string;
  /** Mức cược HS chọn cho câu này: 1 | 1.5 | 2.5 (giá trị lạ → coi như 1). */
  wagerLevel: number;
  /** HS đã dùng lượt cược đặc biệt (x1.5/x2.5) trong trận này chưa. */
  specialWagerUsed: boolean;
  /** Lá chắn An Toàn 1 lần/trận đã bị tiêu hao chưa. */
  safeShieldUsed: boolean;
  /** Câu sai này được Khiên Bất Tử / Khiên Bảo Vệ che hay không. */
  shieldProtected: boolean;
}

export interface WrongPenaltyResult {
  /** Mức cược hiệu lực sau khi kẹp (đã dùng đặc biệt mà còn gửi x1.5/x2.5 → 1). */
  effectiveWager: number;
  /** Số điểm bị trừ (>= 0). */
  pointsPenalty: number;
  /** Số mạng mất (chỉ BELL mới có: 0 hoặc 1). */
  livesLoss: 0 | 1;
  /** Câu sai này có tiêu hao lá chắn An Toàn không. */
  consumeSafeShield: boolean;
  /** Câu sai này có tiêu hao Khiên Bất Tử / Khiên Bảo Vệ không. */
  consumeShield: boolean;
  /** Câu trả lời này có dùng lượt cược đặc biệt của trận không (effectiveWager > 1). */
  usesSpecialWager: boolean;
}

/** Phạt chuẩn khi lá chắn An Toàn đã hết (mọi chế độ). */
export const STANDARD_WRONG_PENALTY = 1000;
/** Phạt khi sai ở Liều Lĩnh x1.5. */
export const WAGER_15_PENALTY = 300;
/** Phạt khi sai ở Tất Tay x2.5. */
export const WAGER_25_PENALTY = 800;

export function normalizeWager(wagerLevel: number): number {
  return wagerLevel === 2.5 ? 2.5 : wagerLevel === 1.5 ? 1.5 : 1;
}

/**
 * Tính phạt cho 1 câu trả lời SAI (thuần — hai phía gọi chung).
 * Thứ tự ưu tiên: Khiên Bất Tử/Bảo Vệ > cược đặc biệt > lá chắn An Toàn >
 * phạt chuẩn theo mode.
 */
export function computeWrongPenalty(input: WrongPenaltyInput): WrongPenaltyResult {
  const gameType = (input.gameType || 'FAST') as PenaltyGameType;
  const isBell = gameType === 'BELL';
  const requested = normalizeWager(input.wagerLevel);
  // Kẹp cược: đã dùng lượt đặc biệt trong trận → mọi mức > 1 bị hạ về 1.
  const effectiveWager = requested > 1 && input.specialWagerUsed ? 1 : requested;
  const usesSpecialWager = effectiveWager > 1;

  // 1) Khiên Bất Tử / Khiên Bảo Vệ: che tuyệt đối (điểm + mạng), tiêu hao
  //    khiên — lá chắn An Toàn giữ nguyên.
  if (input.shieldProtected) {
    return {
      effectiveWager,
      pointsPenalty: 0,
      livesLoss: 0,
      consumeSafeShield: false,
      consumeShield: true,
      usesSpecialWager
    };
  }

  // 2) Cược đặc biệt: phạt theo mức cược; BELL vẫn mất 1 mạng như luật lõi.
  if (effectiveWager === 2.5 || effectiveWager === 1.5) {
    return {
      effectiveWager,
      pointsPenalty: effectiveWager === 2.5 ? WAGER_25_PENALTY : WAGER_15_PENALTY,
      livesLoss: isBell ? 1 : 0,
      consumeSafeShield: false,
      consumeShield: false,
      usesSpecialWager
    };
  }

  // 3) An Toàn x1 + lá chắn còn: miễn phạt ĐIỂM lần này, tiêu hao lá chắn.
  //    BELL: mạng vẫn mất (lá chắn chỉ che điểm).
  if (!input.safeShieldUsed) {
    return {
      effectiveWager: 1,
      pointsPenalty: 0,
      livesLoss: isBell ? 1 : 0,
      consumeSafeShield: true,
      consumeShield: false,
      usesSpecialWager: false
    };
  }

  // 4) An Toàn x1 + lá chắn đã hết: phạt chuẩn mọi mode; BELL thêm −1 mạng.
  return {
    effectiveWager: 1,
    pointsPenalty: STANDARD_WRONG_PENALTY,
    livesLoss: isBell ? 1 : 0,
    consumeSafeShield: false,
    consumeShield: false,
    usesSpecialWager: false
  };
}

/**
 * Áp phạt điểm vào điểm hiện tại (thuần): BELL chặn sàn 0 (như sổ host vẫn
 * làm); các mode khác cho âm như luật hiện hành hai phía đang khớp nhau.
 */
export function applyPointsPenalty(currentScore: number, pointsPenalty: number, gameType: string): number {
  const next = (currentScore || 0) - Math.max(0, pointsPenalty || 0);
  return gameType === 'BELL' ? Math.max(0, next) : next;
}
