import type { DatabaseSyncOptions } from 'node:sqlite';

import { Config } from '@travetto/config';

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
   * Allow storage modifications (like table auto-creation and schema updates) at runtime
   */
  modifyStorage?: boolean;

  /**
   * SQLite file location
   */
  file?: string;

  /**
   * Custom options
   */
  options?: DatabaseSyncOptions;
}
