const fs = require('fs/promises');
const cp = require('child_process');
const readline = require('readline');
const timers = require('timers/promises');

const { path } = require('@travetto/common');

const spawn = async (action, cmd, { args = [], cwd = process.cwd(), failOnError = true, env = {} }) => {
  let stdout = process.env.DEBUG === 'build' ? 1 : 'pipe';
  let stderr = process.env.DEBUG === 'build' ? 2 : 'pipe';
  const proc = cp.spawn(cmd, args, { cwd, stdio: ['pipe', stdout, stderr], env: { ...process.env, ...env } });
  let stderrOutput = [];
  let stdoutOutput = [];

  try {
    return await waiting(`${action}...`, () => new Promise((res, rej) => {
      if (stderr === 'pipe') {
        proc.stderr.on('data', d => stderrOutput.push(d));
      }
      if (stdout === 'pipe') {
        proc.stdout.on('data', d => stdoutOutput.push(d));
      }
      proc
        .on('exit', code => code > 0 ? rej() : res(true))
        .on('error', rej);
    }));
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

async function waiting(message, worker) {
  const waitState = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'.split('');
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

  process.stdout.write('\x1B[?25h')

  if (capturedError) {
    throw capturedError;
  } else {
    return value;
  }
}

const recent = file => fs.stat(file).then(stat => Math.max(stat.ctimeMs, stat.mtimeMs));

async function isFolderStale(folder) {
  const flags = await Promise.all(
    (await fs.readdir(folder))
      .filter(x => !x.startsWith('.'))
      .map(x => path.resolve(folder, x))
      .map(async f => Promise.all([recent(f), recent(f.replace(/[.]ts$/, '.js'))])
        .then(([l, r]) => l > r)
        .catch(() => true)
      )
  );
  return flags.some(x => x === true);
}

const resolveImport = (library, toRoot = false) => {
  let res = require.resolve(library)
  if (toRoot) {
    res = `${res.split(`/node_modules/${library}`)[0]}/node_modules/${library}`;
  }
  return res;
};


let logTarget = process.env.DEBUG === 'build' ? console.debug.bind(console) : () => { };

let log = (...args) => logTarget(...args);

module.exports = { spawn, log, isFolderStale, resolveImport };
