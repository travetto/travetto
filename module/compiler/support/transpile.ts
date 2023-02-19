import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import cp from 'child_process';
import { createRequire } from 'module';

import { DeltaEvent, ManifestContext, ManifestRoot, Package } from '@travetto/manifest';

import { LogUtil } from './log';

type ModFile = { input: string, output: string, stale: boolean };
export type CompileResult = 'restart' | 'complete' | 'skipped';

const OPT_CACHE: Record<string, import('typescript').CompilerOptions> = {};
const SRC_REQ = createRequire(path.resolve('node_modules'));
const RECENT_STAT = (stat: { ctimeMs: number, mtimeMs: number }): number => Math.max(stat.ctimeMs, stat.mtimeMs);

/**
 * Transpile utilities for launching
 */
export class TranspileUtil {
  /**
   * Write text file, and ensure folder exists
   */
  static writeTextFile = (file: string, content: string): Promise<void> =>
    fs.mkdir(path.dirname(file), { recursive: true }).then(() => fs.writeFile(file, content, 'utf8'));

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
 * Recompile folder if stale
 */
  static async compileIfStale(ctx: ManifestContext, scope: string, mod: string, seed: string[]): Promise<string[]> {
    const files = await this.getModuleSources(ctx, mod, seed);
    const changes = files.filter(x => x.stale).map(x => x.input);
    const out: string[] = [];

    try {
      await LogUtil.withLogger(scope, async log => {
        if (files.some(f => f.stale)) {
          log('debug', 'Starting');
          for (const file of files.filter(x => x.stale)) {
            await this.transpileFile(ctx, file.input, file.output);
          }
          if (changes.length) {
            out.push(...changes.map(x => `${mod}/${x}`));
            log('debug', `Source changed: ${changes.join(', ')}`);
          }
          log('debug', 'Completed');
        } else {
          log('debug', 'Skipped');
        }
      }, false, [mod]);
    } catch (err) {
      console.error(err);
    }
    return out;
  }

  /**
   * Run compiler
   */
  static async runCompiler(ctx: ManifestContext, manifest: ManifestRoot, changed: DeltaEvent[], watch: boolean, onMessage: (msg: unknown) => void): Promise<CompileResult> {
    const compiler = path.resolve(ctx.workspacePath, ctx.compilerFolder);
    const main = path.resolve(compiler, 'node_modules', '@travetto/compiler/support/compiler-entry.js');
    const deltaFile = path.resolve(os.tmpdir(), `manifest-delta.${Date.now()}.${Math.random()}.json`);

    const changedFiles = changed[0]?.file === '*' ? ['*'] : changed.map(ev =>
      path.resolve(manifest.workspacePath, manifest.modules[ev.module].sourceFolder, ev.file)
    );

    let proc: cp.ChildProcess | undefined;

    try {
      await this.writeTextFile(deltaFile, changedFiles.join('\n'));

      return await LogUtil.withLogger('compiler-exec', log => new Promise<CompileResult>((res, rej) => {
        proc = cp.spawn(process.argv0, [main, deltaFile, `${watch}`], {
          env: {
            ...process.env,
            TRV_MANIFEST: path.resolve(ctx.workspacePath, ctx.outputFolder, 'node_modules', ctx.mainModule),
          },
          stdio: [0, 1, 2, 'ipc'],
        })
          .on('message', msg => {
            if (LogUtil.isLogEvent(msg)) {
              log(...msg);
            } else if (msg === 'restart') {
              res(msg);
            } else {
              onMessage(msg);
            }
          })
          .on('exit', code => (code !== null && code > 0) ? rej(new Error('Failed during compilation')) : res('complete'));
      }));
    } finally {
      if (proc?.killed === false) { proc.kill('SIGKILL'); }
      await fs.rm(deltaFile, { force: true });
    }
  }
}