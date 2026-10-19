import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface Props {
  isOpen: boolean;
  title: string;
  roomId: string;
  targetUrl: string;
  themeColor?: string;
  onClose: () => void;
}

export const QRZoomModal: React.FC<Props> = ({
  isOpen,
  title,
  roomId,
  targetUrl,
  themeColor = '#f59e0b',
  onClose
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (isOpen && targetUrl) {
      QRCode.toDataURL(targetUrl, { width: 320, margin: 1, errorCorrectionLevel: 'L' })
        .then(url => setQrDataUrl(url))
        .catch(() => {});
    }
  }, [isOpen, targetUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(targetUrl).then(() => {
        alert("✅ Đã sao chép đường dẫn! Thầy có thể gửi vào nhóm Zalo lớp cho học sinh bấm vào chơi ngay.");
      }).catch(() => {
        prompt("Sao chép đường dẫn dưới đây:", targetUrl);
      });
    } else {
      prompt("Sao chép đường dẫn dưới đây:", targetUrl);
    }
  };

  return (
    <div id="qr-zoom-modal" style={{ display: 'flex' }} onClick={onClose}>
      <div className="qr-zoom-card" onClick={e => e.stopPropagation()}>
        <h2 id="qr-zoom-title" style={{ margin: 0, fontSize: '26px', fontWeight: 900, color: themeColor }}>
          {title}
        </h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '15px', fontWeight: 800, color: '#334155' }}>
          Mã Phòng: {roomId}
        </p>

        <div id="qr-zoom-render">
          {qrDataUrl && <img src={qrDataUrl} alt="Mã QR phóng to" style={{ display: 'block', margin: '0 auto', imageRendering: 'pixelated', width: 280, height: 280 }} />}
        </div>

        <div style={{ fontSize: '12.5px', color: '#64748b', wordBreak: 'break-all', maxWidth: '400px', margin: '4px auto 14px auto', fontWeight: 700 }}>
          {targetUrl}
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button className="btn-launch" style={{ background: '#10b981', padding: '9px 20px', fontSize: '14px' }} onClick={handleCopy}>
            📋 Sao chép Link gửi Zalo
          </button>
          <button className="btn-launch" style={{ background: '#ef4444', padding: '9px 20px', fontSize: '14px' }} onClick={onClose}>
            ✖ Đóng lại
          </button>
        </div>
      </div>
    </div>
  );
};
