import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Mã bản dựng sinh TỰ ĐỘNG theo thời điểm build (giờ Việt Nam UTC+7), dạng
// "BẢN 17/11-14:03" — hiển thị trên giao diện host + học sinh để mọi ảnh chụp
// màn hình tự cho biết đang chạy bản nào (phục vụ chẩn đoán sự cố lớp thật).
const buildNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
const pad2 = (n: number) => String(n).padStart(2, '0');
const BUILD_TAG = `BẢN ${pad2(buildNow.getUTCDate())}/${pad2(buildNow.getUTCMonth() + 1)}-${pad2(buildNow.getUTCHours())}:${pad2(buildNow.getUTCMinutes())}`;

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/trochoi/' : '/',
  define: {
    __BUILD_TAG__: JSON.stringify(BUILD_TAG),
  },
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: false,
  },
});
