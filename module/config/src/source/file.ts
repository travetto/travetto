import fs from 'node:fs/promises';
import path from 'node:path';

import { Env, Runtime, RuntimeResources } from '@travetto/runtime';

import type { ConfigSource, ConfigPayload } from './types.ts';
import type { ParserManager } from '../parser/parser.ts';

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
    this.#searchPaths = RuntimeResources.searchPaths.toReversed();
    this.#profiles = ([
      ['application', 100],
      [Runtime.env!, 200],
      ...(Env.TRV_PROFILES.list ?? [])
        .map((profile, i) => [profile, 300 + i * 10] as const)
    ] as const).filter(entry => !!entry[0]);
  }

  async get(): Promise<ConfigPayload[]> {
    const cache: Record<string, Promise<string[]>> = {};
    const configs: Promise<ConfigPayload>[] = [];

    for (const [profile, priority] of this.#profiles) {
      let i = priority;
      for (const folder of this.#searchPaths) {
        const files = await (cache[folder] ??= fs.readdir(folder).catch(() => []));
        for (const file of files) {
          if (this.#parser.matches(file) && path.basename(file, path.extname(file)) === profile) {
            const full = path.resolve(folder, file);
            const configPriority = i++;
            configs.push(this.#parser.parse(full).then(data => ({
              data,
              priority: configPriority,
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