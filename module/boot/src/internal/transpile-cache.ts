import { ExpiryFileCache } from '../cache';
import { PathUtil } from '../path';
import { EnvUtil } from '../env';
import { Host } from '../host';

import { ModuleUtil } from './module-util';

export class $TranspileCache extends ExpiryFileCache {
  protected fromEntryName(val: string): string {
    return PathUtil.resolveUnix(ModuleUtil.resolveFrameworkPath(PathUtil.toUnix(val)
      .replace(this.outputDir, '')
      .replace(/^\//, '')
      .replace(/\/\/+/g, '/')
      .replace(Host.EXT.outputRe, Host.EXT.input)
    ));
  }

  protected toEntryName(val: string): string {
    val = PathUtil.toUnix(val).replace(PathUtil.cwd, '');
    return PathUtil.joinUnix(this.outputDir, ModuleUtil.normalizeFrameworkPath(val)
      .replace(/.*@travetto/, 'node_modules/@travetto')
      .replace(/^\//, '')
      .replace(Host.EXT.inputRe, Host.EXT.output)
    );
  }

  toEnv(): Record<string, string> {
    return { TRV_CACHE: this.outputDir };
  }
}

export const TranspileCache = new $TranspileCache(EnvUtil.get('TRV_CACHE', '.trv_cache'));
