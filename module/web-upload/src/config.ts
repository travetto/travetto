import { Config } from '@travetto/config';
import { Ignore } from '@travetto/schema';

/**
 * Config for uploading within @travetto/web
 */
@Config('web.upload')
export class WebUploadConfig {
  applies = false;

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
  uploads?: Record<string, Partial<WebUploadConfig>>;

  @Ignore()
  matcher: (contentType: string) => boolean;
}