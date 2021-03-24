import type * as tsi from 'typescript';

import { EnvUtil } from '../env';
import { FsUtil } from '../fs';
import { SourceUtil } from './source-util';
import { PathUtil } from '../path';

type Diag = {
  start?: number;
  messageText: string | { messageText: string, category: 0 | 1 | 2 | 3, code: number };
  file?: {
    fileName: string;
    getLineAndCharacterOfPosition(start: number): { line: number, character: number };
  };
};

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
 * Standard transpilation support
 */
export class TranspileUtil {
  private static [CompilerOptionsSym]: Record<string, unknown>; // Untyped so that the typescript typings do not make it into the API

  private static optionsExtra?: Record<string, unknown>;

  private static readTsConfigOptions(path: string) {
    const ts = require('typescript') as typeof tsi;
    return ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(path, ts.sys.readFile), ts.sys, PathUtil.cwd
    ).options;
  }

  /**
   * Get loaded compiler options
   */
  static get compilerOptions(): Record<string, unknown> {
    if (!this[CompilerOptionsSym]) {
      const opts = this.optionsExtra ?? {};
      const rootDir = opts.rootDir ?? PathUtil.cwd;
      const ts = require('typescript') as typeof tsi;
      const projTsconfig = PathUtil.resolveUnix('tsconfig.json');
      const baseTsconfig = PathUtil.resolveUnix(__dirname, '..', '..', 'tsconfig.trv.json');
      // Fallback to base tsconfig if not found in local folder
      const config = FsUtil.existsSync(projTsconfig) ? projTsconfig : baseTsconfig;

      this[CompilerOptionsSym] = {
        ...this.readTsConfigOptions(config),
        target: ts.ScriptTarget[TS_TARGET],
        rootDir,
        outDir: rootDir,
        sourceRoot: rootDir,
        ...(this.optionsExtra ?? {})
      } as tsi.CompilerOptions;
    }
    return this[CompilerOptionsSym];
  }

  /**
   * Check transpilation errors
   * @param filename The name of the file
   * @param diagnostics The diagnostic errors
   */
  static checkTranspileErrors<T extends Diag>(filename: string, diagnostics: readonly T[]) {
    if (diagnostics && diagnostics.length) {
      const errors: string[] = diagnostics.slice(0, 5).map(diag => {
        const ts = require('typescript') as typeof tsi;
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
  static transpileError(tsf: string, err: Error) {
    if (EnvUtil.isWatch() && !tsf.startsWith('test')) {
      console.trace(`Unable to transpile ${tsf}: stubbing out with error proxy.`, err.message);
      return SourceUtil.getErrorModule(err.message);
    } else {
      throw err;
    }
  }
}