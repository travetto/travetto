import { Config, EnvVar } from '@travetto/config';

/**
 * Web configuration
 */
@Config('web')
export class WebConfig {
  /**
   * Should the app provide the global endpoint for app info
   */
  @EnvVar('WEB_DEFAULT_MESSAGE')
  defaultMessage = true;
  /**
   * Base Url
   */
  @EnvVar('WEB_BASE_URL')
  baseUrl?: string;
}
