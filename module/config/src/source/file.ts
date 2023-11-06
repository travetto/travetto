import { FileQueryProvider } from '@travetto/base';
import { RootIndex, path } from '@travetto/manifest';

import { ConfigSource } from './types';
import { ParserManager } from '../parser/parser';
import { ConfigData } from '../parser/types';

/**
 * File-base config source, builds on common file resource provider
 */
export class FileConfigSource extends FileQueryProvider implements ConfigSource {

  priority = 10;
  source: string;
  profile: string;
  parser: ParserManager;

  constructor(parser: ParserManager, profile: string, priority: number, paths: string[] = []) {
    super({ includeCommon: true, paths });
    this.priority = priority;
    this.profile = profile;
    this.parser = parser;
    this.source = `file://${profile}`;
  }

  async getData(): Promise<ConfigData[]> {
    const out: ConfigData[] = [];
    for await (const file of this.query(f => this.parser.matches(f))) {
      const ext = path.extname(file);
      const base = path.basename(file, ext);
      if (base === this.profile && !file.includes('/')) { // Ensures no nesting
        for (const resolved of await this.resolveAll(file)) {
          // Ensure more specific files are processed later, .resolveAll returns with most specific first
          const data = await this.parser.parse(resolved);
          // eslint-disable-next-line @typescript-eslint/naming-convention    
          out.push({ ...data, __ID__: resolved.replace(`${RootIndex.manifest.workspacePath}/`, '') });
        }
      }
    }
    return out.reverse();
  }
}