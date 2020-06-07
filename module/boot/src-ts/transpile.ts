import * as fs from 'fs';
import type * as tsi from 'typescript';
import { EnvUtil } from './env';
import { FsUtil } from './fs';
import { AppCache } from './app-cache';

type Preprocessor = (name: string, contents: string) => string;

const OPTS = Symbol.for('@trv:compiler/options');

/**
 * Standard transpilation utilities, with support for basic text filters
 */
export class TranspileUtil {
  private static [OPTS]: any;

  private static preProcessors: Preprocessor[] = [];

  static readonly ext = '.ts';

  /**
   * Build error module
   * @param message Error message to show
   * @param isModule Is the error a module that should have been loaded
   * @param base The base set of properties to support
   */
  static getErrorModule(message: string, isModule?: string | boolean, base?: Record<string, any>) {
    const f = ([k, v]: string[]) => `${k}: (t,k) => ${v}`;
    const e = '{ throw new Error(msg); }';
    const map: { [P in keyof ProxyHandler<any>]?: any } = {
      getOwnPropertyDescriptor: base ? `({})` : e,
      get: base ? `{ const v = values[keys.indexOf(k)]; if (!v) ${e} else return v; }` : e,
      has: base ? `keys.includes(k)` : e
    };
    return [
      (typeof isModule === 'string') ? `console.debug(\`${isModule}\`);` : '',
      base ? `let keys = ['${Object.keys(base).join(`','`)}']` : '',
      base ? `let values = ['${Object.values(base).join(`','`)}']` : '',
      `let msg = \`${message}\`;`,
      `Object.defineProperty(exports, 'ᚕtrvError', { value: true })`,
      `module.exports = new Proxy({}, { ${Object.entries(map).map(f).join(',')}});`
    ].join('\n');
  }

  /**
   * Process token
   * @param token The token to process
   */
  static resolveToken(token: string): { minus: boolean, key: string, valid: boolean, err?: Error } {
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
   * @param name The name of the file to resolve macros for
   * @param contents The file contents
   */
  static resolveMacros(name: string, contents: string) {
    const modErrs: string[] = [];

    // Handle line queries
    contents = contents.replace(/^.*[/][/]\s*@(line|file)-if\s+(.*?)\s*$/mg, (all, mode, token: string) => {
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
    if (!this[OPTS]) {
      const ts: typeof tsi = require('typescript');
      const json = ts.readJsonConfigFile(`${FsUtil.cwd}/tsconfig.json`, ts.sys.readFile);
      this[OPTS] = {
        ...ts.parseJsonSourceFileConfigFileContent(json, ts.sys, FsUtil.cwd).options,
        rootDir: FsUtil.cwd,
        outDir: FsUtil.cwd
      };
    }
    return this[OPTS];
  }

  /**
   * Check transpilation errors
   * @param fileName The name of the file
   * @param diagnostics The diagnostic errors
   */
  static checkTranspileErrors(fileName: string, diagnostics: readonly any[]) {
    if (diagnostics && diagnostics.length) {
      const errors = diagnostics.slice(0, 5).map(diag => {
        const ts: typeof tsi = require('typescript');
        const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
        if (diag.file) {
          const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start!);
          return ` @ ${diag.file.fileName.replace(`${FsUtil.cwd}/`, '')}(${line + 1}, ${character + 1}): ${message}`;
        } else {
          return ` ${message}`;
        }
      });

      if (diagnostics.length > 5) {
        errors.push(`${diagnostics.length - 5} more ...`);
      }
      throw new Error(`Transpiling ${fileName.replace(`${FsUtil.cwd}/`, '')} failed: \n${errors.join('\n')}`);
    }
  }

  /**
   * Add support for additional transpilation preprocessor
   * @param fn The preprocessor to add
   */
  static addPreProcessor(fn: Preprocessor) {
    this.preProcessors.unshift(fn);
  }

  /**
   * Pre-processes a typescript file before transpilation
   * @param fileName The file to preprocess
   * @param contents The file contents to process
   */
  static preProcess(fileName: string, contents?: string) {
    let fileContents = contents ?? fs.readFileSync(fileName, 'utf-8');

    // Resolve macro
    fileContents = this.resolveMacros(fileName, fileContents);

    for (const preProcessor of this.preProcessors) {
      fileContents = preProcessor(fileName, fileContents);
    }

    return fileContents;
  }

  /**
   * Process error response
   * @param phase The load/compile phase to care about
   * @param tsf The typescript filename
   * @param err The error produced
   * @param fileName The relative filename
   */
  static handlePhaseError(phase: 'load' | 'compile' | 'transpile', tsf: string, err: Error, fileName = tsf.replace(`${FsUtil.cwd}/`, '')) {
    if (phase === 'compile' &&
      (err.message.startsWith('Cannot find module') || err.message.startsWith('Unable to load'))
    ) {
      err = new Error(`${err.message} ${err.message.includes('from') ? `[via ${fileName}]` : `from ${fileName}`}`);
    }

    if (EnvUtil.isWatch() && !fileName.includes('/node_modules/')) {
      console.trace(`Unable to ${phase} ${fileName}: stubbing out with error proxy.`, err.message);
      return this.getErrorModule(err.message);
    }

    throw err;
  }

  /**
   * Transpile, and cache
   * @param tsf The typescript file to transpile
   * @param force Force transpilation, even if cached
   */
  static transpile(tsf: string, force = false) {
    return AppCache.getOrSet(tsf, () => {
      try {
        const diags: any[] = [];
        const ts: typeof tsi = require('typescript');
        const ret = ts.transpile(this.preProcess(tsf), this.compilerOptions, tsf, diags);
        this.checkTranspileErrors(tsf, diags);
        return ret;
      } catch (e) {
        return this.handlePhaseError('transpile', tsf, e);
      }
    }, force);
  }

  /**
   * Initialize
   */
  static init() {
    AppCache.init();

    // Register source maps for cached files
    require('source-map-support').install({
      emptyCacheBetweenOperations: EnvUtil.isWatch(),
      retrieveFile: (p: string) => AppCache.hasEntry(p) ? AppCache.readEntry(p) : undefined
    });
  }

  /**
   * Reset
   */
  static reset() {
    AppCache.reset();
    this.preProcessors = [];
  }
}