import { Config } from '@travetto/config';
import { ManagedInterceptorConfig } from '@travetto/rest';
import { Ignore } from '@travetto/schema';

/**
 * Config for assets within @travetto/rest
 */
@Config('rest.asset')
export class RestAssetConfig extends ManagedInterceptorConfig {
  /**
   * Max file size in bytes
   */
  maxSize = 10 * 1024 * 1024;
  /**
   * List of types to allow/exclude
   */
  types: string[] = [];
  /**
   * Delete files after use
   */
  deleteFiles: boolean = true;

  @Ignore()
  files?: Record<string, Partial<RestAssetConfig>>;

  @Ignore()
  matcher: (contentType: string) => boolean;
}