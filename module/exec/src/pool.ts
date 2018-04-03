import * as os from 'os';
import { Execution } from './execution';
import { Shutdown } from '@travetto/base';

let id = 0;

export class ExecutionPool<T extends Execution<U> & { id?: number, completion?: Promise<any> }, U = any> {
  executionCount: number;
  private availableExecutions = new Set<T>();
  private pendingExecutions = new Set<T>();
  private initialized: Promise<any>;

  constructor(count: number = 0) {
    this.executionCount = count || os.cpus().length - 1;
  }

  async init(create: () => Promise<T>) {
    while (this.availableSize < this.executionCount) {
      const w = await create();
      w.id = id++;
      await w.init();
    }
  }

  get availableSize() {
    return this.availableExecutions.size;
  }

  async getNextExecution() {
    if (this.availableExecutions.size === 0) {
      return undefined;
    } else {
      const agent = this.availableExecutions.values().next().value;
      this.availableExecutions.delete(agent);
      await agent.init();
      return agent;
    }
  }

  returnExecution(execution: T) {
    this.pendingExecutions.delete(execution);
    this.availableExecutions.add(execution);
    execution.clean();
  }

  async process<X>(inputs: X[], handler: { init: () => Promise<T>, exec: (inp: X, execution?: T) => Promise<any> }) {
    await this.init(handler.init);

    let position = 0;

    while (position < inputs.length) {
      if (this.pendingExecutions.size < this.availableSize) {
        const next = position++;
        const execution = (await this.getNextExecution())!;

        execution.completion = handler.exec(inputs[next], execution).then(x => execution, e => execution);

        this.pendingExecutions.add(execution);
      } else {
        const execution = await Promise.race(Array.from(this.pendingExecutions).map(x => x.completion));
        this.returnExecution(execution);
      }
    }

    await Promise.all(Array.from(this.pendingExecutions).map(x => x.completion));
  }

  shutdown() {
    for (const execution of Array.from(this.pendingExecutions)) {
      this.returnExecution(execution);
    }

    for (const execution of Array.from(this.availableExecutions)) {
      try {
        console.debug('Killing Process', execution.id)
        execution.kill();
      } catch (e) {
        console.error('Error', execution.id, e);
      }
    }
  }
}
