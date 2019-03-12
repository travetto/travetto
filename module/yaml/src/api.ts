import { Parser } from './parser';
import { Serializer } from './serializer';

export class YamlUtil {
  static parse = Parser.parse.bind(Parser);
  static serialize = Serializer.serialize.bind(Serializer);
}

if ('JS_YAML' in process.env || (!('NO_JS_YAML' in process.env) && !/travetto[\/\\]module/.test(__dirname))) {
  try {
    const yaml = require('js-yaml');
    YamlUtil.parse = t => Object.assign({}, ...yaml.safeLoadAll(t));
    YamlUtil.serialize = (o, indent = 2, lineWidth = 160) => yaml.safeDump(o, { indent, lineWidth });
    console.debug('Running with js-yaml');
  } catch (e) { }
}