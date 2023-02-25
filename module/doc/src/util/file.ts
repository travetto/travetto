import { existsSync, readFileSync } from 'fs';

import { path, RootIndex } from '@travetto/manifest';

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
  static resolveFile(file: string): string {
    let resolved = path.resolve(file);
    if (!existsSync(resolved)) {
      if (file.endsWith('.ts')) {
        resolved = RootIndex.getSourceFile(file);
      }
      if (!existsSync(resolved)) {
        throw new Error(`Unknown file to resolve: ${file}`);
      }
    }
    return resolved;
  }

  /**
   * Read file
   *
   * @param file
   * @returns
   */
  static read(file: string): { content: string, language: string, file: string } {
    file = this.resolveFile(file);

    const ext = path.extname(file).replace(/^[.]/, '');
    const language = this.#extToLang[ext] ?? ext;

    let text: string | undefined;
    if (language) {
      text = readFileSync(file, 'utf8');

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

    return { content: text ?? '', language, file };
  }

  /**
   * Determine if a file is a decorator
   */
  static isDecorator(name: string, file: string): boolean {
    file = this.resolveFile(file);

    const key = `${name}:${file}`;
    if (key in this.#decCache) {
      return this.#decCache[key];
    }

    const text = readFileSync(file, 'utf8')
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