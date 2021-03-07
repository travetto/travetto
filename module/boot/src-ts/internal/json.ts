/**
 * JSON Utilities
 */
export class JSONUtil {
  /**
   * Parse JSON
   */
  static parse<T = unknown>(text: Buffer | string, reviver?: (key: string, value: unknown) => unknown): T {
    if (typeof text !== 'string') {
      text = text.toString('utf8');
    }
    return text ? JSON.parse(text, reviver) : undefined;
  }

  /**
   * Clone T
   */
  static clone<T>(data: T): T {
    return this.parse<T>(JSON.stringify(data));
  }
}