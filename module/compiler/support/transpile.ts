import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import timers from 'timers/promises';
import cp from 'child_process';
import { createRequire } from 'module';

import { DeltaEvent, ManifestContext, ManifestRoot, Package } from '@travetto/manifest';

import { LogUtil } from './log';

type ModFile = { input: string, output: string, stale: boolean };
export type CompileResult = 'restart' | 'complete' | 'skipped';
export type BuildEvent = { type: 'restart' | 'start' | 'complete' } | { type: 'status', idx: number, total: number };

const OPT_CACHE: Record<string, import('typescript').CompilerOptions> = {};
const SRC_REQ = createRequire(path.resolve('node_modules'));
const RECENT_STAT = (stat: { ctimeMs: number, mtimeMs: number }): number => Math.max(stat.ctimeMs, stat.mtimeMs);

const isBuildEvent = (ev: unknown): ev is BuildEvent =>
  ev !== undefined && ev !== null && typeof ev === 'object' && 'type' in ev && typeof ev.type === 'string';

/**
 * Transpile utilities for launching
 */
export class TranspileUtil {
  /**
   * Determine file type
   */
  static getFileType(file: string): 'ts' | 'js' | 'package-json' | 'typings' | undefined {
    return file.endsWith('package.json') ? 'package-json' :
      (file.endsWith('.js') ? 'js' :
        (file.endsWith('.d.ts') ? 'typings' : (/[.]tsx?$/.test(file) ? 'ts' : undefined)));
  }

  /**  Convert a file to a given ext */
  static #sourceToExtension(inputFile: string, ext: string): string {
    return inputFile.replace(/[.][tj]sx?$/, ext);
  }

  /**
   * Get the output file name for a given input
   */
  static sourceToOutputExt(inputFile: string): string {
    return this.#sourceToExtension(inputFile, '.js');
  }

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
    const type = this.getFileType(inputFile);
    if (type === 'js' || type === 'ts') {
      const compilerOut = path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules');

      const text = (await fs.readFile(inputFile, 'utf8'))
        .replace(/from '([.][^']+)'/g, (_, i) => `from '${i.replace(/[.]js$/, '')}.js'`)
        .replace(/from '(@travetto\/(.*?))'/g, (_, i, s) => `from '${path.resolve(compilerOut, `${i}${s.includes('/') ? '.js' : '/__index__.js'}`)}'`);

      const ts = (await import('typescript')).default;
      const content = ts.transpile(text, {
        ...await this.getCompilerOptions(ctx),
        sourceMap: false,
        inlineSourceMap: true,
      }, inputFile);
      await this.writeTextFile(outputFile, content);
    } else if (type === 'package-json') {
      const pkg: Package = JSON.parse(await fs.readFile(inputFile, 'utf8'));
      const main = pkg.main ? this.sourceToOutputExt(pkg.main) : undefined;
      const files = pkg.files?.map(x => this.sourceToOutputExt(x));

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
        } else {
          switch (this.getFileType(file)) {
            case 'js':
            case 'ts':
              files.push(resolvedInput);
          }
        }
      }
    }

    const outputFolder = path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules', module);
    const out: ModFile[] = [];
    for (const input of files) {
      const output = this.sourceToOutputExt(input.replace(inputFolder, outputFolder));
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
  static async runCompiler(ctx: ManifestContext, manifest: ManifestRoot, changed: DeltaEvent[], watch: boolean, onMessage: (msg: BuildEvent) => void): Promise<CompileResult> {
    const compiler = path.resolve(ctx.workspacePath, ctx.compilerFolder);
    const main = path.resolve(compiler, 'node_modules', '@travetto/compiler/support/compiler-entry.js');
    const deltaFile = path.resolve(os.tmpdir(), `manifest-delta.${process.pid}.${process.ppid}.${Date.now()}.json`);

    const changedFiles = changed[0]?.file === '*' ? ['*'] : changed.map(ev =>
      path.resolve(manifest.workspacePath, manifest.modules[ev.module].sourceFolder, ev.file)
    );

    let proc: cp.ChildProcess | undefined;
    let kill: (() => void) | undefined;

    try {
      await this.writeTextFile(deltaFile, changedFiles.join('\n'));

      const result = await LogUtil.withLogger('compiler-exec', log => new Promise<CompileResult>((res, rej) => {
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
            } else if (isBuildEvent(msg)) {
              // Send to parent if exists
              process.send?.(msg);
              if (msg.type === 'restart') {
                res('restart');
              } else {
                onMessage(msg);
              }
            }
          })
          .on('exit', code => (code !== null && code > 0) ? rej(new Error('Failed during compilation')) : res('complete'));
        kill = (): void => { proc?.kill('SIGKILL'); };
        process.on('exit', kill);
      }));

      if (result === 'restart') {
        await timers.setTimeout(150 + 100 * Math.random());
      }

      LogUtil.log('compiler-exec', [], 'info', `Result ${result}, exit code: ${proc?.exitCode}`);

      return result;
    } finally {
      if (proc?.killed === false) { proc.kill('SIGKILL'); }
      if (kill) {
        process.off('exit', kill);
      }
      if (process.stdout.isTTY) {
        process.stdout.write('\x1b[s\x1b[?25h\x1b[r\x1b[u');
      }
      await fs.rm(deltaFile, { force: true });
    }
  }
}