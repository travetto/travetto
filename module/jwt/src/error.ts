import { AppError, ErrorCategory } from '@travetto/base';

export class JWTError extends AppError {
  constructor(message: string, payload?: { [key: string]: any }, category: ErrorCategory = 'data') {
    super(message, category, payload);
  }
}