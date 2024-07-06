import { Injectable } from '@travetto/di';
import { parse as parseYaml } from 'yaml';

import { ConfigParser } from './types';

@Injectable()
export class YAMLConfigParser implements ConfigParser {
  ext = ['.yaml', '.yml'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parse = (v: string): any => parseYaml(v) ?? {};
}