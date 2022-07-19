import type * as tsi from 'typescript';

import { EnvUtil } from '../env';
import { FsUtil } from '../fs';
import { SourceUtil } from './source-util';
import { PathUtil } from '../path';

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

type CompilerOptions = {
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
  assumeChangesOnlyAffectDirectDependencies?: boolean;
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
  traceResolution?: boolean;
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


/**
 * Standard transpilation support
 */
export class TranspileUtil {
  static #options: Record<string, unknown>; // Untyped so that the typescript typings do not make it into the API

  static #optionsExtra?: CompilerOptions;

  static #readTsConfigOptions(path: string): CompilerOptions {
    const ts = requireTs();
    return ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(path, ts.sys.readFile), ts.sys, PathUtil.cwd
    ).options;
  }

  /**
   * Set extra transpiler options
   * @privates
   */
  static setExtraOptions(opts: CompilerOptions) {
    this.#optionsExtra = { ...this.#optionsExtra ?? {}, ...opts };
  }

  /**
   * Get loaded compiler options
   */
  static get compilerOptions(): CompilerOptions {
    let o: CompilerOptions = {};
    if (this.#optionsExtra) {
      o = this.#optionsExtra;
    }
    if (!this.#options) {
      const opts = o ?? {};
      const rootDir = opts.rootDir ?? PathUtil.cwd;
      const ts = requireTs();
      const projTsconfig = PathUtil.resolveUnix('tsconfig.json');
      const baseTsconfig = PathUtil.resolveUnix(__dirname, '..', '..', 'tsconfig.trv.json');
      // Fallback to base tsconfig if not found in local folder
      const config = FsUtil.existsSync(projTsconfig) ? projTsconfig : baseTsconfig;

      this.#options = {
        ...this.#readTsConfigOptions(config),
        target: ts.ScriptTarget[TS_TARGET],
        rootDir,
        outDir: rootDir,
        sourceRoot: rootDir,
        ...(o ?? {})
      };
    }
    return this.#options;
  }

  /**
   * Check transpilation errors
   * @param filename The name of the file
   * @param diagnostics The diagnostic errors
   */
  static checkTranspileErrors<T extends Diag>(filename: string, diagnostics: readonly T[]) {
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
  static transpileError(tsf: string, err: Error): string {
    if (EnvUtil.isDynamic() && !tsf.startsWith('test')) {
      console.trace(`Unable to transpile ${tsf}: stubbing out with error proxy.`, err.message);
      return SourceUtil.getErrorModule(err.message);
    } else {
      throw err;
    }
  }
}