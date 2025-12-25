/**
 * Retry utility for Firebase operations with exponential backoff
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
};

/**
 * Check if an error is retryable (network error, timeout, etc.)
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  const errorCode = error.code || error.message || '';
  const errorString = String(errorCode).toLowerCase();
  
  // Firebase error codes that are retryable
  const retryableCodes = [
    'unavailable',
    'deadline-exceeded',
    'internal',
    'aborted',
    'cancelled',
    'network',
    'timeout',
    'connection',
  ];
  
  // Check if it's a network-related error
  if (errorString.includes('network') || 
      errorString.includes('connection') ||
      errorString.includes('failed to fetch') ||
      errorString.includes('networkerror')) {
    return true;
  }
  
  // Check Firebase error codes
  return retryableCodes.some(code => errorString.includes(code));
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if it's not a retryable error
      if (!isRetryableError(error)) {
        throw error;
      }
      
      // Don't retry on the last attempt
      if (attempt === opts.maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay
      );
      
      console.warn(
        `Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms:`,
        error
      );
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

