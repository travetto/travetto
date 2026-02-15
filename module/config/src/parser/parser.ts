import fs from 'node:fs/promises';
import path from 'node:path';

import { DependencyRegistryIndex, Injectable } from '@travetto/di';
import { RuntimeError, toConcrete } from '@travetto/runtime';

import type { ConfigData, ConfigParser } from './types.ts';

@Injectable()
export class ParserManager {

  #extMatch: RegExp;
  #parsers: Record<string, ConfigParser>;

  async postConstruct(): Promise<void> {
    const parsers = await DependencyRegistryIndex.getInstances(toConcrete<ConfigParser>());

    // Register parsers
    this.#parsers = Object.fromEntries(parsers.flatMap(parser => parser.ext.map(ext => [ext, parser])));
    this.#extMatch = parsers.length ? new RegExp(`(${Object.keys(this.#parsers).join('|').replaceAll('.', '[.]')})`) : /^$/;
  }

  /**
   * Attempt ot parse a file, based on file's extension
   */
  async parse(file: string): Promise<ConfigData> {
    const ext = path.extname(file);
    if (!this.#parsers[ext]) {
      throw new RuntimeError(`Unknown config format: ${ext}`, { category: 'data' });
    }
    return fs.readFile(file, 'utf8').then(content => this.#parsers[ext].parse(content));
  }

  /**
   * Determine if file matches
   */
  matches(file: string): boolean {
    return this.#extMatch.test(file);
  }
}