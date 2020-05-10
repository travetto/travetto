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