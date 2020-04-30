import { AppError, ErrorCategory } from '@travetto/base';

// TODO: Document
export class JWTError extends AppError {
  constructor(message: string, payload?: Record<string, any>, category: ErrorCategory = 'data') {
    super(message, category, payload);
  }
}