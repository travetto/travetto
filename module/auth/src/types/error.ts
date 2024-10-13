import { AppError, AppErrorOptions } from '@travetto/runtime';

export class AuthenticationError<T> extends AppError<T> {
  constructor(message: string, opts?: AppErrorOptions<T>) {
    super(message, { category: 'authentication', ...opts });
  }
}