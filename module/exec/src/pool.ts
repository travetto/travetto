import * as os from 'os';
import { Executor } from './executor';
import { Shutdown } from '@travetto/base';

let id = 0;

export class ExecPool<T extends Executor<U> & { id?: number, completion?: Promise<any> }, U = any> {
  executorCount: number;
  private availableExecutors = new Set<T>();
  private pendingExecutors = new Set<T>();
  private initialized: Promise<any>;

  constructor(count: number = 0) {
    this.executorCount = count || os.cpus().length - 1;
  }

  async init(create: () => Promise<T>) {
    while (this.availableSize < this.executorCount) {
      const w = await create();
      w.id = id++;
      await w.init();
    }
  }

  get availableSize() {
    return this.availableExecutors.size;
  }

  async getNextexecutor() {
    if (this.availableExecutors.size === 0) {
      return undefined;
    } else {
      const agent = this.availableExecutors.values().next().value;
      this.availableExecutors.delete(agent);
      await agent.init();
      return agent;
    }
  }

  returnexecutor(executor: T) {
    this.pendingExecutors.delete(executor);
    this.availableExecutors.add(executor);
    executor.clean();
  }

  async process<X>(inputs: X[], handler: { init: () => Promise<T>, exec: (inp: X, executor?: T) => Promise<any> }) {
    await this.init(handler.init);

    let position = 0;

    while (position < inputs.length) {
      if (this.pendingExecutors.size < this.availableSize) {
        const next = position++;
        const executor = (await this.getNextexecutor())!;

        executor.completion = handler.exec(inputs[next], executor).then(x => executor, e => executor);

        this.pendingExecutors.add(executor);
      } else {
        const executor = await Promise.race(Array.from(this.pendingExecutors).map(x => x.completion));
        this.returnexecutor(executor);
      }
    }

    await Promise.all(Array.from(this.pendingExecutors).map(x => x.completion));
  }

  shutdown() {
    for (const executor of Array.from(this.pendingExecutors)) {
      this.returnexecutor(executor);
    }

    for (const executor of Array.from(this.availableExecutors)) {
      try {
        console.debug('Killing Process', executor.id)
        executor.kill();
      } catch (e) {
        console.error('Error', executor.id, e);
      }
    }
  }
}
