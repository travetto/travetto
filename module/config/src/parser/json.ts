import { Injectable } from '@travetto/di';
import { JSONUtil } from '@travetto/runtime';

import { ConfigParser } from './types.ts';

@Injectable()
export class JSONConfigParser implements ConfigParser {
  ext = ['.json'];
  parse = JSONUtil.parseSafe;
}