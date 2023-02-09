import { FileQueryProvider } from '@travetto/base';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';

import { ConfigParserTarget } from '../internal/types';
import { ConfigParser } from '../parser/types';
import { ConfigSource, ConfigValue } from './types';

/**
 * File-base config source, builds on common file resource provider
 */
export class FileConfigSource extends FileQueryProvider implements ConfigSource {

  @InjectableFactory()
  static getInstance(): ConfigSource {
    return new FileConfigSource();
  }

  depth = 1;
  extMatch: RegExp;
  parsers: Record<string, ConfigParser>;
  priority = 1;

  constructor(paths: string[] = []) {
    super({ includeCommon: true, paths });
  }

  async postConstruct(): Promise<void> {
    const parserClasses = await DependencyRegistry.getCandidateTypes(ConfigParserTarget);
    const parsers = await Promise.all(parserClasses.map(x => DependencyRegistry.getInstance<ConfigParser>(x.class, x.qualifier)));

    // Register parsers
    this.parsers = {};
    for (const par of parsers) {
      for (const ext of par.ext) {
        this.parsers[ext] = par;
      }
    }

    this.extMatch = parsers.length ? new RegExp(`[.](${Object.keys(this.parsers).join('|')})`) : /^$/;
  }

  async getValues(profiles: string[]): Promise<ConfigValue[]> {
    const out: ConfigValue[] = [];

    for await (const file of this.query(f => this.extMatch.test(f))) {
      const ext = file.split('.')[1];
      const profile = file.replace(`.${ext}`, '');
      if (!profiles.includes(profile) || !this.parsers[ext]) {
        continue;
      }
      const content = await this.read(file);
      const desc = await this.describe(file);
      out.push({
        profile,
        config: await this.parsers[ext].parse(content),
        source: `file://${desc.path}`,
        priority: this.priority
      });
    }
    return out;
  }
}