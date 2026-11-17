/**
 * QUAY THƯỞNG RƯƠNG BÍ ẨN ĐỊNH MỆNH THEO CHẾ ĐỘ CHƠI (thầy chốt 17/11/2026).
 *
 * Luật cũ: 1 lần Math.random() chia 4 dải đều 25% ở MỌI mode — 💖 Tim Vàng
 * (+1 mạng hồi sinh) rớt cả ở Đua Tốc Độ / Diệt Boss / Kéo Co, nơi "mạng"
 * vô nghĩa (host chỉ áp mạng ở BELL). Thầy chốt:
 *  - BELL (Rung Chuông Vàng): giữ nguyên pool 4 vật phẩm × 25%.
 *  - FAST / BOSS / TUG: pool CHỈ 3 vật phẩm (💎 Nổ Hũ Kim Cương, 🥷 Đạo
 *    Chích, 🛡️ Khiên Bất Tử), chia đều mỗi món 1/3 — KHÔNG bao giờ ra 💖.
 *
 * Hàm thuần nhận sẵn số ngẫu nhiên roll ∈ [0,1) để test quét được toàn dải.
 */

export type ChestRewardId = 'DIAMOND' | 'STEAL' | 'HEART' | 'SHIELD';

export interface ChestRewardDef {
  id: ChestRewardId;
  icon: string;
  /** Điểm thưởng cộng ngay khi mở trúng. */
  bonusDelta: number;
}

/** Định nghĩa 4 vật phẩm rương (điểm thưởng khớp luật hiện hành). */
export const CHEST_REWARDS: Record<ChestRewardId, ChestRewardDef> = {
  DIAMOND: { id: 'DIAMOND', icon: '💎', bonusDelta: 1500 },
  STEAL: { id: 'STEAL', icon: '🥷', bonusDelta: 900 },
  HEART: { id: 'HEART', icon: '💖', bonusDelta: 500 },
  SHIELD: { id: 'SHIELD', icon: '🛡️', bonusDelta: 300 }
};

/** Pool vật phẩm theo mode: BELL đủ 4; mode khác chỉ 3 (không Tim Vàng). */
export function chestPoolForGameType(gameType: string): ChestRewardId[] {
  return gameType === 'BELL'
    ? ['DIAMOND', 'STEAL', 'HEART', 'SHIELD']
    : ['DIAMOND', 'STEAL', 'SHIELD'];
}

/**
 * Quay thưởng (thuần): roll ∈ [0,1) chia đều theo pool của mode.
 * BELL: 4 dải × 0,25 (💖 đúng dải [0,5; 0,75) như luật gốc).
 * Mode khác: 3 dải × 1/3, không có 💖 ở bất kỳ dải nào.
 */
export function rollChestReward(gameType: string, roll: number): ChestRewardDef {
  const pool = chestPoolForGameType(gameType);
  const r = Math.min(Math.max(0, roll || 0), 0.999999999);
  const idx = Math.min(pool.length - 1, Math.floor(r * pool.length));
  return CHEST_REWARDS[pool[idx]];
}
