export type ErrorType =
  'general' | 'system' |
  'data' | 'permission' |
  'auth' | 'missing' |
  'timeout' | 'unavailable';

const ERROR_TYPES = new Set([
  'general', 'system',
  'data', 'permission',
  'auth', 'missing',
  'timeout', 'unavailable'
]);

export class AppError<T = any> extends Error {
  name: string;
  payload: T | undefined;
  classification: ErrorType = 'general';

  constructor(message: string, payload: T, errorType: ErrorType);
  constructor(message: string, errorType: ErrorType);
  constructor(message: string, payload: T);
  constructor(
    public message: string,
    payload?: T | ErrorType,
    classification?: ErrorType
  ) {
    super(message);
    if (typeof classification === 'string') {
      this.classification = classification;
    }
    if (typeof payload === 'string' && ERROR_TYPES.has(payload)) {
      this.classification = payload as ErrorType;
    } else {
      this.payload = payload as T;
    }

    this.name = this.constructor.name;
    this.stack = this.stack;
  }
}