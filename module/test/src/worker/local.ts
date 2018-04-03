import { Worker } from './worker';

export class LocalWorker<U extends { type: string }> extends Worker<U, NodeJS.Process> {
  constructor() {
    super(new Promise(resolve => resolve(process)));
  }
}