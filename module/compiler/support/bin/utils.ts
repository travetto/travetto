import fs from 'fs/promises';

import cp from 'child_process';
import path from 'path';
import rl from 'readline';
import { type Stats } from 'fs';
import { createRequire } from 'module';

import type { ManifestContext, ManifestUtil } from '@travetto/manifest';

import { transpileFile, writePackageJson } from '../../bin/transpile';

const req = createRequire(`${process.cwd()}/node_modules`);

type ModFile = { input: string, output: string, stale: boolean };
type SpawnCfg = { args?: string[], cwd?: string, failOnError?: boolean, env?: Record<string, string>, showWaitingMessage?: boolean };

const SOURCE_SEED = ['package.json', 'index.ts', '__index__.ts', 'src', 'support'];

export const IS_DEBUG = /\b([*]|build)\b/.test(process.env.DEBUG ?? '');

const resolveImport = (lib: string): string => req.resolve(lib);
const recentStat = (stat: Stats): number => Math.max(stat.ctimeMs, stat.mtimeMs);

async function waiting(message: string, op: () => Promise<boolean>): Promise<boolean> {
  const run = op();
  let done = false;
  run.finally(() => done = true);
  process.stdout.write(message);
  while (!done) {
    await new Promise(r => setTimeout(r, 1000));
    process.stdout.write('.');
  }
  rl.moveCursor(process.stdout, -1000, 0);
  rl.clearLine(process.stdout, 1);
  return await run;
}

/**
 * Allows for triggering a subprocess that can be watched, and provides consistent logging support
 */
export async function spawn(
  action: string, cmd: string,
  { args = [], cwd, failOnError = true, env = {}, showWaitingMessage = true }: SpawnCfg
): Promise<boolean | undefined> {
  const stdout = IS_DEBUG ? 1 : 'pipe';
  const stderr = IS_DEBUG ? 2 : 'pipe';
  const proc = cp.spawn(cmd, args, { cwd, stdio: ['pipe', stdout, stderr], env: { ...process.env, ...env } });
  const stderrOutput: Buffer[] = [];
  const stdoutOutput: Buffer[] = [];

  const work = (): Promise<boolean> => new Promise((res, rej) => {
    if (stderr === 'pipe' && proc.stderr) {
      proc.stderr.on('data', d => stderrOutput.push(d));
    }
    if (stdout === 'pipe' && proc.stdout) {
      proc.stdout.on('data', d => stdoutOutput.push(d));
    }
    proc
      .on('exit', code => (code && code > 0) ? rej() : res(true))
      .on('error', rej);
  });

  try {
    let res;
    if (showWaitingMessage) {
      res = await waiting(`${action}...`, work);
    } else {
      res = await work();
    }
    if (!res) {
      throw new Error();
    }
  } catch (err) {
    const text = Buffer.concat(stderrOutput).toString('utf8');
    console.error(text);

    if (failOnError) {
      throw err;
    } else {
      return;
    }
  }
}

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

  const folders = seed.filter(x => !/[.](ts|js|json)$/.test(x)).map(x => path.resolve(inputFolder, x));
  const files = seed.filter(x => /[.](ts|js|json)$/.test(x)).map(x => path.resolve(inputFolder, x));

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
      } else if (file.endsWith('.ts')) {
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
        if (file.input.endsWith('package.json')) {
          await writePackageJson(ctx, file.input, file.output);
        } else {
          await transpileFile(ctx, file.input, file.output);
        }
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