import React, { useState, useEffect } from 'react';

interface BuyMeCoffeeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BuyMeCoffeeModal: React.FC<BuyMeCoffeeModalProps> = ({ isOpen, onClose }) => {
  const [amount, setAmount] = useState<number>(20000);
  const [customAmountStr, setCustomAmountStr] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentAmount = isCustom ? (parseInt(customAmountStr.replace(/\D/g, ''), 10) || 0) : amount;
  const qrUrl = `https://img.vietqr.io/image/VBA-7302215005734-compact2.png?amount=${currentAmount}&addInfo=Moi%20ca%20phe%20tac%20gia&accountName=HO%20TAN%20KHAI`;

  const copyToClipboard = (text: string, fieldName: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(6px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeInModal 0.25s ease-out'
      }}
    >
      <style>{`
        @keyframes fadeInModal {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes coffeeSteamFlow {
          0% { transform: translateY(0) scaleX(1); opacity: 0.2; }
          50% { transform: translateY(-7px) scaleX(1.2); opacity: 0.85; }
          100% { transform: translateY(-14px) scaleX(1.35); opacity: 0; }
        }
        .steam-bubble {
          display: inline-block;
          animation: coffeeSteamFlow 2s infinite ease-out;
        }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #1c1917 0%, #0c0a09 100%)',
          border: '2px solid #f59e0b',
          borderRadius: '24px',
          padding: '24px',
          maxWidth: '520px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 40px rgba(245, 158, 11, 0.25)',
          color: '#ffffff',
          position: 'relative'
        }}
      >
        {/* Nút Đóng X */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            color: '#e2e8f0',
            width: '34px',
            height: '34px',
            fontSize: '18px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          title="Đóng hộp thoại"
        >
          ✕
        </button>

        {/* Header với icon cà phê ấm áp */}
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '4px' }}>
            <span
              className="steam-bubble"
              style={{
                position: 'absolute',
                top: '-14px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '18px',
                pointerEvents: 'none'
              }}
            >
              ♨️
            </span>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #d97706, #78350f)',
                border: '2.5px solid #fde047',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                boxShadow: '0 4px 20px rgba(217, 119, 6, 0.5)',
                margin: '0 auto'
              }}
            >
              ☕
            </div>
          </div>

          <h2
            style={{
              margin: '8px 0 6px 0',
              fontSize: '21px',
              fontWeight: 900,
              background: 'linear-gradient(90deg, #fef08a, #f59e0b, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '0.3px'
            }}
          >
            MỜI TÁC GIẢ LY CÀ PHÊ
          </h2>

          <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5, padding: '0 10px' }}>
            Phần mềm <b>Đấu Trường 3D</b> được xây dựng và chia sẻ hoàn toàn <b>miễn phí</b> phục vụ cộng đồng giáo dục. Sự ủng hộ của quý thầy cô và đồng nghiệp là nguồn động lực to lớn giúp tác giả duy trì máy chủ và phát triển nhiều tính năng mới!
          </p>
        </div>

        {/* Thanh chọn nhanh số tiền */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#fde047', marginBottom: '8px', textAlign: 'center' }}>
            CHỌN MỨC ỦNG HỘ TINH THẦN:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {[
              { val: 20000, label: '20.000đ', desc: '☕ 1 Ly Cà Phê Đá' },
              { val: 50000, label: '50.000đ', desc: '☕☕ 2 Ly Cà Phê Sữa' },
              { val: 100000, label: '100.000đ', desc: '🥪 Bữa Sáng Năng Lượng' }
            ].map(tier => {
              const active = !isCustom && amount === tier.val;
              return (
                <button
                  key={tier.val}
                  type="button"
                  onClick={() => {
                    setIsCustom(false);
                    setAmount(tier.val);
                  }}
                  style={{
                    background: active
                      ? 'linear-gradient(135deg, #d97706, #b45309)'
                      : 'rgba(41, 37, 36, 0.85)',
                    border: active ? '2px solid #fef08a' : '1.5px solid #44403c',
                    borderRadius: '14px',
                    padding: '10px 6px',
                    color: active ? '#ffffff' : '#e2e8f0',
                    cursor: 'pointer',
                    boxShadow: active ? '0 4px 16px rgba(217, 119, 6, 0.45)' : 'none',
                    transform: active ? 'scale(1.03)' : 'scale(1)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontSize: '15px', fontWeight: 900, color: active ? '#fef08a' : '#f8fafc' }}>
                    {tier.label}
                  </div>
                  <div style={{ fontSize: '10.5px', marginTop: '2px', opacity: 0.9 }}>
                    {tier.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Khung Mã VietQR Động */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '14px',
            textAlign: 'center',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            marginBottom: '16px',
            border: '2px solid #f59e0b'
          }}
        >
          <img
            src={qrUrl}
            alt="Mã VietQR Mời Cà Phê Tác Giả"
            style={{
              width: '100%',
              maxWidth: '310px',
              height: 'auto',
              borderRadius: '10px',
              display: 'block',
              margin: '0 auto'
            }}
          />
          <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 800, color: '#047857' }}>
            ⚡ Quét bằng App ngân hàng bất kỳ: Tự động điền đúng STK, Tên & Số tiền {currentAmount > 0 ? `${currentAmount.toLocaleString('vi-VN')}đ` : ''}
          </div>
        </div>

        {/* Bảng thông tin chuyển khoản phụ trợ */}
        <div
          style={{
            background: 'rgba(41, 37, 36, 0.75)',
            border: '1.5px solid #57534e',
            borderRadius: '14px',
            padding: '14px',
            fontSize: '13px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#a8a29e' }}>Chủ tài khoản:</span>
            <b style={{ color: '#fef08a', fontSize: '13.5px' }}>HO TAN KHAI</b>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#a8a29e' }}>Ngân hàng:</span>
            <b style={{ color: '#ffffff' }}>Agribank (Nông nghiệp & PTNT)</b>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#a8a29e' }}>Số tài khoản:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <b style={{ color: '#38bdf8', fontSize: '15px', letterSpacing: '0.8px' }}>7302215005734</b>
              <button
                type="button"
                onClick={() => copyToClipboard('7302215005734', 'account')}
                style={{
                  background: copiedField === 'account' ? '#16a34a' : '#2563eb',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  cursor: 'pointer'
                }}
              >
                {copiedField === 'account' ? '✓ Đã chép' : 'Sao chép'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#a8a29e' }}>Nội dung:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <b style={{ color: '#4ade80' }}>Moi ca phe tac gia</b>
              <button
                type="button"
                onClick={() => copyToClipboard('Moi ca phe tac gia', 'memo')}
                style={{
                  background: copiedField === 'memo' ? '#16a34a' : '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  cursor: 'pointer'
                }}
              >
                {copiedField === 'memo' ? '✓ Đã chép' : 'Sao chép'}
              </button>
            </div>
          </div>
        </div>

        {/* Lời chúc chân thành */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '16px',
            fontSize: '12.5px',
            color: '#fef08a',
            fontStyle: 'italic',
            lineHeight: 1.4
          }}
        >
          🙏 Kính chúc quý Thầy/Cô và đồng nghiệp luôn tràn đầy nhiệt huyết, nhiều sức khỏe và gặt hái thật nhiều thành công trong sự nghiệp trồng người!
        </div>

        {/* Nút đóng */}
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#44403c',
              border: '1px solid #78716c',
              color: '#f5f5f4',
              borderRadius: '12px',
              padding: '9px 28px',
              fontSize: '13.5px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export const FloatingCoffeeButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <>
      <style>{`
        @keyframes floatCoffeeSteam {
          0% { transform: translateY(0) scaleX(1); opacity: 0.15; }
          50% { transform: translateY(-5px) scaleX(1.2); opacity: 0.8; }
          100% { transform: translateY(-10px) scaleX(1.3); opacity: 0; }
        }
        @keyframes coffeeGentlePulse {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 18px rgba(217, 119, 6, 0.45); }
          50% { transform: scale(1.03); box-shadow: 0 6px 24px rgba(245, 158, 11, 0.7); }
        }
        .btn-floating-coffee {
          animation: coffeeGentlePulse 3s infinite ease-in-out;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .btn-floating-coffee:hover {
          transform: translateY(-2px) scale(1.06) !important;
          box-shadow: 0 8px 28px rgba(245, 158, 11, 0.85) !important;
        }
        .coffee-steam-icon {
          position: absolute;
          top: -8px;
          left: 14px;
          font-size: 13px;
          pointer-events: none;
          animation: floatCoffeeSteam 2s infinite ease-out;
        }
      `}</style>

      <button
        type="button"
        className="btn-floating-coffee"
        onClick={onClick}
        title="Bấm để mời tác giả Hồ Tấn Khải một ly cà phê qua VietQR Agribank"
        style={{
          position: 'fixed',
          bottom: '86px',
          right: '18px',
          zIndex: 800,
          background: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)',
          border: '2px solid #fef08a',
          borderRadius: '999px',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          color: '#ffffff',
          fontWeight: 900,
          fontSize: '13px'
        }}
      >
        <span className="coffee-steam-icon">♨️</span>
        <span style={{ fontSize: '18px', lineHeight: 1 }}>☕</span>
        <span style={{ color: '#fef08a', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
          Mời Tác Giả Ly Cà Phê
        </span>
      </button>
    </>
  );
};
