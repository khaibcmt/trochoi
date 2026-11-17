/**
 * Đợt GIA CỐ TẢI (17/11/2026) — LOGIC THUẦN về nhịp thử lại kết nối.
 *
 * File này không chạm mạng/React: chỉ quyết định "chờ bao lâu trước lần thử
 * nối lại kế tiếp" để kiểm chứng bằng script độc lập.
 *
 * Vấn đề: trước đây các lần thử lại sau khi rớt broker cách nhau cố định
 * 200–350ms. Khi broker/wifi trường chập chờn, ~200 máy HS cùng rớt rồi cùng
 * thử lại trong cùng một khoảnh khắc (đàn sấm sét — thundering herd) sẽ tự
 * làm nghẽn thêm đúng lúc hệ thống đang yếu nhất. Backoff lũy thừa + jitter
 * rải các lần thử lại ra theo thời gian và lệch nhau giữa các máy.
 */

/** Trần chờ giữa hai lần thử nối lại (chưa tính jitter). */
export const FAILOVER_BACKOFF_CAP_MS = 8000;
/** Biên jitter cộng thêm tối đa, để các máy không thử lại trùng mốc nhau. */
export const FAILOVER_BACKOFF_JITTER_MS = 600;

/**
 * Thời gian chờ trước lần thử nối lại thứ `attempt` (0-based):
 * cơ số tăng gấp đôi 600 → 1200 → 2400 → 4800 → trần 8000ms, cộng jitter
 * 0..600ms suy từ `randomValue` (0..1, do nơi gọi cấp — mặc định Math.random;
 * test truyền giá trị cố định để kết quả xác định).
 */
export function failoverBackoffMs(attempt: number, randomValue: number = Math.random()): number {
  const a = typeof attempt === 'number' && isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  const base = Math.min(FAILOVER_BACKOFF_CAP_MS, 600 * Math.pow(2, Math.min(a, 4)));
  const r =
    typeof randomValue === 'number' && isFinite(randomValue)
      ? Math.min(1, Math.max(0, randomValue))
      : 0;
  return base + Math.floor(r * FAILOVER_BACKOFF_JITTER_MS);
}
