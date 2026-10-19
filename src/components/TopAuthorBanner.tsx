import React from 'react';

interface Props {
  onToggleFullScreen: () => void;
  onOpenKeyModal?: () => void;
}

export const TopAuthorBanner: React.FC<Props> = ({ onToggleFullScreen, onOpenKeyModal }) => {
  return (
    <header id="top-author-banner">
      <div className="brand-left">
        <svg className="game-logo-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M32 4L8 14V30C8 46.5 18.2 57.6 32 62C45.8 57.6 56 46.5 56 30V14L32 4Z" fill="url(#shieldGrad)" stroke="#FEF08A" strokeWidth="3" />
          <path d="M14 32H50" stroke="#F59E0B" strokeWidth="5" strokeLinecap="round" />
          <circle cx="32" cy="32" r="7" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2.5" />
          <path d="M32 11L35 18H42L36.5 22.5L38.5 29.5L32 25L25.5 29.5L27.5 22.5L22 18H29L32 11Z" fill="#FEF08A" />
          <defs>
            <linearGradient id="shieldGrad" x1="8" y1="4" x2="56" y2="62" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0284C7" />
              <stop offset="0.5" stopColor="#1E1B4B" />
              <stop offset="1" stopColor="#E11D48" />
            </linearGradient>
          </defs>
        </svg>
        <h1 className="brand-title">ĐẤU TRƯỜNG 3D: KÉO CO • RUNG CHUÔNG VÀNG • AI NHANH NHẤT</h1>
      </div>
      <div className="author-right">
        <button
          className="btn-fullscreen-top"
          onClick={onOpenKeyModal}
          title="Cài đặt Google Gemini API Key"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #4338ca)', color: '#ffffff', borderColor: '#818cf8', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          ⚙️ Cài đặt AI Key
        </button>
        <span className="author-badge">👨‍🏫 Tác giả: Hồ Tấn Khải</span>
        <span className="school-badge">🏫 Trường THPT Mang Thít</span>
        <button className="btn-fullscreen-top" onClick={onToggleFullScreen} title="Phóng toàn màn hình">
          🔲 Toàn màn hình
        </button>
      </div>
    </header>
  );
};
