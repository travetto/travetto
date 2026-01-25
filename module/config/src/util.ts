import { BinaryUtil, castTo, RuntimeResources, type BinaryType } from '@travetto/runtime';

export class ConfigUtil {
  /**
   * Given an input, determine if its binary data, a text data or a path to a file, and read accordingly
   */
  static async readFile<T extends string | BinaryType>(input: T): Promise<T extends BinaryType ? Buffer : string> {
    if (BinaryUtil.isBinaryType(input)) {
      return castTo(BinaryUtil.toByteArray(input));
    } else {
      try {
        return castTo(await RuntimeResources.resolve(input));
      } catch {
        return castTo(input);
      }
    }
  }
}