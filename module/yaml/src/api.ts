import { Parser } from './parser';
import { Serializer } from './serializer';

export class YamlUtil {
  static parse = (text: string) => Parser.parse(text);
  static serialize = (o: any) => Serializer.serialize(o);
}

if ('JS_YAML' in process.env || (!('NO_JS_YAML' in process.env) && !/travetto[\/\\]module/.test(__dirname))) {
  try {
    const yaml = require('js-yaml');
    YamlUtil.parse = t => Object.assign({}, ...yaml.safeLoadAll(t));
    YamlUtil.serialize = o => yaml.safeDump(o);
    console.log('Running with js-yaml');
  } catch (e) { }
}