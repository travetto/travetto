// @ts-check
const fs = require('fs/promises');
const cp = require('child_process');
const path = require('path');

const readline = require('readline');
const timers = require('timers/promises');
const { Writable } = require('stream');

/**
 * @param {Writable} stream
 * @param {string} text
 * @param {boolean} clear
 * @returns {Promise<boolean>}
 */
const rewriteLine = async (stream, text, clear = false) =>
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
 *
 * @param {string} message
 * @param {() => Promise<void>} worker
 * @returns {Promise<void>}
 */
async function waiting(message, worker) {
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
  let value;
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
 * @param {string} action
 * @param {string} cmd
 * @param {{args?:string[], cwd?: string, failOnError?: boolean, env?: Record<string, string>, showWaitingMessage?: boolean}} param2
 * @returns {Promise<void>}
 */
const spawn = async (action, cmd, { args = [], cwd = process.cwd(), failOnError = true, env = {}, showWaitingMessage = true }) => {
  const stdout = process.env.DEBUG === 'build' ? 1 : 'pipe';
  const stderr = process.env.DEBUG === 'build' ? 2 : 'pipe';
  const proc = cp.spawn(cmd, args, { cwd, stdio: ['pipe', stdout, stderr], env: { ...process.env, ...env } });
  const stderrOutput = [];
  const stdoutOutput = [];

  const work = () => new Promise((res, rej) => {
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
};

/**
 *
 * @param {string} file
 * @returns {Promise<number>}
 */
const recent = file => fs.stat(file).then(stat => Math.max(stat.ctimeMs, stat.mtimeMs));

/**
 * @param {string} tsconfig
 */
async function isProjectStale(tsconfig) {
  const folder = path.dirname(tsconfig);
  const { files } = JSON.parse(await fs.readFile(tsconfig, 'utf8'));
  return Promise.all(files.map(async file => {
    const f = path.resolve(folder, file);
    const [l, r] = await Promise.all([recent(f), recent(f.replace(/[.]ts$/, '.js'))]);
    if (l > r) {
      throw new Error('Stale');
    }
  })).then(() => false, () => true);
}

// @ts-ignore
const log = process.env.DEBUG === 'build' ? console.debug.bind(console) : () => { };


/**
 * @param {string} tsconfig
 * @param {{go:string, skip:string, build:string}} param2
 * @returns {Promise<void>}
 */
async function compileProjectIfStale(tsconfig, { go, skip, build }) {
  try {
    if (tsconfig.startsWith('@')) {
      tsconfig = require.resolve(tsconfig);
    }
    if (await isProjectStale(tsconfig)) {
      log(`${go}: ${tsconfig}`);
      const TSC = require.resolve('typescript').replace(/\/lib\/.*/, '/bin/tsc');
      await spawn(build, TSC, { cwd: path.dirname(tsconfig), args: ['-p', path.basename(tsconfig)] });
    } else {
      log(skip);
    }
  } catch (err) {
    console.error(err);
  }
}

module.exports = {
  recent,
  spawn,
  waiting,
  rewriteLine,
  log,
  compileProjectIfStale
};