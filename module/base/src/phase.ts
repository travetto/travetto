import { bulkRequire } from './scan-fs';

interface Initializer {
  action: Function;
  priority?: number;
}

export class PhaseManager {
  static DEFAULT_PRIORITY = 100;

  initializers: Initializer[] = [];

  constructor(public scope: string) { }

  load(priority?: number) {
    this.initializers =
      bulkRequire<{ init: Initializer }>([
        new RegExp(`phase[.]${this.scope}[.]ts$`)],
        `${process.cwd()}/node_modules/@travetto`
      ).concat(
        bulkRequire<{ init: Initializer }>([
          new RegExp(`phase[.]${this.scope}[.]ts$`)
        ], `${process.cwd()}/phase`)
      )
        .map(x => x.init)
        .map(x => ({ priority: PhaseManager.DEFAULT_PRIORITY, ...x }))
        .filter(x => priority === undefined || x.priority <= priority)
        .sort((a, b) => a.priority - b.priority);
  }

  async run() {
    for (const i of this.initializers) {
      await i.action();
    }
  }
}