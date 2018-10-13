import { Env } from '@travetto/base';

import { Parser } from './parser';
import { Serializer } from './serializer';

export class YamlUtil {
  static parse = (text: string) => new Parser(text).parse();
  static serialize = (o: any) => Serializer.serialize(o);
}

if (!Env.isTrue('NO_JSYAML')) {
  try {
    const yaml = require('js-yaml');
    YamlUtil.parse = t => Object.assign({}, ...yaml.safeLoadAll(t));
    YamlUtil.serialize = o => yaml.safeDump(o);
  } catch (e) { }
}