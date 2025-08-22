import React from 'react';
import type { FileInfo } from '../types';
import { FileCard } from './FileCard';
import { ARIA_LABELS } from '../constants';

interface DropZoneProps {
  readonly fileInfo: FileInfo | null;
  readonly dragActive: boolean;
  readonly disabled?: boolean;
  readonly onRemoveFile: () => void;
  readonly onOpenDialog: () => void;
  readonly dragHandlers: {
    readonly onDragOver: (e: React.DragEvent) => void;
    readonly onDragLeave: (e: React.DragEvent) => void;
    readonly onDrop: (e: React.DragEvent) => void;
  };
}

export const DropZone: React.FC<DropZoneProps> = ({
  fileInfo,
  dragActive,
  disabled = false,
  onRemoveFile,
  onOpenDialog,
  dragHandlers,
}) => {
  const handleClick = () => {
    if (!disabled) {
      onOpenDialog();
    }
  };

  const dropZoneClass = `dropzone${dragActive ? ' dropzone--active' : ''}`;

  return (
    <div 
      className={dropZoneClass}
      onClick={handleClick}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          onOpenDialog();
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ARIA_LABELS.DROP_ZONE}
      aria-disabled={disabled}
      {...dragHandlers}
    >
      {fileInfo ? (
        <FileCard 
          fileInfo={fileInfo} 
          onRemove={onRemoveFile} 
          disabled={disabled}
        />
      ) : (
        <div className="drop-hint" aria-hidden="true">
          <div>Drag & drop your PDF here, or click to choose</div>
        </div>
      )}
    </div>
  );
};
