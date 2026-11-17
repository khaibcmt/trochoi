/**
 * GOM CẬP NHẬT HIỆN DIỆN PHÍA HOST (sửa sự cố "máy chủ chết khi 41 HS", 17/11/2026).
 *
 * Vấn đề: trước đây mỗi lần gỡ cờ "mất kết nối" (prologue dấu hiệu sống, handler
 * PLAYER_PING, handler RESYNC_REQUEST) đều gọi setMatchState RIÊNG — một chùm
 * tin từ nhiều HS vừa bị cờ cùng lúc (sau một nhịp mạng chập chờn) tạo một chùm
 * render toàn bộ màn host, đúng lúc luồng JS đang cần xử lý tin tồn đọng.
 *
 * Cơ chế ở đây (logic thuần, không React): hàng đợi vá hiện diện theo id —
 * nhiều vá cho cùng một HS được gộp (vá sau thắng từng trường). App giữ hàng
 * đợi trong ref và xả theo hai đường:
 *  - XẢ ĐỊNH KỲ: tối đa 1 lần / PRESENCE_FLUSH_INTERVAL_MS (500ms → ≤2 lần/s),
 *    do một interval 500ms trong App đảm nhiệm khi hàng đợi không rỗng.
 *  - XẢ NGAY: mọi tin gameplay (đáp án, vào phòng, resync…) gọi xả ngay trước
 *    khi xử lý — vá hiện diện đi cùng nhịp render của chính tin đó, không thêm
 *    render riêng.
 * Vòng quét giữ chỗ KHÔNG đi qua hàng đợi này (nó chạy 5s/lần và là trọng tài
 * bật cờ/giải phóng chỗ — xả ngay như cũ).
 *
 * lastSeen thật vẫn ghi thẳng vào lastSeenByIdRef ngay khi tin tới (không qua
 * hàng đợi) — hàng đợi chỉ chứa phần HIỂN THỊ (cờ offline + lastSeen hiển thị
 * trên bản ghi), nên vòng quét luôn đọc số tươi nhất bất kể vá đã xả hay chưa.
 */

import type { Player } from '../types';

export interface PresencePatch {
  offline?: boolean;
  lastSeen?: number;
}

/** Chu kỳ xả định kỳ: 500ms → tối đa 2 lần xả/giây. */
export const PRESENCE_FLUSH_INTERVAL_MS = 500;

export interface PresencePatchQueue {
  enqueue: (id: string, patch: PresencePatch) => void;
  drain: () => Map<string, PresencePatch>;
  size: () => number;
  isEmpty: () => boolean;
}

/** Tạo hàng đợi vá hiện diện: gộp theo id, trường nào vá sau có giá trị thì thắng. */
export function createPresencePatchQueue(): PresencePatchQueue {
  const pending = new Map<string, PresencePatch>();
  return {
    enqueue(id: string, patch: PresencePatch) {
      if (!id || !patch) return;
      const prev = pending.get(id);
      if (!prev) {
        pending.set(id, { ...patch });
        return;
      }
      if (typeof patch.offline === 'boolean') prev.offline = patch.offline;
      if (typeof patch.lastSeen === 'number') prev.lastSeen = patch.lastSeen;
    },
    drain() {
      const out = new Map(pending);
      pending.clear();
      return out;
    },
    size() {
      return pending.size;
    },
    isEmpty() {
      return pending.size === 0;
    }
  };
}

/**
 * Áp một lô vá hiện diện lên hai mảng roster. Trả về mảng MỚI chỉ cho phía nào
 * thật sự có bản ghi thay đổi; phía không đổi giữ nguyên tham chiếu để React
 * bỏ qua. `changed=false` → nơi gọi bỏ qua setState hoàn toàn.
 * Vá cho id không có trong roster bị bỏ qua lặng lẽ (HS đã rời phòng thật).
 */
export function applyPresencePatches(
  redPlayers: Player[],
  bluePlayers: Player[],
  patches: Map<string, PresencePatch>
): { redPlayers: Player[]; bluePlayers: Player[]; changed: boolean } {
  if (!patches || patches.size === 0) {
    return { redPlayers, bluePlayers, changed: false };
  }
  let changed = false;
  const applyList = (list: Player[]): Player[] => {
    let listChanged = false;
    const next = list.map(p => {
      const patch = patches.get(p.id);
      if (!patch) return p;
      const nextOffline = typeof patch.offline === 'boolean' ? patch.offline : p.offline;
      const nextLastSeen = typeof patch.lastSeen === 'number' ? patch.lastSeen : p.lastSeen;
      if (nextOffline === p.offline && nextLastSeen === p.lastSeen) return p;
      listChanged = true;
      return { ...p, offline: nextOffline, lastSeen: nextLastSeen };
    });
    if (listChanged) changed = true;
    return listChanged ? next : list;
  };
  const nextRed = applyList(redPlayers);
  const nextBlue = applyList(bluePlayers);
  return { redPlayers: nextRed, bluePlayers: nextBlue, changed };
}
