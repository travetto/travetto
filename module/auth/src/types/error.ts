import { RuntimeError, type ErrorCategory } from '@travetto/runtime';

export class AuthenticationError<T = Record<string, unknown> | undefined> extends RuntimeError<T> {
  static defaultCategory = 'authentication' as ErrorCategory;
}
