import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import cp from 'child_process';
import { createRequire } from 'module';

import { DeltaEvent, ManifestContext, ManifestRoot, Package } from '@travetto/manifest';

type ModFile = { input: string, output: string, stale: boolean };

const SRC_REQ = createRequire(path.resolve('node_modules'));
const recentStat = (stat: { ctimeMs: number, mtimeMs: number }): number => Math.max(stat.ctimeMs, stat.mtimeMs);

/**
 * Transpile utilities for launching
 */
export class TranspileUtil {
  static #optCache: Record<string, {}> = {};

  /**
   * Write text file, and ensure folder exists
   */
  static writeTextFile = (file: string, content: string): Promise<void> =>
    fs.mkdir(path.dirname(file), { recursive: true }).then(() => fs.writeFile(file, content));

  /**
   * Returns the compiler options
   */
  static async getCompilerOptions(ctx: ManifestContext): Promise<{}> {
    if (!(ctx.workspacePath in this.#optCache)) {
      let tsconfig = path.resolve(ctx.workspacePath, 'tsconfig.json');

      if (!await fs.stat(tsconfig).then(_ => true, _ => false)) {
        tsconfig = SRC_REQ.resolve('@travetto/compiler/tsconfig.trv.json');
      }

      const ts = (await import('typescript')).default;

      const { options } = ts.parseJsonSourceFileConfigFileContent(
        ts.readJsonConfigFile(tsconfig, ts.sys.readFile), ts.sys, ctx.workspacePath
      );

      options.allowJs = true;
      options.resolveJsonModule = true;
      options.sourceRoot = ctx.workspacePath;
      options.rootDir = ctx.workspacePath;
      options.outDir = path.resolve(ctx.workspacePath);

      try {
        options.module = ctx.moduleType === 'commonjs' ? ts.ModuleKind.CommonJS : ts.ModuleKind.ESNext;
      } catch { }

      this.#optCache[ctx.workspacePath] = options;
    }
    return this.#optCache[ctx.workspacePath];
  }

  /**
   * Output a file, support for ts, js, and package.json
   */
  static async transpileFile(ctx: ManifestContext, inputFile: string, outputFile: string): Promise<void> {
    if (inputFile.endsWith('.ts') || inputFile.endsWith('.js')) {
      const compilerOut = path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules');
      const text = (await fs.readFile(inputFile, 'utf8'))
        .replace(/from '(@travetto\/(.*?))'/g, (_, i, s) => `from '${compilerOut}/${i}${s.includes('/') ? '' : '/__index__'}'`);
      const ts = (await import('typescript')).default;
      let content = ts.transpile(text, await this.getCompilerOptions(ctx), inputFile);
      if (ctx.moduleType === 'module') {
        content = content.replace(/^((?:im|ex)port .*from '[.][^']+)(')/mg, (_, a, b) => `${a}.js${b}`)
          .replace(/^(import [^\n]*from '[^.][^\n/]+[/][^\n/]+[/][^\n']+)(')/mg, (_, a, b) => `${a}.js${b}`);
      }
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
      const inputTs = await fs.stat(input).then(recentStat, () => 0);
      if (inputTs) {
        const outputTs = await fs.stat(output).then(recentStat, () => 0);
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

    const changedFiles = changed[0].file === '*' ? ['*'] : changed.map(ev =>
      path.resolve(manifest.workspacePath, manifest.modules[ev.module].sourceFolder, ev.file)
    );

    await this.writeTextFile(deltaFile, changedFiles.join('\n'));
    const res = cp.spawnSync(process.argv0, [main, deltaFile, `${watch}`], {
      env: {
        ...process.env,
        TRV_MANIFEST: path.resolve(ctx.workspacePath, ctx.outputFolder, 'node_modules', ctx.mainModule),
        TRV_THROW_ROOT_INDEX_ERR: '1',
      },
      stdio: 'inherit',
      encoding: 'utf8'
    });
    if (res.status) {
      throw new Error(res.stderr);
    }
  }
}