import * as fs from 'fs/promises';

import * as  cp from 'child_process';
import * as  path from 'path';
import * as  readline from 'readline';
import * as  timers from 'timers/promises';
import { Writable } from 'stream';
import { Stats } from 'fs';

import type { ManifestUtil } from '@travetto/manifest';

type ModFile = { input: string, output: string, stale: boolean };
type SpawnCfg = { args?: string[], cwd?: string, failOnError?: boolean, env?: Record<string, string>, showWaitingMessage?: boolean };

const recentStat = (stat: Stats): number => Math.max(stat.ctimeMs, stat.mtimeMs);

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

let opts: unknown;

async function getOpts(): Promise<any> {
  const ts = await import('typescript');
  opts ??= ts.readConfigFile(path.resolve(__dirname, '..', '..', 'tsconfig.trv.json'), ts.sys.readFile).config?.compilerOptions;
  return opts;
}

/**
 * Transpiles a file
 */
async function transpileFile(inputFile: string, outputFile: string): Promise<void> {
  const ts = await import('typescript');
  await fs.writeFile(outputFile, ts.transpile(await fs.readFile(inputFile, 'utf8'), await getOpts(), inputFile));
}

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
    if (showWaitingMessage) {
      return await waiting(`${action}...`, work);
    } else {
      return await work();
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

export const log = process.env.DEBUG === 'build' ?
  (...args: unknown[]): void => console.debug(new Date().toISOString(), ...args) :
  (): void => { };

export async function getProjectSources(
  module: string,
  baseOutputFolder: string,
  seed: string[] = ['package.json', 'index.ts', 'src', 'support']
): Promise<ModFile[]> {
  const inputFolder = require.resolve(`${module}/package.json`).replace(/\/package[.]json$/, '');

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

  const outputFolder = `${baseOutputFolder}/node_modules/${module}`;
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

export async function compileIfStale(prefix: string, files: ModFile[]): Promise<void> {
  try {
    if (files.some(f => f.stale)) {
      log(`${prefix} Starting`);
      for (const file of files.filter(x => x.stale)) {
        if (file.input.endsWith('package.json')) {
          await fs.writeFile(file.output,
            (await fs.readFile(file.input, 'utf8')).replace(/"index[.]ts"/g, '"index.js"')
          );
        } else {
          await transpileFile(file.input, file.output);
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
export function addNodePath(folder: string): void {
  process.env.NODE_PATH = [`${folder}/node_modules`, process.env.NODE_PATH].join(path.delimiter);
  require('module').Module._initPaths();
}

export const importManifest = (compilerFolder: string): Promise<{ ManifestUtil: typeof ManifestUtil }> =>
  import(path.resolve(compilerFolder, 'node_modules', '@travetto/manifest'))
    .then(mod => {
      // Ensure we resolve imports, relative to self, and not the compiler folder
      mod.PackageUtil.resolveImport = (lib: string) => require.resolve(lib);
      return mod;
    });
