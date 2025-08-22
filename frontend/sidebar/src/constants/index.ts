export const APP_CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024,
  SUPPORTED_TYPES: ['application/pdf'] as const,
  POLLING_INTERVAL: 3000,
  MAX_POLLING_ATTEMPTS: 30,
  PROGRESS_ANIMATION_DURATION: 1200,
} as const;

export const PHASE_MESSAGES = {
  idle: { title: 'Ready to process', subtitle: 'Drop a PDF or click to choose' },
  hashing: { title: '🔐 Hashing your PDF...', subtitle: 'Securing your document' },
  signing: { title: '📝 Preparing upload...', subtitle: 'Requesting a signed URL' },
  uploading: { title: '☁️ Uploading to cloud...', subtitle: 'This may take a moment' },
  creating: { title: '⚡ Starting AI processing...', subtitle: 'Setting things up' },
  polling: { title: '🤖 AI is analyzing your PDF...', subtitle: 'Extracting structure and content' },
  downloading: { title: '📥 Receiving results...', subtitle: 'Almost there' },
  applying: { title: '✨ Creating your slides...', subtitle: 'Adding text and images' },
  done: { title: '✅ Slides created', subtitle: 'You can continue in Slides' },
  error: { title: '❌ Something went wrong', subtitle: 'Please try again' },
} as const;

export const PHASE_PROGRESS = {
  idle: 0,
  hashing: 5,
  signing: 15,
  uploading: 30,
  creating: 45,
  polling: 60,
  downloading: 90,
  applying: 95,
  done: 100,
  error: 0,
} as const;

export const ERROR_MESSAGES = {
  NO_FILE_SELECTED: 'Please select a PDF file',
  INVALID_FILE_TYPE: 'Please select a valid PDF file',
  FILE_TOO_LARGE: `File size must be less than ${APP_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`,
  UPLOAD_FAILED: 'Failed to upload file. Please try again.',
  PROCESSING_TIMEOUT: 'Processing timeout. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
} as const;

export const ARIA_LABELS = {
  DROP_ZONE: 'Drop or click to select a PDF file',
  REMOVE_FILE: 'Remove selected file',
  UPLOAD_BUTTON: 'Start processing PDF to slides',
  RESET_BUTTON: 'Reset and clear selection',
  DEBUG_TOGGLE: 'Toggle debug information',
  PROGRESS_BAR: 'Processing progress',
  ACTIVITY_LOG: 'Processing activity log',
} as const;
