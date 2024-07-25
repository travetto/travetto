import fs from 'node:fs/promises';
import path from 'node:path';

import { DependencyRegistry, Injectable } from '@travetto/di';
import { AppError } from '@travetto/runtime';

import { ConfigParserTarget } from '../internal/types';
import { ConfigData, ConfigParser } from './types';

@Injectable()
export class ParserManager {

  #extMatch: RegExp;
  #parsers: Record<string, ConfigParser>;

  async postConstruct(): Promise<void> {
    const parserClasses = await DependencyRegistry.getCandidateTypes(ConfigParserTarget);
    const parsers = await Promise.all(parserClasses.map(x => DependencyRegistry.getInstance<ConfigParser>(x.class, x.qualifier)));

    // Register parsers
    this.#parsers = Object.fromEntries(parsers.flatMap(p => p.ext.map(e => [e, p])));
    this.#extMatch = parsers.length ? new RegExp(`(${Object.keys(this.#parsers).join('|').replaceAll('.', '[.]')})`) : /^$/;
  }

  /**
   * Attempt ot parse a file, based on file's extension
   */
  async parse(file: string): Promise<ConfigData> {
    const ext = path.extname(file);
    if (!this.#parsers[ext]) {
      throw new AppError(`Unknown config format: ${ext}`, 'data');
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