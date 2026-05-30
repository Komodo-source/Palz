import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import AnimatedSnackbar from '@/components/AnimatedSnackbar';

const SnackbarContext = createContext(undefined);

let snackbarId = 0;

export function SnackbarProvider({ children }) {
  const [snackbars, setSnackbars] = useState([]);
  const timersRef = useRef({});

  const showSnackbar = useCallback((message, variant = 'default', duration = 3000) => {
    const id = ++snackbarId;
    setSnackbars((prev) => [...prev, { id, message, variant, duration }]);
    return id;
  }, []);

  const dismissSnackbar = useCallback((id) => {
    setSnackbars((prev) => prev.filter((s) => s.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const success = useCallback((msg, dur) => showSnackbar(msg, 'success', dur), [showSnackbar]);
  const error = useCallback((msg, dur) => showSnackbar(msg, 'error', dur), [showSnackbar]);
  const info = useCallback((msg, dur) => showSnackbar(msg, 'info', dur), [showSnackbar]);
  const warning = useCallback((msg, dur) => showSnackbar(msg, 'warning', dur), [showSnackbar]);
  const like = useCallback((msg, dur) => showSnackbar(msg, 'like', dur), [showSnackbar]);

  return (
    <SnackbarContext.Provider value={{ showSnackbar, dismissSnackbar, success, error, info, warning, like }}>
      {children}
      {snackbars.map((s) => (
        <AnimatedSnackbar
          key={s.id}
          message={s.message}
          variant={s.variant}
          duration={s.duration}
          onDismiss={() => dismissSnackbar(s.id)}
        />
      ))}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return context;
}
