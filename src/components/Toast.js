import React, { useEffect } from 'react';

export default function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div onClick={onDismiss} style={{
      position: 'fixed', bottom: '1.5rem', right: '1.5rem',
      background: type === 'success' ? '#238636' : '#da3633',
      color: '#fff', padding: '12px 16px', borderRadius: 8,
      fontSize: '.85rem', maxWidth: 340, lineHeight: 1.4,
      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      zIndex: 2000, cursor: 'pointer',
      animation: 'slideIn .2s ease-out',
    }}>
      <style>{`@keyframes slideIn { from{transform:translateY(10px);opacity:0} to{transform:translateY(0);opacity:1} }`}</style>
      {message}
    </div>
  );
}
