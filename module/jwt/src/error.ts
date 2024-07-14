import { AppError, ErrorCategory } from '@travetto/base';

type JWTDetails = {
  expiredAt?: Date;
  date?: Date;
  token?: string;
};

/**
 * Error in decoding
 */
export class JWTError extends AppError<JWTDetails> {
  constructor(message: string, details?: JWTDetails, category: ErrorCategory = 'data') {
    super(message, category, details);
  }
}