import type { DatabaseSyncOptions } from 'node:sqlite';

import { Config } from '@travetto/config';
import { asFull, Runtime } from '@travetto/runtime';

/**
 * Configuration for the SQLite JSON Model service
 */
@Config('model.sqlite.json')
export class SqliteJsonModelConfig<ClientOptions extends DatabaseSyncOptions = DatabaseSyncOptions> {
  /**
   * Database file to connect to. If not specified, a default file in the tool path is used.
   */
  file = '';

  /**
   * Namespace/schema prefix for table names
   */
  namespace = '';

  /**
   * Allow storage modifications (like table auto-creation and schema updates) at runtime
   */
  modifyStorage = !Runtime.production;

  /**
   * Extra raw database client options passed to DatabaseSync
   */
  options: ClientOptions = asFull({});
}
