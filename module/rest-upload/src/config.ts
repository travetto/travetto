import { Config } from '@travetto/config';
import { ManagedInterceptorConfig } from '@travetto/rest';
import { Ignore } from '@travetto/schema';

/**
 * Config for uploading within @travetto/rest
 */
@Config('rest.upload')
export class RestUploadConfig extends ManagedInterceptorConfig {
  /**
   * Max file size in bytes
   */
  maxSize = 10 * 1024 * 1024;
  /**
   * List of types to allow/exclude
   */
  types: string[] = [];
  /**
   * Cleanup temporary files after request finishes
   */
  cleanupFiles: boolean = true;

  @Ignore()
  uploads?: Record<string, Partial<RestUploadConfig>>;

  @Ignore()
  matcher: (contentType: string) => boolean;
}