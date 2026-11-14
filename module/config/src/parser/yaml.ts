import { parse as parseYaml } from 'yaml';

import { Injectable } from '@travetto/di';
import type { UnknownRecord } from '@travetto/runtime';

import type { ConfigParser } from './types.ts';

@Injectable()
export class YAMLConfigParser implements ConfigParser {
  ext = ['.yaml', '.yml'];
  parse = (input: string): UnknownRecord => parseYaml(input) ?? {};
}
