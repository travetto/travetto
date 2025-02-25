import { Injectable } from '@travetto/di';

import { ConfigParser } from './types.ts';

@Injectable()
export class JSONConfigParser implements ConfigParser {
  ext = ['.json'];
  parse = JSON.parse.bind(JSON);
}