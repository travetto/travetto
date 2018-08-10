import { ScanApp } from './scan-app';
import { Util } from './util';

interface Initializer {
  action: Function;
  key: string;
}

export class PhaseManager {

  initializers: Initializer[] = [];

  constructor(public scope: string) { }

  load(upto?: string) {
    const pattern = new RegExp(`phase[.]${this.scope}[.]ts$`);
    const initFiles = ScanApp.requireFiles('.ts', x => pattern.test(x));
    this.initializers = Util.computeOrdering(initFiles.map(x => x.init));

    if (upto) {
      const index = this.initializers.findIndex(x => x.key === upto);
      if (index >= 0) {
        this.initializers = this.initializers.slice(0, index + 1);
      }
    }

    console.debug('Initializing Phase', this.scope, this.initializers.map(x => x.key));

    return this;
  }

  async run(cb?: () => any) {
    for (const i of this.initializers) {
      const start = Date.now();
      await i.action();
      console.trace(this.scope, 'Phase', i.key, Date.now() - start);
    }
    if (cb) {
      await cb();
    }
  }
}