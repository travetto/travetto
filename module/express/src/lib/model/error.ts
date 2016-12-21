import { ExtendableError } from '@encore/util';

export class AppError extends ExtendableError {
  constructor(message: string, public status: number = 500) {
    super(message);
  }
}