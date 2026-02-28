import { RuntimeError } from '@travetto/runtime';

/**
 * Represents an execution error
 */
export class TestExecutionError extends RuntimeError { }

/**
 * Timeout execution error
 */
export class TimeoutError extends TestExecutionError { }
