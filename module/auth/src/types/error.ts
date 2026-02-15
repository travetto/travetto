import { RuntimeError, type ErrorCategory } from '@travetto/runtime';

export class AuthenticationError<T = Record<string, unknown> | undefined> extends RuntimeError<T> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  static defaultCategory = 'authentication' as ErrorCategory;
}