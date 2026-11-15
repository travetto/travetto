import { type ErrorCategory, RuntimeError, type UnknownRecord } from '@travetto/runtime';

export class AuthenticationError<T = UnknownRecord | undefined> extends RuntimeError<T> {
  static defaultCategory = 'authentication' as ErrorCategory;
}
