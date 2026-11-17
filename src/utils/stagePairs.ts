/**
 * XẾP CẶP SÂN KHẤU 3D PHÍA HOST (thầy Khải chốt 17/11/2026):
 * nhân vật trên sàn đứng thành TỪNG CẶP — hai em liên tiếp trong thứ tự
 * xếp hạng đứng SÁT nhau, khoảng cách GIỮA các cặp lớn hơn rõ rệt.
 *
 * File này CHỈ chứa toán vị trí thuần (không THREE, không React) để test
 * độc lập được. Logic chọn người lên sàn / thứ hạng / điểm KHÔNG nằm ở đây
 * — vẫn ở HostArenaView (cổng stageTopIds + effect dựng 3D như cũ).
 *
 * Áp dụng:
 *  - FAST (Ai Nhanh Nhất): hàng ngang theo cặp (pairedCenteredOffsets).
 *  - BOSS (Diệt Boss): vòng cung theo cặp (bossPairAngle — cặp dọc cung).
 *  - TUG (Kéo Co): mỗi đội xếp cặp dọc theo dây (tugPairDistance +
 *    tugPairZ — hai em cùng cặp đứng cùng phía z của dây).
 *  - BELL (Rung Chuông Vàng): GIỮ NGUYÊN vòng tròn đồng tâm ngồi trên
 *    sân khấu 3 tầng — bố cục đặc thù, không xếp cặp (xem HostArenaView).
 */

/**
 * Offset (chưa căn giữa) của phần tử thứ k trong một hàng xếp cặp:
 * cặp p = floor(k/2) bắt đầu tại p*(intra + inter), em thứ hai của cặp
 * lệch thêm intra. Em cuối lẻ (count lẻ) đứng một mình thành "cặp đơn".
 */
export function pairedOffsetAt(k: number, intraGap: number, interGap: number): number {
  const pairIdx = Math.floor(k / 2);
  const within = k % 2;
  return pairIdx * (intraGap + interGap) + within * intraGap;
}

/** Toàn bộ offset của một hàng `count` phần tử, đã căn giữa quanh 0. */
export function pairedCenteredOffsets(count: number, intraGap: number, interGap: number): number[] {
  if (count <= 0) return [];
  const raw: number[] = [];
  for (let k = 0; k < count; k++) raw.push(pairedOffsetAt(k, intraGap, interGap));
  const span = raw[count - 1];
  return raw.map(v => v - span / 2);
}

// ---------------------------------------------------------------- FAST ---
// Bước cơ sở cũ của hàng FAST là spacingX = 1.95 (6 em/hàng, bề rộng 9.75).
// Khe trong cặp 1.0 ≈ 0.51× bước cơ sở; khe giữa cặp 2.9 ≈ 1.49× bước cơ sở.
// Hàng 6 em = 3 cặp: bề rộng 3×1.0 + 2×2.9 = 8.8 < 9.75 cũ → vẫn gọn trong
// sàn (sàn rộng ±16, khung hình host thấy thoải mái ±5.5 quanh tâm).
export const FAST_PAIR_INTRA_GAP = 1.0;
export const FAST_PAIR_INTER_GAP = 2.9;

/** Toạ độ x của em thứ `col` trong một hàng FAST có `countInRow` em. */
export function fastPairX(col: number, countInRow: number): number {
  return pairedCenteredOffsets(countInRow, FAST_PAIR_INTRA_GAP, FAST_PAIR_INTER_GAP)[col];
}

// ---------------------------------------------------------------- BOSS ---
// Vòng cung cũ: 10 em trải đều trên cung 1.36π (bước góc ≈ 0.474 rad,
// dây cung ≈ 2.72 ở bán kính 5.8). Xếp cặp theo GÓC: khe trong cặp
// 0.21 rad (dây ≈ 1.21), khe giữa cặp 0.64 rad (dây ≈ 3.65).
// Cung 10 em = 5 cặp: tổng 5×0.21 + 4×0.64 = 3.61 rad < 4.27 rad cũ →
// vẫn gọn trong cung cũ, không tràn hai đầu cung.
export const BOSS_PAIR_INTRA_ANGLE = 0.21;
export const BOSS_PAIR_INTER_ANGLE = 0.64;

/** Góc đứng của em thứ `posInRing` trong một vòng BOSS có `countInRing` em. */
export function bossPairAngle(posInRing: number, countInRing: number): number {
  return pairedCenteredOffsets(countInRing, BOSS_PAIR_INTRA_ANGLE, BOSS_PAIR_INTER_ANGLE)[posInRing];
}

// ----------------------------------------------------------------- TUG ---
// Bước cơ sở cũ dọc dây là 1.32. Khe trong cặp 0.85 ≈ 0.64× bước cơ sở
// (nhân vật kéo co xoay ngang nên bề ngang dọc dây hẹp hơn, 0.85 không
// chồng nhau); khe giữa cặp 2.0 ≈ 1.52× bước cơ sở.
// Đội 5 em (mặc định max3D=10 → mỗi đội 5): xa nhất 1.55 + (2×(0.85+2.0)
// + 0) = em cuối ở |x| = 1.55 + 5.7 = 7.25 < 9.5 (nửa chiều dài dây) và
// < 16 (mép sàn) → gọn.
export const TUG_PAIR_INTRA_GAP = 0.85;
export const TUG_PAIR_INTER_GAP = 2.0;
/** Neo dây: em đầu mỗi đội đứng cách tâm 1.55 như thiết kế cũ. */
export const TUG_PAIR_ANCHOR = 1.55;

/** Khoảng cách từ neo của em thứ `col` trong đội kéo co (chưa cộng neo). */
export function tugPairDistance(col: number): number {
  return pairedOffsetAt(col, TUG_PAIR_INTRA_GAP, TUG_PAIR_INTER_GAP);
}

/**
 * Độ lệch z so với dây của em thứ `col` ở hàng `row`: hai em CÙNG CẶP
 * đứng cùng một phía z (cặp đọc rõ thành cặp), các cặp kề nhau đổi phía
 * như nhịp zigzag cũ. Hàng 0 sát dây (±0.36), hàng sau xa hơn (±1.25)
 * — đúng hai mức z của thiết kế cũ.
 */
export function tugPairZ(row: number, col: number): number {
  const pairIdx = Math.floor(col / 2);
  const side = pairIdx % 2 === 0 ? 1 : -1;
  return row === 0 ? side * 0.36 : side * 1.25;
}
