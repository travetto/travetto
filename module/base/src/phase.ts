import { requireAppFiles } from './scan-app';

interface Initializer {
  action: () => Promise<number[]> | number[] | undefined;
  priority?: number;
}

export class PhaseManager {
  static DEFAULT_PRIORITY = 100;

  initializers: Initializer[] = [];

  constructor(public scope: string) { }

  load(priority?: number) {
    this.initializers = requireAppFiles('.ts', new RegExp(`phase[.]${this.scope}[.]ts$`))
      .map(x => x.init)
      .map(x => ({ priority: PhaseManager.DEFAULT_PRIORITY, ...x }))
      .filter(x => priority === undefined || x.priority <= priority)
      .sort((a, b) => a.priority - b.priority);
    return this;
  }

  async run() {
    const pids = [];
    for (const i of this.initializers) {
      const res = await i.action();
      pids.push(...(res ? res : []));
    }
    return pids;
  }
}