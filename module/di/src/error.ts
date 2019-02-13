import { AppError, ErrorType } from '@travetto/base';

export class InjectionError<T = any> extends AppError<T> {
  constructor(message: string, payload?: T | ErrorType, errorType?: ErrorType) {
    super(message, payload as T, errorType as ErrorType);
  }
}