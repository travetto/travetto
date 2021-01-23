import type { Class } from '@travetto/base';
import type { ModelStorageSupport } from '@travetto/model/src/service/storage';
import type { ModelType } from '@travetto/model/src/types/model';

export class CliModelExportUtil {
  static async run(provider: ModelStorageSupport, models: Class<ModelType>[]) {
    (await import('@travetto/base')).ShutdownManager.execute(-1); // Release database
  }
}