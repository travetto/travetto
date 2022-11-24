import type { CompilerOptions } from 'typescript';
import * as fs from 'fs/promises';

import * as  cp from 'child_process';
import * as  path from 'path';
import * as  readline from 'readline';
import * as  timers from 'timers/promises';
import { Writable } from 'stream';
import { Stats } from 'fs';
import { createRequire } from 'module';

import type { ManifestUtil } from '@travetto/manifest';

const req = createRequire(process.cwd());
const rootPkg = fs.readFile(path.resolve('package.json'), 'utf8').then(v => JSON.parse(v), v => ({}));

type ModFile = { input: string, output: string, stale: boolean };
type SpawnCfg = { args?: string[], cwd?: string, failOnError?: boolean, env?: Record<string, string>, showWaitingMessage?: boolean };

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

let _opts: CompilerOptions;

/**
 * Get ts compiler options
 */
async function getOpts(): Promise<CompilerOptions> {
  const { default: ts } = await import('typescript');
  const folder = await resolveImport('@travetto/compiler/tsconfig.trv.json');
  if (_opts === undefined) {
    _opts = ts.readConfigFile(folder, ts.sys.readFile).config?.compilerOptions;
    const { type } = await rootPkg;

    if (type !== undefined) {
      _opts.module = `${type}`.toLowerCase() === 'commonjs' ? ts.ModuleKind.CommonJS : ts.ModuleKind.ESNext;
    }
  }
  return _opts;
}

/**
 * Transpiles a file
 */
async function transpileFile(inputFile: string, outputFile: string): Promise<void> {
  const { default: ts } = await import('typescript');

  const opts = await getOpts();

  const content = ts.transpile(await fs.readFile(inputFile, 'utf8'), opts, inputFile)
    .replace(/^((?:im|ex)port .*from '[.][^']+)(')/mg, (_, a, b) => `${a}.js${b}`)
    .replace(/^(import [^\n]*from '[^.][^\n/]+[/][^\n/]+[/][^\n']+)(')/mg, (_, a, b) => `${a}.js${b}`);

  await fs.writeFile(outputFile, content);
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
  module: string,
  baseOutputFolder: string,
  seed: string[] = ['package.json', 'index.ts', 'src', 'support']
): Promise<ModFile[]> {
  const inputFolder = resolveImport(`${module}/package.json`).replace(/\/package[.]json$/, '');

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

/**
 * Recompile folder if stale
 */
export async function compileIfStale(prefix: string, files: ModFile[]): Promise<void> {
  try {
    if (files.some(f => f.stale)) {
      log(`${prefix} Starting`);
      for (const file of files.filter(x => x.stale)) {
        if (file.input.endsWith('package.json')) {
          const pkg: { main?: string, type?: string, files?: string[] } = JSON.parse(await fs.readFile(file.input, 'utf8'));
          pkg.main = pkg.main?.replace(/[.]ts$/, '.js');
          pkg.files = pkg.files?.map(f => f.replace(/[.]ts$/, '.js'));
          const { default: ts } = await import('typescript');
          const opts = await getOpts();
          pkg.type = opts.module !== ts.ModuleKind.CommonJS ? 'module' : 'commonjs';
          await fs.writeFile(file.output, JSON.stringify(pkg, null, 2));
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
  import(path.resolve(compilerFolder, 'node_modules', '@travetto/manifest/index.js'))
    .then(mod => {
      // Ensure we resolve imports, relative to self, and not the compiler folder
      mod.PackageUtil.resolveImport = resolveImport;
      return mod;
    });
