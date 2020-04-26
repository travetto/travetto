import { ScanApp } from '@travetto/base';
import { AppCache } from '@travetto/boot';

export class CompilerUtil {

  /**
   * Find all uncompiled files
   */
  static findAllUncompiledFiles() {
    return ScanApp.findAppFiles(ScanApp.getAppPaths()).filter(x => !AppCache.hasEntry(x));
  }
}