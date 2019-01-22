import { AppError } from '@travetto/base';

export class JWTError extends AppError {
  constructor(message: string, public payload: { [key: string]: any } = {}) {
    super(message);
  }
}