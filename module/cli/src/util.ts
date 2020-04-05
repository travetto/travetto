import * as commander from 'commander';
import * as child_process from 'child_process';

// Imported individually to prevent barrel import loading too much
import { FsUtil } from '@travetto/boot/src/fs-util';

import { color } from './color';

export interface CompletionConfig {
  all: string[];
  task: {
    [key: string]: {
      [key: string]: string[];
    };
  };
}

export class Util {
  static program = commander;

  static BOOLEAN_RE = /^(1|0|yes|no|on|off|auto|true|false)$/i;
  static TRUE_RE = /^(1|yes|on|true)$/i;

  static dependOn(cmd: string, args: string[] = [], sCwd: string = FsUtil.cwd) {
    child_process.spawnSync(`${process.argv.slice(0, 2).join(' ')} ${cmd} ${args.join(' ')}`, {
      env: process.env,
      cwd: sCwd,
      stdio: [0, 1, 2],
      shell: true
    });
  }

  static fork(cmd: string, args: string[], env: Record<string, string | undefined>) {
    return new Promise((resolve, reject) => {
      const text: Buffer[] = [];
      const err: Buffer[] = [];
      const proc = child_process.fork(cmd, args ?? [], {
        env: { ...process.env, ...(env ?? {}) },
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
      console.error(color`${{ failure: msg }}\n`);
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
        out.push(usage.replace(/Usage:/, title => color`${{ title }}`));
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
              const line: string[] = [];
              line.push(
                spacing,
                color`${{ param: simpleParam }}`,
                pSep,
                color`${{ param: fullParam }}`,
                subSp,
                color`${{ type: subVal }}`,
                descSp,
                color`${{ description: descVal }}`
                  .replace(/([(]default:\s+)(.*?)([)])/g,
                    (_, l, input, r) => color`${l}${{ input }}${r}`)
              );
              return line
                .filter(x => x !== '' && x !== undefined)
                .join('');
            })
            .replace(/Options:/, title => color`${{ title }}`)
        );
      }
      if (commands) {
        out.push(
          commands
            .replace(/\s([^\[\]]\S+)/g, param => color`${{ param }}`)
            .replace(/(\s*[^\x1b]\[[^\]]+\])/g, input => color`${{ input }}`) // eslint-disable-line no-control-regex
            .replace(/Commands:/, title => color`${{ title }}`)
        );
      }

      out.push(text);

      return `${out.filter(x => !!x).map(x => x.trim()).join('\n\n')}\n`;
    });
    process.exit(code);
  }
}