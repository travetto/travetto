import { Config } from '@travetto/schema';
import { SQLModelConfig } from '@travetto/model-sql';
import type { DatabaseSyncOptions } from 'node:sqlite';

/**
 * SQLite Model Configuration
 */
@Config('model.sqlite')
export class SqliteModelConfig extends SQLModelConfig<DatabaseSyncOptions & { file?: string }> {
}
