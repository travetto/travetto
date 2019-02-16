//@ts-check
const commander = require('commander');
const child_process = require('child_process');

const { FsUtil } = require('./fs-util');

const COLORS = {
  blue: `\x1b[94m`,
  yellow: `\x1b[93m`,
  green: `\x1b[92m`,
  gray: `\x1b[37m\x1b[2m`,
  red: `\x1b[31m`,
  cyan: `\x1b[96m`,
  magenta: `\x1b[95m`,
  white: `\x1b[97m\x1b[1m`,
  reset: `\x1b[0m`
};

const Util = {
  program: commander,
  dependOn(cmd, args, s_cwd) {
    child_process.spawnSync(`${process.argv.slice(0, 2).join(' ')} ${cmd} ${(args || []).join(' ')}`, {
      env: process.env,
      cwd: s_cwd || FsUtil.cwd,
      stdio: [0, 1, 2],
      shell: true
    });
  },
  fork(cmd, args, env) {
    return new Promise((resolve, reject) => {
      let text = [];
      let err = [];
      const proc = child_process.fork(cmd, args || [], {
        env: { ...process.env, ...(env || {}) },
        cwd: FsUtil.cwd,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
      });
      proc.stdout.on('data', v => text.push(v));
      proc.stderr.on('data', v => err.push(v));
      proc.on('exit', v => {
        if (v === 0) {
          resolve(Buffer.concat(text).toString());
        } else {
          reject(Buffer.concat(err).toString());
        }
      });
    });
  },
  colorize(text, color) {
    if (process.stdout.isTTY) {
      const code = COLORS[color];
      text = `${code}${text}${COLORS.reset}`;
    }
    return text;
  }
};

module.exports = { Util };