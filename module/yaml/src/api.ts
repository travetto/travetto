import { EnvUtil } from '@travetto/boot';
import { Parser } from './parser';
import { Serializer } from './serializer';

export class YamlUtil {
  static parse = Parser.parse.bind(Parser);
  static serialize = Serializer.serialize.bind(Serializer);
}

if (EnvUtil.isTrue('js_yaml')) {
  try {
    const yaml = require('js-yaml');
    YamlUtil.parse = (t: string) => Object.assign({}, ...yaml.safeLoadAll(t));
    YamlUtil.serialize = (o: any, indent = 2, lineWidth = 160) => yaml.safeDump(o, { indent, lineWidth });
    console.debug('Running with js-yaml');
  } catch { }
}