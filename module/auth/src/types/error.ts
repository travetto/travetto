import { type ErrorCategory, RuntimeError } from '@travetto/runtime';

export class AuthenticationError<T = Record<string, unknown> | undefined> extends RuntimeError<T> {
  static defaultCategory = 'authentication' as ErrorCategory;
}
