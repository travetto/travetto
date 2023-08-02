import { Injectable } from '@travetto/di';

import { ConfigParser } from './types';

@Injectable()
export class JSONConfigParser implements ConfigParser {
  ext = ['.json'];
  parse = JSON.parse.bind(JSON);
}