import { Worker } from './worker';

export class LocalWorker<U = any> extends Worker<U, NodeJS.Process> {
  constructor() {
    super(new Promise(resolve => resolve(process)));
  }
}