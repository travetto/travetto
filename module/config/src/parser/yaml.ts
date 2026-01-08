import { parse as parseYaml } from 'yaml';
import { Injectable } from '@travetto/di';
import type { ConfigData, ConfigParser } from './types.ts';

@Injectable()
export class YAMLConfigParser implements ConfigParser {
  ext = ['.yaml', '.yml'];
  parse = (input: string): ConfigData => parseYaml(input) ?? {};
}