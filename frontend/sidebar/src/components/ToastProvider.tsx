import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastType = 'info' | 'success' | 'error' | 'warning';

interface Toast {
  readonly id: number;
  readonly type: ToastType;
  readonly message: string;
}

interface ToastContextValue {
  readonly notify: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, type: ToastType = 'info') => {
    setToasts((prev) => {
      const id = (prev[prev.length - 1]?.id ?? 0) + 1;
      return [...prev, { id, type, message }];
    });

    setTimeout(() => setToasts((prev) => prev.slice(1)), 5000);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div 
        aria-live="assertive" 
        aria-atomic="true" 
        style={{ position: 'fixed', right: 12, bottom: 12, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999 }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`toast toast--${t.type}`}
            style={{
              minWidth: 240,
              maxWidth: 420,
              background: '#222',
              color: '#fff',
              borderRadius: 6,
              padding: '10px 12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};


