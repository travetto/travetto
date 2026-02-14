import { Injectable } from '@travetto/di';
import { JSONUtil } from '@travetto/runtime';

import type { ConfigParser } from './types.ts';

@Injectable()
export class JSONConfigParser implements ConfigParser {
  ext = ['.json'];
  parse = JSONUtil.fromUTF8;
}