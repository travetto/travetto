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
    const out: { file: string, data: ConfigData }[] = [];
    for await (const file of this.query(f => this.parser.matches(f))) {
      const ext = path.extname(file);
      const base = path.basename(file, ext);
      if (base === this.profile && !file.includes('/')) { // Ensures no nesting
        for (const resolved of await this.resolveAll(file)) {
          out.push({ file: resolved, data: await this.parser.parse(resolved) });
        }
      }
    }

    // Ensure more specific files are processed later
    return out
      .sort((a, b) => (a.file.length - b.file.length) || a.file.localeCompare(b.file))
      // eslint-disable-next-line @typescript-eslint/naming-convention
      .map(a => ({ ...a.data, __ID__: a.file.replace(`${RootIndex.manifest.workspacePath}/`, '') }));
  }
}