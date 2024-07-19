import { Injectable } from '@travetto/di';
import { parse as parseYaml } from 'yaml';

import { ConfigData, ConfigParser } from './types';

@Injectable()
export class YAMLConfigParser implements ConfigParser {
  ext = ['.yaml', '.yml'];
  parse = (input: string): ConfigData => parseYaml(input) ?? {};
}