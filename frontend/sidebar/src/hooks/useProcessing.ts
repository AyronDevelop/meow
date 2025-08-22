import { useState, useCallback, useRef } from 'react';
import type { ProcessingPhase, ProcessingState, FileInfo, AppError } from '../types';
import { gasClient } from '../services/gasClient';
import { 
  validateFile, 
  computeFileHash, 
  createAppError, 
  delay,
  createTimestamp 
} from '../utils';
import { backoffWait } from '../utils/backoff';
import { 
  APP_CONFIG, 
  PHASE_MESSAGES, 
  PHASE_PROGRESS, 
  ERROR_MESSAGES 
} from '../constants';

interface UseProcessingOptions {
  onLog?: (message: string) => void;
  onError?: (error: AppError) => void;
}

export function useProcessing(options: UseProcessingOptions = {}) {
  const { onLog, onError } = options;
  
  const [state, setState] = useState<ProcessingState>({
    phase: 'idle',
    status: PHASE_MESSAGES.idle.title,
    progress: null,
    busy: false,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const log = useCallback((message: string) => {
    const timestampedMessage = `[${createTimestamp()}] ${message}`;
    onLog?.(timestampedMessage);
  }, [onLog]);

  const logObject = useCallback((label: string, obj: unknown, maxLength = 1200) => {
    try {
      const jsonString = JSON.stringify(obj);
      const truncated = jsonString.length > maxLength 
        ? `${jsonString.slice(0, maxLength)}...` 
        : jsonString;
      log(`${label}: ${truncated}`);
    } catch {
      log(`${label}: [unserializable object]`);
    }
  }, [log]);

  const updatePhase = useCallback((phase: ProcessingPhase) => {
    setState(prev => ({
      ...prev,
      phase,
      status: PHASE_MESSAGES[phase].title,
      progress: PHASE_PROGRESS[phase],
    }));
  }, []);

  const setCustomProgress = useCallback((progress: number) => {
    setState(prev => ({
      ...prev,
      progress: Math.max(prev.progress || 0, progress),
    }));
  }, []);

  const handleError = useCallback((error: unknown) => {
    const appError = error instanceof Error 
      ? (error as AppError)
      : createAppError(ERROR_MESSAGES.UNKNOWN_ERROR, 'UNKNOWN', error);
    
    updatePhase('error');
    setState(prev => ({ ...prev, busy: false }));
    onError?.(appError);
    log(`ERROR: ${appError.message}`);
  }, [updatePhase, onError, log]);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    
    setState({
      phase: 'idle',
      status: PHASE_MESSAGES.idle.title,
      progress: null,
      busy: false,
    });
  }, []);

  const processFile = useCallback(async (file: File): Promise<void> => {
    let fileInfo: FileInfo;
    try {
      fileInfo = validateFile(file);
    } catch (error) {
      handleError(error);
      return;
    }

    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    setState(prev => ({ ...prev, busy: true }));

    try {
      updatePhase('hashing');
      if (signal.aborted) throw new Error('Aborted');
      
      const fileHash = await computeFileHash(file);
      log('File hash computed successfully');

      updatePhase('signing');
      if (signal.aborted) throw new Error('Aborted');
      
      const signedUrlResponse = await gasClient.createSignedUrl({
        fileName: fileInfo.name,
        contentLength: fileInfo.size,
        contentSha256: fileHash,
      });
      log('Signed URL obtained');
      logObject('signed-url.response', signedUrlResponse);

      updatePhase('uploading');
      if (signal.aborted) throw new Error('Aborted');
      
      const uploadHeaders = signedUrlResponse.headers || {
        'Content-Type': 'application/pdf',
        'x-goog-content-sha256': 'UNSIGNED-PAYLOAD',
      };
      
      const uploadResponse = await fetch(signedUrlResponse.uploadUrl, {
        method: 'PUT',
        headers: uploadHeaders,
        body: file,
        signal,
      });

      if (!uploadResponse.ok) {
        throw createAppError(
          `${ERROR_MESSAGES.UPLOAD_FAILED} (${uploadResponse.status})`,
          'UPLOAD_ERROR'
        );
      }
      log('File uploaded successfully');

      updatePhase('creating');
      if (signal.aborted) throw new Error('Aborted');
      
      const jobResponse = await gasClient.createJob(signedUrlResponse.uploadId, {});
      log(`Job created: ${jobResponse.jobId}`);
      logObject('job.response', jobResponse);

      updatePhase('polling');
      let attempts = 0;
      let finalStatus;

      while (attempts < APP_CONFIG.MAX_POLLING_ATTEMPTS) {
        if (signal.aborted) throw new Error('Aborted');
        await backoffWait(attempts + 1, { baseMs: 1200, factor: 1.6, maxMs: 8000, jitter: 0.25 });
        attempts++;
        
        const statusResponse = await gasClient.getJobStatus(jobResponse.jobId);
        log(`Status check [${attempts}]: ${statusResponse.status}`);
        logObject(`status[${attempts}]`, statusResponse);
        
        const pollingProgress = PHASE_PROGRESS.polling + 
          (attempts / APP_CONFIG.MAX_POLLING_ATTEMPTS) * 
          (PHASE_PROGRESS.downloading - PHASE_PROGRESS.polling);
        setCustomProgress(Math.floor(pollingProgress));

        if (['done', 'error', 'cancelled'].includes(statusResponse.status)) {
          finalStatus = statusResponse;
          break;
        }
      }

      if (!finalStatus) {
        throw createAppError(ERROR_MESSAGES.PROCESSING_TIMEOUT, 'TIMEOUT');
      }

      if (finalStatus.status !== 'done') {
        throw createAppError(
          `Job failed: ${JSON.stringify(finalStatus.error || {})}`,
          'JOB_FAILED',
          finalStatus.error
        );
      }

      updatePhase('downloading');
      if (signal.aborted) throw new Error('Aborted');
      
      const result = await gasClient.fetchResultJson(finalStatus.result!.resultJsonUrl);
      log('Result downloaded successfully');
      logObject('result.summary', result);

      updatePhase('applying');
      if (signal.aborted) throw new Error('Aborted');
      
      const applyResult = await gasClient.applySlides(result);
      log(`Slides applied: ${applyResult.inserted} slides inserted`);

      updatePhase('done');
      setState(prev => ({ ...prev, busy: false }));
      
      setTimeout(() => {
        setState(prev => ({ ...prev, progress: null }));
      }, APP_CONFIG.PROGRESS_ANIMATION_DURATION);

    } catch (error) {
      if (signal.aborted) {
        log('Processing was aborted');
        reset();
      } else {
        handleError(error);
      }
    }
  }, [updatePhase, setCustomProgress, handleError, log, logObject, reset]);

  return {
    state,
    processFile,
    reset,
    isProcessing: state.busy,
  };
}
