import { readFileSync } from 'fs';

type SourceHandler = (name: string, contents: string) => string;

const CONSOLE_RE = /(\bconsole[.](debug|info|warn|log|error)[(])|\n/g;


/**
 * Source Utilities
 */
export class SourceUtil {

  static #handlers: SourceHandler[] = [
    // Tag output to indicate it was successfully processed by the framework
    (__, contents): string =>
      `${contents}\nObject.defineProperty(exports, 'ᚕtrv', { configurable: true, value: true });`,

    // Drop typescript import, and use global. Great speedup;
    (_, contents): string =>
      contents.replace(/^import\s+[*]\s+as\s+ts\s+from\s+'typescript';/mg, x => `// ${x}`),

    // Insert filename, line into all log statements for all components
    (_, contents): string => {
      let line = 1;
      contents = contents.replace(CONSOLE_RE, (a, cmd, lvl) => {
        if (a === '\n') {
          line += 1;
          return a;
        } else {
          lvl = lvl === 'log' ? 'info' : lvl;
          return `ᚕlog('${lvl}', { file: ᚕsrc(__filename), line: ${line} },`; // Make ConsoleManager target for all console invokes
        }
      });
      return contents;
    }
  ];

  static readonly EXT = '.ts';

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
}