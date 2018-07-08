import { Execution } from './execution';
import { ExecutionEvent } from './types';

export class LocalExecution<U extends ExecutionEvent = ExecutionEvent> extends Execution<U, NodeJS.Process> {
  constructor() {
    super(process);
  }
}