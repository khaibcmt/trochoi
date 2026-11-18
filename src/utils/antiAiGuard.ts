/**
 * 🛡️ CHỐNG AI NGOÀI (18/11/2026): logic THUẦN phát hiện học sinh rời màn hình
 * thi để hỏi AI ngoài (Gemini/Google trên chính điện thoại đang thi) — máy
 * trạng thái theo "phiên rời màn hình" (away episode), KHÔNG chạm DOM.
 * StudentMobileView nối sự kiện DOM (visibilitychange / blur / pagehide /
 * fullscreenchange / resize) vào tracker này và thi hành hệ quả (gửi báo cáo
 * lên host, khoá câu, hiện cảnh báo). App.tsx phía host dùng planAwayMark để
 * quyết định ghi sổ — cả hai phía dùng chung hằng số ở đây để không lệch luật.
 *
 * LUẬT CỐT LÕI (thầy chốt):
 * - Một phiên rời màn hình bắt đầu khi điều kiện rời ĐẦU TIÊN xuất hiện
 *   (rời app / thoát toàn màn hình / chia đôi màn hình / mất tiêu điểm) và
 *   kết thúc khi MỌI điều kiện đều hết. Phiên kéo dài ≥ 1 giây
 *   (AWAY_GRACE_MS) mới tính 1 lần vi phạm — ngưỡng này chỉ lọc chớp
 *   nhoáng kỹ thuật dưới 1 giây của hệ thống.
 * - LUẬT CỨNG (thầy chốt 18/11/2026): "Đang làm bài mà đụng vào quy chế là
 *   TÍNH SAI" + "Cho làm luôn nhưng tính sai khi vi phạm" — mọi vi phạm
 *   đều làm câu đang mở bị TÍNH SAI ngay, KHÔNG có mức "chỉ ghi nhận" và
 *   KHÔNG khoá máy HS ở bất kỳ số lần vi phạm nào: HS chơi tiếp bình
 *   thường, chỉ câu dính vi phạm là sai. Nếu một câu MỞ RA trong lúc HS
 *   đang ở trạng thái vi phạm kéo dài (ngoài toàn màn hình / chia màn
 *   hình / mất tiêu điểm) thì câu đó cũng tính sai — chơi ngoài quy chế
 *   bao lâu thì mọi câu trong quãng đó đều sai, nhưng không giây nào bị
 *   khoá máy.
 * - Chia đôi màn hình: viewport tụt dưới 65% chiều cao màn hình vật lý và
 *   kéo dài ≥ 1 giây thì bắn vi phạm NGAY trong lúc còn đang chia (để lớp
 *   phủ yêu cầu về 1 màn hình hiện kịp), không đợi học sinh quay lại.
 * - Xoay máy (orientationchange): reset phép đo chia màn hình, không tính oan.
 * - MẤT TIÊU ĐIỂM (nguồn FOCUS, bổ sung 18/11/2026): đường bắt TRỢ LÝ GIỌNG
 *   NÓI (Google Assistant / Gemini Live) và cửa sổ nổi của hệ điều hành —
 *   các cửa sổ này bật lên làm trang thi mất window focus DÙ TRANG VẪN
 *   "visible" nên visibilitychange không thấy gì. window blur là đường
 *   phát hiện ĐỘC LẬP hạng nhất: blur lúc câu đang mở → bắt đầu đếm;
 *   focus trở lại sau ≥ 1 giây → 1 vi phạm nguồn FOCUS. Nếu trong cùng
 *   phiên, trang THẬT SỰ bị ẩn (điều kiện APP bật) thì nhãn nguồn được
 *   nâng lên APP — em đó đã rời app thật, không còn là "nghi vấn" nữa.
 *   GIỚI HẠN TRUNG THỰC: trang web không tắt được trợ lý giọng nói ở cấp
 *   hệ điều hành; cơ chế này chỉ ghi nhận qua mất tiêu điểm + thời gian —
 *   trường hợp overlay không làm mất focus thì không có tín hiệu để bắt.
 */

export type AwaySource = 'APP' | 'FS' | 'SPLIT' | 'FOCUS';

/**
 * Thời gian rời màn hình tối thiểu để tính 1 lần vi phạm (ms) — thầy chốt
 * 1 GIÂY (18/11/2026): chỉ còn tác dụng lọc chớp nhoáng kỹ thuật dưới 1 giây
 * của hệ thống (thông báo nhá, cuộc gọi nhá máy...), áp cho MỌI nguồn
 * (rời app / thoát toàn màn hình / chia màn hình / mất tiêu điểm).
 */
export const AWAY_GRACE_MS = 1000;
/** Ngưỡng chia màn hình: chiều cao viewport / chiều cao màn hình vật lý. */
export const SPLIT_RATIO_THRESHOLD = 0.65;

export interface AwayViolationEvent {
  source: AwaySource;
  /** Số giây rời màn hình (làm tròn, tối thiểu 1). */
  awaySec: number;
  startedAt: number;
  endedAt: number;
}



/** Tỉ lệ chiều cao viewport so với màn hình vật lý; dữ liệu thiếu → 1 (an toàn). */
export function splitScreenRatio(viewportHeight: number, screenHeight: number): number {
  if (!screenHeight || screenHeight <= 0 || !viewportHeight || viewportHeight <= 0) return 1;
  return viewportHeight / screenHeight;
}

export function isSplitRatio(ratio: number): boolean {
  return ratio > 0 && ratio < SPLIT_RATIO_THRESHOLD;
}

/** Nhãn tiếng Việt của nguồn vi phạm (báo cáo phía host). */
export function awaySourceLabel(source: string | undefined | null): string {
  switch (source) {
    case 'FS':
      return 'thoát toàn màn hình';
    case 'SPLIT':
      return 'chia màn hình';
    case 'FOCUS':
      return 'mất tiêu điểm — nghi trợ lý giọng nói/cửa sổ nổi';
    default:
      return 'rời app';
  }
}

/**
 * Máy trạng thái phiên rời màn hình. Mọi mốc thời gian do phía gọi truyền vào
 * (Date.now()) để test được bằng đồng hồ giả.
 */
export class AwayEpisodeTracker {
  private conditions = new Set<AwaySource>();
  private episodeStart: number | null = null;
  private episodeSource: AwaySource | null = null;
  private episodeFired = false;
  private splitSince: number | null = null;

  /** Đang trong một phiên rời màn hình hay không. */
  isAway(): boolean {
    return this.episodeStart !== null;
  }

  /** Nguồn đã khởi đầu phiên hiện tại (null nếu không trong phiên nào). */
  currentSource(): AwaySource | null {
    return this.episodeSource;
  }

  /** Điều kiện rời có đang bật hay không. */
  hasCondition(source: AwaySource): boolean {
    return this.conditions.has(source);
  }

  /**
   * Bật/tắt một điều kiện rời. Khi điều kiện cuối cùng tắt, phiên kết thúc:
   * đủ ≥ grace và chưa từng bắn trong phiên này → trả về đúng 1 vi phạm.
   */
  setCondition(source: AwaySource, active: boolean, now: number): AwayViolationEvent[] {
    if (active) {
      if (this.conditions.size === 0) {
        this.episodeStart = now;
        this.episodeSource = source;
        this.episodeFired = false;
      } else if (source === 'APP' && this.episodeSource === 'FOCUS') {
        // Phiên mở đầu bằng mất tiêu điểm (nghi trợ lý giọng nói/cửa sổ nổi)
        // nhưng sau đó trang THẬT SỰ bị ẩn → em đó đã rời app thật: nâng
        // nhãn nguồn lên APP cho đúng bản chất. Các nguồn khác không ghi đè.
        this.episodeSource = 'APP';
      }
      this.conditions.add(source);
      return [];
    }
    this.conditions.delete(source);
    if (source === 'SPLIT') this.splitSince = null;
    if (this.conditions.size > 0 || this.episodeStart === null) return [];
    const start = this.episodeStart;
    const src = this.episodeSource || source;
    const fired = this.episodeFired;
    this.episodeStart = null;
    this.episodeSource = null;
    this.episodeFired = false;
    const dur = now - start;
    if (!fired && dur >= AWAY_GRACE_MS) {
      return [
        {
          source: src,
          awaySec: Math.max(1, Math.round(dur / 1000)),
          startedAt: start,
          endedAt: now
        }
      ];
    }
    return [];
  }

  /**
   * Nhịp đo chia màn hình — gọi định kỳ với trạng thái viewport hiện tại.
   * belowRatio = viewport đang dưới ngưỡng chia màn hình VÀ không có ô nhập
   * văn bản nào đang focus (bàn phím Phần 3 không bị tính oan — phía gọi tự
   * loại trừ trước khi truyền vào).
   * - Vừa tụt xuống ngưỡng: bắt đầu một phiên với nguồn SPLIT.
   * - Đang chia mà phiên đã ≥ grace: bắn vi phạm SPLIT ngay (1 lần/phiên).
   * - Hết chia: kết thúc điều kiện SPLIT qua setCondition (không bắn lần hai
   *   nếu nhịp này đã bắn).
   */
  tickSplit(belowRatio: boolean, now: number): AwayViolationEvent[] {
    if (!belowRatio) {
      this.splitSince = null;
      if (this.conditions.has('SPLIT')) return this.setCondition('SPLIT', false, now);
      return [];
    }
    if (!this.conditions.has('SPLIT')) {
      this.splitSince = now;
      return this.setCondition('SPLIT', true, now);
    }
    if (
      !this.episodeFired &&
      this.episodeStart !== null &&
      now - this.episodeStart >= AWAY_GRACE_MS
    ) {
      this.episodeFired = true;
      return [
        {
          source: 'SPLIT',
          awaySec: Math.max(1, Math.round((now - this.episodeStart) / 1000)),
          startedAt: this.episodeStart,
          endedAt: now
        }
      ];
    }
    return [];
  }

  /**
   * Xoay máy: huỷ phép đo chia màn hình hiện tại. Nếu phiên đang mở CHỈ vì
   * điều kiện SPLIT thì huỷ luôn phiên mà KHÔNG tính vi phạm (xoay máy làm
   * viewport đổi tỉ lệ thoáng qua — không tính oan).
   */
  resetSplitMeasurement(): void {
    this.splitSince = null;
    if (!this.conditions.has('SPLIT')) return;
    this.conditions.delete('SPLIT');
    if (this.conditions.size === 0) {
      this.episodeStart = null;
      this.episodeSource = null;
      this.episodeFired = false;
    }
  }

  /** Xoá sạch mọi trạng thái (đổi trận / rời phòng). */
  reset(): void {
    this.conditions.clear();
    this.episodeStart = null;
    this.episodeSource = null;
    this.episodeFired = false;
    this.splitSince = null;
  }
}

export interface AwayMarkPlan {
  /** Ghi câu của báo cáo vào sổ đáp án phía host như "sai — vi phạm quy chế". */
  markLedger: boolean;
}

/**
 * Quyết định phía HOST khi nhận 1 báo cáo vi phạm (thuần — dùng chung cho
 * handler thật và test). LUẬT CỨNG của thầy (chốt 18/11/2026): "Đang làm bài
 * mà đụng vào quy chế là TÍNH SAI" + "Cho làm luôn nhưng tính sai khi vi
 * phạm" — KHÔNG khoá máy HS ở bất kỳ số lần vi phạm nào, chỉ chốt sai câu
 * dính vi phạm:
 * - MỌI vi phạm đều ghi sổ câu bị rời là SAI, chỉ trừ 2 trường hợp kỹ thuật:
 *   câu báo cáo không thuộc quá khứ/hiện tại của trận (reportQIndex >
 *   currentQIndex — dữ liệu lệch nhịp), hoặc HS ĐÃ có đáp án ghi sổ cho câu
 *   đó từ trước khi rời (đáp án đứng nguyên, không ghi đè).
 */
export function planAwayMark(opts: {
  reportQIndex: number | null | undefined;
  currentQIndex: number;
  alreadyAnswered: boolean;
}): AwayMarkPlan {
  const markLedger =
    typeof opts.reportQIndex === 'number' &&
    Number.isFinite(opts.reportQIndex) &&
    opts.reportQIndex >= 0 &&
    opts.reportQIndex <= opts.currentQIndex &&
    !opts.alreadyAnswered;
  return { markLedger };
}
