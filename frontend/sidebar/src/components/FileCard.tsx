import React from 'react';
import type { FileInfo } from '../types';
import { formatFileSize } from '../utils';
import { ARIA_LABELS } from '../constants';

interface FileCardProps {
  readonly fileInfo: FileInfo;
  readonly onRemove: () => void;
  readonly disabled?: boolean;
}

export const FileCard: React.FC<FileCardProps> = ({ 
  fileInfo, 
  onRemove, 
  disabled = false 
}) => {
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };

  return (
    <div className="filecard fade-in" role="group" aria-label={`Selected file: ${fileInfo.name}`}>
      <div className="fileicon" aria-hidden="true" />
      <div style={{ flex: 1 }}>
        <div className="filename" title={fileInfo.name}>
          {fileInfo.name}
        </div>
        <div className="filesize">
          {formatFileSize(fileInfo.size)}
        </div>
      </div>
      <button 
        className="btn--ghost" 
        style={{ padding: '4px 8px', fontSize: '11px', minHeight: 'auto' }}
        onClick={handleRemove}
        disabled={disabled}
        type="button"
        aria-label={ARIA_LABELS.REMOVE_FILE}
        title="Remove file"
      >
        ✕
      </button>
    </div>
  );
};
