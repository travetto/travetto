import fs from 'node:fs/promises';
import path from 'node:path';
import { setMaxListeners } from 'node:events';

import type { ManifestContext } from '@travetto/manifest';

import { LogUtil } from './log';

const OPT_CACHE: Record<string, import('typescript').CompilerOptions> = {};

export class CommonUtil {
  /**
   * Returns the compiler options
   */
  static async getCompilerOptions(ctx: ManifestContext): Promise<{}> {
    if (!(ctx.workspace.path in OPT_CACHE)) {
      let tsconfig = path.resolve(ctx.workspace.path, 'tsconfig.json');

      if (!await fs.stat(tsconfig).then(_ => true, _ => false)) {
        tsconfig = path.resolve(ctx.workspace.path, ctx.build.compilerModuleFolder, 'tsconfig.trv.json');
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
        outDir: path.resolve(ctx.workspace.path),
        module: ctx.workspace.type === 'commonjs' ? ts.ModuleKind.CommonJS : ts.ModuleKind.ESNext,
      };
    }
    return OPT_CACHE[ctx.workspace.path];
  }

  /**
   * Determine file type
   */
  static getFileType(file: string): 'ts' | 'js' | 'package-json' | 'typings' | undefined {
    return file.endsWith('package.json') ? 'package-json' :
      (file.endsWith('.js') ? 'js' :
        (file.endsWith('.d.ts') ? 'typings' : (/[.]tsx?$/.test(file) ? 'ts' : undefined)));
  }

  /**
   * Write text file, and ensure folder exists
   */
  static writeTextFile = (file: string, content: string): Promise<void> =>
    fs.mkdir(path.dirname(file), { recursive: true }).then(() => fs.writeFile(file, content, 'utf8'));

  /**
   * Restartable Event Stream
   */
  static async * restartableEvents<T>(src: (signal: AbortSignal) => AsyncIterable<T>, parent: AbortSignal, shouldRestart: (item: T) => boolean): AsyncIterable<T> {
    const log = LogUtil.logger('event-stream');
    outer: while (!parent.aborted) {
      const controller = new AbortController();
      setMaxListeners(1000, controller.signal);
      // Chain
      parent.addEventListener('abort', () => controller.abort());

      const comp = src(controller.signal);

      log('debug', 'Started event stream');

      // Wait for all events, close at the end
      for await (const ev of comp) {
        yield ev;
        if (shouldRestart(ev)) {
          log('debug', 'Restarting stream');
          controller.abort(); // Ensure terminated of process
          continue outer;
        }
      }

      log('debug', 'Finished event stream');

      // Natural exit, we done
      if (!controller.signal.aborted) { // Shutdown source if still running
        controller.abort();
      }
      return;
    }
  }

  /**
   * Create a module loader given a context, and assuming build is complete
   * @param ctx
   */
  static moduleLoader(ctx: ManifestContext): (mod: string) => Promise<unknown> {
    return (mod) => {
      const outputRoot = path.resolve(ctx.workspace.path, ctx.build.outputFolder);
      process.env.TRV_MANIFEST = path.resolve(outputRoot, 'node_modules', ctx.main.name); // Setup for running
      return import(path.join(outputRoot, 'node_modules', mod)); // Return function to run import on a module
    };
  }
}