import fs from 'fs/promises';

import { Env, FileResourceProvider, GlobalEnv } from '@travetto/base';
import { RootIndex, path } from '@travetto/manifest';

import { ConfigSource, ConfigSpec } from './types';
import { ParserManager } from '../parser/parser';

type Profile = [string, number] | readonly [string, number];

/**
 * File-base config source, builds on common file resource provider
 */
export class FileConfigSource implements ConfigSource {

  #profiles: Profile[];
  #searchPaths: string[];
  #parser: ParserManager;

  constructor(parser: ParserManager, paths?: string[], profiles?: Profile[]) {
    this.#parser = parser;
    this.#searchPaths = FileResourceProvider.resolveSearchPaths({ includeCommon: true, paths }).reverse();
    this.#profiles = profiles ?? [
      ['application', 100],
      [GlobalEnv.envName, 200],
      ...(Env.getList('TRV_PROFILES') ?? [])
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        .map((p, i) => [p, 300 + i * 10] as [string, number])
    ];
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
              detail: full.replace(`${RootIndex.manifest.workspacePath}/`, '')
            })));
          }
        }
      }
    }
    return Promise.all(configs);
  }
}