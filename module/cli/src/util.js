//@ts-check
const commander = require('commander');
const fs = require('fs');
const child_process = require('child_process');

const { FsUtil } = require('../src/fs-util');

const PREFIX = 'travetto-cli';

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

commander
  // @ts-ignore
  .version(require('../package.json').version);

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
  requireModule(f) {
    let p = FsUtil.toUnix(fs.realpathSync(`${FsUtil.cwd}/node_modules/.bin/${f}`));
    if (!p.startsWith(FsUtil.cwd)) {
      p = `${FsUtil.cwd}/node_modules/@travetto/${p.split('travetto/module/')[1]}`;
    }
    require(p).init();
  },
  loadAllPlugins() {
    const BIN_DIR = `${FsUtil.cwd}/node_modules/.bin`;
    if (fs.existsSync(BIN_DIR)) {
      const files = fs.readdirSync(BIN_DIR).filter(x => x.startsWith(`${PREFIX}-`));
      for (const f of files) {
        this.requireModule(f);
      }
    }
  },
  loadSinglePlugin(cmd) {
    try {
      this.requireModule(`${PREFIX}-${cmd.replace(/:.*$/, '')}`);
    } catch (e) {
      console.error('Unknown command', cmd);
      this.showHelp(1);
    }
  },
  showHelp(code = 0) {
    this.loadAllPlugins();
    commander.help();
    process.exit(code);
  },
  execute(args) {
    const cmd = args[2];

    if (!cmd) {
      this.showHelp();
    } else if (!cmd.startsWith('-')) {
      this.loadSinglePlugin(cmd);
    } else {
      this.loadAllPlugins();
    }

    commander.parse(args);
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