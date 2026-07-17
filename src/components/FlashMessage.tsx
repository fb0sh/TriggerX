import { useEffect, useRef } from 'react';

interface Props {
  message: string | null;
  onClose: () => void;
}

export function FlashMessage({ message, onClose }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (message) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(onClose, 3000);
    }
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [message, onClose]);

  if (!message) return null;

  const isFailure = message.includes('失败');

  return (
    <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 9999, maxWidth: 400 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
        borderRadius: 8, fontSize: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        backgroundColor: isFailure
          ? 'var(--bgColor-danger-emphasis, #cf222e)'
          : 'var(--bgColor-success-emphasis, #1a7f37)',
        color: '#fff',
      }}>
        <span style={{ flex: 1 }}>{message}</span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: 'inherit',
            cursor: 'pointer', padding: '0 0 0 8px', fontSize: 18, lineHeight: 1, opacity: 0.7,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
