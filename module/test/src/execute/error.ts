import { AppError } from '@travetto/runtime';

/**
 * Represents an execution error
 */
export class ExecutionError extends AppError { }

/**
 * Timeout execution error
 */
export class TimeoutError extends ExecutionError { }
