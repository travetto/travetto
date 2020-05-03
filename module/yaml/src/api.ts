import { EnvUtil } from '@travetto/boot';
import { Parser } from './internal/parser';
import { Serializer } from './internal/serializer';

/**
 * Simple yaml utility
 */
export class YamlUtil {
  /**
   * Parse text to a JS object
   */
  static parse = Parser.parse.bind(Parser);
  /**
   * Convert JS Object to YAML
   */
  static serialize = Serializer.serialize.bind(Serializer);
}

/**
 * Allow for using a more feature-full yaml implementation, via js-yaml
 */
if (EnvUtil.isTrue('JS_YAML')) {
  try {
    const yaml = require('js-yaml');
    YamlUtil.parse = (t: string) => Object.assign({}, ...yaml.safeLoadAll(t));
    YamlUtil.serialize = (o: any, indent = 2, lineWidth = 160) => yaml.safeDump(o, { indent, lineWidth });
    console.debug('Running with js-yaml');
  } catch { }
}