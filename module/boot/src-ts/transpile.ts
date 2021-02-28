import * as fs from 'fs';
import * as sourceMapSupport from 'source-map-support';
import type * as tsi from 'typescript';

import { EnvUtil } from './env';
import { FsUtil } from './fs';
import { AppCache } from './app-cache';

type Preprocessor = (name: string, contents: string) => string;
type Diag = {
  start: number;
  messageText: string;
  file?: {
    fileName: string;
    getLineAndCharacterOfPosition(start: number): { line: number, character: number };
  };
};

function getTs() {
  // Load Synchronously
  const ts: typeof tsi = require('typescript');
  return ts;
}

const CompilerOptionsSym = Symbol.for('@trv:compiler/options');

const NODE_VERSION = EnvUtil.get('TRV_NODE_MAJOR', process.version.split(/[v.]/)[1]) as '12';
const TS_TARGET = ({
  12: 'ES2019',
  13: 'ES2019',
  14: 'ES2020',
  15: 'ES2020',
  16: 'ES2020'
} as const)[NODE_VERSION] ?? 'ES2019'; // Default if not found

/**
 * Standard transpilation utilities, with support for basic text filters
 */
export class TranspileUtil {
  private static [CompilerOptionsSym]: unknown; // Untyped so that the typescript typings do not make it into the API

  private static PRE_PROCESSORS: Preprocessor[] = [];

  static readonly EXT = '.ts';

  /**
   * Gets the dev compiler options
   */
  private static get devCompilerOptions() {
    const root = process.env.TRV_DEV_ROOT || process.env.TRV_DEV;
    return {
      paths: {
        [`@travetto/${'*'}`]: [`${process.env.TRV_DEV}/${'*'}`]
      },
      rootDir: root,
      outDir: root,
      sourceRoot: root,
    } as Record<string, unknown>;
  }

  /**
   * Build error module
   * @param message Error message to show
   * @param isModule Is the error a module that should have been loaded
   * @param base The base set of properties to support
   */
  static getErrorModule(message: string, isModule?: string | boolean, base?: Record<string, string | boolean>) {
    const f = ([k, v]: string[]) => `${k}: (t,k) => ${v}`;
    const e = '{ throw new Error(msg); }';
    const map: { [P in keyof ProxyHandler<object>]?: string } = {
      getOwnPropertyDescriptor: base ? '({})' : e,
      get: base ? `{ const v = values[keys.indexOf(k)]; if (!v) ${e} else return v; }` : e,
      has: base ? 'keys.includes(k)' : e
    };
    return [
      (typeof isModule === 'string') ? `console.debug(\`${isModule}\`);` : '',
      base ? `let keys = ['${Object.keys(base).join("','")}']` : '',
      base ? `let values = ['${Object.values(base).join("','")}']` : '',
      `let msg = \`${message}\`;`,
      "Object.defineProperty(exports, 'ᚕtrvError', { value: true })",
      `module.exports = new Proxy({}, { ${Object.entries(map).map(([k, v]) => f([k, v!])).join(',')}});`
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
      return { minus, key, valid: minus ? EnvUtil.isFalse(key) : (EnvUtil.isSet(key) && !EnvUtil.isFalse(key)) };
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
  static get compilerOptions(): unknown {
    if (!this[CompilerOptionsSym]) {
      const ts = getTs();
      const projTsconfig = FsUtil.resolveUnix('tsconfig.json');
      const baseTsconfig = FsUtil.resolveUnix(__dirname, '..', 'tsconfig.json');
      // Fallback to base tsconfig if not found in local folder
      const config = FsUtil.existsSync(projTsconfig) ? projTsconfig : baseTsconfig;
      const json = ts.readJsonConfigFile(config, ts.sys.readFile);
      this[CompilerOptionsSym] = {
        ...ts.parseJsonSourceFileConfigFileContent(json, ts.sys, FsUtil.cwd).options,
        target: ts.ScriptTarget[TS_TARGET],
        rootDir: FsUtil.cwd,
        outDir: FsUtil.cwd,
        sourceRoot: FsUtil.cwd,
        ...(process.env.TRV_DEV ? this.devCompilerOptions : {})
      } as tsi.CompilerOptions;
    }
    return this[CompilerOptionsSym];
  }

  /**
   * Check transpilation errors
   * @param filename The name of the file
   * @param diagnostics The diagnostic errors
   */
  static checkTranspileErrors(filename: string, diagnostics: readonly Diag[]) {
    if (diagnostics && diagnostics.length) {
      const errors: string[] = diagnostics.slice(0, 5).map(diag => {
        const message = getTs().flattenDiagnosticMessageText(diag.messageText, '\n');
        if (diag.file) {
          const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start!);
          return ` @ ${diag.file.fileName.replace(FsUtil.cwd, '.')}(${line + 1}, ${character + 1}): ${message}`;
        } else {
          return ` ${message}`;
        }
      });

      if (diagnostics.length > 5) {
        errors.push(`${diagnostics.length - 5} more ...`);
      }
      throw new Error(`Transpiling ${filename.replace(FsUtil.cwd, '.')} failed: \n${errors.join('\n')}`);
    }
  }

  /**
   * Add support for additional transpilation preprocessor
   * @param fn The preprocessor to add
   */
  static addPreProcessor(fn: Preprocessor) {
    this.PRE_PROCESSORS.unshift(fn);
  }

  /**
   * Pre-processes a typescript file before transpilation
   * @param filename The file to preprocess
   * @param contents The file contents to process
   */
  static preProcess(filename: string, contents?: string) {
    let fileContents = contents ?? fs.readFileSync(filename, 'utf-8');

    // Resolve macro
    fileContents = this.resolveMacros(filename, fileContents);

    for (const preProcessor of this.PRE_PROCESSORS) {
      fileContents = preProcessor(filename, fileContents);
    }

    return fileContents;
  }

  /**
   * Process error response
   * @param phase The load/compile phase to care about
   * @param tsf The typescript filename
   * @param err The error produced
   * @param filename The relative filename
   */
  static handlePhaseError(phase: 'load' | 'compile' | 'transpile', tsf: string, err: Error, filename = tsf.replace(FsUtil.cwd, '.')) {
    if (phase === 'compile' &&
      (err.message.startsWith('Cannot find module') || err.message.startsWith('Unable to load'))
    ) {
      err = new Error(`${err.message} ${err.message.includes('from') ? `[via ${filename}]` : `from ${filename}`}`);
    }

    if (EnvUtil.isWatch() && !filename.startsWith('test/')) {
      console.trace(`Unable to ${phase} ${filename}: stubbing out with error proxy.`, err.message);
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
        const diags: Diag[] = [];
        const ret = getTs().transpile(this.preProcess(tsf), this.compilerOptions as tsi.CompilerOptions, tsf, diags as tsi.Diagnostic[]);
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
    sourceMapSupport.install({
      emptyCacheBetweenOperations: EnvUtil.isWatch(),
      retrieveFile: (p: string) => AppCache.hasEntry(p) ? AppCache.readEntry(p) : undefined!
    });

    // Disable compilation
    if (EnvUtil.isReadonly()) {
      this.transpile = (tsf: string) => AppCache.readEntry(tsf);
    }
  }

  /**
   * Reset
   */
  static reset() {
    AppCache.reset();
    this.PRE_PROCESSORS = [];
  }
}