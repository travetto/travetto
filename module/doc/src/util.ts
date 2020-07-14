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

  static run(cmd: string, args: string[], config: { cwd?: string } = {}) {
    if (cmd === 'travetto') {
      args.unshift(cmd);
      cmd = `npx`;
    } else if (/.*[.][tj]s$/.test(cmd)) {
      args.unshift('-r', '@travetto/boot/register', cmd);
      cmd = `node`;
    }

    process.env.TRV_DEBUG = '0';
    if (config.cwd) {
      process.chdir(config.cwd);
    }
    try {
      return ExecUtil.execSync(cmd, args)
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b\[[?]?[0-9]{1,2}[a-z]/gi, '')
        .replace(new RegExp(FsUtil.cwd, 'g'), '.');
    } finally {
      process.chdir(FsUtil.cwd);
    }
  }

  static cleanFile(file: string) {
    if (file.startsWith('@')) {
      file = require.resolve(file);
    }
    const resolved = FsUtil.resolveUnix(file);
    return { resolved, cleaned: resolved.replace(/^.*node_modules\//, '') };
  }

  static read(file: string) {
    const { resolved, cleaned } = this.cleanFile(file);
    if (file.startsWith('@')) {
      file = require.resolve(file);
    }

    let language = '';
    switch (path.extname(file)) {
      case '.ts': language = 'typescript'; break;
      case '.js': language = 'javascript'; break;
      case '.yml':
      case '.yaml': language = 'yaml'; break;
      case '.json': language = 'json'; break;
      case '.properties': language = 'properties'; break;
      case '.sh': language = 'bash'; break;
      case '.xml': language = 'xml'; break;
      case '.html': language = 'html'; break;
      case '.css': language = 'css'; break;
      case '.scss': language = 'scss'; break;
    }

    let text: string | undefined;
    if (language) {
      text = fs.readFileSync(resolved, 'utf8')
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
    }

    return { content: text ?? '', language, file: cleaned };
  }

  static isDecorator(name: string, file: string) {
    if (file.startsWith('@')) {
      file = require.resolve(file);
    }
    const key = `${name}:${file}`;
    if (key in this.DEC_CACHE) {
      return this.DEC_CACHE[key];
    }


    const text = fs.readFileSync(FsUtil.resolveUnix(file), 'utf8')
      .split(/\n/g);

    const start = text.findIndex(x => new RegExp(`function ${name}\\b`).test(x));
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