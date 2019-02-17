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

const HAS_COLOR = process.stdout.isTTY && !/^(1|yes|on|true)$/i.test(`${process.env.NO_COLOR}`);

const Util = {
  HAS_COLOR,
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
  colorize(color, value) {
    if (HAS_COLOR && value !== undefined && value !== null && value !== '') {
      const code = COLORS[color];
      value = `${code}${value}${COLORS.reset}`;
    }
    return value;
  },
  showHelp(commander, code = 0) {
    commander.outputHelp((text) => {
      function extract(key) {
        let out;
        if (text.includes(key)) {
          const start = text.indexOf(key)
          let end = text.indexOf('\n\n', start);
          if (end < 0) {
            end = text.length;
          }
          out = text.substring(start, end);
          text = text.substring(end);
        }
        return out;
      }
      const usage = extract('Usage:');
      const options = extract('Options:');
      const commands = extract('Commands:');

      let out = [];
      if (usage) {
        out.push(
          usage
          .replace(/Usage:/, x => Util.colorize['title'](x))
        );
      }
      if (options) {
        out.push(
          options
          .replace(/(\s*)(-[^, ]+)(,?\s*)(--\S+)?((\s+)?((?:\[[^\]]+\])|(?:\<[^>]+>)))?((\s+)(.*))?/g,
            (p, spacing, simpleParam, psep, fullParam, sub, subSp, subVal, desc, descSp, descVal) => {
              return [spacing,
                  Util.colorize['param'](simpleParam),
                  psep,
                  Util.colorize['param'](fullParam),
                  subSp,
                  Util.colorize['type'](subVal),
                  descSp,
                  Util.colorize['description'](descVal)
                  .replace(/([(]default:\s+)(.*?)([)])/g, (all, l, val, r) => `${l}${Util.colorize['input'](val)}${r}`)
                ]
                .filter(x => x !== '' && x !== undefined)
                .join('');
            })
          .replace(/Options:/, x => Util.colorize['title'](x))
        );
      }
      if (commands) {
        out.push(
          commands
          .replace(/\s([^\[\]]\S+)/g, x => Util.colorize['param'](x))
          .replace(/(\s*[^\x1b]\[[^\]]+\])/g, x => Util.colorize['input'](x))
          .replace(/Commands:/, x => Util.colorize['title'](x))
        );
      }

      out.push(text);

      return out.filter(x => !!x).map(x => x.trim()).join('\n\n') + '\n';
    });
    process.exit(code);
  }
};

Object.assign(Util.colorize, {
  input: Util.colorize.bind(null, 'yellow'),
  output: Util.colorize.bind(null, 'magenta'),
  path: Util.colorize.bind(null, 'white'),
  success: Util.colorize.bind(null, 'green'),
  failure: Util.colorize.bind(null, 'red'),
  param: Util.colorize.bind(null, 'green'),
  type: Util.colorize.bind(null, 'blue'),
  description: Util.colorize.bind(null, 'gray'),
  title: Util.colorize.bind(null, 'white'),
  identifier: Util.colorize.bind(null, 'blue'),
  subtitle: Util.colorize.bind(null, 'gray')
});

module.exports = { Util };