import { Injectable } from '@travetto/di';
import { CodecUtil } from '@travetto/runtime';

import type { ConfigParser } from './types.ts';

@Injectable()
export class JSONConfigParser implements ConfigParser {
  ext = ['.json'];
  parse = CodecUtil.fromJSON;
}