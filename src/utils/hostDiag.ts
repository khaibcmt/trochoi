/**
 * KHO ĐO CHẨN ĐOÁN PHÍA HOST (sửa sự cố "máy chủ chết khi 41 HS", 17/11/2026).
 *
 * Vấn đề: các đợt sửa trước đều đo bằng host GIẢ LẬP không render React nên mù
 * trước chi phí thật phía máy thầy (tin vào/giây, số lần flush state roster,
 * độ trễ vòng quét khi luồng JS bị bão hoà). Module này là kho đếm dùng chung
 * ở tầng module: App.tsx GHI (đếm flush roster, độ trễ vòng quét, hàm tính độ
 * tươi của tín hiệu HS), HostArenaView ĐỌC mỗi 1s và hiển thị cạnh nhãn 🏷️ để
 * thầy chụp ảnh là em đọc được số thật, thay vì đoán.
 *
 * Module này KHÔNG chứa logic nghiệp vụ: chỉ đếm và giữ hàm tính độ tươi do
 * App đăng ký (vì lastSeenByIdRef sống trong App).
 */

let rosterFlushTotal = 0;
let lastSweepLagMs = 0;
let maxSweepLagSinceReadMs = 0;
let freshnessProvider: (() => { fresh: number; total: number }) | null = null;

/** App gọi mỗi khi một commit React làm thay đổi danh tính mảng roster (red/blue). */
export function recordRosterFlush(): void {
  rosterFlushTotal++;
}

/**
 * Vòng quét giữ chỗ gọi mỗi vòng: lag = giờ chạy thật − giờ hẹn (5000ms).
 * Giữ cả đỉnh trễ từ lần đọc trước để dòng chẩn đoán (đọc 1 lần/giây) không
 * lỡ mất một cú khựng 2–3 giây của luồng JS giữa hai lần đọc.
 */
export function recordSweepLag(lagMs: number): void {
  if (typeof lagMs === 'number' && isFinite(lagMs) && lagMs >= 0) {
    lastSweepLagMs = Math.round(lagMs);
    if (lastSweepLagMs > maxSweepLagSinceReadMs) {
      maxSweepLagSinceReadMs = lastSweepLagMs;
    }
  }
}

/** App đăng ký hàm đếm HS có tín hiệu tươi (<15s) / tổng HS từ lastSeenByIdRef. */
export function setFreshnessProvider(
  fn: (() => { fresh: number; total: number }) | null
): void {
  freshnessProvider = fn;
}

export interface HostDiagCounters {
  rosterFlushTotal: number;
  sweepLagMs: number;
  fresh: number;
  total: number;
}

/** HostArenaView đọc mỗi 1s: tự tính tốc độ từ hiệu số bộ đếm giữa hai lần đọc. */
export function readHostDiagCounters(): HostDiagCounters {
  let fresh = 0;
  let total = 0;
  if (freshnessProvider) {
    try {
      const f = freshnessProvider();
      fresh = f.fresh || 0;
      total = f.total || 0;
    } catch {}
  }
  const sweepLagMs = maxSweepLagSinceReadMs;
  maxSweepLagSinceReadMs = lastSweepLagMs;
  return { rosterFlushTotal, sweepLagMs, fresh, total };
}
