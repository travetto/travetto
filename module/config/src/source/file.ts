import { CommonFileResourceProvider } from '@travetto/base';
import { DependencyRegistry, Injectable } from '@travetto/di';

import { ConfigParserTarget } from '../internal/types';
import { ConfigParser } from '../parser/types';
import { ConfigPriority, ConfigSource, ConfigValue } from './types';

@Injectable()
export class FileConfigSource extends CommonFileResourceProvider implements ConfigSource {

  depth = 1;
  extMatch: RegExp;
  parsers: Record<string, ConfigParser>;
  priority = 1 as ConfigPriority;

  async postConstruct() {
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
    for (const file of await this.query(f => this.extMatch.test(f))) {
      const ext = file.split('.')[1];
      const profile = file.replace(`.${ext}`, '');
      if (!profiles.includes(profile) || !this.parsers[ext]) {
        continue;
      }
      const content = await this.read(file);
      out.push({
        profile,
        config: await this.parsers[ext].parse(content),
        source: `file://${file}`,
        priority: this.priority
      });
    }
    return out;
  }
}