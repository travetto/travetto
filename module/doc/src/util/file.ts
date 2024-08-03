import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { ManifestModuleUtil } from '@travetto/manifest';
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

  /**
   * Resolve file
   * @param file
   * @returns
   */
  static async resolveFile(file: string): Promise<string> {
    let resolved = path.resolve(file);
    if (!(await fs.stat(resolved).catch(() => false))) {
      if (ManifestModuleUtil.getFileType(file) === 'ts') {
        resolved = RuntimeIndex.getSourceFile(file);
      }
      if (!(await fs.stat(resolved).catch(() => false))) {
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
  static async read(file: string): Promise<{ content: string, language: string, file: string }> {
    file = await this.resolveFile(file);

    const ext = path.extname(file);
    const language = this.#extToLang[ext] ?? ext.replace('.', '');

    let text: string | undefined;
    if (language) {
      text = await fs.readFile(file, 'utf8');

      text = text.split(/\n/)
        .map(x => x
          .replace(ESLINT_PATTERN, '')
          .replace(ENV_KEY, (_, k) => `'${k}'`)
        )
        .join('\n');
    }

    return { content: text ?? '', language, file };
  }

  static async readCodeSnippet(file: string, startPattern: RegExp): Promise<{ file: string, startIdx: number, lines: string[], language: string }> {
    const res = await this.read(file);
    const lines = res.content.split(/\n/g);
    const startIdx = lines.findIndex(l => startPattern.test(l));
    if (startIdx < 0) {
      throw new Error(`Pattern ${startPattern.source} not found in ${file}`);
    }
    return { file: res.file, startIdx, lines, language: res.language };
  }

  /**
   * Determine if a file is a decorator
   */
  static async isDecorator(name: string, file: string): Promise<boolean> {
    file = await this.resolveFile(file);

    const key = `${name}:${file}`;
    if (key in this.#decCache) {
      return this.#decCache[key];
    }

    const text = (await fs.readFile(file, 'utf8'))
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

  /**
   * Read file source for a given function
   */
  static readSource(fn: Function): string {
    return readFileSync(Runtime.getSourceFile(fn), 'utf8');
  }
}