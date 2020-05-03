import { EnvUtil } from '@travetto/boot';
import { Parser } from './internal/parser';
import { Serializer } from './internal/serializer';

// TODO: Document
export class YamlUtil {
  static parse = Parser.parse.bind(Parser);
  static serialize = Serializer.serialize.bind(Serializer);
}

// TODO: Document
if (EnvUtil.isTrue('JS_YAML')) {
  try {
    const yaml = require('js-yaml');
    YamlUtil.parse = (t: string) => Object.assign({}, ...yaml.safeLoadAll(t));
    YamlUtil.serialize = (o: any, indent = 2, lineWidth = 160) => yaml.safeDump(o, { indent, lineWidth });
    console.debug('Running with js-yaml');
  } catch { }
}