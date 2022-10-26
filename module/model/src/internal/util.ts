import { Util } from '@travetto/base';

export class ModelUtil {
  static uuid(len: number = 32): string {
    return Util.uuid(len);
  }
}