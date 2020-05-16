import { AppError } from '@travetto/base';

/**
 * Represents an execution error
 */
export class ExecutionError extends AppError {
  constructor(message: string) { super(message); }
}