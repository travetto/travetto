import { AppError } from '@travetto/base';

/**
 * Represents an execution error
 */
export class ExecutionError extends AppError {
  constructor(message: string, stack?: string) {
    super(message, 'general', {}, stack);
  }
}