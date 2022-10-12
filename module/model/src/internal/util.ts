import { SystemUtil } from '@travetto/boot/src/internal/system';

export class ModelUtil {
  static uuid(len: number = 32): string {
    return SystemUtil.uuid(len);
  }
}