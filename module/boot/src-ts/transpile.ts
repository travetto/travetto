import * as fs from 'fs';
import { EnvUtil } from './env';
import { FsUtil } from './fs-util';
import { AppCache } from './app-cache';

type Preparer = (name: string, contents: string) => string;

declare const global: {
  ts: any;
};

let tsOpts: any;
let ts: any = global.ts = new Proxy({}, {
  get(t, p, r) {
    ts = (global as any).ts = require('typescript');
    return ts[p];
  }
});

export class TranspileUtil {

  private static preparers: Preparer[] = [];

  private static resolveToken(token: string) {
    const [__all, sign, env, key] = token.match(/(-|\+)?([$])?(.*)/)!;
    const minus = sign === '-';
    if (env) {
      return minus ? EnvUtil.isFalse(key) : EnvUtil.isTrue(key);
    } else {
      try {
        require.resolve(token);
        return !minus;
      } catch (err) {
        if (!minus) {
          throw err;
        }
      }
    }
    return true;
  }

  private static resolveMacros(name: string, contents: string) {
    let hideAll = false;

    // Handle line queries
    contents = contents.replace(/^.*\/\/\s*@(line|file)-if\s+(.*?)\s*$/mg, (all, mode, token: string) => {
      if (hideAll) {
        return ''; // Short circuit
      }
      try {
        return this.resolveToken(token) ? all : `// @removed ${token} was not satisfied`;
      } catch (err) {
        if (mode === 'file') {
          hideAll = true;
          // console.error(`Unable to find module ${token}, skipping`);
          return '';
        } else {
          return `// @removed, module ${token} not found`;
        }
      }
    });

    return hideAll ? '// @removed, modules not found' : contents;
  }

  static addPreparer(fn: Preparer) {
    this.preparers.push(fn);
  }

  static prepare(fileName: string, contents?: string) {
    let fileContents = contents ?? fs.readFileSync(fileName, 'utf-8');

    // Resolve macro
    fileContents = this.resolveMacros(fileName, fileContents);

    for (const preparer of this.preparers) {
      fileContents = preparer(fileName, fileContents);
    }

    // Drop typescript import, and use global. Great speedup;
    fileContents = fileContents.replace(/^import\s+[*]\s+as\s+ts\s+from\s+'typescript'/g, x => `// ${x}`);

    // Track loading, for cyclical dependency detection
    return `${fileContents};\nexport const ᚕtrv = 1;`;
  }

  static transpile(tsf: string, force = false) {
    const name = FsUtil.toUnix(tsf);
    if (force || !AppCache.hasEntry(name)) {
      if (!tsOpts) {
        const json = ts.readJsonConfigFile(`${FsUtil.cwd}/tsconfig.json`, ts.sys.readFile);
        tsOpts = ts.parseJsonSourceFileConfigFileContent(json, ts.sys, FsUtil.cwd).options;
      }
      const content = ts.transpile(this.prepare(tsf), tsOpts);
      AppCache.writeEntry(name, content);
      return content;
    } else {
      return AppCache.readEntry(name);
    }
  }

  static reset() {
    this.preparers = [];
  }
}