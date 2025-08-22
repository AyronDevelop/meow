import { APP_CONFIG, ERROR_MESSAGES } from '../constants';
import type { FileInfo, AppError } from '../types';


export function createAppError(message: string, code?: string, details?: unknown): AppError {
  const error = new Error(message) as AppError;
  error.code = code;
  error.details = details;
  return error;
}

export function validateFile(file: File): FileInfo {
  if (!file) {
    throw createAppError(ERROR_MESSAGES.NO_FILE_SELECTED, 'NO_FILE');
  }

  if (file.size > APP_CONFIG.MAX_FILE_SIZE) {
    throw createAppError(ERROR_MESSAGES.FILE_TOO_LARGE, 'FILE_TOO_LARGE');
  }

  if (!APP_CONFIG.SUPPORTED_TYPES.includes(file.type as any) && 
      !file.name.toLowerCase().endsWith('.pdf')) {
    throw createAppError(ERROR_MESSAGES.INVALID_FILE_TYPE, 'INVALID_TYPE');
  }

  return {
    name: file.name,
    size: file.size,
    type: file.type,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${Math.round(bytes / Math.pow(k, i))} ${sizes[i]}`;
}

export async function computeFileHash(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = new Uint8Array(hashBuffer);
    
    return Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (error) {
    throw createAppError('Failed to compute file hash', 'HASH_ERROR', error);
  }
}

export function createTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
