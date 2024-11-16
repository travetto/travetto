import { AppError, ErrorCategory } from '@travetto/runtime';

export class AuthenticationError<T = Record<string, unknown> | undefined> extends AppError<T> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  static defaultCategory = 'authentication' as ErrorCategory;
}