import { Worker } from './worker';

export class ParentWorker<U extends { type: string }> extends Worker<U, NodeJS.Process> {
  constructor() {
    super(new Promise(resolve => resolve(process)));
  }
}