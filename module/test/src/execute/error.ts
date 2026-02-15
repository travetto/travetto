import { RuntimeError } from '@travetto/runtime';

/**
 * Represents an execution error
 */
export class ExecutionError extends RuntimeError { }

/**
 * Timeout execution error
 */
export class TimeoutError extends ExecutionError { }
