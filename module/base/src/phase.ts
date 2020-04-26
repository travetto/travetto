import { ScanApp } from './scan-app';
import { SystemUtil } from './system-util';

interface Initializer {
  action: Function;
  key: string;
}

export class PhaseManager {

  static init(scope: string, upto?: string, after?: string) {
    const mgr = new PhaseManager(scope);
    mgr.load(upto, after);
    return mgr;
  }

  static bootstrap(upto?: string) {
    return this.init('bootstrap', upto).run();
  }

  static bootstrapAfter(after: string) {
    return this.init('bootstrap', '*', after).run();
  }

  initializers: Initializer[] = [];

  constructor(public scope: string) { }

  load(upto?: string, after?: string) {
    const pattern = new RegExp(`support/phase[.]${this.scope}[.]`);
    // Load all support files
    const initFiles = ScanApp.findSourceFiles(pattern).map(x => require(x.file));
    this.initializers = SystemUtil.computeOrdering(initFiles.map(x => x.init));

    if (upto) {
      let end = this.initializers.length - 1;
      let start = 0;

      const endIndex = this.initializers.findIndex(x => x.key === upto);
      if (after) {
        const startIndex = this.initializers.findIndex(x => x.key === after);
        if (startIndex >= 0) {
          start = startIndex + 1;
        }
      }
      if (endIndex >= 0) {
        end = endIndex;
      }
      this.initializers = this.initializers.slice(start, end + 1);
    }

    console.debug('Initializing Phase', this.scope, this.initializers.map(x => x.key));

    return this;
  }

  async run() {
    for (const i of this.initializers) {
      const start = Date.now();
      await i.action();
      console.trace(this.scope, 'Phase', i.key, Date.now() - start);
    }
  }
}