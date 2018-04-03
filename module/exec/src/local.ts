import { Execution } from './execution';

export class LocalExecution<U = any> extends Execution<U, NodeJS.Process> {
  constructor() {
    super(new Promise(resolve => resolve(process)));
  }
}