// Màu TÊN học sinh trên các bảng xếp hạng theo NHÓM HẠNG (thầy Khải chốt 12:28, 17/11/2026):
// - Hạng 1: vàng, hạng 2: bạc/trắng sáng, hạng 3: đồng/cam đồng (Top 3 nổi bật nhất)
// - Hạng 4-6 (Top 6): xanh ngọc sáng
// - Hạng 7-10 (Top 10): tím sáng
// - Ngoài Top 10: trắng mặc định
// Panel BXH trực tiếp phía host (.flb-name trong index.css) dùng đúng bảng màu này qua CSS.
export function rankNameColor(rank: number): string {
  if (rank === 1) return '#fef08a';
  if (rank === 2) return '#ffffff';
  if (rank === 3) return '#fdba74';
  if (rank <= 6) return '#2dd4bf';
  if (rank <= 10) return '#c084fc';
  return '#ffffff';
}
