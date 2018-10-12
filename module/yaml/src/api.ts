import { Parser } from './parser';
import { Util } from './util';

let jsyaml: any = undefined;
try {
  jsyaml = require('js-yaml');
} catch (e) { }

export class YamlUtil {
  static parse(text: string) {
    if (jsyaml) {
      const docs = jsyaml.safeLoadAll(text);
      return Object.assign({}, ...docs);
    } else {
      return new Parser(text).parse();
    }
  }
  static serialize(o: any) {
    if (jsyaml) {
      return jsyaml.safeDump(o) as string;
    } else {
      return Util.serialize(o);
    }
  }
}