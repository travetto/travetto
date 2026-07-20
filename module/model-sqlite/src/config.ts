import type { DatabaseSyncOptions } from 'node:sqlite';

import { SQLModelConfig } from '@travetto/model-sql';
import { Config } from '@travetto/schema';

/**
 * SQLite Model Configuration
 */
@Config('model.sqlite')
export class SqliteModelConfig extends SQLModelConfig<DatabaseSyncOptions & { file?: string }> {}
