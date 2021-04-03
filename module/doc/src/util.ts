import * as fs from 'fs';
import * as path from 'path';

import { FsUtil, PathUtil } from '@travetto/boot';

const ESLINT_PATTERN = /\s*\/\/ eslint.*$/;

export class DocUtil {
  static DEC_CACHE: Record<string, boolean> = {};
  static EXT_TO_LANG: Record<string, string> = {
    ts: 'typescript',
    js: 'javascript',
    yml: 'yaml',
    sh: 'bash',
  };

  static resolveFile(file: string) {
    if (file.startsWith('@')) {
      file = require.resolve(file);
    }
    const resolved = PathUtil.resolveUnix(file);
    return { resolved, cleaned: resolved.replace(/^.*node_modules\//, '') };
  }

  static read(file: string) {
    const { resolved, cleaned } = this.resolveFile(file);

    const ext = path.extname(resolved).replace(/^[.]/, '');
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
          return x;
        })
        .filter(x => !x.includes('@doc-exclude'))
        .join('\n');
    }

    return { content: text ?? '', language, file: cleaned };
  }

  static isDecorator(name: string, file: string) {
    const { resolved } = this.resolveFile(file);

    const key = `${name}:${resolved}`;
    if (key in this.DEC_CACHE) {
      return this.DEC_CACHE[key];
    }

    const text = fs.readFileSync(resolved, 'utf8')
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
          const info = x.match(/^(\s+)(?:(private|public)\s+)?(?:static\s+)?(?:async\s+)?(?:[*]\s*)?(?:(?:get|set)\s+)?(\S+)[<(](.*)/);
          if (info) {
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
        .filter(x => !/^\s+private /.test(x))
        .filter(x => !!x)
        .join('\n');
    }

    return code;
  }

  static resolveRef<T>(title: string | T, file: string) {

    let line = 0;
    const { resolved } = this.resolveFile(file);
    file = resolved;

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

    if (startIdx < 0) {
      throw new Error(`Pattern ${startPattern.source} not found in ${file}`);
    }

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