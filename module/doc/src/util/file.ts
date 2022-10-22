import { readFileSync } from 'fs';
import * as path from 'path';

import { FsUtil, Package, PathUtil } from '@travetto/boot';

const ESLINT_PATTERN = /\s*\/\/ eslint.*$/;

/**
 * Standard file utilities
 */
export class FileUtil {

  static #decCache: Record<string, boolean> = {};
  static #extToLang: Record<string, string> = {
    ts: 'typescript',
    js: 'javascript',
    yml: 'yaml',
    sh: 'bash',
  };

  /**
   * Resolve file
   * @param file
   * @returns
   */
  static resolveFile(file: string): { resolved: string, cleaned: string } {
    if (!FsUtil.existsSync(PathUtil.resolveUnix(file))) {
      file = require.resolve(file);
    }
    const resolved = PathUtil.resolveUnix(file);
    // TODO: Fix name
    return { resolved, cleaned: [resolved, Package.name].join(' ') };
  }

  /**
   * Read file
   *
   * @param file
   * @returns
   */
  static read(file: string): { content: string, language: string, file: string } {
    const { resolved, cleaned } = this.resolveFile(file);

    const ext = path.extname(resolved).replace(/^[.]/, '');
    const language = this.#extToLang[ext] ?? ext;

    let text: string | undefined;
    if (language) {
      text = readFileSync(resolved, 'utf8');

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

  /**
   * Determine if a file is a decorator
   */
  static isDecorator(name: string, file: string): boolean {
    const { resolved } = this.resolveFile(file);

    const key = `${name}:${resolved}`;
    if (key in this.#decCache) {
      return this.#decCache[key];
    }

    const text = readFileSync(resolved, 'utf8')
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
    this.#decCache[key] = ret;
    return ret;
  }

  /**
   * Clean code snippet
   * @returns
   */
  static buildOutline(code: string): string {
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
      .filter(x => !/^\s+(#|private |static #|async #)/.test(x))
      .filter(x => !!x)
      .join('\n');

    return code;
  }
}