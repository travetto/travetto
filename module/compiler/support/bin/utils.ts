import fs from 'fs/promises';

import path from 'path';
import { type Stats } from 'fs';
import { createRequire } from 'module';

import type { ManifestContext, ManifestUtil } from '@travetto/manifest';

import { writeFile } from '../../bin/transpile';

const req = createRequire(`${process.cwd()}/node_modules`);

type ModFile = { input: string, output: string, stale: boolean };

const SOURCE_SEED = ['package.json', 'index.ts', '__index__.ts', 'src', 'support', 'bin'];

export const IS_DEBUG = /\b([*]|build)\b/.test(process.env.DEBUG ?? '');

const resolveImport = (lib: string): string => req.resolve(lib);
const recentStat = (stat: Stats): number => Math.max(stat.ctimeMs, stat.mtimeMs);

/**
 * Common logging support
 */
export const log = IS_DEBUG ?
  (...args: unknown[]): void => console.debug(new Date().toISOString(), ...args) :
  (): void => { };

/**
 * Scan directory to find all project sources for comparison
 */
export async function getProjectSources(
  ctx: ManifestContext, module: string, seed: string[] = SOURCE_SEED
): Promise<ModFile[]> {
  const inputFolder = (ctx.mainModule === module) ?
    process.cwd() :
    path.dirname(resolveImport(`${module}/package.json`));

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
 * Recompile folder if stale
 */
export async function compileIfStale(ctx: ManifestContext, prefix: string, files: ModFile[]): Promise<void> {
  try {
    if (files.some(f => f.stale)) {
      log(`${prefix} Starting`);
      for (const file of files.filter(x => x.stale)) {
        await writeFile(ctx, file.input, file.output);
      }
    } else {
      log(`${prefix} Skipped`);
    }
  } catch (err) {
    console.error(err);
  }
}

/**
 * Add node path at runtime
 */
export async function addNodePath(folder: string): Promise<void> {
  process.env.NODE_PATH = [`${folder}/node_modules`, process.env.NODE_PATH].join(path.delimiter);
  const { Module } = await import('module');
  // @ts-expect-error
  Module._initPaths();
}

/**
 * Import the manifest utils once compiled
 */
export const importManifest = (ctx: ManifestContext): Promise<{ ManifestUtil: typeof ManifestUtil }> =>
  import(path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules', '@travetto', 'manifest', '__index__.js'));