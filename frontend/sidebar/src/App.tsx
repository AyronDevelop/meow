import React, { useState, useCallback } from 'react';
import { useFileUpload } from './hooks/useFileUpload';
import { useProcessing } from './hooks/useProcessing';
import { DropZone } from './components/DropZone';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ARIA_LABELS } from './constants';
import type { AppError } from './types';
import { useToast } from './components/ToastProvider';

export const App: React.FC = () => {
  const [debug, setDebug] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const { notify } = useToast();

  const handleLog = useCallback((message: string) => {
    setLogs(prev => [...prev, message].slice(-500));
  }, []);

  const handleError = useCallback((error: AppError) => {
    console.error('Application error:', error);
    notify(`Error: ${error.message}`, 'error');
  }, []);

  const {
    fileInfo,
    dragActive,
    removeFile,
    openFileDialog,
    getSelectedFile,
    dragHandlers,
    inputProps,
  } = useFileUpload({ onError: handleError });

  const { state, processFile, reset, isProcessing } = useProcessing({
    onLog: debug ? handleLog : undefined,
    onError: handleError,
  });

  const handleStart = useCallback(async () => {
    const file = getSelectedFile();
    if (!file) {
      alert('Please select a PDF file');
      return;
    }
    await processFile(file);
  }, [getSelectedFile, processFile]);

  const handleReset = useCallback(() => {
    reset();
    removeFile();
    setLogs([]);
  }, [reset, removeFile]);

  return (
    <>
      <main className="fade-in">
        <header className="hero">
          <div className="hero-icon" role="img" aria-label="PDF to Slides application icon" />
          <h1 className="hero-title">PDF to Slides</h1>
          <p className="hero-subtitle">Transform your documents into beautiful presentations</p>
        </header>

        <section className="main-card">
          <input {...inputProps} disabled={isProcessing} />
          
          <DropZone
            fileInfo={fileInfo}
            dragActive={dragActive}
            disabled={isProcessing}
            onRemoveFile={removeFile}
            onOpenDialog={openFileDialog}
            dragHandlers={dragHandlers}
          />
          
          <div className="actions-row">
            <button 
              className="btn btn-primary" 
              onClick={handleStart} 
              disabled={isProcessing || !fileInfo}
              type="button"
              aria-label={ARIA_LABELS.UPLOAD_BUTTON}
            >
              Generate Slides
            </button>
            <button 
              className="btn btn--ghost" 
              onClick={handleReset} 
              disabled={isProcessing}
              type="button"
              aria-label={ARIA_LABELS.RESET_BUTTON}
            >
              Reset
            </button>
          </div>
        </section>

        {debug && (
          <section className="card">
            <div className="row">
              <label className="muted" htmlFor="activity-log">Activity</label>
              <div 
                id="activity-log"
                className="log" 
                role="log"
                aria-live="polite"
                aria-label={ARIA_LABELS.ACTIVITY_LOG}
              >
                {logs.join('\n')}
              </div>
            </div>
          </section>
        )}

        <footer style={{ display: 'flex', justifyContent: 'center', paddingTop: '12px' }}>
          <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input 
              type="checkbox" 
              checked={debug} 
              onChange={(e) => setDebug(e.target.checked)}
              aria-label={ARIA_LABELS.DEBUG_TOGGLE}
            /> 
            Debug
          </label>
        </footer>
      </main>

      <LoadingOverlay state={state} />
    </>
  );
};


