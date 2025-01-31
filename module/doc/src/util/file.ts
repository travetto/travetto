import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import { AppError, Runtime, RuntimeIndex } from '@travetto/runtime';

const ESLINT_PATTERN = /\s{0,10}\/\/ eslint.{0,300}$/g;
const ENV_KEY = /Env.([^.]{1,100})[.]key/g;

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
      if (src.includes('\n') || src.includes(' ')) {
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
      if (!existsSync(file)) {
        throw new AppError(`Unknown file: ${typeof src === 'string' ? src : src.name} => ${file}`);
      }
      content = readFileSync(file, 'utf8');
    }

    if (content) {
      content = content.split(/\n/)
        .map(x => x
          .replace(ESLINT_PATTERN, '')
          .replace(ENV_KEY, (_, k) => `'${k}'`)
        )
        .join('\n')
        .replace(/^\/\/# sourceMap.*$/gsm, '')
        .replace(/[ ]*[/][/][ ]*@ts-expect-error[^\n]*\n/gsm, '') // Excluding errors
        .replace(/^[ ]*[/][/][ ]*[{][{][^\n]*\n/gsm, '') // Excluding conditional comments, full-line
        .replace(/[ ]*[/][/][ ]*[{][{][^\n]*/gsm, ''); // Excluding conditional comments
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
        const info = x.match(/^(\s{0,50})(?:(private|public)\s{1,10})?(?:static\s{1,10})?(?:async\s{1,10})?(?:[*]\s{0,10})?(?:(?:get|set)\s{1,10})?(\S{1,200})[<(](.{0,500})/);
        if (info) {
          const [, space, __name, rest] = info;
          if (!rest.endsWith(';')) {
            if (/\s{0,50}[{]\s{0,50}return.{0,200}$/.test(x)) {
              return x.replace(/\s{0,50}[{]\s{0,50}return.{0,200}$/, ';');
            } else {
              methodPrefix = space;
              return x.replace(/\s{0,50}[{]\s{0,50}$/, ';');
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
      .filter(x => !/#|(\b(private|protected)\b)/.test(x))
      .filter(x => !!x)
      .join('\n');

    return code;
  }
}