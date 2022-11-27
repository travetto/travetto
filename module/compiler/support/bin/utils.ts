import fs from 'fs/promises';

import cp from 'child_process';
import path from 'path';
import readline from 'readline';
import timers from 'timers/promises';
import { Writable } from 'stream';
import { type Stats } from 'fs';
import { createRequire } from 'module';

import type { ManifestUtil } from '@travetto/manifest';

import { type CompileContext, transpileFile, writePackageJson } from '../../bin/transpile';

const req = createRequire(`${process.cwd()}/node_modules`);

type ModFile = { input: string, output: string, stale: boolean };
type SpawnCfg = { args?: string[], cwd?: string, failOnError?: boolean, env?: Record<string, string>, showWaitingMessage?: boolean };

const SOURCE_SEED = ['package.json', 'index.ts', 'src', 'support'];

const resolveImport = (lib: string): string => req.resolve(lib);
const recentStat = (stat: Stats): number => Math.max(stat.ctimeMs, stat.mtimeMs);

/**
 * Rewrite command line text
 */
const rewriteLine = async (stream: Writable, text: string, clear = false): Promise<boolean> =>
  new Promise(r => readline.cursorTo(stream, 0, undefined, () => {
    if (clear) {
      readline.clearLine(stream, 0);
    }
    if (text) {
      stream.write(text);
      readline.moveCursor(stream, 1, 0);
    }
    r(true);
  }));

/**
 * Waiting indicator
 */
async function waiting<T>(message: string, worker: () => Promise<T>): Promise<T | undefined> {
  const waitState = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'.split('');
  const delay = 100;
  const writeLine = rewriteLine.bind(undefined, process.stdout);

  const work = worker();

  if (!process.stdout.isTTY) {
    return work; // Dip early
  }

  process.stdout.write('\x1B[?25l');

  let i = -1;
  let done = false;
  let value: T | undefined;
  let capturedError;
  const final = work
    .then(res => value = res)
    .catch(err => capturedError = err)
    .finally(() => done = true);

  if (delay) {
    await Promise.race([timers.setTimeout(delay), final]);
  }

  while (!done) {
    await writeLine(`${waitState[i = (i + 1) % waitState.length]} ${message}`);
    await timers.setTimeout(50);
  }

  if (i >= 0) {
    await writeLine('', true);
  }

  process.stdout.write('\x1B[?25h');

  if (capturedError) {
    throw capturedError;
  } else {
    return value;
  }
}

/**
 * Allows for triggering a subprocess that can be watched, and provides consistent logging support
 */
export async function spawn(
  action: string, cmd: string,
  { args = [], cwd, failOnError = true, env = {}, showWaitingMessage = true }: SpawnCfg
): Promise<boolean | undefined> {
  const stdout = process.env.DEBUG === 'build' ? 1 : 'pipe';
  const stderr = process.env.DEBUG === 'build' ? 2 : 'pipe';
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
export const log = process.env.DEBUG === 'build' ?
  (...args: unknown[]): void => console.debug(new Date().toISOString(), ...args) :
  (): void => { };

/**
 * Scan directory to find all project sources for comparison
 */
export async function getProjectSources(
  ctx: CompileContext, module: string, seed: string[] = SOURCE_SEED
): Promise<ModFile[]> {
  const inputFolder = (ctx.main === module) ?
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
      } else if (file.endsWith('.ts')) {
        files.push(resolvedInput);
      }
    }
  }

  const outputFolder = `${ctx.compilerFolder}/node_modules/${module}`;
  const out: ModFile[] = [];
  for (const input of files) {
    const output = input.replace(inputFolder, outputFolder).replace(/[.]ts$/, '.js');
    const inputTs = await fs.stat(input).then(recentStat);
    const outputTs = await fs.stat(output).then(recentStat, () => 0);
    await fs.mkdir(path.dirname(output), { recursive: true, });
    out.push({ input, output, stale: inputTs > outputTs });
  }

  return out;
}

/**
 * Recompile folder if stale
 */
export async function compileIfStale(ctx: CompileContext, prefix: string, files: ModFile[]): Promise<void> {
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
export const importManifest = (compilerFolder: string): Promise<{ ManifestUtil: typeof ManifestUtil }> =>
  import(path.resolve(compilerFolder, 'node_modules', '@travetto/manifest/index.js'));