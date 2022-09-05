import { readFileSync } from 'fs';

type SourceHandler = (name: string, contents: string) => string;

declare global {
  // eslint-disable-next-line no-var
  var ts: unknown;
}

// Inject into global space as 'ts'
global.ts = new Proxy({}, {
  // Load on demand, and replace on first use
  get: (t, prop, r): unknown => (global.ts = require('typescript'))[prop]
});

/**
 * Source Utilities
 */
export class SourceUtil {

  static #handlers: SourceHandler[] = [];

  static readonly EXT = '.ts';

  static init(): void {
    // Tag output to indicate it was successfully processed by the framework
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
  static getErrorModule(message: string, isModule?: string | boolean, base?: Record<string, string | boolean>): string {
    const f = ([k, v]: string[]): string => `${k}: (t,k) => ${v}`;
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
   * Pre-processes a typescript source file
   * @param filename The file to preprocess
   * @param contents The file contents to process
   */
  static preProcess(filename: string, contents?: string): string {
    let fileContents = contents ?? readFileSync(filename, 'utf-8');

    for (const handler of this.#handlers) {
      fileContents = handler(filename, fileContents);
    }

    return fileContents;
  }

  /**
   * Add support for source preprocessor
   * @param fn The preprocessor to add
   */
  static addPreProcessor(fn: SourceHandler): void {
    this.#handlers.unshift(fn);
  }

  /**
   * Clear out on cleanup
   */
  static reset(): void {
    this.#handlers = [];
  }
}