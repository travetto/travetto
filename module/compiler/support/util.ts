import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';

import type { ManifestContext } from '@travetto/manifest';

import { LogUtil } from './log';

const OPT_CACHE: Record<string, import('typescript').CompilerOptions> = {};
const SRC_REQ = createRequire(path.resolve('node_modules'));

export class CommonUtil {
  /**
   * Returns the compiler options
   */
  static async getCompilerOptions(ctx: ManifestContext): Promise<{}> {
    if (!(ctx.workspacePath in OPT_CACHE)) {
      let tsconfig = path.resolve(ctx.workspacePath, 'tsconfig.json');

      if (!await fs.stat(tsconfig).then(_ => true, _ => false)) {
        tsconfig = SRC_REQ.resolve('@travetto/compiler/tsconfig.trv.json');
      }

      const ts = (await import('typescript')).default;

      const { options } = ts.parseJsonSourceFileConfigFileContent(
        ts.readJsonConfigFile(tsconfig, ts.sys.readFile), ts.sys, ctx.workspacePath
      );

      OPT_CACHE[ctx.workspacePath] = {
        ...options,
        allowJs: true,
        resolveJsonModule: true,
        sourceRoot: ctx.workspacePath,
        rootDir: ctx.workspacePath,
        outDir: path.resolve(ctx.workspacePath),
        module: ctx.moduleType === 'commonjs' ? ts.ModuleKind.CommonJS : ts.ModuleKind.ESNext,
      };
    }
    return OPT_CACHE[ctx.workspacePath];
  }

  /**
   * Resolve module location
   */
  static resolveModuleFolder(mod: string): string {
    return path.dirname(SRC_REQ.resolve(`${mod}/package.json`));
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
    outer: while (!parent.aborted) {
      const controller = new AbortController();
      // Chain
      parent.addEventListener('abort', () => controller.abort());

      const comp = src(controller.signal);

      LogUtil.log('event-stream', [], 'debug', 'Started event stream');

      // Wait for all events, close at the end
      for await (const ev of comp) {
        yield ev;
        if (shouldRestart(ev)) {
          controller.abort(); // Ensure terminated of process
          continue outer;
        }
      }

      LogUtil.log('event-stream', [], 'debug', 'Finished event stream');

      // Natural exit, we done
      if (!controller.signal.aborted) { // Shutdown source if still running
        controller.abort();
      }
      return;
    }
  }

  /**
   * Run cli
   */
  static async runCli(ctx: ManifestContext): Promise<void> {
    // TODO: Externalize somehow?
    const outputPath = path.resolve(ctx.workspacePath, ctx.outputFolder);
    process.env.TRV_MANIFEST = path.resolve(outputPath, 'node_modules', ctx.mainModule);
    const cliMain = path.join(outputPath, 'node_modules', '@travetto/cli/support/entry.cli.js');
    return import(cliMain);
  }
}