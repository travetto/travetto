import type { CompilerOptions } from 'typescript';

import type { ManifestContext } from '@travetto/manifest';
import { CommonUtil } from './util.ts';

const OPT_CACHE: Record<string, CompilerOptions> = {};

export class TypescriptUtil {
  /**
     * Returns the compiler options
     */
  static async getCompilerOptions(ctx: ManifestContext): Promise<{}> {
    if (!(ctx.workspace.path in OPT_CACHE)) {
      let tsconfig = CommonUtil.resolveWorkspace(ctx, 'tsconfig.json');

      const ts = (await import('typescript')).default;

      const { options } = ts.parseJsonSourceFileConfigFileContent(
        ts.readJsonConfigFile(tsconfig, ts.sys.readFile), ts.sys, ctx.workspace.path
      );

      OPT_CACHE[ctx.workspace.path] = {
        ...options,
        noEmit: false,
        emitDeclarationOnly: false,
        allowJs: true,
        resolveJsonModule: true,
        sourceRoot: ctx.workspace.path,
        rootDir: ctx.workspace.path,
        outDir: CommonUtil.resolveWorkspace(ctx),
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        module: ts.ModuleKind.ESNext,
      };
    }
    return OPT_CACHE[ctx.workspace.path];
  }
}