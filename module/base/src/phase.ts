import { requireAppFiles } from './scan-app';

interface Initializer {
  action: Function;
  priority?: number;
}

export class PhaseManager {
  static DEFAULT_PRIORITY = 100;

  initializers: Initializer[] = [];

  constructor(public scope: string) { }

  load(priority?: number) {
    const pattern = new RegExp(`phase[.]${this.scope}[.]ts$`);
    const initFiles = requireAppFiles('.ts', x => pattern.test(x));
    console.debug('Initializing Phase', this.scope, initFiles);
    this.initializers = initFiles
      .map(x => x.init)
      .map(x => ({ priority: PhaseManager.DEFAULT_PRIORITY, ...x }))
      .filter(x => priority === undefined || x.priority <= priority)
      .sort((a, b) => a.priority - b.priority);
    return this;
  }

  async run() {
    for (const i of this.initializers) {
      await i.action();
    }
  }
}