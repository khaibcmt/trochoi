// Màu TÊN học sinh trên các bảng xếp hạng theo NHÓM HẠNG (thầy Khải chốt 12:28, 17/11/2026):
// - Top 3: ĐỎ nổi bật (thầy Khải chốt 12:38, 17/11/2026) — hạng 1 đỏ tươi nhất, hạng 2-3 nhạt dần rất nhẹ cùng tông đỏ
// - Hạng 4-6 (Top 6): xanh ngọc sáng
// - Hạng 7-10 (Top 10): tím sáng
// - Ngoài Top 10: trắng mặc định
// Panel BXH trực tiếp phía host (.flb-name trong index.css) dùng đúng bảng màu này qua CSS.
export function rankNameColor(rank: number): string {
  if (rank === 1) return '#ff2d2d';
  if (rank === 2) return '#ff4545';
  if (rank === 3) return '#ff6b6b';
  if (rank <= 6) return '#2dd4bf';
  if (rank <= 10) return '#c084fc';
  return '#ffffff';
}
