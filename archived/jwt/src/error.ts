import { AppError, AppErrorOptions } from '@travetto/runtime';

type JWTDetails = {
  expiredAt?: Date;
  date?: Date;
  token?: string;
};

/**
 * Error in decoding
 */
export class JWTError extends AppError<JWTDetails | undefined> {
  constructor(message: string, opts?: AppErrorOptions<JWTDetails>) {
    super(message, { category: 'data', details: undefined!, ...opts });
  }
}