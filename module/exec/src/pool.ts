import * as os from 'os';
import { Execution } from './execution';
import { Shutdown } from '@travetto/base';
import { ExecutionEvent } from './types';

let id = 0;

export interface PoolHandler<T extends Execution<U> & { id?: number, completion?: Promise<any> }, U extends ExecutionEvent = ExecutionEvent> {
  count?: number;
  create(): T;
  init(item: T): Promise<T>;
  exec<X>(inp: X, execution: T): Promise<any>
}

export class ExecutionPool<T extends Execution<U> & { id?: number, completion?: Promise<any> }, U extends ExecutionEvent = ExecutionEvent> {
  executionCount: number;
  private availableExecutions = new Set<T>();
  private pendingExecutions = new Set<T>();
  private initialized: Promise<any>;

  constructor(private handler: PoolHandler<T>) {
    this.executionCount = handler.count || os.cpus().length - 1;
  }

  async primePool() {
    const inits: Promise<any>[] = [];

    while (this.availableSize < this.executionCount) {
      const w = this.handler.create();
      w.id = id++;
      this.availableExecutions.add(w);
      inits.push(this.handler.init(w));
    }
    await Promise.all(inits);
  }

  get availableSize() {
    return this.availableExecutions.size;
  }

  async getNextExecution() {
    if (this.availableExecutions.size === 0) {
      throw new Error('Buffer underflow');
    } else {
      const execution = this.availableExecutions.values().next().value;
      this.availableExecutions.delete(execution);
      console.debug(process.pid, 'GETTING', execution.id);
      return execution;
    }
  }

  returnExecution(execution: T) {
    console.debug(process.pid, 'RETURNING', execution.id);
    this.pendingExecutions.delete(execution);
    this.availableExecutions.add(execution);
    execution.clean();
  }

  async process<X>(inputs: X[]) {
    await this.primePool();

    let position = 0;

    while (position < inputs.length) {
      console.debug(process.pid, 'INPUTS', position, inputs[position], this.availableSize, this.pendingExecutions.size);

      if (this.pendingExecutions.size < this.availableSize) {
        const next = position++;
        const exe = (await this.getNextExecution())!;

        exe.completion = this.handler.exec(inputs[next], exe).then(x => exe, e => exe);

        this.pendingExecutions.add(exe);
      } else {
        const execution = await Promise.race(Array.from(this.pendingExecutions).map(x => x.completion));
        console.debug(process.pid, 'COMPLETED', execution.id);
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
