import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import { Runtime, RuntimeIndex } from '@travetto/runtime';

const ESLINT_PATTERN = /\s*\/\/ eslint.*$/g;
const ENV_KEY = /Env.([^.]+)[.]key/g;

/**
 * Standard file utilities
 */
export class DocFileUtil {

  static #decCache: Record<string, boolean> = {};
  static #extToLang: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.yml': 'yaml',
    '.sh': 'bash',
  };

  static isFile(src: string): boolean {
    return /^[@:A-Za-z0-9\/\\\-_.]+[.]([a-z]{2,10})$/.test(src);
  }

  static readSource(src: string | Function): { content: string, language: string, file: string } {
    let file: string | undefined;
    let content: string | undefined;

    if (typeof src === 'string') {
      if (src.includes('\n')) {
        content = src;
      } else {
        const resolved = path.resolve(src);
        if (existsSync(resolved)) {
          content = readFileSync(resolved, 'utf8');
          file = resolved;
        } else {
          file = RuntimeIndex.getSourceFile(src);
          content = readFileSync(file, 'utf8');
        }
      }
    } else {
      file = Runtime.getSourceFile(src);
      content = readFileSync(file, 'utf8');
    }

    if (content) {
      content = content.split(/\n/)
        .map(x => x
          .replace(ESLINT_PATTERN, '')
          .replace(ENV_KEY, (_, k) => `'${k}'`)
        )
        .join('\n')
        .replace(/^\/\/# sourceMap.*$/gm, '');

    }

    if (file !== undefined) {
      const ext = path.extname(file);
      const language = this.#extToLang[ext] ?? ext.replace('.', '');
      return { content, file, language };
    } else {
      return { content, file: '', language: '' };
    }
  }

  static async readCodeSnippet(src: string | Function, startPattern: RegExp): Promise<{ file: string, startIdx: number, lines: string[], language: string }> {
    const res = this.readSource(src);
    const lines = res.content.split(/\n/);
    const startIdx = lines.findIndex(l => startPattern.test(l));
    if (startIdx < 0) {
      throw new Error(`Pattern ${startPattern.source} not found in ${src}`);
    }
    return { file: res.file, startIdx, lines, language: res.language };
  }

  /**
   * Determine if a file is a decorator
   */
  static async isDecorator(name: string, file: string): Promise<boolean> {

    const key = `${name}:${file}`;
    if (key in this.#decCache) {
      return this.#decCache[key];
    }

    const res = await this.readSource(file);
    const text = res.content.split(/\n/g);

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
            if (/\s*[{]\s*return.*$/.test(x)) {
              return x.replace(/\s*[{]\s*return.*$/, ';');
            } else {
              methodPrefix = space;
              return x.replace(/\s*[{]\s*$/, ';');
            }
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