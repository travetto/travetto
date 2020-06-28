import * as fs from 'fs';
import * as path from 'path';

import '@travetto/registry';
import { ExecUtil, FsUtil } from '@travetto/boot';

const PKG_ROOT = FsUtil.resolveUnix(fs.realpathSync(__dirname), '..', '..');

export class DocUtil {
  static DEC_CACHE: Record<string, boolean> = {};

  static PACKAGES = new Map(
    fs.readdirSync(PKG_ROOT)
      .filter(x => !x.startsWith('.'))
      .map(x => [x, require(`${PKG_ROOT}/${x}/package.json`) as Record<string, any>])
  );

  static run(cmd: string, ...args: string[]) {
    if (cmd === 'travetto') {
      args.unshift(cmd);
      cmd = `npx`;
    } else if (/.*[.]ts$/.test(cmd)) {
      args.unshift('-r', '@travetto/boot/register', cmd);
      cmd = `node`;
    }

    process.env.TRV_DEBUG = '0';
    // eslint-disable-next-line no-control-regex
    return ExecUtil.execSync(cmd, args).replace(/\x1b\[\d+[a-z]/g, '');
  }

  static read(file: string) {
    if (file.startsWith('@')) {
      file = require.resolve(file);
    }
    let text = fs.readFileSync(FsUtil.resolveUnix(FsUtil.cwd, file), 'utf8')
      .replace(/^\/\/\s*@file-if.*/, '');

    text = text.split(/\n/)
      .map(x => {
        if (/^import.*\.\.\/\.\./.test(x)) {
          // eslint-disable-next-line prefer-const
          let [imp, from] = x.split(' from ');
          from = FsUtil.resolveUnix(path.dirname(file), from.replace(/[';]/g, ''))
            .replace(/^.*travetto\/module/, '@travetto');

          return `${imp} from '${from}';`;
        }
        return x;
      })
      .filter(x => !x.includes('@doc-exclude'))
      .join('\n');

    let language = 'typescript';
    switch (path.extname(file)) {
      case '.ts': language = 'typescript'; break;
      case '.js': language = 'javascript'; break;
      case '.yml':
      case '.yaml': language = 'yaml'; break;
      case 'properties': language = 'properties'; break;
      case '.sh': language = 'bash'; break;
      case '.xml': language = 'xml'; break;
      case '.html': language = 'html'; break;
      case '.css': language = 'css'; break;
      case '.scss': language = 'scss'; break;
    }

    return { content: text, language, file };
  }

  static isDecorator(name: string, file: string) {
    if (file.startsWith('@')) {
      file = require.resolve(file);
    }
    const key = `${name}:${file}`;
    if (key in this.DEC_CACHE) {
      return this.DEC_CACHE[key];
    }


    const text = fs.readFileSync(FsUtil.resolveUnix(FsUtil.cwd, file), 'utf8')
      .split(/\n/g);

    const start = text.findIndex(x => x.includes(`function ${name}`));
    let ret = false;
    if (start > 0) {
      for (let i = start - 1; i > start - 3; i--) {
        if (text[i].includes('@augments')) {
          ret = true;
          break;
        }
      }
    }
    this.DEC_CACHE[key] = ret;
    return ret;
  }

  static cleanCode(code: string, outline = false) {
    if (outline) {
      let methodPrefix = '';
      code = code.split(/\n/).map((x) => {
        if (!methodPrefix) {
          const info = x.match(/^(\s+)(?:(private|public)\s+)?(?:static\s+)?(?:(?:get|set|async)\s+)?(\S+)[(](.*)/);
          if (info) {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const [, space, __name, rest] = info;
            if (!rest.endsWith(';')) {
              methodPrefix = space;
              return x.replace(/[{]\s*$/, ';');
            }
          }
          return x;
        } else {
          if (x.startsWith(`${methodPrefix}}`)) {
            methodPrefix = '';
          }
          return '';
        }
      })
        .filter(x => !!x)
        .join('\n');
    }

    return code;
  }
}