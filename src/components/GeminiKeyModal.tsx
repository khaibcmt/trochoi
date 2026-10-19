import React, { useState, useEffect } from 'react';
import { getStoredGeminiKey, saveStoredGeminiKey, removeStoredGeminiKey } from '../services/geminiClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved?: (key: string) => void;
}

export const GeminiKeyModal: React.FC<Props> = ({ isOpen, onClose, onKeySaved }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = getStoredGeminiKey();
      setApiKey(current);
      setHasStoredKey(!!current);
      setToastMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      alert('Vui lòng dán Google Gemini API Key!');
      return;
    }
    saveStoredGeminiKey(trimmed);
    setHasStoredKey(true);
    setToastMsg('✅ Đã lưu Google Gemini API Key thành công vào trình duyệt!');
    if (onKeySaved) onKeySaved(trimmed);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleClear = () => {
    if (confirm('Bạn có chắc muốn xóa API Key đã lưu?')) {
      removeStoredGeminiKey();
      setApiKey('');
      setHasStoredKey(false);
      setToastMsg('🗑️ Đã xóa API Key!');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0f172a',
          border: '2px solid #6366f1',
          borderRadius: '20px',
          padding: '24px',
          maxWidth: '540px',
          width: '100%',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
          color: '#ffffff',
          boxSizing: 'border-box',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '12px', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#fef08a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚙️ Cấu Hình Google Gemini API Key
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 14px 0' }}>
          Để sử dụng các tính năng <b>AI Soạn Đề Thông Minh</b> và <b>AI Tutor Giải Thích Trực Tiếp</b> trên GitHub Pages (không cần backend), giáo viên chỉ cần dán Google Gemini API Key của mình vào đây. Key sẽ được <b>lưu cục bộ trên trình duyệt (localStorage)</b> và không bao giờ bị mất khi tải lại trang.
        </p>

        {hasStoredKey && (
          <div style={{ background: '#064e3b', border: '1px solid #10b981', borderRadius: '10px', padding: '8px 12px', marginBottom: '14px', fontSize: '12.5px', color: '#a7f3d0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🟢</span>
            <span>Trình duyệt đã lưu API Key của Thầy/Cô. Các tính năng AI đang sẵn sàng!</span>
          </div>
        )}

        {toastMsg && (
          <div style={{ background: '#1e1b4b', border: '1px solid #818cf8', borderRadius: '10px', padding: '8px 12px', marginBottom: '14px', fontSize: '13px', color: '#fef08a', textAlign: 'center', fontWeight: 800 }}>
            {toastMsg}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#f8fafc', marginBottom: '6px' }}>
            Google Gemini API Key:
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="Dán API Key (bắt đầu bằng AIzaSy...)"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              style={{
                flex: 1,
                padding: '11px 14px',
                borderRadius: '10px',
                border: '1.5px solid #475569',
                background: '#1e293b',
                color: '#ffffff',
                fontSize: '14px',
                fontFamily: 'monospace',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              style={{
                padding: '0 14px',
                borderRadius: '10px',
                border: '1px solid #475569',
                background: '#334155',
                color: '#e2e8f0',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 800,
              }}
            >
              {showKey ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
        </div>

        <div style={{ background: '#1e293b', borderRadius: '12px', padding: '12px', marginBottom: '18px', border: '1px dashed #475569' }}>
          <div style={{ fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.5 }}>
            👉 <b>Chưa có API Key?</b> Thầy/Cô có thể tạo miễn phí trong 30 giây tại:{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#38bdf8', fontWeight: 900, textDecoration: 'underline' }}
            >
              Google AI Studio (aistudio.google.com)
            </a>
            <br />
            💡 <i>Ghi chú: Nếu không nhập Key, hệ thống vẫn tự động chuyển sang chế độ mẫu dự phòng (offline fallback) để lớp học không bị gián đoạn.</i>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {hasStoredKey && (
              <button
                type="button"
                onClick={handleClear}
                style={{
                  background: '#7f1d1d',
                  border: '1px solid #f87171',
                  color: '#fecaca',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                🗑️ Xóa Key
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#334155',
                border: '1px solid #64748b',
                color: '#cbd5e1',
                padding: '9px 18px',
                borderRadius: '10px',
                fontSize: '13.5px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
                border: '1.5px solid #818cf8',
                color: '#ffffff',
                padding: '9px 20px',
                borderRadius: '10px',
                fontSize: '13.5px',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
              }}
            >
              💾 Lưu API Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
