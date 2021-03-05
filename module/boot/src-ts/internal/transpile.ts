import type * as tsi from 'typescript';

import { EnvUtil } from '../env';
import { FsUtil } from '../fs';
import { AppCache } from '../cache';
import { ModuleUtil } from './module';
import { SourceUtil } from './source';

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
   * Get loaded compiler options
   */
  static get compilerOptions(): unknown {
    if (!this[CompilerOptionsSym]) {
      const ts = getTs();
      const projTsconfig = FsUtil.resolveUnix('tsconfig.json');
      const baseTsconfig = FsUtil.resolveUnix(__dirname, '..', '..', 'tsconfig.trv.json');
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
   * Transpile, and cache
   * @param tsf The typescript file to transpile
   * @param force Force transpilation, even if cached
   */
  static transpileSimple(tsf: string, force = false) {
    return AppCache.getOrSet(tsf, () => {
      try {
        const diags: Diag[] = [];
        const ret = getTs().transpile(SourceUtil.preProcess(tsf), this.compilerOptions as tsi.CompilerOptions, tsf, diags as tsi.Diagnostic[]);
        this.checkTranspileErrors(tsf, diags);
        return ret;
      } catch (e) {
        return ModuleUtil.handlePhaseError('transpile', tsf, e);
      }
    }, force);
  }
}