import { BaseError } from '@travetto/base';

export class JWTError extends BaseError {
  constructor(message: string, public payload: { [key: string]: any } = {}) {
    super(message);
  }
}