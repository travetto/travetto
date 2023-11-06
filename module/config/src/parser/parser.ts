import fs from 'fs/promises';

import { DependencyRegistry, Injectable } from '@travetto/di';
import { AppError } from '@travetto/base';
import { path } from '@travetto/manifest';

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

  async parse(file: string): Promise<ConfigData> {
    const ext = path.extname(file);
    if (!this.#parsers[ext]) {
      throw new AppError(`Unknown config format: ${ext}`, 'data');
    }
    return fs.readFile(file, 'utf8').then(content => this.#parsers[ext].parse(content));
  }

  matches(file: string): boolean {
    return this.#extMatch.test(file);
  }
}