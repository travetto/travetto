import * as fs from 'fs';
import { EnvUtil } from '../env';

type SourceHandler = (name: string, contents: string) => string;

declare global {
  // eslint-disable-next-line no-var
  var ts: unknown;
}

// Inject into global space as 'ts'
global.ts = new Proxy({}, {
  // Load on demand, and replace on first use
  get: (t, p, r) => (global.ts = require('typescript'))[p]
});

/**
 * Source Utilities
 */
export class SourceUtil {

  static #handlers: SourceHandler[] = [];

  static readonly EXT = '.ts';

  static init() {
    // Tag output to indicate it was succefully processed by the framework
    this.addPreProcessor((__, contents) =>
      `${contents}\nObject.defineProperty(exports, 'ᚕtrv', { configurable: true, value: true });`);

    // Drop typescript import, and use global. Great speedup;
    this.addPreProcessor((_, contents) =>
      contents.replace(/^import\s+[*]\s+as\s+ts\s+from\s+'typescript';/mg, x => `// ${x}`));
  }

  /**
   * Build error module source
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
        return { minus, key, valid: minus, err: err as Error };
      }
    }
  }

  /**
   * Resolve macros for keeping/removing text
   * @param name The name of the file to resolve macros for
   * @param contents The file contents
   */
  static resolveMacros(contents: string) {
    const errors: string[] = [];

    // Handle line queries
    contents = contents.replace(/^.*[/][/]\s*@(line|file)-if\s+(.*?)\s*$/mg, (all, mode, token: string) => {
      if (errors.length) {
        return ''; // Short circuit
      }
      const { valid, key, minus } = this.resolveToken(token);
      if (valid) {
        return all;
      } else {
        if (mode === 'file') {
          errors.push(`Dependency ${key} should${minus ? ' not' : ''} be installed`);
        }
        return `// @removed ${token} was not satisfied`;
      }
    });

    return { errors, contents };
  }


  /**
   * Pre-processes a typescript source file
   * @param filename The file to preprocess
   * @param contents The file contents to process
   */
  static preProcess(filename: string, contents?: string) {
    let fileContents = contents ?? fs.readFileSync(filename, 'utf-8');

    // Resolve macro
    const { contents: text, errors } = this.resolveMacros(fileContents);

    if (errors.length) {
      const [err] = errors;
      fileContents = this.getErrorModule(err, `Skipping: ${err}`, { ᚕtrv: true, filename });
    } else {
      fileContents = text;
    }

    for (const handler of this.#handlers) {
      fileContents = handler(filename, fileContents);
    }

    return fileContents;
  }

  /**
   * Add support for source preprocessor
   * @param fn The preprocessor to add
   */
  static addPreProcessor(fn: SourceHandler) {
    this.#handlers.unshift(fn);
  }

  /**
   * Clear out on cleanup
   */
  static reset() {
    this.#handlers = [];
  }
}