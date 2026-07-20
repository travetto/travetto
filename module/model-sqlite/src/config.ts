import type { DatabaseSyncOptions } from 'node:sqlite';

import { Config } from '@travetto/config';
import { SQLModelConfig } from '@travetto/model-sql';

/**
 * SQLite Model Configuration
 */
@Config('model.sqlite')
export class SqliteModelConfig extends SQLModelConfig<DatabaseSyncOptions & { file?: string }> {}
