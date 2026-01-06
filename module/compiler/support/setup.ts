import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { DeltaEvent, ManifestContext, Package, ManifestDeltaUtil, ManifestUtil } from '@travetto/manifest';

import { Log } from './log.ts';
import { CommonUtil } from './util.ts';
import { TypescriptUtil } from './ts-util.ts';

type ModFile = { input: string, output: string, stale: boolean };

const SOURCE_SEED = ['package.json', '__index__.ts', 'src', 'support', 'bin'];
const PRECOMPILE_MODS = ['@travetto/manifest', '@travetto/transformer', '@travetto/compiler'];
const RECENT_STAT = (stat: { ctimeMs: number, mtimeMs: number }): number => Math.max(stat.ctimeMs, stat.mtimeMs);
const REQUIRE = createRequire(path.resolve('node_modules')).resolve.bind(null);

const SOURCE_EXT_REGEX = /[.][cm]?[tj]s$/;
const BARE_IMPORT_REGEX = /^(@[^/]+[/])?[^.][^@/]+$/;
const OUTPUT_EXT = '.js';

/**
 * Compiler Setup Utilities
 */
export class CompilerSetup {

  /**
   * Import compiled manifest utilities
   */
  static #importManifest = (ctx: ManifestContext): Promise<{ ManifestUtil: typeof ManifestUtil, ManifestDeltaUtil: typeof ManifestDeltaUtil }> => {
    const all = ['util', 'delta'].map(file =>
      import(CommonUtil.resolveWorkspace(ctx, ctx.build.compilerFolder, 'node_modules', `@travetto/manifest/src/${file}${OUTPUT_EXT}`))
    );
    return Promise.all(all).then(results => Object.assign({}, ...results));
  };

  /**  Convert a file to a given ext */
  static #sourceToExtension(sourceFile: string, ext: string): string {
    return sourceFile.replace(SOURCE_EXT_REGEX, ext);
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
        .replace(/from ['"](([.]+|@travetto)[/][^']+)['"]/g, (_, clause, moduleName) => {
          const root = this.#sourceToOutputExt(clause);
          const suffix = root.endsWith(OUTPUT_EXT) ? '' : (BARE_IMPORT_REGEX.test(clause) ? `/__index__${OUTPUT_EXT}` : OUTPUT_EXT);
          const prefix = moduleName === '@travetto' ? `${compilerOut}/` : '';
          return `from '${prefix}${root}${suffix}'`;
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
      const files = pkg.files?.map(file => this.#sourceToOutputExt(file));

      const content = JSON.stringify({ ...pkg, main, type: 'module', files }, null, 2);
      await CommonUtil.writeTextFile(outputFile, content);
    }
  }

  /**
   * Scan directory to find all project sources for comparison
   */
  static async #getModuleSources(ctx: ManifestContext, module: string, seed: string[]): Promise<ModFile[]> {
    const inputFolder = path.dirname(REQUIRE(`${module}/package.json`));

    const folders = seed.filter(folder => !/[.]/.test(folder)).map(folder => path.resolve(inputFolder, folder));
    const files = seed.filter(file => /[.]/.test(file)).map(file => path.resolve(inputFolder, file));

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
    const changes = files.filter(file => file.stale).map(file => file.input);
    const out: string[] = [];

    try {
      await Log.wrap(scope, async log => {
        if (files.some(file => file.stale)) {
          log.debug('Starting', mod);
          for (const file of files) {
            if (file.stale) {
              await this.#transpileFile(ctx, file.input, file.output);
            }
          }
          if (changes.length) {
            out.push(...changes.map(file => `${mod}/${file}`));
            log.debug(`Source changed: ${changes.join(', ')}`, mod);
          }
          log.debug('Completed', mod);
        } else {
          log.debug('Skipped', mod);
        }
      }, false);
    } catch (error) {
      console.error(error);
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
      for (const mod of Object.values(manifest.modules)) {
        if (mod.files.$transformer?.length) {
          changes += (await this.#compileIfStale(ctx, 'transformers', mod.name,
            ['package.json', ...mod.files.$transformer!.map(file => file[0])])).length;
        }
      }
    });

    const delta = await Log.wrap('delta', async log => {
      if (changes) {
        log.debug('Skipping, everything changed');
        return [{ type: 'update', file: '*', module: ctx.workspace.name, sourceFile: '' } as const];
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
        const mods = Object.values(manifest.modules).filter(mod => mod.workspace && mod.name !== ctx.workspace.name);
        for (const mod of mods) {
          const modCtx = ManifestUtil.getModuleContext(ctx, mod.sourceFolder, true);
          const modManifest = await ManifestUtil.buildManifest(modCtx);
          await ManifestUtil.writeManifest(modManifest);
          names.push(mod.name);
        }
        log.debug(`Changes triggered ${delta.slice(0, 10).map(event => `${event.type}:${event.module}:${event.file}`)}`);
        log.debug(`Rewrote monorepo manifests [changes=${delta.length}] ${names.slice(0, 10).join(', ')}`);
      }
    });

    return delta.filter(event => event.type === 'create' || event.type === 'update');
  }
}