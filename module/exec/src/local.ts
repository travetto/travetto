import { Executor } from './executor';

export class LocalExecutor<U = any> extends Executor<U, NodeJS.Process> {
  constructor() {
    super(new Promise(resolve => resolve(process)));
  }
}