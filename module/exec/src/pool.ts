import * as os from 'os';
import { Worker } from './worker';
import { Shutdown } from '@travetto/base';

let id = 0;

export class WorkerPool<T extends Worker<U> & { id?: number, completion?: Promise<any> }, U = any> {
  workerCount: number;
  private availableWorkers = new Set<T>();
  private pendingWorkers = new Set<T>();
  private initialized: Promise<any>;

  constructor(count: number = 0) {
    this.workerCount = count || os.cpus().length - 1;
  }

  async init(create: () => Promise<T>) {
    while (this.availableSize < this.workerCount) {
      const w = await create();
      w.id = id++;
      await w.init();
    }
  }

  get availableSize() {
    return this.availableWorkers.size;
  }

  async getNextWorker() {
    if (this.availableWorkers.size === 0) {
      return undefined;
    } else {
      const agent = this.availableWorkers.values().next().value;
      this.availableWorkers.delete(agent);
      await agent.init();
      return agent;
    }
  }

  returnWorker(worker: T) {
    this.pendingWorkers.delete(worker);
    this.availableWorkers.add(worker);
    worker.clean();
  }

  async process<X>(inputs: X[], handler: { init: () => Promise<T>, exec: (inp: X, worker?: T) => Promise<any> }) {
    await this.init(handler.init);

    let position = 0;

    while (position < inputs.length) {
      if (this.pendingWorkers.size < this.availableSize) {
        const next = position++;
        const worker = (await this.getNextWorker())!;

        worker.completion = handler.exec(inputs[next], worker).then(x => worker, e => worker);

        this.pendingWorkers.add(worker);
      } else {
        const worker = await Promise.race(Array.from(this.pendingWorkers).map(x => x.completion));
        this.returnWorker(worker);
      }
    }

    await Promise.all(Array.from(this.pendingWorkers).map(x => x.completion));
  }

  shutdown() {
    for (const worker of Array.from(this.pendingWorkers)) {
      this.returnWorker(worker);
    }

    for (const worker of Array.from(this.availableWorkers)) {
      try {
        console.debug('Killing Process', worker.id)
        worker.kill();
      } catch (e) {
        console.error('Error', worker.id, e);
      }
    }
  }
}
