import type PG from 'pg';

import { Config } from '@travetto/config';
import { Runtime } from '@travetto/runtime';

/**
 * PostgreSQL Model Configuration
 */
@Config('model.postgres')
export class PostgresModelConfig {
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
   * Client specific overrides
   */
  options?: PG.ClientConfig;
}
