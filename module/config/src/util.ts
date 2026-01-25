import { castTo, RuntimeResources } from '@travetto/runtime';

export class ConfigUtil {
  /**
   * Given an input, determine if its binary data, a text data or a path to a file, and read accordingly
   */
  static async readFile<T extends string | Buffer>(input: T): Promise<T> {
    if (Buffer.isBuffer(input)) {
      return input;
    } else {
      try {
        return castTo(await RuntimeResources.resolve(input));
      } catch {
        return input;
      }
    }
  }
}