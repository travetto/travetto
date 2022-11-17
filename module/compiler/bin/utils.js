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
const spawn = async (action, cmd, { args = [], cwd, failOnError = true, env = {}, showWaitingMessage = true }) => {
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
 * @param {string} output
 */
async function isProjectStale(tsconfig, input, output) {
  const { files } = JSON.parse(await fs.readFile(tsconfig, 'utf8'));
  return Promise.all(files.map(async file => {
    const inputFile = path.resolve(input, file);
    const outputFile = path.resolve(output, file).replace(/[.]ts$/, '.js');
    const [l, r] = await Promise.all([recent(inputFile), recent(outputFile)]);
    if (l > r) {
      throw new Error('Stale');
    }
  })).then(() => false, () => true);
}

// @ts-ignore
const log = process.env.DEBUG === 'build' ? console.debug.bind(console) : () => { };


/**
 * @param {string} outputRoot
 * @param {string} moduleName
 * @param {string} tsconfig
 * @param {string} prefix
 * @param {string[]} args
 * @returns {Promise<void>}
 */
async function compileModuleIfStale(
  outputRoot,
  moduleName,
  prefix,
  tsconfig = 'tsconfig.bootstrap.json',
  ...args
) {
  try {
    tsconfig = require.resolve(`${moduleName}/${tsconfig}`);
    const inputTarget = path.dirname(tsconfig);
    const outputTarget = `${outputRoot}/node_modules/${moduleName}`;

    if (await isProjectStale(tsconfig, inputTarget, outputTarget)) {
      log(`${prefix} Starting, ${tsconfig}`);
      const TSC = require.resolve('typescript').replace(/\/lib\/.*/, '/bin/tsc');
      await spawn(`${prefix} Building`, TSC, { cwd: inputTarget, args: ['-p', path.basename(tsconfig), '--outDir', outputTarget, ...args] });

      await fs.writeFile(`${outputTarget}/package.json`,
        (await fs.readFile(`${inputTarget}/package.json`, 'utf8')).replace(/"index[.]ts"/g, '"index.js"')
      );
    } else {
      log(`${prefix} Skipped`);
    }
  } catch (err) {
    console.error(err);
  }
}

/**
 * Add node path at runtime
 * @param {string} folder
 */
function addNodePath(folder) {
  process.env.NODE_PATH = [`${folder}/node_modules`, process.env.NODE_PATH].join(path.delimiter);
  // @ts-expect-error
  require('module').Module._initPaths();
}

module.exports = {
  spawn,
  log,
  addNodePath,
  compileModuleIfStale
};