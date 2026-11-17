/**
 * Nhãn phiên bản bản dựng hiển thị trên giao diện (host + học sinh).
 * Giá trị do Vite define __BUILD_TAG__ sinh tự động theo thời điểm build
 * (giờ Việt Nam), dạng "BẢN 17/11-14:03" — mỗi lần build ra một mã khác nhau,
 * giúp ảnh chụp màn hình tự cho biết tab đang chạy bundle cũ hay mới.
 * Khi chạy ngoài Vite build (dev/test) thì dùng nhãn dự phòng "BẢN DEV".
 */
export const BUILD_TAG: string =
  typeof __BUILD_TAG__ !== 'undefined' && __BUILD_TAG__ ? __BUILD_TAG__ : 'BẢN DEV';
