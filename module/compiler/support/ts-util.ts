import fs from 'node:fs/promises';
import type { CompilerOptions } from 'typescript';

import type { ManifestContext } from '@travetto/manifest';
import { CommonUtil } from './util';

const OPT_CACHE: Record<string, CompilerOptions> = {};

export class TypescriptUtil {
  /**
     * Returns the compiler options
     */
  static async getCompilerOptions(ctx: ManifestContext): Promise<{}> {
    if (!(ctx.workspace.path in OPT_CACHE)) {
      let tsconfig = CommonUtil.resolveWorkspace(ctx, 'tsconfig.json');

      if (!await fs.stat(tsconfig).then(_ => true, _ => false)) {
        tsconfig = CommonUtil.resolveWorkspace(ctx, ctx.build.compilerModuleFolder, 'tsconfig.trv.json');
      }

      const ts = (await import('typescript')).default;

      const { options } = ts.parseJsonSourceFileConfigFileContent(
        ts.readJsonConfigFile(tsconfig, ts.sys.readFile), ts.sys, ctx.workspace.path
      );

      OPT_CACHE[ctx.workspace.path] = {
        ...options,
        allowJs: true,
        resolveJsonModule: true,
        sourceRoot: ctx.workspace.path,
        rootDir: ctx.workspace.path,
        outDir: CommonUtil.resolveWorkspace(ctx),
        moduleResolution: (ctx.workspace.type === 'commonjs' ? ts.ModuleResolutionKind.Node16 : ts.ModuleResolutionKind.Bundler),
        module: ctx.workspace.type === 'commonjs' ? ts.ModuleKind.Node16 : ts.ModuleKind.ESNext,
      };
    }
    return OPT_CACHE[ctx.workspace.path];
  }
}