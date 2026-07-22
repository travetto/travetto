import type { DatabaseSyncOptions } from 'node:sqlite';

import { Config } from '@travetto/config';
import { Runtime } from '@travetto/runtime';

/**
 * SQLite Model Configuration
 */
@Config('model.sqlite')
export class SqliteModelConfig {
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
   * SQLite file location
   */
  file?: string;

  /**
   * Custom options
   */
  options?: DatabaseSyncOptions;
}
