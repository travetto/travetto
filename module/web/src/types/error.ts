import { type AnyMap, RuntimeError, type ErrorCategory } from '@travetto/runtime';

/**
 * Web Error
 */
export class WebError extends RuntimeError<{ statusCode?: number }> {
  static for(message: string, code: number, details?: AnyMap, category: ErrorCategory = 'data'): WebError {
    return new WebError(message, { category, details: { ...details, statusCode: code } });
  }
}