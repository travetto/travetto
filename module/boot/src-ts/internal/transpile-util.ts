import type * as tsi from 'typescript';
import { readFileSync } from 'fs';

import { EnvUtil } from '../env';
import { PathUtil } from '../path';
import { Host } from '../host';

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const requireTs = (): typeof tsi => require('typescript') as typeof tsi;

type Diag = {
  start?: number;
  messageText: string | { messageText: string, category: 0 | 1 | 2 | 3, code: number };
  file?: {
    fileName: string;
    getLineAndCharacterOfPosition(start: number): { line: number, character: number };
  };
};

declare global {
  // eslint-disable-next-line no-var
  var ts: unknown;
}

export type TypescriptCompilerOptions = {
  allowJs?: boolean;
  allowSyntheticDefaultImports?: boolean;
  allowUmdGlobalAccess?: boolean;
  allowUnreachableCode?: boolean;
  allowUnusedLabels?: boolean;
  alwaysStrict?: boolean;
  baseUrl?: string;
  charset?: string;
  checkJs?: boolean;
  declaration?: boolean;
  declarationMap?: boolean;
  emitDeclarationOnly?: boolean;
  declarationDir?: string;
  disableSizeLimit?: boolean;
  disableSourceOfProjectReferenceRedirect?: boolean;
  disableSolutionSearching?: boolean;
  disableReferencedProjectLoad?: boolean;
  downlevelIteration?: boolean;
  exactOptionalPropertyTypes?: boolean;
  experimentalDecorators?: boolean;
  forceConsistentCasingInFileNames?: boolean;
  importHelpers?: boolean;
  inlineSourceMap?: boolean;
  inlineSources?: boolean;
  isolatedModules?: boolean;
  keyofStringsOnly?: boolean;
  lib?: string[];
  locale?: string;
  mapRoot?: string;
  maxNodeModuleJsDepth?: number;
  moduleSuffixes?: string[];
  noEmit?: boolean;
  noEmitHelpers?: boolean;
  noEmitOnError?: boolean;
  noErrorTruncation?: boolean;
  noFallthroughCasesInSwitch?: boolean;
  noImplicitAny?: boolean;
  noImplicitReturns?: boolean;
  noImplicitThis?: boolean;
  noStrictGenericChecks?: boolean;
  noUnusedLocals?: boolean;
  noUnusedParameters?: boolean;
  noImplicitUseStrict?: boolean;
  noPropertyAccessFromIndexSignature?: boolean;
  noLib?: boolean;
  noResolve?: boolean;
  noUncheckedIndexedAccess?: boolean;
  paths?: Record<string, string[]>;
  preserveConstEnums?: boolean;
  noImplicitOverride?: boolean;
  preserveSymlinks?: boolean;
  preserveValueImports?: boolean;
  rootDir?: string;
  rootDirs?: string[];
  skipLibCheck?: boolean;
  skipDefaultLibCheck?: boolean;
  sourceMap?: boolean;
  sourceRoot?: string;
  strict?: boolean;
  strictFunctionTypes?: boolean;
  strictBindCallApply?: boolean;
  strictNullChecks?: boolean;
  strictPropertyInitialization?: boolean;
  stripInternal?: boolean;
  suppressExcessPropertyErrors?: boolean;
  suppressImplicitAnyIndexErrors?: boolean;
  useUnknownInCatchVariables?: boolean;
  resolveJsonModule?: boolean;
  types?: string[];
  /** Paths used to compute primary types search locations */
  typeRoots?: string[];
};

const NODE_VERSION = EnvUtil.get('TRV_NODE_VERSION', process.version)
  .replace(/^.*?(\d+).*?$/, (_, v) => v);
const TS_TARGET = ({
  12: 'ES2019',
  13: 'ES2019',
  14: 'ES2020',
  15: 'ESNext',
  16: 'ESNext'
} as const)[NODE_VERSION] ?? 'ESNext'; // Default if not found

type SourceHandler = (text: string) => string;

const CONSOLE_RE = /(\bconsole[.](debug|info|warn|log|error)[(])|\n/g;

const SOURCE_HANDLERS: SourceHandler[] = [
  // Tag source as processed by framework
  (text): string => `${text}\nObject.defineProperty(exports, 'ᚕtrv', { configurable: true, value: true });`,
  // Suppress typescript imports, and use a global proxy for performance
  (text): string => text.replace(/^import\s+[*]\s+as\s+ts\s+from\s+'typescript';/mg, x => `// ${x}`),
  // Modify console.log statements to include file and line
  (text): string => {
    let line = 1;
    text = text.replace(CONSOLE_RE, (a, cmd, lvl) => {
      if (a === '\n') {
        line += 1;
        return a;
      } else {
        lvl = lvl === 'log' ? 'info' : lvl;
        return `ᚕlog('${lvl}', { file: __filename, line: ${line} },`;
      }
    });
    return text;
  }
];

/**
 * Standard transpilation support
 */
export class TranspileUtil {

  /**
   * Read the given tsconfig.json values for the project
   * @param path
   * @returns
   */
  static readTsConfigOptions(path: string): TypescriptCompilerOptions {
    const ts = requireTs();
    const { options } = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(path, ts.sys.readFile), ts.sys, PathUtil.cwd
    );
    options.target = ts.ScriptTarget[TS_TARGET];
    return options;
  }

  /**
   * Build error module source
   * @param message Error message to show
   * @param isModule Is the error a module that should have been loaded
   * @param base The base set of properties to support
   */
  static getErrorModuleSource(message: string, isModule?: string | boolean, base?: Record<string, string | boolean>): string {
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
    // Inject into global space as 'ts', only when applying logic
    if (!('ts' in global)) {
      global.ts = new Proxy({}, {
        // Load on demand, and replace on first use
        get: (t, prop, r): unknown => (global.ts = require('typescript'))[prop]
      });
    }

    let fileContents = contents ?? readFileSync(filename, 'utf-8');

    for (const handler of SOURCE_HANDLERS) {
      fileContents = handler(fileContents);
    }

    return fileContents;
  }

  /**
   * Check transpilation errors
   * @param filename The name of the file
   * @param diagnostics The diagnostic errors
   */
  static checkTranspileErrors<T extends Diag>(filename: string, diagnostics: readonly T[]): void {
    if (diagnostics && diagnostics.length) {
      const errors: string[] = diagnostics.slice(0, 5).map(diag => {
        const ts = requireTs();
        const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
        if (diag.file) {
          const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start!);
          return ` @ ${diag.file.fileName.replace(PathUtil.cwd, '.')}(${line + 1}, ${character + 1}): ${message}`;
        } else {
          return ` ${message}`;
        }
      });

      if (diagnostics.length > 5) {
        errors.push(`${diagnostics.length - 5} more ...`);
      }
      throw new Error(`Transpiling ${filename.replace(PathUtil.cwd, '.')} failed: \n${errors.join('\n')}`);
    }
  }

  /**
   * Handle transpilation errors
   */
  static handleTranspileError(tsf: string, err: Error): string {
    if (EnvUtil.isDynamic() && !tsf.startsWith(Host.PATH.test)) {
      console.trace(`Unable to transpile ${tsf}: stubbing out with error proxy.`, err.message);
      return this.getErrorModuleSource(err.message);
    } else {
      throw err;
    }
  }

  /**
   * Simple transpilation
   * @param tsf file to transpile
   * @returns
   */
  static simpleTranspile(tsf: string, options: TypescriptCompilerOptions): string {
    try {
      const diags: tsi.Diagnostic[] = [];
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const ts = requireTs();
      const ret = ts.transpile(this.preProcess(tsf), options, tsf, diags);
      this.checkTranspileErrors(tsf, diags);
      return ret;
    } catch (err: unknown) {
      if (!(err instanceof Error)) {
        throw err;
      }
      return this.handleTranspileError(tsf, err);
    }
  }

  /**
   * Convert an input file to a unix source file
   * @param file .ts or .js file to convert
   */
  static toUnixSource(file: string): string {
    return file.replace(/[\\\/]+/g, '/').replace(Host.EXT.outputRe, Host.EXT.input);
  }

  /**
   * Process error response
   * @param phase The load/compile phase to care about
   * @param tsf The typescript filename
   * @param err The error produced
   * @param filename The relative filename
   */
  static handlePhaseError(phase: 'load' | 'compile', tsf: string, err: Error, filename = tsf.replace(PathUtil.cwd, '.')): string {
    if (phase === 'compile' &&
      (err.message.startsWith('Cannot find module') || err.message.startsWith('Unable to load'))
    ) {
      err = new Error(`${err.message} ${err.message.includes('from') ? `[via ${filename}]` : `from ${filename}`}`);
    }

    if (EnvUtil.isDynamic() && !filename.startsWith('test/')) {
      console.trace(`Unable to ${phase} ${filename}: stubbing out with error proxy.`, err.message);
      return this.getErrorModuleSource(err.message);
    }

    throw err;
  }
}