import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import cp from 'child_process';
import { createRequire } from 'module';

import { DeltaEvent, ManifestContext, ManifestRoot, Package } from '@travetto/manifest';

export type CompilerLogEvent = [level: 'info' | 'debug' | 'warn', message: string];
type ModFile = { input: string, output: string, stale: boolean };
type WithLogger<T> = (log: (...ev: CompilerLogEvent) => void) => Promise<T>;

const OPT_CACHE: Record<string, import('typescript').CompilerOptions> = {};
const SRC_REQ = createRequire(path.resolve('node_modules'));
const LEVELS = { warn: true, debug: /^debug$/.test(process.env.TRV_BUILD ?? ''), info: !/^warn$/.test(process.env.TRV_BUILD ?? '') };
const SCOPE_MAX = 15;
const RECENT_STAT = (stat: { ctimeMs: number, mtimeMs: number }): number => Math.max(stat.ctimeMs, stat.mtimeMs);
const IS_LOG_EV = (o: unknown): o is CompilerLogEvent => o !== null && o !== undefined && Array.isArray(o);

/**
 * Transpile utilities for launching
 */
export class TranspileUtil {
  /**
   * Log message with filtering by level
   */
  static log(scope: string, args: string[], ...[level, msg]: CompilerLogEvent): void {
    const message = msg.replaceAll(process.cwd(), '.');
    LEVELS[level] && console.debug(new Date().toISOString(), `[${scope.padEnd(SCOPE_MAX, ' ')}]`, ...args, message);
  }

  /**
   * With logger
   */
  static withLogger<T>(scope: string, op: WithLogger<T>, basic = true, args: string[] = []): Promise<T> {
    const log = this.log.bind(null, scope, args);
    basic && log('debug', 'Started');
    return op(log).finally(() => basic && log('debug', 'Completed'));
  }

  /**
   * Write text file, and ensure folder exists
   */
  static writeTextFile = (file: string, content: string): Promise<void> =>
    fs.mkdir(path.dirname(file), { recursive: true }).then(() => fs.writeFile(file, content));

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
   * Output a file, support for ts, js, and package.json
   */
  static async transpileFile(ctx: ManifestContext, inputFile: string, outputFile: string): Promise<void> {
    if (inputFile.endsWith('.ts') || inputFile.endsWith('.js')) {
      const compilerOut = path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules');

      const text = (await fs.readFile(inputFile, 'utf8'))
        .replace(/from '([.][^']+)'/g, (_, i) => `from '${i.replace(/[.]js$/, '')}.js'`)
        .replace(/from '(@travetto\/(.*?))'/g, (_, i, s) => `from '${path.resolve(compilerOut, `${i}${s.includes('/') ? '.js' : '/__index__.js'}`)}'`);

      const ts = (await import('typescript')).default;
      const content = ts.transpile(text, await this.getCompilerOptions(ctx), inputFile);
      await this.writeTextFile(outputFile, content);
    } else if (inputFile.endsWith('package.json')) {
      const pkg: Package = JSON.parse(await fs.readFile(inputFile, 'utf8'));
      const main = pkg.main?.replace(/[.]ts$/, '.js');
      const files = pkg.files?.map(x => x.replace('.ts', '.js'));

      const content = JSON.stringify({ ...pkg, main, type: ctx.moduleType, files }, null, 2);
      await this.writeTextFile(outputFile, content);
    }
  }

  /**
   * Scan directory to find all project sources for comparison
   */
  static async getModuleSources(ctx: ManifestContext, module: string, seed: string[]): Promise<ModFile[]> {
    const inputFolder = (ctx.mainModule === module) ?
      process.cwd() :
      path.dirname(SRC_REQ.resolve(`${module}/package.json`));

    const folders = seed.filter(x => !/[.]/.test(x)).map(x => path.resolve(inputFolder, x));
    const files = seed.filter(x => /[.]/.test(x)).map(x => path.resolve(inputFolder, x));

    while (folders.length) {
      const sub = folders.pop();
      if (!sub) {
        continue;
      }

      for (const file of await fs.readdir(sub).catch(() => [])) {
        if (file.startsWith('.')) {
          continue;
        }
        const resolvedInput = path.resolve(sub, file);
        const stat = await fs.stat(resolvedInput);

        if (stat.isDirectory()) {
          folders.push(resolvedInput);
        } else if (file.endsWith('.d.ts')) {
          // Do nothing
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
          files.push(resolvedInput);
        }
      }
    }

    const outputFolder = path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules', module);
    const out: ModFile[] = [];
    for (const input of files) {
      const output = input.replace(inputFolder, outputFolder).replace(/[.]ts$/, '.js');
      const inputTs = await fs.stat(input).then(RECENT_STAT, () => 0);
      if (inputTs) {
        const outputTs = await fs.stat(output).then(RECENT_STAT, () => 0);
        await fs.mkdir(path.dirname(output), { recursive: true, });
        out.push({ input, output, stale: inputTs > outputTs });
      }
    }

    return out;
  }

  /**
   * Run compiler
   */
  static async runCompiler(ctx: ManifestContext, manifest: ManifestRoot, changed: DeltaEvent[], watch = false): Promise<void> {
    const compiler = path.resolve(ctx.workspacePath, ctx.compilerFolder);
    const main = path.resolve(compiler, 'node_modules', '@travetto/compiler/support/compiler-entry.js');
    const deltaFile = path.resolve(os.tmpdir(), `manifest-delta.${Date.now()}.${Math.random()}.json`);

    const changedFiles = changed[0]?.file === '*' ? ['*'] : changed.map(ev =>
      path.resolve(manifest.workspacePath, manifest.modules[ev.module].sourceFolder, ev.file)
    );

    await this.writeTextFile(deltaFile, changedFiles.join('\n'));

    await this.withLogger('compiler-exec', log => new Promise((res, rej) =>
      cp.spawn(process.argv0, [main, deltaFile, `${watch}`], {
        env: {
          ...process.env,
          TRV_MANIFEST: path.resolve(ctx.workspacePath, ctx.outputFolder, 'node_modules', ctx.mainModule),
        },
        stdio: [0, 1, 2, 'ipc'],
      })
        .on('message', msg => IS_LOG_EV(msg) && log(...msg))
        .on('exit', code => (code !== null && code > 0) ? rej() : res(null))
    )).finally(() => fs.unlink(deltaFile));
  }
}