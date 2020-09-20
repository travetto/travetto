import * as fs from 'fs';
import * as path from 'path';

import '@travetto/registry';
import { ExecUtil, FsUtil } from '@travetto/boot';

const PKG_ROOT = FsUtil.resolveUnix(fs.realpathSync(__dirname), '..', '..');

const ESLINT_PATTERN = /\s*\/\/ eslint.*$/;
const IMPORT_REL = /^import.*\.\.\/\.\./;

export class DocUtil {
  static DEC_CACHE: Record<string, boolean> = {};
  static EXT_TO_LANG: Record<string, string> = {
    ts: 'typescript',
    js: 'javascript',
    yml: 'yaml',
    sh: 'bash',
  };

  static baseline = new Date(`${new Date().getFullYear()}-03-14T00:00:00.000`).getTime();
  static _s = 37;
  static ids: Record<string, string> = {};

  static PACKAGES = new Map(
    fs.readdirSync(PKG_ROOT)
      .filter(x => !x.startsWith('.'))
      .map(x => [x, require(`${PKG_ROOT}/${x}/package.json`) as Record<string, any>])
  );

  static rng() {
    this._s = Math.sin(this._s) * 10000;
    return this._s - Math.floor(this._s);
  }

  static getDate(d: string) {
    this.baseline += this.rng() * 1000;
    return new Date(this.baseline).toISOString();
  }

  static getId(id: string) {
    if (!this.ids[id]) {
      this.ids[id] = ' '.repeat(id.length).split('').map(x => Math.trunc(this.rng() * 16).toString(16)).join('');
    }
    return this.ids[id];
  }

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
        .replace(new RegExp(FsUtil.cwd, 'g'), '.')
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([.]\d{3})?Z?/g, this.getDate.bind(this))
        .replace(/\b[0-9a-f]{4}[0-9a-f\-]{8,40}\b/ig, this.getId.bind(this))
        .replace(/(\d+[.]\d+[.]\d+)-(alpha|rc)[.]\d+/g, (all, v) => v);
    } catch (err) {
      return err.message;
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

    const ext = path.extname(file).replace(/^[.]/, '');
    const language = this.EXT_TO_LANG[ext] || ext;

    let text: string | undefined;
    if (language) {
      text = fs.readFileSync(resolved, 'utf8')
        .replace(/^\/\/\s*@file-if.*/, '');

      text = text.split(/\n/)
        .map(x => {
          if (ESLINT_PATTERN.test(x)) {
            x = x.replace(ESLINT_PATTERN, '');
          }
          if (IMPORT_REL.test(x)) {
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

  static resolveRef<T>(title: string | T, file: string) {

    let line = 0;
    if (file.startsWith('@')) {
      file = require.resolve(file);
    } else if (/^([.][/]|src|alt)/.test(file)) {
      if (!file.startsWith('.')) {
        file = `./${file}`;
      }
      file = FsUtil.resolveUnix(file);
    }
    if (!FsUtil.existsSync(file)) {
      throw new Error(`${file} is not a valid location`);
    } else {
      const res = this.read(file);
      file = res.file;
      if (typeof title == 'string') {
        if (res.content) {
          line = res.content.split(/\n/g)
            .findIndex(x => new RegExp(`(class|function)[ ]+${title}`).test(x));
          if (line < 0) {
            line = 0;
          } else {
            line += 1;
          }
          if (this.isDecorator(title, file)) {
            title = `@${title}`;
          }
        }
      }
    }
    return { title, file, line };
  }

  static resolveCode<T>(content: string | T, language: string, outline = false) {
    let file: string | undefined;
    if (typeof content === 'string') {
      if (/^[@:A-Za-z0-9\/\\\-_.]+[.]([a-z]{2,4})$/.test(content)) {
        const res = this.read(content);
        language = res.language;
        file = res.file;
        content = res.content;
        content = this.cleanCode(content, outline);
      }
      content = content.replace(/^\/\/# sourceMap.*$/gm, '');
    }
    return { content, language, file };
  }

  static resolveConfig<T>(content: string | T, language: string) {
    let file: string | undefined;
    if (typeof content === 'string') {
      if (/^[@:A-Za-z0-9\/\\\-_.]+[.](ya?ml|properties)$/.test(content)) {
        const res = this.read(content);
        language = res.language;
        file = res.file;
        content = res.content;
      }
    }
    return { content, language, file };
  }

  static resolveSnippet(file: string, startPattern: RegExp, endPattern?: RegExp, outline = false) {
    const res = this.read(file);
    const language = res.language;
    file = res.file;
    const content = res.content.split(/\n/g);
    const startIdx = content.findIndex(l => startPattern.test(l));
    const endIdx = endPattern ? content.findIndex((l, i) => i > startIdx && endPattern.test(l)) : startIdx;
    let text = content.slice(startIdx, endIdx + 1).join('\n');

    if (outline) {
      text = this.cleanCode(text, outline);
    }
    return { text, language, line: startIdx + 1, file };
  }

  static resolveSnippetLink(file: string, startPattern: RegExp) {
    const res = this.read(file);
    const line = res.content.split(/\n/g).findIndex(l => startPattern.test(l));
    if (line < 0) {
      throw new Error(`Pattern ${startPattern.source} not found in ${file}`);
    }
    return { file: res.file, line: line + 1 };
  }
}