import { useState, useCallback, useRef } from 'react';
import type { FileInfo, AppError } from '../types';
import { validateFile } from '../utils';

interface UseFileUploadOptions {
  onError?: (error: AppError) => void;
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const { onError } = options;
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    try {
      const file = files[0];
      const validatedFileInfo = validateFile(file);
      setFileInfo(validatedFileInfo);

      if (inputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        inputRef.current.files = dataTransfer.files;
      }
    } catch (error) {
      onError?.(error as AppError);
    }
  }, [onError]);

  const removeFile = useCallback(() => {
    setFileInfo(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  const openFileDialog = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setDragActive(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer?.files;
    if (files) {
      handleFiles(files);
    }
  }, [handleFiles]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  }, [handleFiles]);

  const getSelectedFile = useCallback((): File | null => {
    return inputRef.current?.files?.[0] || null;
  }, []);

  return {
    fileInfo,
    dragActive,
    inputRef,
    removeFile,
    openFileDialog,
    getSelectedFile,
    dragHandlers: {
      onDragOver,
      onDragLeave,
      onDrop,
    },
    inputProps: {
      ref: inputRef,
      type: 'file' as const,
      accept: 'application/pdf',
      onChange: onInputChange,
      style: { display: 'none' },
    },
  };
}
