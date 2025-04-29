import { Config } from '@travetto/config';

/**
 * Web configuration
 */
@Config('web')
export class WebConfig {
  /**
   * Should the app provide the global endpoint for app info
   */
  defaultMessage = true;
  /**
   * Base Url
   */
  baseUrl?: string;
}
