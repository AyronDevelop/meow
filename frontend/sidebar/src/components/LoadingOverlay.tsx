import React from 'react';
import type { ProcessingState } from '../types';
import { PHASE_MESSAGES } from '../constants';

interface LoadingOverlayProps {
  readonly state: ProcessingState;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ state }) => {
  if (!state.busy) return null;
  
  const { title, subtitle } = PHASE_MESSAGES[state.phase];

  return (
    <div className="loading-overlay" role="dialog" aria-modal="true" aria-labelledby="loading-title">
      <div className="loading-content">
        <div 
          className="loading-spinner-large" 
          role="progressbar" 
          aria-label="Processing in progress"
        />
        <div id="loading-title" className="loading-title">
          {title}
        </div>
        <div className="loading-progress" role="progressbar" aria-valuenow={state.progress || 0} aria-valuemin={0} aria-valuemax={100}>
          <div 
            className="loading-progress-bar" 
            style={{ width: `${state.progress || 0}%` }} 
          />
        </div>
        <div className="loading-phase" aria-live="polite">
          {subtitle}
        </div>
      </div>
    </div>
  );
};
