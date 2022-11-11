import { Injectable } from '@travetto/di';
import { YamlUtil } from '@travetto/yaml';

import { ConfigParser } from './types';

@Injectable()
export class YAMLConfigParser implements ConfigParser {
  ext = ['yaml', 'yml']
  parse = YamlUtil.parse;
}