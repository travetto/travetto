import fs from 'node:fs/promises';
import path from 'node:path';

import { Env, Runtime } from '@travetto/base';

import { ConfigSource, ConfigSpec } from './types';
import { ParserManager } from '../parser/parser';

type Profile = [string, number] | readonly [string, number];

/**
 * File-based config source, relies on resource search paths for finding files
 */
export class FileConfigSource implements ConfigSource {

  #profiles: Profile[];
  #searchPaths: string[];
  #parser: ParserManager;

  constructor(parser: ParserManager) {
    this.#parser = parser;
    this.#searchPaths = Runtime.resources.searchPaths.slice().reverse();
    this.#profiles = ([
      ['application', 100],
      [Env.name!, 200],
      ...(Env.TRV_PROFILES.list ?? [])
        .map((p, i) => [p, 300 + i * 10] as const)
    ] as const).filter(x => !!x[0]);
  }

  async get(): Promise<ConfigSpec[]> {
    const cache: Record<string, Promise<string[]>> = {};
    const configs: Promise<ConfigSpec>[] = [];
    for (const [profile, priority] of this.#profiles) {
      let i = 0;
      for (const folder of this.#searchPaths) {
        const files = await (cache[folder] ??= fs.readdir(folder).catch(() => []));
        for (const file of files) {
          if (this.#parser.matches(file) && path.basename(file, path.extname(file)) === profile) {
            const full = path.resolve(folder, file);
            configs.push(this.#parser.parse(full).then(data => ({
              data,
              priority: priority + i++,
              source: `file://${profile}`,
              detail: Runtime.stripWorkspacePath(full)
            })));
          }
        }
      }
    }
    return Promise.all(configs);
  }
}