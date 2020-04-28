import * as fs from 'fs';
import { EnvUtil } from './env';
import { FsUtil } from './fs-util';
import { AppCache } from './app-cache';

type Preparer = (name: string, contents: string) => string;

declare const global: { ts: any }; // Used for transformers

const OPTS = Symbol();

/**
 * Standard transpilation utilities, with support for basic text filters
 */
export class TranspileUtil {
  private static preparers: Preparer[] = [];

  private static get ts() { // Only registered on first call
    return global.ts = global.ts ?? new Proxy({}, { // Only in inject as needed
      get(t, p, r) {
        return (global.ts = require('typescript'))[p]; // Overwrite
      }
    });
  }

  static readonly ext = '.ts';

  /**
   * Build error module
   */
  private static getErrorModule(message: string, isModule?: string | boolean, base?: Record<string, any>) {
    const f = ([k, v]: string[]) => `${k}: (t,k) => ${v}`;
    const e = '{ throw new Error(msg); }';
    const map: Record<keyof ProxyHandler<any>, any> = {
      preventExtensions: true, isExtensible: false, enumerate: '[]', setPrototypeOf: e, getPrototypeOf: e, deleteProperty: e,
      defineProperty: e, construct: e, apply: e, set: e,
      getOwnPropertyDescriptor: base ? `({})` : e,
      ownKeys: base ? `keys` : e,
      get: base ? `{ const v = values[keys.indexOf(k)]; if (!v) ${e} else return v; }` : e,
      has: base ? `keys.includes(k)` : e
    };
    return [
      (typeof isModule === 'string') ? `console.debug(\`${isModule}\`);` : '',
      base ? `let keys = ['${Object.keys(base).join(`','`)}']` : '',
      base ? `let values = ['${Object.values(base).join(`','`)}']` : '',
      `let msg = \`${message}\`;`,
      `module.exports = new Proxy({}, { ${Object.entries(map).map(f).join(',')}});`
    ].join('\n');
  }

  /**
   * Process token
   */
  private static resolveToken(token: string): { minus: boolean, key: string, valid: boolean, err?: Error } {
    const [, sign, env, key] = token.match(/(-|\+)?([$])?(.*)/)!;
    const minus = sign === '-';
    if (env) {
      return { minus, key, valid: minus ? EnvUtil.isFalse(key) : EnvUtil.isTrue(key) };
    } else {
      try {
        require.resolve(key);
        return { minus, key, valid: !minus };
      } catch (err) {
        return { minus, key, valid: minus, err };
      }
    }
  }

  /**
   * Resolve macros for keeping/removing text
   */
  private static resolveMacros(name: string, contents: string) {
    const modErrs: string[] = [];

    // Handle line queries
    contents = contents.replace(/^.*\/\/\s*@(line|file)-if\s+(.*?)\s*$/mg, (all, mode, token: string) => {
      if (modErrs.length) {
        return ''; // Short circuit
      }
      const { valid, key, minus } = this.resolveToken(token);
      if (valid) {
        return all;
      } else {
        if (mode === 'file') {
          modErrs.push(`Dependency ${key} should${minus ? ' not' : ''} be installed`);
        }
        return `// @removed ${token} was not satisfied`;
      }
    });

    return modErrs.length ? this.getErrorModule(modErrs[0], `Skipping: ${modErrs[0]}`, { ᚕtrv: true, filename: name }) : contents;
  }

  /**
   * Get loaded compiler options
   */
  static get compilerOptions(): any {
    if (!(this as any)[OPTS]) {
      const json = this.ts.readJsonConfigFile(`${FsUtil.cwd}/tsconfig.json`, this.ts.sys.readFile);
      (this as any)[OPTS] = {
        ...this.ts.parseJsonSourceFileConfigFileContent(json, this.ts.sys, FsUtil.cwd).options,
        rootDir: FsUtil.cwd,
        outDir: FsUtil.cwd
      };
    }
    return (this as any)[OPTS];
  }

  /**
   * Check transpilation errors
   */
  static checkTranspileErrors(cwd: string, fileName: string, diagnostics: readonly any[]) {
    if (diagnostics && diagnostics.length) {
      const errors = diagnostics.slice(0, 5).map(diag => {
        const message = this.ts.flattenDiagnosticMessageText(diag.messageText, '\n');
        if (diag.file) {
          const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start!);
          return ` @ ${diag.file.fileName.replace(`${cwd}/`, '')}(${line + 1}, ${character + 1}): ${message}`;
        } else {
          return ` ${message}`;
        }
      });

      if (diagnostics.length > 5) {
        errors.push(`${diagnostics.length - 5} more ...`);
      }
      throw new Error(`Transpiling ${fileName.replace(`${cwd}/`, '')} failed: \n${errors.join('\n')}`);
    }
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
    if (fileName.includes('/transform')) { // Should only ever be in transformation code
      fileContents = fileContents.replace(/^import\s+[*]\s+as\s+ts\s+from\s+'typescript'/g, x => `// ${x}`);
    }

    fileContents = `${fileContents}\nexport const ᚕtrv = true;`;
    return fileContents;
  }

  /**
   * Process error response
   */
  static handlePhaseError(phase: 'load' | 'compile' | 'transpile', tsf: string, err: Error, fileName = tsf.replace(`${FsUtil.cwd}/`, '')) {
    if (phase === 'compile' &&
      (err.message.startsWith('Cannot find module') || err.message.startsWith('Unable to load'))
    ) {
      err = new Error(`${err.message} ${err.message.includes('from') ? `[via ${fileName}]` : `from ${fileName}`}`);
    }

    if (EnvUtil.isTrue('watch') && !fileName.includes('/node_modules/')) {
      console.debug(`Unable to ${phase} ${fileName}: stubbing out with error proxy.`, err.message);
      return this.getErrorModule(err.message);
    }

    throw err;
  }

  /**
   * Transpile, and cache
   */
  static transpile(tsf: string, force = false) {
    return AppCache.getOrSet(tsf, () => {
      try {
        const diags: any[] = [];
        const ret = this.ts.transpile(this.prepare(tsf), this.compilerOptions, tsf, diags);
        this.checkTranspileErrors(FsUtil.cwd, tsf, diags);
        return ret;
      } catch (e) {
        return this.handlePhaseError('transpile', tsf, e);
      }
    }, force);
  }

  static init() {
    AppCache.init();
  }

  static reset() {
    AppCache.reset();
    this.preparers = [];
  }
}