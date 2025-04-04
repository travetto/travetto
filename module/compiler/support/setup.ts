import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { DeltaEvent, ManifestContext, Package } from '@travetto/manifest';

import { Log } from './log.ts';
import { CommonUtil } from './util.ts';
import { TypescriptUtil } from './ts-util.ts';

type ModFile = { input: string, output: string, stale: boolean };

const SOURCE_SEED = ['package.json', '__index__.ts', 'src', 'support', 'bin'];
const PRECOMPILE_MODS = ['@travetto/manifest', '@travetto/transformer', '@travetto/compiler'];
const RECENT_STAT = (stat: { ctimeMs: number, mtimeMs: number }): number => Math.max(stat.ctimeMs, stat.mtimeMs);
const REQ = createRequire(path.resolve('node_modules')).resolve.bind(null);

const SOURCE_EXT_RE = /[.][cm]?[tj]s$/;
const BARE_IMPORT_RE = /^(@[^/]+[/])?[^.][^@/]+$/;
const OUTPUT_EXT = '.js';

/**
 * Compiler Setup Utilities
 */
export class CompilerSetup {

  /**
   * Import compiled manifest utilities
   */
  static #importManifest = (ctx: ManifestContext): Promise<
    Pick<typeof import('@travetto/manifest'), 'ManifestDeltaUtil' | 'ManifestUtil'>
  > => {
    const all = ['util', 'delta'].map(f =>
      import(CommonUtil.resolveWorkspace(ctx, ctx.build.compilerFolder, 'node_modules', `@travetto/manifest/src/${f}${OUTPUT_EXT}`))
    );
    return Promise.all(all).then(props => Object.assign({}, ...props));
  };

  /**  Convert a file to a given ext */
  static #sourceToExtension(sourceFile: string, ext: string): string {
    return sourceFile.replace(SOURCE_EXT_RE, ext);
  }

  /**
   * Get the output file name for a given input
   */
  static #sourceToOutputExt(sourceFile: string): string {
    return this.#sourceToExtension(sourceFile, OUTPUT_EXT);
  }

  /**
   * Output a file, support for ts, js, and package.json
   */
  static async #transpileFile(ctx: ManifestContext, sourceFile: string, outputFile: string): Promise<void> {
    const type = CommonUtil.getFileType(sourceFile);
    if (type === 'js' || type === 'ts') {
      const compilerOut = CommonUtil.resolveWorkspace(ctx, ctx.build.compilerFolder, 'node_modules');

      const text = (await fs.readFile(sourceFile, 'utf8'))
        .replace(/from ['"](([.]+|@travetto)[/][^']+)['"]/g, (_, clause, m) => {
          const s = this.#sourceToOutputExt(clause);
          const suf = s.endsWith(OUTPUT_EXT) ? '' : (BARE_IMPORT_RE.test(clause) ? `/__index__${OUTPUT_EXT}` : OUTPUT_EXT);
          const pre = m === '@travetto' ? `${compilerOut}/` : '';
          return `from '${pre}${s}${suf}'`;
        });

      const ts = (await import('typescript')).default;
      const content = ts.transpile(text, {
        ...await TypescriptUtil.getCompilerOptions(ctx),
        sourceMap: false,
        inlineSourceMap: true,
        importHelpers: true,
      }, sourceFile);
      await CommonUtil.writeTextFile(outputFile, content);
    } else if (type === 'package-json') {
      const pkg: Package = JSON.parse(await fs.readFile(sourceFile, 'utf8'));
      const main = pkg.main ? this.#sourceToOutputExt(pkg.main) : undefined;
      const files = pkg.files?.map(x => this.#sourceToOutputExt(x));

      const content = JSON.stringify({ ...pkg, main, type: ctx.workspace.type, files }, null, 2);
      await CommonUtil.writeTextFile(outputFile, content);
    }
  }

  /**
   * Scan directory to find all project sources for comparison
   */
  static async #getModuleSources(ctx: ManifestContext, module: string, seed: string[]): Promise<ModFile[]> {
    const inputFolder = path.dirname(REQ(`${module}/package.json`));

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
        const resolvedInput = path.resolve(sub, file).replaceAll('\\', '/'); // To posix
        const stat = await fs.stat(resolvedInput);

        if (stat.isDirectory()) {
          folders.push(resolvedInput);
        } else {
          switch (CommonUtil.getFileType(file)) {
            case 'js': case 'ts': files.push(resolvedInput);
          }
        }
      }
    }

    const outputFolder = CommonUtil.resolveWorkspace(ctx, ctx.build.compilerFolder, 'node_modules', module);
    const out: ModFile[] = [];
    for (const input of files) {
      const output = this.#sourceToOutputExt(input.replace(inputFolder, outputFolder));
      const inputTs = await fs.stat(input).then(RECENT_STAT, () => 0);
      if (inputTs) {
        const outputTs = await fs.stat(output).then(RECENT_STAT, () => 0);
        await fs.mkdir(path.dirname(output), { recursive: true });
        out.push({ input, output, stale: inputTs > outputTs });
      }
    }

    return out;
  }

  /**
   * Recompile folder if stale
   */
  static async #compileIfStale(ctx: ManifestContext, scope: string, mod: string, seed: string[]): Promise<string[]> {
    const files = await this.#getModuleSources(ctx, mod, seed);
    const changes = files.filter(x => x.stale).map(x => x.input);
    const out: string[] = [];

    try {
      await Log.wrap(scope, async log => {
        if (files.some(f => f.stale)) {
          log.debug('Starting', mod);
          for (const file of files.filter(x => x.stale)) {
            await this.#transpileFile(ctx, file.input, file.output);
          }
          if (changes.length) {
            out.push(...changes.map(x => `${mod}/${x}`));
            log.debug(`Source changed: ${changes.join(', ')}`, mod);
          }
          log.debug('Completed', mod);
        } else {
          log.debug('Skipped', mod);
        }
      }, false);
    } catch (err) {
      console.error(err);
    }
    return out;
  }

  /**
   * Export manifest
   */
  static async exportManifest(ctx: ManifestContext, output?: string, prod?: boolean): Promise<void> {
    const { ManifestUtil } = await this.#importManifest(ctx);
    let manifest = await ManifestUtil.buildManifest(ctx);

    // If in prod mode, only include std modules
    if (prod) {
      manifest = ManifestUtil.createProductionManifest(manifest);
    }
    if (output) {
      output = await ManifestUtil.writeManifestToFile(output, manifest);
    } else {
      console.log(JSON.stringify(manifest, null, 2));
    }
  }

  /**
   * Sets up compiler, and produces a set of changes that need to be processed
   */
  static async setup(ctx: ManifestContext): Promise<DeltaEvent[]> {
    let changes = 0;

    await Log.wrap('precompile', async () => {
      for (const mod of PRECOMPILE_MODS) {
        changes += (await this.#compileIfStale(ctx, 'precompile', mod, SOURCE_SEED)).length;
      }
    });

    const { ManifestUtil, ManifestDeltaUtil } = await this.#importManifest(ctx);

    const manifest = await Log.wrap('manifest', () =>
      ManifestUtil.buildManifest(ManifestUtil.getWorkspaceContext(ctx)));

    await Log.wrap('transformers', async () => {
      for (const mod of Object.values(manifest.modules).filter(m => m.files.$transformer?.length)) {
        changes += (await this.#compileIfStale(ctx, 'transformers', mod.name, ['package.json', ...mod.files.$transformer!.map(x => x[0])])).length;
      }
    });

    const delta = await Log.wrap('delta', async log => {
      if (changes) {
        log.debug('Skipping, everything changed');
        return [{ type: 'changed', file: '*', module: ctx.workspace.name, sourceFile: '' } as const];
      } else {
        return ManifestDeltaUtil.produceDelta(manifest);
      }
    });

    if (changes) {
      await Log.wrap('reset', async log => {
        await fs.rm(CommonUtil.resolveWorkspace(ctx, ctx.build.outputFolder), { recursive: true, force: true });
        log.info('Clearing output due to compiler changes');
      }, false);
    }

    // Write manifest
    await Log.wrap('manifest', async log => {
      await ManifestUtil.writeManifest(manifest);
      log.debug(`Wrote manifest ${ctx.workspace.name}`);

      // Update all manifests when in mono repo
      if (delta.length && ctx.workspace.mono) {
        const names: string[] = [];
        const mods = Object.values(manifest.modules).filter(x => x.workspace && x.name !== ctx.workspace.name);
        for (const mod of mods) {
          const modCtx = ManifestUtil.getModuleContext(ctx, mod.sourceFolder, true);
          const modManifest = await ManifestUtil.buildManifest(modCtx);
          await ManifestUtil.writeManifest(modManifest);
          names.push(mod.name);
        }
        log.debug(`Changes triggered ${delta.slice(0, 10).map(x => `${x.type}:${x.module}:${x.file}`)}`);
        log.debug(`Rewrote monorepo manifests [changes=${delta.length}] ${names.slice(0, 10).join(', ')}`);
      }
    });

    return delta.filter(x => x.type === 'added' || x.type === 'changed');
  }
}