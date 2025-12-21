import { Injectable } from '@travetto/di';
import { Util } from '@travetto/runtime';

import { ConfigParser } from './types.ts';

@Injectable()
export class JSONConfigParser implements ConfigParser {
  ext = ['.json'];
  parse = Util.parseJSONSafe;
}