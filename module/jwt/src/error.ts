import { AppError, ErrorCategory } from '@travetto/base';

/**
 * Error in decoding
 */
export class JWTError extends AppError {
  constructor(message: string, payload?: Record<string, unknown>, category: ErrorCategory = 'data') {
    super(message, category, payload);
  }
}