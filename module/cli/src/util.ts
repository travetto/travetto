import * as commander from 'commander';
import * as child_process from 'child_process';
import { FsUtil, EnvUtil } from '@travetto/boot';

const COLORS = {
  blue: `\x1b[94m`,
  yellow: `\x1b[93m`,
  green: `\x1b[92m`,
  gray: `\x1b[37m\x1b[2m`,
  red: `\x1b[31m`,
  cyan: `\x1b[96m`,
  magenta: `\x1b[95m`,
  white: `\x1b[97m\x1b[1m`,
  reset: `\x1b[0m`,

};

export interface CompletionConfig {
  all: string[];
  task: {
    [key: string]: {
      [key: string]: string[]
    }
  };
}

const HAS_COLOR = process.stdout.isTTY && !EnvUtil.isTrue('NO_COLOR');

function colorizeAny(color: keyof typeof COLORS, value: string | number | boolean): string;
function colorizeAny(color: keyof typeof COLORS, value: any) {
  if (HAS_COLOR && value !== undefined && value !== null && value !== '') {
    const code = COLORS[color];
    value = `${code}${value}${COLORS.reset}`;
  }
  return value;
}

export class Util {
  static HAS_COLOR = HAS_COLOR;
  static program = commander;

  static colorize = {
    input: colorizeAny.bind(null, 'yellow'),
    output: colorizeAny.bind(null, 'magenta'),
    path: colorizeAny.bind(null, 'white'),
    success: colorizeAny.bind(null, 'green'),
    failure: colorizeAny.bind(null, 'red'),
    param: colorizeAny.bind(null, 'green'),
    type: colorizeAny.bind(null, 'blue'),
    description: colorizeAny.bind(null, 'gray'),
    title: colorizeAny.bind(null, 'white'),
    identifier: colorizeAny.bind(null, 'blue'),
    subtitle: colorizeAny.bind(null, 'gray')
  };

  static dependOn(cmd: string, args: string[] = [], s_cwd: string = FsUtil.cwd) {
    child_process.spawnSync(`${process.argv.slice(0, 2).join(' ')} ${cmd} ${args.join(' ')}`, {
      env: process.env,
      cwd: s_cwd,
      stdio: [0, 1, 2],
      shell: true
    });
  }

  static fork(cmd: string, args: string[], env: { [key: string]: string | undefined }) {
    return new Promise((resolve, reject) => {
      const text: Buffer[] = [];
      const err: Buffer[] = [];
      const proc = child_process.fork(cmd, args || [], {
        env: { ...process.env, ...(env || {}) },
        cwd: FsUtil.cwd,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
      });
      proc.stdout!.on('data', v => text.push(v));
      proc.stderr!.on('data', v => err.push(v));
      proc.on('exit', v => {
        if (v === 0) {
          resolve(Buffer.concat(text).toString());
        } else {
          reject(Buffer.concat(err).toString());
        }
      });
    });
  }

  static showHelp(cmd: commander.Command, msg = '', code = msg === '' ? 0 : 1) {

    if (msg) {
      console.error(this.colorize['failure'](`${msg}\n`));
    }

    cmd.outputHelp(text => {
      function extract(key: string) {
        let sub;
        if (text.includes(key)) {
          const start = text.indexOf(key);
          let end = text.indexOf('\n\n', start);
          if (end < 0) {
            end = text.length;
          }
          sub = text.substring(start, end);
          text = text.substring(end);
        }
        return sub;
      }
      const usage = extract('Usage:');
      const options = extract('Options:');
      const commands = extract('Commands:');

      const out = [];
      if (usage) {
        out.push(
          usage
            .replace(/Usage:/, x => this.colorize.title(x))
        );
      }
      if (options) {
        out.push(
          options
            .replace(/(\s*)(-[^, ]+)(,?\s*)(--\S+)?((\s+)?((?:\[[^\]]+\])|(?:\<[^>]+>)))?((\s+)(.*))?/g, (
              p: string, spacing: string,
              simpleParam: string, pSep: string,
              fullParam: string, sub: string,
              subSp: string, subVal: string,
              desc: string, descSp: string,
              descVal: string
            ) => {
              return [spacing,
                this.colorize.param(simpleParam),
                pSep,
                this.colorize.param(fullParam),
                subSp,
                this.colorize.type(subVal),
                descSp,
                this.colorize.description(descVal)
                  .replace(/([(]default:\s+)(.*?)([)])/g,
                    (all: string, l: string, val: string, r: string) => `${l}${this.colorize.input(val)}${r}`)
              ]
                .filter(x => x !== '' && x !== undefined)
                .join('');
            })
            .replace(/Options:/, x => this.colorize.title(x))
        );
      }
      if (commands) {
        out.push(
          commands
            .replace(/\s([^\[\]]\S+)/g, x => this.colorize.param(x))
            .replace(/(\s*[^\x1b]\[[^\]]+\])/g, x => this.colorize.input(x))
            .replace(/Commands:/, x => this.colorize.title(x))
        );
      }

      out.push(text);

      return `${out.filter(x => !!x).map(x => x.trim()).join('\n\n')}\n`;
    });
    process.exit(code);
  }
}