import type { PoolOptions } from 'mysql2';

import { Config } from '@travetto/config';
import { Runtime } from '@travetto/runtime';

/**
 * MySQL Model Configuration
 */
@Config('model.mysql')
export class MysqlModelConfig {
  /**
   * Database host to connect to
   */
  host = '127.0.0.1';

  /**
   * Database port to connect to
   */
  port = 0;

  /**
   * Database username
   */
  user = Runtime.production ? '' : 'travetto';

  /**
   * Database password
   */
  password = Runtime.production ? '' : 'travetto';

  /**
   * Namespace/schema prefix for table names
   */
  namespace = '';

  /**
   * Database name
   */
  database = 'app';

  /**
   * Allow storage modifications (like table auto-creation and schema updates) at runtime
   */
  modifyStorage = !Runtime.production;

  /**
   * Extended client options
   */
  options?: PoolOptions;
}
